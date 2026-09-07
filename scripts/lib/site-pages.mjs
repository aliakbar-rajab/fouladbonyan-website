import React from "react";
import App from "../../app/App.tsx";
import ContactPage from "../../app/ContactPage.tsx";
import GuidePage from "../../app/GuidePage.tsx";
import InfoPage from "../../app/InfoPage.tsx";
import {
  isSingleSubcategoryGroup,
  productGroups,
} from "../../app/category-meta.ts";
import {
  guideIndex,
  guidePageDefinitions,
  guidePageKeys,
} from "../../app/guide-page-data.ts";
import { infoPageDefinitions } from "../../app/info-page-data.ts";
import {
  buildOrganizationStructuredData,
  siteConfig,
} from "../../app/site-config.ts";
import { loadGroupCatalog } from "../../app/catalog-reader.ts";
import {
  HERO_OG_IMAGE,
  buildArticleJsonLd,
  buildHeroPreloadTag,
  buildWebSiteJsonLd,
  routeLocation,
} from "./static-document.mjs";

/**
 * Which pages the site has, and the editorial metadata each one carries.
 *
 * The catalogue: titles, descriptions, lastmods, Open Graph images,
 * breadcrumbs, and the hydration payloads each page ships. It says nothing
 * about how any of that becomes HTML -- static-document.mjs owns that -- so it
 * can be called and asserted on without rendering or writing anything.
 */

/**
 * Compiles the site's page descriptors: the homepage, every catalog group and
 * subcategory, contact, the info pages, the guide index and the guides.
 *
 * The count is deliberately not written here. It said 68 while the tests
 * asserted 66 -- a compiled-in catalogue drifts from any number stated beside
 * it, and prerender-pipeline.test.mjs and built-seo.test.mjs both pin the real
 * one against the descriptors and the sitemap.
 */
