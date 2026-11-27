import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateRebarWeight,
  deriveWallThicknessFromSize,
  effectiveRowSpecification,
  effectiveSpecificationLabel,
  sortFactoryRows,
} from "../app/catalog-behavior.mjs";
import {
  categoriesCrediblePricedRows,
  categoryPricedRows,
  categoryPricing,
  priceRangesByUnit,
  summarisePricedRows,
} from "../app/catalog-pricing.mjs";
import {
  buildCatalogSearchGroups,
  filterProductGroups,
} from "../app/catalog-search.ts";
import { loadGroupCatalogs } from "./helpers/dist.mjs";
import {
  buildMenuCatalog,
  buildOverviewSummaries,
  createRetryableLoader,
  loadCatalogSnapshot,
  loadGroupCatalog,
  loadMenuGroup,
  loadOverviewSummaries,
  primeCatalogReader,
  primeCatalogSnapshot,
  resetCatalogReader,
  scopeCatalogSnapshot,
} from "../app/catalog-reader.ts";
import { validateCatalogSnapshot } from "../app/catalog-validation.mjs";
import {
  summarizeCatalogDates,
  summarizeCatalogTrends,
} from "../app/catalog-trend.mjs";

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

test("validation rejects control newlines inside factory names or row fields", async () => {
  const snapshot = await readJson("../app/data/catalog-prices.json");
  for (const field of ["title", "size", "unit", "factory"]) {
    const tampered = structuredClone(snapshot);
    const row = tampered.catalogs[0].categories[0].factories[0].rows[0];
    row[field] = `${row[field] || "x"}\n18`;
    assert.throws(
      () => validateCatalogSnapshot(tampered),
      new RegExp(`row.*${field}|خط جدید`),
      `row.${field} with embedded newline must be rejected`,
    );
  }
  const tamperedFactory = structuredClone(snapshot);
  tamperedFactory.catalogs[0].categories[0].factories[0].name += "\nخط";
  assert.throws(
    () => validateCatalogSnapshot(tamperedFactory),
    /خط جدید|name/,
    "factory.name with embedded newline must be rejected",
  );
});

test("a snapshot that drops, reorders or relabels what the taxonomy expects is not publishable", async () => {
  const snapshot = await readJson("../app/data/catalog-prices.json");
  const tamperings = {
    "a missing catalog": (s) => s.catalogs.pop(),
    "a missing category": (s) => s.catalogs[0].categories.pop(),
    "reordered catalogs": (s) => s.catalogs.reverse(),
    "reordered categories": (s) => s.catalogs[0].categories.reverse(),
    "a relabelled catalog": (s) => (s.catalogs[0].label += " "),
    "a relabelled category": (s) => (s.catalogs[0].categories[0].label += " "),
    "a different initial category": (s) =>
      (s.catalogs[0].initialCategoryId = s.catalogs[0].categories[1].id),
  };
  for (const [name, tamper] of Object.entries(tamperings)) {
    const tampered = structuredClone(snapshot);
    tamper(tampered);
    assert.throws(
      () => validateCatalogSnapshot(tampered),
      /قرارداد منبع|جابه‌جا/,
      `${name} must be rejected`,
    );
  }
});

