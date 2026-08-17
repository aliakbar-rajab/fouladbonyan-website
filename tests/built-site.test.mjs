import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";
import { infoPageDefinitions } from "../app/info-page-data.ts";
import { productGroups } from "../app/category-meta.ts";


const readDist = (path) =>
  readFile(new URL(`../dist/${path}`, import.meta.url), "utf8");


test("production output contains required GitHub Pages files", async () => {
  await Promise.all(
    [
      "index.html",
      "404.html",
      "robots.txt",
      "sitemap.xml",
      "manifest.webmanifest",
      "fonts/b-titr-bold.woff",
      "brand/bonyan-foulad-daria-logo.webp",
      "preloader/fb-preloader.js",
      "preloader/assets/tr2.mp4",
      "preloader/assets/tr2-poster.jpg",
      "categories/hero-rebar-1680.jpg",
      "categories/hero-beam-1680.jpg",
      "categories/hero-sheet-1680.jpg",
    ].map((path) => access(new URL(`../dist/${path}`, import.meta.url))),
  );
});

test("category landing pages have unique metadata, a CSP-safe initial tab, and sitemap entries", async () => {
  const categories = [
    { id: "rebar", title: "قیمت میلگرد" },
    { id: "beam", title: "قیمت تیرآهن" },
    { id: "sheet", title: "قیمت ورق" },
    { id: "profile", title: "قیمت پروفیل" },
    { id: "pipe", title: "قیمت لوله" },
    { id: "angle", title: "قیمت نبشی" },
    { id: "channel", title: "قیمت ناودانی" },
    { id: "wire", title: "قیمت مفتول" },
  ];

  for (const category of categories) {
    const html = await readDist(`${category.id}/index.html`);
    assert.match(html, new RegExp(`<title>${category.title}`));
    assert.match(
      html,
      new RegExp(
        `<link rel="canonical" href="https://fouladbonyan\\.com/${category.id}/" />`,
      ),
    );
    assert.match(html, new RegExp(`data-initial-category="${category.id}"`));
    // The CSP is script-src 'self' with no unsafe-inline: any inline <script>
    // here would silently fail to run, so the category selection must come
    // from a plain data attribute instead (see category-meta.ts).
    assert.doesNotMatch(html, /<script>window\./);

    const breadcrumbLdMatch = html.match(
      /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList".*?)<\/script>/,
    )?.[1];
    assert.ok(
      breadcrumbLdMatch,
      `${category.id} should emit BreadcrumbList structured data`,
    );
    const breadcrumbLd = JSON.parse(breadcrumbLdMatch);
    assert.equal(
      breadcrumbLd.itemListElement[0]?.name,
      "صفحه اصلی",
      `${category.id} breadcrumb item 1 must be صفحه اصلی`,
    );

    const productLd = html.match(
      /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"Product".*?)<\/script>/,
    )?.[1];
    assert.equal(
      productLd,
      undefined,
      `${category.id} should not emit Product structured data on category landing pages`,
    );

    const catOrgLdMatch = html.match(
      /<script id="organization-structured-data"/,
    );
    assert.equal(
      catOrgLdMatch,
      null,
      `${category.id} should not emit Organization JSON-LD on category pages`,
    );
  }

  const sitemap = await readDist("sitemap.xml");
  assert.doesNotMatch(sitemap, /<changefreq>/);
  assert.doesNotMatch(sitemap, /<priority>/);
  for (const category of categories) {
    assert.match(
      sitemap,
      new RegExp(`<loc>https://fouladbonyan\\.com/${category.id}/</loc>`),
    );
  }
});

