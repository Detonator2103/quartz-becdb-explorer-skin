import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
// @ts-expect-error - inline script imported as string by the Quartz bundler
import script from "./scripts/explorer-skin.inline.ts";

export type SkinEnds = "none" | "left" | "right" | "both";

export interface SkinTheme {
  /** Theme id (value of `saved-theme` on <html>) in which the skin is active */
  id: string;
  /** Which ends of the background are drawn: none, left, right or both. The middle part always is. */
  ends: SkinEnds;
}

export interface ExplorerSkinOptions {
  /** Themes with the skin, each with its own `ends` */
  themes: SkinTheme[];
  /** Shorthand for a single theme (ignored when `themes` is given) */
  theme?: string;
  /** `ends` of the single theme given as `theme` */
  ends?: SkinEnds;
  /** Tags that switch the background of a note or folder (folder = tags of its index.md) */
  variants: string[];
  /** Folder with the images, relative to the site root (i.e. inside quartz/static/) */
  imageDir: string;
  /** Height of a row = how tall the images are drawn */
  rowHeight: string;
  /** Width the left end image is drawn at */
  edgeLeft: string;
  /** Width the right end image is drawn at */
  edgeRight: string;
  /** The middle part reaches this far under each end, so no thin gap shows between the parts */
  overlap: string;
  /** Free space left and right of every row */
  gutter: string;
  /** The same on phones (keeps the ends away from the edge of the explorer window) */
  mobileGutter: string;
  /** Space between the text and the drawn ends */
  padding: string;
}

const DEFAULTS: ExplorerSkinOptions = {
  themes: [{ id: "buttons", ends: "both" }],
  variants: ["wip", "new", "important"],
  imageDir: "static/explorer-skin",
  rowHeight: "40px",
  edgeLeft: "20px",
  edgeRight: "20px",
  overlap: "1px",
  gutter: "4px",
  mobileGutter: "14px",
  padding: "6px",
};

const q = (value: string) => JSON.stringify(value);
const safe = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, "_");

function resolveThemes(o: Partial<ExplorerSkinOptions>): SkinTheme[] {
  if (o.themes && o.themes.length > 0) return o.themes;
  if (o.theme) return [{ id: o.theme, ends: o.ends ?? "both" }];
  return DEFAULTS.themes;
}

// Every row is painted with up to three background layers: the left end, the right end and the
// middle part. The ends keep their size (`edgeLeft` / `edgeRight`); only the middle is stretched, so
// the picture is never skewed at any window width. `ends` decides which end layers exist.
function layersFor(ends: SkinEnds) {
  const hasLeft = ends === "left" || ends === "both";
  const hasRight = ends === "right" || ends === "both";
  const images: string[] = [];
  const positions: string[] = [];
  const sizes: string[] = [];
  if (hasLeft) {
    images.push("var(--skin-l)");
    positions.push("left center");
    sizes.push("var(--skin-edge-l) 100%");
  }
  if (hasRight) {
    images.push("var(--skin-r)");
    positions.push("right center");
    sizes.push("var(--skin-edge-r) 100%");
  }
  images.push("var(--skin-m)");
  positions.push("calc(var(--skin-edge-l) - var(--skin-overlap)) center");
  sizes.push("calc(100% - var(--skin-edge-l) - var(--skin-edge-r) + 2 * var(--skin-overlap)) 100%");
  return { hasLeft, hasRight, images, positions, sizes };
}

