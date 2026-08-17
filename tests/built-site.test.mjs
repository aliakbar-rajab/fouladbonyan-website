import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";
import { infoPageDefinitions } from "../app/info-page-data.ts";
import { productGroups } from "../app/category-meta.ts";
import {
  guideIndex,
  guidePageDefinitions,
  guidePageKeys,
} from "../app/guide-page-data.ts";


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
      "categories/hero-rebar-640.webp",
      "categories/hero-rebar-640.avif",
      "categories/01-rebar.webp",
      "categories/01-rebar.avif",
      "categories/01-rebar-240.webp",
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

test("F13: responsive images, modern formats (WebP/AVIF), alt text, and preload hints are correctly emitted across all pages", async () => {
  // 1. Homepage hero: picture with AVIF and WebP sources, eager loading on active, lazy on inactive
  const homeHtml = await readDist("index.html");
  assert.match(
    homeHtml,
    /<link[\s\S]*?id="hero-image-preload"[\s\S]*?href="\/categories\/hero-rebar-1680\.webp"[\s\S]*?imagesrcset="[^"]*"[\s\S]*?imagesizes="100vw"[\s\S]*?fetchpriority="high"\s*\/?>/,
    "Homepage head must preload active hero WebP variant with imagesrcset",
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
    assert.match(
      catHtml,
      /<link[\s\S]*?id="hero-image-preload"[\s\S]*?rel="preload"[\s\S]*?as="image"/,
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

test("F5: subcategory landing pages have unique metadata, crawlable breadcrumbs, SSG prerendered rows, and sitemap entries", async () => {
  const readJson = (path) =>
    readFile(new URL(`../app/data/${path}`, import.meta.url), "utf8").then(
      JSON.parse,
    );
  const [rebar, beam, products] = await Promise.all([
    readJson("rebar-prices.json"),
    readJson("beam-prices.json"),
    readJson("product-prices.json"),
  ]);

  const subcategoryList = [];
  for (const sub of rebar.categories) {
    subcategoryList.push({
      groupId: "rebar",
      groupLabel: "میلگرد",
      id: sub.id,
      label: sub.label,
    });
  }
  for (const sub of beam.categories) {
    subcategoryList.push({
      groupId: "beam",
      groupLabel: "تیرآهن",
      id: sub.id,
      label: sub.label,
    });
  }
  for (const cat of products.catalogs) {
    const group = productGroups.find((g) => g.id === cat.id);
    for (const sub of cat.categories) {
      subcategoryList.push({
        groupId: cat.id,
        groupLabel: group?.label ?? cat.id,
        id: sub.id,
        label: sub.label,
      });
    }
  }

  assert.equal(subcategoryList.length, 46, "Expected exactly 46 product subcategories");

  const titles = new Set();
  const h1s = new Set();
  const canonicals = new Set();
  const sitemap = await readDist("sitemap.xml");

  for (const sub of subcategoryList) {
    const pagePath = `${sub.groupId}/${sub.id}/index.html`;
    const html = await readDist(pagePath);
    const expectedCanonical = `https://fouladbonyan.com/${sub.groupId}/${sub.id}/`;

    // Title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(titleMatch, `${pagePath} must have a title`);
    assert.match(titleMatch, new RegExp(`قیمت ${sub.label}`));
    titles.add(titleMatch);

    // Canonical
    assert.match(
      html,
      new RegExp(`<link rel="canonical" href="${expectedCanonical}" />`),
      `${pagePath} must have self-referential canonical`,
    );
    canonicals.add(expectedCanonical);

    // Initial dataset attributes
    assert.match(
      html,
      new RegExp(`data-initial-category="${sub.groupId}"`),
      `${pagePath} must set data-initial-category`,
    );
    assert.match(
      html,
      new RegExp(`data-initial-subcategory="${sub.id}"`),
      `${pagePath} must set data-initial-subcategory`,
    );

    // H1
    const h1Match = html.match(/<h1><span>(قیمت روز [^<]+)<\/span><\/h1>/)?.[1];
    assert.ok(h1Match, `${pagePath} must have subcategory H1`);
    assert.match(h1Match, new RegExp(sub.label));
    h1s.add(h1Match);

    // Visual Breadcrumb (3 levels)
    assert.match(
      html,
      /class="breadcrumb-nav"/,
      `${pagePath} must contain visual breadcrumb navigation`,
    );
    assert.match(
      html,
      new RegExp(`href="/${sub.groupId}/"`),
      `${pagePath} visual breadcrumb must link upward to category`,
    );

    // JSON-LD BreadcrumbList (3 items)
    const breadcrumbLdMatch = html.match(
      /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList".*?)<\/script>/,
    )?.[1];
    assert.ok(breadcrumbLdMatch, `${pagePath} must have BreadcrumbList JSON-LD`);
    const breadcrumbLd = JSON.parse(breadcrumbLdMatch);
    assert.equal(
      breadcrumbLd.itemListElement.length,
      3,
      `${pagePath} breadcrumb must have 3 items`,
    );
    assert.equal(breadcrumbLd.itemListElement[0]?.name, "صفحه اصلی");
    assert.equal(breadcrumbLd.itemListElement[1]?.name, sub.groupLabel);
    assert.equal(
      breadcrumbLd.itemListElement[1]?.item,
      `https://fouladbonyan.com/${sub.groupId}/`,
    );
    assert.equal(breadcrumbLd.itemListElement[2]?.name, sub.label);
    assert.equal(breadcrumbLd.itemListElement[2]?.item, expectedCanonical);

    // Meaningful prerendered price / table content
    assert.match(
      html,
      /تومان|تماس بگیرید/,
      `${pagePath} must have prerendered table / price content before JS`,
    );

    // initial-page-data embedded
    assert.match(
      html,
      /<script id="initial-page-data" type="application\/json">/,
      `${pagePath} must embed initial-page-data for fast hydration`,
    );

    // Sitemap entry
    assert.match(
      sitemap,
      new RegExp(`<loc>${expectedCanonical}</loc>`),
      `${pagePath} must be present in sitemap.xml`,
    );
  }

  // Check pairwise uniqueness
  assert.equal(titles.size, 46, "All 46 subcategory titles must be distinct");
  assert.equal(h1s.size, 46, "All 46 subcategory H1s must be distinct");
  assert.equal(canonicals.size, 46, "All 46 subcategory canonicals must be distinct");

  // Sitemap total: 1 home + 8 category + 46 subcategory + 1 contact + 6 info
  // + 1 guide index + 5 guides = 68
  const allLocs = sitemap.match(/<loc>[^<]+<\/loc>/g) ?? [];
  assert.equal(allLocs.length, 68, "Sitemap must contain exactly 68 URLs");

  // Verify NO factory, size, or filter URLs exist in dist
  const distEntries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const htmlFiles = distEntries.filter(
    (f) => f.endsWith("index.html") || f.endsWith(".html"),
  );
  // Expected html files: index.html (1) + 404.html (1) + 8 categories
  // + 46 subcategories + contact (1) + 6 info + guide index (1) + 5 guides = 69
  assert.equal(
    htmlFiles.length,
    69,
    `Expected exactly 69 HTML files across dist, found ${htmlFiles.length}`,
  );
});

/*
 * generate-contact-page.mjs reads dist/index.html *after* the homepage has been
 * prerendered into it, so #root holds a deep tree of nested <div>s. Its lazy
 * `<div id="root">[\s\S]*?</div>` match stopped at the first inner closing tag
 * and left the rest of the homepage sitting after each page's own content:
 * every info page and /contact/ shipped a second <h1> and ~60 KB of the wrong
 * page. Assert against every generated page, not just the ones that regressed.
 */
test("every generated page contains only its own content and exactly one H1", async () => {
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const pages = entries
    .filter((entry) => entry.endsWith("index.html"))
    .map((entry) => entry.split("\\").join("/"));
  // 1 home + 8 category + 46 subcategory + contact + 6 info + 6 guide = 68
  // (404.html is the only other HTML file and has no index.html name).
  assert.equal(pages.length, 68, `expected the full page set, got ${pages.length}`);

  for (const page of pages) {
    const html = await readDist(page);

    const headings = html.match(/<h1[\s>]/g) ?? [];
    assert.equal(
      headings.length,
      1,
      `${page} must contain exactly one <h1>, found ${headings.length}`,
    );

    // #root must close at the end of the body, with nothing stranded after it.
    const afterRoot = html.slice(html.lastIndexOf("</div>") + "</div>".length);
    assert.doesNotMatch(
      afterRoot,
      /<(section|header|footer|main|h1|table)\b/,
      `${page} has page markup stranded after #root closes`,
    );

    // Pages that render ContactPage/InfoPage/GuidePage must carry no trace of
    // the homepage they were cloned from.
    const isAppPage = !/<div id="root"[^>]*\sdata-page=/.test(html);
    if (!isAppPage) {
      for (const marker of [
        'id="overview-table"',
        'class="overview-table"',
        "hero-carousel",
        "steel-price-overview",
        'id="initial-overview-data"',
        'id="initial-page-data"',
        "hero-image-preload",
      ]) {
        assert.ok(
          !html.includes(marker),
          `${page} must not inherit homepage markup (${marker})`,
        );
      }
    }
  }
});

test("F10: editorial guide pages exist with unique metadata, prerendered content, breadcrumbs and sitemap entries", async () => {
  const sitemap = await readDist("sitemap.xml");
  const pages = [
    {
      path: "guide/index.html",
      url: "https://fouladbonyan.com/guide/",
      rootAttributes: 'data-page="guide"',
      seoTitle: guideIndex.seoTitle,
      seoDescription: guideIndex.seoDescription,
      h1: guideIndex.title,
      breadcrumbDepth: 2,
    },
    ...guidePageKeys.map((key) => ({
      path: `guide/${key}/index.html`,
      url: `https://fouladbonyan.com/guide/${key}/`,
      rootAttributes: `data-page="guide" data-guide="${key}"`,
      seoTitle: guidePageDefinitions[key].seoTitle,
      seoDescription: guidePageDefinitions[key].seoDescription,
      h1: guidePageDefinitions[key].title,
      breadcrumbDepth: 3,
    })),
  ];

  const titles = new Set();
  const h1s = new Set();
  const canonicals = new Set();
  const descriptions = new Set();

  for (const page of pages) {
    const html = await readDist(page.path);

    // Unique title / description / canonical
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.equal(title, page.seoTitle, `${page.path} title`);
    titles.add(title);
    assert.match(
      html,
      new RegExp(
        `<link rel="canonical" href="${page.url.replace(/\//g, "\\/")}" />`,
      ),
      `${page.path} must have a self-referential canonical`,
    );
    canonicals.add(page.url);
    const description = html.match(
      /<meta\s+name="description"\s+content="([^"]+)"/,
    )?.[1];
    assert.equal(description, page.seoDescription, `${page.path} description`);
    descriptions.add(description);

    // Exactly one H1, and it is this page's own
    const allH1s = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/g) ?? [];
    assert.equal(allH1s.length, 1, `${page.path} must contain exactly one H1`);
    assert.match(
      html,
      new RegExp(`<h1[^>]*>${page.h1}</h1>`),
      `${page.path} must render its own H1`,
    );
    h1s.add(page.h1);

    // Meaningful content is present before any JavaScript runs
    assert.match(
      html,
      new RegExp(`<div id="root" ${page.rootAttributes}>[\\s\\S]+<\\/div>`),
      `${page.path} #root must be prerendered with content`,
    );
    assert.match(
      html,
      /class="breadcrumb-nav"/,
      `${page.path} must contain DOM breadcrumb navigation`,
    );
    assert.match(
      html,
      /<script id="initial-guide-data" type="application\/json">/,
      `${page.path} must embed the derived reference payload for hydration`,
    );
    // No homepage markup may leak in through the prerender step.
    assert.doesNotMatch(
      html,
      /class="overview-table"|id="overview-table"/,
      `${page.path} must not inherit homepage sections`,
    );

    // BreadcrumbList JSON-LD matching the visible trail
    const breadcrumbLd = JSON.parse(
      html.match(
        /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList".*?)<\/script>/,
      )?.[1],
    );
    assert.equal(
      breadcrumbLd.itemListElement.length,
      page.breadcrumbDepth,
      `${page.path} breadcrumb depth`,
    );
    assert.equal(breadcrumbLd.itemListElement[0].name, "صفحه اصلی");
    assert.equal(breadcrumbLd.itemListElement[1].name, guideIndex.title);
    assert.equal(
      breadcrumbLd.itemListElement.at(-1).item,
      page.url,
      `${page.path} breadcrumb must end on itself`,
    );

    // Guide pages are informational, not Organization/Product carriers
    assert.doesNotMatch(html, /<script id="organization-structured-data"/);
    assert.doesNotMatch(html, /"@type":"FAQPage"/);
    // These pages render no hero, so they must not inherit its preload hint.
    assert.doesNotMatch(
      html,
      /id="hero-image-preload"/,
      `${page.path} must not preload a hero image it never renders`,
    );

    // Sitemap
    assert.match(
      sitemap,
      new RegExp(`<loc>${page.url.replace(/\//g, "\\/")}</loc>`),
      `${page.path} must be listed in the sitemap`,
    );
  }

  assert.equal(titles.size, pages.length, "guide titles must be distinct");
  assert.equal(h1s.size, pages.length, "guide H1s must be distinct");
  assert.equal(canonicals.size, pages.length, "canonicals must be distinct");
  assert.equal(
    descriptions.size,
    pages.length,
    "guide descriptions must be distinct",
  );
});

