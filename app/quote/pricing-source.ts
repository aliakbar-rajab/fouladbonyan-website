import {
  categoryCrediblePricedRows,
  isPricedRow,
} from "../catalog-pricing.mjs";
import type {
  CatalogCategory,
  CatalogRow,
  CatalogSnapshot,
  GroupCatalog,
} from "../catalog-types";
import { localizeCatalogValue } from "../catalog-presentation";
import type {
  QuotePieceOptionChoice,
  QuotePricingBaselines,
} from "../quote-types";
import { quoteProductCatalog, quoteProductNames } from "./products";

const averageToman = (prices: number[]) =>
  Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);

/**
 * The per-kilogram prices a `Price estimate` averages.
 *
 * Credible rows, not every priced row -- the same rows the catalog page
 * averages into its `Displayed price summary`. Reading the raw rows here meant
 * a placeholder upstream price fed the pre-invoice after the page above it had
 * already excluded that row: ribbed rebar carries one 1,400 تومان/kg row
 * beside a 75,100 median, and it put the estimate 354 تومان/kg below the
 * average the visitor had just read on the same category's own page.
 */
function extractKilogramPrices(category: CatalogCategory): number[] {
  return categoryCrediblePricedRows(category)
    .filter((row) => row.unit === "کیلوگرم")
    .map((row) => row.price);
}

function extractPieceOptions(
  category: CatalogCategory | undefined,
  unit: string,
): QuotePieceOptionChoice[] {
  if (!category) return [];

  /*
   * Every priced row of this unit, not only the credible ones. A piece option
   * is a row the visitor picks by name, the same way the catalog table shows
   * every row's real price; credibility is a question about aggregates.
   */
  return category.factories
    .flatMap((factory) => factory.rows)
    .filter(
      (row): row is CatalogRow & { price: number } =>
        row.unit === unit && isPricedRow(row),
    )
    .map((row) => ({
      key: `${category.id}:${row.id}`,
      label: localizeCatalogValue(row.title),
      unit,
      priceToman: row.price,
    }));
}

function normalizeToGroupCatalogs(
  source: CatalogSnapshot | GroupCatalog[] | null | undefined,
): GroupCatalog[] {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if ("catalogs" in source && Array.isArray(source.catalogs)) {
    return source.catalogs;
  }
  return [];
}

/**
 * Extract quote pricing baselines directly from catalog data.
 */
export function extractQuotePricingBaselines(
  source: CatalogSnapshot | GroupCatalog[] | null | undefined,
): QuotePricingBaselines {
  const catalogsList = normalizeToGroupCatalogs(source);
  const catalogs = new Map(
    catalogsList.map((catalog) => [catalog.id, catalog]),
  );
  const baselines: QuotePricingBaselines = {};

  for (const product of quoteProductNames) {
    const src = quoteProductCatalog(product);
    if (!src) continue;
    const catalog = catalogs.get(src.group);
    if (!catalog) continue;

    const categoryOf = (id: string) =>
      catalog.categories.find((category) => category.id === id);

    const pricedCategory = categoryOf(
      src.categoryId ?? catalog.initialCategoryId,
    );
    if (!pricedCategory) continue;

    const prices = extractKilogramPrices(pricedCategory);
    if (!prices.length) continue;

    const pieceOptions = (src.pieceSources ?? []).flatMap(
      ({ categoryId, unit }) => extractPieceOptions(categoryOf(categoryId), unit),
    );

    baselines[product] = {
      product,
      unitPriceTomanPerKg: averageToman(prices),
      pieceOptions,
      ...(src.branchWeight ? { branchWeight: src.branchWeight } : {}),
    };
  }

  return baselines;
}
