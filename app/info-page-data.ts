export type InfoPageKey =
  | "about"
  | "terms"
  | "privacy"
  | "quote-process"
  | "complaints"
  | "shipping-delivery";

type PageDefinition = {
  title: string;
  eyebrow: string;
  description: string;
  seoDescription: string;
  lastmod: string;
};

export const infoPageDefinitions: Record<InfoPageKey, PageDefinition> = {
  about: {
    title: "درباره ما",
    eyebrow: "بنیان فولاد داریا",
    description:
      "معرفی فعالیت، رویکرد پاسخ‌گویی و حدود خدمات بنیان فولاد داریا در زمینه مقاطع فولادی.",
    seoDescription:
      "درباره بنیان فولاد داریا؛ معرفی خدمات استعلام، تأمین و هماهنگی تحویل محصولات فولادی برای پروژه‌های ساختمانی و صنعتی.",
    lastmod: "2026-07-29",
  },
  terms: {
    title: "شرایط استفاده",
    eyebrow: "قوانین وب‌سایت",
    description:
      "حدود استفاده از اطلاعات، قیمت‌ها و راه‌های ارتباطی این وب‌سایت را پیش از ارسال درخواست مطالعه کنید.",
    seoDescription:
      "شرایط استفاده از وب‌سایت بنیان فولاد داریا و توضیح ماهیت اطلاع‌رسانی قیمت‌ها و درخواست‌های پیش‌فاکتور.",
    lastmod: "2026-07-29",
  },
  privacy: {
    title: "حریم خصوصی",
    eyebrow: "حفاظت از اطلاعات",
    description:
      "در این صفحه توضیح داده‌ایم چه اطلاعاتی دریافت می‌شود و فرم‌های محلی چگونه عمل می‌کنند.",
    seoDescription:
      "سیاست حریم خصوصی بنیان فولاد داریا؛ نحوه استفاده از اطلاعات تماس و عملکرد محلی فرم‌های درخواست.",
    lastmod: "2026-07-29",
  },
  "quote-process": {
    title: "فرایند درخواست پیش‌فاکتور",
    eyebrow: "راهنمای استعلام",
    description:
      "از آماده‌کردن مشخصات محصول تا دریافت پیش‌فاکتور دارای مدت اعتبار، مراحل را شفاف دنبال کنید.",
    seoDescription:
      "مراحل درخواست پیش‌فاکتور غیرقطعی محصولات فولادی، مدارک موردنیاز و فرم آماده‌سازی درخواست برای تماس با واحد فروش.",
    lastmod: "2026-07-29",
  },
  complaints: {
    title: "ثبت شکایت و پیگیری",
    eyebrow: "پاسخ‌گویی و رسیدگی",
    description:
      "موضوع خود را با جزئیات آماده کنید و برای ثبت نهایی یا پیگیری با مدیریت تماس بگیرید.",
    seoDescription:
      "راهنمای ثبت شکایت و پیگیری در بنیان فولاد داریا، اطلاعات لازم و فرم آماده‌سازی متن شکایت.",
    lastmod: "2026-08-17",
  },
  "shipping-delivery": {
    title: "شرایط ارسال و تحویل",
    eyebrow: "هماهنگی حمل",
    description:
      "شرایط حمل، هزینه، زمان و محل تحویل پس از مشخص‌شدن کالا و در پیش‌فاکتور معتبر اعلام می‌شود.",
    seoDescription:
      "شرایط ارسال و تحویل محصولات فولادی، مسئولیت حمل، زمان‌بندی، هزینه و نکات بازرسی هنگام تحویل.",
    lastmod: "2026-07-29",
  },
};

/**
 * Own keys only. A plain `in` check also answers yes to everything on
 * Object.prototype, so `/constructor/` and `/toString/` were routed here and
 * rendered a page with an undefined title, an empty <h1> and the last
 * section's body. Matches isGuidePageKey.
 */
export function isInfoPageKey(value: string): value is InfoPageKey {
  return Object.prototype.hasOwnProperty.call(infoPageDefinitions, value);
}
