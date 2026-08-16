import { loadBeamPriceData } from "./catalog-data";
import { CatalogLoadMessage } from "./site-ui";
import { useCatalogData } from "./use-catalog-data";
import { PriceCatalog, type PriceCatalogConfig } from "./RebarPrices";
import type { CatalogViewRequest } from "./catalog-types";

const beamConfig: PriceCatalogConfig = {
  productLabel: "تیرآهن",
  initialCategoryId: "beam",
  categoryIcons: {
    beam: "I",
    hash: "H",
  },
  tabClassName: "beam-kind-tabs",
};

export default function BeamPrices({
  phoneHref,
  requestedView,
}: {
  phoneHref: string;
  requestedView?: CatalogViewRequest;
}) {
  const state = useCatalogData(loadBeamPriceData, "beam");

  if (state.status !== "ready") {
    return <CatalogLoadMessage status={state.status} subject="قیمت تیرآهن" />;
  }

  return (
    <PriceCatalog
      priceData={state.data}
      config={beamConfig}
      phoneHref={phoneHref}
      requestedView={requestedView}
    />
  );
}
