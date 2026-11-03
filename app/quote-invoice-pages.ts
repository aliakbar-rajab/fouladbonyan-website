import { toPersianDigits } from "./persian-numbers.mjs";

/*
 * Lays the pre-invoice out on A4 the way the standalone پیش‌فاکتور app does
 * (its js/app.js, "Print document generation" through "Page fitting"): one
 * fully built sheet is the source, each printed page is a clone of it
 * carrying a run of its rows, and every page's vertical rhythm is solved
 * against the real page box by bisection. The constants and the order of
 * every decision below are the app's, so a document breaks across pages and
 * spends its spare height exactly where the app would put it.
 *
 * DOM in, DOM out: nothing here knows about React. QuoteDocument renders the
 * source sheet and hands its nodes over.
 */

const MM_TO_PX = 96 / 25.4;
/** The landscape sheet: 277x190mm inside the 10mm safe band of A4. */
export const SHEET_WIDTH_PX = 277 * MM_TO_PX;

const MAX_PRINT_ITEM_ROWS_PER_PAGE = 16;
const DENSITY_BISECTION_STEPS = 10;
const TYPE_SCALE_MIN = 0.9;
const TYPE_BISECTION_STEPS = 6;
const ROW_EXTRA_MAX_MM = 5;
const BLOCK_EXTRA_MAX_MM = 14;
const FIT_TOLERANCE_PX = 2;
const FIT_HEADROOM_PX = 1;
const FIT_MIN_SCALE = 0.82;
const FIT_STEP = 0.03;
const FIT_SLACK_PX = 1;

type Extra = { row: number; block: number };
type Rhythm = { density: number; extra: Extra; typeScale: number };

const NO_EXTRA: Extra = { row: 0, block: 0 };

export type InvoiceSources = {
  /** The complete first page with every row: the app's editor sheet. */
  sheet: HTMLElement;
  /** The header continuation pages carry instead of the full one. */
  continuationHead: HTMLElement;
  /** An empty box, laid out but unseen, that pages are measured in. */
  mount: HTMLElement;
  /** «شماره پیش‌فاکتور», for the "continued" marker. */
  number: string;
};

type PageOptions = {
  continuation?: boolean;
  finalPage?: boolean;
  startIndex?: number;
  pageNo?: number;
  totalPages?: number;
  density?: number;
};

function applySheetRhythm(
  el: HTMLElement,
  density: number,
  extra: Extra,
  typeScale: number,
) {
  el.style.setProperty("--print-density", density.toFixed(4));
  el.style.setProperty("--print-row-extra", `${extra.row.toFixed(3)}mm`);
  el.style.setProperty("--print-block-extra", `${extra.block.toFixed(3)}mm`);
  el.style.setProperty("--doc-font-scale", typeScale.toFixed(4));
}

function sourceRows(sources: InvoiceSources): HTMLTableRowElement[] {
  return Array.from(sources.sheet.querySelectorAll<HTMLTableRowElement>("tbody tr"));
}

function clonePage(
  sources: InvoiceSources,
  rows: HTMLTableRowElement[],
  options: PageOptions,
): HTMLElement {
  const clone = sources.sheet.cloneNode(true) as HTMLElement;
  clone.classList.add("print-page");
  if (options.density != null) {
    applySheetRhythm(clone, options.density, NO_EXTRA, 1);
  }

  const body = clone.querySelector("tbody");
  body?.replaceChildren(
    ...rows.map((row, index) => {
      const rowClone = row.cloneNode(true) as HTMLTableRowElement;
      const badge = rowClone.querySelector(".row-index-badge");
      if (badge) {
        badge.textContent = toPersianDigits((options.startIndex ?? 0) + index + 1);
      }
      return rowClone;
    }),
  );

  if (options.continuation) {
    const head = sources.continuationHead.cloneNode(true) as HTMLElement;
    const pageLabel = head.querySelector("[data-continuation-page]");
    if (pageLabel) {
      pageLabel.textContent = `صفحه ${toPersianDigits(options.pageNo ?? 1)} از ${toPersianDigits(options.totalPages ?? 1)}`;
    }
    clone.querySelector(".inv-head")?.replaceWith(head);
    clone.querySelector(".inv-parties")?.remove();
  }

  if (!options.finalPage) {
    for (const selector of [".inv-amount-words", ".inv-summary", ".inv-footer"]) {
      clone.querySelector(selector)?.remove();
    }
    const marker = document.createElement("div");
    marker.className = "print-page-marker";
    marker.textContent = `ادامه در صفحهٔ بعد · پیش‌فاکتور ${sources.number}`;
    clone.appendChild(marker);
  }

  if ((options.totalPages ?? 1) > 1 && !options.continuation) {
    const pageNumber = document.createElement("span");
    pageNumber.className = "print-page-number";
    pageNumber.textContent = `صفحه ${toPersianDigits(options.pageNo ?? 1)} از ${toPersianDigits(options.totalPages ?? 1)}`;
    clone.appendChild(pageNumber);
  }
  return clone;
}

/*
 * The most generous rhythm at which the page's content still fits targetPx,
 * applied and returned; null when it does not fit even at the tightest rhythm
 * and the smallest type. The page must be mounted.
 */
