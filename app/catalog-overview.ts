import { createRetryableLoader } from "./catalog-cache";
import { loadAllGroupCatalogs } from "./group-catalog";
import { productGroups, type ProductGroup, type ProductGroupId } from "./category-meta";
import type { CatalogCategory } from "./catalog-types";

export type CategoryPriceOverview = {
  id: ProductGroupId;
  label: string;
  shortLabel: string;
  subTypes: string;
  image: string;
  description: string;
  minPrice: number | null;
  maxPrice: number | null;
  unit: string;
  date: string;
  status: string;
  percent: number;
};

/** Groups whose catalog prices some rows by the piece as well as by weight. */
const pieceAndWeightGroups: ProductGroupId[] = ["beam", "pipe"];

const overviewUnit = (groupId: ProductGroupId) =>
  pieceAndWeightGroups.includes(groupId) ? "شاخه / کیلوگرم" : "کیلوگرم";

/** The fields every overview takes straight from the group, priced or not. */
const groupFields = (group: ProductGroup) => ({
  id: group.id,
  label: group.label,
  shortLabel: group.shortLabel,
  subTypes: group.subTypes,
  image: group.image,
  description: group.description,
  unit: overviewUnit(group.id),
});

export function buildFallbackOverviews(): CategoryPriceOverview[] {
  return productGroups.map((group) => ({
    ...groupFields(group),
    minPrice: null,
    maxPrice: null,
    date: "امروز",
    status: "steady",
    percent: 0,
  }));
}

function summarise(
  group: ProductGroup,
  categories: CatalogCategory[],
): CategoryPriceOverview {
  const positive = (values: number[]) =>
    values.filter((value) => typeof value === "number" && value > 0);

  const minValues = positive(categories.map((item) => item.summary.min));
  const maxValues = positive(categories.map((item) => item.summary.max));
  const firstSummary = categories[0]?.summary;

  return {
    ...groupFields(group),
    minPrice: minValues.length ? Math.min(...minValues) : null,
    maxPrice: maxValues.length ? Math.max(...maxValues) : null,
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