test("F10: guide content is real reference material linked into the product tree", async () => {
  const rebarChart = await readDist("guide/rebar-weight-chart/index.html");
  const beamChart = await readDist("guide/beam-weight-chart/index.html");
  const ribbedVsPlain = await readDist(
    "guide/ribbed-vs-plain-rebar/index.html",
  );
  const beamTypes = await readDist("guide/ipe-vs-hash-beam/index.html");
  const units = await readDist("guide/units-and-quote-specs/index.html");
  const guideHome = await readDist("guide/index.html");

  // Weight tables are rendered as real tables, in the HTML, with many rows.
  for (const [name, html] of [
    ["rebar-weight-chart", rebarChart],
    ["beam-weight-chart", beamChart],
  ]) {
    assert.match(html, /<table class="guide-table">/, `${name} needs a table`);
    const bodyRows = html.match(/<tr><th scope="row">/g) ?? [];
    assert.ok(
      bodyRows.length >= 9,
      `${name} rendered only ${bodyRows.length} table rows`,
    );
  }

  // The rebar chart states the formula it uses and the branch weight column.
  assert.match(rebarChart, /مجذور قطر \(میلی‌متر\) ÷ ۱۶۲/);
  assert.match(rebarChart, /وزن شاخه ۱۲ متری \(کیلوگرم\)/);
  assert.match(rebarChart, /تعداد شاخه در هر تن/);

  // The beam chart quotes mills by name rather than computing a weight.
  assert.match(beamChart, /class="guide-mill-list"/);
  assert.match(beamChart, /ذوب آهن/);
  // Missing هاش weights are disclosed instead of invented.
  assert.match(beamChart, /چرا جدول وزن هاش اینجا نیست/);

  // Every guide links into the catalog it describes.
  const outboundLinks = [
    ["rebar-weight-chart", rebarChart, ["/rebar/", "/rebar/ribbed/", "/rebar/simple/"]],
    ["beam-weight-chart", beamChart, ["/beam/beam/", "/beam/hash/"]],
    ["ribbed-vs-plain-rebar", ribbedVsPlain, ["/rebar/", "/rebar/ribbed/", "/rebar/simple/"]],
    ["ipe-vs-hash-beam", beamTypes, ["/beam/", "/beam/beam/", "/beam/hash/"]],
    ["units-and-quote-specs", units, ["/quote-process/#quote-form"]],
  ];
  for (const [name, html, hrefs] of outboundLinks) {
    for (const href of hrefs) {
      assert.match(
        html,
        new RegExp(`href="${href.replace(/[/#]/g, (c) => `\\${c}`)}"`),
        `${name} must link to ${href}`,
      );
    }
  }

  // The index links to each guide, and the footer links the index site-wide.
  for (const key of guidePageKeys) {
    assert.match(
      guideHome,
      new RegExp(`href="/guide/${key}/"`),
      `guide index must link to ${key}`,
    );
  }
  for (const [name, html] of [
    ["homepage", await readDist("index.html")],
    ["rebar category", await readDist("rebar/index.html")],
    ["about", await readDist("about/index.html")],
  ]) {
    assert.match(
      html,
      /<a href="\/guide\/">راهنمای فنی و جدول وزن<\/a>/,
      `${name} footer must link to the guide index`,
    );
  }
});

