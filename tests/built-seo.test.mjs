import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  productGroups,
  singleSubcategoryGroupIds,
  subcategoryHref,
} from "../app/category-meta.ts";
import {
  loadGroupCatalogs,
  parseBreadcrumbLd,
  readDist,
  readJson,
} from "./helpers/dist.mjs";

const SITE_ORIGIN = "https://fouladbonyan.com";

/** Every generated HTML file in dist, as forward-slashed relative paths. */
async function distHtmlFiles() {
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  return entries
    .filter((entry) => entry.endsWith(".html"))
    .map((entry) => entry.split("\\").join("/"))
    .sort();
}

/** Collapse a tag that the template wraps across several lines. */
const flat = (html) => html.replace(/\s+/g, " ");

const metaContent = (html, attribute, value) =>
  flat(html).match(
    new RegExp(`<meta ${attribute}="${value}" content="([^"]*)"`),
  )?.[1] ?? null;

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

    const breadcrumbLd = parseBreadcrumbLd(
      html,
      `${category.id} should emit BreadcrumbList structured data`,
    );
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

test("F5: subcategory landing pages have unique metadata, crawlable breadcrumbs, SSG prerendered rows, and sitemap entries", async () => {
  const snapshot = await readJson("catalog-prices.json");

  const subcategoryList = [];
  for (const catalog of snapshot.catalogs) {
    if (catalog.id === "angle" || catalog.id === "channel") continue;
    const group = productGroups.find((g) => g.id === catalog.id);
    for (const sub of catalog.categories) {
      subcategoryList.push({
        groupId: catalog.id,
        groupLabel: group?.label ?? catalog.id,
        id: sub.id,
        label: sub.label,
      });
    }
  }

  assert.equal(subcategoryList.length, 44, "Expected exactly 44 product subcategories");

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
    const breadcrumbLd = parseBreadcrumbLd(
      html,
      `${pagePath} must have BreadcrumbList JSON-LD`,
    );
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
  assert.equal(titles.size, 44, "All 44 subcategory titles must be distinct");
  assert.equal(h1s.size, 44, "All 44 subcategory H1s must be distinct");
  assert.equal(canonicals.size, 44, "All 44 subcategory canonicals must be distinct");

  // Sitemap total: 1 home + 8 category + 44 subcategory + 1 contact + 6 info
  // + 1 guide index + 5 guides = 66
  const allLocs = sitemap.match(/<loc>[^<]+<\/loc>/g) ?? [];
  assert.equal(allLocs.length, 66, "Sitemap must contain exactly 66 URLs");

  // Verify permanent redirect stubs for single subcategories
  for (const group of ["angle", "channel"]) {
    const redirectHtml = await readDist(`${group}/${group}/index.html`);
    assert.match(
      redirectHtml,
      new RegExp(`<meta http-equiv="refresh" content="0; url=https://fouladbonyan\\.com/${group}/"`),
      `${group}/${group} must have meta refresh redirect to parent /${group}/`,
    );
    assert.match(
      redirectHtml,
      new RegExp(`<link rel="canonical" href="https://fouladbonyan\\.com/${group}/"`),
      `${group}/${group} must have canonical pointing to parent /${group}/`,
    );
    assert.match(
      redirectHtml,
      /<meta name="robots" content="noindex, follow"/,
      `${group}/${group} redirect stub must be noindex, follow`,
    );
    assert.doesNotMatch(
      sitemap,
      new RegExp(`<loc>https://fouladbonyan\\.com/${group}/${group}/</loc>`),
      `${group}/${group} must not be present in sitemap.xml`,
    );
  }

  // Verify NO factory, size, or filter URLs exist in dist
  const distEntries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const htmlFiles = distEntries.filter(
    (f) => f.endsWith("index.html") || f.endsWith(".html"),
  );
  // Expected html files: index.html (1) + 404.html (1) + 8 categories
  // + 44 subcategories + 2 redirect stubs + contact (1) + 6 info + guide index (1) + 5 guides = 69
  assert.equal(
    htmlFiles.length,
    69,
    `Expected exactly 69 HTML files across dist, found ${htmlFiles.length}`,
  );
});

/*
 * Previously, separate generator scripts read dist/index.html after the homepage
 * had already been prerendered into it, risking nested markup if a lazy match
 * stopped at an inner closing tag. Prerender pipeline transforms from pristine
 * template and renders each page in a clean pass. Assert against every generated page.
 */
