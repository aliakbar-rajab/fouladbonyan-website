import assert from "node:assert/strict";
import test from "node:test";
import { readdir } from "node:fs/promises";
import { infoPageDefinitions } from "../app/info-page-data.ts";
import { productGroups } from "../app/category-meta.ts";
import { loadGroupCatalogs, readDist } from "./helpers/dist.mjs";

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
  return (await loadGroupCatalogs()).map(({ id, categories }) => ({
    groupId: id,
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

    // A category landing page must render CategoryOverview -- one summary
    // row per subcategory -- never a subcategory's own PriceCatalog rows.
    // (It used to silently prerender its default subcategory's full table,
    // making the landing page a near-duplicate of that one subcategory page;
    // see CategoryOverview.tsx.) The siblings' full tables live on their own
    // URLs, linked from here.
    const landingHtml = await readDist(`${groupId}/index.html`);
    assert.equal(
      countRows(landingHtml),
      0,
      `${groupId}/ must not prerender any subcategory's PriceCatalog rows, found ${countRows(landingHtml)}`,
    );
    assert.equal(
      countFactoryCards(landingHtml),
      0,
      `${groupId}/ must not prerender any subcategory's factory cards, found ${countFactoryCards(landingHtml)}`,
    );
    const overviewRowCount = (landingHtml.match(/class="overview-row"/g) ?? []).length;
    assert.equal(
      overviewRowCount,
      categories.length,
      `${groupId}/ must prerender one CategoryOverview row per subcategory (${categories.length}), found ${overviewRowCount}`,
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