/*
 * F14 — the catalog used to render `filteredFactories.slice(0, 6)`, so a
 * subcategory with more factory groups than that never put the rest into the
 * DOM at all: they appeared only after a click on `.show-more-factories`.
 * "Google Search does not interact with your page", so on /rebar/ribbed/ that
 * left 204 of 265 rows out of the served HTML. Every row now renders and the
 * overflow is hidden with CSS instead. Assert against the built pages, because
 * the whole point is what a crawler receives before any JavaScript runs.
 */
const countRows = (html) => (html.match(/class="rebar-row-group/g) ?? []).length;
const countFactoryCards = (html) =>
  (html.match(/class="factory-price-card[ "]/g) ?? []).length;

async function loadCatalogSubcategories() {
  const readJson = (path) =>
    readFile(new URL(`../app/data/${path}`, import.meta.url), "utf8").then(
      JSON.parse,
    );
  const [rebar, beam, products] = await Promise.all([
    readJson("rebar-prices.json"),
    readJson("beam-prices.json"),
    readJson("product-prices.json"),
  ]);

  const byGroup = new Map([
    ["rebar", rebar.categories],
    ["beam", beam.categories],
    ...products.catalogs.map((catalog) => [catalog.id, catalog.categories]),
  ]);

  return [...byGroup].map(([groupId, categories]) => ({
    groupId,
    categories: categories.map((category) => ({
      id: category.id,
      label: category.label,
      factories: category.factories.length,
      rows: category.factories.reduce(
        (total, factory) => total + factory.rows.length,
        0,
      ),
    })),
  }));
}

test("F14: every row of a subcategory reaches the prerendered HTML", async () => {
  const groups = await loadCatalogSubcategories();
  let truncatedBefore = 0;

  for (const { groupId, categories } of groups) {
    for (const sub of categories) {
      const html = await readDist(`${groupId}/${sub.id}/index.html`);
      const page = `${groupId}/${sub.id}`;

      assert.equal(
        countRows(html),
        sub.rows,
        `${page} must prerender all ${sub.rows} rows, found ${countRows(html)}`,
      );
      assert.equal(
        countFactoryCards(html),
        sub.factories,
        `${page} must prerender all ${sub.factories} factory groups`,
      );

      // The rows the old slice(0, 6) dropped. Any of these still missing means
      // the truncation came back.
      if (sub.factories > 6) {
        truncatedBefore += 1;
        assert.ok(
          countRows(html) > 0,
          `${page} renders no rows at all`,
        );
        assert.match(
          html,
          /class="factory-price-card is-collapsed"/,
          `${page} overflow must be rendered-and-hidden, not unrendered`,
        );
      } else {
        assert.doesNotMatch(
          html,
          /is-collapsed/,
          `${page} fits on screen and must not collapse anything`,
        );
      }
    }

    // A category landing page prerenders its default subcategory in full; the
    // siblings live on their own URLs, linked from the tabs.
    const landingHtml = await readDist(`${groupId}/index.html`);
    assert.ok(
      categories.some((sub) => sub.rows === countRows(landingHtml)),
      `${groupId}/ must prerender one full subcategory, found ${countRows(landingHtml)} rows`,
    );
    for (const sub of categories) {
      assert.match(
        landingHtml,
        new RegExp(`href="/${groupId}/${sub.id}/"`),
        `${groupId}/ must link to its ${sub.id} subcategory rather than hide it behind a tab click`,
      );
    }
  }

  assert.ok(
    truncatedBefore >= 1,
    "expected at least one subcategory with more factory groups than fit on screen",
  );
});

test("F14: collapsed factory groups carry their rows and need no click to exist", async () => {
  // /rebar/ribbed/ is the case the audit measured: 27 factory groups, 265 rows,
  // 61 of which used to be the entire page. Row counts move with every price
  // refresh, so read the expected shape from the snapshot rather than pinning
  // the numbers the audit happened to see.
  const ribbed = (
    await loadCatalogSubcategories()
  )
    .find((group) => group.groupId === "rebar")
    .categories.find((sub) => sub.id === "ribbed");
  assert.ok(
    ribbed.factories > 6,
    "میلگرد آجدار is stocked by far more than six mills; this test is pointless otherwise",
  );

  const html = await readDist("rebar/ribbed/index.html");

  const cards = html.split('<section class="factory-price-card');
  assert.equal(
    cards.length - 1,
    ribbed.factories,
    `all ${ribbed.factories} factory groups must be present`,
  );

  const collapsed = cards.filter((card) => card.startsWith(' is-collapsed"'));
  assert.equal(
    collapsed.length,
    ribbed.factories - 6,
    "every group past the six visible ones must be rendered-then-hidden",
  );
  for (const card of collapsed) {
    assert.match(
      card,
      /class="rebar-row-group/,
      "a collapsed factory group must still contain its price rows",
    );
    assert.match(card, /تومان|تماس بگیرید/, "and their prices");
  }

  assert.equal(countRows(html), ribbed.rows);

  // The control is a visibility toggle over content that is already here.
  assert.match(html, /class="show-more-factories"[^>]*aria-expanded="false"/);
  const listId = html.match(/class="factory-price-list" id="([^"]+)"/)?.[1];
  assert.ok(listId, "the factory list must be addressable");
  assert.match(
    html,
    new RegExp(`aria-controls="${listId}"`),
    "the toggle must point at the list it expands",
  );

  // No JavaScript-only escape hatch: nothing in the served markup defers rows.
  assert.doesNotMatch(html, /data-rows-pending|<template/);
});

