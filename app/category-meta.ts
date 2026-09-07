import { catalogGroups, subcategoryLabel } from "./catalog-taxonomy.mjs";
import type { ProductCatalogId, ProductGroupId } from "./catalog-types";

export { subcategoryLabels } from "./catalog-taxonomy.mjs";
export type { ProductCatalogId, ProductGroupId };

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
  /** <title> for this category's landing page (scripts/lib/prerender-pipeline.mjs). */
  seoTitle: string;
  /** <meta name="description"> for this category's landing page. */
  seoDescription: string;
};

/** Presentation-only fields, keyed by group id, in taxonomy order. */
type GroupPresentation = Omit<ProductGroup, "id" | "label">;

const presentationByGroupId: Record<ProductGroupId, GroupPresentation> = {
  rebar: {
    shortLabel: "میلگرد",
    image: "/categories/01-rebar.jpg",
    imageAlt: "انواع میلگرد آجدار و ساده ساختمانی",
    heroImage: "/categories/hero-rebar-1680.jpg",
    description: "میلگرد آجدار و ساده برای پروژه‌های ساختمانی و صنعتی",
    h1: "قیمت روز میلگرد آجدار و ساده",
    intro:
      "میلگرد آجدار و ساده در گریدهای A1، A2، A3 و A4 از سایز ۸ تا ۴۰ میلی‌متر، تولید کارخانه‌های معتبر کشور (ذوب‌آهن، میانه، نیشابور، فایکو و...). قیمت‌ها بر حسب کیلوگرم محاسبه شده و تحویل به‌صورت شاخه ۱۲ متری یا کلاف انجام می‌شود. هنگام استعلام، سایز، گرید و کارخانه مورد نظر را اعلام فرمایید.",
    subTypes: "میلگرد آجدار، ساده، کلاف ساختمانی",
    seoTitle: "قیمت میلگرد آجدار و ساده امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز میلگرد آجدار، ساده، استیل و آلیاژی از کارخانه‌های معتبر. استعلام قیمت و درخواست پیش‌فاکتور میلگرد با مشاوره تلفنی.",
  },
  beam: {
    shortLabel: "تیرآهن",
    image: "/categories/02-ibeam.jpg",
    imageAlt: "انواع تیرآهن IPE و هاش سازه‌ای",
    heroImage: "/categories/hero-beam-1680.jpg",
    description: "تیرآهن IPE، هاش و مقاطع سازه‌ای",
    h1: "قیمت روز تیرآهن IPE و هاش",
    intro:
      "تیرآهن معمولی IPE، هاش سبک (HEA) و هاش سنگین (HEB) در سایزهای ۱۲ تا ۳۰ از کارخانه‌های ذوب‌آهن اصفهان، فایکو، یزد و... . فروش تیرآهن به‌صورت شاخه‌ای یا برمبنای وزن نهایی باسکول بر حسب کیلوگرم انجام می‌شود. برای سفارش شاخه‌های سنگین و هاش، نوع استاندارد و طول شاخه را مشخص کنید.",
    subTypes: "تیرآهن IPE، هاش سبک و هاش سنگین",
    seoTitle: "قیمت تیرآهن IPE و هاش امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز تیرآهن IPE و هاش از کارخانه‌های معتبر. استعلام قیمت و درخواست پیش‌فاکتور تیرآهن با مشاوره تلفنی.",
  },
  sheet: {
    shortLabel: "ورق",
    image: "/categories/03-sheet-coil.jpg",
    imageAlt: "انواع رول و شیت ورق فولادی سیاه و گالوانیزه",
    heroImage: "/categories/hero-sheet-1680.jpg",
    description: "ورق سیاه، گالوانیزه، روغنی و رنگی",
    h1: "قیمت روز انواع ورق فولادی",
    intro:
      "انواع ورق سیاه (ST37 و ST52)، ورق روغنی (نورد سرد)، گالوانیزه، رنگی و اسیدشویی در ضخامت‌های مختلف از کارخانه‌های فولاد مبارکه، اکسین، کاویان و هفت‌الماس. عرضه به‌صورت رول (کلاف) و شیت (برش‌خورده و فابریک) بر حسب کیلوگرم محاسبه می‌شود.",
    subTypes: "ورق سیاه، گالوانیزه، روغنی و رنگی",
    seoTitle: "قیمت ورق سیاه، گالوانیزه و رنگی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز ورق فولادی سیاه، گالوانیزه، روغنی و رنگی. استعلام قیمت و درخواست پیش‌فاکتور ورق با مشاوره تلفنی.",
  },
  profile: {
    shortLabel: "پروفیل",
    image: "/categories/04-profile.jpg",
    imageAlt: "انواع قوطی و پروفیل ساختمانی و صنعتی",
    heroImage: "/categories/hero-profile-1680.jpg",
    description: "پروفیل ساختمانی و صنعتی در ابعاد گوناگون",
    h1: "قیمت روز قوطی و پروفیل ساختمانی و صنعتی",
    intro:
      "پروفیل‌های قوطی مربعی و مستطیلی، پروفیل‌های درب و پنجره، پروفیل زد (Z) و مقاطع صنعتی با ضخامت‌های مختلف از فولاد مبارکه و نورد لوله. فروش بر پایه وزن (کیلوگرم) در شاخه‌های ۶ متری صورت می‌گیرد. در استعلام قیمت، ضخامت ورق و ابعاد مقطع را قید کنید.",
    subTypes: "قوطی ساختمانی، پروفیل Z و مقاطع صنعتی",
    seoTitle: "قیمت پروفیل و قوطی ساختمانی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز قوطی و پروفیل ساختمانی و صنعتی در ابعاد گوناگون. استعلام قیمت و درخواست پیش‌فاکتور پروفیل با مشاوره تلفنی.",
  },
  pipe: {
    shortLabel: "لوله",
    image: "/categories/05-pipe.jpg",
    imageAlt: "انواع لوله فولادی صنعتی، گازی و داربستی",
    heroImage: "/categories/hero-pipe-1680.jpg",
    description: "لوله صنعتی، گازی و داربستی",
    h1: "قیمت روز لوله فولادی صنعتی، گازی و داربستی",
    intro:
      "انواع لوله داربستی، لوله صنعتی، لوله گازی (روکار و توکار) و لوله‌های بدون درز (مانیسمان) در رده‌های مختلف از کارخانه‌های معتبر نظیر سپاهان و اهواز. قیمت‌گذاری بر اساس شاخه ۶ متری یا کیلوگرم انجام می‌گیرد.",
    subTypes: "لوله داربستی، مانیسمان، گازی و صنعتی",
    seoTitle: "قیمت لوله فولادی صنعتی و گازی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز لوله فولادی صنعتی، گازی و داربستی. استعلام قیمت و درخواست پیش‌فاکتور لوله با مشاوره تلفنی.",
  },
  angle: {
    shortLabel: "نبشی",
    image: "/categories/06-angle.jpg",
    imageAlt: "انواع نبشی فولادی بال مساوی و نامساوی",
    heroImage: "/categories/hero-angle-1680.jpg",
    description: "نبشی بال مساوی و بال نامساوی",
    h1: "قیمت روز نبشی بال مساوی و نامساوی",
    intro:
      "نبشی‌های بال مساوی و بال نامساوی از سایز ۳ تا ۲۰ سانتیمتر و ضخامت‌های گوناگون ساخت کارخانه‌های ناب تبریز، ظفر بناب، اصفهان و شکفته. طول شاخه‌ها عموماً ۶ و ۱۲ متری بوده و قیمت‌ها به‌ازای هر کیلوگرم محاسبه می‌شود.",
    subTypes: "نبشی بال مساوی و بال نامساوی ساختمانی",
    seoTitle: "قیمت نبشی فولادی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز نبشی بال مساوی و بال نامساوی. استعلام قیمت و درخواست پیش‌فاکتور نبشی با مشاوره تلفنی.",
  },
  channel: {
    shortLabel: "ناودانی",
    image: "/categories/07-channel.jpg",
    imageAlt: "انواع ناودانی فولادی سبک و سنگین ساختمانی",
    heroImage: "/categories/hero-channel-1680.jpg",
    description: "ناودانی سبک و سنگین برای مصارف سازه‌ای",
    h1: "قیمت روز ناودانی سبک و سنگین",
    intro:
      "ناودانی‌های سبک (طرح اروپایی/ایرانی) و ناودانی‌های سنگین ساختمانی و صنعتی در سایزهای ۶ تا ۳۰ از کارخانه‌های فایکو، شکفته مشهد و ناب تبریز. محاسبه قیمت بر حسب کیلوگرم است؛ هنگام خرید نوع سبک یا سنگین (UNP) و استاندارد را مشخص فرمایید.",
    subTypes: "ناودانی سبک و سنگین UNP سازه‌ای",
    seoTitle: "قیمت ناودانی سبک و سنگین امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز ناودانی سبک و سنگین برای مصارف سازه‌ای. استعلام قیمت و درخواست پیش‌فاکتور ناودانی با مشاوره تلفنی.",
  },
  wire: {
    shortLabel: "مفتول",
    image: "/categories/08-wire.jpg",
    imageAlt: "انواع مفتول سیاه، گالوانیزه و محصولات سیمی",
    heroImage: "/categories/hero-wire-1680.jpg",
    description: "مفتول سیاه، گالوانیزه و محصولات سیمی",
    h1: "قیمت روز مفتول سیاه و محصولات سیمی",
    intro:
      "انواع مفتول سیاه (آرماتوربندی و قالب‌بندی)، مفتول گالوانیزه سفید، توری حصاری، توری مرغی و سیم رابیتس‌بندی. محصولات مفتولی به‌صورت کلاف و بر حسب کیلوگرم با قطرهای متنوع عرضه می‌شوند.",
    subTypes: "مفتول سیاه، گالوانیزه، توری و سیم آرماتور",
    seoTitle: "قیمت مفتول و سیم فولادی امروز | بنیان فولاد داریا",
    seoDescription:
      "قیمت روز مفتول سیاه، گالوانیزه و محصولات سیمی. استعلام قیمت و درخواست پیش‌فاکتور مفتول با مشاوره تلفنی.",
  },
};

