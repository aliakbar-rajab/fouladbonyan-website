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
  subTypes: string;
  /** Landing-page copy for overview-hub groups; consolidated groups own theirs in subcategory-content.ts. */
  h1?: string;
  intro?: string;
  /** <title> for overview-hub category landing pages. */
  seoTitle?: string;
  /** <meta name="description"> for overview-hub category landing pages. */
  seoDescription?: string;
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
    subTypes: "تیرآهن IPE، هاش سبک و هاش سنگین",
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
    subTypes: "نبشی بال مساوی و بال نامساوی ساختمانی",
  },
  channel: {
    shortLabel: "ناودانی",
    image: "/categories/07-channel.jpg",
    imageAlt: "انواع ناودانی فولادی سبک و سنگین ساختمانی",
    heroImage: "/categories/hero-channel-1680.jpg",
    description: "ناودانی سبک و سنگین برای مصارف سازه‌ای",
    subTypes: "ناودانی سبک و سنگین UNP سازه‌ای",
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
 * Default subcategories consolidated directly onto `/<group>/` rather than
 * serving a redundant `/<group>/<subId>/` URL. `/beam/` directly hosts IPE
 * (`beam`) while `/beam/hash/` keeps its dedicated H-beam route.
 */
export function isConsolidatedSubcategory(
  groupId: string,
  subcategoryId?: string,
): boolean {
  if (!subcategoryId) return false;
  if (isSingleSubcategoryGroup(groupId)) return true;
  return groupId === "beam" && subcategoryId === "beam";
}

/** Groups whose root `/<group>/` URL directly renders their primary price table. */
export function rendersCatalogOnGroupRoute(groupId: string): boolean {
  return isSingleSubcategoryGroup(groupId) || groupId === "beam";
}

/**
 * The one canonical, indexable URL for a (group, subcategory) pair. Every href
 * pointing at a subcategory must come from here.
 */
export function subcategoryHref(
  groupId: string,
  subcategoryId?: string,
): string {
  if (!subcategoryId || isConsolidatedSubcategory(groupId, subcategoryId)) {
    return `/${groupId}/`;
  }
  return `/${groupId}/${subcategoryId}/`;
}

export type CatalogRedirectRule = {
  fromPath: string[];
  toPath: string;
  targetLabel: string;
};

/**
 * Single source of truth for legacy 301 catalog redirects; app/site-page.ts
 * projects this list into generated `dist/_redirects` and static redirect stubs.
 */
export const catalogRedirectRules: readonly CatalogRedirectRule[] = [
  ...singleSubcategoryGroupIds.map((groupId) => ({
    fromPath: [groupId, groupId],
    toPath: `/${groupId}/`,
    targetLabel:
      productGroups.find((group) => group.id === groupId)?.label ?? groupId,
  })),
  {
    fromPath: ["beam", "beam"],
    toPath: "/beam/",
    targetLabel:
      productGroups.find((group) => group.id === "beam")?.label ?? "تیرآهن",
  },
  {
    fromPath: ["wire", "wire"],
    toPath: "/wire/steel-wire/",
    targetLabel: subcategoryLabel("steel-wire") ?? "سیم مفتول",
  },
];

export function getSubcategoryLabel(subcategoryId?: string): string | undefined {
  return subcategoryId ? subcategoryLabel(subcategoryId) : undefined;
}
