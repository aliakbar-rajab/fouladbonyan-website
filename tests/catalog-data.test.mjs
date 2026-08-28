import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateRebarWeight,
  getCategoryPricingState,
  getTrendPresentation,
} from "../app/catalog-behavior.mjs";
import { buildCatalogSearchGroups } from "../app/catalog-search.mjs";
import { loadGroupCatalogs } from "./helpers/dist.mjs";
import { createRetryableLoader } from "../app/catalog-reader.ts";
import {
  deriveSummaryFromRows,
  validateCatalogSnapshot,
} from "../app/catalog-validation.mjs";
import { filterProductGroups } from "../app/site-logic.mjs";

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

const allCategories = (snapshot) =>
  snapshot.catalogs.flatMap((catalog) =>
    catalog.categories.map((category) => [catalog.id, category]),
  );

const pricedRowsOf = (category) =>
  category.factories
    .flatMap((factory) => factory.rows)
    .filter((row) => row.price !== null);

test("committed price payloads pass runtime semantic validation", async () => {
  const snapshot = await readJson("../app/data/catalog-prices.json");
  assert.equal(validateCatalogSnapshot(snapshot), snapshot);
});

test("F1: every published summary equals the rows it summarises", async () => {
  const snapshot = await readJson("../app/data/catalog-prices.json");

  // Relational, not absolute: the numbers change every refresh, the invariant
  // does not. A summary value the table cannot produce is the F1 defect.
  for (const [group, category] of allCategories(snapshot)) {
    const expected = deriveSummaryFromRows(pricedRowsOf(category));
    const where = `${group}/${category.id}`;
    assert.equal(category.summary.min, expected.min, `${where} summary.min`);
    assert.equal(category.summary.max, expected.max, `${where} summary.max`);
    assert.ok(
      Math.abs(category.summary.average - expected.average) <= 1,
      `${where} summary.average was ${category.summary.average}, rows average ${expected.average}`,
    );
  }
});

test("F1: validation rejects a summary that drifts from its rows", async () => {
  const snapshot = await readJson("../app/data/catalog-prices.json");

  // The pre-fix scrapers truncated to whole hundreds via floor(value/100)*100,
  // which understates any value that was not already a round hundred. Each of
  // the three fields must be caught on its own.
  for (const field of ["min", "max", "average"]) {
    const drifted = structuredClone(snapshot);
    const summary = drifted.catalogs[0].categories[0].summary;
    summary[field] -= 50;
    assert.throws(
      () => validateCatalogSnapshot(drifted),
      new RegExp(`summary\\.${field}`),
      `a summary.${field} that no row supports must be rejected`,
    );
  }

  // Guard the guard: the unmodified payload must still pass, otherwise the
  // rejections above prove nothing.
  assert.equal(validateCatalogSnapshot(snapshot), snapshot);
});

test("F10: sourceUrl is scheme-checked like sourceHome, since it (not sourceHome) is rendered into an href", async () => {
  const snapshot = await readJson("../app/data/catalog-prices.json");

  for (const badUrl of ["javascript:alert(1)", "", "example.com"]) {
    const tampered = structuredClone(snapshot);
    tampered.catalogs[0].categories[0].sourceUrl = badUrl;
    assert.throws(
      () => validateCatalogSnapshot(tampered),
      /sourceUrl/,
      `sourceUrl of ${JSON.stringify(badUrl)} must be rejected`,
    );
  }

  assert.equal(validateCatalogSnapshot(snapshot), snapshot);
});


test("F3: a failed load is not cached, so the next attempt retries", async () => {
  let attempts = 0;
  const load = createRetryableLoader(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("network down");
    return { attempt: attempts };
  });

  await assert.rejects(load(), /network down/);
  assert.equal(attempts, 1);

  // This is the whole point: the retry the UI invites must re-run the loader.
  assert.deepEqual(await load(), { attempt: 2 });
  assert.equal(attempts, 2);
});

test("F3: a successful load is shared, never repeated", async () => {
  let attempts = 0;
  const load = createRetryableLoader(async () => {
    attempts += 1;
    return { attempt: attempts };
  });

  const [first, second] = await Promise.all([load(), load()]);
  const third = await load();

  assert.equal(attempts, 1, "concurrent and later callers share one attempt");
  assert.equal(first, second);
  assert.equal(first, third);
});

test("F3: concurrent callers of a failing load share a single attempt", async () => {
  let attempts = 0;
  const load = createRetryableLoader(async () => {
    attempts += 1;
    throw new Error("boom");
  });

  await Promise.all([
    assert.rejects(load(), /boom/),
    assert.rejects(load(), /boom/),
  ]);
  assert.equal(attempts, 1, "one in-flight failure is shared, not duplicated");

  await assert.rejects(load(), /boom/);
  assert.equal(attempts, 2, "a call after the failure starts a fresh attempt");
});

