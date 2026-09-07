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
import type { ProductGroupId } from "../category-meta";
import { localizeCatalogValue } from "../catalog-presentation";
import type { QuotePieceOptionChoice, QuoteProductName } from "../quote-types";
import type { QuotePricingBaselines } from "./pricing-types";

type BranchWeightFormula = "rebar-12m";

type QuoteSource = {
  group: ProductGroupId;
  categoryId?: string;
  pieceSources?: { categoryId: string; unit: string }[];
  branchWeight?: BranchWeightFormula;
};

const quoteSources: Partial<Record<QuoteProductName, QuoteSource>> = {
  میلگرد: { group: "rebar", categoryId: "ribbed", branchWeight: "rebar-12m" },
  تیرآهن: {
    group: "beam",
    categoryId: "beam",
    pieceSources: [{ categoryId: "beam", unit: "شاخه" }],
  },
  هاش: { group: "beam", categoryId: "hash" },
  "ورق فولادی": { group: "sheet" },
  "پروفیل و قوطی": { group: "profile" },
  نبشی: { group: "angle" },
  ناودانی: { group: "channel" },
  "لوله فولادی": {
    group: "pipe",
    pieceSources: [
      { categoryId: "api-pipe", unit: "شاخه" },
      { categoryId: "gas-pipe", unit: "شاخه" },
      { categoryId: "seamless-pipe", unit: "شاخه" },
    ],
  },
  "مفتول و سیم": {
    group: "wire",
    pieceSources: [
      { categoryId: "rib-lath", unit: "برگ" },
      { categoryId: "chicken-mesh", unit: "طاقه‌ای" },
      { categoryId: "chain-link-mesh", unit: "مترمربع" },
    ],
  },
};

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

  for (const [product, src] of Object.entries(quoteSources) as [
    QuoteProductName,
    QuoteSource,
  ][]) {
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
      minPriceTomanPerKg: Math.min(...prices),
      maxPriceTomanPerKg: Math.max(...prices),
      rowCount: prices.length,
      date: pricedCategory.summary?.date ?? "امروز",
      pieceOptions,
      ...(src.branchWeight ? { branchWeight: src.branchWeight } : {}),
      supportsPieceUnits:
        pieceOptions.length > 0 || Boolean(src.branchWeight),
    };
  }

  return baselines;
}
