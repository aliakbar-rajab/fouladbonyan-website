import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { setupDomEnv } from "./helpers/dom-env.mjs";

setupDomEnv({ url: "https://example.test/" });

const { act, cleanup, renderHook } = await import("@testing-library/react");
const {
  buildCatalogSearchGroups,
  evaluateCatalogSearch,
  priceSectionHeading,
  useCatalogWorkspace,
} = await import("../app/catalog-search-coordinator.ts");
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
// 1. PURE INDEXING & EVALUATION TESTS
// ---------------------------------------------------------------------------

test("buildCatalogSearchGroups indexes all rows, category IDs, and search text accurately", () => {
  const searchGroups = buildCatalogSearchGroups(productGroups, mockCatalogs);

  const rebarGroup = searchGroups.find((g) => g.id === "rebar");
  assert.ok(rebarGroup);
  assert.equal(rebarGroup.rows.length, 3);

  const firstRow = rebarGroup.rows[0];
  assert.equal(firstRow.product, "میلگرد آجدار ۱۴ نیشابور");
  assert.equal(firstRow.size, "14");
  assert.equal(firstRow.factory, "نیشابور");
  assert.equal(firstRow.categoryId, "ribbed");
  assert.match(firstRow.searchText, /میلگرد آجدار/);
  assert.match(firstRow.searchText, /نیشابور/);
  assert.match(firstRow.searchText, /2mm/);
});

test("evaluateCatalogSearch returns all groups on empty or whitespace query", () => {
  const searchGroups = buildCatalogSearchGroups(productGroups, mockCatalogs);
  const result = evaluateCatalogSearch("   ", searchGroups);

  assert.equal(result.matchedGroups.length, searchGroups.length);
  assert.equal(result.totalResultCount, 0);
  assert.equal(result.selectedGroupId, "rebar");
  assert.equal(result.statusMessage, "همه محصولات نمایش داده می‌شوند.");
});

test("evaluateCatalogSearch matches Persian text and derives the first result's view parameters", () => {
  const searchGroups = buildCatalogSearchGroups(productGroups, mockCatalogs);
  const result = evaluateCatalogSearch("نیشابور", searchGroups);

  assert.equal(result.matchedGroups.length, 1);
  assert.equal(result.matchedGroups[0].id, "rebar");
  assert.equal(result.totalResultCount, 1);
  assert.equal(result.selectedGroupId, "rebar");
  assert.deepEqual(result.suggestedViewRequest, {
    categoryId: "ribbed",
    factory: "نیشابور",
    size: "14",
  });
  assert.match(result.statusMessage, /۱ نتیجه برای «نیشابور» پیدا شد/);
});

test("evaluateCatalogSearch normalizes Arabic Yeh/Kaf and Persian/Arabic digits", () => {
  const searchGroups = buildCatalogSearchGroups(productGroups, mockCatalogs);
  // Using Arabic Kaf (ك) and Arabic Yeh (ي) and ASCII digits:
  const result = evaluateCatalogSearch("كاشان 10", searchGroups);

  assert.equal(result.matchedGroups.length, 1);
  assert.equal(result.matchedGroups[0].id, "rebar");
  assert.equal(result.matchedGroups[0].rows[0].factory, "کویر کاشان");
  assert.equal(result.suggestedViewRequest.categoryId, "simple");
});

test("evaluateCatalogSearch handles queries with no matching products cleanly", () => {
  const searchGroups = buildCatalogSearchGroups(productGroups, mockCatalogs);
  const result = evaluateCatalogSearch("محصول_ناموجود_xyz", searchGroups);

  assert.equal(result.matchedGroups.length, 0);
  assert.equal(result.totalResultCount, 0);
  assert.match(result.statusMessage, /نتیجه‌ای برای «محصول_ناموجود_xyz» پیدا نشد/);
});

test("priceSectionHeading formats headings for category, subcategory, and home routes", () => {
  const subcatHeading = priceSectionHeading("میلگرد ساده", "میلگرد");
  assert.equal(subcatHeading.title, "جدول قیمت و مشخصات فنی میلگرد ساده");

  const catHeading = priceSectionHeading(undefined, "تیرآهن");
  assert.equal(catHeading.title, "جدول و مقایسه قیمت انواع تیرآهن");

  const defaultHeading = priceSectionHeading(undefined, undefined);
  assert.equal(defaultHeading.title, "قیمت روز آهن‌آلات و مقاطع فولادی");
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