function fitSheetToPage(
  el: HTMLElement,
  rowCount: number,
  targetPx: number,
  stretchRows = true,
): Rhythm | null {
  const limit = targetPx - FIT_HEADROOM_PX;
  el.classList.add("is-measuring-natural");
  try {
    const measure = (density: number, typeScale: number) => {
      applySheetRhythm(el, density, NO_EXTRA, typeScale);
      return el.getBoundingClientRect().height;
    };

    let typeScale = 1;
    if (measure(0, 1) > limit) {
      if (measure(0, TYPE_SCALE_MIN) > limit) return null;
      let low = TYPE_SCALE_MIN;
      let high = 1;
      for (let step = 0; step < TYPE_BISECTION_STEPS; step += 1) {
        const middle = (low + high) / 2;
        if (measure(0, middle) <= limit) low = middle;
        else high = middle;
      }
      typeScale = low;
    }

    let density = 1;
    if (measure(1, typeScale) > limit) {
      let low = 0;
      let high = 1;
      for (let step = 0; step < DENSITY_BISECTION_STEPS; step += 1) {
        const middle = (low + high) / 2;
        if (measure(middle, typeScale) <= limit) low = middle;
        else high = middle;
      }
      density = low;
    }

    let extra = NO_EXTRA;
    if (density === 1) {
      const slackMm = (limit - measure(1, typeScale)) / MM_TO_PX;
      const row =
        stretchRows && rowCount > 0
          ? Math.max(0, Math.min(ROW_EXTRA_MAX_MM, slackMm / rowCount))
          : 0;
      const block = Math.max(
        0,
        Math.min(BLOCK_EXTRA_MAX_MM, slackMm - row * rowCount),
      );
      extra = { row, block };
      applySheetRhythm(el, density, extra, typeScale);
      if (el.getBoundingClientRect().height > limit) extra = NO_EXTRA;
    }

    applySheetRhythm(el, density, extra, typeScale);
    return { density, extra, typeScale };
  } finally {
    el.classList.remove("is-measuring-natural");
  }
}

function withMountedPage<T>(
  sources: InvoiceSources,
  page: HTMLElement,
  run: () => T,
): T {
  sources.mount.replaceChildren(page);
  try {
    return run();
  } finally {
    sources.mount.replaceChildren();
  }
}

function pageFits(sources: InvoiceSources, page: HTMLElement): boolean {
  return withMountedPage(
    sources,
    page,
    () => page.scrollHeight <= page.clientHeight + FIT_TOLERANCE_PX,
  );
}

/*
 * Large rial amounts must never clip or spill into the next column: shrink
 * the figure's own type, never its digits, down to 82%. The app's
 * fitNumericEl, run on each finished page while it is still mounted.
 */
function fitNumericEl(el: HTMLElement) {
  el.style.fontSize = "";
  el.classList.remove("numeric-overflow");
  const available = el.clientWidth + FIT_SLACK_PX;
  if (el.clientWidth === 0 || el.scrollWidth <= available) return;
  const basePx = parseFloat(window.getComputedStyle(el).fontSize);
  if (!basePx) return;
  let scale = 1;
  while (scale - FIT_STEP >= FIT_MIN_SCALE) {
    scale -= FIT_STEP;
    el.style.fontSize = `${(basePx * scale).toFixed(2)}px`;
    if (el.scrollWidth <= available) return;
  }
  el.classList.add("numeric-overflow");
}

function fitNumericFigures(page: HTMLElement) {
  page
    .querySelectorAll<HTMLElement>(
      ".cell-input-num, .cell-computed, .inv-totals strong, .inv-meta .inv-input",
    )
    .forEach(fitNumericEl);
}

function maxFittingRun(
  sources: InvoiceSources,
  rows: HTMLTableRowElement[],
  take: (rows: HTMLTableRowElement[], count: number) => HTMLTableRowElement[],
  options: PageOptions,
): number {
  let count = 0;
  const limit = Math.min(rows.length, MAX_PRINT_ITEM_ROWS_PER_PAGE);
  for (let index = 1; index <= limit; index += 1) {
    if (!pageFits(sources, clonePage(sources, take(rows, index), options))) break;
    count = index;
  }
  return count;
}

const takePrefix = (rows: HTMLTableRowElement[], count: number) =>
  rows.slice(0, count);
const takeSuffix = (rows: HTMLTableRowElement[], count: number) =>
  rows.slice(rows.length - count);

function solveSinglePage(
  sources: InvoiceSources,
  rows: HTMLTableRowElement[],
): boolean {
  const page = clonePage(sources, rows, { finalPage: true, pageNo: 1, totalPages: 1 });
  return withMountedPage(sources, page, () =>
    fitSheetToPage(page, rows.length, page.getBoundingClientRect().height) !== null,
  );
}

