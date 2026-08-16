import { resolve } from "node:path";
import { validateProductPricePayload } from "../app/catalog-validation.mjs";
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
  "product-prices.json",
);

// Metas published per row on these pages, in the order they should be shown.
const detailKeys = [
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

const source = (
  id,
  label,
  slug,
  specificationKey = "ضخامت",
  groupingLabel = "کارخانه",
) => ({
  id,
  label,
  url: sourceUrl(slug),
  specificationKey,
  groupingLabel,
  detailKeys,
});

const catalogs = [
  {
    id: "sheet",
    label: "ورق فولادی",
    initialCategoryId: "black-sheet",
    sources: [
      source("black-sheet", "ورق سیاه", "ورق-سیاه"),
      source("sheet-st52", "ورق ST52", "ورق-st52"),
      source("sheet-a283", "ورق A283", "ورق-a283"),
      source("sheet-a285", "ورق A285", "ورق-a285"),
      source("sheet-a516", "ورق A516", "ورق-a516"),
      source("steel-strip", "تسمه آهنی", "تسمه-آهنی", "عرض"),
      source("galvanized-sheet", "ورق گالوانیزه", "ورق-گالوانیزه"),
      source("colored-sheet", "ورق رنگی", "ورق-رنگی"),
      source("oily-sheet", "ورق روغنی", "ورق-روغنی"),
      source("checkered-sheet", "ورق آجدار", "ورق-آجدار"),
      source("pickled-sheet", "ورق اسیدشویی", "ورق-اسید-شویی"),
      source("decking-sheet", "عرشه فولادی", "عرشه-فولادی"),
      source("stainless-sheet", "ورق استیل", "ورق-استیل", "گرید", "گرید"),
      source("wear-resistant-sheet", "ورق ضد سایش", "ورق-ضد-سایش", "گرید", "گرید"),
      source("sheet-ck45", "ورق CK45", "ورق-ck45"),
    ],
  },
  {
    id: "profile",
    label: "قوطی و پروفیل",
    initialCategoryId: "box-profile",
    sources: [
      source("box-profile", "قوطی و پروفیل", "قوطی-و-پروفیل", "ضخامت", "گروه"),
      source("building-profile", "پروفیل ساختمانی", "پروفیل-ساختمانی", "ضخامت", "گروه"),
      source("industrial-profile", "پروفیل صنعتی", "پروفیل-صنعتی"),
      source("stainless-profile", "پروفیل استیل", "پروفیل-استیل", "گرید", "گرید"),
      source("furniture-profile", "پروفیل مبلی", "پروفیل-مبلی"),
      source("galvanized-profile", "پروفیل گالوانیزه", "پروفیل-گالوانیزه"),
      source("z-profile", "پروفیل Z", "پروفیل-زد"),
    ],
  },
  {
    id: "pipe",
    label: "لوله فولادی",
    initialCategoryId: "scaffold-pipe",
    sources: [
      source("scaffold-pipe", "لوله داربست", "لوله-داربست"),
      source("galvanized-pipe", "لوله گالوانیزه", "لوله-گالوانیزه"),
      source("stainless-pipe", "لوله استیل", "لوله-استیل", "گرید", "گرید"),
      source("water-test-pipe", "لوله تست آب", "لوله-تست-آب"),
      source("spiral-pipe", "لوله اسپیرال", "لوله-اسپیرال"),
      source("api-pipe", "لوله API", "لوله-api", "استاندارد"),
      source("gas-pipe", "لوله گاز", "لوله-گاز-خانگی"),
      source("well-casing-pipe", "لوله جدار چاه", "لوله-جدار-چاه"),
      source("seamless-pipe", "لوله مانیسمان", "لوله-مانیسمان", "رده"),
      source("thick-wall-pipe", "لوله گوشتدار", "لوله-گوشتدار"),
    ],
  },
  {
    id: "angle",
    label: "نبشی",
    initialCategoryId: "angle",
    sources: [source("angle", "نبشی", "نبشی")],
  },
  {
    id: "channel",
    label: "ناودانی",
    initialCategoryId: "channel",
    sources: [source("channel", "ناودانی", "ناودانی", "طول شاخه")],
  },
  {
    id: "wire",
    label: "مفتول و سیم",
    initialCategoryId: "wire",
    sources: [
      source("wire", "سیم مفتول", "سیم-مفتول", "حالت", "گروه"),
      source("rib-lath", "رابیتس", "رابیتس", "ستون", "گروه"),
      source("steel-mesh", "مش", "مش", "چشمه", "گروه"),
      source("chicken-mesh", "توری مرغی", "توری-مرغی", "عرض", "گروه"),
      source("chain-link-mesh", "توری حصاری", "توری-حصاری", "ضخامت", "گروه"),
      source("crimped-mesh", "توری پرسی", "توری-پرسی", "ضخامت", "گروه"),
    ],
  },
];

const fetched = await fetchCategories(catalogs.flatMap((catalog) => catalog.sources));
const categoriesById = new Map(
  fetched.map((category) => [category.id, category]),
);

const payload = {
  fetchedAt: new Date().toISOString(),
  ...SOURCE_ENVELOPE,
  catalogs: catalogs.map((catalog) => ({
    id: catalog.id,
    label: catalog.label,
    initialCategoryId: catalog.initialCategoryId,
    categories: catalog.sources.map((item) => categoriesById.get(item.id)),
  })),
};
validateProductPricePayload(payload, {
  expectedCatalogs: catalogs.map((catalog) => ({
    id: catalog.id,
    categoryIds: catalog.sources.map((item) => item.id),
  })),
});

await writeSnapshot(
  outputPath,
  payload,
  (rows) =>
    `قیمت تمام محصولات از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف در ${fetched.length.toLocaleString("fa-IR")} دسته`,
);
