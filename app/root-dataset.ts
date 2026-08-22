import { productGroups, type ProductGroupId } from "./category-meta";

/**
 * The route a prerendered page asks for.
 *
 * Category and subcategory pages stamp these as plain data attributes on the
 * root element rather than an inline script: the site's CSP is
 * `script-src 'self'`, which silently drops any inline <script> with no
 * matching nonce or hash.
 */
export type RouteRequest = {
  /** Only ever a real product group; an unknown slug reads as no category. */
  category?: ProductGroupId;
  subcategory?: string;
  subcategoryLabel?: string;
};

export function isProductGroupId(
  value: string | undefined,
): value is ProductGroupId {
  return productGroups.some((group) => group.id === value);
}

/**
 * Read the requested route, preferring explicit props so the prerender can
 * pass the route it is rendering instead of reaching for a DOM that does not
 * exist yet.
 */
export function readRouteRequest(overrides: RouteRequest = {}): RouteRequest {
  const dataset =
    typeof document === "undefined"
      ? undefined
      : document.getElementById("root")?.dataset;

  const pathSegments =
    typeof window === "undefined"
      ? []
      : window.location.pathname
          .replace(/^\/|\/$/g, "")
          .toLowerCase()
          .split("/")
          .filter(Boolean);

  const category =
    overrides.category ?? dataset?.initialCategory ?? pathSegments[0];
  const validCategory = isProductGroupId(category) ? category : undefined;

  return {
    category: validCategory,
    subcategory:
      overrides.subcategory ??
      dataset?.initialSubcategory ??
      (validCategory ? pathSegments[1] : undefined),
    subcategoryLabel:
      overrides.subcategoryLabel ?? dataset?.initialSubcategoryLabel,
  };
}
