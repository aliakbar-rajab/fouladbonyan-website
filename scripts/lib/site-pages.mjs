import { isSingleSubcategoryGroup, productGroups } from "../../app/category-meta.ts";
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
  pageBreadcrumb,
  pageHead,
  pagePayloadIds,
} from "../../app/site-page.ts";
import { loadPageElement, routePageSource } from "../../app/site-page-element.tsx";
import {
  HERO_OG_IMAGE,
  buildArticleJsonLd,
  buildHeroPreloadTag,
  buildWebSiteJsonLd,
  routeLocation,
} from "./static-document.mjs";

/**
 * Which pages the site has, and what the build adds to each: lastmods, Open
 * Graph images, extra JSON-LD, hero preloads, and the data behind each
 * hydration payload. What a page *is* -- its title, description, trail, root
 * element and payload ids -- comes from the Site page module
 * (app/site-page.ts, app/site-page-element.tsx), which the page components and
 * the browser boot read too. This file says nothing about how any of it
 * becomes HTML -- static-document.mjs owns that -- so it can be called and
 * asserted on without rendering or writing anything.
 */

/**
 * The shared parts of a descriptor, from the route: head, JSON-LD trail,
 * root element, the root's route attributes and where the page is written.
 */
async function describeRoute(route, siteUrl, { guideReference } = {}) {
  const head = pageHead(route);
  return {
    ...routeLocation(route, siteUrl),
    route,
    title: head.title,
    description: head.description,
    rootElement: await loadPageElement(route, { guideReference }),
    pageModuleSource: routePageSource(route),
    breadcrumb: pageBreadcrumb(route).map((crumb) => ({
      name: crumb.label,
      url: `${siteUrl}${crumb.href}`,
    })),
  };
}

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
  const menuPayload = { id: pagePayloadIds.menu, data: menuCatalog };
  const describe = (route) => describeRoute(route, siteUrl);

  const pages = [];

  // 1. Homepage
  pages.push({
    ...(await describe({ kind: "home" })),
    lastmod: rootLastmod,
    heroPreload: undefined, // Preserves template default hero preload
    payloads: [
      menuPayload,
      { id: pagePayloadIds.overview, data: overviewSummaries },
    ],
    organizationData: null,
    extraHeadHtml: buildWebSiteJsonLd({ siteUrl }),
  });

  // 2. Category Landing Pages & Subcategories
  for (const group of productGroups) {
    const catalog = await loadGroupCatalog(group.id);
    const lastmod = catalog.fetchedAt.slice(0, 10);
    const heroPreload = buildHeroPreloadTag(group);

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
      { id: pagePayloadIds.catalog, data: groupSnapshot },
    ];
    const groupOgImage = `${siteUrl}/categories/hero-${group.id}-${HERO_OG_IMAGE.variant}.jpg`;
    const ogImageSize = {
      ogImageWidth: HERO_OG_IMAGE.width,
      ogImageHeight: HERO_OG_IMAGE.height,
    };

    // Category landing page
    pages.push({
      ...(await describe({ kind: "catalog", category: group.id })),
      lastmod,
      ogImage: groupOgImage,
      ogImageAlt: `قیمت ${group.label} | ${siteConfig.brand.name}`,
      ...ogImageSize,
      heroPreload,
      payloads: catalogPayloads,
      organizationData: null,
    });

    // Subcategory pages: single-subcategory families (angle, channel)
    // are consolidated onto their parent category page.
    if (!isSingleSubcategoryGroup(group.id)) {
      for (const sub of catalog.categories) {
        pages.push({
          ...(await describe({
            kind: "catalog",
            category: group.id,
            subcategory: sub.id,
            subcategoryLabel: sub.label,
          })),
          lastmod,
          ogImage: groupOgImage,
          ogImageAlt: `قیمت روز ${sub.label} | ${siteConfig.brand.name}`,
          ...ogImageSize,
          heroPreload,
          payloads: catalogPayloads,
          organizationData: null,
        });
      }
    }
  }

  // 3. Contact Page
  pages.push({
    ...(await describe({ kind: "contact" })),
    lastmod: "2026-08-11",
    heroPreload: null,
    payloads: [],
    organizationData,
  });

  // 4. Info Pages
  for (const [page, definition] of Object.entries(infoPageDefinitions)) {
    pages.push({
      ...(await describe({ kind: "info", page })),
      lastmod: definition.lastmod,
      heroPreload: null,
      payloads: [],
      organizationData: null,
    });
  }

  // 5. Guide Index & Articles
  const guidePayloads = [{ id: pagePayloadIds.guide, data: reference }];
  const describeGuide = (route) =>
    describeRoute(route, siteUrl, { guideReference: reference });

  pages.push({
    ...(await describeGuide({ kind: "guide" })),
    lastmod: guideIndex.lastmod,
    heroPreload: null,
    payloads: guidePayloads,
    organizationData: null,
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
    const described = await describeGuide({ kind: "guide", guide: key });
    pages.push({
      ...described,
      lastmod: definition.lastmod,
      heroPreload: null,
      payloads: guidePayloads,
      organizationData: null,
      // These five carry Article JSON-LD, so the Open Graph type has to agree.
      // The guide index above is a listing, and stays the template's "website".
      ogType: "article",
      extraHeadHtml: buildArticleJsonLd({
        headline: definition.title,
        description: described.description,
        pageUrl: described.pageUrl,
        datePublished: guidePublishedOn,
        lastmod: definition.lastmod,
        siteUrl,
        image: guideImages[key],
      }),
    });
  }

  return { pages, rootLastmod, siteUrl };
}
