import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React from "react";
import { setupDomEnv } from "./helpers/dom-env.mjs";

// pretendToBeVisual supplies requestAnimationFrame, which the forms use to
// move focus.
setupDomEnv({ url: "https://example.test/", pretendToBeVisual: true });

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

/*
 * A category with more factory groups than the "show more" control keeps on
 * screen. Nine groups, one row each, so the row count is unambiguous.
 */
const wideCategory = () => {
  const names = Array.from({ length: 9 }, (_, index) => `کارخانه ${index + 1}`);
  return {
    ...category("wide", "پرتعداد", row(1, "up", 1)),
    id: "wide",
    filters: { sizes: ["16"], factories: names },
    factories: names.map((name, index) => ({
      name,
      updatedAt: 1_700_000_000,
      updatedDate: "۱۴۰۲/۰۸/۲۳",
      rows: [{ ...row(index + 1, "up", 1), factory: name }],
    })),
  };
};

const renderWide = () =>
  render(
    React.createElement(PriceCatalog, {
      priceData: { ...priceData, categories: [wideCategory()] },
      config: {
        ...config,
        initialCategoryId: "wide",
        categoryIcons: { wide: "۱" },
      },
      phoneHref: "tel:+982100000000",
    }),
  );

test("F14: every row is in the DOM before anything is clicked", () => {
  renderWide();

  // All nine factory groups render, not the six that stay visible.
  const cards = document.querySelectorAll(".factory-price-card");
  assert.equal(cards.length, 9);
  assert.equal(document.querySelectorAll("tbody tr.rebar-row-group").length, 9);

  // The overflow is present but marked collapsed, and still carries its rows.
  const collapsed = document.querySelectorAll(".factory-price-card.is-collapsed");
  assert.equal(collapsed.length, 3);
  for (const card of collapsed) {
    assert.equal(card.querySelectorAll("tbody tr.rebar-row-group").length, 1);
  }
  for (const card of [...cards].slice(0, 6)) {
    assert.equal(card.classList.contains("is-collapsed"), false);
  }
});

test("F14: the show-more control toggles visibility, it does not create rows", async () => {
  const user = userEvent.setup({ document });
  renderWide();

  const rowCount = () =>
    document.querySelectorAll("tbody tr.rebar-row-group").length;
  const collapsedCount = () =>
    document.querySelectorAll(".factory-price-card.is-collapsed").length;

  assert.equal(rowCount(), 9);
  const toggle = screen.getByRole("button", { name: /کارخانه دیگر/ });
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(
    toggle.getAttribute("aria-controls"),
    document.querySelector(".factory-price-list").id,
  );

  await user.click(toggle);
  // Same rows, now all visible.
  assert.equal(rowCount(), 9);
  assert.equal(collapsedCount(), 0);
  const collapse = screen.getByRole("button", { name: /نمایش کمتر/ });
  assert.equal(collapse.getAttribute("aria-expanded"), "true");

  await user.click(collapse);
  assert.equal(rowCount(), 9);
  assert.equal(collapsedCount(), 3);
});

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