test("every generated page contains only its own content and exactly one H1", async () => {
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const pages = entries
    .filter((entry) => entry.endsWith("index.html"))
    .map((entry) => entry.split("\\").join("/"))
    .filter((p) => !p.endsWith("angle/angle/index.html") && !p.endsWith("channel/channel/index.html"));
  // 1 home + 8 category + 44 subcategory + contact + 6 info + 6 guide = 66
  // (404.html is the only other HTML file and has no index.html name; angle/angle and channel/channel are redirect stubs).
  assert.equal(pages.length, 66, `expected the full page set, got ${pages.length}`);

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

test("F5: MegaMenu contains crawlable links for all product groups and subcategories", async () => {
  const snapshot = await readJson("catalog-prices.json");

  // All 8 category links exist in mega menu on the homepage
  const homeHtml = await readDist("index.html");
  for (const group of productGroups) {
    assert.match(
      homeHtml,
      new RegExp(`<a href="/${group.id}/"[^>]*>قیمت ${group.label}</a>`),
      `MegaMenu must contain crawlable anchor link for category ${group.id}`,
    );
  }

  // Across product group landing pages, verify MegaMenu renders all real subcategories and correct single-category links
  for (const group of productGroups) {
    const groupHtml = await readDist(`${group.id}/index.html`);
    const catalog = snapshot.catalogs.find((c) => c.id === group.id);
    assert.ok(catalog, `catalog for ${group.id} must exist in snapshot`);

    if (group.id === "angle" || group.id === "channel") {
      // Single subcategory groups link directly to parent category
      assert.match(
        groupHtml,
        new RegExp(`<a href="/${group.id}/"[^>]*>قیمت ${group.label}</a>`),
        `MegaMenu on ${group.id} must link directly to /${group.id}/ for single subcategory`,
      );
      assert.match(
        groupHtml,
        new RegExp(`<a href="/${group.id}/\\?factory=`),
        `MegaMenu on ${group.id} must have factory filter link pointing to /${group.id}/`,
      );
      assert.match(
        groupHtml,
        new RegExp(`<a href="/${group.id}/\\?size=`),
        `MegaMenu on ${group.id} must have size filter link pointing to /${group.id}/`,
      );
    } else {
      // Multi-category groups render links for every real subcategory
      for (const sub of catalog.categories) {
        assert.match(
          groupHtml,
          new RegExp(`<a href="/${group.id}/${sub.id}/"[^>]*>قیمت ${sub.label}</a>`),
          `MegaMenu on ${group.id} must contain crawlable link for subcategory ${group.id}/${sub.id}`,
        );
      }
    }
  }
});

/*
 * Title collisions are invisible to the two metadata tests above because each
 * checks uniqueness only within its own page type (8 category titles against
 * each other, 46 subcategory titles against each other) -- a category page
 * and its own subcategory can carry the exact same <title> and neither test
 * notices. /channel/ and /channel/channel/ did exactly this. Check every
 * indexable generated page's <title> against every other one, regardless of
 * type.
 */
test("every generated page has a globally unique <title>", async () => {
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const pages = entries
    .filter((entry) => entry.endsWith("index.html"))
    .map((entry) => entry.split("\\").join("/"));

  const titlesByPage = new Map();
  for (const page of pages) {
    const html = await readDist(page);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title, `${page} must have a <title>`);
    titlesByPage.set(page, title);
  }

  const pagesByTitle = new Map();
  for (const [page, title] of titlesByPage) {
    const existing = pagesByTitle.get(title);
    if (existing) existing.push(page);
    else pagesByTitle.set(title, [page]);
  }

  const duplicates = [...pagesByTitle.entries()].filter(
    ([, pagesForTitle]) => pagesForTitle.length > 1,
  );
  assert.deepEqual(
    duplicates,
    [],
    `Duplicate <title> across page types: ${duplicates
      .map(([title, pagesForTitle]) => `"${title}" -> ${pagesForTitle.join(", ")}`)
      .join("; ")}`,
  );
});

/*
 * A category landing page (e.g. /channel/) used to silently render the same
 * PriceCatalog table as its first subcategory (e.g. /channel/channel/) --
 * identical row count, identical prices, near-duplicate content on two
 * indexable URLs. It must now render CategoryOverview instead: a distinct
 * per-subcategory summary that links onward to every one of the group's
 * subcategory pages, which keep the full PriceCatalog table to themselves.
 */
test("category landing pages render a distinct overview and link to every subcategory", async () => {
  const catalogs = await loadGroupCatalogs();

  for (const catalog of catalogs) {
    const html = await readDist(`${catalog.id}/index.html`);

    if (catalog.id === "angle" || catalog.id === "channel") {
      // Single subcategory families consolidate directly on parent category
      assert.match(
        html,
        /class="rebar-prices"/,
        `${catalog.id}/ must render the full PriceCatalog table as the primary price page`,
      );
      assert.doesNotMatch(
        html,
        /class="overview-table"/,
        `${catalog.id}/ must not render CategoryOverview table`,
      );
    } else {
      assert.match(
        html,
        /class="overview-table"/,
        `${catalog.id}/ must render CategoryOverview's summary table`,
      );
      assert.doesNotMatch(
        html,
        /class="rebar-prices"/,
        `${catalog.id}/ must not render the full PriceCatalog table (that belongs to its subcategory pages only)`,
      );

      for (const sub of catalog.categories) {
        assert.match(
          html,
          new RegExp(`href="/${catalog.id}/${sub.id}/"`),
          `${catalog.id}/ must link to its subcategory ${catalog.id}/${sub.id}/`,
        );
      }

      // The reverse must still hold: subcategory pages keep their own full
      // table and never fall back to the group overview.
      for (const sub of catalog.categories) {
        const subHtml = await readDist(`${catalog.id}/${sub.id}/index.html`);
        assert.match(
          subHtml,
          /class="rebar-prices"/,
          `${catalog.id}/${sub.id}/ must render the full PriceCatalog table`,
        );
        assert.doesNotMatch(
          subHtml,
          /id="category-overview"/,
          `${catalog.id}/${sub.id}/ must not render CategoryOverview`,
        );
      }
    }
  }
});

test("homepage emits WebSite structured data and Organization schema with factual GeoCoordinates", async () => {
  const homeHtml = await readDist("index.html");

  // WebSite JSON-LD
  assert.match(
    homeHtml,
    /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"WebSite"/,
    "Homepage must contain WebSite JSON-LD",
  );
  assert.match(
    homeHtml,
    /"name":"بنیان فولاد داریا"/,
    "WebSite JSON-LD must contain brand name",
  );

  // Organization JSON-LD with location Place, geo and hasMap
  assert.match(
    homeHtml,
    /"location":\{"@type":"Place"/,
    "Organization schema must represent office location as a Place entity",
  );
  assert.match(
    homeHtml,
    /"@type":"GeoCoordinates","latitude":35\.817127,"longitude":51\.4809619/,
    "Organization schema location must contain factual GeoCoordinates",
  );
  assert.match(
    homeHtml,
    /"hasMap":"https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=35\.817127,51\.4809619"/,
    "Organization schema location must contain factual Google Maps URL",
  );

  // Apple touch icon
  assert.match(
    homeHtml,
    /<link rel="apple-touch-icon" href="\/favicon\.png" sizes="256x256" \/>/,
    "Homepage must include apple-touch-icon link",
  );

  // MarketPrices stable heading
  assert.match(
    homeHtml,
    /<h2 id="market-prices-title"[^>]*>زمینه بازار، کنار قیمت فولاد<\/h2>/,
    "Homepage MarketPrices must render stable meaningful H2 during SSR",
  );
});

test("guide pages emit Article structured data with factual publication and modification dates, publisher, and image", async () => {
  const guidePages = [
    "guide/rebar-weight-chart/index.html",
    "guide/beam-weight-chart/index.html",
    "guide/ribbed-vs-plain-rebar/index.html",
    "guide/ipe-vs-hash-beam/index.html",
    "guide/units-and-quote-specs/index.html",
  ];

  for (const pagePath of guidePages) {
    const html = await readDist(pagePath);
    assert.match(
      html,
      /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"Article"/,
      `${pagePath} must contain Article JSON-LD`,
    );
    assert.match(
      html,
      /"datePublished":"2026-08-17"/,
      `${pagePath} must contain the Git-sourced first-publication date`,
    );
    assert.match(
      html,
      /"dateModified":"2026-08-17"/,
      `${pagePath} must contain factual lastmod as dateModified`,
    );
    assert.match(
      html,
      /"image":\["https:\/\/fouladbonyan\.com\/[^"]+"\]/,
      `${pagePath} must contain factual representative image`,
    );
    assert.match(
      html,
      /"inLanguage":"fa"/,
      `${pagePath} must specify Persian language`,
    );
    assert.match(
      html,
      /"name":"بنیان فولاد داریا"/,
      `${pagePath} must credit Bonyan Foulad Daria as author/publisher`,
    );
  }
});

test("category and subcategory pages use category-specific og:image and distinct H2", async () => {
  const rebarHtml = await readDist("rebar/index.html");
  assert.match(
    rebarHtml,
    /<meta\s+property="og:image"\s+content="https:\/\/fouladbonyan\.com\/categories\/hero-rebar-1280\.jpg"/,
    "rebar landing page must use hero-rebar-1280.jpg as og:image",
  );
  assert.match(
    rebarHtml,
    /<meta\s+name="twitter:image"\s+content="https:\/\/fouladbonyan\.com\/categories\/hero-rebar-1280\.jpg"/,
    "rebar landing page must use hero-rebar-1280.jpg as twitter:image",
  );

  const ribbedHtml = await readDist("rebar/ribbed/index.html");
  assert.match(
    ribbedHtml,
    /<meta\s+property="og:image"\s+content="https:\/\/fouladbonyan\.com\/categories\/hero-rebar-1280\.jpg"/,
    "rebar/ribbed page must use hero-rebar-1280.jpg as og:image",
  );

  // H1 and H2 distinctness on subcategory page
  const h1Match = ribbedHtml.match(/<h1><span>([^<]+)<\/span><\/h1>/)?.[1];
  assert.equal(h1Match, "قیمت روز میلگرد آجدار");
  assert.match(
    ribbedHtml,
    /<h2>جدول قیمت و مشخصات فنی میلگرد آجدار<\/h2>/,
    "rebar/ribbed must use descriptive table-specific H2 distinct from H1",
  );

  // Guide cross-links on rebar and beam
  assert.match(
    rebarHtml,
    /href="\/guide\/rebar-weight-chart\/"/,
    "rebar overview must link to rebar weight chart guide",
  );
  const beamHtml = await readDist("beam/index.html");
  assert.match(
    beamHtml,
    /href="\/guide\/beam-weight-chart\/"/,
    "beam overview must link to beam weight chart guide",
  );
});

/*
 * The template ships /og.png and hardcodes its 1730x909 into og:image:width and
 * og:image:height. When category pages started overriding og:image with a
 * 1280x720 hero, only the URL moved -- so 52 pages advertised dimensions that
 * belonged to a different file, and every existing og:image assertion still
 * passed because they all checked the URL alone. Read the real pixels back.
 */
test("every page's declared og:image dimensions match the image it actually points at", async () => {
  const files = await distHtmlFiles();
  const measured = new Map();

  const measure = async (imageUrl) => {
    assert.ok(
      imageUrl.startsWith(`${SITE_ORIGIN}/`),
      `og:image must be an absolute URL on this origin, got "${imageUrl}"`,
    );
    const relative = imageUrl.slice(SITE_ORIGIN.length + 1);
    if (!measured.has(relative)) {
      const bytes = await readFile(
        new URL(`../dist/${relative}`, import.meta.url),
      );
      const { width, height } = await sharp(bytes).metadata();
      measured.set(relative, { width, height });
    }
    return measured.get(relative);
  };

  let checked = 0;
  for (const file of files) {
    const html = await readDist(file);
    const image = metaContent(html, "property", "og:image");
    const twitterImage = metaContent(html, "name", "twitter:image");
    if (!image) {
      // 404.html and the two redirect stubs carry no social card at all.
      assert.match(
        file,
        /^(404\.html|angle\/angle\/index\.html|channel\/channel\/index\.html)$/,
        `${file} is missing og:image`,
      );
      continue;
    }

    assert.equal(
      twitterImage,
      image,
      `${file}: twitter:image must be the same file as og:image`,
    );

    const declaredWidth = metaContent(html, "property", "og:image:width");
    const declaredHeight = metaContent(html, "property", "og:image:height");
    assert.ok(
      declaredWidth && declaredHeight,
      `${file} must declare og:image dimensions`,
    );

    const actual = await measure(image);
    assert.equal(
      Number(declaredWidth),
      actual.width,
      `${file}: og:image:width says ${declaredWidth} but ${image} is ${actual.width}px wide`,
    );
    assert.equal(
      Number(declaredHeight),
      actual.height,
      `${file}: og:image:height says ${declaredHeight} but ${image} is ${actual.height}px tall`,
    );
    checked += 1;
  }

  assert.equal(checked, 66, "every indexable page must have been checked");
  // Guards the swap this test exists for: the catalog hero really is a
  // different size from the template's /og.png default.
  assert.deepEqual(measured.get("og.png"), { width: 1730, height: 909 });
  assert.deepEqual(measured.get("categories/hero-rebar-1280.jpg"), {
    width: 1280,
    height: 720,
  });
});

/*
 * /angle/angle/ and /channel/channel/ are noindex redirect stubs. Three href
 * builders open-coded `/${group}/${sub}/` without the collapse rule, so the
 * catalog tab bar on /angle/ and the product list on
 * /guide/units-and-quote-specs/ both pointed at them -- and built-links.test.mjs
 * did not notice, because it only asks whether a link resolves to a file, and a
 * stub is a file. Ask whether the target is indexable.
 */
test("no indexable page links to a noindex or redirecting URL", async () => {
  const files = await distHtmlFiles();
  const byPathname = new Map();
  for (const file of files) {
    const html = await readDist(file);
    const pathname =
      file === "index.html" ? "/" : `/${file.replace(/index\.html$/, "")}`;
    byPathname.set(pathname, html);
  }

  const isIndexable = (html) =>
    !/<meta name="robots" content="[^"]*noindex/.test(html) &&
    !/<meta http-equiv="refresh"/i.test(html);

  const failures = [];
  let checkedLinks = 0;

  for (const [pathname, html] of byPathname) {
    if (!isIndexable(html)) continue;
    for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
      const href = match[1].replaceAll("&amp;", "&");
      if (/^(?:tel:|mailto:)/i.test(href)) continue;
      const target = new URL(href, `${SITE_ORIGIN}${pathname}`);
      if (target.origin !== SITE_ORIGIN) continue;
      const targetHtml = byPathname.get(target.pathname);
      if (!targetHtml) continue; // built-links.test.mjs owns missing routes
      checkedLinks += 1;
      if (!isIndexable(targetHtml)) {
        failures.push(`${pathname} -> ${href}`);
      }
    }
  }

  assert.ok(checkedLinks > 1_000, "the audit should cover the full link graph");
  assert.deepEqual(
    failures,
    [],
    "indexable pages must link at the canonical URL, never at a redirect stub",
  );
});

