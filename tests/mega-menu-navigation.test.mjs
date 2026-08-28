import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React from "react";
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
const App = (await import("../app/App.tsx")).default;
const { loadGroupCatalog } = await import("../app/catalog-reader.ts");

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
 * Regression coverage for the mega menu being a dead end on the homepage: a
 * category/factory/size "selection" only ever updated in-memory state that
 * ProductPanel only reads once route/search have already committed to a
 * category, so on the plain homepage (neither is true) the click had no
 * visible effect at all. The fix makes every one of these controls a real
 * <a href>; these tests pin that they stay real links (not preventDefault'd
 * into client-only state) and that App picks up the factory/size a link
 * carries as a query param.
 */

test("the homepage mega menu's subcategory, factory and size links are real navigations to pages that exist", async () => {
  addRoot();
  render(React.createElement(App));
  await settle();

  const user = userEvent.setup({ document });
  await user.click(screen.getByRole("button", { name: "قیمت روز محصولات" }));

  const subcategoryLink = await waitFor(() =>
    screen.getByRole("link", { name: /قیمت میلگرد آجدار/ }),
  );
  assert.equal(subcategoryLink.getAttribute("href"), "/rebar/ribbed/");
  assert.equal(dispatchClick(subcategoryLink).defaultPrevented, false);

  const factoryLink = document.querySelector(".mega-rebar-factories a");
  assert.ok(factoryLink, "expected at least one factory link in the mega menu");
  assert.match(
    factoryLink.getAttribute("href"),
    /^\/rebar\/ribbed\/\?factory=/,
  );
  assert.equal(dispatchClick(factoryLink).defaultPrevented, false);

  const sizeLink = document.querySelector(".mega-rebar-sizes a");
  assert.ok(sizeLink, "expected at least one size link in the mega menu");
  assert.match(sizeLink.getAttribute("href"), /^\/rebar\/ribbed\/\?size=/);
  assert.equal(dispatchClick(sizeLink).defaultPrevented, false);
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
  render(React.createElement(App));
  await settle();

  await waitFor(() => {
    assert.equal(screen.getByLabelText("کارخانه").value, factory);
  });
});
