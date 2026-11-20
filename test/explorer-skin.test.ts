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

describe("generated CSS", () => {
  it("builds a 3-slice rule per row and one rule per variant", () => {
    const css = ExplorerSkin().css as string;
    expect(css).toContain(':root[saved-theme="buttons"]');
    expect(css).toContain("border-image-slice: 0 var(--skin-slice) 0 var(--skin-slice) fill");
    expect(css).toContain('[data-skin="wip"]');
    expect(css).toContain('[data-skin="important"]');
    expect(css).toContain('url("static/explorer-skin/wip.png")');
    expect(css).toContain(".folder-container");
  });

  it("follows the options", () => {
    const css = ExplorerSkin({
      theme: "neon",
      variants: ["draft"],
      imageDir: "static/skin",
      rowHeight: "32px",
      slice: 30,
      edge: "15px",
    }).css as string;
    expect(css).toContain(':root[saved-theme="neon"]');
    expect(css).toContain('[data-skin="draft"]');
    expect(css).toContain("--skin-height: 32px");
    expect(css).toContain("--skin-slice: 30");
    expect(css).toContain("--skin-edge: 15px");
    expect(css).not.toContain('"wip"');
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