/** Which rows go on which page: the app's buildPrintPlan. */
function buildPrintPlan(
  sources: InvoiceSources,
  rows: HTMLTableRowElement[],
): HTMLTableRowElement[][] | null {
  if (rows.length <= MAX_PRINT_ITEM_ROWS_PER_PAGE && solveSinglePage(sources, rows)) {
    return [rows];
  }

  let finalCount = maxFittingRun(sources, rows, takeSuffix, {
    density: 0,
    continuation: true,
    finalPage: true,
    pageNo: 2,
    totalPages: 2,
  });
  if (rows.length && finalCount === 0) return null;

  // Fill complete 16-row sheets before moving the remainder to the final
  // page: 17 items print as 16 + 1, matching the form's capacity.
  const preferredFinalCount =
    ((rows.length - 1) % MAX_PRINT_ITEM_ROWS_PER_PAGE) + 1;
  if (preferredFinalCount <= finalCount) finalCount = preferredFinalCount;
  finalCount = Math.min(finalCount, Math.max(1, rows.length - 1));

  let remaining = rows.slice(0, rows.length - finalCount);
  const finalRows = rows.slice(rows.length - finalCount);
  const chunks: HTMLTableRowElement[][] = [];
  let startIndex = 0;

  while (remaining.length) {
    const capacity = maxFittingRun(sources, remaining, takePrefix, {
      density: 0,
      continuation: chunks.length > 0,
      finalPage: false,
      startIndex,
      pageNo: chunks.length + 1,
      totalPages: 2,
    });
    if (capacity === 0) return null;
    const chunk = remaining.slice(0, capacity);
    chunks.push(chunk);
    remaining = remaining.slice(capacity);
    startIndex += chunk.length;
  }
  chunks.push(finalRows);
  return chunks;
}

/**
 * Builds the printed pages, each solved against its own A4 box and wrapped in
 * the slot that centres it on the paper. Returns null when a page cannot be
 * made to fit, which the caller answers with the unsolved sheet.
 */
export function buildInvoicePages(sources: InvoiceSources): HTMLElement[] | null {
  const chunks = buildPrintPlan(sources, sourceRows(sources));
  if (!chunks) return null;

  const pages: HTMLElement[] = [];
  let startIndex = 0;
  for (const [index, chunk] of chunks.entries()) {
    const page = clonePage(sources, chunk, {
      continuation: index > 0,
      finalPage: index === chunks.length - 1,
      startIndex,
      pageNo: index + 1,
      totalPages: chunks.length,
    });
    startIndex += chunk.length;
    const fitted = withMountedPage(sources, page, () => {
      const rhythm = fitSheetToPage(
        page,
        chunk.length,
        page.getBoundingClientRect().height,
        chunks.length === 1,
      );
      if (rhythm) fitNumericFigures(page);
      return rhythm;
    });
    if (!fitted) return null;
    pages.push(page);
  }

  return pages.map((page) => {
    const slot = document.createElement("div");
    slot.className = "inv-print-slot";
    slot.appendChild(page);
    return slot;
  });
}

/*
 * Printing, the app's way: one unnamed @page rule for landscape A4 with the
 * 10mm safe band, and the sheets printed from a container that is a direct
 * child of <body> while everything else leaves the flow (its print-mode).
 *
 * Both halves matter. A named @page scoped to the sheets is ignored by Chrome
 * once they sit in a body-level container, and printing them in place, inside
 * the site's nested page shell, always ran onto a blank trailing page. So the
 * page rule exists only while a pre-invoice does -- as a constructed sheet,
 * because the CSP refuses inline <style> -- and the sheets move out to the
 * print container for exactly as long as the browser is printing.
 */
const PAGE_RULE = "@page { size: 297mm 210mm; margin: 10mm; }";

export function preparePrinting(pages: HTMLElement): () => void {
  let pageSheet: CSSStyleSheet | null = null;
  try {
    pageSheet = new CSSStyleSheet();
    pageSheet.replaceSync(PAGE_RULE);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, pageSheet];
  } catch {
    pageSheet = null;
  }

  let printDocument: HTMLElement | null = null;
  const beforePrint = () => {
    if (printDocument) return;
    printDocument = document.createElement("div");
    printDocument.className = "inv-print-document";
    printDocument.append(...Array.from(pages.children));
    document.body.append(printDocument);
    document.body.classList.add("inv-printing");
  };
  const afterPrint = () => {
    if (!printDocument) return;
    pages.append(...Array.from(printDocument.children));
    printDocument.remove();
    printDocument = null;
    document.body.classList.remove("inv-printing");
  };

  window.addEventListener("beforeprint", beforePrint);
  window.addEventListener("afterprint", afterPrint);
  return () => {
    window.removeEventListener("beforeprint", beforePrint);
    window.removeEventListener("afterprint", afterPrint);
    afterPrint();
    if (pageSheet) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (sheet) => sheet !== pageSheet,
      );
    }
  };
}

/** The unsolved fallback: the whole document as one tightest-rhythm sheet. */
export function buildFallbackPage(sources: InvoiceSources): HTMLElement {
  const page = sources.sheet.cloneNode(true) as HTMLElement;
  applySheetRhythm(page, 0, NO_EXTRA, TYPE_SCALE_MIN);
  const slot = document.createElement("div");
  slot.className = "inv-print-slot";
  slot.appendChild(page);
  return slot;
}
