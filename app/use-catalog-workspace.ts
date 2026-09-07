import { useCallback, useMemo, useRef, useState } from "react";
import {
  getCategoryById,
  getSubcategoryLabel,
  isSingleSubcategoryGroup,
  productGroups,
  type ProductGroup,
  type ProductGroupId,
} from "./category-meta";
import { initialCategoryIdOf } from "./catalog-reader";
import type { CatalogViewRequest } from "./catalog-types";
import { resolveCatalogRouteRequest } from "./site-route";
import { filterProductGroups } from "./site-logic.mjs";
import {
  evaluateCatalogSearch,
  loadCatalogSearchGroups,
  priceSectionHeading,
  type CatalogSearchGroup,
} from "./catalog-search";

// ---------------------------------------------------------------------------
// 3. DEEP WORKSPACE COORDINATOR
// ---------------------------------------------------------------------------

/** Element id of the price workspace, and the scroll target it names. */
export const PRICE_WORKSPACE_ID = "price-workspace";

export function scrollToPriceWorkspace() {
  document.getElementById(PRICE_WORKSPACE_ID)?.scrollIntoView({
    behavior: "auto",
    block: "start",
  });
}

export type CatalogViewMode =
  | "home-overview"
  | "category-overview"
  | "catalog"
  | "empty";

export type CatalogWorkspaceSearchState = {
  query: string;
  isActive: boolean;
  isSearching: boolean;
  statusMessage: string;
};

export type CatalogWorkspaceHeroState = {
  categoryGroup: ProductGroup | null;
  subcategory: { id: string; label: string } | null;
};

export type CatalogWorkspace = {
  // --- Derived View State ---
  /** Resolved presentation mode for the pricing panel */
  viewMode: CatalogViewMode;
  /** Currently active product group identifier */
  activeGroup: ProductGroupId;
  /** Active group metadata descriptor, or null when search returns 0 results */
  visibleGroup: ProductGroup | null;
  /** Active selected tab ID in the navigation list */
  selectedTabId: ProductGroupId;
  /** Current view and filter parameters for price tables */
  activeViewRequest: CatalogViewRequest;
  /** Dynamic section title and subtitle */
  heading: { title: string; description: string };
  /** Brand link destination ('/' on category pages, '#top' on home) */
  brandHref: string;
  /** Pre-computed hero presentation context */
  hero: CatalogWorkspaceHeroState;
  /** Encapsulated search status and query model */
  search: CatalogWorkspaceSearchState;
  /** Whether the workspace is rendered for a deep category route */
  isCategoryRoute: boolean;

  // --- Domain Actions ---
  /** Submit a search query with resilient async loading and race protection */
  submitSearch: (query: string) => Promise<boolean>;
  /** Switch to a specific catalog group and optional target view */
  selectGroup: (
    groupId: ProductGroupId,
    view?: Omit<CatalogViewRequest, "requestId">,
  ) => void;
  /** Handle tab selection with automatic search interception */
  selectTab: (
    groupId: ProductGroupId,
    event?: { preventDefault: () => void },
  ) => void;
  /** Reset search and return to default catalog view */
  clearSearch: () => void;
};

export type CatalogWorkspaceOptions = {
  initialCategory?: ProductGroupId;
  initialSubcategory?: string;
  initialSubcategoryLabel?: string;
  searchLoader?: () => Promise<CatalogSearchGroup[]>;
};

