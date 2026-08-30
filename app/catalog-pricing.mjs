/**
 * The single home of category price aggregation — the code-side definition of
 * the CONTEXT.md commercial invariants:
 *
 * - what counts as a **priced row**,
 * - the **Catalog price summary** of a category (min / max / rounded average of
 *   its own positive displayed row prices),
 * - the per-Sales-unit price ranges of a set of rows,
 * - the pricing state (has prices, which Sales units),
 * - whether a summary is a **Displayable price range** (all priced rows share
 *   one unit and the range is positive).
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
 * All priced rows of several categories (e.g. every category of a group).
 * @param {Parameters<typeof categoryPricedRows>[0][]} categories
 * @returns {PricedCatalogRow[]}
 */
export function categoriesPricedRows(categories) {
  return categories.flatMap((category) => categoryPricedRows(category));
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
 * One min/max range per Sales unit across the given rows. Each range stays
 * within a single unit, so no cross-unit range is ever formed here; whether a
 * particular range may be *displayed* is decided by hasDisplayablePriceRange.
 * @param {Array<{ price: number | null, unit: string }>} rows
 * @returns {Array<{ unit: string, min: number, max: number }>}
 */
export function priceRangesByUnit(rows) {
  const pricesByUnit = new Map();
  for (const row of rows) {
    if (!isPricedRow(row)) continue;
    const prices = pricesByUnit.get(row.unit) ?? [];
    prices.push(row.price);
    pricesByUnit.set(row.unit, prices);
  }
  return Array.from(pricesByUnit, ([unit, prices]) => ({
    unit,
    min: Math.min(...prices),
    max: Math.max(...prices),
  }));
}

/**
 * The pricing state of a category: whether it has any priced rows, and which
 * non-empty Sales units those rows use.
 * @param {Parameters<typeof categoryPricedRows>[0]} category
 * @returns {{ hasPrices: boolean, units: string[] }}
 */
export function categoryPricingState(category) {
  const pricedRows = categoryPricedRows(category);
  return {
    hasPrices: pricedRows.length > 0,
    units: [...new Set(pricedRows.map((row) => row.unit).filter(Boolean))],
  };
}

/**
 * Displayable price range eligibility (CONTEXT.md): a category's summary may
 * be shown as a price range only when all of its priced rows share one unit
 * and the summary is a positive range. A mixed-unit or unpriced category must
 * direct users to its row-level prices instead.
 * @param {{ units: string[] }} pricingState
 * @param {{ min: number, max: number }} summary
 * @returns {boolean}
 */
export function hasDisplayablePriceRange(pricingState, summary) {
  return (
    pricingState.units.length === 1 && summary.min > 0 && summary.max > 0
  );
}
