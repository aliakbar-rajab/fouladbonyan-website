import { createRetryableLoader } from "./catalog-cache";
import { loadBeamPriceData, loadRebarPriceData } from "./catalog-data";
import { loadProductPricePayload } from "./product-price-data";
import { productGroups, type ProductGroupId } from "./category-meta";

export type CategoryPriceOverview = {
  id: ProductGroupId;
  label: string;
  shortLabel: string;
  subTypes: string;
  image: string;
  description: string;
  minPrice: number | null;
  maxPrice: number | null;
  unit: string;
  date: string;
  status: string;
  percent: number;
};

export function buildFallbackOverviews(): CategoryPriceOverview[] {
  return productGroups.map((group) => ({
    id: group.id,
    label: group.label,
    shortLabel: group.shortLabel,
    subTypes: group.subTypes,
    image: group.image,
    description: group.description,
    minPrice: null,
    maxPrice: null,
    unit:
      group.id === "beam" || group.id === "pipe"
        ? "شاخه / کیلوگرم"
        : "کیلوگرم",
    date: "امروز",
    status: "steady",
    percent: 0,
  }));
}

export const loadOverviewSummaries = createRetryableLoader<
  CategoryPriceOverview[]
>(async () => {
  const [rebarData, beamData, productData] = await Promise.all([
    loadRebarPriceData(),
    loadBeamPriceData(),
    loadProductPricePayload(),
  ]);

  return productGroups.map((group): CategoryPriceOverview => {
    const isRebar = group.id === "rebar";
    const isBeam = group.id === "beam";
    const isPipe = group.id === "pipe";

    const categories = isRebar
      ? rebarData.categories
      : isBeam
        ? beamData.categories
        : productData.catalogs.find((c) => c.id === group.id)?.categories ?? [];

    const unit = isBeam || isPipe ? "شاخه / کیلوگرم" : "کیلوگرم";

    const minValues = categories
      .map((c) => c.summary.min)
      .filter((v) => typeof v === "number" && v > 0);
    const maxValues = categories
      .map((c) => c.summary.max)
      .filter((v) => typeof v === "number" && v > 0);

    const minPrice = minValues.length > 0 ? Math.min(...minValues) : null;
    const maxPrice = maxValues.length > 0 ? Math.max(...maxValues) : null;
    const firstSummary = categories[0]?.summary;

    return {
      id: group.id,
      label: group.label,
      shortLabel: group.shortLabel,
      subTypes: group.subTypes,
      image: group.image,
      description: group.description,
      minPrice,
      maxPrice,
      unit,
      date: firstSummary?.date || "امروز",
      status: firstSummary?.status || "steady",
      percent: firstSummary?.percent || 0,
    };
  });
});
