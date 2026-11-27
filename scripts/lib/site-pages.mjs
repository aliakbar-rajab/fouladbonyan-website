import { productGroups } from "../../app/category-meta.ts";
import { guidePageKeys } from "../../app/guide-page-data.ts";
import { infoPageDefinitions } from "../../app/info-page-data.ts";
import {
  buildHomeGraphStructuredData,
  buildOrganizationStructuredData,
  siteConfig,
} from "../../app/site-config.ts";
import { loadGroupCatalog } from "../../app/catalog-reader.ts";
import {
  buildRedirectsFile,
  catalogCollectionItems,
  pagePayloadIds,
  pageSpec,
  siteRedirectRoutes,
  standaloneCatalogSubcategories,
} from "../../app/site-page.ts";
import { loadPageElement, routePageSource } from "../../app/site-page-element.tsx";
import {
  HERO_OG_IMAGE,
  buildArticleJsonLd,
  buildCatalogCollectionJsonLd,
  buildContactPageJsonLd,
  buildDatasetJsonLd,
  buildFaqJsonLd,
  buildHeroPreloadTag,
  routeLocation,
} from "./static-document.mjs";

/**
 * Which pages the site has, and what the build adds to each: lastmods, Open
 * Graph images, extra JSON-LD, hero preloads, and the data behind each
 * hydration payload. What a page *is* -- its title, description, trail,
 * structured-data inputs, redirects, root element and payload ids -- comes
 * from the Site page module (app/site-page.ts, app/site-page-element.tsx),
 * which the page components and the browser boot read too. This file says
 * nothing about how any of it becomes HTML -- static-document.mjs owns that --
 * so it can be called and asserted on without rendering or writing anything.
 */

/**
 * The shared parts of a descriptor, from the route: head, JSON-LD trail,
 * root element, the root's route attributes and where the page is written.
 */
