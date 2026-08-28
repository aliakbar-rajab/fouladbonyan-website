import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import App from "../../app/App.tsx";
import { productGroups } from "../../app/category-meta.ts";
import ContactPage from "../../app/ContactPage.tsx";
import {
  GUIDE_BASE_PATH,
  guideIndex,
  guidePageDefinitions,
  guidePageKeys,
} from "../../app/guide-page-data.ts";
import GuidePage from "../../app/GuidePage.tsx";
import InfoPage from "../../app/InfoPage.tsx";
import { infoPageDefinitions } from "../../app/info-page-data.ts";
import {
  buildOrganizationStructuredData,
  siteConfig,
} from "../../app/site-config.ts";
import { buildGuideReference } from "../../app/steel-reference.ts";
import {
  buildMenuCatalog,
  loadGroupCatalog,
  loadOverviewSummaries,
  primeCatalogSnapshot,
  setMenuCatalog,
} from "../../app/catalog-reader.ts";

/**
 * Prerender Pipeline for Bonyan Foulad Daria.
 *
 * Deep module that owns:
 *   1. Domain preparation and data caching for SSG
 *   2. Compiling 68 declarative static page descriptors
 *   3. Transforming the pristine template HTML shell
 *   4. Atomic artifact output writing (HTML + sitemap.xml)
 */

export function buildHeroPreloadTag(group) {
  const heroImg = group.heroImage ?? group.image;
  if (heroImg.includes("hero-")) {
    const base = heroImg
      .replace(/-1680\.(jpg|webp|avif)$/, "")
      .replace(/\.(jpg|webp|avif)$/, "");
    return `<link
      id="hero-image-preload"
      rel="preload"
      as="image"
      type="image/avif"
      href="${base}-1680.avif"
      imagesrcset="${base}-640.avif 640w, ${base}-960.avif 960w, ${base}-1280.avif 1280w, ${base}-1680.avif 1672w"
      imagesizes="100vw"
      fetchpriority="high"
    />`;
  }
  const base = heroImg.replace(/\.(jpg|webp|avif)$/, "");
  return `<link
      id="hero-image-preload"
      rel="preload"
      as="image"
      type="image/avif"
      href="${base}.avif"
      imagesrcset="${base}-240.avif 240w, ${base}-384.avif 384w"
      imagesizes="100vw"
      fetchpriority="high"
    />`;
}

