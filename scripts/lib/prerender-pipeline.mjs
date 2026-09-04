import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import App from "../../app/App.tsx";
import { productGroups } from "../../app/category-meta.ts";
import ContactPage from "../../app/ContactPage.tsx";
import {
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
import {
  siteRouteDataset,
  siteRoutePath,
} from "../../app/site-route.ts";

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

/*
 * Titles, descriptions, dataset values and JSON payloads on these pages are
 * built from category and product labels that come off fooladiranian.com. They
 * are spliced into a finished HTML document as text, so they are escaped for
 * the position they land in rather than trusted: one `"` in a scraped label
 * would otherwise end a meta attribute early, and one `</script` would end a
 * payload element early.
 *
 * Every splice below also uses a *function* replacer. `String.replace` reads
 * `$&`, `$'` and `` $` `` out of a replacement *string*, which would quietly
 * corrupt any payload that happened to contain them; a function's return value
 * is inserted verbatim.
 */
const escapeHtmlText = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeHtmlAttribute = (value) =>
  escapeHtmlText(value).replace(/"/g, "&quot;");

/** JSON bound for a <script> element: `<` cannot start a tag inside it. */
const jsonForScript = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

const insert = (value) => () => value;

const datasetAttributeName = (key) =>
  `data-${key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;

export function buildRouteRootAttributes(route) {
  return Object.entries(siteRouteDataset(route))
    .map(
      ([key, value]) =>
        ` ${datasetAttributeName(key)}="${escapeHtmlAttribute(value)}"`,
    )
    .join("");
}

function routeLocation(route, siteUrl) {
  const pathname = siteRoutePath(route);
  return {
    outPath: pathname === "/" ? [] : pathname.split("/").filter(Boolean),
    pageUrl: `${siteUrl}${pathname}`,
    rootAttributes: buildRouteRootAttributes(route),
  };
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
  return `\n    <script type="application/ld+json">${jsonForScript(payload)}</script>`;
}

export function buildWebSiteJsonLd({ siteUrl }) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: `${siteUrl}/`,
    name: siteConfig.brand.name,
    alternateName: siteConfig.brand.alternateName,
    description: siteConfig.brand.tagline,
    publisher: {
      "@id": `${siteUrl}/#organization`,
    },
  };
  return `\n    <script type="application/ld+json">${jsonForScript(payload)}</script>`;
}

