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

const loadProductView = async (catalogId: ProductCatalogId) => {
  const cachedPayload = loadProductPricePayload.getCached();
  if (cachedPayload) {
    const catalog = cachedPayload.catalogs.find((item) => item.id === catalogId);
    if (catalog) return { payload: cachedPayload, catalog };
  }
  return {
    payload: await loadProductPricePayload(),
    catalog: await loadProductPriceCatalog(catalogId),
  };
};

loadProductView.getCached = (catalogId?: ProductCatalogId) => {
  if (!catalogId) return undefined;
  const payload = loadProductPricePayload.getCached();
  if (!payload) return undefined;
  const catalog = payload.catalogs.find((item) => item.id === catalogId);
  if (!catalog) return undefined;
  return { payload, catalog };
};


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
    groupId: catalogId,
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
