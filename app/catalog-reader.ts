import {
  priceRangesByUnit,
  categoriesCrediblePricedRows,
} from "./catalog-pricing.mjs";
import { initialCategoryIdOf as taxonomyInitialCategoryIdOf } from "./catalog-taxonomy.mjs";
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
import {
  summarizeCatalogDates,
  summarizeCatalogTrends,
} from "./catalog-trend.mjs";

export type { GroupCatalog };

export type RetryableLoader<T> = {
  (): Promise<T>;
  getCached: () => T | undefined;
  setCached: (value: T) => void;
  reset: () => void;
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
  let generation = 0;

  const fn = () => {
    if (cachedValue !== undefined) {
      return Promise.resolve(cachedValue);
    }
    const attempt = generation;
    pending ??= Promise.resolve()
      .then(load)
      .then((val) => {
        if (generation === attempt) {
          cachedValue = val;
        }
        return val;
      })
      .catch((error: unknown) => {
        if (generation === attempt) {
          pending = undefined;
        }
        throw error;
      });
    return pending;
  };

  fn.getCached = () => cachedValue;
  fn.setCached = (val: T) => {
    generation += 1;
    cachedValue = val;
    pending = Promise.resolve(val);
  };
  fn.reset = () => {
    generation += 1;
    cachedValue = undefined;
    pending = undefined;
  };

  return fn;
}

// ---------------------------------------------------------------------------
// 1. SNAPSHOT SCOPING & GROUP CATALOG STORE
// ---------------------------------------------------------------------------

type CatalogReaderStore = {
  snapshot: CatalogSnapshot | undefined;
  pendingFullSnapshot: Promise<CatalogSnapshot> | undefined;
  menuCatalog: MenuCatalog | null;
  generation: number;
};

const store: CatalogReaderStore = {
  snapshot: undefined,
  pendingFullSnapshot: undefined,
  menuCatalog: null,
  generation: 0,
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

function stubCategory(category: CatalogCategory): CatalogCategory {
  return {
    ...category,
    filters: { sizes: [], factories: [] },
    factories: [],
  };
}

function isFullGroupCatalog(group: GroupCatalog): boolean {
  return (
    group.categories.length > 0 &&
    group.categories.every((category) => category.factories.length > 0)
  );
}

/**
 * Build a route-scoped CatalogSnapshot containing only one product group, and
 * optionally only one active subcategory's rows (stubbing sibling categories so
 * tab navigation renders identically during SSR/hydration while keeping HTML
 * payloads small).
 *
 * Owning both scoping and partial-group detection inside this module keeps the
 * stubbed-category wire representation internal to catalog-reader.ts.
 */
export function scopeCatalogSnapshot(
  snapshot: CatalogSnapshot,
  groupId: ProductGroupId,
  subcategoryId?: string,
): CatalogSnapshot {
  const catalog = snapshot.catalogs.find((item) => item.id === groupId);
  if (!catalog) {
    throw new Error(`داده قیمت گروه ${groupId} در دسترس نیست.`);
  }
  const enriched = enrichGroupCatalog(snapshot, catalog);
  if (
    subcategoryId !== undefined &&
    !enriched.categories.some((entry) => entry.id === subcategoryId)
  ) {
    throw new Error(`زیردسته ${subcategoryId} در گروه ${groupId} یافت نشد.`);
  }

  const scopedCatalog: GroupCatalog =
    subcategoryId !== undefined
      ? {
          ...enriched,
          categories: enriched.categories.map((entry) =>
            entry.id === subcategoryId ? entry : stubCategory(entry),
          ),
        }
      : enriched;

  return {
    fetchedAt: snapshot.fetchedAt,
    sourceName: snapshot.sourceName,
    sourceHome: snapshot.sourceHome,
    taxRate: snapshot.taxRate,
    catalogs: [scopedCatalog],
  };
}

export const loadCatalogSnapshot = Object.assign(
  async (): Promise<CatalogSnapshot> => {
    if (
      store.snapshot !== undefined &&
      store.snapshot.catalogs.length >= productGroups.length &&
      store.snapshot.catalogs.every(isFullGroupCatalog)
    ) {
      return store.snapshot;
    }
    const attempt = store.generation;
    store.pendingFullSnapshot ??= import("./data/catalog-prices.json")
      .then((module) => module.default as CatalogSnapshot)
      .then((full) => {
        if (store.generation !== attempt) {
          return full;
        }
        if (store.snapshot) {
          // A subcategory route primes only one category inside its group and
          // leaves sibling categories stubbed. Merge full groups over any
          // partial/stubbed group when the complete snapshot loads.
          const cachedById = new Map(
            store.snapshot.catalogs.map((c) => [c.id, c]),
          );
          store.snapshot = {
            ...full,
            ...store.snapshot,
            catalogs: full.catalogs.map((fullCatalog) => {
              const existing = cachedById.get(
                fullCatalog.id as ProductGroupId,
              );
              return existing && isFullGroupCatalog(existing)
                ? existing
                : fullCatalog;
            }),
          };
        } else {
          store.snapshot = full;
        }
        store.pendingFullSnapshot = undefined;
        return store.snapshot;
      })
      .catch((error: unknown) => {
        if (store.generation === attempt) {
          store.pendingFullSnapshot = undefined;
        }
        throw error;
      });
    return store.pendingFullSnapshot;
  },
  {
    getCached: () => store.snapshot,
    setCached: (val: CatalogSnapshot) => {
      if (store.snapshot) {
        const newIds = new Set(val.catalogs.map((c) => c.id));
        const kept = store.snapshot.catalogs.filter(
          (c) => !newIds.has(c.id as ProductGroupId),
        );
        store.snapshot = {
          ...store.snapshot,
          ...val,
          catalogs: [...val.catalogs, ...kept],
        };
      } else {
        store.snapshot = val;
      }
    },
  },
);

/** The category a group opens on. */
export function initialCategoryIdOf(groupId: ProductGroupId): string {
  const cached = loadCatalogSnapshot.getCached();
  const catalog = cached?.catalogs.find((c) => c.id === groupId);
  return (
    catalog?.initialCategoryId ?? taxonomyInitialCategoryIdOf(groupId) ?? ""
  );
}

export async function loadGroupCatalog(
  groupId: ProductGroupId,
): Promise<GroupCatalog> {
  const cached = loadGroupCatalog.getCached(groupId);
  if (cached && isFullGroupCatalog(cached)) return cached;
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
 * Built from an explicit snapshot (build / SSR) or from the catalog store when
 * no snapshot is provided (dev server async fallback).
 */
export async function buildMenuCatalog(
  snapshot?: CatalogSnapshot,
): Promise<MenuCatalog> {
  if (snapshot) {
    return productGroups
      .map((group) => {
        const catalog = snapshot.catalogs.find((item) => item.id === group.id);
        if (!catalog) {
          throw new Error(`داده قیمت گروه ${group.id} در دسترس نیست.`);
        }
        return toMenuGroup(group.id, enrichGroupCatalog(snapshot, catalog));
      })
      .filter((group): group is MenuGroup => group !== null);
  }
  const groups = await Promise.all(
    productGroups.map(async (group) =>
      toMenuGroup(group.id, await loadGroupCatalog(group.id)),
    ),
  );
  return groups.filter((group): group is MenuGroup => group !== null);
}

export function setMenuCatalog(catalog: MenuCatalog) {
  store.menuCatalog = catalog;
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
        ? (store.menuCatalog?.find((group) => group.id === groupId) ?? undefined)
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
    status: "same",
    percent: 0,
  }));
}

