import { resolve } from "node:path";
import { validateCatalogPriceData } from "../app/catalog-validation.mjs";
import {
  SOURCE_ENVELOPE,
  fetchCategories,
  sourceUrl,
  writeSnapshot,
} from "./fooladiranian.mjs";

const outputPath = resolve(
  import.meta.dirname,
  "..",
  "app",
  "data",
  "rebar-prices.json",
);

// Ribbed and simple rebar publish the size inside the title rather than in a
// size meta, so it is read back out of the title for those two only.
const sizeFromTitle = (pattern) => (item) => {
  const match = String(item.title ?? "").match(pattern);
  return match?.[1]?.replace("/", ".");
};

const sources = [
  {
    id: "ribbed",
    label: "میلگرد آجدار",
    slug: "میلگرد-آجدار",
    minimumItems: 100,
    deriveSize: sizeFromTitle(/میلگرد\s+(\d+(?:[./]\d+)?)/),
  },
  {
    id: "simple",
    label: "میلگرد ساده",
    slug: "میلگرد-ساده",
    minimumItems: 20,
    deriveSize: sizeFromTitle(/میلگرد\s+ساده\s+(\d+(?:[./]\d+)?)/),
  },
  {
    id: "stainless",
    label: "میلگرد استیل",
    slug: "میلگرد-استیل",
    minimumItems: 20,
    groupingLabel: "گرید",
    specificationLabel: "گرید",
  },
  {
    id: "alloy",
    label: "میلگرد آلیاژی",
    slug: "میلگرد-آلیاژی",
    minimumItems: 40,
    groupingLabel: "گرید",
  },
].map((source) => ({ ...source, url: sourceUrl(source.slug) }));

const payload = {
  fetchedAt: new Date().toISOString(),
  ...SOURCE_ENVELOPE,
  categories: await fetchCategories(sources),
};
validateCatalogPriceData(payload, {
  expectedCategoryIds: sources.map((source) => source.id),
});

await writeSnapshot(
  outputPath,
  payload,
  (rows) =>
    `قیمت‌های میلگرد از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف`,
);
