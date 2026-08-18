import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import App from "../app/App.tsx";
import { productGroups } from "../app/category-meta.ts";
import { loadBeamPriceData, loadRebarPriceData } from "../app/catalog-data.ts";
import { loadProductPricePayload } from "../app/product-price-data.ts";
import { loadOverviewSummaries } from "../app/catalog-overview.ts";
import { buildMenuCatalog, setMenuCatalog } from "../app/menu-catalog.ts";
import { replaceTagContent } from "./html-template-utils.mjs";

const SITE_URL = "https://fouladbonyan.com";
const distDir = resolve(import.meta.dirname, "..", "dist");
const dataDir = resolve(import.meta.dirname, "..", "app", "data");

const readJson = (path) => readFile(path, "utf8").then(JSON.parse);

async function loadPriceData() {
  const [rebar, beam, products] = await Promise.all([
    readJson(resolve(dataDir, "rebar-prices.json")),
    readJson(resolve(dataDir, "beam-prices.json")),
    readJson(resolve(dataDir, "product-prices.json")),
  ]);

  const dates = new Map();
  dates.set("rebar", rebar.fetchedAt.slice(0, 10));
  dates.set("beam", beam.fetchedAt.slice(0, 10));

  const productDate = products.fetchedAt.slice(0, 10);
  for (const group of productGroups) {
    if (!dates.has(group.id)) {
      dates.set(group.id, productDate);
    }
  }

  const latestDate = [rebar.fetchedAt, beam.fetchedAt, products.fetchedAt]
    .sort()
    .at(-1)
    .slice(0, 10);

  return { rebar, beam, products, dates, latestDate };
}

function computeOverviewSummaries(rebarData, beamData, productData) {
  return productGroups.map((group) => {
    const isRebar = group.id === "rebar";
    const isBeam = group.id === "beam";
    const isPipe = group.id === "pipe";

    const categories = isRebar
      ? rebarData.categories
      : isBeam
        ? beamData.categories
        : productData.catalogs.find((c) => c.id === group.id)?.categories ?? [];

    const unit = isBeam || isPipe ? "شاخه / کیلوگرم" : "کیلوگرم";

    const minValues = categories
      .map((c) => c.summary.min)
      .filter((v) => typeof v === "number" && v > 0);
    const maxValues = categories
      .map((c) => c.summary.max)
      .filter((v) => typeof v === "number" && v > 0);

    const minPrice = minValues.length > 0 ? Math.min(...minValues) : null;
    const maxPrice = maxValues.length > 0 ? Math.max(...maxValues) : null;
    const firstSummary = categories[0]?.summary;

    return {
      id: group.id,
      label: group.label,
      shortLabel: group.shortLabel,
      subTypes: group.subTypes,
      image: group.image,
      description: group.description,
      minPrice,
      maxPrice,
      unit,
      date: firstSummary?.date || "امروز",
      status: firstSummary?.status || "steady",
      percent: firstSummary?.percent || 0,
    };
  });
}

function buildBreadcrumbJsonLd(group) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "صفحه اصلی", item: `${SITE_URL}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: group.label,
        item: `${SITE_URL}/${group.id}/`,
      },
    ],
  };
  return `\n    <script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

function buildSubcategoryBreadcrumbJsonLd(group, sub) {
  const pageUrl = `${SITE_URL}/${group.id}/${sub.id}/`;
  const payload = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "صفحه اصلی", item: `${SITE_URL}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: group.label,
        item: `${SITE_URL}/${group.id}/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: sub.label,
        item: pageUrl,
      },
    ],
  };
  return `\n    <script type="application/ld+json">${JSON.stringify(payload)}</script>`;
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

