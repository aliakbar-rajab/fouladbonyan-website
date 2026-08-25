import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React from "react";
import { setupDomEnv } from "./helpers/dom-env.mjs";

setupDomEnv({ url: "https://example.test/", pretendToBeVisual: true });

const { act, cleanup, render, screen, waitFor } = await import(
  "@testing-library/react"
);
const userEvent = (await import("@testing-library/user-event")).default;
const { PreInvoiceBuilder } = await import("../app/PreInvoiceBuilder.tsx");
const {
  bigRoundDiv,
  formatBigRial,
  formatPercentBps,
  formatQtyMilli,
  rialToWordsBig,
  strictMoney,
  strictPercent,
  strictQuantity,
} = await import("../app/preinvoice-numbers.ts");
const {
  calculateInvoiceTotals,
  defaultInvoiceRowCount,
  makeBlankRow,
  makeBlankRows,
  rowIsBlank,
} = await import("../app/preinvoice-engine.ts");

afterEach(cleanup);
afterEach(() => {
  window.localStorage.clear();
});

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

// ---------- preinvoice-numbers.ts ----------

test("formatBigRial groups large Rial amounts with Persian digits, exactly (no float rounding)", () => {
  assert.equal(formatBigRial(0n), "۰");
  assert.equal(formatBigRial(1000n), "۱٬۰۰۰");
  // Larger than Number.MAX_SAFE_INTEGER: only exact under BigInt arithmetic.
  assert.equal(
    formatBigRial(123456789012345678901234n),
    "۱۲۳٬۴۵۶٬۷۸۹٬۰۱۲٬۳۴۵٬۶۷۸٬۹۰۱٬۲۳۴",
  );
  assert.equal(formatBigRial(-500n), "-۵۰۰");
});

test("formatQtyMilli keeps up to 3 decimal places and trims trailing zeros", () => {
  assert.equal(formatQtyMilli(1000n), "۱");
  assert.equal(formatQtyMilli(1500n), "۱٫۵");
  assert.equal(formatQtyMilli(1005n), "۱٫۰۰۵");
});

test("formatPercentBps keeps up to 2 decimal places", () => {
  assert.equal(formatPercentBps(1000n), "۱۰");
  assert.equal(formatPercentBps(950n), "۹٫۵");
});

test("bigRoundDiv rounds half-up entirely in BigInt arithmetic", () => {
  assert.equal(bigRoundDiv(5n, 2n), 3n);
  assert.equal(bigRoundDiv(-5n, 2n), -3n);
  assert.equal(bigRoundDiv(10n, 2n), 5n);
});

test("strictQuantity rejects zero, negative and non-numeric quantities but accepts up to 3 decimals", () => {
  assert.equal(strictQuantity("0").valid, false);
  assert.equal(strictQuantity("-1").valid, false);
  assert.equal(strictQuantity("abc").valid, false);
  assert.equal(strictQuantity("۲٫۵").valid, true);
  assert.equal(strictQuantity("1,000").valid, true);
});

test("strictMoney treats a comma as grouping, not a decimal point (a locale trap the original app called out)", () => {
  // "1,5" must NOT silently become 15 -- a comma is a grouping separator here,
  // and "1,5" is not a valid 3-digit group, so it's rejected outright.
  assert.equal(strictMoney("1,5", false).valid, false);
  assert.equal(strictMoney("1.5", false).valid, false); // money has no fractional Rial
  assert.equal(strictMoney("1,000", false).value, 1000n);
  assert.equal(strictMoney("", true).value, 0n);
  assert.equal(strictMoney("", false).valid, false);
});

test("strictPercent bounds the tax rate to 0-100 with at most 2 decimals", () => {
  assert.equal(strictPercent("10").valid, true);
  assert.equal(strictPercent("100").valid, true);
  assert.equal(strictPercent("100.01").valid, false);
  assert.equal(strictPercent("-1").valid, false);
  assert.equal(strictPercent("9.999").valid, false);
});

test("rialToWordsBig spells out amounts using هزار/میلیون/میلیارد composition", () => {
  assert.equal(rialToWordsBig(0n), "صفر ریال");
  assert.equal(rialToWordsBig(1000n), "یک هزار ریال");
  assert.equal(rialToWordsBig(1_500_000n), "یک میلیون و پانصد هزار ریال");
  // 10^12 is expressed as «هزار میلیارد», never an imported term.
  assert.match(rialToWordsBig(1_000_000_000_000n), /هزار میلیارد/);
});

// ---------- preinvoice-engine.ts ----------

