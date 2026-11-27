import { useCallback, useMemo, useRef, useState } from "react";
import {
  getCategoryById,
  getSubcategoryLabel,
  productGroups,
  type ProductGroup,
  type ProductGroupId,
} from "./category-meta";
import { initialCategoryIdOf } from "./catalog-reader";
import { takeCatalogFilterHandoff } from "./catalog-filter-handoff";
import type { CatalogViewRequest } from "./catalog-types";
import {
  isDirectCatalogRoute,
  pageHero,
  type CatalogPageHero,
} from "./site-page";
import { resolveCatalogRouteRequest, type SiteRoute } from "./site-route";
import {
  evaluateCatalogSearch,
  loadCatalogSearchGroups,
  type CatalogSearchGroup,
} from "./catalog-search";

// ---------------------------------------------------------------------------
// 1. WORKSPACE HEADING & VIEW STATE
// ---------------------------------------------------------------------------

export function priceSectionHeading(
  subcategoryLabel: string | undefined,
  categoryLabel: string | undefined,
): { title: string; description: string } {
  if (subcategoryLabel) {
    return {
      title: `جدول قیمت و مشخصات فنی ${subcategoryLabel}`,
      description: `قیمت روز و مشخصات فنی ${subcategoryLabel} از معتبرترین کارخانه‌ها. برای استعلام موجودی و قیمت قطعی با واحد فروش تماس بگیرید.`,
    };
  }
  if (categoryLabel) {
    return {
      title: `جدول و مقایسه قیمت انواع ${categoryLabel}`,
      description: `قیمت روز و مشخصات فنی انواع ${categoryLabel} از معتبرترین کارخانه‌ها. برای استعلام موجودی و قیمت قطعی با واحد فروش تماس بگیرید.`,
    };
  }
  return {
    title: "قیمت روز آهن‌آلات و مقاطع فولادی",
    description:
      "خلاصه قیمت روز همه دسته‌های فولادی بر اساس استعلام بازار. برای مشاهده مشخصات کامل روی هر گروه کلیک کنید.",
  };
}

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
  input: string;
  query: string;
  isActive: boolean;
  isSearching: boolean;
  statusMessage: string;
};

export type CatalogWorkspaceHeroState = CatalogPageHero | null;

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
  /** Selected value for the mobile group dropdown (empty on home overview) */
  selectedGroupValue: ProductGroupId | "";
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
  /** Update the controlled search input text */
  setSearchInput: (value: string) => void;
  /** Submit a search query (defaults to the current search input) with race protection */
  submitSearch: (query?: string) => Promise<boolean>;
  /** Switch to a specific catalog group and optional target view */
  selectGroup: (
    groupId: ProductGroupId,
    view?: Omit<CatalogViewRequest, "requestId">,
  ) => void;
  /** Handle tab selection with automatic search interception; returns true if intercepted */
  selectTab: (
    groupId: ProductGroupId,
    event?: { preventDefault: () => void },
  ) => boolean;
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
  // The route arrives as props on the server and in the browser alike -- both
  // build this tree with pageElement (site-page-element.tsx) -- so the hook
  // never goes back to the DOM or the address bar to find out where it is.
  const route = useMemo(
    () =>
      resolveCatalogRouteRequest({
        category: initialCategory,
        subcategory: initialSubcategory,
        subcategoryLabel: initialSubcategoryLabel,
      }),
    [initialCategory, initialSubcategory, initialSubcategoryLabel],
  );

  const siteRoute: SiteRoute = useMemo(
    () =>
      route.category
        ? {
            kind: "catalog",
            category: route.category,
            ...(route.subcategory ? { subcategory: route.subcategory } : {}),
            ...(route.subcategoryLabel
              ? { subcategoryLabel: route.subcategoryLabel }
              : {}),
          }
        : { kind: "home" },
    [route.category, route.subcategory, route.subcategoryLabel],
  );

  const isCategoryRoute = siteRoute.kind === "catalog";
  const rendersCatalogDirectly = isDirectCatalogRoute(siteRoute);
  const isCategoryOverviewRoute = isCategoryRoute && !rendersCatalogDirectly;

  const [activeGroup, setActiveGroup] = useState<ProductGroupId>(
    () => route.category ?? productGroups[0].id,
  );

  const [searchInput, setSearchInput] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [searchStatusMessage, setSearchStatusMessage] = useState("");
  const [matchedGroups, setMatchedGroups] = useState<ProductGroup[] | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);

  const [activeViewRequest, setActiveViewRequest] = useState<CatalogViewRequest>(
    () => {
      const targetCategoryId =
        route.subcategory ??
        (route.category ? initialCategoryIdOf(route.category) : undefined);
      const handoff =
        typeof window !== "undefined" && route.category
          ? takeCatalogFilterHandoff(route.category, targetCategoryId)
          : null;
      const params =
        typeof window === "undefined"
          ? null
          : new URLSearchParams(window.location.search);
      return {
        requestId: 0,
        categoryId: targetCategoryId,
        factory: handoff?.factory ?? params?.get("factory") ?? undefined,
        size: handoff?.size ?? params?.get("size") ?? undefined,
      };
    },
  );

  // Search generation token to discard stale async responses and prevent race conditions
  const searchTokenRef = useRef(0);

  const categoryGroup = useMemo(
    () => (route.category ? getCategoryById(route.category) ?? null : null),
    [route.category],
  );

  const hero = useMemo(() => pageHero(siteRoute), [siteRoute]);

  const subcategoryInfo = useMemo(() => {
    const sub =
      route.subcategory ??
      (rendersCatalogDirectly && route.category
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
    rendersCatalogDirectly,
  ]);

  const filteredGroups: ProductGroup[] = matchedGroups ?? productGroups;

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

  const showSelectedGroup = isCategoryRoute || isSearchActive;
  const selectedTabId = showSelectedGroup
    ? (visibleGroup?.id ?? productGroups[0].id)
    : productGroups[0].id;
  const selectedGroupValue: ProductGroupId | "" = showSelectedGroup
    ? selectedTabId
    : "";

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
      setSearchInput("");
      setCommittedQuery("");
      setMatchedGroups(null);
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
    async (query?: string): Promise<boolean> => {
      const rawQuery = query ?? searchInput;
      const trimmed = rawQuery.trim();
      const currentToken = ++searchTokenRef.current;

      if (!trimmed) {
        clearSearch();
        return true;
      }

      if (query !== undefined) {
        setSearchInput(rawQuery);
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

      setMatchedGroups(evaluation.matchedGroups);
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
    [searchInput, searchLoader, clearSearch],
  );

  const selectTab = useCallback(
    (groupId: ProductGroupId, event?: { preventDefault: () => void }): boolean => {
      if (!committedQuery) return false;
      event?.preventDefault();
      selectGroup(groupId);
      scrollToPriceWorkspace();
      return true;
    },
    [committedQuery, selectGroup],
  );

  return {
    viewMode,
    activeGroup,
    visibleGroup,
    selectedTabId,
    selectedGroupValue,
    activeViewRequest,
    heading,
    brandHref: isCategoryRoute ? "/" : "#top",
    hero,
    search: {
      input: searchInput,
      query: committedQuery,
      isActive: isSearchActive,
      isSearching,
      statusMessage: searchStatusMessage,
    },
    isCategoryRoute,
    setSearchInput,
    submitSearch,
    selectGroup,
    selectTab,
    clearSearch,
  };
}
