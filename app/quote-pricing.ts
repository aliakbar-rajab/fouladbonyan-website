import { createRetryableLoader } from "./catalog-cache";
import { calculateRebarWeight } from "./catalog-behavior.mjs";
import { loadAllGroupCatalogs } from "./group-catalog";
import type { ProductGroupId } from "./category-meta";
import type { CatalogCategory } from "./catalog-types";
import { localizeCatalogValue } from "./catalog-utils";

export type QuoteProductName =
  | "میلگرد"
  | "تیرآهن"
  | "هاش"
  | "ورق فولادی"
  | "پروفیل و قوطی"
  | "لوله فولادی"
  | "نبشی"
  | "ناودانی"
  | "مفتول و سیم"
  | "سایر محصولات فولادی";

/**
 * A representation change, not markup or VAT: market prices are published in
 * toman, and a generated quote document states its totals in rial.
 */
export const RIAL_PER_TOMAN = 10;

export const tomanToRial = (toman: number) => toman * RIAL_PER_TOMAN;

/**
 * Standard commercial rebar branch length in Iran; used only to estimate a
 * per-branch weight when a buyer orders by شاخه/عدد instead of by weight.
 */
export const REBAR_STANDARD_BRANCH_LENGTH_M = 12;

/** How a per-piece weight is derived for a product priced only by weight. */
type BranchWeightFormula = "rebar-12m";

// A single, real, orderable item pulled directly from the site's own price
// catalogs: its own label, its own unit (شاخه/برگ/طاقه‌ای/مترمربع/...), and an
// averaged real price. Never a computed/estimated weight conversion.
export type QuotePieceOption = {
  key: string;
  label: string;
  unit: string;
  priceToman: number;
};

export type QuotePriceEstimate = {
  product: QuoteProductName;
  unitPriceTomanPerKg: number;
  minPriceTomanPerKg: number;
  maxPriceTomanPerKg: number;
  rowCount: number;
  date: string;
  // Real, catalog-priced, per-piece options (size/type + real unit + real
  // averaged price). Only present for products whose catalog actually prices
  // specific items outside کیلوگرم/تن.
  pieceOptions?: QuotePieceOption[];
  branchWeight?: BranchWeightFormula;
  /**
   * Whether شاخه/عدد can be priced for this product at all -- either from real
   * piece prices or from a branch weight formula. The form asks this instead
   * of keeping its own list of products.
   */
  supportsPieceUnits: boolean;
};

export type QuotePriceEstimates = Partial<
  Record<QuoteProductName, QuotePriceEstimate>
>;

/**
 * Where each quotable product's prices come from.
 *
 * `categoryId` defaults to the catalog's own initial category. `pieceSources`
 * are the categories that publish real per-piece prices, with the unit each
 * one prices in. A product absent from this table has no estimate; the form
 * still accepts it and sends the buyer to the sales desk.
 */
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

function kilogramPrices(category: CatalogCategory) {
  return category.factories
    .flatMap((factory) => factory.rows)
    .filter(
      (row): row is typeof row & { price: number } =>
        row.unit === "کیلوگرم" &&
        typeof row.price === "number" &&
        Number.isFinite(row.price) &&
        row.price > 0,
    )
    .map((row) => row.price);
}

// Some catalog (sub)categories already price specific sizes directly in a
// real, non-weight unit (e.g. تیرآهن by شاخه, رابیتس by برگ, توری مرغی by
// طاقه‌ای, توری حصاری by مترمربع). Average those real prices by size instead
// of estimating anything, so buyers can order the way they actually ask for
// these products.
function buildPieceOptions(
  category: CatalogCategory | undefined,
  unit: string,
): QuotePieceOption[] {
  if (!category) return [];

  const bySizeSpec = new Map<
    string,
    { size: string; specification?: string; prices: number[] }
  >();

  for (const row of category.factories.flatMap((factory) => factory.rows)) {
    if (
      row.unit !== unit ||
      typeof row.price !== "number" ||
      !Number.isFinite(row.price) ||
      row.price <= 0 ||
      !row.size
    ) {
      continue;
    }
    const groupKey = `${row.size}|${row.specification ?? ""}`;
    const entry = bySizeSpec.get(groupKey) ?? {
      size: row.size,
      specification: row.specification,
      prices: [],
    };
    entry.prices.push(row.price);
    bySizeSpec.set(groupKey, entry);
  }

  return [...bySizeSpec].map(([groupKey, { size, specification, prices }]) => {
    const localizedSize = localizeCatalogValue(size);
    const localizedSpec = specification
      ? localizeCatalogValue(specification)
      : "";
    return {
      key: `${category.id}:${groupKey}`,
      label: localizedSpec
        ? `${category.label} — ${localizedSize} (${category.specificationLabel}: ${localizedSpec})`
        : `${category.label} — ${localizedSize}`,
      unit,
      priceToman: averageToman(prices),
    };
  });
}

