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
import { appendSitemapUrls, renderStaticPage } from "./page-shell.mjs";

const SITE_URL = siteConfig.siteUrl;
const distDir = resolve(import.meta.dirname, "..", "dist");
const dataDir = resolve(import.meta.dirname, "..", "app", "data");

const readJson = (path) => readFile(path, "utf8").then(JSON.parse);

const homeCrumb = { name: "صفحه اصلی", url: `${SITE_URL}/` };
const indexUrl = `${SITE_URL}${GUIDE_BASE_PATH}`;
const indexCrumb = { name: guideIndex.title, url: indexUrl };

const [baseHtml, snapshot] = await Promise.all([
  readFile(resolve(distDir, "index.html"), "utf8"),
  readJson(resolve(dataDir, "catalog-prices.json")),
]);

const reference = buildGuideReference(snapshot);


const pages = [
  {
    outPath: ["guide"],
    guide: undefined,
    title: guideIndex.seoTitle,
    description: guideIndex.seoDescription,
    pageUrl: indexUrl,
    lastmod: guideIndex.lastmod,
    rootAttributes: ' data-page="guide"',
    breadcrumb: [homeCrumb, indexCrumb],
  },
  ...guidePageKeys.map((key) => {
    const definition = guidePageDefinitions[key];
    const pageUrl = `${indexUrl}${key}/`;
    return {
      outPath: ["guide", key],
      guide: key,
      title: definition.seoTitle,
      description: definition.seoDescription,
      pageUrl,
      lastmod: definition.lastmod,
      rootAttributes: ` data-page="guide" data-guide="${key}"`,
      breadcrumb: [
        homeCrumb,
        indexCrumb,
        { name: definition.title, url: pageUrl },
      ],
    };
  }),
];

await Promise.all(
  pages.map(async (page) => {
    const outDir = resolve(distDir, ...page.outPath);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      resolve(outDir, "index.html"),
      renderStaticPage(baseHtml, {
        title: page.title,
        description: page.description,
        pageUrl: page.pageUrl,
        rootHtml: renderToString(
          React.createElement(GuidePage, { guide: page.guide, reference }),
        ),
        rootAttributes: page.rootAttributes,
        // The reference tables are computed at build time so the page hydrates
        // against exactly the bytes it was prerendered from.
        payloads: [{ id: "initial-guide-data", data: reference }],
        breadcrumb: page.breadcrumb,
      }),
      "utf8",
    );
  }),
);

await appendSitemapUrls(resolve(distDir, "sitemap.xml"), pages);

console.log(
  `تولید و پیش‌رندر ${pages.length.toLocaleString("fa-IR")} صفحه راهنمای فنی و بروزرسانی sitemap با موفقیت انجام شد.`,
);