/*
 * The row-level quote action carried its prefill as `?product=&dimensions=`,
 * which put a distinct crawlable URL on every one of the ~2,100 price rows,
 * all canonicalising back to one page. It is still an anchor -- it goes to a
 * real page, and has to work without JavaScript -- but the prefill now travels
 * in sessionStorage (app/quote-handoff.ts), so every row shares one clean href.
 */
test("no built page emits a parameterised quote URL", async () => {
  const files = await distHtmlFiles();
  const offenders = [];
  let quoteLinks = 0;

  for (const file of files) {
    const html = await readDist(file);
    for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
      const href = match[1].replaceAll("&amp;", "&");
      if (!href.includes("/quote-process/")) continue;
      quoteLinks += 1;
      if (/[?&](?:product|dimensions)=/.test(href)) {
        offenders.push(`${file} -> ${href.slice(0, 80)}`);
      }
    }
  }

  assert.ok(quoteLinks > 0, "the quote flow must still be linked");
  assert.deepEqual(offenders.slice(0, 5), []);
  assert.equal(offenders.length, 0);

  // Every row still offers the action, as a plain anchor a crawler and a
  // no-JavaScript visitor can both follow, and they all share one href.
  const ribbed = await readDist("rebar/ribbed/index.html");
  const rowLinks = [
    ...ribbed.matchAll(
      /<td[^>]*class="row-quote-cell"[^>]*>\s*<a\b[^>]*\bhref="([^"]+)"/g,
    ),
  ].map((match) => match[1]);

  assert.ok(
    rowLinks.length > 100,
    `every price row must keep its quote action, found ${rowLinks.length}`,
  );
  assert.deepEqual(
    [...new Set(rowLinks)],
    ["/quote-process/#quote-form"],
    "every row must point at the single clean quote URL",
  );

  // The rows are told apart by their accessible name, not by their href.
  const labelled = ribbed.match(
    /<td[^>]*class="row-quote-cell"[^>]*><a href="\/quote-process\/#quote-form" aria-label="[^"]+"/g,
  );
  assert.equal(
    labelled?.length,
    rowLinks.length,
    "each row's quote link must carry its own aria-label",
  );
});

