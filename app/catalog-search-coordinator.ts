import { useCallback, useMemo, useRef, useState } from "react";
import {
  getCategoryById,
  getSubcategoryLabel,
  productGroups,
  type ProductGroup,
  type ProductGroupId,
} from "./category-meta";
import {
  createRetryableLoader,
  initialCategoryIdOf,
  loadAllGroupCatalogs,
  type GroupCatalog,
} from "./catalog-reader";
import type { CatalogViewRequest } from "./catalog-types";
import {
  isProductGroupId,
  resolveCatalogRouteRequest,
} from "./site-route";
import { filterProductGroups } from "./site-logic.mjs";

// ---------------------------------------------------------------------------
// 1. SEARCH INDEXING & PROJECTION
// ---------------------------------------------------------------------------

export type CatalogSearchRow = {
  product: string;
  origin: string;
  unit: string;
  categoryId: string;
  factory: string;
  size: string;
  searchText: string;
};

export type CatalogSearchGroup = ProductGroup & {
  rows: CatalogSearchRow[];
};

/**
 * Project and index searchable rows from live group catalogs.
 */
export function buildCatalogSearchGroups(
  baseGroups: readonly ProductGroup[],
  catalogs: GroupCatalog[],
): CatalogSearchGroup[] {
  const categoriesByGroup = new Map(
    catalogs.map((catalog) => [catalog.id, catalog.categories]),
  );

  return baseGroups.map((group) => ({
    ...group,
    rows: (categoriesByGroup.get(group.id) ?? []).flatMap((category) =>
      category.factories.flatMap((factory) =>
        factory.rows.map((row) => ({
          product: row.title,
          origin: row.factory || factory.name || row.delivery || "—",
          unit: row.unit || "—",
          categoryId: category.id,
          factory: factory.name,
          size: row.size,
          searchText: [
            category.label,
            category.sourceTitle,
            row.title,
            row.size,
            row.specification,
            row.standard,
            row.grade,
            row.branchLength,
            row.form,
            row.delivery,
            row.unit,
            row.factory,
            factory.name,
            ...(row.specifications ?? []).flatMap((item) => [
              item.label,
              item.value,
            ]),
          ]
            .filter(Boolean)
            .join(" "),
        })),
      ),
    ),
  }));
}

export const loadCatalogSearchGroups = createRetryableLoader<CatalogSearchGroup[]>(
  () =>
    loadAllGroupCatalogs().then((catalogs) =>
      buildCatalogSearchGroups(productGroups, catalogs),
    ),
);

// ---------------------------------------------------------------------------
// 2. PURE DOMAIN EVALUATION
// ---------------------------------------------------------------------------

export type SearchExecutionResult = {
  matchedGroups: ProductGroup[];
  totalResultCount: number;
  selectedGroupId: ProductGroupId;
  suggestedViewRequest?: Omit<CatalogViewRequest, "requestId">;
  statusMessage: string;
};

/**
 * Pure function evaluating a search query against indexed product groups.
 */
export function evaluateCatalogSearch(
  query: string,
  groups: CatalogSearchGroup[],
): SearchExecutionResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      matchedGroups: groups,
      totalResultCount: 0,
      selectedGroupId: productGroups[0].id,
      suggestedViewRequest: {
        categoryId: initialCategoryIdOf(productGroups[0].id),
      },
      statusMessage: "همه محصولات نمایش داده می‌شوند.",
    };
  }

  const results = filterProductGroups(groups, trimmed);
  const totalCount = results.reduce((sum, group) => sum + group.rows.length, 0);

  if (results.length > 0) {
    const firstGroup = results[0];
    const selectedGroupId = isProductGroupId(firstGroup.id)
      ? firstGroup.id
      : productGroups[0].id;
    const firstRow = firstGroup.rows[0];

    return {
      matchedGroups: results,
      totalResultCount: totalCount,
      selectedGroupId,
      suggestedViewRequest: firstRow
        ? {
            categoryId: firstRow.categoryId,
            factory: firstRow.factory,
            size: firstRow.size,
          }
        : {
            categoryId: initialCategoryIdOf(selectedGroupId),
          },
      statusMessage: `${totalCount.toLocaleString("fa-IR")} نتیجه برای «${trimmed}» پیدا شد.`,
    };
  }

  return {
    matchedGroups: [],
    totalResultCount: 0,
    selectedGroupId: productGroups[0].id,
    statusMessage: `نتیجه‌ای برای «${trimmed}» پیدا شد.`,
  };
}

export function priceSectionHeading(
  subcategoryLabel: string | undefined,
  categoryLabel: string | undefined,
): { title: string; description: string } {
  if (subcategoryLabel) {
    return {
      title: `قیمت روز ${subcategoryLabel}`,
      description: `قیمت روز و مشخصات فنی ${subcategoryLabel} از معتبرترین کارخانه‌ها. برای استعلام موجودی و قیمت قطعی با واحد فروش تماس بگیرید.`,
    };
  }
  if (categoryLabel) {
    return {
      title: `قیمت روز ${categoryLabel}`,
      description: `قیمت روز و مشخصات فنی انواع ${categoryLabel} از معتبرترین کارخانه‌ها. برای استعلام موجودی و قیمت قطعی با واحد فروش تماس بگیرید.`,
    };
  }
  return {
    title: "قیمت روز آهن‌آلات و مقاطع فولادی",
    description:
      "خلاصه قیمت روز همه دسته‌های فولادی بر اساس استعلام بازار. برای مشاهده مشخصات کامل روی هر گروه کلیک کنید.",
  };
}

// ---------------------------------------------------------------------------
// 3. DEEP WORKSPACE COORDINATOR
// ---------------------------------------------------------------------------

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

/** Backward-compatibility alias */
export type CatalogWorkspaceState = CatalogWorkspace;

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
  const isCategoryOverviewRoute = isCategoryRoute && !route.subcategory;

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
    if (!route.subcategory) return null;
    return {
      id: route.subcategory,
      label:
        route.subcategoryLabel ||
        getSubcategoryLabel(route.subcategory) ||
        route.subcategory,
    };
  }, [route.subcategory, route.subcategoryLabel]);

  const filteredGroups: ProductGroup[] = useMemo(
    () => filterProductGroups(searchGroups ?? productGroups, committedQuery),
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
    selectGroup(productGroups[0].id);
    setSearchStatusMessage("همه محصولات نمایش داده می‌شوند.");
  }, [selectGroup]);

  const submitSearch = useCallback(
    async (query: string): Promise<boolean> => {
      const trimmed = query.trim();
      const currentToken = ++searchTokenRef.current;

      if (!trimmed) {
        setCommittedQuery("");
        setSearchGroups(null);
        setSearchStatusMessage("همه محصولات نمایش داده می‌شوند.");
        setIsSearching(false);
        setActiveGroup(productGroups[0].id);
        setActiveViewRequest((current) => ({
          requestId: current.requestId + 1,
          categoryId: initialCategoryIdOf(productGroups[0].id),
        }));
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
    [searchLoader],
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
      subcategory: subcategoryInfo,
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