export function useCatalogWorkspace({
  initialCategory,
  initialSubcategory,
  initialSubcategoryLabel,
  searchLoader = loadCatalogSearchGroups,
}: CatalogWorkspaceOptions = {}): CatalogWorkspace {
  const route = useMemo(
    () => {
      const dataset =
        typeof document === "undefined"
          ? undefined
          : document.getElementById("root")?.dataset;
      const pathname =
        typeof window === "undefined" ? "/" : window.location.pathname;
      return resolveCatalogRouteRequest({
        pathname,
        dataset,
        overrides: {
          category: initialCategory,
          subcategory: initialSubcategory,
          subcategoryLabel: initialSubcategoryLabel,
        },
      });
    },
    [initialCategory, initialSubcategory, initialSubcategoryLabel],
  );

  const isCategoryRoute = Boolean(route.category);
  const isSingleCategoryGroup = Boolean(
    route.category && isSingleSubcategoryGroup(route.category),
  );
  const isCategoryOverviewRoute =
    isCategoryRoute && !route.subcategory && !isSingleCategoryGroup;

  const [activeGroup, setActiveGroup] = useState<ProductGroupId>(
    () => route.category ?? productGroups[0].id,
  );

  const [committedQuery, setCommittedQuery] = useState("");
  const [searchStatusMessage, setSearchStatusMessage] = useState("");
  const [searchGroups, setSearchGroups] = useState<CatalogSearchGroup[] | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);

  const [activeViewRequest, setActiveViewRequest] = useState<CatalogViewRequest>(
    () => {
      const params =
        typeof window === "undefined"
          ? null
          : new URLSearchParams(window.location.search);
      return {
        requestId: 0,
        categoryId:
          route.subcategory ??
          (route.category ? initialCategoryIdOf(route.category) : undefined),
        factory: params?.get("factory") ?? undefined,
        size: params?.get("size") ?? undefined,
      };
    },
  );

  // Search generation token to discard stale async responses and prevent race conditions
  const searchTokenRef = useRef(0);

  const categoryGroup = useMemo(
    () => (route.category ? getCategoryById(route.category) ?? null : null),
    [route.category],
  );

  const subcategoryInfo = useMemo(() => {
    const sub =
      route.subcategory ??
      (isSingleCategoryGroup && route.category
        ? initialCategoryIdOf(route.category)
        : undefined);
    if (!sub) return null;
    return {
      id: sub,
      label:
        route.subcategoryLabel ||
        getSubcategoryLabel(sub) ||
        (route.category ? getCategoryById(route.category)?.label : undefined) ||
        sub,
    };
  }, [
    route.subcategory,
    route.subcategoryLabel,
    route.category,
    isSingleCategoryGroup,
  ]);

  const filteredGroups: ProductGroup[] = useMemo(
    () =>
      searchGroups && committedQuery
        ? filterProductGroups(searchGroups, committedQuery)
        : productGroups,
    [committedQuery, searchGroups],
  );

  const visibleGroup = useMemo(
    () =>
      filteredGroups.find((group) => group.id === activeGroup) ??
      filteredGroups[0] ??
      null,
    [filteredGroups, activeGroup],
  );

  const isSearchActive = Boolean(committedQuery);

  /*
   * The view this page is *about*: the group and subcategory named in the URL,
   * or the first group on the home page. Resetting a search returns here.
   *
   * It used to reset to `productGroups[0]` unconditionally, which is only the
   * right answer on the home page. On /beam/, clearing a search left the
   * میلگرد catalog, the میلگرد heading and a میلگرد tab carrying
   * aria-current="page" under a page whose URL, <title>, hero H1 and
   * breadcrumb all still said تیرآهن.
   */
  const routeGroupId = route.category ?? productGroups[0].id;
  const routeCategoryId = route.subcategory ?? initialCategoryIdOf(routeGroupId);

  const selectedTabId = useMemo(
    () =>
      isCategoryRoute || isSearchActive
        ? (visibleGroup?.id ?? productGroups[0].id)
        : productGroups[0].id,
    [isCategoryRoute, isSearchActive, visibleGroup?.id],
  );

  const heading = useMemo(
    () =>
      priceSectionHeading(
        subcategoryInfo?.label,
        isCategoryRoute
          ? (visibleGroup?.label ?? categoryGroup?.label ?? "محصول")
          : undefined,
      ),
    [
      subcategoryInfo?.label,
      isCategoryRoute,
      visibleGroup?.label,
      categoryGroup?.label,
    ],
  );

  const viewMode: CatalogViewMode = useMemo(() => {
    if (isSearchActive) {
      return visibleGroup ? "catalog" : "empty";
    }
    if (isCategoryRoute) {
      return isCategoryOverviewRoute ? "category-overview" : "catalog";
    }
    return "home-overview";
  }, [isSearchActive, isCategoryRoute, isCategoryOverviewRoute, visibleGroup]);

  const selectGroup = useCallback(
    (
      groupId: ProductGroupId,
      view?: Omit<CatalogViewRequest, "requestId">,
    ) => {
      // Invalidate in-flight search requests
      searchTokenRef.current += 1;
      setCommittedQuery("");
      setSearchStatusMessage("");
      setIsSearching(false);
      setActiveGroup(groupId);
      setActiveViewRequest((current) => ({
        requestId: current.requestId + 1,
        categoryId: view?.categoryId ?? initialCategoryIdOf(groupId),
        factory: view?.factory,
        size: view?.size,
      }));
    },
    [],
  );

  const clearSearch = useCallback(() => {
    selectGroup(routeGroupId, { categoryId: routeCategoryId });
    setSearchStatusMessage("همه محصولات نمایش داده می‌شوند.");
  }, [selectGroup, routeGroupId, routeCategoryId]);

  const submitSearch = useCallback(
    async (query: string): Promise<boolean> => {
      const trimmed = query.trim();
      const currentToken = ++searchTokenRef.current;

      if (!trimmed) {
        clearSearch();
        return true;
      }

      setIsSearching(true);
      setSearchStatusMessage(`در حال جست‌وجوی «${trimmed}»…`);

      let loadedGroups: CatalogSearchGroup[];
      try {
        loadedGroups = await searchLoader();
      } catch {
        if (searchTokenRef.current !== currentToken) return false;
        setSearchStatusMessage(
          "دریافت فهرست زنده محصولات ممکن نشد. لطفاً دوباره تلاش کنید.",
        );
        setIsSearching(false);
        return false;
      }

      if (searchTokenRef.current !== currentToken) {
        // Late response discarded
        return false;
      }

      const evaluation = evaluateCatalogSearch(trimmed, loadedGroups);

      setSearchGroups(loadedGroups);
      setCommittedQuery(trimmed);
      setSearchStatusMessage(evaluation.statusMessage);
      setIsSearching(false);

      if (evaluation.matchedGroups.length > 0) {
        setActiveGroup(evaluation.selectedGroupId);
        setActiveViewRequest((current) => ({
          requestId: current.requestId + 1,
          categoryId: evaluation.suggestedViewRequest?.categoryId ?? "",
          factory: evaluation.suggestedViewRequest?.factory,
          size: evaluation.suggestedViewRequest?.size,
        }));
      }

      return evaluation.matchedGroups.length > 0;
    },
    [searchLoader, clearSearch],
  );

  const selectTab = useCallback(
    (groupId: ProductGroupId, event?: { preventDefault: () => void }) => {
      if (committedQuery) {
        event?.preventDefault();
        selectGroup(groupId);
      }
    },
    [committedQuery, selectGroup],
  );

  return {
    viewMode,
    activeGroup,
    visibleGroup,
    selectedTabId,
    activeViewRequest,
    heading,
    brandHref: isCategoryRoute ? "/" : "#top",
    hero: {
      categoryGroup,
      subcategory: isSingleCategoryGroup ? null : subcategoryInfo,
    },
    search: {
      query: committedQuery,
      isActive: isSearchActive,
      isSearching,
      statusMessage: searchStatusMessage,
    },
    isCategoryRoute,
    submitSearch,
    selectGroup,
    selectTab,
    clearSearch,
  };
}
