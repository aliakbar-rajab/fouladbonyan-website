import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { afterEach } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://example.test/guide/",
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

dom.window.Element.prototype.scrollIntoView = () => {};
// LightPillar reaches for a WebGL context in an effect; jsdom has no canvas
// backend, and the component already no-ops when the context is missing.
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
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

const { cleanup, render, within } = await import("@testing-library/react");
const GuidePage = (await import("../app/GuidePage.tsx")).default;
const { buildGuideReference } = await import("../app/steel-reference.ts");
const { guidePageDefinitions, guidePageKeys, guideIndex } = await import(
  "../app/guide-page-data.ts"
);

const readData = (name) =>
  readFile(new URL(`../app/data/${name}`, import.meta.url), "utf8").then(
    JSON.parse,
  );

const reference = buildGuideReference(
  await readData("rebar-prices.json"),
  await readData("beam-prices.json"),
  await readData("product-prices.json"),
);

afterEach(cleanup);

test("each guide renders one H1 and keeps the document title it was served with", () => {
  for (const key of guidePageKeys) {
    const definition = guidePageDefinitions[key];
    const { container, unmount } = render(
      React.createElement(GuidePage, { guide: key, reference }),
    );

    const headings = container.querySelectorAll("h1");
    assert.equal(headings.length, 1, `${key} must render exactly one H1`);
    assert.equal(headings[0].textContent, definition.title);

    // The build stamps seoTitle into <head>; hydration must not replace it.
    assert.equal(
      dom.window.document.title,
      definition.seoTitle,
      `${key} must not rewrite the tab title on hydration`,
    );

    unmount();
  }

  const { container } = render(
    React.createElement(GuidePage, { reference }),
  );
  assert.equal(container.querySelector("h1").textContent, guideIndex.title);
  assert.equal(dom.window.document.title, guideIndex.seoTitle);
});

test("guide headings stay in order and never skip a level", () => {
  for (const key of [...guidePageKeys, undefined]) {
    const { container, unmount } = render(
      React.createElement(GuidePage, { guide: key, reference }),
    );
    const levels = [...container.querySelectorAll("h1, h2, h3, h4")].map(
      (heading) => Number(heading.tagName[1]),
    );
    assert.equal(levels[0], 1, `${key ?? "index"} must start at H1`);
    for (let index = 1; index < levels.length; index += 1) {
      assert.ok(
        levels[index] <= levels[index - 1] + 1,
        `${key ?? "index"} skips from h${levels[index - 1]} to h${levels[index]}`,
      );
    }
    unmount();
  }
});

test("weight tables are accessible tables with scoped headers", () => {
  const { container } = render(
    React.createElement(GuidePage, {
      guide: "rebar-weight-chart",
      reference,
    }),
  );

  const tables = container.querySelectorAll("table.guide-table");
  assert.ok(tables.length >= 2, "both rebar sub-catalogs need a table");

  for (const table of tables) {
    assert.ok(table.querySelector("caption")?.textContent);
    const columnHeaders = table.querySelectorAll('thead th[scope="col"]');
    assert.ok(columnHeaders.length >= 2);
    const rowHeaders = table.querySelectorAll('tbody th[scope="row"]');
    assert.ok(rowHeaders.length > 0);
    for (const row of table.querySelectorAll("tbody tr")) {
      assert.equal(
        row.querySelectorAll("th, td").length,
        columnHeaders.length,
        "every body row must have one cell per column",
      );
    }
  }

  // Persian digits throughout: no Latin numerals in the computed columns.
  const firstBodyRow = tables[0].querySelector("tbody tr");
  for (const cell of within(firstBodyRow).queryAllByRole("cell")) {
    assert.doesNotMatch(
      cell.textContent,
      /[0-9]/,
      `numeric cell "${cell.textContent}" must use Persian digits`,
    );
  }
});

test("guides link out to the catalog pages they describe", () => {
  const expectations = {
    "rebar-weight-chart": ["/rebar/", "/rebar/ribbed/", "/rebar/simple/"],
    "beam-weight-chart": ["/beam/beam/", "/beam/hash/"],
    "ribbed-vs-plain-rebar": ["/rebar/", "/rebar/ribbed/", "/rebar/simple/"],
    "ipe-vs-hash-beam": ["/beam/", "/beam/beam/", "/beam/hash/"],
    "units-and-quote-specs": ["/quote-process/#quote-form"],
  };

  for (const [key, hrefs] of Object.entries(expectations)) {
    const { container, unmount } = render(
      React.createElement(GuidePage, { guide: key, reference }),
    );
    const mainLinks = [
      ...container.querySelectorAll("main .info-content a[href]"),
    ].map((anchor) => anchor.getAttribute("href"));
    for (const href of hrefs) {
      assert.ok(
        mainLinks.includes(href),
        `${key} body must link to ${href}; found ${mainLinks.join(", ")}`,
      );
    }
    unmount();
  }
});
