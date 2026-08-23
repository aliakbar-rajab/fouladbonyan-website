import {
  branchLengthLabel,
  buildQuoteDocument,
  buildQuoteMessage as engineBuildQuoteMessage,
  deriveQuoteItemPricing,
  formatPersianNumber,
  formatToman,
  normalizeQuoteContact,
  persianToday,
  REBAR_STANDARD_BRANCH_LENGTH_M,
  RIAL_PER_TOMAN,
  tomanToRial,
} from "./quote-engine";
import type {
  DerivedQuoteItem,
  GeneratedQuote,
  PricedQuoteItem,
  QuoteContact,
  QuoteTotals,
} from "./quote-types";

export {
  formatToman,
  formatPersianNumber,
  persianToday,
  branchLengthLabel,
  REBAR_STANDARD_BRANCH_LENGTH_M,
  RIAL_PER_TOMAN,
  tomanToRial,
};

export function buildQuoteMessage(
  contact: QuoteContact,
  items: (PricedQuoteItem | DerivedQuoteItem)[],
): string {
  const normalizedContact = normalizeQuoteContact(contact);
  const derivedItems: DerivedQuoteItem[] = items.map((priced) => {
    if ("approximateTotalToman" in priced) {
      return priced as DerivedQuoteItem;
    }
    return deriveQuoteItemPricing(
      priced.item,
      priced.estimate ? { [priced.estimate.product]: priced.estimate } : {},
    );
  });

  const totals: QuoteTotals = {
    totalToman: derivedItems.reduce(
      (sum, item) => sum + (item.approximateTotalToman ?? 0),
      0,
    ),
    totalRial: derivedItems.reduce(
      (sum, item) => sum + (item.approximateTotalRial ?? 0),
      0,
    ),
    pricedItemCount: derivedItems.filter(
      (item) => item.approximateTotalToman !== null,
    ).length,
    totalItemCount: derivedItems.length,
    hasAnyPriced: derivedItems.some(
      (item) => item.approximateTotalToman !== null,
    ),
  };

  return engineBuildQuoteMessage(normalizedContact, derivedItems, totals);
}

export function buildGeneratedQuote(
  contact: QuoteContact,
  items: (PricedQuoteItem | DerivedQuoteItem)[],
): GeneratedQuote {
  const normalizedContact = normalizeQuoteContact(contact);
  const derivedItems: DerivedQuoteItem[] = items.map((priced) => {
    if ("approximateTotalToman" in priced) {
      return priced as DerivedQuoteItem;
    }
    return deriveQuoteItemPricing(
      priced.item,
      priced.estimate ? { [priced.estimate.product]: priced.estimate } : {},
    );
  });

  const totalRial = derivedItems.reduce(
    (sum, item) => sum + (item.approximateTotalRial ?? 0),
    0,
  );

  return buildQuoteDocument(normalizedContact, derivedItems, {
    totalToman: 0,
    totalRial,
    pricedItemCount: 0,
    totalItemCount: derivedItems.length,
    hasAnyPriced: true,
  });
}

