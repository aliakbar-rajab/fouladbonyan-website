import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile, stat } from "node:fs/promises";
import sharp from "sharp";
import {
  catalogRedirectRules,
  isConsolidatedSubcategory,
  productGroups,
  rendersCatalogOnGroupRoute,
  subcategoryHref,
} from "../app/category-meta.ts";
import { siteConfig } from "../app/site-config.ts";
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
    const group = productGroups.find((g) => g.id === catalog.id);
    for (const sub of catalog.categories) {
      if (isConsolidatedSubcategory(catalog.id, sub.id)) continue;
      subcategoryList.push({
        groupId: catalog.id,
        groupLabel: group?.label ?? catalog.id,
        id: sub.id,
        label: sub.label,
      });
    }
  }

  assert.equal(subcategoryList.length, 43, "Expected exactly 43 product subcategories");

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
    assert.match(titleMatch, new RegExp(`قیمت (?:روز )?${sub.label}`));
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
  assert.equal(titles.size, 43, "All 43 subcategory titles must be distinct");
  assert.equal(h1s.size, 43, "All 43 subcategory H1s must be distinct");
  assert.equal(canonicals.size, 43, "All 43 subcategory canonicals must be distinct");

  // Sitemap total: 1 home + 8 category + 43 subcategory + 1 contact + 2 indexable info
  // (about, quote-process) + 1 guide index + 5 guides = 61 (4 legal/utility pages are noindex)
  const allLocs = sitemap.match(/<loc>[^<]+<\/loc>/g) ?? [];
  assert.equal(allLocs.length, 61, "Sitemap must contain exactly 61 indexable URLs");

  const homeHtmlForFooter = await readDist("index.html");
  for (const noindexInfo of ["terms", "privacy", "complaints", "shipping-delivery"]) {
    const infoHtml = await readDist(`${noindexInfo}/index.html`);
    assert.equal(
      metaContent(infoHtml, "name", "robots"),
      "noindex, follow",
      `${noindexInfo}/ must emit noindex, follow`,
    );
    assert.doesNotMatch(
      sitemap,
      new RegExp(`<loc>https://fouladbonyan\\.com/${noindexInfo}/</loc>`),
      `${noindexInfo}/ must not be present in sitemap.xml`,
    );
    assert.match(
      homeHtmlForFooter,
      new RegExp(`href="/${noindexInfo}/"`),
      `${noindexInfo}/ must stay accessible in footer links`,
    );
  }
  for (const indexedInfo of ["about", "quote-process"]) {
    const infoHtml = await readDist(`${indexedInfo}/index.html`);
    assert.equal(
      metaContent(infoHtml, "name", "robots"),
      "index, follow",
      `${indexedInfo}/ must remain indexable`,
    );
    assert.match(
      sitemap,
      new RegExp(`<loc>https://fouladbonyan\\.com/${indexedInfo}/</loc>`),
      `${indexedInfo}/ must be present in sitemap.xml`,
    );
  }

  // Verify permanent redirect stubs for consolidated / renamed routes
  for (const rule of catalogRedirectRules) {
    const from = `/${rule.fromPath.join("/")}/`;
    const to = rule.toPath;
    const stubRel = `${rule.fromPath.join("/")}/index.html`;
    const redirectHtml = await readDist(stubRel);
    assert.match(
      redirectHtml,
      new RegExp(`<meta http-equiv="refresh" content="0; url=https://fouladbonyan\\.com${to}"`),
      `${from} must have meta refresh redirect to ${to}`,
    );
    assert.match(
      redirectHtml,
      new RegExp(`<link rel="canonical" href="https://fouladbonyan\\.com${to}"`),
      `${from} must have canonical pointing to ${to}`,
    );
    assert.match(
      redirectHtml,
      /<meta name="robots" content="noindex, follow"/,
      `${from} redirect stub must be noindex, follow`,
    );
    assert.doesNotMatch(
      sitemap,
      new RegExp(`<loc>https://fouladbonyan\\.com${from}</loc>`),
      `${from} must not be present in sitemap.xml`,
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
  // + 43 subcategories + 4 redirect stubs + contact (1) + 6 info + guide index (1) + 5 guides = 70
  assert.equal(
    htmlFiles.length,
    70,
    `Expected exactly 70 HTML files across dist, found ${htmlFiles.length}`,
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
  const redirectStubPaths = new Set(
    catalogRedirectRules.map((r) => `${r.fromPath.join("/")}/index.html`),
  );
  const pages = entries
    .filter((entry) => entry.endsWith("index.html"))
    .map((entry) => entry.split("\\").join("/"))
    .filter((p) => !redirectStubPaths.has(p));
  // 1 home + 8 category + 43 subcategory + contact + 6 info + 6 guide = 65
  // (404.html is the only other HTML file and has no index.html name; 4 redirect stubs excluded).
  assert.equal(pages.length, 65, `expected the full page set, got ${pages.length}`);

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
      // Single subcategory groups link directly to parent category, while
      // factory and size quick-picks render as sessionStorage buttons.
      assert.match(
        groupHtml,
        new RegExp(`<a href="/${group.id}/"[^>]*>قیمت ${group.label}</a>`),
        `MegaMenu on ${group.id} must link directly to /${group.id}/ for single subcategory`,
      );
      assert.doesNotMatch(
        groupHtml,
        new RegExp(`<a href="/${group.id}/\\?(?:factory|size)=`),
        `MegaMenu on ${group.id} must not emit query-string factory or size links`,
      );
      assert.match(
        groupHtml,
        /<section class="mega-rebar-factories"[\s\S]*?<button type="button"/,
        `MegaMenu on ${group.id} must render button quick-picks for factories`,
      );
      assert.match(
        groupHtml,
        /<section class="mega-rebar-sizes"[\s\S]*?<button type="button"/,
        `MegaMenu on ${group.id} must render button quick-picks for sizes`,
      );
    } else {
      // Multi-category groups render links for every subcategory via subcategoryHref()
      // (so consolidated subcategories such as beam/beam link directly to /beam/).
      for (const sub of catalog.categories) {
        const expectedHref = subcategoryHref(group.id, sub.id);
        assert.match(
          groupHtml,
          new RegExp(`<a href="${expectedHref}"[^>]*>قیمت ${sub.label}</a>`),
          `MegaMenu on ${group.id} must contain crawlable link ${expectedHref} for subcategory ${group.id}/${sub.id}`,
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

    if (rendersCatalogOnGroupRoute(catalog.id)) {
      // Consolidated families (angle, channel, beam) render their primary PriceCatalog
      // directly on the parent route, with /beam/ also linking cleanly to /beam/hash/.
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
      for (const sub of catalog.categories) {
        if (!isConsolidatedSubcategory(catalog.id, sub.id)) {
          assert.match(
            html,
            new RegExp(`href="/${catalog.id}/${sub.id}/"`),
            `${catalog.id}/ must link to its non-consolidated subcategory ${catalog.id}/${sub.id}/`,
          );
          const subHtml = await readDist(`${catalog.id}/${sub.id}/index.html`);
          assert.match(
            subHtml,
            /class="rebar-prices"/,
            `${catalog.id}/${sub.id}/ must render the full PriceCatalog table`,
          );
        }
      }
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

test("homepage @graph links WebSite and Organization corroborated by visible addresses on / and /contact/, and catalog routes emit CollectionPage", async () => {
  const homeHtml = await readDist("index.html");
  const contactHtml = await readDist("contact/index.html");
  const aboutHtml = await readDist("about/index.html");
  const parseJsonLd = (html) =>
    [...html.matchAll(/<script\b[^>]*\btype="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(
      ([, body]) => JSON.parse(body),
    );
  const homeJsonLd = parseJsonLd(homeHtml);
  const contactJsonLd = parseJsonLd(contactHtml);
  const aboutJsonLd = parseJsonLd(aboutHtml);

  const homeGraph = homeJsonLd.find((item) => Array.isArray(item["@graph"]));
  assert.ok(homeGraph, "Homepage must emit unified @graph JSON-LD");
  const homeGraphNodes = homeGraph["@graph"];
  const homeOrganizations = homeGraphNodes.filter((n) => n["@type"] === "Organization");
  const homeWebSites = homeGraphNodes.filter((n) => n["@type"] === "WebSite");
  assert.equal(homeOrganizations.length, 1, "Homepage @graph must include one Organization");
  assert.equal(homeWebSites.length, 1, "Homepage @graph must include one WebSite");

  const website = homeWebSites[0];
  const homeOrg = homeOrganizations[0];
  assert.equal(website.name, siteConfig.brand.name);
  assert.equal(website.publisher?.["@id"], homeOrg["@id"]);
  assert.equal(homeOrg.address?.streetAddress, siteConfig.business.address);
  assert.ok(Array.isArray(homeOrg.contactPoint) && homeOrg.contactPoint.length > 0);
  assert.deepEqual(homeOrg.sameAs, [siteConfig.contact.whatsappCommunityUrl]);

  const homeWithoutJsonLd = homeHtml.replace(
    /<script\b[^>]*\btype="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,
    "",
  );
  assert.ok(
    homeWithoutJsonLd.includes(siteConfig.business.address),
    "Organization streetAddress must be visible in homepage footer text",
  );

  assert.equal(
    aboutJsonLd.filter((item) => item["@type"] === "Organization").length,
    0,
    "/about/ must not emit Organization JSON-LD",
  );

  const contactOrganizations = contactJsonLd.filter(
    (item) => item["@type"] === "Organization",
  );
  assert.equal(contactOrganizations.length, 1, "/contact/ must emit one Organization object");
  const organization = contactOrganizations[0];
  assert.equal(organization["@id"], homeOrg["@id"]);
  assert.equal(organization.address?.streetAddress, siteConfig.business.address);
  assert.equal(organization.location?.["@type"], "Place");
  assert.deepEqual(organization.location?.geo, {
    "@type": "GeoCoordinates",
    latitude: siteConfig.officeCoordinates.lat,
    longitude: siteConfig.officeCoordinates.lng,
  });

  const contactPageNode = contactJsonLd.find((item) => item["@type"] === "ContactPage");
  assert.ok(contactPageNode, "/contact/ must emit ContactPage JSON-LD");
  assert.equal(contactPageNode.about?.["@id"], organization["@id"]);

  const contactWithoutJsonLd = contactHtml.replace(
    /<script\b[^>]*\btype="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,
    "",
  );
  assert.ok(
    contactWithoutJsonLd.includes(siteConfig.business.address),
    "Organization streetAddress must match visible /contact/ text from siteConfig",
  );

  // Verify all 51 catalog pages emit CollectionPage + ItemList + dateModified
  // and remain strictly free of Product / Offer / AggregateOffer schema.
  const snapshot = await readJson("catalog-prices.json");
  let collectionCount = 0;
  for (const catalog of snapshot.catalogs) {
    const pathsToCheck = [
      `${catalog.id}/index.html`,
      ...catalog.categories
        .filter((c) => !isConsolidatedSubcategory(catalog.id, c.id))
        .map((c) => `${catalog.id}/${c.id}/index.html`),
    ];
    for (const relPath of pathsToCheck) {
      const catHtml = await readDist(relPath);
      const schemas = parseJsonLd(catHtml);
      const collection = schemas.find((item) => item["@type"] === "CollectionPage");
      assert.ok(collection, `${relPath} must emit CollectionPage JSON-LD`);
      assert.equal(collection.dateModified, snapshot.fetchedAt, `${relPath} dateModified must match snapshot fetchedAt`);
      assert.equal(collection.mainEntity?.["@type"], "ItemList", `${relPath} CollectionPage must contain an ItemList`);
      assert.ok(collection.mainEntity.numberOfItems > 0, `${relPath} ItemList must be non-empty`);
      assert.doesNotMatch(
        catHtml,
        /"@type"\s*:\s*"(?:Product|Offer|AggregateOffer)"/,
        `${relPath} must not emit Product, Offer, or AggregateOffer JSON-LD`,
      );
      collectionCount += 1;
    }
  }
  assert.equal(collectionCount, 51, "expected CollectionPage JSON-LD across all 51 catalog pages");

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
    const expectedLastmod =
      pagePath === "guide/rebar-weight-chart/index.html"
        ? "2026-11-21"
        : "2026-08-17";
    assert.match(
      html,
      new RegExp(`"dateModified":"${expectedLastmod}"`),
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
  assert.equal(h1Match, "قیمت روز میلگرد آجدار (گرید A2، A3 و A4)");
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
      // 404.html and the redirect stubs carry no social card at all.
      const allowedStubOrNotFound = new Set([
        "404.html",
        ...catalogRedirectRules.map((r) => `${r.fromPath.join("/")}/index.html`),
      ]);
      assert.ok(
        allowedStubOrNotFound.has(file),
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

  assert.equal(checked, 65, "every rendered site page must have been checked");
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
const APPROVED_NOINDEX_LEGAL_PATHS = new Set([
  "/terms/",
  "/privacy/",
  "/complaints/",
  "/shipping-delivery/",
]);

test("no indexable page links to a redirecting stub or unapproved noindex URL", async () => {
  const files = await distHtmlFiles();
  const byPathname = new Map();
  for (const file of files) {
    const html = await readDist(file);
    const pathname =
      file === "index.html" ? "/" : `/${file.replace(/index\.html$/, "")}`;
    byPathname.set(pathname, html);
  }

  const isRedirect = (html) => /<meta http-equiv="refresh"/i.test(html);
  const isNoindex = (html) => /<meta name="robots" content="[^"]*noindex/.test(html);
  const isIndexable = (html) => !isNoindex(html) && !isRedirect(html);

  // Confirm ONLY the 4 approved legal/utility pages + 404.html + 2 redirect stubs carry noindex.
  const actualNoindexNonRedirects = [...byPathname.entries()]
    .filter(([pathname, html]) => pathname !== "/404.html" && isNoindex(html) && !isRedirect(html))
    .map(([pathname]) => pathname)
    .sort();
  assert.deepEqual(
    actualNoindexNonRedirects,
    [...APPROVED_NOINDEX_LEGAL_PATHS].sort(),
    "only the four declared legal/utility pages may carry noindex",
  );

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
      if (isRedirect(targetHtml)) {
        failures.push(`${pathname} -> ${href} (redirect stub)`);
      } else if (isNoindex(targetHtml) && !APPROVED_NOINDEX_LEGAL_PATHS.has(target.pathname)) {
        failures.push(`${pathname} -> ${href} (unapproved noindex)`);
      }
    }
  }

  assert.ok(checkedLinks > 1_000, "the audit should cover the full link graph");
  assert.deepEqual(
    failures,
    [],
    "indexable pages must link at canonical URLs, never at redirect stubs or unapproved noindex pages",
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

  // The rows are told apart by their accessible name, not by their href,
  // and mark the repetitive row-level quote action as rel="nofollow".
  const labelled = ribbed.match(
    /<td[^>]*class="row-quote-cell"[^>]*><a href="\/quote-process\/#quote-form" aria-label="[^"]+"/g,
  );
  assert.equal(
    labelled?.length,
    rowLinks.length,
    "each row's quote link must carry its own aria-label",
  );
  const nofollowed = ribbed.match(
    /<td[^>]*class="row-quote-cell"[^>]*><a href="\/quote-process\/#quote-form" aria-label="[^"]+" rel="nofollow"/g,
  );
  assert.equal(
    nofollowed?.length,
    rowLinks.length,
    "each row's quote link must carry rel=\"nofollow\"",
  );
});

/*
 * MegaMenu factory/size quick-picks now travel via sessionStorage buttons
 * rather than `<a href="...?factory=">` / `...?size=` links, so ZERO internal
 * query-string anchor links should exist anywhere in built HTML files.
 */
test("no built page emits internal query-string anchor links", async () => {
  const files = await distHtmlFiles();
  const offenders = [];

  for (const file of files) {
    const html = await readDist(file);
    for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
      const href = match[1].replaceAll("&amp;", "&");
      if (!href.startsWith("/")) continue;
      if (href.includes("?")) {
        offenders.push(`${file} -> ${href}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `internal links must use clean canonical paths instead of query parameters: ${offenders.slice(0, 5).join(", ")}`,
  );
});

test("subcategory pages scope initial-page-data payloads cleanly", async () => {
  for (const relPath of [
    "sheet/sheet-ck45/index.html",
    "sheet/sheet-a516/index.html",
  ]) {
    const info = await stat(new URL(`../dist/${relPath}`, import.meta.url));
    assert.ok(
      info.size < 120_000,
      `${relPath} HTML size (${info.size} bytes) must stay below 120 KB via subcategory scoping`,
    );
  }
});

/*
 * public/_redirects and REDIRECT_ROUTES describe the same two collapsed URLs
 * from opposite ends of the build. They were written out by hand in both
 * places, plus a third time as the `angle`/`channel` literal in three modules.
 * category-meta owns the rule now; this checks the static file still agrees.
 */
test("public/_redirects covers exactly the consolidated and renamed catalog URLs", async () => {
  const redirects = await readDist("_redirects");
  const rules = redirects
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  assert.equal(
    rules.length,
    catalogRedirectRules.length,
    `_redirects has ${rules.length} rules for ${catalogRedirectRules.length} redirect routes`,
  );

  for (const rule of catalogRedirectRules) {
    const from = `/${rule.fromPath.join("/")}/`;
    const to = rule.toPath;
    assert.ok(
      rules.includes(`${from} ${to} 301`),
      `_redirects must contain "${from} ${to} 301"`,
    );

    const stubRel = `${rule.fromPath.join("/")}/index.html`;
    const stub = await readDist(stubRel);
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

/*
 * index.html is the pristine shell Vite builds from, so it cannot import
 * site-config. It states the homepage's title in three places and its
 * description in three more, and the prerender pipeline used to restate both a
 * seventh and eighth time. siteConfig.home owns them now; this is what keeps
 * the static shell honest about it.
 */
test("the template shell quotes the homepage title and description siteConfig owns", async () => {
  const shell = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const { title, description } = siteConfig.home;

  // Whitespace between attributes varies: some of these tags are wrapped.
  const contentOf = (matcher) =>
    shell.match(new RegExp(`<meta\\s+${matcher}\\s+content="([^"]*)"`, "s"))?.[1];

  assert.equal(
    shell.match(/<title>([^<]*)<\/title>/)?.[1],
    title,
    "<title> must be the homepage title siteConfig owns",
  );
  for (const matcher of ['property="og:title"', 'name="twitter:title"']) {
    assert.equal(contentOf(matcher), title, `${matcher} must carry the same title`);
  }
  for (const matcher of [
    'name="description"',
    'property="og:description"',
    'name="twitter:description"',
  ]) {
    assert.equal(
      contentOf(matcher),
      description,
      `${matcher} must carry the homepage description siteConfig owns`,
    );
  }
});


test("Phase 2 built pages enforce consolidated routes, semantic columns, sorting, and rounded prices", async () => {
  const redirectStubPaths = new Set(
    catalogRedirectRules.map((r) => `${r.fromPath.join("/")}/index.html`),
  );
  const files = (await distHtmlFiles()).filter(
    (f) => f.endsWith("index.html") && !redirectStubPaths.has(f),
  );

  for (const file of files) {
    const html = await readDist(file);
    assert.doesNotMatch(
      html,
      /href="\/beam\/beam\/"|href="\/wire\/wire\/"/,
      `${file} must not link to legacy redirected URLs /beam/beam/ or /wire/wire/`,
    );
  }

  const boxHtml = await readDist("profile/box-profile/index.html");
  assert.match(boxHtml, /قوطی پروفیل آهنی/);
  assert.doesNotMatch(boxHtml, /"name":"قوطی و پروفیل".*"name":"قوطی و پروفیل"/);

  for (const relPath of ["rebar/ribbed/index.html", "beam/index.html"]) {
    const html = await readDist(relPath);
    assert.match(html, /استاندارد \/ گرید/, `${relPath} must use استاندارد / گرید column header`);
  }

  const thickHtml = await readDist("pipe/thick-wall-pipe/index.html");
  assert.match(thickHtml, /ضخامت جداره \(میلی‌متر\)/);
  assert.match(thickHtml, /<bdi dir="ltr">[^<]*×[^<]*<\/bdi>/);
  assert.match(thickHtml, /<td data-label="ضخامت جداره \(میلی‌متر\)">۲۰<\/td>/);
  assert.doesNotMatch(
    thickHtml,
    /<td data-label="ضخامت جداره \(میلی‌متر\)">—<\/td>/,
    "thick-wall-pipe rows should display computed wall thickness instead of placeholder dashes",
  );

  const scaffoldHtml = await readDist("pipe/scaffold-pipe/index.html");
  assert.match(scaffoldHtml, /وزن تقریبی شاخه/);
  assert.match(scaffoldHtml, /۱٫۵ اینچ \(نمره ۵\)/);
  assert.doesNotMatch(
    scaffoldHtml,
    /[۰-۹]\.[۰-۹]\s*تومان|[۰-۹]٫[۰-۹]+\s*تومان/,
    "scaffold-pipe prices must be rounded to whole toman",
  );

  const a516Html = await readDist("sheet/sheet-a516/index.html");
  const firstCardHtml =
    a516Html.match(/<section class="factory-price-card[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.ok(
    firstCardHtml.includes('<td data-label="ضخامت">۴</td>') &&
      firstCardHtml.includes('<td data-label="ضخامت">۱۵</td>'),
  );
  assert.ok(
    firstCardHtml.indexOf('<td data-label="ضخامت">۴</td>') <
      firstCardHtml.indexOf('<td data-label="ضخامت">۱۵</td>'),
    "A516 rows must be numerically sorted so ۴ precedes ۱۵",
  );
});


test("Phase 3 homepage flagship links and top 6 money-page guides, calculators, zero-price CTA, and schemas render cleanly", async () => {
  const extractJsonLd = (html) =>
    [
      ...html.matchAll(
        /<script(?:\s+[^>]*)?\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1]));

  const homeHtml = await readDist("index.html");
  for (const href of [
    "/rebar/ribbed/",
    "/sheet/black-sheet/",
    "/pipe/seamless-pipe/",
    "/profile/box-profile/",
    "/wire/steel-wire/",
    "/pipe/thick-wall-pipe/",
    "/pipe/scaffold-pipe/",
    "/sheet/sheet-ck45/",
    "/sheet/sheet-a516/",
  ]) {
    assert.match(
      homeHtml,
      new RegExp(`href="${href}"`),
      `homepage overview must link directly to ${href}`,
    );
  }

  const rebarChartHtml = await readDist("guide/rebar-weight-chart/index.html");
  assert.match(rebarChartHtml, /class="quick-answer-grid"/);
  assert.match(rebarChartHtml, /id="rebar-weight-calculator"/);
  assert.match(rebarChartHtml, /مقایسه وزن واقعی شاخه ۱۲ متری کارخانه‌های ایران/);
  assert.match(rebarChartHtml, /سؤالات متداول وزن میلگرد/);
  const rebarSchemas = extractJsonLd(rebarChartHtml);
  assert.ok(rebarSchemas.some((s) => s["@type"] === "Article"));
  assert.ok(rebarSchemas.some((s) => s["@type"] === "Dataset"));
  const rebarFaq = rebarSchemas.find((s) => s["@type"] === "FAQPage");
  assert.ok(rebarFaq && rebarFaq.mainEntity.length >= 5);

  const moneyRoutes = [
    ["pipe/thick-wall-pipe/index.html", "/pipe/seamless-pipe/"],
    ["pipe/scaffold-pipe/index.html", "/pipe/galvanized-pipe/"],
    ["sheet/sheet-ck45/index.html", "/rebar/alloy/"],
    ["rebar/ribbed/index.html", "/guide/rebar-weight-chart/"],
    ["sheet/sheet-a516/index.html", "/sheet/sheet-st52/"],
    ["sheet/black-sheet/index.html", "/sheet/sheet-st52/"],
    ["sheet/galvanized-sheet/index.html", "/sheet/colored-sheet/"],
    ["sheet/oily-sheet/index.html", "/profile/furniture-profile/"],
    ["pipe/seamless-pipe/index.html", "/pipe/thick-wall-pipe/"],
    ["profile/building-profile/index.html", "/profile/box-profile/"],
    ["beam/index.html", "/beam/hash/"],
    ["beam/hash/index.html", "/beam/"],
    ["angle/index.html", "/channel/"],
    ["channel/index.html", "/angle/"],
  ];

  for (const [relPath, expectedLink] of moneyRoutes) {
    const html = await readDist(relPath);
    assert.match(html, /class="subcategory-guide"/, `${relPath} must render buying guide section`);
    assert.match(html, /class="subcategory-faq-list"/, `${relPath} must render visible FAQ`);
    assert.match(html, new RegExp(`href="${expectedLink}"`), `${relPath} must cross-link ${expectedLink}`);
    const schemas = extractJsonLd(html);
    assert.ok(schemas.some((s) => s["@type"] === "CollectionPage"), `${relPath} must emit CollectionPage`);
    assert.ok(schemas.some((s) => s["@type"] === "FAQPage"), `${relPath} must emit FAQPage`);
    assert.doesNotMatch(
      html,
      /"@type"\s*:\s*"(?:Product|Offer|AggregateOffer)"/,
      `${relPath} must remain free of Product/Offer schemas`,
    );
  }

  // Unified header/nav & B2B sticky bar checks across both `/` and `/guide/rebar-weight-chart/`
  for (const routeRel of ["index.html", "guide/rebar-weight-chart/index.html"]) {
    const html = await readDist(routeRel);
    assert.match(html, /class="header-sticky-phone"/, `${routeRel} must expose sticky click-to-call pill`);
    assert.match(html, /href="\/guide\/"[^>]*>راهنمای فنی و جدول وزن<\/a>/, `${routeRel} must link /guide/ in nav`);
    assert.match(html, /class="product-dropdown rebar-mega-menu"/, `${routeRel} must include MegaMenu`);
    assert.match(html, /class="mobile-actions"[\s\S]*?https:\/\/chat\.whatsapp\.com\//, `${routeRel} mobile-actions must include WhatsApp`);
  }

  const ck45Html = await readDist("sheet/sheet-ck45/index.html");
  assert.match(ck45Html, /class="zero-price-inquiry-card"/);
  assert.match(ck45Html, /tel:\+982188888280/);
  assert.match(ck45Html, /https:\/\/chat\.whatsapp\.com\//);
});
