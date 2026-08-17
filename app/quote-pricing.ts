import { createRetryableLoader } from "./catalog-cache";
import { loadBeamPriceData, loadRebarPriceData } from "./catalog-data";
import { loadProductPricePayload } from "./product-price-data";
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
};

const productCatalogMapping = {
  "ورق فولادی": "sheet",
  "پروفیل و قوطی": "profile",
  نبشی: "angle",
  ناودانی: "channel",
} as const;

function buildKilogramEstimate(
  product: QuoteProductName,
  category: CatalogCategory | undefined,
): QuotePriceEstimate | null {
  if (!category) return null;

  const prices = category.factories
    .flatMap((factory) => factory.rows)
    .filter(
      (row): row is typeof row & { price: number } =>
        row.unit === "کیلوگرم" &&
        typeof row.price === "number" &&
        Number.isFinite(row.price) &&
        row.price > 0,
    )
    .map((row) => row.price);

  if (!prices.length) return null;

  return {
    product,
    unitPriceTomanPerKg: Math.round(
      prices.reduce((sum, price) => sum + price, 0) / prices.length,
    ),
    minPriceTomanPerKg: Math.min(...prices),
    maxPriceTomanPerKg: Math.max(...prices),
    rowCount: prices.length,
    date: category.summary.date,
  };
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

  const options: QuotePieceOption[] = [];
  for (const [groupKey, { size, specification, prices }] of bySizeSpec) {
    const priceToman = Math.round(
      prices.reduce((sum, price) => sum + price, 0) / prices.length,
    );
    const localizedSize = localizeCatalogValue(size);
    const localizedSpec = specification
      ? localizeCatalogValue(specification)
      : "";
    const label = localizedSpec
      ? `${category.label} — ${localizedSize} (${category.specificationLabel}: ${localizedSpec})`
      : `${category.label} — ${localizedSize}`;
    options.push({ key: `${category.id}:${groupKey}`, label, unit, priceToman });
  }
  return options;
}

export const loadQuotePriceEstimates = createRetryableLoader(async () => {
  const [rebar, beam, productPayload] = await Promise.all([
    loadRebarPriceData(),
    loadBeamPriceData(),
    loadProductPricePayload(),
  ]);

  const estimates: Partial<
    Record<QuoteProductName, QuotePriceEstimate>
  > = {};

  const addEstimate = (
    product: QuoteProductName,
    category: CatalogCategory | undefined,
    pieceOptions: QuotePieceOption[] = [],
  ) => {
    const estimate = buildKilogramEstimate(product, category);
    if (!estimate) return;
    estimates[product] = pieceOptions.length
      ? { ...estimate, pieceOptions }
      : estimate;
  };

  addEstimate(
    "میلگرد",
    rebar.categories.find((category) => category.id === "ribbed"),
  );

  const beamCategory = beam.categories.find(
    (category) => category.id === "beam",
  );
  addEstimate(
    "تیرآهن",
    beamCategory,
    buildPieceOptions(beamCategory, "شاخه"),
  );

  addEstimate(
    "هاش",
    beam.categories.find((category) => category.id === "hash"),
  );

  for (const [product, catalogId] of Object.entries(productCatalogMapping) as Array<
    [keyof typeof productCatalogMapping, (typeof productCatalogMapping)[keyof typeof productCatalogMapping]]
  >) {
    const catalog = productPayload.catalogs.find(
      (candidate) => candidate.id === catalogId,
    );
    addEstimate(
      product,
      catalog?.categories.find(
        (category) => category.id === catalog.initialCategoryId,
      ),
    );
  }

  const pipeCatalog = productPayload.catalogs.find(
    (candidate) => candidate.id === "pipe",
  );
  const pipePieceOptions = ["api-pipe", "gas-pipe", "seamless-pipe"].flatMap(
    (id) =>
      buildPieceOptions(
        pipeCatalog?.categories.find((category) => category.id === id),
        "شاخه",
      ),
  );
  addEstimate(
    "لوله فولادی",
    pipeCatalog?.categories.find(
      (category) => category.id === pipeCatalog.initialCategoryId,
    ),
    pipePieceOptions,
  );

  const wireCatalog = productPayload.catalogs.find(
    (candidate) => candidate.id === "wire",
  );
  const wirePieceOptions = [
    ...buildPieceOptions(
      wireCatalog?.categories.find((category) => category.id === "rib-lath"),
      "برگ",
    ),
    ...buildPieceOptions(
      wireCatalog?.categories.find(
        (category) => category.id === "chicken-mesh",
      ),
      "طاقه‌ای",
    ),
    ...buildPieceOptions(
      wireCatalog?.categories.find(
        (category) => category.id === "chain-link-mesh",
      ),
      "مترمربع",
    ),
  ];
  addEstimate(
    "مفتول و سیم",
    wireCatalog?.categories.find(
      (category) => category.id === wireCatalog.initialCategoryId,
    ),
    wirePieceOptions,
  );

  return estimates;
});

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