test("F14: widening row coverage creates no factory or size URLs", async () => {
  const groups = await loadCatalogSubcategories();
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
    withFileTypes: true,
  });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      `${entry.parentPath ?? entry.path}/${entry.name}`
        .split("\\")
        .join("/")
        .split("/dist/")
        .at(-1),
    );

  for (const { groupId, categories } of groups) {
    const allowed = new Set(categories.map((sub) => sub.id));
    const under = directories.filter((dir) => dir.startsWith(`${groupId}/`));
    for (const dir of under) {
      const segments = dir.split("/");
      assert.equal(
        segments.length,
        2,
        `${dir} is deeper than /group/subcategory/ — no per-factory or per-size tier may be generated`,
      );
      assert.ok(
        allowed.has(segments[1]),
        `${dir} is not a catalog subcategory`,
      );
    }
    assert.equal(under.length, allowed.size);
  }

  const sitemap = await readDist("sitemap.xml");
  const locs = (sitemap.match(/<loc>([^<]+)<\/loc>/g) ?? []).map((loc) =>
    loc.replace(/<\/?loc>/g, ""),
  );
  assert.equal(locs.length, 68, "the sitemap must not grow");
  for (const loc of locs) {
    const depth = loc
      .replace("https://fouladbonyan.com/", "")
      .split("/")
      .filter(Boolean).length;
    assert.ok(depth <= 2, `${loc} is deeper than the two-tier product IA`);
  }
});

