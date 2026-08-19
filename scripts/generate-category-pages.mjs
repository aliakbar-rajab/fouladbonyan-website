import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import App from "../app/App.tsx";
import { productGroups } from "../app/category-meta.ts";
import {
  loadGroupCatalog,
  primeCatalogSnapshot,
  snapshotTypeOf,
} from "../app/group-catalog.ts";
import { loadOverviewSummaries } from "../app/catalog-overview.ts";
import { buildMenuCatalog, setMenuCatalog } from "../app/menu-catalog.ts";
import { siteConfig } from "../app/site-config.ts";
import {
  appendPayloads,
  appendSitemapUrls,
  fillRoot,
  renderStaticPage,
  setSitemapRootLastmod,
} from "./page-shell.mjs";

const SITE_URL = siteConfig.siteUrl;
const distDir = resolve(import.meta.dirname, "..", "dist");
const dataDir = resolve(import.meta.dirname, "..", "app", "data");

const readJson = (path) => readFile(path, "utf8").then(JSON.parse);

const homeCrumb = { name: "صفحه اصلی", url: `${SITE_URL}/` };

async function loadSnapshots() {
  const [rebar, beam, product] = await Promise.all([
    readJson(resolve(dataDir, "rebar-prices.json")),
    readJson(resolve(dataDir, "beam-prices.json")),
    readJson(resolve(dataDir, "product-prices.json")),
  ]);

  const latestDate = [rebar, beam, product]
    .map((snapshot) => snapshot.fetchedAt.slice(0, 10))
    .sort()
    .at(-1);

  return { snapshots: { rebar, beam, product }, latestDate };
}

function buildHeroPreloadTag(group) {
  const heroImg = group.heroImage ?? group.image;
  if (heroImg.includes("hero-")) {
    const base = heroImg
      .replace(/-1680\.(jpg|webp|avif)$/, "")
      .replace(/\.(jpg|webp|avif)$/, "");
    return `<link
      id="hero-image-preload"
      rel="preload"
      as="image"
      href="${base}-1680.webp"
      imagesrcset="${base}-640.webp 640w, ${base}-960.webp 960w, ${base}-1280.webp 1280w, ${base}-1680.webp 1672w"
      imagesizes="100vw"
      fetchpriority="high"
    />`;
  }
  const base = heroImg.replace(/\.(jpg|webp|avif)$/, "");
  return `<link
      id="hero-image-preload"
      rel="preload"
      as="image"
      href="${base}.webp"
      imagesrcset="${base}-240.webp 240w, ${base}-384.webp 384w"
      imagesizes="100vw"
      fetchpriority="high"
    />`;
}

const [baseHtml, { snapshots, latestDate }] = await Promise.all([
  readFile(resolve(distDir, "index.html"), "utf8"),
  loadSnapshots(),
]);

// Prime the caches every prerender reads through.
for (const [type, data] of Object.entries(snapshots)) {
  primeCatalogSnapshot({ type, data });
}

/*
 * The mega menu renders from this small payload rather than from the price
 * snapshots, and every page that renders <App /> embeds it. Without it the menu
 * would be populated during prerender (caches primed above) but "loading" in
 * the browser on any route that does not ship the rebar snapshot -- a
 * guaranteed hydration mismatch. Build it once, before anything is rendered.
 */
const menuCatalog = await buildMenuCatalog();
setMenuCatalog(menuCatalog);
const menuPayload = { id: "initial-menu-data", data: menuCatalog };

// 1. Prerender the homepage (dist/index.html). It is the base document with
// its own root filled in, so it keeps every tag the other pages rewrite.
const overviewSummaries = await loadOverviewSummaries();
await writeFile(
  resolve(distDir, "index.html"),
  appendPayloads(
    fillRoot(baseHtml, renderToString(React.createElement(App))),
    [menuPayload, { id: "initial-overview-data", data: overviewSummaries }],
  ),
  "utf8",
);

// 2. Describe every category landing page and subcategory page.
const pages = [];

for (const group of productGroups) {
  const catalog = await loadGroupCatalog(group.id);
  const snapshotType = snapshotTypeOf(group.id);
  // A group is only as fresh as the snapshot it is served from.
  const lastmod = catalog.fetchedAt.slice(0, 10);
  const payloads = [
    menuPayload,
    {
      id: "initial-page-data",
      data: { type: snapshotType, data: snapshots[snapshotType] },
    },
  ];
  const heroPreload = buildHeroPreloadTag(group);
  const groupUrl = `${SITE_URL}/${group.id}/`;
  const groupCrumb = { name: group.label, url: groupUrl };

  pages.push({
    outPath: [group.id],
    appProps: { initialCategory: group.id },
    lastmod,
    page: {
      title: group.seoTitle,
      description: group.seoDescription,
      pageUrl: groupUrl,
      rootAttributes: ` data-initial-category="${group.id}"`,
      heroPreload,
      payloads,
      breadcrumb: [homeCrumb, groupCrumb],
    },
  });

  for (const sub of catalog.categories) {
    const pageUrl = `${groupUrl}${sub.id}/`;
    pages.push({
      outPath: [group.id, sub.id],
      appProps: {
        initialCategory: group.id,
        initialSubcategory: sub.id,
        initialSubcategoryLabel: sub.label,
      },
      lastmod,
      page: {
        title: `قیمت ${sub.label} امروز | بنیان فولاد داریا`,
        description: `قیمت روز ${sub.label} از کارخانه‌های معتبر کشور. استعلام قیمت، مشخصات فنی و درخواست پیش‌فاکتور ${sub.label} با مشاوره تلفنی بنیان فولاد داریا.`,
        pageUrl,
        rootAttributes: ` data-initial-category="${group.id}" data-initial-subcategory="${sub.id}" data-initial-subcategory-label="${sub.label}"`,
        heroPreload,
        payloads,
        breadcrumb: [homeCrumb, groupCrumb, { name: sub.label, url: pageUrl }],
      },
    });
  }
}

await Promise.all(
  pages.map(async ({ outPath, appProps, page }) => {
    const rootHtml = renderToString(React.createElement(App, appProps));
    const outDir = resolve(distDir, ...outPath);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      resolve(outDir, "index.html"),
      renderStaticPage(baseHtml, { ...page, rootHtml }),
      "utf8",
    );
  }),
);

const sitemapPath = resolve(distDir, "sitemap.xml");
await setSitemapRootLastmod(sitemapPath, {
  siteUrl: SITE_URL,
  lastmod: latestDate,
});
await appendSitemapUrls(
  sitemapPath,
  pages.map(({ page, lastmod }) => ({ pageUrl: page.pageUrl, lastmod })),
);

const subcategoryCount = pages.length - productGroups.length;
console.log(
  `تولید و پیش‌رندر ${productGroups.length} صفحه‌ی فرود دسته‌بندی، ${subcategoryCount} صفحه‌ی زیردسته، صفحه اصلی و بروزرسانی sitemap با موفقیت انجام شد.`,
);
