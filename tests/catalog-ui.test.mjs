import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://example.test/",
  // Supplies requestAnimationFrame, which the forms use to move focus.
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

// jsdom implements neither of these, and App calls both. Every query
// reports false, which is the desktop / motion-allowed case.
dom.window.Element.prototype.scrollIntoView = () => {};
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

const { act, cleanup, fireEvent, render, screen, waitFor, within } = await import(
  "@testing-library/react"
);
const userEvent = (await import("@testing-library/user-event")).default;
const { PriceCatalog } = await import("../app/RebarPrices.tsx");
const App = (await import("../app/App.tsx")).default;

afterEach(cleanup);

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const row = (id, status, percent) => ({
  id,
  title: `محصول ${id}`,
  size: "16",
  standard: "A3",
  grade: "",
  branchLength: "12",
  form: "",
  approximateWeight: "20",
  delivery: "تهران",
  unit: "کیلوگرم",
  factory: "آزمایش",
  price: 60_000,
  percent,
  status,
  updatedAt: 1_700_000_000,
  updatedDate: "۱۴۰۲/۰۸/۲۳",
});

const category = (id, label, catalogRow) => ({
  id,
  label,
  groupingLabel: "کارخانه",
  specificationLabel: "استاندارد",
  sourceTitle: label,
  sourceUrl: "https://example.test/source",
  summary: {
    date: "امروز",
    min: 60_000,
    max: 60_000,
    average: 60_000,
    percent: catalogRow.percent,
    status: catalogRow.status,
  },
  filters: { sizes: ["16"], factories: ["آزمایش"] },
  factories: [
    {
      name: "آزمایش",
      updatedAt: 1_700_000_000,
      updatedDate: "۱۴۰۲/۰۸/۲۳",
      rows: [catalogRow],
    },
  ],
});

const priceData = {
  fetchedAt: "2026-07-27T10:00:00.000Z",
  sourceName: "منبع آزمایشی",
  sourceHome: "https://example.test/",
  taxRate: 0.1,
  categories: [
    category("first", "اول", row(1, "down", -2)),
    category("second", "دوم", row(2, "up", 3)),
  ],
};

const config = {
  productLabel: "آزمایشی",
  initialCategoryId: "first",
  categoryIcons: { first: "۱", second: "۲" },
  showWeightCalculator: true,
};

test("catalog tabs use roving focus and connected tabpanels", async () => {
  const user = userEvent.setup({ document });
  render(
    React.createElement(PriceCatalog, {
      priceData,
      config,
      phoneHref: "tel:+982100000000",
    }),
  );

  const tabs = screen.getAllByRole("tab");
  assert.equal(tabs[0].tabIndex, 0);
  assert.equal(tabs[1].tabIndex, -1);
  assert.equal(tabs[0].getAttribute("aria-selected"), "true");
  const firstPanel = screen.getByRole("tabpanel");
  assert.equal(firstPanel.id, tabs[0].getAttribute("aria-controls"));
  assert.equal(firstPanel.getAttribute("aria-labelledby"), tabs[0].id);

  tabs[0].focus();
  await user.keyboard("{ArrowLeft}");
  assert.equal(document.activeElement, tabs[1]);
  assert.equal(tabs[1].getAttribute("aria-selected"), "true");
  const secondPanel = screen.getByRole("tabpanel");
  assert.equal(secondPanel.id, tabs[1].getAttribute("aria-controls"));
});

test("trend direction is textual and no fake chart is exposed", () => {
  render(
    React.createElement(PriceCatalog, {
      priceData,
      config,
      phoneHref: "tel:+982100000000",
    }),
  );

  const table = screen.getByRole("table");
  assert.match(within(table).getByText(/کاهش/).textContent, /کاهش/);
  assert.equal(within(table).queryByText("نمودار"), null);
  assert.equal(within(table).queryByLabelText("روند قیمت"), null);
});

test("catalog rows alternate between light and dark treatments", () => {
  const firstRow = row(1, "down", -2);
  const secondRow = row(2, "up", 3);
  const stripedCategory = category("striped", "راه‌راه", firstRow);
  stripedCategory.factories[0].rows = [firstRow, secondRow];

  render(
    React.createElement(PriceCatalog, {
      priceData: {
        ...priceData,
        categories: [stripedCategory],
      },
      config: {
        ...config,
        initialCategoryId: "striped",
        categoryIcons: { striped: "۱" },
      },
      phoneHref: "tel:+982100000000",
    }),
  );

  const rows = screen
    .getByRole("table")
    .querySelectorAll("tbody tr.rebar-row-group");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].classList.contains("is-dark-row"), false);
  assert.equal(rows[1].classList.contains("is-dark-row"), true);
});