test("F5: MegaMenu contains crawlable links for all product groups and subcategories", async () => {
  const homeHtml = await readDist("index.html");

  // All 8 category links exist in mega menu
  for (const group of productGroups) {
    assert.match(
      homeHtml,
      new RegExp(`<a href="/${group.id}/"[^>]*>قیمت ${group.label}</a>`),
      `MegaMenu must contain crawlable anchor link for category ${group.id}`,
    );
  }

  // Check subcategory links in prerendered HTML
  assert.match(
    homeHtml,
    /<a href="\/rebar\/ribbed\/"[^>]*>قیمت میلگرد آجدار<\/a>/,
    "MegaMenu must contain crawlable link for rebar/ribbed",
  );
  assert.match(
    homeHtml,
    /<a href="\/rebar\/simple\/"[^>]*>قیمت میلگرد ساده<\/a>/,
    "MegaMenu must contain crawlable link for rebar/simple",
  );
});




/*
 * F18. The site's CSP is a `<meta>` tag in `index.html` that every generator
 * clones, and it is the only copy — `public/_headers` sets no CSP. Two things
 * used to break against it, silently and in opposite directions: Cloudflare
 * Pages injects its Web Analytics beacon before `</body>` and `script-src`
 * had no origin for it, and every prerendered `GlassSurface`/`LightPillar`
 * shipped a `style` attribute that `style-src 'self'` refused to apply — which
 * dropped the panes' radius, frost and, fatally, their `--filter-id`, so the
 * refractive material never rendered in production at all.
 */
