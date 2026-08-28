import type { ProductGroupId } from "./category-meta";

const PRODUCT_TABS = "product-kind-tabs";

const presentation: Record<ProductGroupId, { tabClassName?: string }> = {
  rebar: {},
  beam: { tabClassName: "beam-kind-tabs" },
  sheet: { tabClassName: PRODUCT_TABS },
  profile: { tabClassName: PRODUCT_TABS },
  pipe: { tabClassName: PRODUCT_TABS },
  angle: { tabClassName: PRODUCT_TABS },
  channel: { tabClassName: PRODUCT_TABS },
  wire: { tabClassName: PRODUCT_TABS },
};

export type CatalogPresentation = {
  tabClassName?: string;
};

export function catalogPresentation(groupId: ProductGroupId): CatalogPresentation {
  return presentation[groupId];
}
