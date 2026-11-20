import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
// @ts-expect-error - inline script imported as string by the Quartz bundler
import script from "./scripts/explorer-skin.inline.ts";

export interface ExplorerSkinOptions {
  /** Theme id (value of `saved-theme` on <html>) in which the skin is active */
  theme: string;
  /** Tags that switch the background of a note or folder (folder = tags of its index.md) */
  variants: string[];
  /** Folder with the images, relative to the site root (i.e. inside quartz/static/) */
  imageDir: string;
  /** Height of a row (the height of the images) */
  rowHeight: string;
  /** Width of each fixed end in the image, in image pixels */
  slice: number;
  /** Width of each fixed end on screen (a CSS length; smaller than `slice` for 2x images) */
  edge: string;
}

const DEFAULTS: ExplorerSkinOptions = {
  theme: "buttons",
  variants: ["wip", "new", "important"],
  imageDir: "static/explorer-skin",
  rowHeight: "40px",
  slice: 20,
  edge: "20px",
};

const q = (value: string) => JSON.stringify(value);

// The stylesheet is generated from the options so the theme id and the variants are configurable.
// 3-slice: `border-image` keeps both ends of the image at a fixed size and stretches only the
// middle (`fill` paints the middle part), so the picture is never skewed at any width.
export function buildCss(o: ExplorerSkinOptions): string {
  const root = `:root[saved-theme=${q(o.theme)}]`;
  const rows = `${root} .explorer-content ul li > a,\n${root} .explorer-content .folder-container`;
  const variantVars = o.variants
    .map((v) => `  --skin-${cssId(v)}: url(${q(`${o.imageDir}/${fileId(v)}.png`)});`)
    .join("\n");
  const variantRules = o.variants
    .map(
      (v) =>
        `${root} .explorer-content [data-skin=${q(v)}] {\n  --skin-img: var(--skin-${cssId(v)});\n}`,
    )
    .join("\n");

  return `${root} {
  --skin-height: ${o.rowHeight};
  --skin-slice: ${o.slice};
  --skin-edge: ${o.edge};
  --skin-file: url(${q(`${o.imageDir}/file.png`)});
  --skin-folder: url(${q(`${o.imageDir}/folder.png`)});
${variantVars}
}

${rows} {
  box-sizing: border-box;
  min-height: var(--skin-height);
  margin: 2px 0;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  border-style: solid;
  border-color: transparent;
  border-width: 0 var(--skin-edge);
  border-image-source: var(--skin-img);
  border-image-slice: 0 var(--skin-slice) 0 var(--skin-slice) fill;
  border-image-width: 0 var(--skin-edge) 0 var(--skin-edge);
  border-image-repeat: stretch;
  opacity: 1;
  cursor: pointer;
  transition: filter 0.15s ease;
}

${root} .explorer-content ul li > a {
  --skin-img: var(--skin-file);
}

${root} .explorer-content .folder-container {
  --skin-img: var(--skin-folder);
}

${variantRules}

${root} .explorer-content ul li > a:hover,
${root} .explorer-content .folder-container:hover {
  filter: brightness(1.12);
}

${root} .explorer-content ul li > a.active {
  filter: brightness(1.25);
}

/* the whole row reacts to a click, not only the title */
${root} .explorer-content .folder-container > div {
  flex: 1 1 auto;
  min-width: 0;
}

${root} .explorer-content .folder-container div > button,
${root} .explorer-content .folder-container div > a {
  width: 100%;
}
`;
}

function cssId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function fileId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export default ((opts?: Partial<ExplorerSkinOptions>) => {
  const o = { ...DEFAULTS, ...opts };

  const ExplorerSkin: QuartzComponent = (_props: QuartzComponentProps) => {
    // Invisible: only carries the variant tags to the script
    return <div class="explorer-skin" hidden data-variants={JSON.stringify(o.variants)}></div>;
  };

  ExplorerSkin.css = buildCss(o);
  ExplorerSkin.afterDOMLoaded = script;
  return ExplorerSkin;
}) satisfies QuartzComponentConstructor<Partial<ExplorerSkinOptions>>;
