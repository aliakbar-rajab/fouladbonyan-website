import { createRetryableLoader } from "./catalog-cache";
import type {
  CatalogSnapshot,
  GroupCatalog,
  ProductGroupId,
} from "./catalog-types";

export type { GroupCatalog };

export const loadCatalogSnapshot = createRetryableLoader(
  () =>
    import("./data/catalog-prices.json").then(
      (module) => module.default,
    ) as Promise<CatalogSnapshot>,
);

const defaultInitialCategories: Record<ProductGroupId, string> = {
  rebar: "ribbed",
  beam: "beam",
  sheet: "black-sheet",
  profile: "box-profile",
  pipe: "scaffold-pipe",
  angle: "angle",
  channel: "channel",
  wire: "wire",
};

function enrichGroupCatalog(
  snapshot: CatalogSnapshot,
  group: GroupCatalog,
): GroupCatalog {
  return {
    ...group,
    fetchedAt: snapshot.fetchedAt,
    sourceName: snapshot.sourceName,
    sourceHome: snapshot.sourceHome,
    taxRate: snapshot.taxRate,
  };
}

/** The category a group opens on. */
export function initialCategoryIdOf(groupId: ProductGroupId): string {
  const cached = loadCatalogSnapshot.getCached();
  const catalog = cached?.catalogs.find((c) => c.id === groupId);
  return catalog?.initialCategoryId ?? defaultInitialCategories[groupId] ?? "";
}

export async function loadGroupCatalog(
  groupId: ProductGroupId,
): Promise<GroupCatalog> {
  const snapshot = await loadCatalogSnapshot();
  const catalog = snapshot.catalogs.find((item) => item.id === groupId);
  if (!catalog) {
    throw new Error(`داده قیمت گروه ${groupId} در دسترس نیست.`);
  }
  return enrichGroupCatalog(snapshot, catalog);
}

/**
 * The synchronous view, for prerender and hydration.
 */
loadGroupCatalog.getCached = (
  groupId?: ProductGroupId,
): GroupCatalog | undefined => {
  if (!groupId) return undefined;
  const snapshot = loadCatalogSnapshot.getCached();
  if (!snapshot) return undefined;
  const catalog = snapshot.catalogs.find((item) => item.id === groupId);
  return catalog ? enrichGroupCatalog(snapshot, catalog) : undefined;
};

/** Every group's catalog, for the readers that summarise across all of them. */
export async function loadAllGroupCatalogs(): Promise<GroupCatalog[]> {
  const snapshot = await loadCatalogSnapshot();
  return snapshot.catalogs.map((catalog) =>
    enrichGroupCatalog(snapshot, catalog),
  );
}

/** Prime the canonical snapshot cache before hydrating. */
export function primeCatalogSnapshot(
  snapshot: CatalogSnapshot | null | undefined,
) {
  if (!snapshot) return;
  loadCatalogSnapshot.setCached(snapshot);
}

