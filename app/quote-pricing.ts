import { createRetryableLoader } from "./catalog-cache";
import { loadAllGroupCatalogs } from "./group-catalog";
import type { CatalogCategory, GroupCatalog } from "./catalog-types";
import { localizeCatalogValue } from "./catalog-utils";
import {
  calculateApproximateTotal,
  deriveQuoteItemPricing,
  deriveQuotePricing,
  REBAR_STANDARD_BRANCH_LENGTH_M,
  resolvePieceOption,
  RIAL_PER_TOMAN,
  tomanToRial,
} from "./quote-engine";
import type {
  QuotePieceOption,
  QuotePriceEstimate,
  QuotePriceEstimates,
  QuoteProductName,
  QuoteUnit,
} from "./quote-types";

export type {
  QuotePieceOption,
  QuotePriceEstimate,
  QuotePriceEstimates,
  QuoteProductName,
  QuoteUnit,
};

export {
  RIAL_PER_TOMAN,
  tomanToRial,
  REBAR_STANDARD_BRANCH_LENGTH_M,
  calculateApproximateTotal,
  resolvePieceOption,
  deriveQuoteItemPricing,
  deriveQuotePricing,
};

import type { ProductGroupId } from "./category-meta";

/** How a per-piece weight is derived for a product priced only by weight. */
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

/**
 * Pure function to derive QuotePriceEstimates from group catalogs.
 */
export function deriveQuoteEstimates(
  catalogsList: GroupCatalog[],
): QuotePriceEstimates {
  const catalogs = new Map(
    catalogsList.map((catalog) => [catalog.id, catalog]),
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
}

export const loadQuotePriceEstimates = createRetryableLoader(async () => {
  const catalogs = await loadAllGroupCatalogs();
  return deriveQuoteEstimates(catalogs);
});

/** @deprecated Use deriveQuoteItemPricing in quote-engine.ts */
export function priceQuoteItem(
  item: {
    unit: string;
    quantity: string;
    rebarDiameterMm?: string;
    pieceOptionKey?: string;
    product?: QuoteProductName | "";
  },
  estimate: QuotePriceEstimate | undefined,
): number | null {
  const derived = deriveQuoteItemPricing(
    {
      id: 1,
      product: estimate?.product ?? "",
      quantity: item.quantity,
      unit: (item.unit as QuoteUnit) ?? "تن",
      dimensions: "",
      rebarDiameterMm: item.rebarDiameterMm ?? "",
      pieceOptionKey: item.pieceOptionKey ?? "",
    },
    estimate ? { [estimate.product]: estimate } : {},
  );
  return derived.approximateTotalToman;
}