export async function collectSitePageDescriptors({
  snapshot,
  menuCatalog,
  overviewSummaries,
  reference,
  siteUrl = siteConfig.siteUrl,
}) {
  const rootLastmod = snapshot.fetchedAt.slice(0, 10);
  const organizationData = buildOrganizationStructuredData();
  const homeCrumb = { name: "صفحه اصلی", url: `${siteUrl}/` };
  const menuPayload = { id: "initial-menu-data", data: menuCatalog };

  const pages = [];

  // 1. Homepage
  const homeLocation = routeLocation({ kind: "home" }, siteUrl);
  pages.push({
    ...homeLocation,
    lastmod: rootLastmod,
    title: siteConfig.home.title,
    description: siteConfig.home.description,
    rootElement: React.createElement(App),
    heroPreload: undefined, // Preserves template default hero preload
    payloads: [
      menuPayload,
      { id: "initial-overview-data", data: overviewSummaries },
    ],
    organizationData: null,
    extraHeadHtml: buildWebSiteJsonLd({ siteUrl }),
    breadcrumb: [],
  });

  // 2. Category Landing Pages & Subcategories
  for (const group of productGroups) {
    const catalog = await loadGroupCatalog(group.id);
    const lastmod = catalog.fetchedAt.slice(0, 10);
    const heroPreload = buildHeroPreloadTag(group);
    const groupRoute = { kind: "catalog", category: group.id };
    const groupLocation = routeLocation(groupRoute, siteUrl);
    const groupUrl = groupLocation.pageUrl;
    const groupCrumb = { name: group.label, url: groupUrl };

    // Scoped hydration payload: contains only the current group's catalog
    // instead of injecting the entire multi-category snapshot
    const groupSnapshot = {
      fetchedAt: snapshot.fetchedAt,
      sourceName: snapshot.sourceName,
      sourceHome: snapshot.sourceHome,
      taxRate: snapshot.taxRate,
      catalogs: [catalog],
    };
    const catalogPayloads = [
      menuPayload,
      { id: "initial-page-data", data: groupSnapshot },
    ];
    const groupOgImage = `${siteUrl}/categories/hero-${group.id}-${HERO_OG_IMAGE.variant}.jpg`;
    const groupOgImageAlt = `قیمت ${group.label} | بنیان فولاد داریا`;

    const isSingleCategoryGroup = isSingleSubcategoryGroup(group.id);

    // Category landing page
    pages.push({
      ...groupLocation,
      lastmod,
      title: group.seoTitle,
      description: group.seoDescription,
      ogImage: groupOgImage,
      ogImageAlt: groupOgImageAlt,
      ogImageWidth: HERO_OG_IMAGE.width,
      ogImageHeight: HERO_OG_IMAGE.height,
      rootElement: React.createElement(App, {
        initialCategory: group.id,
        initialSubcategory: isSingleCategoryGroup ? group.id : undefined,
      }),
      heroPreload,
      payloads: catalogPayloads,
      organizationData: null,
      breadcrumb: [homeCrumb, groupCrumb],
    });

    // Subcategory pages: single-subcategory families (angle, channel)
    // are consolidated onto their parent category page.
    if (!isSingleCategoryGroup) {
      for (const sub of catalog.categories) {
        const subRoute = {
          kind: "catalog",
          category: group.id,
          subcategory: sub.id,
          subcategoryLabel: sub.label,
        };
        const subLocation = routeLocation(subRoute, siteUrl);
        const subUrl = subLocation.pageUrl;
        pages.push({
          ...subLocation,
          lastmod,
          title: `قیمت ${sub.label} امروز | بنیان فولاد داریا`,
          description: `قیمت روز ${sub.label} از کارخانه‌های معتبر کشور. استعلام قیمت، مشخصات فنی و درخواست پیش‌فاکتور ${sub.label} با مشاوره تلفنی بنیان فولاد داریا.`,
          ogImage: groupOgImage,
          ogImageAlt: `قیمت روز ${sub.label} | بنیان فولاد داریا`,
          ogImageWidth: HERO_OG_IMAGE.width,
          ogImageHeight: HERO_OG_IMAGE.height,
          rootElement: React.createElement(App, {
            initialCategory: group.id,
            initialSubcategory: sub.id,
            initialSubcategoryLabel: sub.label,
          }),
          heroPreload,
          payloads: catalogPayloads,
          organizationData: null,
          breadcrumb: [homeCrumb, groupCrumb, { name: sub.label, url: subUrl }],
        });
      }
    }
  }

  // 3. Contact Page
  const contactLocation = routeLocation({ kind: "contact" }, siteUrl);
  const contactUrl = contactLocation.pageUrl;
  pages.push({
    ...contactLocation,
    lastmod: "2026-08-11",
    title: "تماس با ما و نشانی | بنیان فولاد داریا",
    description:
      "شماره‌های تماس، نشانی دفتر و مسیریابی روی نقشه برای بنیان فولاد داریا. تماس با واحد فروش و مدیریت برای استعلام قیمت آهن و فولاد.",
    rootElement: React.createElement(ContactPage),
    heroPreload: null,
    payloads: [],
    organizationData,
    breadcrumb: [homeCrumb, { name: "تماس با ما", url: contactUrl }],
  });

  // 4. Info Pages
  for (const [slug, definition] of Object.entries(infoPageDefinitions)) {
    const infoLocation = routeLocation({ kind: "info", page: slug }, siteUrl);
    const pageUrl = infoLocation.pageUrl;
    pages.push({
      ...infoLocation,
      lastmod: definition.lastmod,
      title: `${definition.title} | ${siteConfig.brand.name}`,
      description: definition.seoDescription,
      rootElement: React.createElement(InfoPage, { page: slug }),
      heroPreload: null,
      payloads: [],
      organizationData: null,
      breadcrumb: [homeCrumb, { name: definition.title, url: pageUrl }],
    });
  }

  // 5. Guide Index & Articles
  const guideIndexLocation = routeLocation({ kind: "guide" }, siteUrl);
  const guideIndexUrl = guideIndexLocation.pageUrl;
  const guideIndexCrumb = { name: guideIndex.title, url: guideIndexUrl };
  const guidePayloads = [{ id: "initial-guide-data", data: reference }];

  pages.push({
    ...guideIndexLocation,
    lastmod: guideIndex.lastmod,
    title: guideIndex.seoTitle,
    description: guideIndex.seoDescription,
    rootElement: React.createElement(GuidePage, {
      guide: undefined,
      reference,
    }),
    heroPreload: null,
    payloads: guidePayloads,
    organizationData: null,
    breadcrumb: [homeCrumb, guideIndexCrumb],
  });

  const guideImages = {
    "rebar-weight-chart": `${siteUrl}/categories/hero-rebar-1280.jpg`,
    "ribbed-vs-plain-rebar": `${siteUrl}/categories/hero-rebar-1280.jpg`,
    "beam-weight-chart": `${siteUrl}/categories/hero-beam-1280.jpg`,
    "ipe-vs-hash-beam": `${siteUrl}/categories/hero-beam-1280.jpg`,
    "units-and-quote-specs": `${siteUrl}/brand/bonyan-foulad-daria-logo.webp`,
  };

  // All five articles first entered Git in 5cf2282 on this date. The component
  // files added on 2026-08-22 only extracted that existing content.
  const guidePublishedOn = "2026-08-17";

  for (const key of guidePageKeys) {
    const definition = guidePageDefinitions[key];
    const guideLocation = routeLocation({ kind: "guide", guide: key }, siteUrl);
    const pageUrl = guideLocation.pageUrl;
    pages.push({
      ...guideLocation,
      lastmod: definition.lastmod,
      title: definition.seoTitle,
      description: definition.seoDescription,
      rootElement: React.createElement(GuidePage, { guide: key, reference }),
      heroPreload: null,
      payloads: guidePayloads,
      organizationData: null,
      // These five carry Article JSON-LD, so the Open Graph type has to agree.
      // The guide index above is a listing, and stays the template's "website".
      ogType: "article",
      extraHeadHtml: buildArticleJsonLd({
        headline: definition.title,
        description: definition.seoDescription,
        pageUrl,
        datePublished: guidePublishedOn,
        lastmod: definition.lastmod,
        siteUrl,
        image: guideImages[key],
      }),
      breadcrumb: [
        homeCrumb,
        guideIndexCrumb,
        { name: definition.title, url: pageUrl },
      ],
    });
  }

  return { pages, rootLastmod, siteUrl };
}
