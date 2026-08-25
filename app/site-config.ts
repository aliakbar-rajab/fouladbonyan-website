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
    aliases: ["فولاد بنیان داریا", "بنیان فولاد", "فولاد بنیان"],
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
