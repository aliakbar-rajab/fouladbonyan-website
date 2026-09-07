// Scrape configuration for every price category: the slugs and per-source
// scrape knobs used to build fetch requests (scripts/fetch-*-prices.mjs) and
// to assert the fetched payload shape (scripts/validate-price-data.mjs).
// Kept free of network code so validate-price-data.mjs can import it without
// triggering a live fetch.
//
// The ids, labels and initial categories themselves live in
// app/catalog-taxonomy.mjs (the single source of truth shared with
// app/category-meta.ts and app/catalog-reader.ts); this file only adds the
// scrape-specific fields on top, keyed by the same subcategory ids.
import { catalogGroups } from "../app/catalog-taxonomy.mjs";

// Ribbed and simple rebar publish the size inside the title rather than in a
// size meta, so it is read back out of the title for those two only.
const sizeFromTitle = (pattern) => (item) => {
  const match = String(item.title ?? "").match(pattern);
  return match?.[1]?.replace("/", ".");
};

// Metas published per row on product-catalog pages, in the order they should
// be shown.
export const productDetailKeys = [
  "عرض",
  "ضخامت",
  "طول",
  "طول شاخه",
  "حالت",
  "استاندارد",
  "گرید",
  "رده",
  "وزن تقریبی",
  "چشمه",
  "ستون",
];

// Scrape-only config per subcategory id. Absent fields fall back to
// scripts/lib/price-pipeline.mjs's own defaults (specificationKey,
// groupingLabel, detailKeys).
const scrapeConfigById = {
  // rebar
  ribbed: {
    slug: "میلگرد-آجدار",
    minimumItems: 100,
    deriveSize: sizeFromTitle(/میلگرد\s+(\d+(?:[./]\d+)?)/),
  },
  simple: {
    slug: "میلگرد-ساده",
    minimumItems: 20,
    deriveSize: sizeFromTitle(/میلگرد\s+ساده\s+(\d+(?:[./]\d+)?)/),
  },
  stainless: {
    slug: "میلگرد-استیل",
    minimumItems: 20,
    groupingLabel: "گرید",
    specificationLabel: "گرید",
  },
  alloy: {
    slug: "میلگرد-آلیاژی",
    minimumItems: 40,
    groupingLabel: "گرید",
  },

  // beam
  beam: { slug: "تیرآهن", minimumItems: 30 },
  hash: { slug: "تیرآهن-هاش", minimumItems: 5 },

  // sheet
  "black-sheet": { slug: "ورق-سیاه" },
  "sheet-st52": { slug: "ورق-st52" },
  "sheet-a283": { slug: "ورق-a283" },
  "sheet-a285": { slug: "ورق-a285" },
  "sheet-a516": { slug: "ورق-a516" },
  "steel-strip": { slug: "تسمه-آهنی", specificationKey: "عرض" },
  "galvanized-sheet": { slug: "ورق-گالوانیزه" },
  "colored-sheet": { slug: "ورق-رنگی" },
  "oily-sheet": { slug: "ورق-روغنی" },
  "checkered-sheet": { slug: "ورق-آجدار" },
  "pickled-sheet": { slug: "ورق-اسید-شویی" },
  "decking-sheet": { slug: "عرشه-فولادی" },
  "stainless-sheet": {
    slug: "ورق-استیل",
    specificationKey: "گرید",
    groupingLabel: "گرید",
  },
  "wear-resistant-sheet": {
    slug: "ورق-ضد-سایش",
    specificationKey: "گرید",
    groupingLabel: "گرید",
  },
  "sheet-ck45": { slug: "ورق-ck45" },

  // profile
  "box-profile": {
    slug: "قوطی-و-پروفیل",
    specificationKey: "ضخامت",
    groupingLabel: "گروه",
  },
  "building-profile": {
    slug: "پروفیل-ساختمانی",
    specificationKey: "ضخامت",
    groupingLabel: "گروه",
  },
  "industrial-profile": { slug: "پروفیل-صنعتی" },
  "stainless-profile": {
    slug: "پروفیل-استیل",
    specificationKey: "گرید",
    groupingLabel: "گرید",
  },
  "furniture-profile": { slug: "پروفیل-مبلی" },
  "galvanized-profile": { slug: "پروفیل-گالوانیزه" },
  "z-profile": { slug: "پروفیل-زد" },

  // pipe
  "scaffold-pipe": { slug: "لوله-داربست" },
  "galvanized-pipe": { slug: "لوله-گالوانیزه" },
  "stainless-pipe": {
    slug: "لوله-استیل",
    specificationKey: "گرید",
    groupingLabel: "گرید",
  },
  "water-test-pipe": { slug: "لوله-تست-آب" },
  "spiral-pipe": { slug: "لوله-اسپیرال" },
  "api-pipe": { slug: "لوله-api", specificationKey: "استاندارد" },
  "gas-pipe": { slug: "لوله-گاز-خانگی" },
  "well-casing-pipe": { slug: "لوله-جدار-چاه" },
  "seamless-pipe": { slug: "لوله-مانیسمان", specificationKey: "رده" },
  "thick-wall-pipe": { slug: "لوله-گوشتدار" },

  // angle
  angle: { slug: "نبشی" },

  // channel
  channel: { slug: "ناودانی", specificationKey: "طول شاخه" },

  // wire
  wire: { slug: "سیم-مفتول", specificationKey: "حالت", groupingLabel: "گروه" },
  "rib-lath": {
    slug: "رابیتس",
    specificationKey: "ستون",
    groupingLabel: "گروه",
  },
  "steel-mesh": {
    slug: "مش",
    specificationKey: "چشمه",
    groupingLabel: "گروه",
  },
  "chicken-mesh": {
    slug: "توری-مرغی",
    specificationKey: "عرض",
    groupingLabel: "گروه",
  },
  "chain-link-mesh": {
    slug: "توری-حصاری",
    specificationKey: "ضخامت",
    groupingLabel: "گروه",
  },
  "crimped-mesh": {
    slug: "توری-پرسی",
    specificationKey: "ضخامت",
    groupingLabel: "گروه",
  },
};

// The exact shape scripts/lib/price-pipeline.mjs, scripts/validate-price-data.mjs
// and workers/price-refresh/ingest.mjs depend on: each catalog's id, label,
// initialCategoryId, and each of its sources' id, label plus scrape config —
// composed from the taxonomy (ids, labels, initial categories) and the
// scrape config above, rather than written out twice.
export const allCatalogConfigs = catalogGroups.map((group) => ({
  id: group.id,
  label: group.label,
  initialCategoryId: group.initialCategoryId,
  sources: group.subcategories.map((subcategory) => ({
    id: subcategory.id,
    label: subcategory.label,
    ...scrapeConfigById[subcategory.id],
  })),
}));