/*
 * The `?factory=` and `?size=` links are the legitimate query URLs that remain:
 * a factory or a size has no page of its own. Their values are Persian mill and
 * size names, so they have to survive percent-encoding intact.
 */
test("every remaining query URL is correctly encoded and round-trips", async () => {
  const files = await distHtmlFiles();
  let checked = 0;

  for (const file of files) {
    const html = await readDist(file);
    for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
      const href = match[1].replaceAll("&amp;", "&");
      if (!href.includes("?")) continue;
      // Only our own URLs: an outbound map or source link is not ours to
      // re-encode, and its query legitimately carries characters like ",".
      if (!href.startsWith("/")) continue;
      const [path, query] = href.split("?");

      // The set encodeURIComponent leaves alone (RFC 3986 unreserved plus the
      // sub-delims it permits, so "?size=10*10" is correct as written), the
      // "%" of an escape, and the separators. Anything else -- a raw space or
      // a raw Persian mill name -- means the value was never encoded.
      assert.doesNotMatch(
        query,
        /[^A-Za-z0-9\-._~!*'()%&=+#]/,
        `${file}: "${href}" carries a raw character that must be percent-encoded`,
      );

      const params = new URLSearchParams(query.split("#")[0]);
      for (const [key, value] of params) {
        assert.ok(
          ["factory", "size"].includes(key),
          `${file}: unexpected query parameter "${key}" on ${path}`,
        );
        assert.ok(
          value.length > 0,
          `${file}: "${key}" decoded to an empty value on ${path}`,
        );
        // Re-encoding what came back must reproduce what shipped.
        assert.ok(
          query.includes(encodeURIComponent(value)),
          `${file}: "${value}" is not encoded as encodeURIComponent would encode it`,
        );
        checked += 1;
      }
    }
  }

  assert.ok(
    checked > 100,
    `expected the mega-menu filter links, saw ${checked}`,
  );
});

