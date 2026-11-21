/**
 * Carries a factory or size filter selection from the MegaMenu to the target
 * catalog page via sessionStorage.
 *
 * These quick-picks used to render as `<a href="...?factory=...">` and
 * `<a href="...?size=...">`, minting 145+ parameterised internal links per
 * build against disallowed query URLs. Because factory and size views are
 * client-side filter state on an existing canonical catalog page rather than
 * separate destinations, handing them off via sessionStorage keeps internal
 * links clean while navigating directly to the canonical route.
 */
import type { ProductGroupId } from "./category-meta";

export const CATALOG_FILTER_HANDOFF_KEY =
  "bonyan-foulad-daria-filter-handoff-v1";

export type CatalogFilterHandoff = {
  groupId: ProductGroupId;
  categoryId: string;
  factory?: string;
  size?: string;
};

let pageLoadFilterHandoff: CatalogFilterHandoff | null | undefined;

export function writeCatalogFilterHandoff(
  handoff: CatalogFilterHandoff,
): void {
  // Invalidate any prior in-memory cache so same-registry tests see fresh writes.
  pageLoadFilterHandoff = undefined;
  try {
    window.sessionStorage.setItem(
      CATALOG_FILTER_HANDOFF_KEY,
      JSON.stringify(handoff),
    );
  } catch {
    // Storage unavailable; navigation still proceeds to the unfiltered page.
  }
}

function readAndClear(): string | null {
  try {
    const value = window.sessionStorage.getItem(CATALOG_FILTER_HANDOFF_KEY);
    window.sessionStorage.removeItem(CATALOG_FILTER_HANDOFF_KEY);
    return value;
  } catch {
    return null;
  }
}

function parseFilterHandoff(raw: string | null): CatalogFilterHandoff | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const { groupId, categoryId, factory, size } = parsed as Record<
      string,
      unknown
    >;
    if (typeof groupId !== "string" || typeof categoryId !== "string") {
      return null;
    }
    const nextFactory =
      typeof factory === "string" && factory.length > 0 ? factory : undefined;
    const nextSize =
      typeof size === "string" && size.length > 0 ? size : undefined;
    if (!nextFactory && !nextSize) return null;

    return {
      groupId: groupId as ProductGroupId,
      categoryId,
      ...(nextFactory ? { factory: nextFactory } : {}),
      ...(nextSize ? { size: nextSize } : {}),
    };
  } catch {
    return null;
  }
}

export function takeCatalogFilterHandoff(
  groupId: ProductGroupId,
  categoryId?: string,
): { factory?: string; size?: string } | null {
  if (pageLoadFilterHandoff === undefined) {
    pageLoadFilterHandoff = parseFilterHandoff(readAndClear());
  }
  const handoff = pageLoadFilterHandoff;
  if (!handoff) return null;
  if (handoff.groupId !== groupId) return null;
  if (categoryId && handoff.categoryId !== categoryId) return null;

  return {
    ...(handoff.factory ? { factory: handoff.factory } : {}),
    ...(handoff.size ? { size: handoff.size } : {}),
  };
}

export function resetCatalogFilterHandoffCache(): void {
  pageLoadFilterHandoff = undefined;
}
