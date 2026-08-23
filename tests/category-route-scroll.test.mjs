import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React from "react";
import { setupDomEnv } from "./helpers/dom-env.mjs";

const dom = setupDomEnv({ url: "https://example.test/" });

const scrollCalls = [];
let prefersReducedMotion = false;
dom.window.Element.prototype.scrollIntoView = function scrollIntoView(options) {
  scrollCalls.push({ id: this.id, options });
};
dom.window.matchMedia = (query) => ({
  media: query,
  matches:
    query === "(prefers-reduced-motion: reduce)" && prefersReducedMotion,
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
const App = (await import("../app/App.tsx")).default;

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const addRoot = (initialCategory, initialSubcategory, initialSubcategoryLabel) => {
  const root = document.createElement("div");
  root.id = "root";
  if (initialCategory) root.dataset.initialCategory = initialCategory;
  if (initialSubcategory) root.dataset.initialSubcategory = initialSubcategory;
  if (initialSubcategoryLabel)
    root.dataset.initialSubcategoryLabel = initialSubcategoryLabel;
  document.body.append(root);
};


afterEach(() => {
  cleanup();
  document.getElementById("root")?.remove();
  scrollCalls.length = 0;
  prefersReducedMotion = false;
  window.history.replaceState({}, "", "/");
});

test("a direct category route activates its tab and scrolls to prices", async () => {
  addRoot("beam");
  render(React.createElement(App));
  await settle();

  assert.equal(
    screen.getByRole("tab", { name: "تیرآهن" }).getAttribute("aria-selected"),
    "true",
  );
  // Verify category H1, intro, and breadcrumb
  assert.equal(
    screen.getByRole("heading", { level: 1 }).textContent,
    "قیمت روز تیرآهن IPE و هاش",
  );
  assert.match(
    document.body.textContent,
    /تیرآهن معمولی IPE، هاش سبک/,
  );
  const breadcrumb = screen.getByRole("navigation", { name: "مسیر راهنما" });
  assert.ok(breadcrumb);
  assert.equal(breadcrumb.querySelector("a")?.getAttribute("href"), "/");
  assert.equal(breadcrumb.querySelector("a")?.textContent, "صفحه اصلی");

  await waitFor(() => {
    assert.deepEqual(scrollCalls, [
      {
        id: "prices",
        options: { behavior: "smooth", block: "start" },
      },
    ]);
  });
  await waitFor(() => assert.ok(screen.getAllByRole("table").length > 0));
});

test("the development shell resolves a category directly from the pathname", async () => {
  window.history.replaceState({}, "", "/channel/");
  addRoot();
  render(React.createElement(App));
  await settle();

  assert.equal(
    screen.getByRole("tab", { name: "ناودانی" }).getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    screen.getByRole("heading", { level: 1 }).textContent,
    "قیمت روز ناودانی سبک و سنگین",
  );
});

test("the homepage keeps its default tab and does not auto-scroll", async () => {
  addRoot();
  render(React.createElement(App));
  await settle();

  assert.equal(
    screen.getByRole("tab", { name: "میلگرد" }).getAttribute("aria-selected"),
    "true",
  );
  assert.deepEqual(scrollCalls, []);

  // Verify homepage H1 targets general steel price intent
  assert.match(
    screen.getByRole("heading", { level: 1 }).textContent,
    /قیمت روز آهن و فولاد/,
  );

  // Verify overview table is present and has crawlable links to all 8 category pages
  const overviewTable = document.getElementById("overview-table");
  assert.ok(overviewTable, "Overview table must be present on homepage");

  const expectedCategories = [
    "rebar",
    "beam",
    "sheet",
    "profile",
    "pipe",
    "angle",
    "channel",
    "wire",
  ];
  for (const catId of expectedCategories) {
    const link = overviewTable.querySelector(`a[href="/${catId}/"]`);
    assert.ok(link, `Homepage overview must have crawlable link to /${catId}/`);
  }

  await waitFor(() => assert.ok(screen.getAllByRole("table").length > 0));
});

test("the homepage hero price action reaches the live price workspace", async () => {
  addRoot();
  render(React.createElement(App));
  await settle();

  screen.getByRole("button", { name: "ورود به مرکز قیمت فولاد" }).click();
  assert.deepEqual(scrollCalls.at(-1), {
    id: "prices",
    options: { behavior: "smooth", block: "start" },
  });
});

test("a direct category route respects reduced-motion scrolling", async () => {
  prefersReducedMotion = true;
  addRoot("rebar");
  render(React.createElement(App));
  await settle();

  // Verify rebar H1 is distinct
  assert.equal(
    screen.getByRole("heading", { level: 1 }).textContent,
    "قیمت روز میلگرد آجدار و ساده",
  );

  await waitFor(() => {
    assert.deepEqual(scrollCalls, [
      {
        id: "prices",
        options: { behavior: "auto", block: "start" },
      },
    ]);
  });
  await waitFor(() => assert.ok(screen.getAllByRole("table").length > 0));
});

test("all category routes produce distinct H1 headings", async () => {
  const { productGroups } = await import("../app/category-meta.ts");
  const h1s = new Set();

  for (const group of productGroups) {
    assert.ok(group.h1, `${group.id} must have an h1 defined`);
    assert.ok(!h1s.has(group.h1), `Duplicate h1 found: ${group.h1}`);
    h1s.add(group.h1);
  }

  // Also assert homepage H1 is distinct from all category H1s
  const homeH1 = "قیمت روز آهن و فولاد؛ بنیان فولاد داریا";
  assert.ok(!h1s.has(homeH1), "Homepage H1 must be distinct from category H1s");
  assert.equal(h1s.size, 8, "Expected 8 unique category H1s");
});

test("a direct subcategory route activates its tab, sets 3-level breadcrumbs and subcategory H1", async () => {
  addRoot("rebar", "simple", "میلگرد ساده");
  render(React.createElement(App));
  await settle();

  // Verify subcategory tab is active
  assert.equal(
    screen.getByRole("tab", { name: /میلگرد ساده/ }).getAttribute("aria-selected"),
    "true",
  );
  // Verify subcategory H1
  assert.equal(
    screen.getByRole("heading", { level: 1 }).textContent,
    "قیمت روز میلگرد ساده",
  );
  // Verify 3-level breadcrumb
  const breadcrumb = screen.getByRole("navigation", { name: "مسیر راهنما" });
  assert.ok(breadcrumb);
  const links = breadcrumb.querySelectorAll("a");
  assert.equal(links.length, 2);
  assert.equal(links[0].getAttribute("href"), "/");
  assert.equal(links[0].textContent, "صفحه اصلی");
  assert.equal(links[1].getAttribute("href"), "/rebar/");
  assert.equal(links[1].textContent, "میلگرد");

  await waitFor(() => {
    assert.deepEqual(scrollCalls, [
      {
        id: "prices",
        options: { behavior: "smooth", block: "start" },
      },
    ]);
  });
});

test("a subcategory route resolved from pathname or without explicit label resolves Persian H1 and breadcrumbs", async () => {
  window.history.replaceState({}, "", "/rebar/ribbed/");
  addRoot();
  render(React.createElement(App));
  await settle();

  assert.equal(
    screen.getByRole("heading", { level: 1 }).textContent,
    "قیمت روز میلگرد آجدار",
  );
  const breadcrumb = screen.getByRole("navigation", { name: "مسیر راهنما" });
  assert.ok(breadcrumb);
  assert.match(breadcrumb.textContent, /میلگرد آجدار/);
});