function buildCategoryHtml(baseHtml, group, renderedAppHtml, dataPayload) {
  const pageUrl = `${SITE_URL}/${group.id}/`;

  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${group.seoTitle}</title>`)
    .replace(
      /(<link rel="canonical" href=")[^"]*(")/,
      `$1${pageUrl}$2`,
    )
    .replace(
      /\s*<script id="organization-structured-data"[\s\S]*?<\/script>/,
      "",
    )
    .replace(
      /\s*<script id="initial-overview-data"[\s\S]*?<\/script>/,
      "",
    )
    .replace(
      /\s*<link id="hero-image-preload"[\s\S]*?\/>/,
      `\n    ${buildHeroPreloadTag(group)}`,
    );

  html = replaceTagContent(html, 'name="description"', group.seoDescription);
  html = replaceTagContent(html, 'property="og:title"', group.seoTitle);
  html = replaceTagContent(
    html,
    'property="og:description"',
    group.seoDescription,
  );
  html = replaceTagContent(html, 'property="og:url"', pageUrl);
  html = replaceTagContent(html, 'name="twitter:title"', group.seoTitle);
  html = replaceTagContent(
    html,
    'name="twitter:description"',
    group.seoDescription,
  );

  html = html.replace(
    /<div id="root"[\s\S]*?<\/div>/,
    `<div id="root" data-initial-category="${group.id}">${renderedAppHtml}</div>`,
  );

  const initialDataScript = `\n    <script id="initial-page-data" type="application/json">${JSON.stringify(dataPayload)}</script>`;
  html = html.replace(
    "</body>",
    `${menuDataScript}${initialDataScript}\n  </body>`,
  );

  return html.replace(
    "</head>",
    `${buildBreadcrumbJsonLd(group)}\n  </head>`,
  );
}

function buildSubcategoryHtml(baseHtml, group, sub, renderedAppHtml, dataPayload) {
  const pageUrl = `${SITE_URL}/${group.id}/${sub.id}/`;
  const seoTitle = `قیمت ${sub.label} امروز | بنیان فولاد داریا`;
  const seoDescription = `قیمت روز ${sub.label} از کارخانه‌های معتبر کشور. استعلام قیمت، مشخصات فنی و درخواست پیش‌فاکتور ${sub.label} با مشاوره تلفنی بنیان فولاد داریا.`;

  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${seoTitle}</title>`)
    .replace(
      /(<link rel="canonical" href=")[^"]*(")/,
      `$1${pageUrl}$2`,
    )
    .replace(
      /\s*<script id="organization-structured-data"[\s\S]*?<\/script>/,
      "",
    )
    .replace(
      /\s*<script id="initial-overview-data"[\s\S]*?<\/script>/,
      "",
    )
    .replace(
      /\s*<link id="hero-image-preload"[\s\S]*?\/>/,
      `\n    ${buildHeroPreloadTag(group)}`,
    );

  html = replaceTagContent(html, 'name="description"', seoDescription);
  html = replaceTagContent(html, 'property="og:title"', seoTitle);
  html = replaceTagContent(
    html,
    'property="og:description"',
    seoDescription,
  );
  html = replaceTagContent(html, 'property="og:url"', pageUrl);
  html = replaceTagContent(html, 'name="twitter:title"', seoTitle);
  html = replaceTagContent(
    html,
    'name="twitter:description"',
    seoDescription,
  );

  html = html.replace(
    /<div id="root"[\s\S]*?<\/div>/,
    `<div id="root" data-initial-category="${group.id}" data-initial-subcategory="${sub.id}" data-initial-subcategory-label="${sub.label}">${renderedAppHtml}</div>`,
  );

  const initialDataScript = `\n    <script id="initial-page-data" type="application/json">${JSON.stringify(dataPayload)}</script>`;
  html = html.replace(
    "</body>",
    `${menuDataScript}${initialDataScript}\n  </body>`,
  );

  return html.replace(
    "</head>",
    `${buildSubcategoryBreadcrumbJsonLd(group, sub)}\n  </head>`,
  );
}

