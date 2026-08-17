import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import App from "../app/App.tsx";
import { productGroups } from "../app/category-meta.ts";
import { loadBeamPriceData, loadRebarPriceData } from "../app/catalog-data.ts";
import { loadProductPricePayload } from "../app/product-price-data.ts";
import { loadOverviewSummaries } from "../app/catalog-overview.ts";

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

const replaceTagContent = (html, attrMatcher, value) =>
  html.replace(
    new RegExp(`(<meta[^>]*?${attrMatcher}[^>]*?content=")[^"]*(")`),
    `$1${value}$2`,
  );

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
  html = html.replace("</body>", `${initialDataScript}\n  </body>`);

  return html.replace(
    "</head>",
    `${buildBreadcrumbJsonLd(group)}\n  </head>`,
  );
}

async function updateSitemapWithCategories(freshnessMap, latestRootDate) {
  const sitemapPath = resolve(distDir, "sitemap.xml");
  const sitemap = await readFile(sitemapPath, "utf8");

  // Update root URL lastmod with latest price data date and clean priority/changefreq
  let updatedSitemap = sitemap.replace(
    /<url>\s*<loc>https:\/\/fouladbonyan\.com\/<\/loc>[\s\S]*?<\/url>/,
    `  <url>\n    <loc>${SITE_URL}/</loc>\n    <lastmod>${latestRootDate}</lastmod>\n  </url>`,
  );

  const entries = productGroups
    .map((group) => {
      const lastmod = freshnessMap.get(group.id) || latestRootDate;
      return `  <url>\n    <loc>${SITE_URL}/${group.id}/</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join("\n");

  updatedSitemap = updatedSitemap.replace("</urlset>", `${entries}\n</urlset>`);

  await writeFile(sitemapPath, updatedSitemap, "utf8");
}

const [baseHtml, priceData] = await Promise.all([
  readFile(resolve(distDir, "index.html"), "utf8"),
  loadPriceData(),
]);

const { rebar: rebarData, beam: beamData, products: productData, dates: freshnessDates, latestDate } = priceData;

// 1. Prerender the homepage (dist/index.html)
const overviewSummaries = computeOverviewSummaries(rebarData, beamData, productData);
loadOverviewSummaries.setCached(overviewSummaries);
const homeRenderedHtml = renderToString(React.createElement(App));

let homeHtml = baseHtml.replace(
  '<div id="root"></div>',
  `<div id="root">${homeRenderedHtml}</div>`,
);
const overviewDataScript = `\n    <script id="initial-overview-data" type="application/json">${JSON.stringify(overviewSummaries)}</script>`;
homeHtml = homeHtml.replace("</body>", `${overviewDataScript}\n  </body>`);
await writeFile(resolve(distDir, "index.html"), homeHtml, "utf8");

// 2. Prerender all category landing pages
await Promise.all(
  productGroups.map(async (group) => {
    let dataPayload;
    if (group.id === "rebar") {
      loadRebarPriceData.setCached(rebarData);
      dataPayload = { type: "rebar", data: rebarData };
    } else if (group.id === "beam") {
      loadBeamPriceData.setCached(beamData);
      dataPayload = { type: "beam", data: beamData };
    } else {
      loadProductPricePayload.setCached(productData);
      dataPayload = { type: "product", data: productData };
    }

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
  }),
);

await updateSitemapWithCategories(freshnessDates, latestDate);

console.log(
  `تولید و پیش‌رندر ${productGroups.length} صفحه‌ی فرود دسته‌بندی محصولات، صفحه اصلی و بروزرسانی sitemap با موفقیت انجام شد.`,
);
