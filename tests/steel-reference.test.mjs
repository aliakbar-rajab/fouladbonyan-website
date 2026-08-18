import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildGuideReference,
  parseCatalogNumber,
} from "../app/steel-reference.ts";
import { calculateRebarWeight } from "../app/catalog-behavior.mjs";
import {
  guideIndex,
  guidePageDefinitions,
  guidePageKeys,
  guidePageUrl,
  isGuidePageKey,
} from "../app/guide-page-data.ts";

const readData = (name) =>
  readFile(new URL(`../app/data/${name}`, import.meta.url), "utf8").then(
    JSON.parse,
  );

const [rebarData, beamData, productData] = await Promise.all([
  readData("rebar-prices.json"),
  readData("beam-prices.json"),
  readData("product-prices.json"),
]);

const reference = buildGuideReference(rebarData, beamData, productData);

test("catalog numbers parse Persian slash decimals and reject non-values", () => {
  assert.equal(parseCatalogNumber("125"), 125);
  assert.equal(parseCatalogNumber("7/5"), 7.5);
  assert.equal(parseCatalogNumber("۷/۵"), 7.5);
  assert.equal(parseCatalogNumber("۱۲۵"), 125);
  assert.equal(parseCatalogNumber("10.6"), 10.6);
  assert.equal(parseCatalogNumber("-"), null);
  assert.equal(parseCatalogNumber(""), null);
  assert.equal(parseCatalogNumber(undefined), null);
  // "12 متری" is a label, not a length this file may quietly turn into 12.
  assert.equal(parseCatalogNumber("12 متری"), null);
});

/*
 * parseCatalogNumber used to inline its own Persian/Arabic digit conversion
 * (charCode - 1776 / - 1632) before it shared toAsciiDigits with the rest of
 * the site. Pin every digit of both blocks so the shared helper can never
 * silently diverge from the arithmetic it replaced.
 */
test("catalog numbers accept every Persian and Arabic-Indic digit", () => {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";

  for (let digit = 1; digit <= 9; digit += 1) {
    assert.equal(parseCatalogNumber(persian[digit]), digit, `Persian ${digit}`);
    assert.equal(parseCatalogNumber(arabic[digit]), digit, `Arabic ${digit}`);
  }

  assert.equal(parseCatalogNumber(persian.slice(1)), 123456789);
  assert.equal(parseCatalogNumber(arabic.slice(1)), 123456789);
  // Mixed blocks in one value, which the two chained replaces also handled.
  assert.equal(parseCatalogNumber("۱٢/٣"), 12.3);
});

test("rebar weight tables reuse the shipped weight formula and the catalog's own sizes", () => {
  const ids = reference.rebarTables.map((table) => table.id);
  assert.deepEqual(ids, ["ribbed", "simple"]);

  for (const table of reference.rebarTables) {
    const category = rebarData.categories.find((item) => item.id === table.id);
    assert.ok(category, `${table.id} must exist in the rebar catalog`);
    assert.equal(
      table.rows.length,
      new Set(category.filters.sizes).size,
      `${table.id} must tabulate exactly the catalog's sizes`,
    );
    assert.equal(table.href, `/rebar/${table.id}/`);

    for (const row of table.rows) {
      const expectedPerMeter = calculateRebarWeight(row.diameterMm, 1, 1);
      assert.ok(
        Math.abs(row.kgPerMeter - expectedPerMeter) < 0.001,
        `${table.id} size ${row.size}: kg/m must come from calculateRebarWeight`,
      );

      if (table.branchLengthM === null) {
        assert.equal(row.kgPerBranch, null);
        assert.equal(row.branchesPerTon, null);
      } else {
        const expectedPerBranch = calculateRebarWeight(
          row.diameterMm,
          table.branchLengthM,
          1,
        );
        assert.ok(Math.abs(row.kgPerBranch - expectedPerBranch) < 0.01);
        assert.equal(
          row.branchesPerTon,
          Math.round(1000 / expectedPerBranch),
          `${table.id} size ${row.size}: branches per ton must follow the branch weight`,
        );
      }
    }
  }
});

test("rebar branch length is read from the catalog, never assumed", () => {
  const ribbed = reference.rebarTables.find((table) => table.id === "ribbed");
  const simple = reference.rebarTables.find((table) => table.id === "simple");

  const ribbedRows = rebarData.categories
    .find((item) => item.id === "ribbed")
    .factories.flatMap((factory) => factory.rows);
  assert.equal(
    ribbed.branchLengthM,
    Number(ribbedRows[0].branchLength),
    "ribbed branch length must match what the catalog states",
  );

  const simpleRows = rebarData.categories
    .find((item) => item.id === "simple")
    .factories.flatMap((factory) => factory.rows);
  assert.ok(
    simpleRows.every((row) => !row.branchLength),
    "fixture assumption: میلگرد ساده states no branch length",
  );
  assert.equal(
    simple.branchLengthM,
    null,
    "no branch length in the catalog means no branch weight column",
  );
});