test("F4: a sub-one-percent move keeps its magnitude instead of showing zero", () => {
  const smallMove = row(3, "up", 0.14);
  render(
    React.createElement(PriceCatalog, {
      priceData: {
        ...priceData,
        categories: [category("only", "آزمون", smallMove)],
      },
      config: {
        ...config,
        initialCategoryId: "only",
        categoryIcons: { only: "۱" },
      },
      phoneHref: "tel:+982100000000",
    }),
  );

  // Row-level نوسان cell: an upward arrow next to "۰٪" is self-contradictory.
  const changeCell = screen.getByRole("table").querySelector(".row-change");
  assert.match(changeCell.textContent, /افزایش ۰٫۱۴٪/);

  // Category-level stat card reads the same percent and must agree.
  assert.match(
    screen.getByText(/میزان نوسان روزانه/).closest("article").textContent,
    /افزایش ۰٫۱۴٪/,
  );
});

test("F4: a whole-number move is not padded with decimals", () => {
  render(
    React.createElement(PriceCatalog, {
      priceData: {
        ...priceData,
        categories: [category("only", "آزمون", row(4, "down", -3))],
      },
      config: {
        ...config,
        initialCategoryId: "only",
        categoryIcons: { only: "۱" },
      },
      phoneHref: "tel:+982100000000",
    }),
  );

  const changeCell = screen.getByRole("table").querySelector(".row-change");
  assert.match(changeCell.textContent, /کاهش ۳٪/);
});

test("F2: a search that is still loading does not report 'no products found'", async () => {
  render(React.createElement(App));
  await settle();

  const input = screen.getByRole("searchbox", { name: "جست‌وجوی محصول" });
  await act(async () => {
    fireEvent.change(input, { target: { value: "نیشابور" } });
  });

  // Submit and flush only the state that lands before submitSearch awaits the
  // catalog chunks. This is the in-flight window the user actually sees.
  act(() => {
    fireEvent.submit(input.closest("form"));
  });

  assert.match(
    document.body.textContent,
    /در حال جست‌وجوی «نیشابور»/,
    "the status region should say a search is running",
  );
  assert.doesNotMatch(
    document.body.textContent,
    /محصولی پیدا نشد/,
    "a search that has not resolved yet must not claim there are no products",
  );

  // Once the live catalogs land, the real result must be reported.
  await waitFor(() => {
    assert.match(document.body.textContent, /نتیجه برای «نیشابور» پیدا شد/);
  });
  assert.doesNotMatch(document.body.textContent, /محصولی پیدا نشد/);
});

test("calculator rejects fractional branch quantities", async () => {
  const user = userEvent.setup({ document });
  render(
    React.createElement(PriceCatalog, {
      priceData,
      config,
      phoneHref: "tel:+982100000000",
    }),
  );

  await user.click(
    screen.getByRole("button", { name: /محاسبه وزن میلگرد/ }),
  );
  const quantity = screen.getByRole("spinbutton", { name: "تعداد شاخه" });
  await user.clear(quantity);
  await user.type(quantity, "1.5");
  assert.equal(quantity.getAttribute("aria-invalid"), "true");
  assert.ok(screen.getByRole("alert"));
  assert.match(screen.getByText(/وزن تقریبی/).textContent, /—/);
});

test("a quote request grows and shrinks one item at a time", async () => {
  const user = userEvent.setup({ document });
  const { QuoteRequestForm } = await import("../app/QuoteRequestForm.tsx");
  render(React.createElement(QuoteRequestForm));
  await settle();

  const itemCards = () => screen.getAllByRole("group");
  assert.equal(itemCards().length, 1);

  await user.click(screen.getByRole("button", { name: /افزودن کالای جدید/ }));
  assert.equal(itemCards().length, 2);
  // The new row takes focus so the buyer can keep typing.
  await waitFor(() =>
    assert.equal(
      document.activeElement?.getAttribute("name"),
      "itemProduct-2",
    ),
  );

  await user.click(screen.getByRole("button", { name: "حذف کالای ۲" }));
  assert.equal(itemCards().length, 1);
  // The last row is never removable.
  assert.equal(screen.queryByRole("button", { name: /حذف کالای/ }), null);
});
