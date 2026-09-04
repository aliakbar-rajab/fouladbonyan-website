/**
 * Carries one price row's product and dimensions from a catalog page to the
 * quote form on /quote-process/.
 *
 * This used to ride in the URL, as
 * `/quote-process/?product=...&dimensions=...#quote-form`. That put one
 * crawlable URL on every price row -- 1,720 distinct variants of a single page
 * across the site, and 86% of the outgoing links on /profile/box-profile/ --
 * all canonicalising back to /quote-process/. The payload is form state, not a
 * destination, so it travels in sessionStorage instead and the link becomes the
 * one clean /quote-process/#quote-form URL.
 *
 * sessionStorage rather than localStorage: the handoff is meant to survive
 * exactly one navigation, and a stale prefill resurfacing in a new tab a week
 * later would be worse than no prefill at all. Storage is drained by the first
 * read of a page load; see pageLoadHandoff for why the value itself is then
 * held for the rest of that load.
 */
export const QUOTE_HANDOFF_KEY = "bonyan-foulad-daria-quote-handoff-v1";

/** Where a price row's quote action navigates to. No query string. */
export const QUOTE_FORM_HREF = "/quote-process/#quote-form";

export type QuoteHandoff = {
  product: string;
  dimensions: string;
};

/**
 * Store a prefill for the next page load. Failures are swallowed: private
 * browsing modes and storage-blocked contexts throw on setItem, and the quote
 * form works perfectly well with an empty first row.
 */
export function writeQuoteHandoff(handoff: QuoteHandoff): void {
  try {
    window.sessionStorage.setItem(QUOTE_HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // Storage unavailable. Navigation still happens; the form starts empty.
  }
}

/** One read, then gone -- including when storage itself is unavailable. */
function readAndClear(): string | null {
  try {
    const value = window.sessionStorage.getItem(QUOTE_HANDOFF_KEY);
    window.sessionStorage.removeItem(QUOTE_HANDOFF_KEY);
    return value;
  } catch {
    return null;
  }
}

/*
 * The parsed handoff for this page load, `undefined` until the first read.
 *
 * The read has to be stable for the life of the document, the way reading
 * location.search was. It is not enough to clear storage and return the value
 * once: React StrictMode invokes an effect, tears it down and invokes it again,
 * so the first call drained storage, the teardown cancelled the frame that
 * would have applied the prefill, and the second call found nothing -- the
 * field arrived empty. Any remount would have done the same. Storage is still
 * cleared on the first read, so a genuine reload starts clean; only repeat
 * calls within this one page load see the cached value.
 */
let pageLoadHandoff: QuoteHandoff | null | undefined;

/**
 * Read the pending prefill. Returns null when there is none, when storage is
 * unavailable, or when the stored value is not the shape written above -- a
 * hand-edited or half-written entry must not reach the form.
 */
export function takeQuoteHandoff(): QuoteHandoff | null {
  if (pageLoadHandoff !== undefined) return pageLoadHandoff;
  pageLoadHandoff = parseHandoff(readAndClear());
  return pageLoadHandoff;
}

function parseHandoff(raw: string | null): QuoteHandoff | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const { product, dimensions } = parsed as Record<string, unknown>;
    if (typeof product !== "string" || typeof dimensions !== "string") {
      return null;
    }
    return { product, dimensions };
  } catch {
    return null;
  }
}

/**
 * Drop the cached read so the next call goes back to storage. A document only
 * loads once, so nothing in the app needs this -- it exists for tests, which
 * exercise several "page loads" inside one module registry.
 */
export function resetQuoteHandoffCache(): void {
  pageLoadHandoff = undefined;
}