/*
 * public/_redirects and REDIRECT_ROUTES describe the same two collapsed URLs
 * from opposite ends of the build. They were written out by hand in both
 * places, plus a third time as the `angle`/`channel` literal in three modules.
 * category-meta owns the rule now; this checks the static file still agrees.
 */
test("public/_redirects covers exactly the collapsed subcategory URLs", async () => {
  const redirects = await readDist("_redirects");
  const rules = redirects
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  assert.equal(
    rules.length,
    singleSubcategoryGroupIds.length,
    `_redirects has ${rules.length} rules for ${singleSubcategoryGroupIds.length} collapsed groups`,
  );

  for (const groupId of singleSubcategoryGroupIds) {
    const from = `/${groupId}/${groupId}/`;
    const to = subcategoryHref(groupId);
    assert.ok(
      rules.includes(`${from} ${to} 301`),
      `_redirects must contain "${from} ${to} 301"`,
    );

    // The stub itself must still be there, still noindex, still pointing home.
    const stub = await readDist(`${groupId}/${groupId}/index.html`);
    assert.match(stub, /<meta name="robots" content="noindex, follow"/);
    assert.match(
      stub,
      new RegExp(`<link rel="canonical" href="${SITE_ORIGIN}${to}"`),
    );
  }
});

/*
 * og:type has to agree with the structured data on the page: the five guide
 * articles emit Article JSON-LD, everything else is a website.
 */
