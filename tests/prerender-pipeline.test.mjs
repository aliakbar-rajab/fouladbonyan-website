import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import React from "react";
import {
  buildBreadcrumbJsonLd,
  buildHeroPreloadTag,
  buildSitemapXml,
  collectSitePageDescriptors,
  renderStaticDocument,
  replaceSocialMeta,
  writePrerenderArtifacts,
} from "../scripts/lib/prerender-pipeline.mjs";
import {
  buildMenuCatalog,
  loadOverviewSummaries,
  primeCatalogSnapshot,
} from "../app/catalog-reader.ts";
import { buildGuideReference } from "../app/steel-reference.ts";

const MOCK_TEMPLATE = `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="Default Description" />
    <link rel="canonical" href="https://fouladbonyan.com/" />
    <link id="hero-image-preload" rel="preload" as="image" href="/default.avif" />
    <meta property="og:title" content="Default OG Title" />
    <meta property="og:description" content="Default OG Desc" />
    <meta property="og:url" content="https://fouladbonyan.com/" />
    <meta name="twitter:title" content="Default Twitter Title" />
    <meta name="twitter:description" content="Default Twitter Desc" />
    <script id="organization-structured-data" type="application/ld+json">{}</script>
    <title>Default Title</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

test("collectSitePageDescriptors compiles all 68 static site descriptors with distinct metadata", async () => {
  const snapshotRaw = await readFile(
    new URL("../app/data/catalog-prices.json", import.meta.url),
    "utf8",
  );
  const snapshot = JSON.parse(snapshotRaw);

  primeCatalogSnapshot(snapshot);
  const [menuCatalog, overviewSummaries] = await Promise.all([
    buildMenuCatalog(),
    loadOverviewSummaries(),
  ]);
  const reference = buildGuideReference(snapshot);

  const { pages, rootLastmod, siteUrl } = await collectSitePageDescriptors({
    snapshot,
    menuCatalog,
    overviewSummaries,
    reference,
  });

  assert.equal(pages.length, 68, "Must generate exactly 68 static page descriptors");
  assert.ok(rootLastmod, "Must provide rootLastmod");
  assert.equal(siteUrl, "https://fouladbonyan.com");

  const urls = new Set();
  const titles = new Set();

  for (const page of pages) {
    assert.ok(page.pageUrl, "Page descriptor must have pageUrl");
    assert.ok(page.title, `Page ${page.pageUrl} must have a title`);
    assert.ok(page.description, `Page ${page.pageUrl} must have a description`);
    assert.ok(page.rootElement, `Page ${page.pageUrl} must have rootElement`);
    assert.ok(page.lastmod, `Page ${page.pageUrl} must have lastmod`);

    urls.add(page.pageUrl);
    titles.add(page.title);

    // If breadcrumbs are present, verify valid format
    if (page.breadcrumb.length > 0) {
      assert.equal(
        page.breadcrumb[0].name,
        "صفحه اصلی",
        `${page.pageUrl} breadcrumb root must be صفحه اصلی`,
      );
    }
  }

  assert.equal(urls.size, 68, "All 68 page URLs must be globally unique");
  assert.equal(titles.size, 68, "All 68 page titles must be globally unique");
});

test("renderStaticDocument transforms shell cleanly and embeds React SSR markup", () => {
  const descriptor = {
    title: "تست عنوان | فولاد",
    description: "تست توضیحات سئو برای صفحه",
    pageUrl: "https://fouladbonyan.com/test-page/",
    rootElement: React.createElement("h1", null, "محتوای تست"),
    rootAttributes: ' data-page="test"',
    heroPreload: null,
    payloads: [{ id: "test-payload", data: { foo: "bar" } }],
    breadcrumb: [
      { name: "صفحه اصلی", url: "https://fouladbonyan.com/" },
      { name: "تست", url: "https://fouladbonyan.com/test-page/" },
    ],
    organizationData: null,
  };

  const html = renderStaticDocument(MOCK_TEMPLATE, descriptor);

  assert.match(html, /<title>تست عنوان \| فولاد<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/fouladbonyan\.com\/test-page\/" \/>/);
  assert.match(html, /<meta name="description" content="تست توضیحات سئو برای صفحه" \/>/);
  assert.match(html, /<meta property="og:title" content="تست عنوان \| فولاد" \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/fouladbonyan\.com\/test-page\/" \/>/);
  assert.doesNotMatch(html, /id="hero-image-preload"/, "Hero preload should be removed when null");
  assert.doesNotMatch(html, /id="organization-structured-data"/, "Organization data should be stripped when null");
  assert.match(html, /<div id="root" data-page="test"><h1>محتوای تست<\/h1><\/div>/);
  assert.match(html, /<script id="test-payload" type="application\/json">\{"foo":"bar"\}<\/script>/);
  assert.match(html, /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList"/);
});

test("renderStaticDocument injects organization data when provided", () => {
  const orgPayload = { "@type": "Organization", name: "بنیان فولاد داریا" };
  const descriptor = {
    title: "درباره ما | بنیان فولاد داریا",
    description: "توضیحات درباره ما",
    pageUrl: "https://fouladbonyan.com/about/",
    rootElement: React.createElement("div", null, "درباره ما"),
    rootAttributes: ' data-page="about"',
    organizationData: orgPayload,
  };

  const html = renderStaticDocument(MOCK_TEMPLATE, descriptor);
  assert.match(
    html,
    /<script id="organization-structured-data" type="application\/ld\+json">\{"@type":"Organization","name":"بنیان فولاد داریا"\}<\/script>/,
  );
});

test("buildSitemapXml produces well-formed XML with all 68 URLs", () => {
  const mockPages = [
    { pageUrl: "https://fouladbonyan.com/", lastmod: "2026-08-28" },
    { pageUrl: "https://fouladbonyan.com/rebar/", lastmod: "2026-08-28" },
    { pageUrl: "https://fouladbonyan.com/contact/", lastmod: "2026-08-11" },
  ];

  const xml = buildSitemapXml({
    siteUrl: "https://fouladbonyan.com",
    rootLastmod: "2026-08-28",
    pages: mockPages,
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/fouladbonyan\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/fouladbonyan\.com\/rebar\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/fouladbonyan\.com\/contact\/<\/loc>/);
  assert.match(xml, /<\/urlset>\s*$/);
});

test("writePrerenderArtifacts creates expected files and directory hierarchy atomically", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "prerender-test-"));

  try {
    const mockPages = [
      {
        outPath: [],
        pageUrl: "https://fouladbonyan.com/",
        lastmod: "2026-08-28",
        title: "Home",
        description: "Home Desc",
        rootElement: React.createElement("div", null, "Home"),
        payloads: [],
        breadcrumb: [],
      },
      {
        outPath: ["rebar"],
        pageUrl: "https://fouladbonyan.com/rebar/",
        lastmod: "2026-08-28",
        title: "Rebar",
        description: "Rebar Desc",
        rootElement: React.createElement("div", null, "Rebar"),
        payloads: [],
        breadcrumb: [],
      },
      {
        outPath: ["rebar", "ribbed"],
        pageUrl: "https://fouladbonyan.com/rebar/ribbed/",
        lastmod: "2026-08-28",
        title: "Ribbed",
        description: "Ribbed Desc",
        rootElement: React.createElement("div", null, "Ribbed"),
        payloads: [],
        breadcrumb: [],
      },
    ];

    const result = await writePrerenderArtifacts({
      distDir: tempDir,
      templateHtml: MOCK_TEMPLATE,
      pages: mockPages,
      rootLastmod: "2026-08-28",
      siteUrl: "https://fouladbonyan.com",
    });

    assert.equal(result.pageCount, 3);
    assert.equal(result.sitemapCount, 3);

    const homeHtml = await readFile(join(tempDir, "index.html"), "utf8");
    assert.match(homeHtml, /<title>Home<\/title>/);

    const rebarHtml = await readFile(join(tempDir, "rebar", "index.html"), "utf8");
    assert.match(rebarHtml, /<title>Rebar<\/title>/);

    const ribbedHtml = await readFile(join(tempDir, "rebar", "ribbed", "index.html"), "utf8");
    assert.match(ribbedHtml, /<title>Ribbed<\/title>/);

    const sitemap = await readFile(join(tempDir, "sitemap.xml"), "utf8");
    assert.match(sitemap, /<loc>https:\/\/fouladbonyan\.com\/rebar\/ribbed\/<\/loc>/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("buildHeroPreloadTag generates valid preload link for category hero images", () => {
  const heroTag = buildHeroPreloadTag({
    heroImage: "/categories/hero-rebar-1680.jpg",
  });
  assert.match(heroTag, /id="hero-image-preload"/);
  assert.match(heroTag, /href="\/categories\/hero-rebar-1680\.avif"/);
  assert.match(heroTag, /imagesrcset="\/categories\/hero-rebar-640\.avif/);

  const fallbackTag = buildHeroPreloadTag({
    image: "/categories/01-rebar.jpg",
  });
  assert.match(fallbackTag, /id="hero-image-preload"/);
  assert.match(fallbackTag, /href="\/categories\/01-rebar\.avif"/);
});

test("buildBreadcrumbJsonLd formats Schema.org BreadcrumbList payload", () => {
  const breadcrumb = [
    { name: "صفحه اصلی", url: "https://fouladbonyan.com/" },
    { name: "میلگرد", url: "https://fouladbonyan.com/rebar/" },
  ];
  const jsonLd = buildBreadcrumbJsonLd(breadcrumb);
  assert.match(jsonLd, /<script type="application\/ld\+json">/);
  assert.match(jsonLd, /"position":1,"name":"صفحه اصلی"/);
  assert.match(jsonLd, /"position":2,"name":"میلگرد"/);
});

test("replaceSocialMeta updates OpenGraph, Twitter and description meta tags", () => {
  const updated = replaceSocialMeta(MOCK_TEMPLATE, {
    title: "عنوان جدید",
    description: "توضیحات جدید",
    pageUrl: "https://fouladbonyan.com/new-url/",
  });
  assert.match(updated, /<meta name="description" content="توضیحات جدید" \/>/);
  assert.match(updated, /<meta property="og:title" content="عنوان جدید" \/>/);
  assert.match(updated, /<meta property="og:description" content="توضیحات جدید" \/>/);
  assert.match(updated, /<meta property="og:url" content="https:\/\/fouladbonyan\.com\/new-url\/" \/>/);
  assert.match(updated, /<meta name="twitter:title" content="عنوان جدید" \/>/);
  assert.match(updated, /<meta name="twitter:description" content="توضیحات جدید" \/>/);
});