test("built HTML uses root-safe assets and production metadata", async () => {
  const html = await readDist("index.html");
  assert.match(html, /lang="fa" dir="rtl"/);
  assert.match(html, /https:\/\/fouladbonyan\.com\//);
  assert.match(html, /<title>قیمت روز آهن و فولاد \| بنیان فولاد داریا<\/title>/);
  assert.match(html, /\/assets\/[^"]+\.js/);
  assert.match(html, /\/preloader\/fb-preloader\.js/);
  assert.doesNotMatch(html, /localhost|pages-dist|_next/);

  // Organization JSON-LD is emitted on the homepage and /about/ only
  const homeOrgMatch = html.match(
    /<script id="organization-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(homeOrgMatch, "Homepage is missing Organization JSON-LD");
  const homeOrg = JSON.parse(homeOrgMatch);
  assert.equal(homeOrg["@type"], "Organization");
  assert.equal(homeOrg["@id"], "https://fouladbonyan.com/#organization");
  assert.equal(homeOrg.url, "https://fouladbonyan.com/");
  assert.equal(
    homeOrg.logo,
    "https://fouladbonyan.com/brand/bonyan-foulad-daria-logo.webp",
  );

  const aboutHtml = await readDist("about/index.html");
  const aboutOrgMatch = aboutHtml.match(
    /<script id="organization-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(aboutOrgMatch, "/about/ is missing Organization JSON-LD");
  const aboutOrg = JSON.parse(aboutOrgMatch);
  assert.equal(aboutOrg["@id"], "https://fouladbonyan.com/#organization");
  assert.equal(aboutOrg.url, "https://fouladbonyan.com/");

  // Non-organization pages must NOT emit the block, but must emit BreadcrumbList with صفحه اصلی
  for (const page of ["contact", "terms", "privacy", "quote-process"]) {
    const pageHtml = await readDist(`${page}/index.html`);
    assert.doesNotMatch(
      pageHtml,
      /<script id="organization-structured-data"/,
      `${page} must not emit Organization JSON-LD`,
    );
    const pageBcMatch = pageHtml.match(
      /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList".*?)<\/script>/,
    )?.[1];
    assert.ok(pageBcMatch, `${page} must emit BreadcrumbList JSON-LD`);
    const pageBc = JSON.parse(pageBcMatch);
    assert.equal(pageBc.itemListElement[0]?.name, "صفحه اصلی");
  }
});

test("built JavaScript has no external image or fake form dependency", async () => {
  const html = await readDist("index.html");
  const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(asset, "Vite JavaScript asset was not linked");
  const javascript = await readDist(asset.slice(1));
  assert.doesNotMatch(javascript, /images\.pexels\.com|submitQuote|VITE_LEAD_ENDPOINT/);
  assert.match(javascript, /BONYAN FOULAD DARIA/);
  // Menu wording ships in the bundle; the product names inside it do not --
  // those are read from the price snapshots at runtime.
  assert.match(javascript, /قیمت روز محصولات/);
});

test("large live catalogs are split out of the initial JavaScript", async () => {
  const html = await readDist("index.html");
  const mainAsset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(mainAsset);
  const assetsUrl = new URL("../dist/assets/", import.meta.url);
  const javascriptFiles = (await readdir(assetsUrl)).filter((file) =>
    file.endsWith(".js"),
  );
  const mainStats = await stat(
    new URL(`../dist/${mainAsset.slice(1)}`, import.meta.url),
  );
  assert.ok(
    mainStats.size < 500_000,
    `initial JavaScript is ${mainStats.size.toLocaleString()} bytes`,
  );
  assert.ok(javascriptFiles.length >= 4);
  const lazyJavaScript = (
    await Promise.all(
      javascriptFiles
        .filter((file) => !mainAsset.endsWith(file))
        .map((file) => readDist(`assets/${file}`)),
    )
  ).join("\n");
  assert.match(lazyJavaScript, /ورق ضد سایش/);
  assert.match(lazyJavaScript, /پروفیل صنعتی/);
  assert.match(lazyJavaScript, /لوله مانیسمان/);
  assert.match(lazyJavaScript, /توری حصاری/);
});

/*
 * The CSS minifier collapses a `backdrop-filter` / `-webkit-backdrop-filter`
 * pair down to a single declaration, keeping whichever the source declares
 * first. Authoring them standard-first therefore drops the standard property
 * from the build, which costs Firefox every frosted surface on the site — and
 * costs Chromium any filter whose value is a `var()`-substituted `url()`.
 * Assert on the built stylesheet rather than the source, because the source
 * looks correct either way.
 */
test("every built rule that blurs its backdrop keeps both the prefixed and standard property", async () => {
  const assetsUrl = new URL("../dist/assets/", import.meta.url);
  const stylesheets = (await readdir(assetsUrl)).filter((file) =>
    file.endsWith(".css"),
  );
  assert.ok(stylesheets.length > 0);

  const css = (
    await Promise.all(
      stylesheets.map((file) => readDist(`assets/${file}`)),
    )
  ).join("\n");

  const rules = css.match(/[^{}]+\{[^{}]*\}/g) ?? [];
  const declaring = rules.filter((rule) =>
    /[;{]-?(webkit-)?backdrop-filter:/.test(rule),
  );
  assert.ok(
    declaring.length >= 15,
    `expected the site to still use backdrop-filter, found ${declaring.length} rules`,
  );

  const unpaired = declaring
    .filter(
      (rule) =>
        /[;{]backdrop-filter:/.test(rule) !==
        /[;{]-webkit-backdrop-filter:/.test(rule),
    )
    .map((rule) => rule.split("{")[0].trim());

  assert.deepEqual(
    unpaired,
    [],
    "these rules lost one half of the pair in the build; declare -webkit-backdrop-filter first",
  );
});

test("prerendered SSG HTML contains complete meaningful content before JavaScript runs", async () => {
  // 1. Homepage
  const homeHtml = await readDist("index.html");
  assert.match(
    homeHtml,
    /<div id="root">[\s\S]+<\/div>/,
    "Homepage #root must not be empty",
  );
  assert.match(
    homeHtml,
    /<h1><span>قیمت روز آهن و فولاد؛<\/span><span>بنیان فولاد داریا<\/span><\/h1>/,
    "Homepage must contain the primary H1 in initial HTML",
  );
  assert.match(
    homeHtml,
    /class="overview-table"/,
    "Homepage must contain overview price table in initial HTML",
  );
  assert.match(
    homeHtml,
    /<script id="initial-overview-data" type="application\/json">/,
    "Homepage must embed initial-overview-data JSON for hydration",
  );

  // 2. Category pages
  for (const group of productGroups) {
    const catHtml = await readDist(`${group.id}/index.html`);
    assert.match(
      catHtml,
      new RegExp(`<div id="root" data-initial-category="${group.id}">[\\s\\S]+<\\/div>`),
      `${group.id} #root must be prerendered with content`,
    );
    assert.match(
      catHtml,
      new RegExp(`<h1><span>${group.h1}<\\/span><\\/h1>`),
      `${group.id} must contain expected H1 in initial HTML`,
    );
    assert.match(
      catHtml,
      /class="breadcrumb-nav"/,
      `${group.id} must contain DOM breadcrumb navigation in initial HTML`,
    );
    assert.match(
      catHtml,
      /class="hero-category-intro"/,
      `${group.id} must contain category-specific intro copy in initial HTML`,
    );
    assert.match(
      catHtml,
      /<script id="initial-page-data" type="application\/json">/,
      `${group.id} must embed initial-page-data JSON for hydration`,
    );
    // Representative price data verification
    assert.match(
      catHtml,
      /تومان/,
      `${group.id} must contain prerendered prices in initial HTML`,
    );
  }


  // 3. Contact & Info pages
  const infoPages = [
    { page: "contact", h1: "تماس با ما" },
    ...Object.entries(infoPageDefinitions).map(([page, def]) => ({
      page,
      h1: def.title,
    })),
  ];


  for (const { page, h1 } of infoPages) {
    const pageHtml = await readDist(`${page}/index.html`);
    assert.match(
      pageHtml,
      new RegExp(`<div id="root" data-page="${page}">[\\s\\S]+<\\/div>`),
      `${page} #root must be prerendered with content`,
    );
    assert.match(
      pageHtml,
      new RegExp(`<h1[^>]*>${h1}<\\/h1>`),
      `${page} must contain H1 in initial HTML`,
    );
    assert.match(
      pageHtml,
      /class="breadcrumb-nav"/,
      `${page} must contain DOM breadcrumb navigation in initial HTML`,
    );
  }
});

