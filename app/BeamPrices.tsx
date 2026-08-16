import { useEffect, useState } from "react";
import { loadBeamPriceData } from "./catalog-data";
import {
  PriceCatalog,
  type PriceCatalogConfig,
} from "./RebarPrices";
import type { CatalogPriceData, CatalogViewRequest } from "./catalog-types";

export type BeamViewRequest = CatalogViewRequest;

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
  requestedView?: BeamViewRequest;
}) {
  const [priceData, setPriceData] = useState<CatalogPriceData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    loadBeamPriceData()
      .then((data) => {
        if (active) setPriceData(data);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <p className="catalog-load-state" role="alert">
        دریافت قیمت تیرآهن ممکن نشد. لطفاً صفحه را دوباره بارگذاری کنید.
      </p>
    );
  }
  if (!priceData) {
    return (
      <p className="catalog-load-state" role="status">
        در حال دریافت قیمت تیرآهن…
      </p>
    );
  }

  return (
    <PriceCatalog
      priceData={priceData}
      config={beamConfig}
      phoneHref={phoneHref}
      requestedView={requestedView}
    />
  );
}
