import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { setupDomEnv } from "./helpers/dom-env.mjs";

setupDomEnv({ url: "https://example.test/" });

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { priceSectionHeading, useCatalogWorkspace } = await import(
  "../app/use-catalog-workspace.ts"
);
const { buildCatalogSearchGroups } = await import("../app/catalog-search.ts");
const { productGroups } = await import("../app/category-meta.ts");
const { mockCatalogs } = await import("./helpers/catalog-search-fixture.mjs");

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

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
  assert.equal(result.current.selectedGroupValue, "");
  assert.equal(result.current.search.input, "");
  assert.equal(result.current.search.query, "");
  assert.equal(result.current.search.isActive, false);
  assert.equal(result.current.search.isSearching, false);
  assert.equal(result.current.activeViewRequest.requestId, 0);
  assert.equal(result.current.hero, null);
});

test("useCatalogWorkspace derives category overview for overview hubs and catalog directly for consolidated /beam/", () => {
  const { result: rebarOverview } = renderHook(() =>
    useCatalogWorkspace({
      initialCategory: "rebar",
    }),
  );

  assert.equal(rebarOverview.current.viewMode, "category-overview");
  assert.equal(rebarOverview.current.isCategoryRoute, true);
  assert.equal(rebarOverview.current.brandHref, "/");
  assert.equal(rebarOverview.current.activeGroup, "rebar");
  assert.equal(rebarOverview.current.hero?.label, "میلگرد");
  assert.equal(rebarOverview.current.hero?.h1, "قیمت روز میلگرد آجدار و ساده");

  const { result: beamCatalog } = renderHook(() =>
    useCatalogWorkspace({
      initialCategory: "beam",
    }),
  );
  assert.equal(beamCatalog.current.viewMode, "catalog");
  assert.equal(beamCatalog.current.activeViewRequest.categoryId, "beam");
  assert.equal(beamCatalog.current.hero?.label, "تیرآهن");
  assert.match(
    beamCatalog.current.hero?.intro ?? "",
    /مقایسه قیمت روز تیرآهن استاندارد اروپا/,
  );
});

test("useCatalogWorkspace derives catalog view mode and preserves query params for catalog routes", () => {
  window.history.replaceState({}, "", "/beam/?factory=فایکو&size=18");
  const { result } = renderHook(() =>
    useCatalogWorkspace({
      initialCategory: "beam",
    }),
  );

  assert.equal(result.current.viewMode, "catalog");
  assert.equal(result.current.isCategoryRoute, true);
  assert.equal(result.current.brandHref, "/");
  assert.equal(result.current.activeGroup, "beam");
  assert.equal(result.current.activeViewRequest.categoryId, "beam");
  assert.equal(result.current.activeViewRequest.factory, "فایکو");
  assert.equal(result.current.activeViewRequest.size, "18");
  assert.equal(result.current.hero?.label, "تیرآهن");
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
  let intercepted = false;
  act(() => {
    intercepted = result.current.selectTab("sheet", mockEvent);
  });
  assert.equal(intercepted, false);
  assert.equal(prevented, false);

  // 2. Activate search via controlled input
  act(() => {
    result.current.setSearchInput("فایکو");
  });
  await act(async () => {
    await result.current.submitSearch();
  });
  assert.equal(result.current.search.isActive, true);
  assert.equal(result.current.search.input, "فایکو");
  assert.equal(result.current.selectedGroupValue, "beam");

  // 3. Active search: prevents default link navigation, clears input, and switches workspace group in-place
  act(() => {
    intercepted = result.current.selectTab("profile", mockEvent);
  });
  assert.equal(intercepted, true);
  assert.equal(prevented, true);
  assert.equal(result.current.activeGroup, "profile");
  assert.equal(result.current.search.input, "");
  assert.equal(result.current.search.query, "");
  assert.equal(result.current.search.isActive, false);
  assert.equal(result.current.selectedGroupValue, "");
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

test("priceSectionHeading formats headings for category, subcategory, and home routes", () => {
  const subcatHeading = priceSectionHeading("میلگرد ساده", "میلگرد");
  assert.equal(subcatHeading.title, "جدول قیمت و مشخصات فنی میلگرد ساده");

  const catHeading = priceSectionHeading(undefined, "تیرآهن");
  assert.equal(catHeading.title, "جدول و مقایسه قیمت انواع تیرآهن");

  const defaultHeading = priceSectionHeading(undefined, undefined);
  assert.equal(defaultHeading.title, "قیمت روز آهن‌آلات و مقاطع فولادی");
});
