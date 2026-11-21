import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { setupDomEnv } from "./helpers/dom-env.mjs";

const dom = setupDomEnv({ url: "https://example.test/" });
dom.window.matchMedia = (query) => ({
  media: query,
  matches: false,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});

const { act, cleanup, render, screen, waitFor } = await import(
  "@testing-library/react"
);
const userEvent = (await import("@testing-library/user-event")).default;
const { interpretSiteRoute } = await import("../app/site-route.ts");
const { pageElement } = await import("../app/site-page-element.tsx");

// What static-entry/main.tsx does: read the route off the address bar and the
// root's data attributes, and render the element the Site page module builds.
const renderPage = () =>
  render(
    pageElement(
      interpretSiteRoute({
        pathname: window.location.pathname,
        dataset: document.getElementById("root")?.dataset,
      }),
    ),
  );
const { loadGroupCatalog } = await import("../app/catalog-reader.ts");
const {
  CATALOG_FILTER_HANDOFF_KEY,
  resetCatalogFilterHandoffCache,
} = await import("../app/catalog-filter-handoff.ts");

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const addRoot = (initialCategory, initialSubcategory) => {
  const root = document.createElement("div");
  root.id = "root";
  if (initialCategory) root.dataset.initialCategory = initialCategory;
  if (initialSubcategory) root.dataset.initialSubcategory = initialSubcategory;
  document.body.append(root);
};

afterEach(() => {
  cleanup();
  document.getElementById("root")?.remove();
  window.sessionStorage.clear();
  resetCatalogFilterHandoffCache();
  window.history.replaceState({}, "", "/");
});

function dispatchClick(element) {
  const event = new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
  return event;
}

/*
 * Regression coverage for the mega menu being a dead end on the homepage:
 * group/subcategory links are real <a href> navigations, while factory and size
 * quick-picks are buttons that carry the selected filter via sessionStorage and
 * navigate cleanly to the canonical target page without minting `?factory=` or
 * `?size=` crawlable links.
 */

test("the homepage mega menu keeps subcategory links crawlable and renders factory/size quick-picks as sessionStorage buttons", async () => {
  addRoot();
  renderPage();
  await settle();

  const user = userEvent.setup({ document });
  await user.click(screen.getByRole("button", { name: "قیمت روز محصولات" }));

  const subcategoryLink = await waitFor(() =>
    screen.getByRole("link", { name: /قیمت میلگرد آجدار/ }),
  );
  assert.equal(subcategoryLink.getAttribute("href"), "/rebar/ribbed/");
  assert.equal(dispatchClick(subcategoryLink).defaultPrevented, false);

  assert.equal(
    document.querySelectorAll(".mega-rebar-factories a, .mega-rebar-sizes a")
      .length,
    0,
    "factory and size quick-picks must not render parameterised <a> links",
  );

  const factoryButton = document.querySelector(".mega-rebar-factories button");
  assert.ok(factoryButton, "expected at least one factory button in the mega menu");
  assert.equal(factoryButton.getAttribute("type"), "button");

  const sizeButton = document.querySelector(".mega-rebar-sizes button");
  assert.ok(sizeButton, "expected at least one size button in the mega menu");
  assert.equal(sizeButton.getAttribute("type"), "button");

  await user.click(factoryButton);
  const stored = JSON.parse(
    window.sessionStorage.getItem(CATALOG_FILTER_HANDOFF_KEY),
  );
  assert.equal(stored.groupId, "rebar");
  assert.equal(stored.categoryId, "ribbed");
  assert.ok(stored.factory, "clicking a factory button must record its factory filter");
});

test("a mega-menu group link switches the panel on a plain click and opens normally on a modifier click", async () => {
  /*
   * These switch which group the open panel is showing, so a plain click is
   * intercepted -- but they are anchors pointing at a real page, and they used
   * to preventDefault unconditionally. That killed ctrl/cmd/shift-click on a
   * control that advertises a destination in the status bar, while
   * middle-click (which never reaches an onClick handler) opened the tab all
   * along, so the two gestures disagreed.
   */
  addRoot();
  renderPage();
  await settle();

  const user = userEvent.setup({ document });
  await user.click(screen.getByRole("button", { name: "قیمت روز محصولات" }));

  const beamLink = await waitFor(() =>
    document
      .querySelector(".mega-other-products")
      .querySelector('a[href="/beam/"]'),
  );
  assert.ok(beamLink, "expected a group link for تیرآهن");

  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
    const event = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      [modifier]: true,
    });
    beamLink.dispatchEvent(event);
    assert.equal(
      event.defaultPrevented,
      false,
      `a ${modifier} click must be left to the browser`,
    );
  }

  await act(async () => {
    assert.equal(dispatchClick(beamLink).defaultPrevented, true);
  });
  await waitFor(() =>
    assert.equal(beamLink.getAttribute("aria-current"), "true"),
  );
  assert.ok(
    document.querySelector(".mega-rebar-types").textContent.includes("تیرآهن"),
    "a plain click must switch the panel to that group",
  );
});

test("landing on a subcategory page after a MegaMenu filter handoff applies the filter on mount", async () => {
  const catalog = await loadGroupCatalog("rebar");
  const ribbed = catalog.categories.find((category) => category.id === "ribbed");
  const factory = ribbed.filters.factories[0];
  assert.ok(factory, "test fixture requires at least one rebar factory");

  window.sessionStorage.setItem(
    CATALOG_FILTER_HANDOFF_KEY,
    JSON.stringify({ groupId: "rebar", categoryId: "ribbed", factory }),
  );
  window.history.replaceState({}, "", "/rebar/ribbed/");
  addRoot("rebar", "ribbed");
  renderPage();
  await settle();

  await waitFor(() => {
    assert.equal(screen.getByLabelText("کارخانه").value, factory);
  });
  assert.equal(
    window.sessionStorage.getItem(CATALOG_FILTER_HANDOFF_KEY),
    null,
    "the one-shot handoff must be cleared once consumed",
  );
});

test("landing on a subcategory page with a ?factory= query param applies it as the initial filter", async () => {
  const catalog = await loadGroupCatalog("rebar");
  const ribbed = catalog.categories.find((category) => category.id === "ribbed");
  const factory = ribbed.filters.factories[0];
  assert.ok(factory, "test fixture requires at least one rebar factory");

  window.history.replaceState(
    {},
    "",
    `/rebar/ribbed/?factory=${encodeURIComponent(factory)}`,
  );
  addRoot("rebar", "ribbed");
  renderPage();
  await settle();

  await waitFor(() => {
    assert.equal(screen.getByLabelText("کارخانه").value, factory);
  });
});