test("stainless and alloy rebar are excluded from the weight tables", () => {
  const ids = reference.rebarTables.map((table) => table.id);
  assert.ok(!ids.includes("stainless"));
  assert.ok(!ids.includes("alloy"));
});

test("beam weights are quoted from the mills, not computed", () => {
  const category = beamData.categories.find((item) => item.id === "beam");
  const published = new Set(
    category.factories
      .flatMap((factory) => factory.rows)
      .map((row) => `${row.factory}|${row.size}|${row.approximateWeight}`),
  );

  assert.ok(reference.beamTable.rows.length > 0);
  for (const row of reference.beamTable.rows) {
    assert.ok(row.entries.length > 0);
    assert.equal(row.minKg, Math.min(...row.entries.map((e) => e.weightKg)));
    assert.equal(row.maxKg, Math.max(...row.entries.map((e) => e.weightKg)));
    for (const entry of row.entries) {
      assert.ok(
        published.has(`${entry.factory}|${row.size}|${entry.weightKg}`) ||
          published.has(
            `${entry.factory}|${row.size}|${String(entry.weightKg).replace(".", "/")}`,
          ),
        `${entry.factory} / ${row.size} weight must be a value the catalog publishes`,
      );
    }
  }
});

test("sub-catalogs with no published weight are reported, not filled in", () => {
  assert.ok(
    reference.beamTable.missingWeightLabels.length > 0,
    "هاش publishes no weights and must be surfaced as missing",
  );
  for (const label of reference.beamTable.missingWeightLabels) {
    const category = beamData.categories.find((item) => item.label === label);
    assert.ok(category);
    assert.ok(
      category.factories
        .flatMap((factory) => factory.rows)
        .every((row) => parseCatalogNumber(row.approximateWeight) === null),
      `${label} was reported as missing weights but the catalog has some`,
    );
    assert.ok(
      !reference.beamTable.rows.some((row) => row.standard === label),
      `${label} must not appear in the weight table`,
    );
  }
});

test("unit usage covers real selling units and drops one-off source typos", () => {
  const units = reference.unitUsage.map((usage) => usage.unit);
  assert.ok(units.includes("کیلوگرم"));
  assert.ok(units.includes("شاخه"));
  assert.ok(reference.unitUsage.every((usage) => usage.rowCount >= 3));

  const rareUnits = new Map();
  for (const catalog of productData.catalogs) {
    for (const category of catalog.categories) {
      for (const factory of category.factories) {
        for (const row of factory.rows) {
          rareUnits.set(row.unit, (rareUnits.get(row.unit) ?? 0) + 1);
        }
      }
    }
  }
  for (const [unit, count] of rareUnits) {
    if (count < 3) {
      assert.ok(
        !units.includes(unit),
        `unit "${unit}" appears on ${count} row(s) and must not be listed`,
      );
    }
  }

  for (const usage of reference.unitUsage) {
    assert.ok(usage.examples.length > 0);
    for (const example of usage.examples) {
      assert.match(example.href, /^\/[a-z-]+\/[a-z0-9-]+\/$/);
    }
  }
});

test("profiles describe the rebar and beam sub-catalogs the guides compare", () => {
  const keys = reference.profiles.map(
    (profile) => `${profile.groupId}/${profile.id}`,
  );
  for (const expected of [
    "rebar/ribbed",
    "rebar/simple",
    "beam/beam",
    "beam/hash",
  ]) {
    assert.ok(keys.includes(expected), `missing profile ${expected}`);
  }

  for (const profile of reference.profiles) {
    assert.equal(profile.href, `/${profile.groupId}/${profile.id}/`);
    assert.equal(profile.groupHref, `/${profile.groupId}/`);
    assert.ok(profile.rowCount > 0);
    assert.ok(profile.sizes.length > 0);
    assert.ok(profile.units.length > 0);
  }
});

test("guide definitions are complete, distinct, and correctly routed", () => {
  assert.equal(guidePageKeys.length, 5);

  const titles = new Set();
  const seoTitles = new Set();
  const descriptions = new Set();

  for (const key of guidePageKeys) {
    const definition = guidePageDefinitions[key];
    assert.ok(isGuidePageKey(key));
    assert.equal(guidePageUrl(key), `/guide/${key}/`);
    for (const field of [
      "title",
      "eyebrow",
      "description",
      "seoTitle",
      "seoDescription",
    ]) {
      assert.ok(definition[field]?.length > 0, `${key}.${field} is empty`);
    }
    assert.match(definition.lastmod, /^\d{4}-\d{2}-\d{2}$/);
    titles.add(definition.title);
    seoTitles.add(definition.seoTitle);
    descriptions.add(definition.seoDescription);
  }

  assert.equal(titles.size, guidePageKeys.length, "H1s must be distinct");
  assert.equal(seoTitles.size, guidePageKeys.length, "titles must be distinct");
  assert.equal(
    descriptions.size,
    guidePageKeys.length,
    "descriptions must be distinct",
  );
  assert.ok(!titles.has(guideIndex.title));
  assert.ok(!seoTitles.has(guideIndex.seoTitle));
  assert.equal(isGuidePageKey("not-a-guide"), false);
});
