import { loadBeamPriceData, loadRebarPriceData } from "./catalog-data";
import {
  loadProductPricePayload,
  type ProductPricePayload,
} from "./product-price-data";

import {
  isProductCatalogId,
  productGroups,
  type ProductGroupId,
} from "./category-meta";
import type { CatalogCategory, CatalogPriceData } from "./catalog-types";

/**
 * One product group's catalog, in the shape every reader wants: the snapshot
 * metadata plus that group's own categories.
 *
 * This is the seam over how the snapshots are actually stored. Rebar and beam
 * ship their own files; the other six groups are catalogs inside one shared
 * product payload. Nothing outside this module should know that.
 */
export type GroupCatalog = {
  id: ProductGroupId;
  label: string;
  initialCategoryId: string;
  fetchedAt: string;
  sourceName: string;
  sourceHome: string;
  taxRate: number;
  categories: CatalogCategory[];
};

const ownSnapshots = {
  rebar: { load: loadRebarPriceData, initialCategoryId: "ribbed" },
  beam: { load: loadBeamPriceData, initialCategoryId: "beam" },
} as const;

type OwnSnapshotId = keyof typeof ownSnapshots;

const isOwnSnapshotId = (groupId: ProductGroupId): groupId is OwnSnapshotId =>
  groupId in ownSnapshots;

const labelOf = (groupId: ProductGroupId) =>
  productGroups.find((group) => group.id === groupId)?.label ?? groupId;

function fromOwnSnapshot(
  groupId: OwnSnapshotId,
  data: CatalogPriceData,
): GroupCatalog {
  return {
    id: groupId,
    label: labelOf(groupId),
    initialCategoryId: ownSnapshots[groupId].initialCategoryId,
    fetchedAt: data.fetchedAt,
    sourceName: data.sourceName,
    sourceHome: data.sourceHome,
    taxRate: data.taxRate,
    categories: data.categories,
  };
}

function fromProductPayload(
  groupId: ProductGroupId,
  payload: ProductPricePayload,
): GroupCatalog | undefined {
  const catalog = payload.catalogs.find((item) => item.id === groupId);
  if (!catalog) return undefined;

  return {
    id: groupId,
    label: catalog.label,
    initialCategoryId: catalog.initialCategoryId,
    fetchedAt: payload.fetchedAt,
    sourceName: payload.sourceName,
    sourceHome: payload.sourceHome,
    taxRate: payload.taxRate,
    categories: catalog.categories,
  };
}

/** The category a group opens on, or undefined when the catalog decides. */
export function initialCategoryIdOf(groupId: ProductGroupId) {
  return isOwnSnapshotId(groupId)
    ? ownSnapshots[groupId].initialCategoryId
    : undefined;
}

export async function loadGroupCatalog(
  groupId: ProductGroupId,
): Promise<GroupCatalog> {
  if (isOwnSnapshotId(groupId)) {
    return fromOwnSnapshot(groupId, await ownSnapshots[groupId].load());
  }

  const catalog = fromProductPayload(groupId, await loadProductPricePayload());
  if (!catalog) {
    throw new Error(`داده قیمت گروه ${groupId} در دسترس نیست.`);
  }
  return catalog;
}

/**
 * The synchronous view, for prerender and hydration. It reads the underlying
 * snapshot caches rather than a cache of its own, so priming a snapshot primes
 * every group that snapshot serves.
 */
loadGroupCatalog.getCached = (
  groupId?: ProductGroupId,
): GroupCatalog | undefined => {
  if (!groupId) return undefined;

  if (isOwnSnapshotId(groupId)) {
    const data = ownSnapshots[groupId].load.getCached();
    return data ? fromOwnSnapshot(groupId, data) : undefined;
  }

  if (!isProductCatalogId(groupId)) return undefined;
  const payload = loadProductPricePayload.getCached();
  return payload ? fromProductPayload(groupId, payload) : undefined;
};

/** Every group's catalog, for the readers that summarise across all of them. */
export async function loadAllGroupCatalogs(): Promise<GroupCatalog[]> {
  return Promise.all(
    productGroups.map((group) => loadGroupCatalog(group.id)),
  );
}

/**
 * The snapshot a page has to embed for a group, and the payload that carries
 * it from the prerender to the browser.
 */
export type CatalogSnapshotType = OwnSnapshotId | "product";

export type CatalogSnapshotPayload =
  | { type: OwnSnapshotId; data: CatalogPriceData }
  | { type: "product"; data: ProductPricePayload };

export function snapshotTypeOf(groupId: ProductGroupId): CatalogSnapshotType {
  return isOwnSnapshotId(groupId) ? groupId : "product";
}

/** Seed the caches an embedded payload stands in for, before hydrating. */
export function primeCatalogSnapshot(
  payload: CatalogSnapshotPayload | null | undefined,
) {
  if (!payload) return;
  if (payload.type === "product") {
    loadProductPricePayload.setCached(payload.data);
    return;
  }
  ownSnapshots[payload.type].load.setCached(payload.data);
}
