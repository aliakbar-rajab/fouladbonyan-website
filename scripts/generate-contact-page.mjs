import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import ContactPage from "../app/ContactPage.tsx";
import InfoPage from "../app/InfoPage.tsx";
import { infoPageDefinitions } from "../app/info-page-data.ts";
import {
  buildOrganizationStructuredData,
  siteConfig,
} from "../app/site-config.ts";
import { replaceTagContent } from "./html-template-utils.mjs";

const SITE_URL = siteConfig.siteUrl;
const PAGE_URL = `${SITE_URL}/contact/`;
const distDir = resolve(import.meta.dirname, "..", "dist");

const TITLE = "تماس با ما و نشانی | بنیان فولاد داریا";
const DESCRIPTION =
  "شماره‌های تماس، نشانی دفتر و مسیریابی روی نقشه برای بنیان فولاد داریا. تماس با واحد فروش و مدیریت برای استعلام قیمت آهن و فولاد.";

function buildBreadcrumbJsonLd(label, pageUrl) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "صفحه اصلی", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: label, item: pageUrl },
    ],
  };
  return `\n    <script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

function buildPageHtml(
  baseHtml,
  { page, title, description, pageUrl, breadcrumbLabel },
  renderedContentHtml,
) {
  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${pageUrl}$2`);

  if (page !== "about") {
    html = html.replace(
      /\s*<script id="organization-structured-data"[\s\S]*?<\/script>/,
      "",
    );
  }

  // Remove homepage payloads inherited from dist/index.html. These pages render
  // ContactPage/InfoPage, neither of which mounts the catalog or the mega menu.
  html = html.replace(
    /\s*<script id="initial-overview-data"[\s\S]*?<\/script>/,
    "",
  );
  html = html.replace(
    /\s*<script id="initial-menu-data"[\s\S]*?<\/script>/,
    "",
  );

  // Remove homepage hero image preload on non-hero info pages. The tag is
  // pretty-printed across several lines in index.html, so the attribute is not
  // separated from `<link` by a single space -- match whitespace, not " ".
  html = html.replace(
    /\s*<link\s+id="hero-image-preload"[\s\S]*?\/>/,
    "",
  );

  html = replaceTagContent(html, 'name="description"', description);
  html = replaceTagContent(html, 'property="og:title"', title);
  html = replaceTagContent(html, 'property="og:description"', description);
  html = replaceTagContent(html, 'property="og:url"', pageUrl);
  html = replaceTagContent(html, 'name="twitter:title"', title);
  html = replaceTagContent(html, 'name="twitter:description"', description);

  /*
   * generate-category-pages.mjs has already rewritten dist/index.html with the
   * prerendered homepage by the time this script reads it, so #root holds a
   * deep tree of nested <div>s. The match has to be greedy to the LAST </div>
   * in the document: a lazy match stops at the first inner closing tag and
   * leaves the rest of the homepage stranded after this page's own content.
   */
  html = html.replace(
    /<div id="root"[\s\S]*<\/div>/,
    `<div id="root" data-page="${page}">${renderedContentHtml}</div>`,
  );

  return html.replace(
    "</head>",
    `${buildBreadcrumbJsonLd(breadcrumbLabel, pageUrl)}\n  </head>`,
  );
}

async function addInformationUrlsToSitemap(pageEntries) {
  const sitemapPath = resolve(distDir, "sitemap.xml");
  const sitemap = await readFile(sitemapPath, "utf8");

  const entries = pageEntries
    .filter(({ pageUrl }) => !sitemap.includes(`<loc>${pageUrl}</loc>`))
    .map(
      ({ pageUrl, lastmod }) => `  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )
    .join("\n");

  await writeFile(
    sitemapPath,
    sitemap.replace("</urlset>", `${entries}\n</urlset>`),
    "utf8",
  );
}

async function injectOrganizationData() {
  const payload = JSON.stringify(buildOrganizationStructuredData());
  const targetFiles = [
    resolve(distDir, "index.html"),
    resolve(distDir, "about", "index.html"),
  ];

  await Promise.all(
    targetFiles.map(async (entryPath) => {
      try {
        const html = await readFile(entryPath, "utf8");
        const updated = html.replace(
          /(<script id="organization-structured-data" type="application\/ld\+json">)[\s\S]*?(<\/script>)/,
          `$1${payload}$2`,
        );
        await writeFile(entryPath, updated, "utf8");
      } catch {
        // File may not exist yet if skipped
      }
    }),
  );
}

const baseHtml = await readFile(resolve(distDir, "index.html"), "utf8");
const pageEntries = [
  {
    page: "contact",
    title: TITLE,
    description: DESCRIPTION,
    pageUrl: PAGE_URL,
    breadcrumbLabel: "تماس با ما",
    lastmod: "2026-08-11",
  },
  ...Object.entries(infoPageDefinitions).map(([page, definition]) => ({
    page,
    title: `${definition.title} | ${siteConfig.brand.name}`,
    description: definition.seoDescription,
    pageUrl: `${SITE_URL}/${page}/`,
    breadcrumbLabel: definition.title,
    lastmod: definition.lastmod,
  })),
];

await Promise.all(
  pageEntries.map(async (pageEntry) => {
    const renderedContentHtml =
      pageEntry.page === "contact"
        ? renderToString(React.createElement(ContactPage))
        : renderToString(React.createElement(InfoPage, { page: pageEntry.page }));

    const outDir = resolve(distDir, pageEntry.page);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      resolve(outDir, "index.html"),
      buildPageHtml(baseHtml, pageEntry, renderedContentHtml),
      "utf8",
    );
  }),
);

await addInformationUrlsToSitemap(pageEntries);
await injectOrganizationData();

console.log(
  `تولید و پیش‌رندر ${pageEntries.length.toLocaleString("fa-IR")} صفحه اطلاعاتی و تماس و بروزرسانی sitemap با موفقیت انجام شد.`,
);
