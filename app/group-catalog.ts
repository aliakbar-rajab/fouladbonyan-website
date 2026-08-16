import { loadBeamPriceData, loadRebarPriceData } from "./catalog-data";
import { loadProductPriceCatalog } from "./product-price-data";
import {
  isProductCatalogId,
  productGroups,
  type ProductGroupId,
} from "./category-meta";
import type { CatalogCategory } from "./catalog-types";

export type GroupCatalog = {
  label: string;
  initialCategoryId: string;
  categories: CatalogCategory[];
};

// Rebar and beam ship as their own snapshots; every other group is a catalog
// inside the shared product payload. Callers only ever want the common shape.
const ownSnapshots = {
  rebar: { load: loadRebarPriceData, initialCategoryId: "ribbed" },
  beam: { load: loadBeamPriceData, initialCategoryId: "beam" },
} as const;

/** The category a group opens on, or undefined when the catalog decides. */
export function initialCategoryIdOf(groupId: ProductGroupId) {
  return groupId in ownSnapshots
    ? ownSnapshots[groupId as keyof typeof ownSnapshots].initialCategoryId
    : undefined;
}

export async function loadGroupCatalog(
  groupId: ProductGroupId,
): Promise<GroupCatalog> {
  if (isProductCatalogId(groupId)) {
    return loadProductPriceCatalog(groupId);
  }
  const snapshot = ownSnapshots[groupId as keyof typeof ownSnapshots];
  const { categories } = await snapshot.load();
  const group = productGroups.find((item) => item.id === groupId);
  return {
    label: group?.label ?? groupId,
    initialCategoryId: snapshot.initialCategoryId,
    categories,
  };
}