// This module has no React exports, so it also doubles as the source of truth
// for build-time tooling (see scripts/lib/prerender-pipeline.mjs) that needs
// each category's slug, label, and description without pulling in the app.
// id and label come from the taxonomy (app/catalog-taxonomy.mjs); only the
// presentation fields above are this module's own concern.
export const productGroups: ProductGroup[] = catalogGroups.map((group) => ({
  id: group.id as ProductGroupId,
  label: group.label,
  ...presentationByGroupId[group.id as ProductGroupId],
}));

export function getCategoryById(id: string): ProductGroup | undefined {
  return productGroups.find((group) => group.id === id);
}

/*
 * Groups whose catalog holds exactly one subcategory. Their subcategory page is
 * consolidated onto the parent category URL, so /angle/angle/ and
 * /channel/channel/ exist in dist only as noindex redirect stubs. Nothing
 * indexable may link to them.
 *
 * This list is the single source of truth for that rule. It used to be
 * open-coded as `id === "angle" || id === "channel"` in the mega menu, the
 * route interpreter and the prerender pipeline -- three copies that agreed,
 * next to three href builders that did not, which is how the catalog tab bar
 * on /angle/ and the /guide/units-and-quote-specs/ product list ended up
 * linking at the stubs.
 */
export const singleSubcategoryGroupIds = [
  "angle",
  "channel",
] as const satisfies readonly ProductGroupId[];

export function isSingleSubcategoryGroup(groupId: string): boolean {
  return (singleSubcategoryGroupIds as readonly string[]).includes(groupId);
}

/**
 * The one canonical, indexable URL for a (group, subcategory) pair. Every href
 * pointing at a subcategory must come from here.
 */
export function subcategoryHref(
  groupId: string,
  subcategoryId?: string,
): string {
  if (!subcategoryId || isSingleSubcategoryGroup(groupId)) {
    return `/${groupId}/`;
  }
  return `/${groupId}/${subcategoryId}/`;
}

export function getSubcategoryLabel(subcategoryId?: string): string | undefined {
  return subcategoryId ? subcategoryLabel(subcategoryId) : undefined;
}
