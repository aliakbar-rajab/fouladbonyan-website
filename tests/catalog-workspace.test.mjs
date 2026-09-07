import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { setupDomEnv } from "./helpers/dom-env.mjs";

setupDomEnv({ url: "https://example.test/" });

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { useCatalogWorkspace } = await import("../app/use-catalog-workspace.ts");
const { buildCatalogSearchGroups } = await import("../app/catalog-search.ts");
const { productGroups } = await import("../app/category-meta.ts");

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

const mockRow = (id, title, size, factory) => ({
  id,
  title,
  size,
  standard: "A3",
  grade: "St37",
  branchLength: "12",
  form: "شاخه",
  approximateWeight: "20",
  delivery: "تهران",
  unit: "کیلوگرم",
  factory,
  price: 55_000,
  percent: 1.5,
  status: "up",
  updatedAt: 1_700_000_000,
  updatedDate: "۱۴۰۲/۰۸/۲۳",
  specifications: [{ label: "ضخامت", value: "2mm" }],
});

const mockCategory = (id, label, rows) => ({
  id,
  label,
  groupingLabel: "کارخانه",
  specificationLabel: "استاندارد",
  sourceTitle: label,
  sourceUrl: "https://example.test/source",
  summary: {
    date: "امروز",
    min: 50_000,
    max: 60_000,
    average: 55_000,
    percent: 1.5,
    status: "up",
  },
  filters: {
    sizes: [...new Set(rows.map((r) => r.size))],
    factories: [...new Set(rows.map((r) => r.factory))],
  },
  factories: [...new Set(rows.map((r) => r.factory))].map((factoryName) => ({
    name: factoryName,
    updatedAt: 1_700_000_000,
    updatedDate: "۱۴۰۲/۰۸/۲۳",
    rows: rows.filter((r) => r.factory === factoryName),
  })),
});