test("rowIsBlank / makeBlankRows / defaultInvoiceRowCount", () => {
  assert.equal(rowIsBlank(makeBlankRow(1)), true);
  assert.equal(rowIsBlank({ ...makeBlankRow(1), description: "x" }), false);
  assert.equal(defaultInvoiceRowCount("landscape"), 7);
  assert.equal(defaultInvoiceRowCount("portrait"), 14);
  const rows = makeBlankRows(3, 10);
  assert.deepEqual(rows.map((r) => r.id), [10, 11, 12]);
});

test("calculateInvoiceTotals sums rows, applies discount then tax, and ignores blank rows", () => {
  const items = [
    { id: 1, description: "میلگرد", quantity: "۱۰", unit: "کیلوگرم", unitPrice: "۱۰۰۰", discount: "۵۰۰" },
    makeBlankRow(2),
  ];
  const totals = calculateInvoiceTotals({ items, taxPercent: "۱۰", meta: { date: "" } });
  assert.equal(totals.filledRows, 1);
  assert.equal(totals.grossTotal, 10000n);
  assert.equal(totals.discountTotal, 500n);
  assert.equal(totals.afterDiscountTotal, 9500n);
  assert.equal(totals.taxTotal, 950n);
  assert.equal(totals.netTotal, 10450n);
  assert.equal(totals.calculationErrors.length, 0);
});

test("a discount larger than its own row's total is rejected rather than silently producing a negative row", () => {
  const items = [
    { id: 1, description: "x", quantity: "۱", unit: "kg", unitPrice: "۱۰۰۰", discount: "۵۰۰۰" },
  ];
  const totals = calculateInvoiceTotals({ items, taxPercent: "۰", meta: { date: "" } });
  assert.equal(totals.rows[0].discountError, true);
  assert.ok(totals.financialBlockingErrors.some((m) => m.includes("تخفیف از مبلغ کل ردیف بیشتر است")));
  // The row's own total still calculates; only the excess discount is neutralized.
  assert.equal(totals.rows[0].total, 1000n);
});

test("an out-of-range tax percent blocks Print/Save without corrupting the rest of the totals", () => {
  const items = [
    { id: 1, description: "x", quantity: "۱", unit: "kg", unitPrice: "۱۰۰۰", discount: "" },
  ];
  const totals = calculateInvoiceTotals({ items, taxPercent: "abc", meta: { date: "" } });
  assert.equal(totals.taxPercentError, true);
  assert.equal(totals.financialBlockingErrors.length, 1);
  assert.equal(totals.afterDiscountTotal, 1000n);
});

// ---------- PreInvoiceBuilder (DOM) ----------

test("a pre-invoice row is added and removed independently of the others", async () => {
  const user = userEvent.setup({ document });
  render(React.createElement(PreInvoiceBuilder));
  await settle();

  const rowCount = () => document.querySelectorAll("tbody tr").length;
  assert.equal(rowCount(), 7); // landscape default

  await user.click(screen.getByRole("button", { name: /افزودن ردیف\/قلم جدید/ }));
  assert.equal(rowCount(), 8);

  const deleteButtons = document.querySelectorAll(".row-delete");
  await user.click(deleteButtons[deleteButtons.length - 1]);
  assert.equal(rowCount(), 7);
});

test("a catalog row's product/dimensions deep link prefills the first item's description", async () => {
  window.history.replaceState(
    {},
    "",
    "/quote-process/?product=" + encodeURIComponent("میلگرد") + "&dimensions=" + encodeURIComponent("محصول 1") + "#quote-form",
  );
  render(React.createElement(PreInvoiceBuilder));
  await waitFor(() => {
    const description = screen.getByRole("textbox", { name: "ردیف ۱ — شرح کالا یا خدمت" });
    assert.equal(description.value, "میلگرد محصول 1");
  });
  window.history.replaceState({}, "", "/");
});

test("an invalid unit price blocks print instead of producing a mismatched document", async () => {
  const user = userEvent.setup({ document });
  let printed = false;
  window.print = () => {
    printed = true;
  };
  render(React.createElement(PreInvoiceBuilder));
  await settle();

  await user.type(
    screen.getByRole("textbox", { name: "ردیف ۱ — شرح کالا یا خدمت" }),
    "میلگرد آزمایشی",
  );
  await user.type(screen.getByRole("textbox", { name: "ردیف ۱ — تعداد یا مقدار" }), "1");
  await user.type(screen.getByRole("textbox", { name: "ردیف ۱ — مبلغ واحد" }), "abc");
  await user.type(screen.getByRole("textbox", { name: "نام خریدار" }), "خریدار آزمایشی");

  await user.click(screen.getByRole("button", { name: /چاپ \/ PDF/ }));
  await settle();

  assert.equal(printed, false, "print must never run while a financial error is outstanding");
  assert.match(
    screen.getByText(/ردیف ۱: مبلغ واحد معتبر نیست/).textContent,
    /معتبر نیست/,
  );
});
