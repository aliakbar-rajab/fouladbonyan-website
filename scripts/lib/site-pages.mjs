import {
  isConsolidatedSubcategory,
  isSingleSubcategoryGroup,
  productGroups,
  subcategoryHref,
} from "../../app/category-meta.ts";
import {
  REBAR_WEIGHT_FAQS,
  guideIndex,
  guidePageDefinitions,
  guidePageKeys,
} from "../../app/guide-page-data.ts";
import { infoPageDefinitions } from "../../app/info-page-data.ts";
import {
  buildHomeGraphStructuredData,
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
import { getSubcategoryContent } from "../../app/subcategory-content.ts";
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
  const organizationData = buildOrganizationStructuredData(siteUrl);
  const homeGraphData = buildHomeGraphStructuredData(siteUrl);
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

    const singleGroup = isSingleSubcategoryGroup(group.id);
    const onlySubcategory = singleGroup ? catalog.categories[0] : null;
    const primaryBeam =
      group.id === "beam"
        ? catalog.categories.find((c) => c.id === "beam") ?? catalog.categories[0]
        : null;
    const overviewItems = singleGroup
      ? (onlySubcategory?.factories ?? []).map((factory) => ({
          name: `قیمت ${onlySubcategory.label} ${factory.name}`,
        }))
      : group.id === "beam" && primaryBeam
        ? [
            {
              name: "قیمت تیرآهن هاش",
              url: `${siteUrl}${subcategoryHref("beam", "hash")}`,
            },
            ...primaryBeam.factories.map((factory) => ({
              name: `قیمت ${primaryBeam.label} ${factory.name}`,
            })),
          ]
        : catalog.categories.map((sub) => ({
            name: `قیمت ${sub.label}`,
            url: `${siteUrl}${subcategoryHref(group.id, sub.id)}`,
          }));

    // Category landing page
    const describedGroup = await describe({
      kind: "catalog",
      category: group.id,
    });
    pages.push({
      ...describedGroup,
      lastmod,
      ogImage: groupOgImage,
      ogImageAlt: `قیمت ${group.label} | ${siteConfig.brand.name}`,
      ...ogImageSize,
      heroPreload,
      payloads: catalogPayloads,
      organizationData: null,
      extraHeadHtml: buildCatalogCollectionJsonLd({
        title: describedGroup.title,
        description: describedGroup.description,
        pageUrl: describedGroup.pageUrl,
        siteUrl,
        dateModified: catalog.fetchedAt,
        items: overviewItems,
      }),
    });

    // Subcategory pages: consolidated routes (angle, channel, and beam IPE)
    // live on their parent group URL rather than a duplicated subcategory slug.
    if (!singleGroup) {
      for (const sub of catalog.categories) {
        if (isConsolidatedSubcategory(group.id, sub.id)) continue;
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

        const describedSub = await describe({
          kind: "catalog",
          category: group.id,
          subcategory: sub.id,
          subcategoryLabel: sub.label,
        });
        const subContent = getSubcategoryContent(group.id, sub.id);
        pages.push({
          ...describedSub,
          lastmod,
          ogImage: groupOgImage,
          ogImageAlt: `قیمت روز ${sub.label} | ${siteConfig.brand.name}`,
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
            items: sub.factories.map((factory) => ({
              name: `قیمت ${sub.label} ${factory.name}`,
            })),
          })}${subContent?.faqs.length ? buildFaqJsonLd(subContent.faqs) : ""}`,
        });
      }
    }
  }

  // 3. Contact Page
  const describedContact = await describe({ kind: "contact" });
  pages.push({
    ...describedContact,
    lastmod: "2026-08-11",
    heroPreload: null,
    payloads: [],
    organizationData,
    extraHeadHtml: buildContactPageJsonLd({
      title: describedContact.title,
      description: describedContact.description,
      pageUrl: describedContact.pageUrl,
      siteUrl,
    }),
  });

  // 4. Info Pages
  for (const [page, definition] of Object.entries(infoPageDefinitions)) {
    const isNoindex = Boolean(definition.noindex);
    pages.push({
      ...(await describe({ kind: "info", page })),
      lastmod: definition.lastmod,
      robots: isNoindex ? "noindex, follow" : "index, follow",
      noindex: isNoindex,
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
    const rebarWeightSchemas =
      key === "rebar-weight-chart"
        ? `${buildDatasetJsonLd({
            name: definition.title,
            description: described.description,
            url: described.pageUrl,
            dateModified: snapshot.fetchedAt,
            siteUrl,
          })}${buildFaqJsonLd(REBAR_WEIGHT_FAQS)}`
        : "";
    pages.push({
      ...described,
      lastmod: definition.lastmod,
      heroPreload: null,
      payloads: guidePayloads,
      organizationData: null,
      // These five carry Article JSON-LD, so the Open Graph type has to agree.
      // The guide index above is a listing, and stays the template's "website".
      ogType: "article",
      extraHeadHtml: `${buildArticleJsonLd({
        headline: definition.title,
        description: described.description,
        pageUrl: described.pageUrl,
        datePublished: guidePublishedOn,
        lastmod: definition.lastmod,
        siteUrl,
        image: guideImages[key],
      })}${rebarWeightSchemas}`,
    });
  }

  return { pages, rootLastmod, siteUrl };
}