export function buildCss(opts: Partial<ExplorerSkinOptions> = {}): string {
  const o = { ...DEFAULTS, ...opts };
  const themes = resolveThemes(opts);
  const names = ["file", "folder", ...o.variants];

  const roots = themes.map((t) => `:root[saved-theme=${q(t.id)}]`);

  // selector list: every suffix under every theme
  const sel = (...suffixes: string[]) =>
    themes
      .flatMap((t) => suffixes.map((x) => `:root[saved-theme=${q(t.id)}] ${x}`.trim()))
      .join(",\n");

  const files = ".explorer-content ul li > a";
  const folders = ".explorer-content .folder-container";

  const imageVars = names
    .map((n) =>
      ["left", "middle", "right"]
        .map(
          (part) =>
            `  --skin-${safe(n)}-${part[0]}: url(${q(`${o.imageDir}/${safe(n)}-${part}.png`)});`,
        )
        .join("\n"),
    )
    .join("\n");

  const pick = (n: string) =>
    `  --skin-l: var(--skin-${safe(n)}-l);\n  --skin-m: var(--skin-${safe(n)}-m);\n  --skin-r: var(--skin-${safe(n)}-r);`;

  const variantRules = o.variants
    .map((v) => `${sel(`.explorer-content [data-skin=${q(v)}]`)} {\n${pick(v)}\n}`)
    .join("\n\n");

  const perTheme = themes
    .map((t) => {
      const L = layersFor(t.ends);
      const root = `:root[saved-theme=${q(t.id)}]`;
      return `${root} {
  --skin-edge-l: ${L.hasLeft ? o.edgeLeft : "0px"};
  --skin-edge-r: ${L.hasRight ? o.edgeRight : "0px"};
}

${root} ${files},
${root} ${folders} {
  background-image: ${L.images.join(", ")};
  background-position: ${L.positions.join(", ")};
  background-size: ${L.sizes.join(", ")};
}`;
    })
    .join("\n\n");

  return `${roots.join(",\n")} {
  --skin-height: ${o.rowHeight};
  --skin-overlap: ${o.overlap};
  --skin-gutter: ${o.gutter};
  --skin-pad: ${o.padding};
${imageVars}
}

${perTheme}

${sel(files, folders)} {
  box-sizing: border-box;
  min-height: var(--skin-height);
  margin: 2px var(--skin-gutter);
  padding: 4px calc(var(--skin-edge-r) + var(--skin-pad)) 4px calc(var(--skin-edge-l) + var(--skin-pad));
  display: flex;
  align-items: center;
  background-repeat: no-repeat;
  opacity: 1;
  cursor: pointer;
  transition: filter 0.15s ease;
}

${sel(files)} {
${pick("file")}
}

${sel(folders)} {
${pick("folder")}
}

${variantRules}

${sel(`${files}:hover`, `${folders}:hover`)} {
  filter: brightness(1.12);
}

${sel(`${files}.active`)} {
  filter: brightness(1.25);
}

/* the whole row reacts to a click, not only the title */
${sel(`${folders} > div`)} {
  flex: 1 1 auto;
  min-width: 0;
}

${sel(`${folders} div > button`, `${folders} div > a`)} {
  width: 100%;
}

@media all and (max-width: 800px) {
  ${roots.join(",\n  ")} {
    --skin-gutter: ${o.mobileGutter};
  }

  /* the explorer window is closed: nothing of the rows may peek out (the explorer keeps open folders visible) */
  ${sel(`.explorer.collapsed ${files}`, `.explorer.collapsed ${folders}`)
    .split(",\n")
    .join(",\n  ")} {
    visibility: hidden;
    transition:
      filter 0.15s ease,
      visibility 0s linear 250ms;
  }
}
`;
}

export default ((opts?: Partial<ExplorerSkinOptions>) => {
  const o = { ...DEFAULTS, ...opts };

  const ExplorerSkin: QuartzComponent = (_props: QuartzComponentProps) => {
    // Invisible: only carries the variant tags to the script
    return <div class="explorer-skin" hidden data-variants={JSON.stringify(o.variants)}></div>;
  };

  ExplorerSkin.css = buildCss(opts ?? {});
  ExplorerSkin.afterDOMLoaded = script;
  return ExplorerSkin;
}) satisfies QuartzComponentConstructor<Partial<ExplorerSkinOptions>>;
