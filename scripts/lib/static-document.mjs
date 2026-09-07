import { renderToString } from "react-dom/server";
import {
  productGroups,
  singleSubcategoryGroupIds,
  subcategoryHref,
} from "../../app/category-meta.ts";
import { siteConfig } from "../../app/site-config.ts";
import { siteRouteDataset, siteRoutePath } from "../../app/site-route.ts";

/**
 * How one page descriptor becomes one HTML document.
 *
 * Everything here is about rendering: escaping, the route-to-URL projection,
 * structured data, the social-meta rewrite of the template shell, the sitemap,
 * and the redirect stubs. Nothing here knows which pages the site has -- that
 * is site-pages.mjs -- so every function is pure and directly testable without
 * running a build.
 */

/*
 * The category hero variant used for social previews, with the dimensions that
 * have to be advertised alongside it. scripts/optimize-images.mjs renders every
 * `hero-*-1280` at this size; built-seo.test.mjs reads the real files back and
 * fails if that ever stops being true.
 */
export const HERO_OG_IMAGE = {
  variant: "1280",
  width: 1280,
  height: 720,
};

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

export function routeLocation(route, siteUrl) {
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
  datePublished,
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
    datePublished,
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

const replaceMetaContent = (html, attrMatcher, value) =>
  html.replace(
    new RegExp(`(<meta[^>]*?${attrMatcher}[^>]*?content=")[^"]*(")`),
    (match, prefix, suffix) => `${prefix}${escapeHtmlAttribute(value)}${suffix}`,
  );

/*
 * og:image:width and og:image:height describe the *selected* image, so they
 * have to move with it. The template ships /og.png at 1730x909; swapping only
 * the URL left 52 catalog pages advertising those dimensions for a 1280x720
 * hero, which is why a caller passing ogImage without them is a build error
 * rather than a silent skip. built-seo.test.mjs re-checks the emitted numbers
 * against the real file on disk.
 */
export function replaceSocialMeta(
  html,
  {
    title,
    description,
    pageUrl,
    ogType,
    ogImage,
    ogImageAlt,
    ogImageWidth,
    ogImageHeight,
  },
) {
  let next = replaceMetaContent(html, 'name="description"', description);
  next = replaceMetaContent(next, 'property="og:title"', title);
  next = replaceMetaContent(next, 'property="og:description"', description);
  next = replaceMetaContent(next, 'property="og:url"', pageUrl);
  next = replaceMetaContent(next, 'name="twitter:title"', title);
  next = replaceMetaContent(next, 'name="twitter:description"', description);
  if (ogType) {
    next = replaceMetaContent(next, 'property="og:type"', ogType);
  }
  if (ogImage) {
    if (!ogImageWidth || !ogImageHeight) {
      throw new Error(
        `og:image "${ogImage}" was set without ogImageWidth/ogImageHeight; the template's dimensions describe a different file.`,
      );
    }
    next = replaceMetaContent(next, 'property="og:image"', ogImage);
    next = replaceMetaContent(next, 'name="twitter:image"', ogImage);
    next = replaceMetaContent(
      next,
      'property="og:image:width"',
      String(ogImageWidth),
    );
    next = replaceMetaContent(
      next,
      'property="og:image:height"',
      String(ogImageHeight),
    );
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
    ogType,
    ogImage,
    ogImageAlt,
    ogImageWidth,
    ogImageHeight,
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
    ogType,
    ogImage,
    ogImageAlt,
    ogImageWidth,
    ogImageHeight,
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

  // Inject extra head elements (e.g. WebSite or Article JSON-LD) before </head>
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

/*
 * The noindex stubs standing at the collapsed subcategory URLs. Derived from
 * singleSubcategoryGroupIds rather than written out, so a group that gains or
 * loses its collapse cannot leave a stub behind or go without one. Keep
 * public/_redirects in step -- built-seo.test.mjs asserts the two agree.
 */
export const REDIRECT_ROUTES = singleSubcategoryGroupIds.map((groupId) => ({
  fromPath: [groupId, groupId],
  toUrl: `${siteConfig.siteUrl}${subcategoryHref(groupId)}`,
  targetLabel:
    productGroups.find((group) => group.id === groupId)?.label ?? groupId,
}));

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
