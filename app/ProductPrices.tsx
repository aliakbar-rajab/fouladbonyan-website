import { PriceCatalog, type PriceCatalogConfig } from "./RebarPrices";
import type { CatalogPriceData, CatalogViewRequest } from "./catalog-types";
import { CatalogLoadMessage } from "./site-ui";
import { useCatalogData } from "./use-catalog-data";
import {
  loadProductPriceCatalog,
  loadProductPricePayload,
  type ProductCatalogId,
} from "./product-price-data";

const categoryIcons = ["◆", "◇", "◈", "▰", "▱", "⌁", "▦", "⬡"];

const loadProductView = async (catalogId: ProductCatalogId) => ({
  payload: await loadProductPricePayload(),
  catalog: await loadProductPriceCatalog(catalogId),
});

export default function ProductPrices({
  catalogId,
  phoneHref,
  requestedView,
}: {
  catalogId: ProductCatalogId;
  phoneHref: string;
  requestedView?: CatalogViewRequest;
}) {
  const state = useCatalogData(loadProductView, catalogId);

  if (state.status !== "ready") {
    return <CatalogLoadMessage status={state.status} subject="قیمت این گروه" />;
  }

  const { payload, catalog } = state.data;
  const priceData: CatalogPriceData = {
    fetchedAt: payload.fetchedAt,
    sourceName: payload.sourceName,
    sourceHome: payload.sourceHome,
    taxRate: payload.taxRate,
    categories: catalog.categories,
  };
  const config: PriceCatalogConfig = {
    productLabel: catalog.label,
    initialCategoryId: catalog.initialCategoryId,
    categoryIcons: Object.fromEntries(
      catalog.categories.map((category, index) => [
        category.id,
        categoryIcons[index % categoryIcons.length],
      ]),
    ),
    tabClassName: "product-kind-tabs",
  };

  return (
    <PriceCatalog
      priceData={priceData}
      config={config}
      phoneHref={phoneHref}
      requestedView={requestedView}
    />
  );
}
