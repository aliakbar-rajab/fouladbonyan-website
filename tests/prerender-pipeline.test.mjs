import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import React from "react";
import {
  buildBreadcrumbJsonLd,
  buildHeroPreloadTag,
  buildSitemapXml,
  renderStaticDocument,
  replaceSocialMeta,
} from "../scripts/lib/static-document.mjs";
import { collectSitePageDescriptors } from "../scripts/lib/site-pages.mjs";
import {
  compileStaticSite,
  generateStaticSite,
  writeCompiledSite,
} from "../scripts/lib/prerender-pipeline.mjs";
import {
  buildMenuCatalog,
  buildOverviewSummaries,
  resetCatalogReader,
} from "../app/catalog-reader.ts";
import { getHeroImageSources } from "../app/image-utils.ts";
import { buildGuideReference } from "../app/steel-reference.ts";
import {
  interpretSiteRoute,
  siteRoutePath,
} from "../app/site-route.ts";

const datasetFromAttributes = (attributes) =>
  Object.fromEntries(
    [...attributes.matchAll(/data-([a-z-]+)="([^"]*)"/g)].map(
      ([, name, value]) => [
        name.replace(/-([a-z])/g, (_, character) => character.toUpperCase()),
        value,
      ],
    ),
  );

const MOCK_TEMPLATE = `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="Default Description" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://fouladbonyan.com/" />
    <link id="hero-image-preload" rel="preload" as="image" href="/default.avif" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Default OG Title" />
    <meta property="og:description" content="Default OG Desc" />
    <meta property="og:url" content="https://fouladbonyan.com/" />
    <meta property="og:image" content="https://fouladbonyan.com/og.png" />
    <meta property="og:image:width" content="1730" />
    <meta property="og:image:height" content="909" />
    <meta property="og:image:alt" content="Default OG Alt" />
    <meta name="twitter:title" content="Default Twitter Title" />
    <meta name="twitter:description" content="Default Twitter Desc" />
    <meta name="twitter:image" content="https://fouladbonyan.com/og.png" />
    <script id="organization-structured-data" type="application/ld+json">{}</script>
    <title>Default Title</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

test("collectSitePageDescriptors compiles all 65 static site descriptors with distinct metadata", async () => {
  const snapshotRaw = await readFile(
    new URL("../app/data/catalog-prices.json", import.meta.url),
    "utf8",
  );
  const snapshot = JSON.parse(snapshotRaw);

  resetCatalogReader();
  const menuCatalog = await buildMenuCatalog(snapshot);
  const overviewSummaries = buildOverviewSummaries(snapshot);
  const reference = buildGuideReference(snapshot);

  const { pages, rootLastmod, siteUrl } = await collectSitePageDescriptors({
    snapshot,
    menuCatalog,
    overviewSummaries,
    reference,
  });

  assert.equal(pages.length, 65, "Must generate exactly 65 static page descriptors");
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

    const pathname = new URL(page.pageUrl).pathname;
    const route = interpretSiteRoute({
      pathname,
      dataset: datasetFromAttributes(page.rootAttributes),
    });
    assert.equal(
      siteRoutePath(route),
      pathname,
      `${page.pageUrl} must use the same route meaning in SSG and hydration`,
    );

    // If breadcrumbs are present, verify valid format
    if (page.breadcrumb.length > 0) {
      assert.equal(
        page.breadcrumb[0].name,
        "صفحه اصلی",
        `${page.pageUrl} breadcrumb root must be صفحه اصلی`,
      );
    }
  }

  assert.equal(urls.size, 65, "All 65 page URLs must be globally unique");
  assert.equal(titles.size, 65, "All 65 page titles must be globally unique");
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

test("renderStaticDocument fails fast when a required template slot is missing", () => {
  const baseDescriptor = {
    title: "عنوان",
    description: "توضیحات",
    pageUrl: "https://fouladbonyan.com/test/",
    rootElement: React.createElement("div", null, "متن"),
    heroPreload: null,
    organizationData: null,
  };

  assert.throws(
    () =>
      renderStaticDocument(
        MOCK_TEMPLATE.replace(/<title>[^<]*<\/title>/, ""),
        baseDescriptor,
      ),
    /missing required slot: <title>/,
  );

  assert.throws(
    () =>
      renderStaticDocument(
        MOCK_TEMPLATE.replace(/<div id="root"><\/div>/, ""),
        baseDescriptor,
      ),
    /missing required slot: <div id="root">/,
  );

  assert.throws(
    () =>
      renderStaticDocument(
        MOCK_TEMPLATE.replace(/<link id="hero-image-preload"[^>]*\/>/, ""),
        baseDescriptor,
      ),
    /missing required slot: <link id="hero-image-preload">/,
  );

  assert.throws(
    () =>
      renderStaticDocument(
        MOCK_TEMPLATE.replace(
          /<script id="organization-structured-data"[\s\S]*?<\/script>/,
          "",
        ),
        baseDescriptor,
      ),
    /missing required slot: <script id="organization-structured-data">/,
  );

  assert.throws(
    () =>
      renderStaticDocument(
        MOCK_TEMPLATE.replace(/<meta property="og:image"[^>]*\/>/, ""),
        {
          ...baseDescriptor,
          ogImage: "https://fouladbonyan.com/categories/hero-rebar-1280.jpg",
          ogImageWidth: 1280,
          ogImageHeight: 720,
        },
      ),
    /missing required slot: <meta property="og:image">/,
  );
});

test("a hostile upstream label cannot break out of the markup it is spliced into", () => {
  // Titles, descriptions and dataset values are built from category and product
  // labels scraped off fooladiranian.com, and the payload scripts carry that
  // catalog verbatim. One quote or one closing script tag in any of them used
  // to end the attribute or the element early.
  const nasty = 'میلگرد" onload="x' + "</script><script>alert(1)</script>";
  const html = renderStaticDocument(MOCK_TEMPLATE, {
    title: `قیمت ${nasty}`,
    description: `توضیحات ${nasty}`,
    pageUrl: "https://fouladbonyan.com/rebar/x/",
    rootElement: React.createElement("h1", null, "محتوا"),
    rootAttributes: ` data-initial-subcategory-label="${nasty.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}"`,
    heroPreload: null,
    payloads: [{ id: "initial-page-data", data: { label: nasty } }],
    breadcrumb: [{ name: nasty, url: "https://fouladbonyan.com/rebar/x/" }],
    organizationData: null,
  });

  // No raw quote ever lands inside an attribute value, and no payload or
  // JSON-LD block ever contains a literal tag delimiter.
  assert.doesNotMatch(html, /content="[^"]*"\s*onload/);
  assert.doesNotMatch(html, /<title>[^<]*<script/);
  for (const [, body] of html.matchAll(
    /<script[^>]*type="application\/(?:json|ld\+json)"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    assert.doesNotMatch(body, /</);
    JSON.parse(body);
  }
  assert.match(html, /&quot;/);
  assert.equal(html.split("<script").length - 1, html.split("</script>").length - 1);
});

test("a replacement-pattern sequence in page content survives the splice verbatim", () => {
  // String.replace reads $&, $' and $` out of a replacement *string*. Every
  // splice uses a function replacer so payloads carrying those keep their bytes.
  const dollars = "قیمت $& و $' و $` و $1";
  const html = renderStaticDocument(MOCK_TEMPLATE, {
    title: dollars,
    description: dollars,
    pageUrl: "https://fouladbonyan.com/x/",
    rootElement: React.createElement("p", null, dollars),
    rootAttributes: "",
    heroPreload: null,
    payloads: [{ id: "initial-page-data", data: { note: dollars } }],
    breadcrumb: [],
    organizationData: null,
  });

  // `&` is escaped and React escapes its own `'`; what matters is that no `$`
  // sequence was *expanded* -- each one is still sitting there literally.
  assert.match(html, /<title>قیمت \$&amp; و \$' و \$` و \$1<\/title>/);
  assert.match(html, /<p>قیمت \$&amp; و \$&#x27; و \$` و \$1<\/p>/);
  // The payload is JSON, not markup, so it keeps every byte.
  assert.match(html, /"note":"قیمت \$& و \$' و \$` و \$1"/);
  // `$&` would have pasted the whole matched element back into itself.
  assert.equal(html.split('<div id="root"').length - 1, 1);
  assert.equal(html.split("<title>").length - 1, 1);
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

test("buildSitemapXml produces well-formed XML with indexable URLs only", () => {
  const mockPages = [
    { pageUrl: "https://fouladbonyan.com/", lastmod: "2026-08-28" },
    { pageUrl: "https://fouladbonyan.com/rebar/", lastmod: "2026-08-28" },
    { pageUrl: "https://fouladbonyan.com/contact/", lastmod: "2026-08-11" },
    { pageUrl: "https://fouladbonyan.com/privacy/", lastmod: "2026-07-29", noindex: true },
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
  assert.doesNotMatch(xml, /<loc>https:\/\/fouladbonyan\.com\/privacy\/<\/loc>/);
  assert.match(xml, /<\/urlset>\s*$/);
});

test("renderStaticDocument updates robots meta tag when noindex is requested", () => {
  const html = renderStaticDocument(MOCK_TEMPLATE, {
    title: "حریم خصوصی | بنیان فولاد داریا",
    description: "سیاست حریم خصوصی",
    pageUrl: "https://fouladbonyan.com/privacy/",
    robots: "noindex, follow",
    rootElement: React.createElement("div", null, "حریم خصوصی"),
  });
  assert.match(html, /<meta name="robots" content="noindex, follow" \/>/);
});

test("writeCompiledSite flushes a compiled virtual site into the expected directory hierarchy", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "prerender-test-"));

  try {
    const virtualSite = {
      files: new Map([
        ["index.html", "<!doctype html><title>Home</title>"],
        ["rebar/index.html", "<!doctype html><title>Rebar</title>"],
        ["rebar/ribbed/index.html", "<!doctype html><title>Ribbed</title>"],
        ["sitemap.xml", "<urlset><url><loc>https://fouladbonyan.com/rebar/ribbed/</loc></url></urlset>"],
        ["_redirects", "/angle/angle/ /angle/ 301\n/beam/beam/ /beam/ 301\n/wire/wire/ /wire/steel-wire/ 301\n"],
      ]),
      pageCount: 3,
      sitemapCount: 3,
    };

    const result = await writeCompiledSite(tempDir, virtualSite);

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

    const redirects = await readFile(join(tempDir, "_redirects"), "utf8");
    assert.match(redirects, /^\/angle\/angle\/ \/angle\/ 301$/m);
    assert.match(redirects, /^\/beam\/beam\/ \/beam\/ 301$/m);
    assert.match(redirects, /^\/wire\/wire\/ \/wire\/steel-wire\/ 301$/m);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("buildHeroPreloadTag reuses app/image-utils.ts and emits existing AVIF preload hrefs", async () => {
  const heroSources = getHeroImageSources("/categories/hero-rebar-1680.jpg");
  const heroTag = buildHeroPreloadTag({
    heroImage: "/categories/hero-rebar-1680.jpg",
  });
  assert.match(heroTag, /id="hero-image-preload"/);
  assert.ok(heroTag.includes(`href="${heroSources.avifHref}"`));
  assert.ok(heroTag.includes(`imagesrcset="${heroSources.avifSrcSet}"`));
  assert.match(heroTag, /href="\/categories\/hero-rebar-1680\.avif"/);

  const fallbackSources = getHeroImageSources("/categories/01-rebar.jpg");
  const fallbackTag = buildHeroPreloadTag({
    image: "/categories/01-rebar.jpg",
  });
  assert.match(fallbackTag, /id="hero-image-preload"/);
  assert.ok(fallbackTag.includes(`href="${fallbackSources.avifHref}"`));
  assert.ok(fallbackTag.includes(`imagesrcset="${fallbackSources.avifSrcSet}"`));
  assert.match(fallbackTag, /href="\/categories\/01-rebar-384\.avif"/);

  // Confirm both preload targets exist as real generated files in public/.
  await Promise.all([
    access(new URL(`../public${heroSources.avifHref}`, import.meta.url)),
    access(new URL(`../public${fallbackSources.avifHref}`, import.meta.url)),
  ]);
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

test("compileStaticSite builds virtual files, sitemap, and redirects in-process", async () => {
  const [templateHtml, snapshotRaw] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app/data/catalog-prices.json", import.meta.url), "utf8"),
  ]);
  const snapshot = JSON.parse(snapshotRaw);

  const compiled = await compileStaticSite({
    templateHtml,
    snapshot,
    siteUrl: "https://example.test",
  });

  assert.equal(compiled.pageCount, 65);
  assert.equal(compiled.sitemapCount, 61);
  assert.equal(compiled.files.get("sitemap.xml"), compiled.sitemapXml);
  assert.equal(compiled.files.get("_redirects"), compiled.redirectsText);
  assert.ok(compiled.files.has("index.html"));
  assert.ok(compiled.files.has("rebar/ribbed/index.html"));
  assert.ok(compiled.files.has("angle/angle/index.html"));
  assert.match(compiled.files.get("index.html"), /<link rel="canonical" href="https:\/\/example\.test\/" \/>/);
  assert.match(compiled.sitemapXml, /<loc>https:\/\/example\.test\/rebar\/<\/loc>/);
  assert.match(compiled.redirectsText, /^\/angle\/angle\/ \/angle\/ 301$/m);
});

/*
 * The orchestration itself, with no build behind it.
 *
 * generateStaticSite reads inputs through its seams, compiles the virtual site
 * via compileStaticSite, and hands that compiled site to writeSite.
 */
test("generateStaticSite compiles in memory and hands the virtual site to writeSite", async () => {
  let templateReads = 0;
  const writes = [];

  const result = await generateStaticSite({
    siteUrl: "https://example.test",
    readTemplate: () => {
      templateReads += 1;
      return Promise.resolve(MOCK_TEMPLATE);
    },
    writeSite: (distDir, compiled) => {
      writes.push({ distDir, compiled });
      return { pageCount: compiled.pageCount, sitemapCount: compiled.sitemapCount };
    },
  });

  assert.equal(templateReads, 1, "the template is read through the seam, once");
  assert.equal(writes.length, 1);

  const [{ compiled }] = writes;
  assert.equal(compiled.siteUrl, "https://example.test");
  assert.match(compiled.rootLastmod, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(result.pageCount, compiled.pageCount);
  assert.equal(result.sitemapCount, compiled.sitemapCount);

  assert.ok(compiled.pages.length > 0);
  const home = compiled.pages.find((page) => page.pageUrl === "https://example.test/");
  assert.ok(home, "the homepage entry is present");
  assert.ok(home.title && home.description && home.html);
  assert.equal(compiled.files.get("index.html"), home.html);

  for (const page of compiled.pages) {
    assert.ok(Array.isArray(page.outPath), `${page.pageUrl} needs an outPath`);
    assert.ok(page.title, `${page.pageUrl} needs a title`);
    assert.ok(page.description, `${page.pageUrl} needs a description`);
    assert.match(page.lastmod, /^\d{4}-\d{2}-\d{2}$/, `${page.pageUrl} needs a lastmod`);
    assert.ok(page.pageUrl.startsWith("https://example.test/"), "every URL honours the injected siteUrl");
    assert.equal(compiled.files.get(page.relPath), page.html);
  }
});
