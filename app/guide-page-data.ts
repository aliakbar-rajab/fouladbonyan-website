/**
 * The editorial reference layer at /guide/.
 *
 * These pages exist to answer questions the price tables cannot: how much a
 * given section weighs, what separates two products that share a name, and what
 * a buyer has to state before a quote can be priced at all. Every factual claim
 * on them is derived from app/data/*.json or from the weight formula in
 * catalog-behavior.mjs — see steel-reference.ts.
 *
 * `lastmod` is the date the *copy* was last written, not the build date: the
 * tables move with the price snapshots, but the editorial content does not, and
 * a sitemap date that changes on every build is a date Google learns to ignore.
 */
export type GuidePageKey =
  | "rebar-weight-chart"
  | "beam-weight-chart"
  | "ribbed-vs-plain-rebar"
  | "ipe-vs-hash-beam"
  | "units-and-quote-specs";

export type GuideFaq = {
  question: string;
  answer: string;
};

export type GuidePageDefinition = {
  /** H1 and breadcrumb leaf. */
  title: string;
  eyebrow: string;
  /** Hero paragraph, also the gist shown on the /guide/ index. */
  description: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string;
  lastmod: string;
  /** Root-relative image path used in Article structured data. */
  imagePath: string;
  faqs?: readonly GuideFaq[];
  hasDataset?: boolean;
};

export const GUIDE_BASE_PATH = "/guide/";

// All five articles first entered Git in 5cf2282 on this date. The component
// files added on 2026-08-22 only extracted that existing content.
const GUIDE_PUBLISHED_ON = "2026-08-17";

export const REBAR_WEIGHT_FAQS: readonly GuideFaq[] = [
  {
    question: "وزن میلگرد ۱۴ شاخه ۱۲ متری چند کیلوگرم است؟",
    answer:
      "بر اساس فرمول استاندارد اشتال (d² ÷ ۱۶۲)، وزن هر متر میلگرد ۱۴ برابر با ۱٫۲۱۰ کیلوگرم و وزن یک شاخه ۱۲ متری آن حدود ۱۴٫۵۲ کیلوگرم (معادل تقریبی ۶۹ شاخه در هر تن) است. وزن اعلامی کارخانه‌های ایران برای میلگرد ۱۴ آجدار بسته به خط تولید بین سبک‌بار و سنگین‌بار معمولاً در بازه ۱۳٫۵ تا ۱۵ کیلوگرم در شاخه قرار می‌گیرد.",
  },
  {
    question: "وزن میلگرد ۱۶ و ۱۸ چند کیلو است و در هر تن چند شاخه جا می‌گیرد؟",
    answer:
      "وزن استاندارد شاخه ۱۲ متری میلگرد ۱۶ بر پایه جدول اشتال ۱۸٫۹۶ کیلوگرم (حدود ۵۳ شاخه در تن) و برای میلگرد ۱۸ برابر با ۲۴٫۰۰ کیلوگرم (حدود ۴۲ شاخه در تن) است. در کاتالوگ کارخانه‌ها، میلگرد ۱۶ عمدتاً در بازه ۱۷٫۵ تا ۱۹٫۲ کیلوگرم و میلگرد ۱۸ در بازه ۲۱٫۵ تا ۲۴٫۶ کیلوگرم ثبت شده است.",
  },
  {
    question: "وزن میلگرد ۸ آجدار شاخه ۱۲ متری چقدر است؟",
    answer:
      "طبق فرمول اشتال، هر متر میلگرد ۸ وزنی معادل ۰٫۳۹۵ کیلوگرم دارد و وزن یک شاخه ۱۲ متری میلگرد ۸ آجدار حدود ۴٫۷۴ کیلوگرم (حدود ۲۱۱ شاخه در هر تن) است. بسته به کارخانه سازنده، وزن شاخه ۱۲ متری میلگرد ۸ آجدار در جدول کارخانه‌های ایران حدود ۴٫۲ تا ۵ کیلوگرم گزارش می‌شود.",
  },
  {
    question: "چرا وزن میلگرد کارخانه‌های مختلف با جدول اشتال تفاوت دارد؟",
    answer:
      "استاندارد ملی ایران (ISIRI 3132) بازه رواداری مجاز برای جرم واحد طول میلگرد تعیین می‌کند. برخی تولیدکنندگان مانند ذوب‌آهن اصفهان و کویر کاشان محصولی نزدیک به مرز بالایی یا مطابق وزن اشتال (سنگین‌بار) تولید می‌کنند، در حالی که برخی کارخانه‌های دیگر درون رواداری مجاز، وزن شاخه پایین‌تری (سبک‌بار) دارند. چون خرید میلگرد به‌صورت کیلویی انجام می‌شود، مقایسه وزن شاخه در کنار قیمت هر کیلوگرم اهمیت دارد.",
  },
  {
    question: "تفاوت وزن میلگرد آجدار و ساده در یک قطر یکسان چقدر است؟",
    answer:
      "فرمول اسمی اشتال (قطر به توان دو تقسیم بر ۱۶۲) برای هر دو نوع میلگرد ساده و آجدار با فولاد کربنی یکسان محاسبه می‌شود؛ بنابراین وزن مبنای جدول برای قطر یکسان برابر است، اما وزن باسکول واقعی هر بندیل تابع تلرانس نورد و ضخامت آج کارخانه است و در فاکتور فروش بر اساس توزین باسکول محاسبه می‌شود.",
  },
];