async function updateSitemapWithCategories(freshnessMap, latestRootDate, subcategoryMap) {
  const sitemapPath = resolve(distDir, "sitemap.xml");
  const sitemap = await readFile(sitemapPath, "utf8");

  // Update root URL lastmod with latest price data date and clean priority/changefreq
  let updatedSitemap = sitemap.replace(
    /<url>\s*<loc>https:\/\/fouladbonyan\.com\/<\/loc>[\s\S]*?<\/url>/,
    `  <url>\n    <loc>${SITE_URL}/</loc>\n    <lastmod>${latestRootDate}</lastmod>\n  </url>`,
  );

  const categoryEntries = productGroups
    .map((group) => {
      const lastmod = freshnessMap.get(group.id) || latestRootDate;
      return `  <url>\n    <loc>${SITE_URL}/${group.id}/</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    });

  const subcategoryEntries = [];
  for (const group of productGroups) {
    const lastmod = freshnessMap.get(group.id) || latestRootDate;
    const subs = subcategoryMap.get(group.id) || [];
    for (const sub of subs) {
      subcategoryEntries.push(`  <url>\n    <loc>${SITE_URL}/${group.id}/${sub.id}/</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`);
    }
  }

  const allEntries = [...categoryEntries, ...subcategoryEntries].join("\n");
  updatedSitemap = updatedSitemap.replace("</urlset>", `${allEntries}\n</urlset>`);

  await writeFile(sitemapPath, updatedSitemap, "utf8");
}

const [baseHtml, priceData] = await Promise.all([
  readFile(resolve(distDir, "index.html"), "utf8"),
  loadPriceData(),
]);

const { rebar: rebarData, beam: beamData, products: productData, dates: freshnessDates, latestDate } = priceData;

// Preload caches for SSR prerendering
loadRebarPriceData.setCached(rebarData);
loadBeamPriceData.setCached(beamData);
loadProductPricePayload.setCached(productData);

/*
 * The mega menu renders from this small payload rather than from the price
 * snapshots, and every page that renders <App /> embeds it. Without it the menu
 * would be populated during prerender (caches primed above) but "loading" in
 * the browser on any route that does not ship the rebar snapshot -- a
 * guaranteed hydration mismatch. Build it once, before anything is rendered.
 */
const menuCatalog = await buildMenuCatalog();
setMenuCatalog(menuCatalog);
const menuDataScript = `\n    <script id="initial-menu-data" type="application/json">${JSON.stringify(menuCatalog)}</script>`;

// 1. Prerender the homepage (dist/index.html)
const overviewSummaries = computeOverviewSummaries(rebarData, beamData, productData);
loadOverviewSummaries.setCached(overviewSummaries);
const homeRenderedHtml = renderToString(React.createElement(App));


let homeHtml = baseHtml.replace(
  '<div id="root"></div>',
  `<div id="root">${homeRenderedHtml}</div>`,
);
const overviewDataScript = `\n    <script id="initial-overview-data" type="application/json">${JSON.stringify(overviewSummaries)}</script>`;
homeHtml = homeHtml.replace(
  "</body>",
  `${menuDataScript}${overviewDataScript}\n  </body>`,
);
await writeFile(resolve(distDir, "index.html"), homeHtml, "utf8");

// 2. Prerender all category landing pages and subcategory pages
const subcategoryMap = new Map();
let totalSubcategoriesCount = 0;

await Promise.all(
  productGroups.map(async (group) => {
    let dataPayload;
    let subcategories;


    if (group.id === "rebar") {
      loadRebarPriceData.setCached(rebarData);
      dataPayload = { type: "rebar", data: rebarData };
      subcategories = rebarData.categories;
    } else if (group.id === "beam") {
      loadBeamPriceData.setCached(beamData);
      dataPayload = { type: "beam", data: beamData };
      subcategories = beamData.categories;
    } else {
      loadProductPricePayload.setCached(productData);
      dataPayload = { type: "product", data: productData };
      subcategories = productData.catalogs.find((c) => c.id === group.id)?.categories ?? [];
    }

    subcategoryMap.set(group.id, subcategories);
    totalSubcategoriesCount += subcategories.length;

    // Prerender category landing page
    const renderedAppHtml = renderToString(
      React.createElement(App, { initialCategory: group.id }),
    );

    const outDir = resolve(distDir, group.id);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      resolve(outDir, "index.html"),
      buildCategoryHtml(baseHtml, group, renderedAppHtml, dataPayload),
      "utf8",
    );

    // Prerender each subcategory page
    await Promise.all(
      subcategories.map(async (sub) => {
        const renderedSubHtml = renderToString(
          React.createElement(App, {
            initialCategory: group.id,
            initialSubcategory: sub.id,
            initialSubcategoryLabel: sub.label,
          }),
        );

        const subOutDir = resolve(outDir, sub.id);
        await mkdir(subOutDir, { recursive: true });
        await writeFile(
          resolve(subOutDir, "index.html"),
          buildSubcategoryHtml(baseHtml, group, sub, renderedSubHtml, dataPayload),
          "utf8",
        );
      }),
    );
  }),
);

await updateSitemapWithCategories(freshnessDates, latestDate, subcategoryMap);

console.log(
  `تولید و پیش‌رندر ${productGroups.length} صفحه‌ی فرود دسته‌بندی، ${totalSubcategoriesCount} صفحه‌ی زیردسته، صفحه اصلی و بروزرسانی sitemap با موفقیت انجام شد.`,
);
