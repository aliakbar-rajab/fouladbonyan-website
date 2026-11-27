/**
 * The single home of category price aggregation — the code-side definition of
 * the CONTEXT.md commercial invariants:
 *
 * - what counts as a **priced row**,
 * - the **Catalog price summary** of a category (min / max / rounded average of
 *   its own positive displayed row prices),
 * - the **Displayed price summary**, the same over a category's *credible*
 *   rows, which is the one the UI and SEO copy quote,
 * - the per-Sales-unit price ranges of a set of rows,
 * - the discriminated **category pricing** result (`unavailable | mixed | range`),
 *   enforcing the **Displayable price range** Sales-unit invariant in one pass.
 *
 * Producers (the fetch pipeline, the validator) and consumers (catalog reader,
 * overview tables, summary banner, quote baselines) all import from here, so
 * "what counts as priced" can never drift between them.
 *
 * Kept dependency-free and `.mjs` so both Node (pipeline, worker, tests) and
 * the browser bundle can load it.
 */

/**
 * A category row confirmed priced. `size`/`specification` are carried so
 * quote and overview consumers can keep reading them off the same rows.
 * @typedef {{ price: number, unit: string, size?: string, specification?: string }} PricedCatalogRow
 */

/**
 * A row is priced when it carries a real, positive, finite numeric price.
 * `Price unavailable` rows carry `null` and never count.
 * @param {{ price: number | null }} row
 * @returns {boolean}
 */
export function isPricedRow(row) {
  return (
    typeof row.price === "number" && Number.isFinite(row.price) && row.price > 0
  );
}

/**
 * All priced rows of one category, across its factory groups.
 * @param {{ factories: { rows: { price: number | null, unit?: string, size?: string, specification?: string }[] }[] }} category
 * @returns {PricedCatalogRow[]}
 */
export function categoryPricedRows(category) {
  return category.factories
    .flatMap((factory) => factory.rows)
    .filter(isPricedRow);
}

/**
 * The Catalog price summary of a set of rows: min, max and rounded average of
 * the priced rows. A set with no priced rows has the literal-zero summary — a
 * known contradiction with `Price unavailable` recorded under Open questions
 * in CONTEXT.md; resolve it here, in one place, when it is resolved.
 * @param {Array<{ price: number | null }>} rows
 * @returns {{ min: number, max: number, average: number }}
 */
export function summarisePricedRows(rows) {
  const prices = rows.filter(isPricedRow).map((row) => row.price);
  if (!prices.length) return { min: 0, max: 0, average: 0 };
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    average: Math.round(
      prices.reduce((total, price) => total + price, 0) / prices.length,
    ),
  };
}

/**
 * How far one row's price may sit from its own unit's median before it stops
 * reading as this market's price at all.
 *
 * Upstream occasionally publishes a placeholder or mis-scaled figure — a
 * 1,400 تومان/kg ribbed rebar row sitting beside that same factory's own
 * 79,000 تومان/kg rows — and a single one of those drags a category's headline
 * range down to a number no buyer can act on ("در بازه‌ای بین ۱٬۵۰۰ تا
 * ۹۱٬۵۰۰ تومان").
 *
 * Deliberately loose. Steel prices within one unit rarely span even 2×; a
 * whole order of magnitude is not a wide market, it is a broken row.
 */
export const IMPLAUSIBLE_PRICE_FACTOR = 10;

/**
 * @param {number[]} values non-empty
 * @returns {number}
 */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * The priced rows of a set, minus rows whose price is implausible *for their
 * own unit*.
 *
 * Per unit, because a category priced partly per kilogram and partly per
 * branch is not carrying an outlier, it is carrying two scales — that case is
 * what categoryPricing exists to catch, and a unit-blind comparison
 * here would mistake every kilogram row in it for a broken one.
 *
 * Feed this **one category at a time**. "Implausible" only means anything
 * against rows describing the same product in the same market: pooled across a
 * whole group, ribbed rebar (~76,000 تومان/kg) and stainless rebar (~2,036,000
 * تومان/kg) are an order of magnitude apart and both entirely real, and this
 * would throw away twenty genuine rows to catch the one broken one. Use
 * categoriesCrediblePricedRows to span several categories.
 *
 * @param {Array<{ price: number | null, unit?: string }>} rows
 * @returns {PricedCatalogRow[]}
 */
