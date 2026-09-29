import type { ProductGroupId } from "../category-meta";

/**
 * The Quote product: one entry per product a quote request line can name, and
 * everything the site knows about it -- which catalog category prices it, which
 * catalog rows a visitor may pick by the piece, how a branch count becomes
 * kilograms, and so whether it takes piece units at all.
 *
 * This used to be three hand-kept tables in three files: the product names and
 * a weight-only set in quote-types.ts, the product -> category map in
 * pricing-source.ts, and a catalog group -> product-name `string` map in
 * FactoryPriceCardList.tsx, which told هاش apart from تیرآهن by searching the
 * category's Persian label. Nothing linked the three, so a price row could hand
 * the quote form a product name the form silently discarded. Both directions
 * now read this one table: product -> catalog for a Price estimate, and
 * catalog category -> product for a price row's "افزودن به درخواست".
 */

/** How a branch count converts to kilograms; see quote/calculation.ts. */
export type BranchWeightFormula = "rebar-12m";

type QuoteProductCatalog = {
  group: ProductGroupId;
  /** The category whose credible per-kg rows price the estimate; defaults to the group's initial category. */
  categoryId?: string;
  /** Real rows a visitor may pick by name and price by the piece. */
  pieceSources?: readonly { categoryId: string; unit: string }[];
  branchWeight?: BranchWeightFormula;
};

type QuoteProductDefinition = {
  name: string;
  /** Absent for a product the catalog does not price. */
  catalog?: QuoteProductCatalog;
};

const quoteProducts = [
  {
    name: "میلگرد",
    catalog: { group: "rebar", categoryId: "ribbed", branchWeight: "rebar-12m" },
  },
  {
    name: "تیرآهن",
    catalog: {
      group: "beam",
      categoryId: "beam",
      pieceSources: [{ categoryId: "beam", unit: "شاخه" }],
    },
  },
  { name: "هاش", catalog: { group: "beam", categoryId: "hash" } },
  { name: "ورق فولادی", catalog: { group: "sheet" } },
  { name: "پروفیل و قوطی", catalog: { group: "profile" } },
  {
    name: "لوله فولادی",
    catalog: {
      group: "pipe",
      pieceSources: [
        { categoryId: "api-pipe", unit: "شاخه" },
        { categoryId: "gas-pipe", unit: "شاخه" },
        { categoryId: "seamless-pipe", unit: "شاخه" },
      ],
    },
  },
  { name: "نبشی", catalog: { group: "angle" } },
  { name: "ناودانی", catalog: { group: "channel" } },
  {
    name: "مفتول و سیم",
    catalog: {
      group: "wire",
      pieceSources: [
        { categoryId: "rib-lath", unit: "برگ" },
        { categoryId: "chicken-mesh", unit: "طاقه‌ای" },
        { categoryId: "chain-link-mesh", unit: "مترمربع" },
      ],
    },
  },
  { name: "سایر محصولات فولادی" },
] as const satisfies readonly QuoteProductDefinition[];

export type QuoteProductName = (typeof quoteProducts)[number]["name"];

/** Every product, in the order the quote form lists them. */
export const quoteProductNames: readonly QuoteProductName[] = quoteProducts.map(
  (product) => product.name,
);

export function isQuoteProduct(value: unknown): value is QuoteProductName {
  return (
    typeof value === "string" &&
    (quoteProductNames as readonly string[]).includes(value)
  );
}

/** The table seen through its row shape rather than its literal types. */
const definitions: readonly (QuoteProductDefinition & {
  name: QuoteProductName;
})[] = quoteProducts;

function definitionOf(product: QuoteProductName): QuoteProductDefinition {
  return definitions.find((entry) => entry.name === product)!;
}

/** The catalog pricing behind a product, or undefined when the catalog does not price it. */
export function quoteProductCatalog(
  product: QuoteProductName,
): QuoteProductCatalog | undefined {
  return definitionOf(product).catalog;
}

/**
 * Whether a line for this product may be counted in شاخه/عدد rather than by
 * weight. It follows from the catalog entry, not from which prices happened to
 * load: a product takes piece units when it has real rows to price a piece
 * from, a branch-weight formula to turn branches into kilograms, or no catalog
 * pricing at all (sales then prices whatever unit the visitor names). An empty
 * product has not been chosen yet, so nothing is ruled out.
 */
export function quoteProductSupportsPieceUnits(
  product: QuoteProductName | "",
): boolean {
  if (!product) return true;
  const catalog = quoteProductCatalog(product);
  return (
    !catalog || Boolean(catalog.pieceSources?.length || catalog.branchWeight)
  );
}

/**
 * The product a price row in this catalog category hands to the quote form: a
 * product priced from exactly this category if there is one (beam/hash ->
 * هاش), otherwise the group's first product (rebar/simple -> میلگرد).
 */
export function quoteProductForCategory(
  groupId: ProductGroupId,
  categoryId: string,
): QuoteProductName | undefined {
  const inGroup = definitions.filter(
    (entry) => entry.catalog?.group === groupId,
  );
  return (
    inGroup.find((entry) => entry.catalog?.categoryId === categoryId) ??
    inGroup[0]
  )?.name;
}
