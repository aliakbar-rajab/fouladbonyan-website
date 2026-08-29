import type {
  CatalogCategory,
  CatalogSnapshot,
  GroupCatalog,
} from "../catalog-types";
import type { ProductGroupId } from "../category-meta";
import { localizeCatalogValue } from "../catalog-utils";
import type { QuotePieceOptionChoice, QuoteProductName } from "../quote-types";

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

export type ProductPricingBaseline = {
  product: QuoteProductName;
  unitPriceTomanPerKg: number;
  minPriceTomanPerKg: number;
  maxPriceTomanPerKg: number;
  rowCount: number;
  date: string;
  pieceOptions: QuotePieceOptionChoice[];
  branchWeight?: "rebar-12m";
  supportsPieceUnits: boolean;
};

export type QuotePricingBaselines = Partial<
  Record<QuoteProductName, ProductPricingBaseline>
>;

const averageToman = (prices: number[]) =>
  Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);

function extractKilogramPrices(category: CatalogCategory): number[] {
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

function extractPieceOptions(
  category: CatalogCategory | undefined,
  unit: string,
): QuotePieceOptionChoice[] {
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