test("known source ambiguities are represented honestly", async () => {
  const snapshot = await readJson("../app/data/catalog-prices.json");

  const rebar = snapshot.catalogs.find((c) => c.id === "rebar");
  const beam = snapshot.catalogs.find((c) => c.id === "beam");
  const profile = snapshot.catalogs.find((c) => c.id === "profile");

  const correctedRow = rebar.categories
    .flatMap((category) => category.factories)
    .flatMap((factory) => factory.rows)
    .find((row) => row.id === 504);
  assert.equal(correctedRow.title, "میلگرد 32 نیشابور آجدار A3");
  assert.equal(correctedRow.size, "32");

  assert.equal(
    profile.categories.find((category) => category.id === "box-profile")
      .groupingLabel,
    "گروه",
  );
  assert.equal(
    profile.categories.find((category) => category.id === "building-profile")
      .groupingLabel,
    "گروه",
  );

  const beamPricing = getCategoryPricingState(
    beam.categories.find((category) => category.id === "beam"),
  );
  assert.deepEqual(new Set(beamPricing.units), new Set(["شاخه", "کیلوگرم"]));

  const unpriced = snapshot.catalogs
    .flatMap((catalog) => catalog.categories)
    .filter(
      (category) =>
        category.factories
          .flatMap((factory) => factory.rows)
          .every((row) => row.price === null),
    );
  assert.ok(unpriced.length > 0);
  assert.ok(
    unpriced.every((category) => {
      const state = getCategoryPricingState(category);
      return (
        !state.hasPrices &&
        category.summary.min === 0 &&
        category.summary.max === 0 &&
        category.summary.average === 0
      );
    }),
  );
});

test("F17: product groups carry no placeholder search rows", async () => {
  const { productGroups } = await import("../app/category-meta.ts");

  assert.ok(productGroups.length > 0, "there should be product groups");
  for (const group of productGroups) {
    assert.deepEqual(
      group.rows,
      [],
      `${group.id} must not carry hardcoded rows: search always runs against the live catalogs, so these only ever surfaced when the live load was pending or failed`,
    );
  }
});

test("F17: every searchable row is built from live catalog data", async () => {
  const { productGroups } = await import("../app/category-meta.ts");

  const groups = buildCatalogSearchGroups(
    productGroups,
    await loadGroupCatalogs(),
  );
  const rows = groups.flatMap((group) => group.rows);

  assert.ok(rows.length > 0, "the live builder must supply the rows");
  // categoryId and searchText only exist on live-derived rows; a placeholder
  // leaking through would have neither and would be unnavigable.
  for (const row of rows) {
    assert.ok(row.categoryId, `row "${row.product}" has no categoryId`);
    assert.ok(row.searchText, `row "${row.product}" has no searchText`);
  }
});

test("live catalog search indexes real rows and navigation metadata", async () => {
  const { productGroups } = await import("../app/category-meta.ts");
  const baseGroups = productGroups.map(({ id, label }) => ({
    id,
    label,
    rows: [],
  }));
  const groups = buildCatalogSearchGroups(
    baseGroups,
    await loadGroupCatalogs(),
  );

  assert.ok(
    groups.reduce((total, group) => total + group.rows.length, 0) >= 2_000,
  );
  const result = filterProductGroups(groups, "میلگرد 32 نیشابور");
  assert.equal(result[0].id, "rebar");
  assert.equal(result[0].rows[0].categoryId, "ribbed");
  assert.equal(result[0].rows[0].factory, "نیشابور");
  assert.equal(result[0].rows[0].size, "32");
});

test("trend and calculator helpers preserve business meaning", () => {
  assert.deepEqual(getTrendPresentation("down", -2.5), {
    direction: "کاهش",
    symbol: "↓",
    amount: 2.5,
  });
  assert.deepEqual(getTrendPresentation("up", 1), {
    direction: "افزایش",
    symbol: "↑",
    amount: 1,
  });
  assert.deepEqual(getTrendPresentation("up", 0), {
    direction: "بدون تغییر",
    symbol: "—",
    amount: 0,
  });
  assert.equal(calculateRebarWeight(16, 12, 2), (16 ** 2 / 162) * 12 * 2);
  assert.equal(calculateRebarWeight(16, 12, 1.5), null);
  assert.equal(calculateRebarWeight(16, 12, 0), null);
});
