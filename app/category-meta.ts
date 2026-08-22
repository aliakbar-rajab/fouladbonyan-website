import type { ProductCatalogId } from "./product-price-data";

export type ProductRow = {
  product: string;
  origin: string;
  unit: string;
  categoryId?: string;
  factory?: string;
  size?: string;
  searchText?: string;
};

export type ProductGroupId = "rebar" | "beam" | ProductCatalogId;

export type ProductGroup = {
  id: ProductGroupId;
  label: string;
  shortLabel: string;
  image: string;
  imageAlt: string;
  heroImage?: string;
  description: string;
  h1: string;
  intro: string;
  subTypes: string;
  rows: ProductRow[];
  /** <title> for this category's landing page (scripts/generate-category-pages.mjs). */
  seoTitle: string;
  /** <meta name="description"> for this category's landing page. */
  seoDescription: string;
};

const liveProductCatalogIds: ProductCatalogId[] = [
  "sheet",
  "profile",
  "pipe",
  "angle",
  "channel",
  "wire",
];

export function isProductCatalogId(value: string): value is ProductCatalogId {
  return liveProductCatalogIds.includes(value as ProductCatalogId);
}

// rows is filled in by buildCatalogSearchGroups from the live catalogs. It is
// deliberately empty here: search only ever runs once those have loaded, so any
// placeholder listed at this level would be unreachable.
//
// This module has no React exports, so it also doubles as the source of truth
// for build-time tooling (see scripts/generate-category-pages.mjs) that needs
// each category's slug, label, and description without pulling in the app.
export const productGroups: ProductGroup[] = [
  {
    id: "rebar",
    label: "میلگرد",
    shortLabel: "میلگرد",
    image: "/categories/01-rebar.jpg",
    imageAlt: "انواع میلگرد آجدار و ساده ساختمانی",
    heroImage: "/categories/hero-rebar-1680.jpg",
    description: "میلگرد آجدار و ساده برای پروژه‌های ساختمانی و صنعتی",
    h1: "قیمت روز میلگرد آجدار و ساده",
    intro:
      "میلگرد آجدار و ساده در گریدهای A1، A2، A3 و A4 از سایز ۸ تا ۴۰ میلی‌متر، تولید کارخانه‌های معتبر کشور (ذوب‌آهن، میانه، نیشابور، فایکو و...). قیمت‌ها بر حسب کیلوگرم محاسبه شده و تحویل به‌صورت شاخه ۱۲ متری یا کلاف انجام می‌شود. هنگام استعلام، سایز، گرید و کارخانه مورد نظر را اعلام فرمایید.",
    subTypes: "میلگرد آجدار، ساده، کلاف ساختمانی",
    rows: [],
    seoTitle: "قیمت میلگرد آجدار و ساده امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز میلگرد آجدار، ساده، استیل و آلیاژی از کارخانه‌های معتبر. استعلام قیمت و درخواست پیش‌فاکتور میلگرد با مشاوره تلفنی.",
  },
  {
    id: "beam",
    label: "تیرآهن",
    shortLabel: "تیرآهن",
    image: "/categories/02-ibeam.jpg",
    imageAlt: "انواع تیرآهن IPE و هاش سازه‌ای",
    heroImage: "/categories/hero-beam-1680.jpg",
    description: "تیرآهن IPE، هاش و مقاطع سازه‌ای",
    h1: "قیمت روز تیرآهن IPE و هاش",
    intro:
      "تیرآهن معمولی IPE، هاش سبک (HEA) و هاش سنگین (HEB) در سایزهای ۱۲ تا ۳۰ از کارخانه‌های ذوب‌آهن اصفهان، فایکو، یزد و... . فروش تیرآهن به‌صورت شاخه‌ای یا برمبنای وزن نهایی باسکول بر حسب کیلوگرم انجام می‌شود. برای سفارش شاخه‌های سنگین و هاش، نوع استاندارد و طول شاخه را مشخص کنید.",
    subTypes: "تیرآهن IPE، هاش سبک و هاش سنگین",
    rows: [],
    seoTitle: "قیمت تیرآهن IPE و هاش امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز تیرآهن IPE و هاش از کارخانه‌های معتبر. استعلام قیمت و درخواست پیش‌فاکتور تیرآهن با مشاوره تلفنی.",
  },
  {
    id: "sheet",
    label: "ورق فولادی",
    shortLabel: "ورق",
    image: "/categories/03-sheet-coil.jpg",
    imageAlt: "انواع رول و شیت ورق فولادی سیاه و گالوانیزه",
    heroImage: "/categories/hero-sheet-1680.jpg",
    description: "ورق سیاه، گالوانیزه، روغنی و رنگی",
    h1: "قیمت روز انواع ورق فولادی",
    intro:
      "انواع ورق سیاه (ST37 و ST52)، ورق روغنی (نورد سرد)، گالوانیزه، رنگی و اسیدشویی در ضخامت‌های مختلف از کارخانه‌های فولاد مبارکه، اکسین، کاویان و هفت‌الماس. عرضه به‌صورت رول (کلاف) و شیت (برش‌خورده و فابریک) بر حسب کیلوگرم محاسبه می‌شود.",
    subTypes: "ورق سیاه، گالوانیزه، روغنی و رنگی",
    rows: [],
    seoTitle: "قیمت ورق سیاه، گالوانیزه و رنگی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز ورق فولادی سیاه، گالوانیزه، روغنی و رنگی. استعلام قیمت و درخواست پیش‌فاکتور ورق با مشاوره تلفنی.",
  },
  {
    id: "profile",
    label: "قوطی و پروفیل",
    shortLabel: "پروفیل",
    image: "/categories/04-profile.jpg",
    imageAlt: "انواع قوطی و پروفیل ساختمانی و صنعتی",
    heroImage: "/categories/hero-profile-1680.jpg",
    description: "پروفیل ساختمانی و صنعتی در ابعاد گوناگون",
    h1: "قیمت روز قوطی و پروفیل ساختمانی و صنعتی",
    intro:
      "پروفیل‌های قوطی مربعی و مستطیلی، پروفیل‌های درب و پنجره، پروفیل زد (Z) و مقاطع صنعتی با ضخامت‌های مختلف از فولاد مبارکه و نورد لوله. فروش بر پایه وزن (کیلوگرم) در شاخه‌های ۶ متری صورت می‌گیرد. در استعلام قیمت، ضخامت ورق و ابعاد مقطع را قید کنید.",
    subTypes: "قوطی ساختمانی، پروفیل Z و مقاطع صنعتی",
    rows: [],
    seoTitle: "قیمت پروفیل و قوطی ساختمانی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز قوطی و پروفیل ساختمانی و صنعتی در ابعاد گوناگون. استعلام قیمت و درخواست پیش‌فاکتور پروفیل با مشاوره تلفنی.",
  },
  {
    id: "pipe",
    label: "لوله فولادی",
    shortLabel: "لوله",
    image: "/categories/05-pipe.jpg",
    imageAlt: "انواع لوله فولادی صنعتی، گازی و داربستی",
    heroImage: "/categories/hero-pipe-1680.jpg",
    description: "لوله صنعتی، گازی و داربستی",
    h1: "قیمت روز لوله فولادی صنعتی، گازی و داربستی",
    intro:
      "انواع لوله داربستی، لوله صنعتی، لوله گازی (روکار و توکار) و لوله‌های بدون درز (مانیسمان) در رده‌های مختلف از کارخانه‌های معتبر نظیر سپاهان و اهواز. قیمت‌گذاری بر اساس شاخه ۶ متری یا کیلوگرم انجام می‌گیرد.",
    subTypes: "لوله داربستی، مانیسمان، گازی و صنعتی",
    rows: [],
    seoTitle: "قیمت لوله فولادی صنعتی و گازی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز لوله فولادی صنعتی، گازی و داربستی. استعلام قیمت و درخواست پیش‌فاکتور لوله با مشاوره تلفنی.",
  },
  {
    id: "angle",
    label: "نبشی",
    shortLabel: "نبشی",
    image: "/categories/06-angle.jpg",
    imageAlt: "انواع نبشی فولادی بال مساوی و نامساوی",
    heroImage: "/categories/hero-angle-1680.jpg",
    description: "نبشی بال مساوی و بال نامساوی",
    h1: "قیمت روز نبشی بال مساوی و نامساوی",
    intro:
      "نبشی‌های بال مساوی و بال نامساوی از سایز ۳ تا ۲۰ سانتیمتر و ضخامت‌های گوناگون ساخت کارخانه‌های ناب تبریز، ظفر بناب، اصفهان و شکفته. طول شاخه‌ها عموماً ۶ و ۱۲ متری بوده و قیمت‌ها به‌ازای هر کیلوگرم محاسبه می‌شود.",
    subTypes: "نبشی بال مساوی و بال نامساوی ساختمانی",
    rows: [],
    seoTitle: "قیمت نبشی فولادی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز نبشی بال مساوی و بال نامساوی. استعلام قیمت و درخواست پیش‌فاکتور نبشی با مشاوره تلفنی.",
  },
  {
    id: "channel",
    label: "ناودانی",
    shortLabel: "ناودانی",
    image: "/categories/07-channel.jpg",
    imageAlt: "انواع ناودانی فولادی سبک و سنگین ساختمانی",
    heroImage: "/categories/hero-channel-1680.jpg",
    description: "ناودانی سبک و سنگین برای مصارف سازه‌ای",
    h1: "قیمت روز ناودانی سبک و سنگین",
    intro:
      "ناودانی‌های سبک (طرح اروپایی/ایرانی) و ناودانی‌های سنگین ساختمانی و صنعتی در سایزهای ۶ تا ۳۰ از کارخانه‌های فایکو، شکفته مشهد و ناب تبریز. محاسبه قیمت بر حسب کیلوگرم است؛ هنگام خرید نوع سبک یا سنگین (UNP) و استاندارد را مشخص فرمایید.",
    subTypes: "ناودانی سبک و سنگین UNP سازه‌ای",
    rows: [],
    seoTitle: "قیمت ناودانی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز ناودانی سبک و سنگین برای مصارف سازه‌ای. استعلام قیمت و درخواست پیش‌فاکتور ناودانی با مشاوره تلفنی.",
  },
  {
    id: "wire",
    label: "مفتول و سیم",
    shortLabel: "مفتول",
    image: "/categories/08-wire.jpg",
    imageAlt: "انواع مفتول سیاه، گالوانیزه و محصولات سیمی",
    heroImage: "/categories/hero-wire-1680.jpg",
    description: "مفتول سیاه، گالوانیزه و محصولات سیمی",
    h1: "قیمت روز مفتول سیاه و محصولات سیمی",
    intro:
      "انواع مفتول سیاه (آرماتوربندی و قالب‌بندی)، مفتول گالوانیزه سفید، توری حصاری، توری مرغی و سیم رابیتس‌بندی. محصولات مفتولی به‌صورت کلاف و بر حسب کیلوگرم با قطرهای متنوع عرضه می‌شوند.",
    subTypes: "مفتول سیاه، گالوانیزه، توری و سیم آرماتور",
    rows: [],
    seoTitle: "قیمت مفتول و سیم فولادی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز مفتول سیاه، گالوانیزه و محصولات سیمی. استعلام قیمت و درخواست پیش‌فاکتور مفتول با مشاوره تلفنی.",
  },
];

export function getCategoryById(id: string): ProductGroup | undefined {
  return productGroups.find((group) => group.id === id);
}


