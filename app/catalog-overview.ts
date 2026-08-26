import { createRetryableLoader } from "./catalog-cache";
import { loadAllGroupCatalogs } from "./group-catalog";
import { productGroups, type ProductGroup, type ProductGroupId } from "./category-meta";
import type { CatalogCategory } from "./catalog-types";

export type OverviewPriceRange = {
  unit: string;
  min: number;
  max: number;
};

export type CategoryPriceOverview = {
  id: ProductGroupId;
  label: string;
  shortLabel: string;
  subTypes: string;
  image: string;
  description: string;
  /**
   * One entry per unit actually quoted for this group (e.g. تیرآهن prices
   * some rows by weight and others by the full bar) -- never a single range
   * spanning two incompatible units.
   */
  priceRanges: OverviewPriceRange[];
  date: string;
  status: string;
  percent: number;
};

/** The fields every overview takes straight from the group, priced or not. */
const groupFields = (group: ProductGroup) => ({
  id: group.id,
  label: group.label,
  shortLabel: group.shortLabel,
  subTypes: group.subTypes,
  image: group.image,
  description: group.description,
});

export function buildFallbackOverviews(): CategoryPriceOverview[] {
  return productGroups.map((group) => ({
    ...groupFields(group),
    priceRanges: [],
    date: "امروز",
    status: "steady",
    percent: 0,
  }));
}

/** Real per-unit price ranges from row-level data, so a group that quotes
 * both شاخه and کیلوگرم prices never gets collapsed into one misleading
 * range spanning both. */
function priceRangesByUnit(categories: CatalogCategory[]): OverviewPriceRange[] {
  const pricesByUnit = new Map<string, number[]>();
  for (const category of categories) {
    for (const factory of category.factories) {
      for (const row of factory.rows) {
        if (typeof row.price !== "number" || row.price <= 0) continue;
        const prices = pricesByUnit.get(row.unit) ?? [];
        prices.push(row.price);
        pricesByUnit.set(row.unit, prices);
      }
    }
  }

  return Array.from(pricesByUnit, ([unit, prices]) => ({
    unit,
    min: Math.min(...prices),
    max: Math.max(...prices),
  }));
}

function summarise(
  group: ProductGroup,
  categories: CatalogCategory[],
): CategoryPriceOverview {
  const firstSummary = categories[0]?.summary;

  return {
    ...groupFields(group),
    priceRanges: priceRangesByUnit(categories),
    date: firstSummary?.date || "امروز",
    status: firstSummary?.status || "steady",
    percent: firstSummary?.percent || 0,
  };
}

export const loadOverviewSummaries = createRetryableLoader<
  CategoryPriceOverview[]
>(async () => {
  const catalogs = await loadAllGroupCatalogs();
  const categoriesByGroup = new Map(
    catalogs.map((catalog) => [catalog.id, catalog.categories]),
  );

  return productGroups.map((group) =>
    summarise(group, categoriesByGroup.get(group.id) ?? []),
  );
});
