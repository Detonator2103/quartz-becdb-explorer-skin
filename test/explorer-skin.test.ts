// @vitest-environment node
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { render } from "preact-render-to-string";
import { h } from "preact";
// Tests run against the built bundle (see the "test" script, which builds first)
import { ExplorerSkin } from "../dist/index.js";

const INDEX = {
  "Билды/01-Леви": { slug: "Билды/01-Леви", tags: ["wip"], title: "Леви" },
  "Билды/02-Гравиэль": { slug: "Билды/02-Гравиэль", tags: ["new", "wip"], title: "Гравиэль" },
  "Билды/03-Обычный": { slug: "Билды/03-Обычный", tags: ["другое"], title: "Обычный" },
  "Билды/index": { slug: "Билды/index", tags: ["important"], title: "Билды" },
  "Гайды/index": { slug: "Гайды/index", tags: [], title: "Гайды" },
};

const LIST = `
<ul class="explorer-ul">
  <li><div class="folder-container" data-folderpath="Билды/index"><div><button class="folder-button"></button></div></div>
    <div class="folder-outer"><ul class="content">
      <li><a href="../Билды/01-Леви">Леви</a></li>
      <li><a href="/repo/%D0%91%D0%B8%D0%BB%D0%B4%D1%8B/02-%D0%93%D1%80%D0%B0%D0%B2%D0%B8%D1%8D%D0%BB%D1%8C">Гравиэль</a></li>
      <li><a href="../Билды/03-Обычный">Обычный</a></li>
    </ul></div></li>
  <li><div class="folder-container" data-folderpath="Гайды/index"></div></li>
</ul>`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (opts: any = {}) => render(h(ExplorerSkin(opts) as any, {}));

async function setup(extraList = LIST) {
  const dom = new JSDOM(
    `<!doctype html><body>${html()}<div class="explorer">${extraList}</div></body>`,
    { runScripts: "outside-only", url: "http://localhost/repo/Билды/01-Леви" },
  );
  const w = dom.window;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (w as any).fetchData = Promise.resolve(INDEX);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (w as any).addCleanup = () => {};
  w.eval(ExplorerSkin().afterDOMLoaded as string);
  w.document.dispatchEvent(new w.CustomEvent("nav", { detail: { url: "Билды/01-Леви" } }));
  await new Promise((r) => setTimeout(r, 20));
  return w;
}

const skin = (el: Element | null) => (el as HTMLElement | null)?.dataset.skin;

const css = (opts = {}) => ExplorerSkin(opts).css as string;
const block = (source: string, theme: string) =>
  source.match(
    new RegExp(
      `:root\\[saved-theme="${theme}"\\] \\.explorer-content ul li > a,\\n:root\\[saved-theme="${theme}"\\] \\.explorer-content \\.folder-container \\{\\n  background-image: [^}]*\\}`,
    ),
  )?.[0] ?? "";

