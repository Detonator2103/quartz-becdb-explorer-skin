// Marks explorer rows with `data-skin="<variant>"` when the note (or the folder's index.md) has one
// of the configured tags. The explorer plugin rebuilds its whole list on every navigation, so a
// MutationObserver re-marks the rows after each render. The look itself is pure CSS.

type TagMap = Map<string, string[]>;

let tagMapPromise: Promise<TagMap> | null = null;

function loadTagMap(): Promise<TagMap> {
  if (!tagMapPromise) {
    tagMapPromise = fetchData.then((data) => {
      const content = ((data as { content?: unknown }).content ?? data) as Record<
        string,
        { slug?: string; tags?: unknown }
      >;
      const map: TagMap = new Map();
      for (const [key, entry] of Object.entries(content)) {
        const tags = Array.isArray(entry?.tags) ? (entry.tags as string[]) : [];
        const slug = entry?.slug ?? key;
        map.set(key, tags);
        map.set(slug, tags);
        // a folder's page is reachable both as "folder/index" and as "folder"
        if (slug.endsWith("/index")) map.set(slug.slice(0, -"/index".length), tags);
      }
      return map;
    });
  }
  return tagMapPromise;
}

function readVariants(): string[] {
  const holder = document.querySelector<HTMLElement>(".explorer-skin");
  try {
    return JSON.parse(holder?.dataset.variants ?? "[]") as string[];
  } catch {
    return [];
  }
}

// The link's address ends with the note's slug; the base path of the site is not needed
function tagsForHref(map: TagMap, href: string): string[] | undefined {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(href, document.baseURI).pathname);
  } catch {
    return undefined;
  }
  const segments = pathname.split("/").filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const tags = map.get(segments.slice(i).join("/"));
    if (tags) return tags;
  }
  return undefined;
}

function mark(el: HTMLElement, tags: string[] | undefined, variants: string[]) {
  const variant = tags ? variants.find((v) => tags.includes(v)) : undefined;
  if (variant) el.dataset.skin = variant;
  else delete el.dataset.skin;
}

async function decorate() {
  const variants = readVariants();
  if (variants.length === 0) return;
  const map = await loadTagMap();

  document.querySelectorAll<HTMLAnchorElement>(".explorer-ul li > a[href]").forEach((link) => {
    mark(link, tagsForHref(map, link.getAttribute("href") ?? ""), variants);
  });
  document.querySelectorAll<HTMLElement>(".explorer-ul .folder-container").forEach((folder) => {
    const path = folder.dataset.folderpath ?? "";
    mark(folder, map.get(path) ?? map.get(path.replace(/\/index$/, "")), variants);
  });
}

function setupExplorerSkin() {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      void decorate();
    }, 0);
  };

  const observer = new MutationObserver(schedule);
  document.querySelectorAll(".explorer-ul").forEach((list) => {
    observer.observe(list, { childList: true, subtree: true });
  });
  window.addCleanup?.(() => observer.disconnect());

  schedule();
}

document.addEventListener("nav", setupExplorerSkin);
document.addEventListener("render", setupExplorerSkin);