const mockCatalogs = [
  {
    id: "rebar",
    label: "میلگرد",
    initialCategoryId: "ribbed",
    fetchedAt: "2026-07-27T10:00:00.000Z",
    sourceName: "منبع آزمایشی",
    sourceHome: "https://example.test/",
    taxRate: 0.1,
    categories: [
      mockCategory("ribbed", "میلگرد آجدار", [
        mockRow(1, "میلگرد آجدار ۱۴ نیشابور", "14", "نیشابور", "ribbed"),
        mockRow(2, "میلگرد آجدار ۱۶ اصفهان", "16", "ذوب‌آهن اصفهان", "ribbed"),
      ]),
      mockCategory("simple", "میلگرد ساده", [
        mockRow(3, "میلگرد ساده ۱۰ کویر کاشان", "10", "کویر کاشان", "simple"),
      ]),
    ],
  },
  {
    id: "beam",
    label: "تیرآهن",
    initialCategoryId: "beam",
    fetchedAt: "2026-07-27T10:00:00.000Z",
    sourceName: "منبع آزمایشی",
    sourceHome: "https://example.test/",
    taxRate: 0.1,
    categories: [
      mockCategory("beam", "تیرآهن IPE", [
        mockRow(4, "تیرآهن ۱۸ فایکو", "18", "فایکو", "beam"),
      ]),
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. DEEP WORKSPACE HOOK & DERIVED VIEW TESTS
// ---------------------------------------------------------------------------

test("useCatalogWorkspace initializes default home workspace state with compact view model", () => {
  const { result } = renderHook(() => useCatalogWorkspace());

  assert.equal(result.current.viewMode, "home-overview");
  assert.equal(result.current.isCategoryRoute, false);
  assert.equal(result.current.brandHref, "#top");
  assert.equal(result.current.activeGroup, "rebar");
  assert.equal(result.current.selectedTabId, "rebar");
  assert.equal(result.current.search.query, "");
  assert.equal(result.current.search.isActive, false);
  assert.equal(result.current.search.isSearching, false);
  assert.equal(result.current.activeViewRequest.requestId, 0);
  assert.equal(result.current.hero.categoryGroup, null);
  assert.equal(result.current.hero.subcategory, null);
});

test("useCatalogWorkspace derives category overview view mode for overview routes", () => {
  const { result } = renderHook(() =>
    useCatalogWorkspace({
      initialCategory: "beam",
    }),
  );

  assert.equal(result.current.viewMode, "category-overview");
  assert.equal(result.current.isCategoryRoute, true);
  assert.equal(result.current.brandHref, "/");
  assert.equal(result.current.activeGroup, "beam");
  assert.equal(result.current.hero.categoryGroup?.label, "تیرآهن");
  assert.equal(result.current.hero.subcategory, null);
});

test("useCatalogWorkspace derives catalog view mode and preserves query params for subcategory routes", () => {
  window.history.replaceState({}, "", "/beam/beam/?factory=فایکو&size=18");
  const { result } = renderHook(() =>
    useCatalogWorkspace({
      initialCategory: "beam",
      initialSubcategory: "beam",
      initialSubcategoryLabel: "تیرآهن IPE",
    }),
  );

  assert.equal(result.current.viewMode, "catalog");
  assert.equal(result.current.isCategoryRoute, true);
  assert.equal(result.current.brandHref, "/");
  assert.equal(result.current.activeGroup, "beam");
  assert.equal(result.current.activeViewRequest.categoryId, "beam");
  assert.equal(result.current.activeViewRequest.factory, "فایکو");
  assert.equal(result.current.activeViewRequest.size, "18");
  assert.equal(result.current.hero.subcategory?.label, "تیرآهن IPE");
});

test("useCatalogWorkspace search submission coordinates async loading, race tokens, and view derivation", async () => {
  const searchLoader = async () =>
    buildCatalogSearchGroups(productGroups, mockCatalogs);

  const { result } = renderHook(() =>
    useCatalogWorkspace({ searchLoader }),
  );

  let success;
  await act(async () => {
    success = await result.current.submitSearch("تیرآهن ۱۸");
  });

  assert.equal(success, true);
  assert.equal(result.current.viewMode, "catalog");
  assert.equal(result.current.search.query, "تیرآهن ۱۸");
  assert.equal(result.current.search.isActive, true);
  assert.equal(result.current.search.isSearching, false);
  assert.equal(result.current.activeGroup, "beam");
  assert.equal(result.current.selectedTabId, "beam");
  assert.equal(result.current.activeViewRequest.categoryId, "beam");
  assert.equal(result.current.activeViewRequest.factory, "فایکو");
  assert.equal(result.current.activeViewRequest.size, "18");
  assert.equal(result.current.activeViewRequest.requestId, 1);
  assert.match(result.current.search.statusMessage, /۱ نتیجه برای/);
});

test("useCatalogWorkspace transitions to empty view mode on query with zero matches", async () => {
  const searchLoader = async () =>
    buildCatalogSearchGroups(productGroups, mockCatalogs);

  const { result } = renderHook(() =>
    useCatalogWorkspace({ searchLoader }),
  );

  let success;
  await act(async () => {
    success = await result.current.submitSearch("محصول_ناموجود_xyz");
  });

  assert.equal(success, false);
  assert.equal(result.current.viewMode, "empty");
  assert.equal(result.current.visibleGroup, null);
  assert.equal(result.current.search.isActive, true);
  assert.match(result.current.search.statusMessage, /نتیجه‌ای برای/);
});

test("useCatalogWorkspace handles search network failures gracefully without crashing", async () => {
  const failingLoader = async () => {
    throw new Error("Network offline");
  };

  const { result } = renderHook(() =>
    useCatalogWorkspace({ searchLoader: failingLoader }),
  );

  let success;
  await act(async () => {
    success = await result.current.submitSearch("میلگرد");
  });

  assert.equal(success, false);
  assert.equal(result.current.search.query, "");
  assert.equal(result.current.search.isSearching, false);
  assert.match(
    result.current.search.statusMessage,
    /دریافت فهرست زنده محصولات ممکن نشد/,
  );
});

test("useCatalogWorkspace clearSearch resets query, status, and returns to default home overview", async () => {
  const searchLoader = async () =>
    buildCatalogSearchGroups(productGroups, mockCatalogs);

  const { result } = renderHook(() =>
    useCatalogWorkspace({ searchLoader }),
  );

  await act(async () => {
    await result.current.submitSearch("فایکو");
  });
  assert.equal(result.current.activeGroup, "beam");
  assert.equal(result.current.search.isActive, true);

  act(() => {
    result.current.clearSearch();
  });

  assert.equal(result.current.viewMode, "home-overview");
  assert.equal(result.current.search.query, "");
  assert.equal(result.current.search.isActive, false);
  assert.equal(result.current.activeGroup, "rebar");
  assert.equal(
    result.current.search.statusMessage,
    "همه محصولات نمایش داده می‌شوند.",
  );
});

test("clearing a search on a category route returns to that route's own catalog", async () => {
  /*
   * The reset was hardcoded to productGroups[0], which is only the right
   * answer on the home page. On /beam/ it left the میلگرد catalog, the میلگرد
   * heading and a میلگرد tab under a page whose URL, title, hero and
   * breadcrumb all still said تیرآهن.
   */
  const searchLoader = async () =>
    buildCatalogSearchGroups(productGroups, mockCatalogs);

  const { result } = renderHook(() =>
    useCatalogWorkspace({ initialCategory: "beam", searchLoader }),
  );

  await act(async () => {
    await result.current.submitSearch("کویر کاشان");
  });
  assert.equal(result.current.activeGroup, "rebar");
  assert.equal(result.current.search.isActive, true);

  act(() => {
    result.current.clearSearch();
  });

  assert.equal(result.current.search.isActive, false);
  assert.equal(
    result.current.activeGroup,
    "beam",
    "the page is /beam/, so clearing a search must land back on تیرآهن",
  );
  assert.equal(result.current.selectedTabId, "beam");
  assert.match(result.current.heading.title, /تیرآهن/);
});

test("clearing a search on a subcategory route returns to that subcategory, not the group default", async () => {
  const searchLoader = async () =>
    buildCatalogSearchGroups(productGroups, mockCatalogs);

  const { result } = renderHook(() =>
    useCatalogWorkspace({
      initialCategory: "rebar",
      initialSubcategory: "simple",
      initialSubcategoryLabel: "میلگرد ساده",
      searchLoader,
    }),
  );

  await act(async () => {
    await result.current.submitSearch("تیرآهن");
  });
  assert.equal(result.current.search.isActive, true);

  act(() => {
    result.current.clearSearch();
  });

  assert.equal(result.current.activeGroup, "rebar");
  assert.equal(
    result.current.activeViewRequest.categoryId,
    "simple",
    "the route names میلگرد ساده, not the group's initial ribbed category",
  );
});

test("submitting an empty query resets to the route's own catalog too", async () => {
  const searchLoader = async () =>
    buildCatalogSearchGroups(productGroups, mockCatalogs);

  const { result } = renderHook(() =>
    useCatalogWorkspace({ initialCategory: "beam", searchLoader }),
  );

  await act(async () => {
    await result.current.submitSearch("کویر کاشان");
  });
  assert.equal(result.current.activeGroup, "rebar");

  await act(async () => {
    await result.current.submitSearch("   ");
  });

  assert.equal(result.current.activeGroup, "beam");
  assert.equal(result.current.activeViewRequest.categoryId, "beam");
});

test("useCatalogWorkspace selectTab intercepts click under active search and allows native navigation when inactive", async () => {
  const searchLoader = async () =>
    buildCatalogSearchGroups(productGroups, mockCatalogs);

  const { result } = renderHook(() =>
    useCatalogWorkspace({ searchLoader }),
  );

  let prevented = false;
  const mockEvent = {
    preventDefault: () => {
      prevented = true;
    },
  };

  // 1. Inactive search: does not preventDefault (standard <a> link navigation)
  act(() => {
    result.current.selectTab("sheet", mockEvent);
  });
  assert.equal(prevented, false);

  // 2. Activate search
  await act(async () => {
    await result.current.submitSearch("فایکو");
  });
  assert.equal(result.current.search.isActive, true);

  // 3. Active search: prevents default link navigation and switches workspace group in-place
  act(() => {
    result.current.selectTab("profile", mockEvent);
  });
  assert.equal(prevented, true);
  assert.equal(result.current.activeGroup, "profile");
  assert.equal(result.current.search.query, "");
  assert.equal(result.current.search.isActive, false);
});

test("useCatalogWorkspace selectGroup transitions catalog view and preserves custom parameters", () => {
  const { result } = renderHook(() => useCatalogWorkspace());

  act(() => {
    result.current.selectGroup("sheet", {
      categoryId: "sheet-black",
      factory: "مبارکه",
      size: "2mm",
    });
  });

  assert.equal(result.current.activeGroup, "sheet");
  assert.equal(result.current.activeViewRequest.categoryId, "sheet-black");
  assert.equal(result.current.activeViewRequest.factory, "مبارکه");
  assert.equal(result.current.activeViewRequest.size, "2mm");
  assert.equal(result.current.activeViewRequest.requestId, 1);
});

test("useCatalogWorkspace discards stale out-of-order async responses (race condition protection)", async () => {
  let resolveFirstSearch;
  let resolveSecondSearch;

  const firstPromise = new Promise((resolve) => {
    resolveFirstSearch = resolve;
  });
  const secondPromise = new Promise((resolve) => {
    resolveSecondSearch = resolve;
  });

  let callCount = 0;
  const raceLoader = async () => {
    callCount += 1;
    if (callCount === 1) return firstPromise;
    return secondPromise;
  };

  const { result } = renderHook(() =>
    useCatalogWorkspace({ searchLoader: raceLoader }),
  );

  // Trigger search 1 (slow)
  let searchPromise1;
  act(() => {
    searchPromise1 = result.current.submitSearch("نیشابور");
  });
  assert.equal(result.current.search.isSearching, true);

  // Trigger search 2 (fast)
  let searchPromise2;
  act(() => {
    searchPromise2 = result.current.submitSearch("فایکو");
  });

  // Resolve search 2 first
  await act(async () => {
    resolveSecondSearch(buildCatalogSearchGroups(productGroups, mockCatalogs));
    await searchPromise2;
  });

  assert.equal(result.current.search.query, "فایکو");
  assert.equal(result.current.activeGroup, "beam");

  // Later, resolve search 1 (which was started earlier)
  await act(async () => {
    resolveFirstSearch(buildCatalogSearchGroups(productGroups, mockCatalogs));
    await searchPromise1;
  });

  // Search 1's late response MUST BE DISCARDED: query and activeGroup remain search 2 ("فایکو" / "beam")
  assert.equal(result.current.search.query, "فایکو");
  assert.equal(result.current.activeGroup, "beam");
  assert.match(result.current.search.statusMessage, /فایکو/);
});