async function describeRoute(route, siteUrl, { guideReference } = {}) {
  const spec = pageSpec(route, { siteUrl });
  return {
    spec,
    descriptor: {
      ...routeLocation(route, siteUrl),
      route,
      title: spec.head.title,
      description: spec.head.description,
      rootElement: await loadPageElement(route, { guideReference }),
      pageModuleSource: routePageSource(route),
      breadcrumb: spec.breadcrumb.map((crumb) => ({
        name: crumb.label,
        url: `${siteUrl}${crumb.href}`,
      })),
    },
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
  const organizationData = buildOrganizationStructuredData(siteUrl);
  const homeGraphData = buildHomeGraphStructuredData(siteUrl);
  const menuPayload = { id: pagePayloadIds.menu, data: menuCatalog };
  const describe = (route) => describeRoute(route, siteUrl);

  const pages = [];

  // 1. Homepage
  const { descriptor: homeDescriptor } = await describe({ kind: "home" });
  pages.push({
    ...homeDescriptor,
    lastmod: rootLastmod,
    heroPreload: undefined, // Preserves template default hero preload
    payloads: [
      menuPayload,
      { id: pagePayloadIds.overview, data: overviewSummaries },
    ],
    organizationData: homeGraphData,
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
    const groupRoute = { kind: "catalog", category: group.id };
    const { spec: groupSpec, descriptor: describedGroup } =
      await describe(groupRoute);
    pages.push({
      ...describedGroup,
      lastmod,
      ogImage: groupOgImage,
      ogImageAlt: groupSpec.ogImageAlt,
      ...ogImageSize,
      heroPreload,
      payloads: catalogPayloads,
      organizationData: null,
      extraHeadHtml: `${buildCatalogCollectionJsonLd({
        title: describedGroup.title,
        description: describedGroup.description,
        pageUrl: describedGroup.pageUrl,
        siteUrl,
        dateModified: catalog.fetchedAt,
        items: catalogCollectionItems(groupRoute, catalog, siteUrl),
      })}${groupSpec.faqs.length ? buildFaqJsonLd(groupSpec.faqs) : ""}`,
    });

    // Standalone subcategory pages (consolidated routes live on `/<group>/`).
    for (const sub of standaloneCatalogSubcategories(
      group.id,
      catalog.categories,
    )) {
      // Scope initial-page-data to the active subcategory's rows while
      // keeping lightweight category stubs so tab navigation renders identically
      // during SSR/hydration.
      const scopedCatalog = {
        ...catalog,
        categories: catalog.categories.map((entry) =>
          entry.id === sub.id
            ? entry
            : {
                ...entry,
                filters: { sizes: [], factories: [] },
                factories: [],
              },
        ),
      };
      const subcategoryPayloads = [
        menuPayload,
        {
          id: pagePayloadIds.catalog,
          data: {
            fetchedAt: snapshot.fetchedAt,
            sourceName: snapshot.sourceName,
            sourceHome: snapshot.sourceHome,
            taxRate: snapshot.taxRate,
            catalogs: [scopedCatalog],
          },
        },
      ];

      const subRoute = {
        kind: "catalog",
        category: group.id,
        subcategory: sub.id,
        subcategoryLabel: sub.label,
      };
      const { spec: subSpec, descriptor: describedSub } =
        await describe(subRoute);
      pages.push({
        ...describedSub,
        lastmod,
        ogImage: groupOgImage,
        ogImageAlt: subSpec.ogImageAlt,
        ...ogImageSize,
        heroPreload,
        payloads: subcategoryPayloads,
        organizationData: null,
        extraHeadHtml: `${buildCatalogCollectionJsonLd({
          title: describedSub.title,
          description: describedSub.description,
          pageUrl: describedSub.pageUrl,
          siteUrl,
          dateModified: catalog.fetchedAt,
          items: catalogCollectionItems(subRoute, catalog, siteUrl),
        })}${subSpec.faqs.length ? buildFaqJsonLd(subSpec.faqs) : ""}`,
      });
    }
  }

  // 3. Contact Page
  const { spec: contactSpec, descriptor: describedContact } = await describe({
    kind: "contact",
  });
  pages.push({
    ...describedContact,
    lastmod: contactSpec.lastmod,
    heroPreload: null,
    payloads: [menuPayload],
    organizationData,
    extraHeadHtml: buildContactPageJsonLd({
      title: describedContact.title,
      description: describedContact.description,
      pageUrl: describedContact.pageUrl,
      siteUrl,
    }),
  });

  // 4. Info Pages
  for (const page of Object.keys(infoPageDefinitions)) {
    const { spec, descriptor } = await describe({ kind: "info", page });
    pages.push({
      ...descriptor,
      lastmod: spec.lastmod,
      robots: spec.robots,
      noindex: spec.noindex,
      heroPreload: null,
      payloads: [menuPayload],
      organizationData: null,
    });
  }

  // 5. Guide Index & Articles
  const guidePayloads = [menuPayload, { id: pagePayloadIds.guide, data: reference }];
  const describeGuide = (route) =>
    describeRoute(route, siteUrl, { guideReference: reference });

  const { spec: guideIndexSpec, descriptor: guideIndexDescriptor } =
    await describeGuide({ kind: "guide" });
  pages.push({
    ...guideIndexDescriptor,
    lastmod: guideIndexSpec.lastmod,
    heroPreload: null,
    payloads: guidePayloads,
    organizationData: null,
  });

  for (const key of guidePageKeys) {
    const { spec, descriptor: described } = await describeGuide({
      kind: "guide",
      guide: key,
    });
    const datasetSchema = spec.hasDataset
      ? buildDatasetJsonLd({
          name: spec.article.headline,
          description: described.description,
          url: described.pageUrl,
          dateModified: snapshot.fetchedAt,
          siteUrl,
        })
      : "";
    const faqSchema = spec.faqs.length ? buildFaqJsonLd(spec.faqs) : "";
    pages.push({
      ...described,
      lastmod: spec.lastmod,
      heroPreload: null,
      payloads: guidePayloads,
      organizationData: null,
      ogType: spec.ogType,
      extraHeadHtml: `${buildArticleJsonLd({
        headline: spec.article.headline,
        description: described.description,
        pageUrl: described.pageUrl,
        datePublished: spec.article.datePublished,
        lastmod: spec.article.lastmod,
        siteUrl,
        image: spec.article.image,
      })}${datasetSchema}${faqSchema}`,
    });
  }

  return {
    pages,
    rootLastmod,
    siteUrl,
    redirectRoutes: siteRedirectRoutes(siteUrl),
    redirectsText: buildRedirectsFile(),
  };
}
