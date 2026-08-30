import {
  priceRangesByUnit,
  categoriesPricedRows,
} from "./catalog-pricing.mjs";
import {
  productGroups,
  type ProductGroup,
  type ProductGroupId,
} from "./category-meta";
import type {
  CatalogCategory,
  CatalogSnapshot,
  GroupCatalog,
} from "./catalog-types";

export type { GroupCatalog };

export type RetryableLoader<T> = {
  (): Promise<T>;
  getCached: () => T | undefined;
  setCached: (value: T) => void;
};

/**
 * Memoise an async loader, but only its successes.
 *
 * The obvious `cached ??= load()` caches the rejected promise too, so every
 * later call replays the original failure. Clearing the slot on rejection
 * ensures the next call starts a fresh attempt, while concurrent callers
 * still share the one in flight.
 */
export function createRetryableLoader<T>(
  load: () => Promise<T>,
): RetryableLoader<T> {
  let pending: Promise<T> | undefined;
  let cachedValue: T | undefined;

  const fn = () => {
    if (cachedValue !== undefined) {
      return Promise.resolve(cachedValue);
    }
    pending ??= Promise.resolve()
      .then(load)
      .then((val) => {
        cachedValue = val;
        return val;
      })
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
    return pending;
  };

  fn.getCached = () => cachedValue;
  fn.setCached = (val: T) => {
    cachedValue = val;
    pending = Promise.resolve(val);
  };

  return fn;
}

// ---------------------------------------------------------------------------
// 1. SNAPSHOT & GROUP CATALOG INTAKE
// ---------------------------------------------------------------------------

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
 * Synchronous view for prerender and hydration.
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

/** Every group's catalog, for readers that summarise across all of them. */
export async function loadAllGroupCatalogs(): Promise<GroupCatalog[]> {
  const snapshot = await loadCatalogSnapshot();
  return snapshot.catalogs.map((catalog) =>
    enrichGroupCatalog(snapshot, catalog),
  );
}

export function primeCatalogSnapshot(
  snapshot: CatalogSnapshot | null | undefined,
) {
  if (!snapshot) return;
  loadCatalogSnapshot.setCached(snapshot);
}

// ---------------------------------------------------------------------------
// 2. MEGA MENU PROJECTION
// ---------------------------------------------------------------------------

const MAX_MENU_ENTRIES = 16;

export type MenuGroup = {
  id: ProductGroupId;
  label: string;
  initialCategoryId: string;
  groupingLabel: string;
  categories: { id: string; label: string }[];
  factories: string[];
  sizes: string[];
};

export type MenuCatalog = MenuGroup[];

function toMenuGroup(
  groupId: ProductGroupId,
  catalog: GroupCatalog,
): MenuGroup | null {
  const initialCategory =
    catalog.categories.find(
      (category) => category.id === catalog.initialCategoryId,
    ) ?? catalog.categories[0];
  if (!initialCategory) return null;

  return {
    id: groupId,
    label: catalog.label,
    initialCategoryId: initialCategory.id,
    groupingLabel: initialCategory.groupingLabel,
    categories: catalog.categories.map((category) => ({
      id: category.id,
      label: category.label,
    })),
    factories: initialCategory.filters.factories.slice(0, MAX_MENU_ENTRIES),
    sizes: initialCategory.filters.sizes.slice(0, MAX_MENU_ENTRIES),
  };
}

/**
 * Built once per build from the primed catalog caches. The dev server has no
 * prerender step, so the same function also backs the async fallback.
 */
export async function buildMenuCatalog(): Promise<MenuCatalog> {
  const groups = await Promise.all(
    productGroups.map(async (group) =>
      toMenuGroup(group.id, await loadGroupCatalog(group.id)),
    ),
  );
  return groups.filter((group): group is MenuGroup => group !== null);
}

let cachedMenuCatalog: MenuCatalog | null = null;

export function setMenuCatalog(catalog: MenuCatalog) {
  cachedMenuCatalog = catalog;
}

/**
 * Loader shaped for useCatalogData.
 */
export const loadMenuGroup = Object.assign(
  async (groupId: ProductGroupId): Promise<MenuGroup> => {
    const menuGroup = toMenuGroup(groupId, await loadGroupCatalog(groupId));
    if (!menuGroup) {
      throw new Error(`فهرست گروه ${groupId} در دسترس نیست.`);
    }
    return menuGroup;
  },
  {
    getCached: (groupId?: ProductGroupId): MenuGroup | undefined =>
      groupId
        ? (cachedMenuCatalog?.find((group) => group.id === groupId) ?? undefined)
        : undefined,
  },
);

// ---------------------------------------------------------------------------
// 3. OVERVIEW PROJECTIONS
// ---------------------------------------------------------------------------

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
  priceRanges: OverviewPriceRange[];
  date: string;
  status: string;
  percent: number;
};

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

function summariseGroup(
  group: ProductGroup,
  categories: CatalogCategory[],
): CategoryPriceOverview {
  const firstSummary = categories[0]?.summary;

  return {
    ...groupFields(group),
    priceRanges: priceRangesByUnit(categoriesPricedRows(categories)),
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
    summariseGroup(group, categoriesByGroup.get(group.id) ?? []),
  );
});

// ---------------------------------------------------------------------------
// 4. UNIFIED PRIMING INTERFACE
// ---------------------------------------------------------------------------

export type CatalogPrimingOptions = {
  snapshot?: CatalogSnapshot | null;
  menu?: MenuCatalog | null;
  overview?: CategoryPriceOverview[] | null;
};

/**
 * Prime catalog caches prior to React hydration or during SSR.
 */
export function primeCatalogReader({
  snapshot,
  menu,
  overview,
}: CatalogPrimingOptions) {
  if (snapshot) primeCatalogSnapshot(snapshot);
  if (menu) setMenuCatalog(menu);
  if (overview) loadOverviewSummaries.setCached(overview);
}