test("F1: every published summary equals the rows it summarises", async () => {
  const snapshot = await readJson("../app/data/catalog-prices.json");

  // Relational, not absolute: the numbers change every refresh, the invariant
  // does not. A summary value the table cannot produce is the F1 defect.
  for (const [group, category] of allCategories(snapshot)) {
    const expected = summarisePricedRows(pricedRowsOf(category));
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

  const beamPricing = categoryPricing(
    beam.categories.find((category) => category.id === "beam"),
  );
  assert.equal(beamPricing.kind, "mixed");
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
      const pricing = categoryPricing(category);
      return (
        pricing.kind === "unavailable" &&
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
    assert.equal(
      "rows" in group,
      false,
      `${group.id} must not carry hardcoded rows: search always runs against the live catalogs, so rows are only attached dynamically`,
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
  const groups = buildCatalogSearchGroups(
    productGroups,
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

test("rebar weight calculator rejects fractional or non-positive branch quantities", () => {
  assert.equal(calculateRebarWeight(16, 12, 2), (16 ** 2 / 162) * 12 * 2);
  assert.equal(calculateRebarWeight(16, 12, 1.5), null);
  assert.equal(calculateRebarWeight(16, 12, 0), null);
  const weightAscii = calculateRebarWeight("16", "12", "1");
  const weightPersian = calculateRebarWeight("۱۶", "۱۲", "۱");
  assert.ok(weightAscii !== null);
  assert.ok(weightPersian !== null);
  assert.equal(weightAscii.toFixed(2), weightPersian.toFixed(2));
  assert.equal(calculateRebarWeight("0", "12", "1"), null);
  assert.equal(calculateRebarWeight("16", "12", "۰"), null);
  assert.equal(calculateRebarWeight("invalid", "12", "1"), null);
});

test("implausible trend percentages must be quarantined before publication", async () => {
  const snapshot = await readJson("../app/data/catalog-prices.json");
  const suspicious = structuredClone(snapshot);
  const row = suspicious.catalogs[0].categories[0].factories[0].rows[0];
  row.status = "up";
  row.percent = 155;

  assert.throws(
    () => validateCatalogSnapshot(suspicious),
    /unverified|بررسی/,
  );

  row.status = "unverified";
  assert.equal(validateCatalogSnapshot(suspicious), suspicious);
});

test("group overview trends and dates are derived from every category", () => {
  assert.deepEqual(
    summarizeCatalogTrends([
      { status: "up", percent: 2 },
      { status: "down", percent: -1 },
    ]),
    { status: "mixed", percent: 0 },
  );
  assert.deepEqual(
    summarizeCatalogTrends([
      { status: "up", percent: 2 },
      { status: "up", percent: 4 },
      { status: "same", percent: 0 },
    ]),
    { status: "up", percent: 3 },
  );
  assert.deepEqual(
    summarizeCatalogTrends([
      { status: "up", percent: 155 },
      { status: "same", percent: 0 },
    ]),
    { status: "unverified", percent: 0 },
  );
  assert.equal(
    summarizeCatalogDates([{ date: "۱۴۰۵/۰۶/۰۸" }, { date: "۱۴۰۵/۰۶/۰۷" }]),
    "به‌روزرسانی‌های متفاوت",
  );
});

test("catalog-pricing: priced-row extraction ignores null, zero, and non-finite prices", () => {
  const category = {
    factories: [
      {
        rows: [
          { price: 1000, unit: "کیلوگرم" },
          { price: null, unit: "کیلوگرم" },
          { price: 0, unit: "کیلوگرم" },
          { price: NaN, unit: "کیلوگرم" },
          { price: "1000", unit: "کیلوگرم" },
        ],
      },
    ],
  };
  const priced = categoryPricedRows(category);
  assert.equal(priced.length, 1);
  assert.equal(priced[0].price, 1000);
});

test("catalog-pricing: categoryPricing returns discriminated unavailable, mixed, and range states", () => {
  const makeCategory = (rows) => ({ factories: [{ rows }] });

  const singleUnit = makeCategory([
    { price: 10, unit: "کیلوگرم" },
    { price: 20, unit: "کیلوگرم" },
    { price: null, unit: "کیلوگرم" },
  ]);
  assert.deepEqual(categoryPricing(singleUnit), {
    kind: "range",
    unit: "کیلوگرم",
    min: 10,
    max: 20,
    average: 15,
  });

  const mixedUnits = makeCategory([
    { price: 10, unit: "کیلوگرم" },
    { price: 30, unit: "شاخه" },
  ]);
  assert.deepEqual(categoryPricing(mixedUnits), {
    kind: "mixed",
    units: ["کیلوگرم", "شاخه"],
  });

  const missingUnit = makeCategory([{ price: 10, unit: "" }]);
  assert.deepEqual(categoryPricing(missingUnit), {
    kind: "mixed",
    units: [],
  });

  const unpriced = makeCategory([{ price: null, unit: "کیلوگرم" }]);
  assert.deepEqual(categoryPricing(unpriced), {
    kind: "unavailable",
  });
});

/** A category shaped just enough for the pricing helpers. */
const pricedCategory = (id, rows) => ({
  id,
  factories: [{ name: "کارخانه", rows }],
});

const kg = (price) => ({ price, unit: "کیلوگرم" });

test("catalog-pricing: a displayed summary drops an implausible row but keeps it priced", () => {
  /*
   * One upstream ribbed rebar row published 1,400 تومان/kg beside a 75,100
   * median, and it became the advertised floor: "در بازه‌ای بین ۱٬۵۰۰ تا
   * ۹۱٬۵۰۰ تومان" was the first sentence on the page.
   */
  const rows = [kg(1_400), kg(70_500), kg(75_100), kg(79_000), kg(83_200)];
  const category = pricedCategory("ribbed", rows);

  assert.deepEqual(summarisePricedRows(rows).min, 1_400, "the stored summary stays faithful");
  const pricing = categoryPricing(category);
  assert.equal(pricing.kind, "range");
  assert.equal(pricing.min, 70_500);
  assert.equal(pricing.max, 83_200);
  assert.equal(
    categoryPricedRows(category).length,
    5,
    "the row itself is still priced and still shown in the table",
  );
});

test("catalog-pricing: an implausible row is judged against its own Sales unit", () => {
  /*
   * A category priced partly per kilogram and partly per branch is carrying
   * two scales, not an outlier. A unit-blind comparison would throw away every
   * kilogram row in it.
   */
  const category = pricedCategory("beam", [
    kg(95_500),
    kg(150_000),
    kg(209_100),
    { price: 15_000_000, unit: "شاخه" },
    { price: 18_181_800, unit: "شاخه" },
  ]);

  assert.equal(
    categoryPricedRows(category).length,
    categoriesCrediblePricedRows([category]).length,
    "nothing here is implausible; the units simply differ",
  );
});

test("catalog-pricing: credibility is judged per category, never across a group", () => {
  /*
   * Ribbed rebar (~76,000 تومان/kg) and stainless rebar (~2,036,000 تومان/kg)
   * are an order of magnitude apart and both entirely real. Pooled first, the
   * outlier test would discard one of them wholesale.
   */
  const ribbed = pricedCategory("ribbed", [kg(70_500), kg(76_000), kg(83_200)]);
  const stainless = pricedCategory("stainless", [
    kg(1_900_000),
    kg(2_036_000),
  ]);

  const credible = categoriesCrediblePricedRows([ribbed, stainless]);
  assert.equal(credible.length, 5, "every row here is credible for its own category");
  assert.deepEqual(priceRangesByUnit(credible), [
    { unit: "کیلوگرم", min: 70_500, max: 2_036_000 },
  ]);
});

test("catalog-pricing: a category with no implausible row summarises exactly as before", () => {
  const rows = [kg(64_980), kg(79_900), kg(87_400)];
  const pricing = categoryPricing(pricedCategory("angle", rows));
  assert.equal(pricing.kind, "range");
  assert.deepEqual(
    { min: pricing.min, max: pricing.max, average: pricing.average },
    summarisePricedRows(rows),
  );
});

test("catalog-pricing: per-unit ranges never cross Sales units", () => {
  const rows = [
    { price: 10, unit: "کیلوگرم" },
    { price: 20, unit: "کیلوگرم" },
    { price: 100, unit: "شاخه" },
    { price: null, unit: "شاخه" },
  ];
  assert.deepEqual(priceRangesByUnit(rows), [
    { unit: "کیلوگرم", min: 10, max: 20 },
    { unit: "شاخه", min: 100, max: 100 },
  ]);
});

test("catalog-reader: loadCatalogSnapshot upgrades a trimmed subcategory cache to the full snapshot", async () => {
  const full = await readJson("../app/data/catalog-prices.json");
  const scoped = scopeCatalogSnapshot(full, "sheet", "sheet-ck45");

  try {
    resetCatalogReader();
    primeCatalogSnapshot(scoped);

    const cachedBefore = loadGroupCatalog.getCached("sheet");
    assert.ok(cachedBefore.categories.some((c) => c.factories.length === 0));
    assert.ok(
      cachedBefore.categories.find((c) => c.id === "sheet-ck45").factories
        .length > 0,
      "the active subcategory keeps its factory rows",
    );

    const upgraded = await loadCatalogSnapshot();
    assert.equal(upgraded.catalogs.length, full.catalogs.length);
    const upgradedSheet = upgraded.catalogs.find((c) => c.id === "sheet");
    assert.ok(upgradedSheet.categories.every((c) => c.factories.length > 0));
  } finally {
    resetCatalogReader();
  }
});

test("catalog-reader: scopeCatalogSnapshot isolates group or subcategory payloads without mutating source", async () => {
  const full = await readJson("../app/data/catalog-prices.json");
  const originalSheet = full.catalogs.find((c) => c.id === "sheet");

  const groupScoped = scopeCatalogSnapshot(full, "sheet");
  assert.equal(groupScoped.catalogs.length, 1);
  assert.equal(groupScoped.catalogs[0].id, "sheet");
  assert.equal(groupScoped.catalogs[0].fetchedAt, full.fetchedAt);
  assert.ok(
    groupScoped.catalogs[0].categories.every((c) => c.factories.length > 0),
  );

  const subScoped = scopeCatalogSnapshot(full, "sheet", "sheet-ck45");
  assert.equal(subScoped.catalogs.length, 1);
  for (const category of subScoped.catalogs[0].categories) {
    if (category.id === "sheet-ck45") {
      assert.ok(category.factories.length > 0);
      assert.ok(category.filters.factories.length > 0);
    } else {
      assert.deepEqual(category.factories, []);
      assert.deepEqual(category.filters, { sizes: [], factories: [] });
    }
  }

  // Input snapshot stays untouched.
  assert.ok(originalSheet.categories.every((c) => c.factories.length > 0));

  assert.throws(() => scopeCatalogSnapshot(full, "nonexistent"), /در دسترس نیست/);
  assert.throws(
    () => scopeCatalogSnapshot(full, "sheet", "nonexistent"),
    /یافت نشد/,
  );
});

test("catalog-reader: resetCatalogReader clears snapshot, menu, overview, and loader caches", async () => {
  const full = await readJson("../app/data/catalog-prices.json");

  try {
    resetCatalogReader();

    // Direct snapshot projections work with an unprimed store.
    const menu = await buildMenuCatalog(full);
    const overview = buildOverviewSummaries(full);
    assert.equal(loadCatalogSnapshot.getCached(), undefined);
    assert.equal(loadMenuGroup.getCached("rebar"), undefined);
    assert.equal(loadOverviewSummaries.getCached(), undefined);

    primeCatalogReader({
      snapshot: scopeCatalogSnapshot(full, "rebar"),
      menu,
      overview,
    });
    assert.ok(loadGroupCatalog.getCached("rebar"));
    assert.equal(loadGroupCatalog.getCached("sheet"), undefined);
    assert.ok(loadMenuGroup.getCached("rebar"));
    assert.deepEqual(loadOverviewSummaries.getCached(), overview);

    resetCatalogReader();
    assert.equal(loadCatalogSnapshot.getCached(), undefined);
    assert.equal(loadGroupCatalog.getCached("rebar"), undefined);
    assert.equal(loadMenuGroup.getCached("rebar"), undefined);
    assert.equal(loadOverviewSummaries.getCached(), undefined);
  } finally {
    resetCatalogReader();
  }
});

test("catalog-behavior: computes thick-wall pipe wall thickness, semantic spec labels, and numeric sorting", () => {
  assert.equal(deriveWallThicknessFromSize("83*43"), "20");
  assert.equal(deriveWallThicknessFromSize("140×80"), "30");
  assert.equal(deriveWallThicknessFromSize("220*80"), "70");
  assert.equal(effectiveSpecificationLabel({ id: "ribbed", specificationLabel: "ضخامت" }), "استاندارد / گرید");
  assert.equal(effectiveSpecificationLabel({ id: "thick-wall-pipe", specificationLabel: "ضخامت" }), "ضخامت جداره (میلی‌متر)");
  assert.equal(effectiveRowSpecification({ size: "83*43", specification: "", standard: "", grade: "" }, "thick-wall-pipe"), "20");

  const sortedPipes = sortFactoryRows(
    [{ size: "220*80" }, { size: "83*43" }, { size: "140*80" }, { size: "140*70" }],
    { groupId: "pipe", categoryId: "thick-wall-pipe" },
  );
  assert.deepEqual(
    sortedPipes.map((r) => r.size),
    ["83*43", "140*70", "140*80", "220*80"],
  );

  const sortedA516 = sortFactoryRows(
    [
      { size: "6*1.5", specification: "12" },
      { size: "6*1.5", specification: "4" },
      { size: "6*1.5", specification: "8" },
    ],
    { groupId: "sheet", categoryId: "sheet-a516" },
  );
  assert.deepEqual(
    sortedA516.map((r) => r.specification),
    ["4", "8", "12"],
  );
});
