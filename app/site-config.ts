export type ContactNumber = {
  label: string;
  href: string;
};

export type ManagementContact = ContactNumber & {
  name: string;
};

export const siteConfig = {
  brand: {
    name: "بنیان فولاد داریا",
    alternateName: "Bonyan Foulad Daria",
  },
  siteUrl: "https://fouladbonyan.com",
  contact: {
    phones: [
      { label: "۰۲۱-۸۸۸۸۸۲۸۰", href: "tel:+982188888280" },
      { label: "۰۲۱-۸۸۸۸۸۷۸۰", href: "tel:+982188888780" },
      { label: "۰۲۱-۸۸۸۸۸۱۲۲", href: "tel:+982188888122" },
      { label: "۰۲۱-۸۸۸۸۹۰۰۵", href: "tel:+982188889005" },
      { label: "۰۲۱-۸۸۸۸۹۰۰۶", href: "tel:+982188889006" },
    ] satisfies ContactNumber[],
    management: [
      {
        name: "اسماعیل‌پور",
        href: "tel:+989123300815",
        label: "۰۹۱۲۳۳۰۰۸۱۵",
      },
      {
        name: "کریمی",
        href: "tel:+989126333326",
        label: "۰۹۱۲۶۳۳۳۳۲۶",
      },
    ] satisfies ManagementContact[],
    officialEmail: "info@fouladbonyan.com" as string | null,
    workingHours: "۹ الی ۱۸" as string | null,
    whatsappCommunityUrl: "https://chat.whatsapp.com/IXb2LqQ6UQvFq3shgQCRiW",
  },
  business: {
    legalName: null as string | null,
    nationalId: null as string | null,
    registrationNumber: null as string | null,
    address: "آجودانیه پورابتهاج نبش لشکری ساختمان سرو واحد ۳۰۳",
    shortAddress: "تهران، آجودانیه، پورابتهاج",
    city: "تهران",
    province: "تهران",
    postalCode: "1978977198",
    countryCode: "IR",
    countryName: "ایران",
  },
  officeCoordinates: {
    lat: 35.817127,
    lng: 51.4809619,
  },
  neshanShareUrl: "https://nshn.ir/QbvL2OWxRwI7",
} as const;

export function buildGoogleMapsUrl({ lat, lng }: typeof siteConfig.officeCoordinates) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function buildWazeUrl({ lat, lng }: typeof siteConfig.officeCoordinates) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

/*
 * One canonical primary navigation for every shell. The inner-page nav and the
 * contact quick nav render exactly this list; the footer swaps the About link
 * for the quote flow. The header on the home route renders the MegaMenu
 * instead, which drills into the same destinations. This is the source of
 * truth so no shell ever renames a route another shell uses -- the label drift
 * the critique caught between the inner and contact navs.
 */
export type NavLink = { href: string; label: string };

export const primaryNavLinks = [
  { href: "/", label: "صفحه اصلی" },
  { href: "/#products", label: "محصولات فولادی" },
  { href: "/#prices", label: "قیمت روز آهن و فولاد" },
  { href: "/about/", label: "درباره ما" },
  { href: "/contact/", label: "تماس با ما" },
] as const satisfies readonly NavLink[];

export const footerQuickLinks = [
  { href: "/", label: "صفحه اصلی" },
  { href: "/#products", label: "محصولات فولادی" },
  { href: "/#prices", label: "قیمت روز آهن و فولاد" },
  { href: "/quote-process/", label: "درخواست پیش‌فاکتور" },
  { href: "/contact/", label: "تماس با ما" },
] as const satisfies readonly NavLink[];

export function buildOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.siteUrl}/#organization`,
    name: siteConfig.brand.name,
    alternateName: siteConfig.brand.alternateName,
    url: `${siteConfig.siteUrl}/`,
    logo: `${siteConfig.siteUrl}/brand/bonyan-foulad-daria-logo.webp`,
    telephone: siteConfig.contact.phones.map((phone) =>
      phone.href.replace("tel:", ""),
    ),
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.business.address,
      addressLocality: siteConfig.business.city,
      addressRegion: siteConfig.business.province,
      postalCode: siteConfig.business.postalCode,
      addressCountry: siteConfig.business.countryCode,
    },
    ...(siteConfig.business.legalName
      ? { legalName: siteConfig.business.legalName }
      : {}),
    ...(siteConfig.contact.officialEmail
      ? { email: siteConfig.contact.officialEmail }
      : {}),
  };
}
