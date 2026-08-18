import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import GuidePage from "../app/GuidePage.tsx";
import {
  GUIDE_BASE_PATH,
  guideIndex,
  guidePageDefinitions,
  guidePageKeys,
} from "../app/guide-page-data.ts";
import { buildGuideReference } from "../app/steel-reference.ts";
import { siteConfig } from "../app/site-config.ts";
import {
  appendSitemapUrls,
  buildBreadcrumbJsonLd,
  replaceSocialMeta,
} from "./html-template-utils.mjs";

const SITE_URL = siteConfig.siteUrl;
const distDir = resolve(import.meta.dirname, "..", "dist");
const dataDir = resolve(import.meta.dirname, "..", "app", "data");

const readJson = (path) => readFile(path, "utf8").then(JSON.parse);

/*
 * dist/index.html is already prerendered by the time this script runs, so the
 * root element holds a deep tree of nested <div>s. The match has to be greedy
 * to the LAST </div> in the document -- a lazy match stops at the first inner
 * closing tag and leaves the rest of the homepage stranded in the output.
 */
const replaceRootContent = (html, attributes, content) =>
  html.replace(
    /<div id="root"[\s\S]*<\/div>/,
    `<div id="root"${attributes}>${content}</div>`,
  );

function buildGuideHtml(baseHtml, entry, renderedHtml, reference) {
  const { title, description, pageUrl, rootAttributes, breadcrumbItems } = entry;

  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${pageUrl}$2`)
    .replace(
      /\s*<script id="organization-structured-data"[\s\S]*?<\/script>/,
      "",
    )
    .replace(/\s*<script id="initial-overview-data"[\s\S]*?<\/script>/, "")
    // GuidePage renders neither the catalog nor the mega menu.
    .replace(/\s*<script id="initial-menu-data"[\s\S]*?<\/script>/, "")
    // The base document is the prerendered homepage, whose preload tag is
    // pretty-printed across several lines -- match whitespace, not one space.
    .replace(/\s*<link\s+id="hero-image-preload"[\s\S]*?\/>/, "");

  html = replaceSocialMeta(html, { title, description, pageUrl });

  html = replaceRootContent(html, rootAttributes, renderedHtml);

  const referenceScript = `\n    <script id="initial-guide-data" type="application/json">${JSON.stringify(reference)}</script>`;
  html = html.replace("</body>", `${referenceScript}\n  </body>`);

  return html.replace(
    "</head>",
    `${buildBreadcrumbJsonLd(breadcrumbItems)}\n  </head>`,
  );
}

const [baseHtml, rebar, beam, products] = await Promise.all([
  readFile(resolve(distDir, "index.html"), "utf8"),
  readJson(resolve(dataDir, "rebar-prices.json")),
  readJson(resolve(dataDir, "beam-prices.json")),
  readJson(resolve(dataDir, "product-prices.json")),
]);

const reference = buildGuideReference(rebar, beam, products);

const indexUrl = `${SITE_URL}${GUIDE_BASE_PATH}`;
const entries = [
  {
    outPath: ["guide"],
    guide: undefined,
    title: guideIndex.seoTitle,
    description: guideIndex.seoDescription,
    pageUrl: indexUrl,
    lastmod: guideIndex.lastmod,
    rootAttributes: ' data-page="guide"',
    breadcrumbItems: [
      { name: "صفحه اصلی", url: `${SITE_URL}/` },
      { name: guideIndex.title, url: indexUrl },
    ],
  },
  ...guidePageKeys.map((key) => {
    const definition = guidePageDefinitions[key];
    const pageUrl = `${SITE_URL}${GUIDE_BASE_PATH}${key}/`;
    return {
      outPath: ["guide", key],
      guide: key,
      title: definition.seoTitle,
      description: definition.seoDescription,
      pageUrl,
      lastmod: definition.lastmod,
      rootAttributes: ` data-page="guide" data-guide="${key}"`,
      breadcrumbItems: [
        { name: "صفحه اصلی", url: `${SITE_URL}/` },
        { name: guideIndex.title, url: indexUrl },
        { name: definition.title, url: pageUrl },
      ],
    };
  }),
];

await Promise.all(
  entries.map(async (entry) => {
    const renderedHtml = renderToString(
      React.createElement(GuidePage, { guide: entry.guide, reference }),
    );
    const outDir = resolve(distDir, ...entry.outPath);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      resolve(outDir, "index.html"),
      buildGuideHtml(baseHtml, entry, renderedHtml, reference),
      "utf8",
    );
  }),
);

await appendSitemapUrls(resolve(distDir, "sitemap.xml"), entries);

console.log(
  `تولید و پیش‌رندر ${entries.length.toLocaleString("fa-IR")} صفحه راهنمای فنی و بروزرسانی sitemap با موفقیت انجام شد.`,
);
