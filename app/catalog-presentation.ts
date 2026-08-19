import type { ProductGroupId } from "./category-meta";
import type { CatalogCategory } from "./catalog-types";

/**
 * How each product group's catalog is dressed: the glyph on each category tab
 * and the tablist's own class. Groups whose categories are source-defined get
 * icons from a cycle, because their category list is not fixed here.
 *
 * The record is exhaustive on purpose -- a new product group fails to compile
 * until it says how its tabs look.
 */
const productIconCycle = ["◆", "◇", "◈", "▰", "▱", "⌁", "▦", "⬡"];

const PRODUCT_TABS = "product-kind-tabs";

const presentation: Record<
  ProductGroupId,
  { icons?: Record<string, string>; tabClassName?: string }
> = {
  rebar: {
    icons: { ribbed: "╱╱", simple: "━", stainless: "◈", alloy: "◆" },
  },
  beam: {
    icons: { beam: "I", hash: "H" },
    tabClassName: "beam-kind-tabs",
  },
  sheet: { tabClassName: PRODUCT_TABS },
  profile: { tabClassName: PRODUCT_TABS },
  pipe: { tabClassName: PRODUCT_TABS },
  angle: { tabClassName: PRODUCT_TABS },
  channel: { tabClassName: PRODUCT_TABS },
  wire: { tabClassName: PRODUCT_TABS },
};

export type CatalogPresentation = {
  categoryIcons: Record<string, string>;
  tabClassName?: string;
};

export function catalogPresentation(
  groupId: ProductGroupId,
  categories: CatalogCategory[],
): CatalogPresentation {
  const { icons, tabClassName } = presentation[groupId];

  return {
    tabClassName,
    categoryIcons:
      icons ??
      Object.fromEntries(
        categories.map((category, index) => [
          category.id,
          productIconCycle[index % productIconCycle.length],
        ]),
      ),
  };
}