test("og:type is article exactly on the pages that emit Article JSON-LD", async () => {
  const files = await distHtmlFiles();
  const articleTyped = [];
  const articleSchema = [];

  for (const file of files) {
    const html = await readDist(file);
    if (metaContent(html, "property", "og:type") === "article") {
      articleTyped.push(file);
    }
    if (/"@type":"Article"/.test(html)) articleSchema.push(file);
  }

  const expected = [
    "guide/beam-weight-chart/index.html",
    "guide/ipe-vs-hash-beam/index.html",
    "guide/rebar-weight-chart/index.html",
    "guide/ribbed-vs-plain-rebar/index.html",
    "guide/units-and-quote-specs/index.html",
  ];
  assert.deepEqual(articleSchema.sort(), expected);
  assert.deepEqual(articleTyped.sort(), expected);

  // The guide index lists the articles; it is not one of them.
  const guideIndex = await readDist("guide/index.html");
  assert.equal(metaContent(guideIndex, "property", "og:type"), "website");
});

/*
 * The two hero spans are display:block, so the space between them collapses
 * visually -- but without it the H1's textContent reads "...فولاد؛بنیان...".
 */
test("the homepage H1 keeps a whitespace boundary between its two lines", async () => {
  const html = await readDist("index.html");
  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1];
  assert.ok(h1, "the homepage must have an H1");

  const text = h1
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  assert.equal(text, "قیمت روز آهن و فولاد؛ بنیان فولاد داریا");
  assert.doesNotMatch(text, /؛بنیان/, "the two lines must not run together");
});
