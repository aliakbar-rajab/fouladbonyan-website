import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

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

    const productLd = html.match(
      /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"Product".*?)<\/script>/,
    )?.[1];
    if (category.id === "beam") {
      // beam's default "beam" sub-category mixes per-kilogram and per-bar
      // rows, so its min/max would span two incompatible units -- the
      // generator skips the schema entirely rather than publish a bogus
      // range, matching RebarPrices.tsx's own units.length !== 1 guard.
      assert.equal(productLd, undefined);
      continue;
    }
    assert.ok(productLd, `${category.id} is missing its Product JSON-LD`);
    const product = JSON.parse(productLd);
    assert.equal(product.offers.priceCurrency, "IRR");
    assert.ok(product.offers.lowPrice > 0);
    assert.ok(product.offers.highPrice >= product.offers.lowPrice);
    assert.ok(product.offers.offerCount > 0);
  }

  const sitemap = await readDist("sitemap.xml");
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
  assert.match(html, /\/assets\/[^"]+\.js/);
  assert.match(html, /\/preloader\/fb-preloader\.js/);
  assert.doesNotMatch(html, /localhost|pages-dist|_next/);
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