describe("generated CSS", () => {
  it("paints three parts: both ends plus a stretched middle that reaches under the ends", () => {
    const out = css();
    expect(out).toContain(':root[saved-theme="buttons"]');
    expect(block(out, "buttons")).toContain(
      "background-image: var(--skin-l), var(--skin-r), var(--skin-m)",
    );
    expect(block(out, "buttons")).toContain("+ 2 * var(--skin-overlap)");
    expect(out).toContain('url("static/explorer-skin/file-left.png")');
    expect(out).toContain('url("static/explorer-skin/wip-middle.png")');
    expect(out).toContain('url("static/explorer-skin/important-right.png")');
    expect(out).toContain('[data-skin="wip"]');
  });

  it("draws only the ends that `ends` asks for; the middle always stays", () => {
    const edges = (ends: string) =>
      css({ themes: [{ id: "t", ends }] })
        .match(/--skin-edge-l: (\S+);\n {2}--skin-edge-r: (\S+);/)
        ?.slice(1, 3);

    const left = css({ themes: [{ id: "t", ends: "left" }] });
    expect(block(left, "t")).toContain("background-image: var(--skin-l), var(--skin-m)");
    expect(edges("left")).toEqual(["20px", "0px"]);

    const right = css({ themes: [{ id: "t", ends: "right" }] });
    expect(block(right, "t")).toContain("background-image: var(--skin-r), var(--skin-m)");
    expect(edges("right")).toEqual(["0px", "20px"]);

    const none = css({ themes: [{ id: "t", ends: "none" }] });
    expect(block(none, "t")).toContain("background-image: var(--skin-m);");
    expect(edges("none")).toEqual(["0px", "0px"]);

    expect(edges("both")).toEqual(["20px", "20px"]);
  });

  it("gives every theme its own ends", () => {
    const out = css({
      themes: [
        { id: "a", ends: "left" },
        { id: "b", ends: "none" },
      ],
    });
    expect(block(out, "a")).toContain("var(--skin-l), var(--skin-m)");
    expect(block(out, "b")).toContain("background-image: var(--skin-m);");
    expect(out).toContain(':root[saved-theme="a"] .explorer-content [data-skin="wip"]');
    expect(out).toContain(':root[saved-theme="b"] .explorer-content [data-skin="wip"]');
  });

  it("still accepts the single `theme` shorthand", () => {
    const out = css({ theme: "neon", ends: "right" });
    expect(block(out, "neon")).toContain("var(--skin-r), var(--skin-m)");
    expect(out).not.toContain('saved-theme="buttons"');
  });

  it("follows the size options", () => {
    const out = css({
      rowHeight: "32px",
      edgeLeft: "12px",
      edgeRight: "16px",
      overlap: "2px",
      variants: ["draft"],
    });
    expect(out).toContain("--skin-height: 32px");
    expect(out).toContain("--skin-edge-l: 12px");
    expect(out).toContain("--skin-edge-r: 16px");
    expect(out).toContain("--skin-overlap: 2px");
    expect(out).toContain('[data-skin="draft"]');
    expect(out).not.toContain('"wip"');
  });

  it("keeps rows off the window edge on phones and hides them while the explorer is closed", () => {
    const out = css({ mobileGutter: "18px" });
    const phone = out.slice(out.indexOf("@media all and (max-width: 800px)"));
    expect(phone).toContain("--skin-gutter: 18px");
    expect(phone).toContain(".explorer.collapsed .explorer-content ul li > a");
    expect(phone).toContain(".explorer.collapsed .explorer-content .folder-container");
    expect(phone).toContain("visibility: hidden");
  });
});

describe("marking rows by tags", () => {
  it("renders an invisible holder with the variants", () => {
    expect(html()).toContain("hidden");
    expect(html()).toContain("data-variants");
  });

  it("marks notes and folders; the first configured variant wins; others stay unmarked", async () => {
    const w = await setup();
    const rows = [...w.document.querySelectorAll<HTMLAnchorElement>("li > a")];
    expect(skin(rows[0] ?? null)).toBe("wip");
    // tags [new, wip]: "wip" comes first in the configured list
    expect(skin(rows[1] ?? null)).toBe("wip");
    expect(skin(rows[2] ?? null)).toBeUndefined();

    const folders = w.document.querySelectorAll(".folder-container");
    expect(skin(folders[0] ?? null)).toBe("important");
    expect(skin(folders[1] ?? null)).toBeUndefined();
  });

  it("marks the rows again after the explorer rebuilds its list", async () => {
    const w = await setup();
    const list = w.document.querySelector(".explorer-ul")!;
    list.innerHTML =
      '<li><a href="../Билды/03-Обычный">Обычный</a></li><li><a href="../Билды/01-Леви">Леви</a></li>';
    await new Promise((r) => setTimeout(r, 20));
    const rows = [...w.document.querySelectorAll<HTMLAnchorElement>("li > a")];
    expect(skin(rows[0] ?? null)).toBeUndefined();
    expect(skin(rows[1] ?? null)).toBe("wip");
  });

  it("removes the mark when the tag is gone", async () => {
    const w = await setup();
    const first = w.document.querySelector<HTMLAnchorElement>("li > a")!;
    expect(skin(first)).toBe("wip");
    INDEX["Билды/01-Леви"].tags = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (w as any).fetchData = Promise.resolve(INDEX);
    // a fresh page load builds a fresh tag map
    const w2 = await setup();
    expect(skin(w2.document.querySelector("li > a"))).toBeUndefined();
    INDEX["Билды/01-Леви"].tags = ["wip"];
  });
});