export function buildArticleJsonLd({
  headline,
  description,
  pageUrl,
  lastmod,
  siteUrl,
  image,
}) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    headline,
    description,
    ...(image ? { image: [image] } : {}),
    inLanguage: "fa",
    dateModified: lastmod,
    author: {
      "@type": "Organization",
      name: siteConfig.brand.name,
      url: `${siteUrl}/`,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.brand.name,
      url: `${siteUrl}/`,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/brand/bonyan-foulad-daria-logo.webp`,
      },
    },
  };
  return `\n    <script type="application/ld+json">${jsonForScript(payload)}</script>`;
}

export const buildTechArticleJsonLd = buildArticleJsonLd;

const replaceMetaContent = (html, attrMatcher, value) =>
  html.replace(
    new RegExp(`(<meta[^>]*?${attrMatcher}[^>]*?content=")[^"]*(")`),
    (match, prefix, suffix) => `${prefix}${escapeHtmlAttribute(value)}${suffix}`,
  );

export function replaceSocialMeta(
  html,
  { title, description, pageUrl, ogImage, ogImageAlt },
) {
  let next = replaceMetaContent(html, 'name="description"', description);
  next = replaceMetaContent(next, 'property="og:title"', title);
  next = replaceMetaContent(next, 'property="og:description"', description);
  next = replaceMetaContent(next, 'property="og:url"', pageUrl);
  next = replaceMetaContent(next, 'name="twitter:title"', title);
  next = replaceMetaContent(next, 'name="twitter:description"', description);
  if (ogImage) {
    next = replaceMetaContent(next, 'property="og:image"', ogImage);
    next = replaceMetaContent(next, 'name="twitter:image"', ogImage);
    if (ogImageAlt) {
      next = replaceMetaContent(next, 'property="og:image:alt"', ogImageAlt);
    }
  }
  return next;
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
    ogImage,
    ogImageAlt,
    extraHeadHtml = "",
    rootElement,
    rootAttributes = "",
    heroPreload,
    payloads = [],
    breadcrumb = [],
    organizationData = null,
  },
) {
  let html = baseHtml
    .replace(
      /<title>[^<]*<\/title>/,
      insert(`<title>${escapeHtmlText(title)}</title>`),
    )
    .replace(
      /(<link rel="canonical" href=")[^"]*(")/,
      (match, prefix, suffix) =>
        `${prefix}${escapeHtmlAttribute(pageUrl)}${suffix}`,
    );

  // Organization JSON-LD: inject structured data or strip placeholder
  if (organizationData) {
    const orgJson = jsonForScript(organizationData);
    html = html.replace(
      /(<script id="organization-structured-data" type="application\/ld\+json">)[\s\S]*?(<\/script>)/,
      (match, open, close) => `${open}${orgJson}${close}`,
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
      insert(heroPreload ? `\n    ${heroPreload}` : ""),
    );
  }

  html = replaceSocialMeta(html, {
    title,
    description,
    pageUrl,
    ogImage,
    ogImageAlt,
  });

  // Render React markup inside #root
  const rootHtml = renderToString(rootElement);
  html = html.replace(
    /<div id="root"[\s\S]*<\/div>/,
    insert(`<div id="root"${rootAttributes}>${rootHtml}</div>`),
  );

  // Append hydration payloads before </body>
  if (payloads.length > 0) {
    const scripts = payloads
      .map(
        ({ id, data }) =>
          `\n    <script id="${id}" type="application/json">${jsonForScript(data)}</script>`,
      )
      .join("");
    html = html.replace("</body>", insert(`${scripts}\n  </body>`));
  }

  // Inject Breadcrumb JSON-LD before </head>
  if (breadcrumb.length > 0) {
    html = html.replace(
      "</head>",
      insert(`${buildBreadcrumbJsonLd(breadcrumb)}\n  </head>`),
    );
  }

  // Inject extra head elements (e.g. WebSite or TechArticle JSON-LD) before </head>
  if (extraHeadHtml) {
    html = html.replace("</head>", insert(`${extraHeadHtml}\n  </head>`));
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
  const homeLocation = routeLocation({ kind: "home" }, siteUrl);
  pages.push({
    ...homeLocation,
    lastmod: rootLastmod,
    title: "قیمت روز آهن و فولاد | بنیان فولاد داریا",
    description:
      "قیمت روز آهن و فولاد، میلگرد، تیرآهن، ورق، پروفیل و انواع مقاطع فولادی در بازار. استعلام لحظه‌ای و صدور پیش‌فاکتور در بنیان فولاد داریا.",
    rootElement: React.createElement(App),
    heroPreload: undefined, // Preserves template default hero preload
    payloads: [
      menuPayload,
      { id: "initial-overview-data", data: overviewSummaries },
    ],
    organizationData,
    extraHeadHtml: buildWebSiteJsonLd({ siteUrl }),
    breadcrumb: [],
  });

  // 2. Category Landing Pages & Subcategories
  for (const group of productGroups) {
    const catalog = await loadGroupCatalog(group.id);
    const lastmod = catalog.fetchedAt.slice(0, 10);
    const heroPreload = buildHeroPreloadTag(group);
    const groupRoute = { kind: "catalog", category: group.id };
    const groupLocation = routeLocation(groupRoute, siteUrl);
    const groupUrl = groupLocation.pageUrl;
    const groupCrumb = { name: group.label, url: groupUrl };

    // Scoped hydration payload: contains only the current group's catalog
    // instead of injecting the entire multi-category snapshot
    const groupSnapshot = {
      fetchedAt: snapshot.fetchedAt,
      sourceName: snapshot.sourceName,
      sourceHome: snapshot.sourceHome,
      taxRate: snapshot.taxRate,
      catalogs: [catalog],
    };
    const catalogPayloads = [
      menuPayload,
      { id: "initial-page-data", data: groupSnapshot },
    ];
    const groupOgImage = `${siteUrl}/categories/hero-${group.id}-1280.jpg`;
    const groupOgImageAlt = `قیمت ${group.label} | بنیان فولاد داریا`;

    const isSingleCategoryGroup = group.id === "angle" || group.id === "channel";

    // Category landing page
    pages.push({
      ...groupLocation,
      lastmod,
      title: group.seoTitle,
      description: group.seoDescription,
      ogImage: groupOgImage,
      ogImageAlt: groupOgImageAlt,
      rootElement: React.createElement(App, {
        initialCategory: group.id,
        initialSubcategory: isSingleCategoryGroup ? group.id : undefined,
      }),
      heroPreload,
      payloads: catalogPayloads,
      organizationData: null,
      breadcrumb: [homeCrumb, groupCrumb],
    });

    // Subcategory pages: single-subcategory families (angle, channel)
    // are consolidated onto their parent category page.
    if (!isSingleCategoryGroup) {
      for (const sub of catalog.categories) {
        const subRoute = {
          kind: "catalog",
          category: group.id,
          subcategory: sub.id,
          subcategoryLabel: sub.label,
        };
        const subLocation = routeLocation(subRoute, siteUrl);
        const subUrl = subLocation.pageUrl;
        pages.push({
          ...subLocation,
          lastmod,
          title: `قیمت ${sub.label} امروز | بنیان فولاد داریا`,
          description: `قیمت روز ${sub.label} از کارخانه‌های معتبر کشور. استعلام قیمت، مشخصات فنی و درخواست پیش‌فاکتور ${sub.label} با مشاوره تلفنی بنیان فولاد داریا.`,
          ogImage: groupOgImage,
          ogImageAlt: `قیمت روز ${sub.label} | بنیان فولاد داریا`,
          rootElement: React.createElement(App, {
            initialCategory: group.id,
            initialSubcategory: sub.id,
            initialSubcategoryLabel: sub.label,
          }),
          heroPreload,
          payloads: catalogPayloads,
          organizationData: null,
          breadcrumb: [homeCrumb, groupCrumb, { name: sub.label, url: subUrl }],
        });
      }
    }
  }

  // 3. Contact Page
  const contactLocation = routeLocation({ kind: "contact" }, siteUrl);
  const contactUrl = contactLocation.pageUrl;
  pages.push({
    ...contactLocation,
    lastmod: "2026-08-11",
    title: "تماس با ما و نشانی | بنیان فولاد داریا",
    description:
      "شماره‌های تماس، نشانی دفتر و مسیریابی روی نقشه برای بنیان فولاد داریا. تماس با واحد فروش و مدیریت برای استعلام قیمت آهن و فولاد.",
    rootElement: React.createElement(ContactPage),
    heroPreload: null,
    payloads: [],
    organizationData: null,
    breadcrumb: [homeCrumb, { name: "تماس با ما", url: contactUrl }],
  });

  // 4. Info Pages
  for (const [slug, definition] of Object.entries(infoPageDefinitions)) {
    const infoLocation = routeLocation({ kind: "info", page: slug }, siteUrl);
    const pageUrl = infoLocation.pageUrl;
    pages.push({
      ...infoLocation,
      lastmod: definition.lastmod,
      title: `${definition.title} | ${siteConfig.brand.name}`,
      description: definition.seoDescription,
      rootElement: React.createElement(InfoPage, { page: slug }),
      heroPreload: null,
      payloads: [],
      organizationData: slug === "about" ? organizationData : null,
      breadcrumb: [homeCrumb, { name: definition.title, url: pageUrl }],
    });
  }

  // 5. Guide Index & Articles
  const guideIndexLocation = routeLocation({ kind: "guide" }, siteUrl);
  const guideIndexUrl = guideIndexLocation.pageUrl;
  const guideIndexCrumb = { name: guideIndex.title, url: guideIndexUrl };
  const guidePayloads = [{ id: "initial-guide-data", data: reference }];

  pages.push({
    ...guideIndexLocation,
    lastmod: guideIndex.lastmod,
    title: guideIndex.seoTitle,
    description: guideIndex.seoDescription,
    rootElement: React.createElement(GuidePage, {
      guide: undefined,
      reference,
    }),
    heroPreload: null,
    payloads: guidePayloads,
    organizationData: null,
    breadcrumb: [homeCrumb, guideIndexCrumb],
  });

  const guideImages = {
    "rebar-weight-chart": `${siteUrl}/categories/hero-rebar-1280.jpg`,
    "ribbed-vs-plain-rebar": `${siteUrl}/categories/hero-rebar-1280.jpg`,
    "beam-weight-chart": `${siteUrl}/categories/hero-beam-1280.jpg`,
    "ipe-vs-hash-beam": `${siteUrl}/categories/hero-beam-1280.jpg`,
    "units-and-quote-specs": `${siteUrl}/brand/bonyan-foulad-daria-logo.webp`,
  };

  for (const key of guidePageKeys) {
    const definition = guidePageDefinitions[key];
    const guideLocation = routeLocation({ kind: "guide", guide: key }, siteUrl);
    const pageUrl = guideLocation.pageUrl;
    pages.push({
      ...guideLocation,
      lastmod: definition.lastmod,
      title: definition.seoTitle,
      description: definition.seoDescription,
      rootElement: React.createElement(GuidePage, { guide: key, reference }),
      heroPreload: null,
      payloads: guidePayloads,
      organizationData: null,
      extraHeadHtml: buildArticleJsonLd({
        headline: definition.title,
        description: definition.seoDescription,
        pageUrl,
        lastmod: definition.lastmod,
        siteUrl,
        image: guideImages[key],
      }),
      breadcrumb: [
        homeCrumb,
        guideIndexCrumb,
        { name: definition.title, url: pageUrl },
      ],
    });
  }

  return { pages, rootLastmod, siteUrl };
}

export const REDIRECT_ROUTES = [
  {
    fromPath: ["angle", "angle"],
    toUrl: "https://fouladbonyan.com/angle/",
    targetLabel: "نبشی",
  },
  {
    fromPath: ["channel", "channel"],
    toUrl: "https://fouladbonyan.com/channel/",
    targetLabel: "ناودانی",
  },
];

export function buildRedirectHtml({ toUrl, targetLabel }) {
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url=${toUrl}" />
    <link rel="canonical" href="${toUrl}" />
    <meta name="robots" content="noindex, follow" />
    <title>انتقال به قیمت ${targetLabel} | بنیان فولاد داریا</title>
    <script>location.replace("${toUrl}");</script>
  </head>
  <body>
    <p>در حال انتقال به <a href="${toUrl}">قیمت ${targetLabel}</a>...</p>
  </body>
</html>\n`;
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

  // 5. Write permanent redirect stubs for single subcategory URLs
  for (const { fromPath, toUrl, targetLabel } of REDIRECT_ROUTES) {
    const outDir = resolve(distDir, ...fromPath);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      resolve(outDir, "index.html"),
      buildRedirectHtml({ toUrl, targetLabel }),
      "utf8",
    );
  }

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