export const guideIndex = {
  title: "راهنمای فنی مقاطع فولادی",
  eyebrow: "مرجع فنی",
  description:
    "جدول وزن، تفاوت انواع مقاطع و واحدهای فروش — بر پایه همان داده‌ها و فرمولی که جدول‌های قیمت این سایت از آن استفاده می‌کنند.",
  seoTitle: "راهنمای فنی مقاطع فولادی؛ جدول وزن و مشخصات | بنیان فولاد داریا",
  seoDescription:
    "جدول وزن میلگرد و تیرآهن، تفاوت میلگرد آجدار و ساده، انواع تیرآهن IPE و هاش و واحدهای فروش مقاطع فولادی؛ راهنمای خرید بنیان فولاد داریا.",
  lastmod: "2026-08-17",
};

export const guidePageDefinitions: Record<GuidePageKey, GuidePageDefinition> = {
  "rebar-weight-chart": {
    title: "جدول وزن میلگرد آجدار و ساده (شاخه ۱۲ متری و وزن کارخانه‌ها)",
    eyebrow: "جدول وزن",
    description:
      "وزن هر متر و شاخه ۱۲ متری میلگرد آجدار و ساده بر پایه فرمول استاندارد اشتال (d² ÷ ۱۶۲)، جدول مقایسه وزن کارخانه‌های ایران و ماشین‌حساب آنلاین وزن.",
    seoTitle:
      "جدول وزن میلگرد آجدار و ساده (شاخه ۱۲ متری + وزن کارخانه‌ها) | بنیان فولاد داریا",
    seoDescription:
      "جدول کامل وزن میلگرد ۸، ۱۰، ۱۲، ۱۴، ۱۶، ۱۸ تا ۴۰ در شاخه ۱۲ متری بر اساس جدول اشتال و مقایسه وزن میلگرد ذوب‌آهن، میانه، نیشابور و کویر + ماشین‌حساب آنلاین وزن.",
    publishedAt: GUIDE_PUBLISHED_ON,
    lastmod: "2026-11-21",
    imagePath: "/categories/hero-rebar-1280.jpg",
    faqs: REBAR_WEIGHT_FAQS,
    hasDataset: true,
  },
  "beam-weight-chart": {
    title: "جدول وزن تیرآهن",
    eyebrow: "جدول وزن",
    description:
      "وزن شاخه تیرآهن IPE به تفکیک کارخانه؛ همان وزنی که کارخانه اعلام می‌کند، نه وزن محاسباتی — چون برای یک سایز مشخص بین کارخانه‌ها فرق دارد.",
    seoTitle: "جدول وزن تیرآهن IPE به تفکیک کارخانه | بنیان فولاد داریا",
    seoDescription:
      "وزن شاخه ۱۲ متری تیرآهن IPE در سایزهای ۱۲ تا ۳۰ به تفکیک کارخانه، و توضیح اینکه چرا وزن یک سایز مشخص بین ذوب آهن، یزد، فایکو و بقیه تفاوت دارد.",
    publishedAt: GUIDE_PUBLISHED_ON,
    lastmod: "2026-08-17",
    imagePath: "/categories/hero-beam-1280.jpg",
  },
  "ribbed-vs-plain-rebar": {
    title: "تفاوت میلگرد آجدار و ساده",
    eyebrow: "راهنمای انتخاب",
    description:
      "دو محصولی که یک نام مشترک دارند اما استاندارد، سایزبندی، تعداد تولیدکننده و کاربردشان یکی نیست.",
    seoTitle: "تفاوت میلگرد آجدار و ساده چیست؟ | بنیان فولاد داریا",
    seoDescription:
      "مقایسه میلگرد آجدار و میلگرد ساده از نظر استاندارد (A1 تا A4)، بازه سایز، تعداد کارخانه و واحد فروش، و اینکه هنگام سفارش کدام را باید مشخص کنید.",
    publishedAt: GUIDE_PUBLISHED_ON,
    lastmod: "2026-08-17",
    imagePath: "/categories/hero-rebar-1280.jpg",
  },
  "ipe-vs-hash-beam": {
    title: "انواع تیرآهن IPE و هاش",
    eyebrow: "راهنمای انتخاب",
    description:
      "تیرآهن معمولی IPE در برابر هاش سبک (HEA) و هاش سنگین (HEB): چه چیزی در کاتالوگ واقعاً موجود است و هنگام استعلام چه باید گفت.",
    seoTitle: "تفاوت تیرآهن IPE با هاش HEA و HEB | بنیان فولاد داریا",
    seoDescription:
      "انواع تیرآهن IPE، هاش سبک HEA و هاش سنگین HEB؛ سایزهای موجود، کارخانه‌های تولیدکننده، واحد فروش و نکاتی که باید هنگام استعلام تیرآهن مشخص کنید.",
    publishedAt: GUIDE_PUBLISHED_ON,
    lastmod: "2026-08-17",
    imagePath: "/categories/hero-beam-1280.jpg",
  },
  "units-and-quote-specs": {
    title: "واحد فروش و مشخصات لازم برای استعلام",
    eyebrow: "پیش از استعلام",
    description:
      "کیلوگرم، شاخه، برگ، طاقه یا مترمربع — هر گروه کالا با واحد خودش قیمت می‌خورد. این صفحه می‌گوید کدام با کدام، و برای گرفتن قیمت چه چیزی باید مشخص باشد.",
    seoTitle:
      "واحد فروش مقاطع فولادی و مشخصات لازم برای استعلام | بنیان فولاد داریا",
    seoDescription:
      "تفاوت واحدهای کیلوگرم، شاخه، برگ، طاقه و مترمربع در خرید آهن‌آلات و فهرست مشخصاتی که پیش از درخواست قیمت یا پیش‌فاکتور باید اعلام کنید.",
    publishedAt: GUIDE_PUBLISHED_ON,
    lastmod: "2026-08-17",
    imagePath: "/brand/bonyan-foulad-daria-logo.webp",
  },
};

export const guidePageKeys = Object.keys(
  guidePageDefinitions,
) as GuidePageKey[];

export const guidePageUrl = (key: GuidePageKey) =>
  `${GUIDE_BASE_PATH}${key}/`;

export function isGuidePageKey(value: string): value is GuidePageKey {
  return Object.hasOwn(guidePageDefinitions, value);
}
