import assert from "node:assert/strict";
import test from "node:test";
import { access, readdir, stat } from "node:fs/promises";
import { productGroups } from "../app/category-meta.ts";
import { parseBreadcrumbLd, readDist } from "./helpers/dist.mjs";

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
      "categories/hero-profile-1680.jpg",
      "categories/hero-pipe-1680.jpg",
      "categories/hero-angle-1680.jpg",
      "categories/hero-channel-1680.jpg",
      "categories/hero-wire-1680.jpg",
      "categories/hero-rebar-640.webp",
      "categories/hero-rebar-640.avif",
      "categories/01-rebar-384.webp",
      "categories/01-rebar-384.avif",
      "categories/01-rebar-240.webp",
    ].map((path) => access(new URL(`../dist/${path}`, import.meta.url))),
  );
});

test("every product family ships a dedicated responsive hero set", async () => {
  await Promise.all(
    productGroups.flatMap((group) => {
      assert.ok(group.heroImage, `${group.id} must not fall back to its card image`);
      const base = group.heroImage.replace(/-1680\.jpg$/, "").replace(/^\//, "");
      return ["640", "960", "1280", "1680"].flatMap((width) =>
        ["avif", "webp", "jpg"].map((format) =>
          access(new URL(`../dist/${base}-${width}.${format}`, import.meta.url)),
        ),
      );
    }),
  );
});

test("every category and subcategory page renders its family hero", async () => {
  for (const group of productGroups) {
    assert.ok(group.heroImage, `${group.id} must define a dedicated hero image`);
    const heroBase = group.heroImage.replace(/-1680\.jpg$/, "");
    const escapedHeroBase = heroBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isSingleCategoryGroup = group.id === "angle" || group.id === "channel";
    const groupDirectory = new URL(`../dist/${group.id}/`, import.meta.url);
    const subcategoryDirectories = isSingleCategoryGroup
      ? []
      : (await readdir(groupDirectory, {
          withFileTypes: true,
        }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => `${group.id}/${entry.name}/index.html`);
    const pagePaths = [`${group.id}/index.html`, ...subcategoryDirectories];

    for (const pagePath of pagePaths) {
      const html = await readDist(pagePath);
      assert.match(
        html,
        new RegExp(
          `<picture class="hero-image is-active">[\\s\\S]*?<img src="${escapedHeroBase}-1680\\.jpg"`,
        ),
        `${pagePath} must render the ${group.id} hero`,
      );
    }
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
    const pageBc = parseBreadcrumbLd(
      pageHtml,
      `${page} must emit BreadcrumbList JSON-LD`,
    );
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
  assert.ok(
    javascriptFiles.length >= 2,
    `expected at least 2 JS files (entry + lazy catalog chunk), found ${javascriptFiles.length}`,
  );
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
  // A canary so the pairing assertion below cannot pass vacuously, not a
  // target. The header redesign dropped four frosted surfaces (its search
  // field, phone chip, nav toggle and the inner pages' catalog link), which is
  // why this floor is lower than it once was.
  assert.ok(
    declaring.length >= 14,
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

test("F13: responsive images, modern formats (WebP/AVIF), alt text, and preload hints are correctly emitted across all pages", async () => {
  // 1. Homepage hero: picture with AVIF and WebP sources, eager loading on active, lazy on inactive
  const homeHtml = await readDist("index.html");
  assert.match(
    homeHtml,
    /<link[\s\S]*?id="hero-image-preload"[\s\S]*?href="\/categories\/hero-rebar-1680\.(webp|avif)"[\s\S]*?imagesrcset="[^"]*"[\s\S]*?imagesizes="100vw"[\s\S]*?fetchpriority="high"\s*\/?>/,
    "Homepage head must preload active hero variant with imagesrcset",
  );
  assert.match(
    homeHtml,
    /<picture class="hero-image is-active">\s*<source type="image\/avif"/,
    "Homepage active hero must use picture with AVIF source",
  );
  assert.match(
    homeHtml,
    /<picture class="hero-image is-active">[\s\S]*?<source type="image\/webp"/,
    "Homepage active hero must use picture with WebP source",
  );
  assert.match(
    homeHtml,
    /<picture class="hero-image is-active">[\s\S]*?<img [^>]*loading="eager"[^>]*fetch[pP]riority="high"/,
    "Homepage active hero img must have loading=eager and fetchpriority=high",
  );
  assert.match(
    homeHtml,
    /<picture class="hero-image">[\s\S]*?<img [^>]*loading="lazy"[^>]*fetch[pP]riority="low"/,
    "Homepage inactive hero img must have loading=lazy and fetchpriority=low",
  );

  // 2. Category pages: hero picture and preload matching the category
  for (const group of productGroups) {
    const catHtml = await readDist(`${group.id}/index.html`);
    assert.ok(group.heroImage, `${group.id} must define a dedicated hero image`);
    const heroBase = group.heroImage.replace(/-1680\.jpg$/, "");
    assert.match(
      catHtml,
      new RegExp(
        `<link[\\s\\S]*?id="hero-image-preload"[\\s\\S]*?href="${heroBase}-1680\\.(webp|avif)"`,
      ),
      `${group.id} must have hero-image-preload link in head`,
    );
    assert.match(
      catHtml,
      /<picture class="hero-image is-active">\s*<source type="image\/avif"/,
      `${group.id} hero must use picture with AVIF source`,
    );
    assert.match(
      catHtml,
      /<picture class="hero-image is-active">[\s\S]*?<img [^>]*loading="eager"[^>]*fetch[pP]riority="high"/,
      `${group.id} hero img must have loading=eager and fetchpriority=high`,
    );
  }

  // 3. Info pages: must NOT have hero image preload
  for (const page of ["contact", "about", "terms", "privacy", "quote-process"]) {
    const infoHtml = await readDist(`${page}/index.html`);
    assert.doesNotMatch(
      infoHtml,
      /<link id="hero-image-preload"/,
      `${page} must not have hero-image-preload`,
    );
  }

  // 4. CategoryGrid cards: meaningful alt text and responsive picture
  for (const group of productGroups) {
    assert.ok(group.imageAlt, `${group.id} must have meaningful imageAlt defined`);
    assert.match(
      homeHtml,
      new RegExp(`alt="${group.imageAlt}"`),
      `Homepage category card for ${group.id} must contain meaningful alt text`,
    );
  }

  // 5. Overview thumbnails have decorative alt=""
  assert.match(
    homeHtml,
    /<img src="\/categories\/01-rebar\.jpg" alt="" width="40" height="40"/,
    "Overview table thumb must keep decorative alt=''",
  );
});
