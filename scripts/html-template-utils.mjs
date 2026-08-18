import { readFile, writeFile } from "node:fs/promises";

const replaceTagContent = (html, attrMatcher, value) =>
  html.replace(
    new RegExp(`(<meta[^>]*?${attrMatcher}[^>]*?content=")[^"]*(")`),
    `$1${value}$2`,
  );

/**
 * Rewrite the six description/OpenGraph/Twitter tags every generated page
 * carries. The order is the order the generators applied them in by hand --
 * `replaceTagContent` matches the first tag of its shape, so keeping the
 * sequence keeps the output byte-identical.
 */
export const replaceSocialMeta = (html, { title, description, pageUrl }) => {
  let next = replaceTagContent(html, 'name="description"', description);
  next = replaceTagContent(next, 'property="og:title"', title);
  next = replaceTagContent(next, 'property="og:description"', description);
  next = replaceTagContent(next, 'property="og:url"', pageUrl);
  next = replaceTagContent(next, 'name="twitter:title"', title);
  return replaceTagContent(next, 'name="twitter:description"', description);
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
