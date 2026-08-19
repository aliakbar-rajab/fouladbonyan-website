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
import { appendSitemapUrls, renderStaticPage } from "./page-shell.mjs";

const SITE_URL = siteConfig.siteUrl;
const distDir = resolve(import.meta.dirname, "..", "dist");
const homeCrumb = { name: "صفحه اصلی", url: `${SITE_URL}/` };

const CONTACT_TITLE = "تماس با ما و نشانی | بنیان فولاد داریا";
const CONTACT_DESCRIPTION =
  "شماره‌های تماس، نشانی دفتر و مسیریابی روی نقشه برای بنیان فولاد داریا. تماس با واحد فروش و مدیریت برای استعلام قیمت آهن و فولاد.";

/**
 * The organization JSON-LD is written after the pages exist, because it is the
 * one payload the homepage and /about/ share rather than each rewriting.
 */
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

const pages = [
  {
    slug: "contact",
    element: React.createElement(ContactPage),
    title: CONTACT_TITLE,
    description: CONTACT_DESCRIPTION,
    breadcrumbLabel: "تماس با ما",
    lastmod: "2026-08-11",
  },
  ...Object.entries(infoPageDefinitions).map(([slug, definition]) => ({
    slug,
    element: React.createElement(InfoPage, { page: slug }),
    title: `${definition.title} | ${siteConfig.brand.name}`,
    description: definition.seoDescription,
    breadcrumbLabel: definition.title,
    lastmod: definition.lastmod,
  })),
].map((page) => ({ ...page, pageUrl: `${SITE_URL}/${page.slug}/` }));

await Promise.all(
  pages.map(async (page) => {
    const outDir = resolve(distDir, page.slug);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      resolve(outDir, "index.html"),
      renderStaticPage(baseHtml, {
        title: page.title,
        description: page.description,
        pageUrl: page.pageUrl,
        rootHtml: renderToString(page.element),
        rootAttributes: ` data-page="${page.slug}"`,
        // /about/ is the one info page that describes the organization.
        keepPayloadIds:
          page.slug === "about" ? ["organization-structured-data"] : [],
        breadcrumb: [
          homeCrumb,
          { name: page.breadcrumbLabel, url: page.pageUrl },
        ],
      }),
      "utf8",
    );
  }),
);

await appendSitemapUrls(resolve(distDir, "sitemap.xml"), pages);
await injectOrganizationData();

console.log(
  `تولید و پیش‌رندر ${pages.length.toLocaleString("fa-IR")} صفحه اطلاعاتی و تماس و بروزرسانی sitemap با موفقیت انجام شد.`,
);
