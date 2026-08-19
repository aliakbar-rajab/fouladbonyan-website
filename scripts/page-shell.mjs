import { readFile, writeFile } from "node:fs/promises";

/*
 * Every generated page is dist/index.html with its shell rewritten. This module
 * owns that rewriting: the generators describe pages, they do not edit HTML.
 */

/** Payload scripts the base document carries for the homepage only. */
const HOMEPAGE_PAYLOAD_IDS = [
  "organization-structured-data",
  "initial-overview-data",
  "initial-menu-data",
];

const replaceMetaContent = (html, attrMatcher, value) =>
  html.replace(
    new RegExp(`(<meta[^>]*?${attrMatcher}[^>]*?content=")[^"]*(")`),
    `$1${value}$2`,
  );

/**
 * Rewrite the six description/OpenGraph/Twitter tags every generated page
 * carries. The order is the order the generators applied them in by hand --
 * `replaceMetaContent` matches the first tag of its shape, so keeping the
 * sequence keeps the output byte-identical.
 */
export const replaceSocialMeta = (html, { title, description, pageUrl }) => {
  let next = replaceMetaContent(html, 'name="description"', description);
  next = replaceMetaContent(next, 'property="og:title"', title);
  next = replaceMetaContent(next, 'property="og:description"', description);
  next = replaceMetaContent(next, 'property="og:url"', pageUrl);
  next = replaceMetaContent(next, 'name="twitter:title"', title);
  return replaceMetaContent(next, 'name="twitter:description"', description);
};

/** `items` is the trail in order, root first: `[{ name, url }, ...]`. */
export const buildBreadcrumbJsonLd = (items) => {
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
};

/**
 * Put a page's prerendered markup inside #root.
 *
 * The match is greedy to the LAST </div> in the document. #root is the last
 * element in the body that contains a div, so that is correct whether the base
 * is the pristine template (an empty #root) or an already-prerendered page (a
 * deep tree of nested divs). A lazy match stops at the first inner closing tag
 * and strands the rest of the previous page's markup in the output.
 */
export const fillRoot = (html, rootHtml, attributes = "") =>
  html.replace(
    /<div id="root"[\s\S]*<\/div>/,
    `<div id="root"${attributes}>${rootHtml}</div>`,
  );

/**
 * Append `[{ id, data }]` payload scripts at the end of the body.
 *
 * index.html deliberately contains no literal closing body tag anywhere before
 * the real one -- not even inside a comment -- because this splices at the
 * first one it finds.
 */
export const appendPayloads = (html, payloads) => {
  if (!payloads.length) return html;
  const scripts = payloads
    .map(
      ({ id, data }) =>
        `\n    <script id="${id}" type="application/json">${JSON.stringify(data)}</script>`,
    )
    .join("");
  return html.replace("</body>", `${scripts}\n  </body>`);
};

/**
 * One generated page.
 *
 * @param {string} baseHtml the shell to rewrite
 * @param {object} page
 * @param {string} page.title            <title> and the social title
 * @param {string} page.description      meta description and social description
 * @param {string} page.pageUrl          canonical URL
 * @param {string} page.rootHtml         prerendered markup for #root
 * @param {string} [page.rootAttributes] extra attributes on #root
 * @param {string[]} [page.keepPayloadIds] homepage payloads this page still needs
 * @param {string|null} [page.heroPreload] replacement preload tag, or null to drop it
 * @param {Array<{id: string, data: unknown}>} [page.payloads] scripts to embed
 * @param {Array<{name: string, url: string}>} [page.breadcrumb] trail, root first
 */
export function renderStaticPage(
  baseHtml,
  {
    title,
    description,
    pageUrl,
    rootHtml,
    rootAttributes = "",
    keepPayloadIds = [],
    heroPreload = null,
    payloads = [],
    breadcrumb = [],
  },
) {
  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${pageUrl}$2`);

  for (const id of HOMEPAGE_PAYLOAD_IDS) {
    if (keepPayloadIds.includes(id)) continue;
    html = html.replace(
      new RegExp(`\\s*<script id="${id}"[\\s\\S]*?<\\/script>`),
      "",
    );
  }

  // The preload tag is pretty-printed across several lines in index.html, so
  // its attribute is not separated from `<link` by a single space -- match
  // whitespace, not " ".
  html = html.replace(
    /\s*<link\s+id="hero-image-preload"[\s\S]*?\/>/,
    heroPreload ? `\n    ${heroPreload}` : "",
  );

  html = replaceSocialMeta(html, { title, description, pageUrl });
  html = fillRoot(html, rootHtml, rootAttributes);
  html = appendPayloads(html, payloads);

  if (!breadcrumb.length) return html;
  return html.replace(
    "</head>",
    `${buildBreadcrumbJsonLd(breadcrumb)}\n  </head>`,
  );
}

/** Point the sitemap's root URL at the freshest price data. */
export const setSitemapRootLastmod = async (sitemapPath, { siteUrl, lastmod }) => {
  const sitemap = await readFile(sitemapPath, "utf8");
  await writeFile(
    sitemapPath,
    sitemap.replace(
      new RegExp(`<url>\\s*<loc>${siteUrl}/</loc>[\\s\\S]*?</url>`),
      `  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
    ),
    "utf8",
  );
};

/**
 * Append any `{ pageUrl, lastmod }` the sitemap does not already list. The
 * seed sitemap (public/sitemap.xml) carries only the root URL, so in a real
 * build no generator ever finds all of its entries already present.
 */
export const appendSitemapUrls = async (sitemapPath, entries) => {
  const sitemap = await readFile(sitemapPath, "utf8");

  const additions = entries
    .filter(({ pageUrl }) => !sitemap.includes(`<loc>${pageUrl}</loc>`))
    .map(
      ({ pageUrl, lastmod }) => `  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )
    .join("\n");

  if (!additions) return;

  await writeFile(
    sitemapPath,
    sitemap.replace("</urlset>", `${additions}\n</urlset>`),
    "utf8",
  );
};