export function buildBreadcrumbJsonLd(items) {
  if (!items || !items.length) return "";
  const payload = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return `\n    <script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

const replaceMetaContent = (html, attrMatcher, value) =>
  html.replace(
    new RegExp(`(<meta[^>]*?${attrMatcher}[^>]*?content=")[^"]*(")`),
    `$1${value}$2`,
  );

export function replaceSocialMeta(html, { title, description, pageUrl }) {
  let next = replaceMetaContent(html, 'name="description"', description);
  next = replaceMetaContent(next, 'property="og:title"', title);
  next = replaceMetaContent(next, 'property="og:description"', description);
  next = replaceMetaContent(next, 'property="og:url"', pageUrl);
  next = replaceMetaContent(next, 'name="twitter:title"', title);
  return replaceMetaContent(next, 'name="twitter:description"', description);
}

/**
 * Pure transformation of the base HTML shell.
 */
export function renderStaticDocument(
  baseHtml,
  {
    title,
    description,
    pageUrl,
    rootElement,
    rootAttributes = "",
    heroPreload,
    payloads = [],
    breadcrumb = [],
    organizationData = null,
  },
) {
  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${pageUrl}$2`);

  // Organization JSON-LD: inject structured data or strip placeholder
  if (organizationData) {
    const orgJson = JSON.stringify(organizationData);
    html = html.replace(
      /(<script id="organization-structured-data" type="application\/ld\+json">)[\s\S]*?(<\/script>)/,
      `$1${orgJson}$2`,
    );
  } else {
    html = html.replace(
      /\s*<script id="organization-structured-data"[\s\S]*?<\/script>/,
      "",
    );
  }

  // Hero preload handling
  if (heroPreload !== undefined) {
    html = html.replace(
      /\s*<link\s+id="hero-image-preload"[\s\S]*?\/>/,
      heroPreload ? `\n    ${heroPreload}` : "",
    );
  }

  html = replaceSocialMeta(html, { title, description, pageUrl });

  // Render React markup inside #root
  const rootHtml = renderToString(rootElement);
  html = html.replace(
    /<div id="root"[\s\S]*<\/div>/,
    `<div id="root"${rootAttributes}>${rootHtml}</div>`,
  );

  // Append hydration payloads before </body>
  if (payloads.length > 0) {
    const scripts = payloads
      .map(
        ({ id, data }) =>
          `\n    <script id="${id}" type="application/json">${JSON.stringify(data)}</script>`,
      )
      .join("");
    html = html.replace("</body>", `${scripts}\n  </body>`);
  }

  // Inject Breadcrumb JSON-LD before </head>
  if (breadcrumb.length > 0) {
    html = html.replace(
      "</head>",
      `${buildBreadcrumbJsonLd(breadcrumb)}\n  </head>`,
    );
  }

  return html;
}

/**
 * Pure generator for validated sitemap XML containing all site routes.
 */
export function buildSitemapXml({ siteUrl, rootLastmod, pages }) {
  const rootEntry = `  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${rootLastmod}</lastmod>\n  </url>`;
  const pageEntries = pages
    .filter((page) => page.pageUrl !== `${siteUrl}/`)
    .map(
      ({ pageUrl, lastmod }) =>
        `  <url>\n    <loc>${pageUrl}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
    );

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    rootEntry,
    ...pageEntries,
  ].join("\n")}\n</urlset>\n`;
}

/**
 * Compiles all 68 declarative page descriptors for the static site.
 */
export async function collectSitePageDescriptors({
  snapshot,
  menuCatalog,
  overviewSummaries,
  reference,
  siteUrl = siteConfig.siteUrl,
}) {
  const rootLastmod = snapshot.fetchedAt.slice(0, 10);
  const organizationData = buildOrganizationStructuredData();
  const homeCrumb = { name: "صفحه اصلی", url: `${siteUrl}/` };
  const menuPayload = { id: "initial-menu-data", data: menuCatalog };

  const pages = [];

  // 1. Homepage
  pages.push({
    outPath: [],
    pageUrl: `${siteUrl}/`,
    lastmod: rootLastmod,
    title: "قیمت روز آهن و فولاد | بنیان فولاد داریا",
    description:
      "قیمت روز آهن و فولاد، میلگرد، تیرآهن، ورق، پروفیل و انواع مقاطع فولادی در بازار. استعلام لحظه‌ای و صدور پیش‌فاکتور در بنیان فولاد داریا.",
    rootElement: React.createElement(App),
    rootAttributes: "",
    heroPreload: undefined, // Preserves template default hero preload
    payloads: [
      menuPayload,
      { id: "initial-overview-data", data: overviewSummaries },
    ],
    organizationData,
    breadcrumb: [],
  });

  // 2. Category Landing Pages & Subcategories
  for (const group of productGroups) {
    const catalog = await loadGroupCatalog(group.id);
    const lastmod = catalog.fetchedAt.slice(0, 10);
    const heroPreload = buildHeroPreloadTag(group);
    const groupUrl = `${siteUrl}/${group.id}/`;
    const groupCrumb = { name: group.label, url: groupUrl };
    const catalogPayloads = [
      menuPayload,
      { id: "initial-page-data", data: snapshot },
    ];

    // Category landing page
    pages.push({
      outPath: [group.id],
      pageUrl: groupUrl,
      lastmod,
      title: group.seoTitle,
      description: group.seoDescription,
      rootElement: React.createElement(App, { initialCategory: group.id }),
      rootAttributes: ` data-initial-category="${group.id}"`,
      heroPreload,
      payloads: catalogPayloads,
      organizationData: null,
      breadcrumb: [homeCrumb, groupCrumb],
    });

    // Subcategory pages
    for (const sub of catalog.categories) {
      const subUrl = `${groupUrl}${sub.id}/`;
      pages.push({
        outPath: [group.id, sub.id],
        pageUrl: subUrl,
        lastmod,
        title: `قیمت ${sub.label} امروز | بنیان فولاد داریا`,
        description: `قیمت روز ${sub.label} از کارخانه‌های معتبر کشور. استعلام قیمت، مشخصات فنی و درخواست پیش‌فاکتور ${sub.label} با مشاوره تلفنی بنیان فولاد داریا.`,
        rootElement: React.createElement(App, {
          initialCategory: group.id,
          initialSubcategory: sub.id,
          initialSubcategoryLabel: sub.label,
        }),
        rootAttributes: ` data-initial-category="${group.id}" data-initial-subcategory="${sub.id}" data-initial-subcategory-label="${sub.label}"`,
        heroPreload,
        payloads: catalogPayloads,
        organizationData: null,
        breadcrumb: [homeCrumb, groupCrumb, { name: sub.label, url: subUrl }],
      });
    }
  }

  // 3. Contact Page
  const contactUrl = `${siteUrl}/contact/`;
  pages.push({
    outPath: ["contact"],
    pageUrl: contactUrl,
    lastmod: "2026-08-11",
    title: "تماس با ما و نشانی | بنیان فولاد داریا",
    description:
      "شماره‌های تماس، نشانی دفتر و مسیریابی روی نقشه برای بنیان فولاد داریا. تماس با واحد فروش و مدیریت برای استعلام قیمت آهن و فولاد.",
    rootElement: React.createElement(ContactPage),
    rootAttributes: ' data-page="contact"',
    heroPreload: null,
    payloads: [],
    organizationData: null,
    breadcrumb: [homeCrumb, { name: "تماس با ما", url: contactUrl }],
  });

  // 4. Info Pages
  for (const [slug, definition] of Object.entries(infoPageDefinitions)) {
    const pageUrl = `${siteUrl}/${slug}/`;
    pages.push({
      outPath: [slug],
      pageUrl,
      lastmod: definition.lastmod,
      title: `${definition.title} | ${siteConfig.brand.name}`,
      description: definition.seoDescription,
      rootElement: React.createElement(InfoPage, { page: slug }),
      rootAttributes: ` data-page="${slug}"`,
      heroPreload: null,
      payloads: [],
      organizationData: slug === "about" ? organizationData : null,
      breadcrumb: [homeCrumb, { name: definition.title, url: pageUrl }],
    });
  }

  // 5. Guide Index & Articles
  const guideIndexUrl = `${siteUrl}${GUIDE_BASE_PATH}`;
  const guideIndexCrumb = { name: guideIndex.title, url: guideIndexUrl };
  const guidePayloads = [{ id: "initial-guide-data", data: reference }];

  pages.push({
    outPath: ["guide"],
    pageUrl: guideIndexUrl,
    lastmod: guideIndex.lastmod,
    title: guideIndex.seoTitle,
    description: guideIndex.seoDescription,
    rootElement: React.createElement(GuidePage, {
      guide: undefined,
      reference,
    }),
    rootAttributes: ' data-page="guide"',
    heroPreload: null,
    payloads: guidePayloads,
    organizationData: null,
    breadcrumb: [homeCrumb, guideIndexCrumb],
  });

  for (const key of guidePageKeys) {
    const definition = guidePageDefinitions[key];
    const pageUrl = `${guideIndexUrl}${key}/`;
    pages.push({
      outPath: ["guide", key],
      pageUrl,
      lastmod: definition.lastmod,
      title: definition.seoTitle,
      description: definition.seoDescription,
      rootElement: React.createElement(GuidePage, { guide: key, reference }),
      rootAttributes: ` data-page="guide" data-guide="${key}"`,
      heroPreload: null,
      payloads: guidePayloads,
      organizationData: null,
      breadcrumb: [
        homeCrumb,
        guideIndexCrumb,
        { name: definition.title, url: pageUrl },
      ],
    });
  }

  return { pages, rootLastmod, siteUrl };
}

/**
 * Atomic output writer. Renders all pages in memory first before writing to disk.
 */
export async function writePrerenderArtifacts({
  distDir,
  templateHtml,
  pages,
  rootLastmod,
  siteUrl,
}) {
  // 1. Render all HTML documents in memory
  const renderedOutputs = pages.map((page) => ({
    outPath: page.outPath,
    html: renderStaticDocument(templateHtml, page),
  }));

  // 2. Generate sitemap XML in memory
  const sitemapXml = buildSitemapXml({ siteUrl, rootLastmod, pages });

  // 3. Write all HTML files to dist
  await Promise.all(
    renderedOutputs.map(async ({ outPath, html }) => {
      const outDir = resolve(distDir, ...outPath);
      await mkdir(outDir, { recursive: true });
      await writeFile(resolve(outDir, "index.html"), html, "utf8");
    }),
  );

  // 4. Write sitemap.xml
  await writeFile(resolve(distDir, "sitemap.xml"), sitemapXml, "utf8");

  return {
    pageCount: pages.length,
    sitemapCount: pages.length,
  };
}

/**
 * Main entry point for static site generation.
 */
export async function generateStaticSite({
  distDir = resolve(import.meta.dirname, "..", "..", "dist"),
  dataDir = resolve(import.meta.dirname, "..", "..", "app", "data"),
  siteUrl = siteConfig.siteUrl,
} = {}) {
  const [templateHtml, snapshotRaw] = await Promise.all([
    readFile(resolve(distDir, "index.html"), "utf8"),
    readFile(resolve(dataDir, "catalog-prices.json"), "utf8"),
  ]);

  const snapshot = JSON.parse(snapshotRaw);

  // Prime catalog cache
  primeCatalogSnapshot(snapshot);

  // Build shared projections
  const [menuCatalog, overviewSummaries] = await Promise.all([
    buildMenuCatalog(),
    loadOverviewSummaries(),
  ]);
  setMenuCatalog(menuCatalog);

  const reference = buildGuideReference(snapshot);

  // Collect page descriptors
  const { pages, rootLastmod } = await collectSitePageDescriptors({
    snapshot,
    menuCatalog,
    overviewSummaries,
    reference,
    siteUrl,
  });

  // Write rendered artifacts atomically
  const result = await writePrerenderArtifacts({
    distDir,
    templateHtml,
    pages,
    rootLastmod,
    siteUrl,
  });

  return result;
}