export function crediblePricedRows(rows) {
  const priced = rows.filter(isPricedRow);
  const medianByUnit = new Map();
  for (const [unit, unitRows] of Map.groupBy(priced, (row) => row.unit)) {
    medianByUnit.set(unit, median(unitRows.map((row) => row.price)));
  }
  return priced.filter((row) => {
    const unitMedian = medianByUnit.get(row.unit);
    return (
      row.price >= unitMedian / IMPLAUSIBLE_PRICE_FACTOR &&
      row.price <= unitMedian * IMPLAUSIBLE_PRICE_FACTOR
    );
  });
}

/**
 * The credible priced rows of one category.
 * @param {Parameters<typeof categoryPricedRows>[0]} category
 * @returns {PricedCatalogRow[]}
 */
export function categoryCrediblePricedRows(category) {
  return crediblePricedRows(categoryPricedRows(category));
}

/**
 * The credible priced rows of several categories, judged one category at a
 * time and then pooled — never pooled first (see crediblePricedRows).
 * @param {Parameters<typeof categoryPricedRows>[0][]} categories
 * @returns {PricedCatalogRow[]}
 */
export function categoriesCrediblePricedRows(categories) {
  return categories.flatMap((category) =>
    categoryCrediblePricedRows(category),
  );
}

/**
 * One min/max range per Sales unit across the given rows. Each range stays
 * within a single unit, so no cross-unit range is ever formed here; whether a
 * category's single range may be *displayed* is decided by categoryPricing.
 * @param {Array<{ price: number | null, unit: string }>} rows
 * @returns {Array<{ unit: string, min: number, max: number }>}
 */
export function priceRangesByUnit(rows) {
  const rowsByUnit = Map.groupBy(rows.filter(isPricedRow), (row) => row.unit);
  return Array.from(rowsByUnit, ([unit, unitRows]) => {
    const prices = unitRows.map((row) => row.price);
    return { unit, min: Math.min(...prices), max: Math.max(...prices) };
  });
}

/**
 * @typedef {{ kind: "unavailable" }
 *   | { kind: "mixed", units: string[] }
 *   | { kind: "range", unit: string, min: number, max: number, average: number }} CategoryPricing
 */

/**
 * Single-pass category pricing state and Displayable price range query
 * (CONTEXT.md):
 * - `"unavailable"` when no row carries a positive price,
 * - `"mixed"` when priced rows span multiple Sales units (or carry no unit),
 * - `"range"` when all priced rows share one Sales unit and yield a positive
 *   Displayed price summary (credible rows only).
 *
 * @param {Parameters<typeof categoryPricedRows>[0]} category
 * @returns {CategoryPricing}
 */
export function categoryPricing(category) {
  const pricedRows = [];
  const unitSet = new Set();

  for (const factory of category.factories) {
    for (const row of factory.rows) {
      if (!isPricedRow(row)) continue;
      pricedRows.push(row);
      if (row.unit) unitSet.add(row.unit);
    }
  }

  if (!pricedRows.length) return { kind: "unavailable" };

  const units = [...unitSet];
  if (units.length !== 1) return { kind: "mixed", units };

  const summary = summarisePricedRows(crediblePricedRows(pricedRows));
  if (summary.min <= 0 || summary.max <= 0) return { kind: "unavailable" };

  return {
    kind: "range",
    unit: units[0],
    min: summary.min,
    max: summary.max,
    average: summary.average,
  };
}
