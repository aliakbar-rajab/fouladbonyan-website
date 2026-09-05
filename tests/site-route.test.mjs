import assert from "node:assert/strict";
import test from "node:test";
import {
  interpretSiteRoute,
  isHeroRoute,
  isOrganizationRoute,
  resolveCatalogRouteRequest,
  siteRouteDataset,
  siteRoutePath,
} from "../app/site-route.ts";

const routeCases = [
  [{ kind: "home" }, "/", {}],
  [
    { kind: "catalog", category: "rebar" },
    "/rebar/",
    { initialCategory: "rebar" },
  ],
  [
    {
      kind: "catalog",
      category: "rebar",
      subcategory: "ribbed",
      subcategoryLabel: "میلگرد آجدار",
    },
    "/rebar/ribbed/",
    {
      initialCategory: "rebar",
      initialSubcategory: "ribbed",
      initialSubcategoryLabel: "میلگرد آجدار",
    },
  ],
  [{ kind: "contact" }, "/contact/", { page: "contact" }],
  [{ kind: "info", page: "about" }, "/about/", { page: "about" }],
  [{ kind: "guide" }, "/guide/", { page: "guide" }],
  [
    { kind: "guide", guide: "rebar-weight-chart" },
    "/guide/rebar-weight-chart/",
    { page: "guide", guide: "rebar-weight-chart" },
  ],
];

test("canonical site routes round-trip through pathname and root dataset", () => {
  for (const [route, pathname, dataset] of routeCases) {
    assert.equal(siteRoutePath(route), pathname);
    assert.deepEqual(siteRouteDataset(route), dataset);
    assert.deepEqual(interpretSiteRoute({ pathname, dataset }), route);
  }
});

test("root dataset wins during hydration and unknown paths preserve the home fallback", () => {
  assert.deepEqual(
    interpretSiteRoute({
      pathname: "/wrong/path/",
      dataset: { page: "about" },
    }),
    { kind: "info", page: "about" },
  );
  assert.deepEqual(interpretSiteRoute({ pathname: "/not-a-route/" }), {
    kind: "home",
  });
});

test("catalog requests share route interpretation while allowing explicit prerender props", () => {
  assert.deepEqual(
    resolveCatalogRouteRequest({ pathname: "/rebar/ribbed/" }),
    {
      category: "rebar",
      subcategory: "ribbed",
      subcategoryLabel: "میلگرد آجدار",
    },
  );

  assert.deepEqual(
    resolveCatalogRouteRequest({
      pathname: "/",
      overrides: { category: "beam" },
    }),
    { category: "beam", subcategory: undefined, subcategoryLabel: undefined },
  );
});

test("hero and organization policy derives from the canonical route kind", () => {
  assert.equal(isHeroRoute({ kind: "home" }), true);
  assert.equal(isHeroRoute({ kind: "catalog", category: "sheet" }), true);
  assert.equal(isHeroRoute({ kind: "contact" }), false);
  assert.equal(isOrganizationRoute({ kind: "home" }), false);
  assert.equal(isOrganizationRoute({ kind: "contact" }), true);
  assert.equal(isOrganizationRoute({ kind: "info", page: "about" }), false);
  assert.equal(isOrganizationRoute({ kind: "info", page: "terms" }), false);
});
