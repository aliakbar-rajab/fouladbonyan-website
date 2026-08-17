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

export type GuidePageDefinition = {
  /** H1 and breadcrumb leaf. */
  title: string;
  eyebrow: string;
  /** Hero paragraph, also the gist shown on the /guide/ index. */
  description: string;
  seoTitle: string;
  seoDescription: string;
  lastmod: string;
};

export const GUIDE_BASE_PATH = "/guide/";

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
    title: "جدول وزن میلگرد",
    eyebrow: "جدول وزن",
    description:
      "وزن هر متر و وزن هر شاخه میلگرد بر پایه فرمول استاندارد وزن، برای همان سایزهایی که در جدول قیمت این سایت عرضه می‌شوند.",
    seoTitle:
      "جدول وزن میلگرد؛ وزن هر متر و هر شاخه ۱۲ متری | بنیان فولاد داریا",
    seoDescription:
      "جدول وزن میلگرد آجدار و ساده از سایز ۶ تا ۴۰: وزن هر متر، وزن شاخه ۱۲ متری و تعداد شاخه در هر تن، به‌همراه فرمول محاسبه وزن میلگرد.",
    lastmod: "2026-08-17",
  },
  "beam-weight-chart": {
    title: "جدول وزن تیرآهن",
    eyebrow: "جدول وزن",
    description:
      "وزن شاخه تیرآهن IPE به تفکیک کارخانه؛ همان وزنی که کارخانه اعلام می‌کند، نه وزن محاسباتی — چون برای یک سایز مشخص بین کارخانه‌ها فرق دارد.",
    seoTitle: "جدول وزن تیرآهن IPE به تفکیک کارخانه | بنیان فولاد داریا",
    seoDescription:
      "وزن شاخه ۱۲ متری تیرآهن IPE در سایزهای ۱۲ تا ۳۰ به تفکیک کارخانه، و توضیح اینکه چرا وزن یک سایز مشخص بین ذوب آهن، یزد، فایکو و بقیه تفاوت دارد.",
    lastmod: "2026-08-17",
  },
  "ribbed-vs-plain-rebar": {
    title: "تفاوت میلگرد آجدار و ساده",
    eyebrow: "راهنمای انتخاب",
    description:
      "دو محصولی که یک نام مشترک دارند اما استاندارد، سایزبندی، تعداد تولیدکننده و کاربردشان یکی نیست.",
    seoTitle: "تفاوت میلگرد آجدار و ساده چیست؟ | بنیان فولاد داریا",
    seoDescription:
      "مقایسه میلگرد آجدار و میلگرد ساده از نظر استاندارد (A1 تا A4)، بازه سایز، تعداد کارخانه و واحد فروش، و اینکه هنگام سفارش کدام را باید مشخص کنید.",
    lastmod: "2026-08-17",
  },
  "ipe-vs-hash-beam": {
    title: "انواع تیرآهن IPE و هاش",
    eyebrow: "راهنمای انتخاب",
    description:
      "تیرآهن معمولی IPE در برابر هاش سبک (HEA) و هاش سنگین (HEB): چه چیزی در کاتالوگ واقعاً موجود است و هنگام استعلام چه باید گفت.",
    seoTitle: "تفاوت تیرآهن IPE با هاش HEA و HEB | بنیان فولاد داریا",
    seoDescription:
      "انواع تیرآهن IPE، هاش سبک HEA و هاش سنگین HEB؛ سایزهای موجود، کارخانه‌های تولیدکننده، واحد فروش و نکاتی که باید هنگام استعلام تیرآهن مشخص کنید.",
    lastmod: "2026-08-17",
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
    lastmod: "2026-08-17",
  },
};

export const guidePageKeys = Object.keys(
  guidePageDefinitions,
) as GuidePageKey[];

export const guidePageUrl = (key: GuidePageKey) =>
  `${GUIDE_BASE_PATH}${key}/`;

export function isGuidePageKey(value: string): value is GuidePageKey {
  return Object.prototype.hasOwnProperty.call(guidePageDefinitions, value);
}