const EXPECTED_CSP =
  "default-src 'self'; " +
  "script-src 'self' https://static.cloudflareinsights.com; " +
  "style-src 'self'; " +
  "img-src 'self' data:; " +
  "font-src 'self'; " +
  "media-src 'self'; " +
  "connect-src 'self'; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'none'";

test("F18: every generated page carries the exact CSP, with the analytics beacon origin and nothing looser", async () => {
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const pages = entries
    .filter((entry) => entry.endsWith("index.html"))
    .map((entry) => entry.split("\\").join("/"));
  assert.equal(pages.length, 68, `expected the full page set, got ${pages.length}`);

  for (const page of pages) {
    const html = await readDist(page);

    const csp = html.match(
      /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
    )?.[1];
    assert.equal(csp, EXPECTED_CSP, `${page} must ship the site CSP verbatim`);

    // The beacon loads from static.cloudflareinsights.com and reports to a
    // relative /cdn-cgi/rum, which the Cloudflare edge answers on our own
    // origin -- so connect-src stays 'self' and no other origin is allowed.
    assert.doesNotMatch(csp, /\*/, `${page} CSP must name no wildcard origin`);
    assert.doesNotMatch(
      csp,
      /'unsafe-inline'|'unsafe-eval'|'unsafe-hashes'/,
      `${page} CSP must not relax script or style execution`,
    );
  }
});