export const loadQuotePriceEstimates = createRetryableLoader(async () => {
  const catalogs = new Map(
    (await loadAllGroupCatalogs()).map((catalog) => [catalog.id, catalog]),
  );
  const estimates: QuotePriceEstimates = {};

  for (const [product, source] of Object.entries(quoteSources) as [
    QuoteProductName,
    QuoteSource,
  ][]) {
    const catalog = catalogs.get(source.group);
    if (!catalog) continue;

    const categoryOf = (id: string) =>
      catalog.categories.find((category) => category.id === id);

    const pricedCategory = categoryOf(
      source.categoryId ?? catalog.initialCategoryId,
    );
    if (!pricedCategory) continue;

    const prices = kilogramPrices(pricedCategory);
    if (!prices.length) continue;

    const pieceOptions = (source.pieceSources ?? []).flatMap(
      ({ categoryId, unit }) => buildPieceOptions(categoryOf(categoryId), unit),
    );

    estimates[product] = {
      product,
      unitPriceTomanPerKg: averageToman(prices),
      minPriceTomanPerKg: Math.min(...prices),
      maxPriceTomanPerKg: Math.max(...prices),
      rowCount: prices.length,
      date: pricedCategory.summary.date,
      ...(pieceOptions.length ? { pieceOptions } : {}),
      ...(source.branchWeight ? { branchWeight: source.branchWeight } : {}),
      supportsPieceUnits:
        pieceOptions.length > 0 || Boolean(source.branchWeight),
    };
  }

  return estimates;
});

export function resolvePieceOption(
  pieceOptionKey: string,
  estimate: QuotePriceEstimate | undefined,
) {
  if (!pieceOptionKey || !estimate?.pieceOptions) return undefined;
  return estimate.pieceOptions.find((option) => option.key === pieceOptionKey);
}

export function calculateApproximateTotal(
  unitPriceTomanPerKg: number,
  quantity: number,
  unit: string,
) {
  if (
    !Number.isFinite(unitPriceTomanPerKg) ||
    unitPriceTomanPerKg <= 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  const weightInKg =
    unit === "تن" ? quantity * 1_000 : unit === "کیلوگرم" ? quantity : null;
  if (weightInKg === null) return null;

  return Math.round(unitPriceTomanPerKg * weightInKg);
}

/** What the priced part of a quote row needs to know about itself. */
export type QuoteItemPricing = {
  unit: string;
  quantity: string;
  rebarDiameterMm: string;
  pieceOptionKey: string;
};

/**
 * The toman total for one quote row, or null when it cannot be estimated:
 * an unpriceable unit, a missing diameter, or a quantity that is not a
 * positive number.
 */
export function priceQuoteItem(
  item: QuoteItemPricing,
  estimate: QuotePriceEstimate | undefined,
): number | null {
  if (!estimate) return null;
  const quantity = Number(item.quantity);

  const pieceOption = resolvePieceOption(item.pieceOptionKey, estimate);
  if (pieceOption) {
    return Number.isFinite(quantity) && quantity > 0
      ? Math.round(pieceOption.priceToman * quantity)
      : null;
  }

  if (item.unit === "تن" || item.unit === "کیلوگرم") {
    return calculateApproximateTotal(
      estimate.unitPriceTomanPerKg,
      quantity,
      item.unit,
    );
  }

  if (estimate.branchWeight === "rebar-12m" && item.rebarDiameterMm) {
    const weightKg = calculateRebarWeight(
      Number(item.rebarDiameterMm),
      REBAR_STANDARD_BRANCH_LENGTH_M,
      Math.trunc(quantity),
    );
    return weightKg
      ? Math.round(estimate.unitPriceTomanPerKg * weightKg)
      : null;
  }

  return null;
}