function summariseGroup(
  group: ProductGroup,
  categories: CatalogCategory[],
): CategoryPriceOverview {
  const summaries = categories.map((category) => category.summary);
  const trend = summarizeCatalogTrends(summaries);

  return {
    ...groupFields(group),
    // Credible rows, judged per category: an upstream row carrying a
    // placeholder price would otherwise set this group's advertised floor on
    // the home page. See crediblePricedRows for why the judgement cannot be
    // made across the pooled group.
    priceRanges: priceRangesByUnit(categoriesCrediblePricedRows(categories)),
    date: summarizeCatalogDates(summaries),
    status: trend.status,
    percent: trend.percent,
  };
}

export function buildOverviewSummaries(
  snapshot: CatalogSnapshot,
): CategoryPriceOverview[] {
  const categoriesByGroup = new Map(
    snapshot.catalogs.map((catalog) => [catalog.id, catalog.categories]),
  );

  return productGroups.map((group) =>
    summariseGroup(group, categoriesByGroup.get(group.id) ?? []),
  );
}

export const loadOverviewSummaries = createRetryableLoader<
  CategoryPriceOverview[]
>(async () => buildOverviewSummaries(await loadCatalogSnapshot()));

// ---------------------------------------------------------------------------
// 4. UNIFIED STORE LIFECYCLE (PRIME & RESET)
// ---------------------------------------------------------------------------

export type CatalogPrimingOptions = {
  snapshot?: CatalogSnapshot | null;
  menu?: MenuCatalog | null;
  overview?: CategoryPriceOverview[] | null;
};

/**
 * Clear all cached snapshots, projections, and in-flight loads so a subsequent
 * SSR build or in-process hydration run starts from an empty catalog store.
 */
export function resetCatalogReader() {
  store.generation += 1;
  store.snapshot = undefined;
  store.pendingFullSnapshot = undefined;
  store.menuCatalog = null;
  loadOverviewSummaries.reset();
}

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