test("F18: no prerendered element carries a style attribute the CSP would refuse", async () => {
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const pages = entries
    .filter((entry) => entry.endsWith("index.html"))
    .map((entry) => entry.split("\\").join("/"));

  for (const page of pages) {
    const html = await readDist(page);
    const inlineStyles = html.match(/<[a-zA-Z][^>]*\sstyle="[^"]*"/g) ?? [];
    assert.deepEqual(
      inlineStyles,
      [],
      `${page} would emit ${inlineStyles.length} blocked inline style(s): ${inlineStyles.join(" | ")}`,
    );
  }
});

test("F18: the glass panes get their box and material from the stylesheet, not from a style attribute", async () => {
  const cssName = (await readdir(new URL("../dist/assets", import.meta.url)))
    .find((file) => file.endsWith(".css"));
  const css = await readDist(`assets/${cssName}`);

  // Every declaration the minifier left on a rule whose selector list names
  // exactly this class. The minifier drops leading zeroes, so compare numbers
  // rather than the literal text it emitted.
  const declarationsFor = (className) => {
    const found = [];
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (selectors.split(",").some((one) => one.trim() === className)) {
        found.push(...body.split(";"));
      }
    }
    return new Map(
      found
        .map((declaration) => declaration.split(":"))
        .filter((pair) => pair.length === 2)
        .map(([property, value]) => [property.trim(), value.trim()]),
    );
  };

  // GlassSurface reads the applied radius back out of the cascade to corner
  // its displacement map, so a missing rule here silently squares the glass.
  for (const [className, radius, frost, saturation] of [
    [".fg-glass", 18, 0.03, 0.92],
    [".fg-pill", 13, 0.02, 0.94],
    [".fg-chip", 11, 0.02, 0.94],
  ]) {
    const declarations = declarationsFor(className);
    assert.ok(
      declarations.size > 0,
      `${className} must have a rule carrying the pane's box and material`,
    );
    assert.equal(
      declarations.get("border-radius"),
      `${radius}px`,
      `${className} radius must come from the stylesheet`,
    );
    assert.equal(
      Number(declarations.get("--glass-frost")),
      frost,
      `${className} frost must come from the stylesheet`,
    );
    assert.equal(
      Number(declarations.get("--glass-saturation")),
      saturation,
      `${className} saturation must come from the stylesheet`,
    );
  }
});
