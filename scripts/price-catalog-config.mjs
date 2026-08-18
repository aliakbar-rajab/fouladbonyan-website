// Structural definition of every price category and catalog: the ids, labels
// and slugs used both to build fetch requests (scripts/fetch-*-prices.mjs)
// and to assert the fetched payload shape (scripts/validate-price-data.mjs).
// Kept free of network code so validate-price-data.mjs can import it without
// triggering a live fetch.

// Ribbed and simple rebar publish the size inside the title rather than in a
// size meta, so it is read back out of the title for those two only.
const sizeFromTitle = (pattern) => (item) => {
  const match = String(item.title ?? "").match(pattern);
  return match?.[1]?.replace("/", ".");
};

export const rebarSources = [
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
];

export const beamSources = [
  { id: "beam", label: "تیرآهن", slug: "تیرآهن", minimumItems: 30 },
  { id: "hash", label: "تیرآهن هاش", slug: "تیرآهن-هاش", minimumItems: 5 },
];

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

export const productCatalogs = [
  {
    id: "sheet",
    label: "ورق فولادی",
    initialCategoryId: "black-sheet",
    sources: [
      { id: "black-sheet", label: "ورق سیاه", slug: "ورق-سیاه" },
      { id: "sheet-st52", label: "ورق ST52", slug: "ورق-st52" },
      { id: "sheet-a283", label: "ورق A283", slug: "ورق-a283" },
      { id: "sheet-a285", label: "ورق A285", slug: "ورق-a285" },
      { id: "sheet-a516", label: "ورق A516", slug: "ورق-a516" },
      { id: "steel-strip", label: "تسمه آهنی", slug: "تسمه-آهنی", specificationKey: "عرض" },
      { id: "galvanized-sheet", label: "ورق گالوانیزه", slug: "ورق-گالوانیزه" },
      { id: "colored-sheet", label: "ورق رنگی", slug: "ورق-رنگی" },
      { id: "oily-sheet", label: "ورق روغنی", slug: "ورق-روغنی" },
      { id: "checkered-sheet", label: "ورق آجدار", slug: "ورق-آجدار" },
      { id: "pickled-sheet", label: "ورق اسیدشویی", slug: "ورق-اسید-شویی" },
      { id: "decking-sheet", label: "عرشه فولادی", slug: "عرشه-فولادی" },
      { id: "stainless-sheet", label: "ورق استیل", slug: "ورق-استیل", specificationKey: "گرید", groupingLabel: "گرید" },
      { id: "wear-resistant-sheet", label: "ورق ضد سایش", slug: "ورق-ضد-سایش", specificationKey: "گرید", groupingLabel: "گرید" },
      { id: "sheet-ck45", label: "ورق CK45", slug: "ورق-ck45" },
    ],
  },
  {
    id: "profile",
    label: "قوطی و پروفیل",
    initialCategoryId: "box-profile",
    sources: [
      { id: "box-profile", label: "قوطی و پروفیل", slug: "قوطی-و-پروفیل", specificationKey: "ضخامت", groupingLabel: "گروه" },
      { id: "building-profile", label: "پروفیل ساختمانی", slug: "پروفیل-ساختمانی", specificationKey: "ضخامت", groupingLabel: "گروه" },
      { id: "industrial-profile", label: "پروفیل صنعتی", slug: "پروفیل-صنعتی" },
      { id: "stainless-profile", label: "پروفیل استیل", slug: "پروفیل-استیل", specificationKey: "گرید", groupingLabel: "گرید" },
      { id: "furniture-profile", label: "پروفیل مبلی", slug: "پروفیل-مبلی" },
      { id: "galvanized-profile", label: "پروفیل گالوانیزه", slug: "پروفیل-گالوانیزه" },
      { id: "z-profile", label: "پروفیل Z", slug: "پروفیل-زد" },
    ],
  },
  {
    id: "pipe",
    label: "لوله فولادی",
    initialCategoryId: "scaffold-pipe",
    sources: [
      { id: "scaffold-pipe", label: "لوله داربست", slug: "لوله-داربست" },
      { id: "galvanized-pipe", label: "لوله گالوانیزه", slug: "لوله-گالوانیزه" },
      { id: "stainless-pipe", label: "لوله استیل", slug: "لوله-استیل", specificationKey: "گرید", groupingLabel: "گرید" },
      { id: "water-test-pipe", label: "لوله تست آب", slug: "لوله-تست-آب" },
      { id: "spiral-pipe", label: "لوله اسپیرال", slug: "لوله-اسپیرال" },
      { id: "api-pipe", label: "لوله API", slug: "لوله-api", specificationKey: "استاندارد" },
      { id: "gas-pipe", label: "لوله گاز", slug: "لوله-گاز-خانگی" },
      { id: "well-casing-pipe", label: "لوله جدار چاه", slug: "لوله-جدار-چاه" },
      { id: "seamless-pipe", label: "لوله مانیسمان", slug: "لوله-مانیسمان", specificationKey: "رده" },
      { id: "thick-wall-pipe", label: "لوله گوشتدار", slug: "لوله-گوشتدار" },
    ],
  },
  {
    id: "angle",
    label: "نبشی",
    initialCategoryId: "angle",
    sources: [{ id: "angle", label: "نبشی", slug: "نبشی" }],
  },
  {
    id: "channel",
    label: "ناودانی",
    initialCategoryId: "channel",
    sources: [{ id: "channel", label: "ناودانی", slug: "ناودانی", specificationKey: "طول شاخه" }],
  },
  {
    id: "wire",
    label: "مفتول و سیم",
    initialCategoryId: "wire",
    sources: [
      { id: "wire", label: "سیم مفتول", slug: "سیم-مفتول", specificationKey: "حالت", groupingLabel: "گروه" },
      { id: "rib-lath", label: "رابیتس", slug: "رابیتس", specificationKey: "ستون", groupingLabel: "گروه" },
      { id: "steel-mesh", label: "مش", slug: "مش", specificationKey: "چشمه", groupingLabel: "گروه" },
      { id: "chicken-mesh", label: "توری مرغی", slug: "توری-مرغی", specificationKey: "عرض", groupingLabel: "گروه" },
      { id: "chain-link-mesh", label: "توری حصاری", slug: "توری-حصاری", specificationKey: "ضخامت", groupingLabel: "گروه" },
      { id: "crimped-mesh", label: "توری پرسی", slug: "توری-پرسی", specificationKey: "ضخامت", groupingLabel: "گروه" },
    ],
  },
];
