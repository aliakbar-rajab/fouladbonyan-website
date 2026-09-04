import {
  isGuidePageKey,
  type GuidePageKey,
} from "./guide-page-data";
import { isInfoPageKey, type InfoPageKey } from "./info-page-data";
import {
  getSubcategoryLabel,
  productGroups,
  type ProductGroupId,
} from "./category-meta";

export type SiteRoute =
  | { kind: "home" }
  | {
      kind: "catalog";
      category: ProductGroupId;
      subcategory?: string;
      subcategoryLabel?: string;
    }
  | { kind: "contact" }
  | { kind: "info"; page: InfoPageKey }
  | { kind: "guide"; guide?: GuidePageKey };

export type SiteRouteDataset = {
  page?: string;
  guide?: string;
  initialCategory?: string;
  initialSubcategory?: string;
  initialSubcategoryLabel?: string;
};

export type CatalogRouteRequest = {
  category?: ProductGroupId;
  subcategory?: string;
  subcategoryLabel?: string;
};

type RouteInput = {
  pathname?: string;
  dataset?: SiteRouteDataset;
};

const pathSegments = (pathname: string | undefined): string[] =>
  (pathname ?? "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase()
    .split("/")
    .filter(Boolean);

export function isProductGroupId(
  value: string | undefined,
): value is ProductGroupId {
  return productGroups.some((group) => group.id === value);
}

/**
 * Interpret the route contract shared by the prerender and browser adapters.
 * Explicit root data wins over the pathname because it describes the exact
 * page whose HTML is being hydrated.
 */
export function interpretSiteRoute({
  pathname = "/",
  dataset = {},
}: RouteInput = {}): SiteRoute {
  const segments = pathSegments(pathname);
  const page = dataset.page || segments[0] || "";

  if (page === "contact") return { kind: "contact" };
  if (isInfoPageKey(page)) return { kind: "info", page };
  if (page === "guide") {
    const requestedGuide = dataset.guide || segments[1] || "";
    return {
      kind: "guide",
      ...(isGuidePageKey(requestedGuide) ? { guide: requestedGuide } : {}),
    };
  }

  const category = dataset.initialCategory || segments[0];
  if (isProductGroupId(category)) {
    const rawSubcategory = dataset.initialSubcategory || segments[1] || undefined;
    const isSingleCategoryDuplicate =
      (category === "angle" && rawSubcategory === "angle") ||
      (category === "channel" && rawSubcategory === "channel");
    const subcategory = isSingleCategoryDuplicate ? undefined : rawSubcategory;
    return {
      kind: "catalog",
      category,
      ...(subcategory ? { subcategory } : {}),
      ...((dataset.initialSubcategoryLabel || getSubcategoryLabel(subcategory))
        ? {
            subcategoryLabel:
              dataset.initialSubcategoryLabel ??
              getSubcategoryLabel(subcategory) ??
              undefined,
          }
        : {}),
    };
  }

  return { kind: "home" };
}

export function resolveCatalogRouteRequest(
  input: RouteInput & { overrides?: CatalogRouteRequest } = {},
): CatalogRouteRequest {
  const route = interpretSiteRoute(input);
  const routeCatalog = route.kind === "catalog" ? route : undefined;
  const category = input.overrides?.category ?? routeCatalog?.category;
  const validCategory = isProductGroupId(category) ? category : undefined;
  const subcategory =
    input.overrides?.subcategory ??
    (validCategory ? routeCatalog?.subcategory : undefined);

  return {
    category: validCategory,
    subcategory,
    subcategoryLabel:
      input.overrides?.subcategoryLabel ??
      routeCatalog?.subcategoryLabel ??
      getSubcategoryLabel(subcategory) ??
      undefined,
  };
}

export function siteRoutePath(route: SiteRoute): string {
  switch (route.kind) {
    case "home":
      return "/";
    case "catalog":
      return `/${route.category}/${route.subcategory ? `${route.subcategory}/` : ""}`;
    case "contact":
      return "/contact/";
    case "info":
      return `/${route.page}/`;
    case "guide":
      return `/guide/${route.guide ? `${route.guide}/` : ""}`;
  }
}

export function siteRouteDataset(route: SiteRoute): SiteRouteDataset {
  switch (route.kind) {
    case "home":
      return {};
    case "catalog":
      return {
        initialCategory: route.category,
        ...(route.subcategory
          ? { initialSubcategory: route.subcategory }
          : {}),
        ...(route.subcategoryLabel
          ? { initialSubcategoryLabel: route.subcategoryLabel }
          : {}),
      };
    case "contact":
      return { page: "contact" };
    case "info":
      return { page: route.page };
    case "guide":
      return {
        page: "guide",
        ...(route.guide ? { guide: route.guide } : {}),
      };
  }
}

export const isOrganizationRoute = (route: SiteRoute): boolean =>
  route.kind === "home" || (route.kind === "info" && route.page === "about");

export const isHeroRoute = (route: SiteRoute): boolean =>
  route.kind === "home" || route.kind === "catalog";
