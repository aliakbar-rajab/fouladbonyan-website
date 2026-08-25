/*
 * A4 print/PDF pagination engine for the pre-invoice builder, ported from the
 * standalone پیش‌فاکتور app's print pipeline (js/app.js: clonePrintPage,
 * buildPrintPlan, verifyPrintPlanFits, renderPrintPlan, printInvoice).
 *
 * Deliberately DOM-imperative rather than React state-driven: it clones the
 * live, already-rendered invoice sheet and measures the clone's real layout
 * (scrollHeight vs clientHeight) to decide whether the document fits one A4
 * page, needs a smaller "compact" layout, or must split into continuation
 * pages — none of which React's virtual DOM can answer, since it requires an
 * actual browser layout pass. This mirrors exactly how the original worked,
 * just parameterized instead of reaching for global DOM ids.
 */
import { toPersianDigits } from "./site-logic.mjs";

export type InvoiceOrientation = "landscape" | "portrait";

export type PrintContext = {
  sheetEl: HTMLElement;
  printDocumentEl: HTMLElement;
  companyName: string;
  companyLogoSrc: string;
  stampRequested: boolean;
};

function copyLiveValues(source: Element, clone: Element) {
  const sourceFields = source.querySelectorAll("input, textarea, select");
  const cloneFields = clone.querySelectorAll("input, textarea, select");
  sourceFields.forEach((field, index) => {
    const target = cloneFields[index];
    if (!target) return;
    if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
      (target as HTMLInputElement).checked = field.checked;
    } else {
      (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value =
        (field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
    }
  });
}

function replaceFormControlsWithText(root: Element) {
  Array.from(root.querySelectorAll("input, textarea, select")).forEach((field) => {
    const replacement = document.createElement(field.tagName === "TEXTAREA" ? "div" : "span");
    replacement.className = field.className + " print-field-value";
    replacement.classList.remove("no-screen");
    if (field instanceof HTMLSelectElement) {
      replacement.textContent = field.options[field.selectedIndex]?.text ?? "";
    } else {
      replacement.textContent = (field as HTMLInputElement | HTMLTextAreaElement).value || "";
    }
    Array.from(field.attributes).forEach((attr) => {
      if (attr.name.indexOf("data-") === 0) replacement.setAttribute(attr.name, attr.value);
    });
    field.replaceWith(replacement);
  });
  root.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
}

function makeContinuationHeader(ctx: PrintContext, pageNo: number, totalPages: number): HTMLElement {
  const number = ctx.sheetEl.querySelector<HTMLInputElement>('[data-field="meta.number"]')?.value ?? "";
  const date = ctx.sheetEl.querySelector<HTMLInputElement>('[data-field="meta.date"]')?.value ?? "";
  const header = document.createElement("header");
  header.className = "print-continuation-head";
  header.innerHTML =
    '<div class="print-continuation-brand"><img alt="" /><strong></strong></div>' +
    '<div class="print-continuation-title">ادامهٔ پیش‌فاکتور</div>' +
    '<div class="print-continuation-meta"><div></div><div></div></div>';
  const continuationLogo = header.querySelector("img")!;
  if (ctx.companyLogoSrc) continuationLogo.src = ctx.companyLogoSrc;
  else continuationLogo.remove();
  header.querySelector("strong")!.textContent = ctx.companyName;
  const titleField = ctx.sheetEl.querySelector<HTMLInputElement>('[data-field="meta.title"]');
  const documentTitle = titleField?.value?.trim() || "پیش‌فاکتور";
  header.querySelector(".print-continuation-title")!.textContent = "ادامهٔ " + documentTitle;
  const meta = header.querySelectorAll(".print-continuation-meta div");
  meta[0].textContent = "شماره: " + number;
  meta[1].textContent = "تاریخ: " + date + " · صفحه " + toPersianDigits(pageNo) + " از " + toPersianDigits(totalPages);
  return header;
}

type CloneOptions = {
  orientation: InvoiceOrientation;
  compact?: boolean;
  continuation?: boolean;
  finalPage?: boolean;
  startIndex?: number;
  pageNo?: number;
  totalPages?: number;
  blankNotes?: boolean;
};

function clonePrintPage(ctx: PrintContext, rowSources: Element[], options: CloneOptions): HTMLElement {
  const clone = ctx.sheetEl.cloneNode(true) as HTMLElement;
  copyLiveValues(ctx.sheetEl, clone);
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  clone.classList.add("print-page");
  clone.classList.toggle("layout-compact", !!options.compact);
  clone.classList.remove("orientation-landscape", "orientation-portrait");
  clone.classList.add("orientation-" + options.orientation);

  if (options.blankNotes) {
    const clonedNotes = clone.querySelector<HTMLTextAreaElement>('[data-field="notes"]');
    if (clonedNotes) {
      clonedNotes.value = "";
      clonedNotes.style.height = "";
    }
  }

  const cloneBody = clone.querySelector("tbody")!;
  cloneBody.innerHTML = "";
  rowSources.forEach((sourceRow, index) => {
    const rowClone = sourceRow.cloneNode(true) as HTMLElement;
    copyLiveValues(sourceRow, rowClone);
    rowClone.classList.remove("is-blank-row", "has-financial-error");
    const badge = rowClone.querySelector(".row-index-badge");
    if (badge) badge.textContent = toPersianDigits((options.startIndex || 0) + index + 1);
    cloneBody.appendChild(rowClone);
  });

  const validation = clone.querySelector(".invoice-validation");
  validation?.remove();

  if (options.continuation) {
    const fullHead = clone.querySelector(".inv-head");
    const parties = clone.querySelector(".inv-parties");
    const continuation = makeContinuationHeader(ctx, options.pageNo || 1, options.totalPages || 1);
    fullHead?.replaceWith(continuation);
    parties?.remove();
  }

  if (!options.finalPage) {
    [".inv-amount-words", ".inv-summary", ".inv-footer"].forEach((selector) => {
      clone.querySelector(selector)?.remove();
    });
    const marker = document.createElement("div");
    marker.className = "print-page-marker";
    const number = ctx.sheetEl.querySelector<HTMLInputElement>('[data-field="meta.number"]')?.value ?? "";
    marker.textContent = "ادامه در صفحهٔ بعد · پیش‌فاکتور " + number;
    clone.appendChild(marker);
  }

  replaceFormControlsWithText(clone);
  clone.querySelectorAll(".has-error").forEach((el) => {
    el.classList.remove("has-error");
    el.removeAttribute("data-error");
  });
  if (!ctx.stampRequested) {
    clone.querySelector(".inv-signature-stamp")?.remove();
    clone.classList.remove("stamp-enabled");
  }

  if ((options.totalPages || 1) > 1) {
    const pageNumber = document.createElement("span");
    pageNumber.className = "print-page-number";
    pageNumber.textContent = "صفحه " + toPersianDigits(options.pageNo || 1) + " از " + toPersianDigits(options.totalPages || 1);
    clone.appendChild(pageNumber);
  }
  return clone;
}

function pageFits(ctx: PrintContext, page: HTMLElement): boolean {
  ctx.printDocumentEl.innerHTML = "";
  ctx.printDocumentEl.classList.add("is-measuring");
  ctx.printDocumentEl.appendChild(page);
  void page.offsetHeight;
  const fits = page.scrollHeight <= page.clientHeight + 2;
  ctx.printDocumentEl.innerHTML = "";
  ctx.printDocumentEl.classList.remove("is-measuring");
  return fits;
}

function singlePageFits(ctx: PrintContext, rows: Element[], orientation: InvoiceOrientation, compact: boolean): boolean {
  return pageFits(ctx, clonePrintPage(ctx, rows, { orientation, compact, finalPage: true, pageNo: 1, totalPages: 1 }));
}

function maxFittingPrefix(ctx: PrintContext, rows: Element[], options: CloneOptions): number {
  let count = 0;
  for (let i = 1; i <= rows.length; i += 1) {
    const candidate = clonePrintPage(ctx, rows.slice(0, i), options);
    if (!pageFits(ctx, candidate)) break;
    count = i;
  }
  return count;
}

function maxFittingSuffix(ctx: PrintContext, rows: Element[], options: CloneOptions): number {
  let count = 0;
  for (let i = 1; i <= rows.length; i += 1) {
    const candidate = clonePrintPage(ctx, rows.slice(rows.length - i), options);
    if (!pageFits(ctx, candidate)) break;
    count = i;
  }
  return count;
}

/**
 * Why the closing block (notes + amount-in-words + totals + signatures +
 * footer) could not be fitted onto a final page — "notes" if emptying the
 * notes textarea alone would fix it, "closing-block" otherwise.
 */
function diagnoseFinalPageOverflow(
  ctx: PrintContext,
  rows: Element[],
  orientation: InvoiceOrientation,
  compact: boolean,
): "notes" | "closing-block" {
  const notesEl = ctx.sheetEl.querySelector<HTMLTextAreaElement>('[data-field="notes"]');
  if (!notesEl || !notesEl.value.trim()) return "closing-block";
  const withoutNotes = clonePrintPage(ctx, rows.length ? [rows[rows.length - 1]] : [], {
    orientation,
    compact,
    continuation: true,
    finalPage: true,
    pageNo: 2,
    totalPages: 2,
    blankNotes: true,
  });
  return pageFits(ctx, withoutNotes) ? "notes" : "closing-block";
}

export type PrintPlan = {
  compact: boolean;
  chunks: Element[][];
  orientation: InvoiceOrientation;
  overflowKind?: "row" | "final-page";
  overflowRowIndex?: number;
};

function buildPrintPlan(ctx: PrintContext, rows: Element[], orientation: InvoiceOrientation): PrintPlan {
  if (singlePageFits(ctx, rows, orientation, false)) return { compact: false, chunks: [rows], orientation };
  if (singlePageFits(ctx, rows, orientation, true)) return { compact: true, chunks: [rows], orientation };

  const compact = true;
  let finalCount = maxFittingSuffix(ctx, rows, {
    orientation,
    compact,
    continuation: true,
    finalPage: true,
    pageNo: 2,
    totalPages: 2,
  });
  if (rows.length && finalCount === 0) {
    return { compact, chunks: [], orientation, overflowKind: "final-page" };
  }
  const firstCapacity = maxFittingPrefix(ctx, rows, {
    orientation,
    compact,
    continuation: false,
    finalPage: false,
    pageNo: 1,
    totalPages: 2,
  });
  const balancedFinal = Math.min(finalCount, Math.ceil(rows.length / 2));
  if (rows.length - balancedFinal <= firstCapacity) finalCount = balancedFinal;
  finalCount = Math.min(finalCount, Math.max(1, rows.length - 1));
  let remaining = rows.slice(0, rows.length - finalCount);
  const finalRows = rows.slice(rows.length - finalCount);
  const chunks: Element[][] = [];
  let first = true;
  let startIndex = 0;

  while (remaining.length) {
    const capacity = maxFittingPrefix(ctx, remaining, {
      orientation,
      compact,
      continuation: !first,
      finalPage: false,
      startIndex,
      pageNo: chunks.length + 1,
      totalPages: 2,
    });
    if (capacity === 0) {
      return { compact, chunks: [], orientation, overflowRowIndex: startIndex, overflowKind: "row" };
    }
    const chunk = remaining.slice(0, capacity);
    chunks.push(chunk);
    remaining = remaining.slice(capacity);
    startIndex += chunk.length;
    first = false;
  }
  chunks.push(finalRows);
  return { compact, chunks, orientation };
}

function verifyPrintPlanFits(ctx: PrintContext, plan: PrintPlan): { fits: boolean; pageNo: number | null } {
  const totalPages = plan.chunks.length;
  let startIndex = 0;
  for (let index = 0; index < totalPages; index += 1) {
    const chunk = plan.chunks[index];
    const page = clonePrintPage(ctx, chunk, {
      orientation: plan.orientation,
      compact: plan.compact,
      continuation: index > 0,
      finalPage: index === totalPages - 1,
      startIndex,
      pageNo: index + 1,
      totalPages,
    });
    startIndex += chunk.length;
    if (!pageFits(ctx, page)) return { fits: false, pageNo: index + 1 };
  }
  return { fits: true, pageNo: null };
}

function renderPrintPlan(ctx: PrintContext, plan: PrintPlan): number {
  ctx.printDocumentEl.innerHTML = "";
  const totalPages = plan.chunks.length;
  let startIndex = 0;
  plan.chunks.forEach((chunk, index) => {
    const page = clonePrintPage(ctx, chunk, {
      orientation: plan.orientation,
      compact: plan.compact,
      continuation: index > 0,
      finalPage: index === totalPages - 1,
      startIndex,
      pageNo: index + 1,
      totalPages,
    });
    startIndex += chunk.length;
    ctx.printDocumentEl.appendChild(page);
  });
  document.body.classList.add("preinv-print-mode");
  ctx.printDocumentEl.setAttribute("aria-hidden", "false");
  return totalPages;
}

export function cleanupPrintDocument(ctx: PrintContext) {
  document.body.classList.remove("preinv-print-mode");
  ctx.printDocumentEl.classList.remove("is-measuring");
  ctx.printDocumentEl.innerHTML = "";
  ctx.printDocumentEl.setAttribute("aria-hidden", "true");
}

export type PrintResult =
  | { ok: true; pageCount: number; extraWarnings: string[] }
  | { ok: false; statusMessage: string; extraWarnings: string[] };

/**
 * Builds and measures the print plan, and — if it fits — renders it into
 * ctx.printDocumentEl ready for window.print(). Does not call window.print()
 * itself or commit the invoice number; the caller does that once it also
 * knows the document is otherwise valid (buyer name, date, etc).
 */
export function preparePrintPlan(
  ctx: PrintContext,
  rows: Element[],
  orientation: InvoiceOrientation,
): PrintResult {
  const extraWarnings: string[] = [];
  const plan = buildPrintPlan(ctx, rows, orientation);

  if (plan.overflowKind) {
    if (plan.overflowKind === "row") {
      extraWarnings.push(
        "ردیف " + toPersianDigits((plan.overflowRowIndex ?? 0) + 1) +
        " بلندتر از ظرفیت یک صفحهٔ A4 است؛ برای جلوگیری از حذف محتوا، چاپ متوقف شد. شرح را کوتاه‌تر یا به چند ردیف تقسیم کنید",
      );
      return { ok: false, statusMessage: "چاپ انجام نشد؛ یک ردیف در صفحهٔ A4 جا نمی‌شود.", extraWarnings };
    }
    const diagnosis = diagnoseFinalPageOverflow(ctx, rows, plan.orientation, plan.compact);
    if (diagnosis === "notes") {
      extraWarnings.push(
        "متن «توضیحات» بلندتر از فضای باقی‌ماندهٔ صفحهٔ پایانی است؛ برای جلوگیری از حذف محتوا، چاپ متوقف شد. متن توضیحات را کوتاه‌تر کنید",
      );
      return { ok: false, statusMessage: "چاپ انجام نشد؛ متن توضیحات در صفحهٔ A4 جا نمی‌شود.", extraWarnings };
    }
    extraWarnings.push(
      "بخش پایانی سند (توضیحات، مبلغ به حروف، جمع‌کل، امضاها و فوتر) در یک صفحهٔ A4 جا نمی‌شود؛ برای جلوگیری از حذف محتوا، چاپ متوقف شد. متن توضیحات را کوتاه‌تر کنید یا جهت صفحه را تغییر دهید",
    );
    return { ok: false, statusMessage: "چاپ انجام نشد؛ بخش پایانی سند در صفحهٔ A4 جا نمی‌شود.", extraWarnings };
  }

  const fitVerification = verifyPrintPlanFits(ctx, plan);
  if (!fitVerification.fits) {
    extraWarnings.push(
      "صفحهٔ " + toPersianDigits(fitVerification.pageNo ?? 1) +
      " در محدودهٔ A4 جا نمی‌شود؛ برای جلوگیری از حذف محتوا، چاپ متوقف شد",
    );
    return { ok: false, statusMessage: "چاپ انجام نشد؛ چیدمان نهایی از محدودهٔ A4 بیرون می‌زند.", extraWarnings };
  }

  if (plan.chunks.length > 1) {
    extraWarnings.push("این پیش‌فاکتور در " + toPersianDigits(plan.chunks.length) + " صفحه چاپ می‌شود");
  }

  const pageCount = renderPrintPlan(ctx, plan);
  return { ok: true, pageCount, extraWarnings };
}
