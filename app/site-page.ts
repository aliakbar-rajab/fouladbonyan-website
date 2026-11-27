import {
  catalogRedirectRules,
  getCategoryById,
  getSubcategoryLabel,
  isConsolidatedSubcategory,
  rendersCatalogOnGroupRoute,
  subcategoryHref,
  type ProductGroup,
  type ProductGroupId,
} from "./category-meta";
import type { GroupCatalog } from "./catalog-reader";
import { guideIndex, guidePageDefinitions } from "./guide-page-data";
import { infoPageDefinitions } from "./info-page-data";
import { siteConfig } from "./site-config";
import { siteRoutePath, type SiteRoute } from "./site-route";
import {
  getSubcategoryContent,
  type SubcategoryContentEntry,
} from "./subcategory-content";

/**
 * The Site page specification: everything a route *means* — its <title> and
 * meta description, hero copy, breadcrumb trail, structured-data inputs,
 * hydration payload ids, and permanent redirects — derived in one place so the
 * build pipeline, browser UI, and tests can never drift apart.
 */

export type PageHead = { title: string; description: string };

/** One step of a trail. `href` is the page's own path, the last step's too. */
export type PageCrumb = { label: string; href: string };

export type PageFaq = { question: string; answer: string };

export type CatalogPageHero = {
  label: string;
  h1: string;
  intro: string;
  image: string;
  breadcrumb: PageCrumb[];
};

export type PageCollectionItem = {
  name: string;
  url?: string;
};

export type PageArticleSpec = {
  headline: string;
  datePublished: string;
  lastmod: string;
  image: string;
};

export type PageSpec = {
  head: PageHead;
  breadcrumb: PageCrumb[];
  hero: CatalogPageHero | null;
  faqs: readonly PageFaq[];
  lastmod?: string;
  noindex: boolean;
  robots: string;
  ogType?: "article";
  ogImageAlt?: string;
  article?: PageArticleSpec;
  hasDataset: boolean;
};

export type SiteRedirectRoute = {
  fromPath: string[];
  toPath: string;
  toUrl: string;
  targetLabel: string;
};

/** The JSON <script> ids a prerendered page carries for hydration. */
export const pagePayloadIds = {
  /** The one catalog group a catalog page shows. */
  catalog: "initial-page-data",
  menu: "initial-menu-data",
  overview: "initial-overview-data",
  guide: "initial-guide-data",
} as const;

const CONTACT_LASTMOD = "2026-08-11";

type ResolvedCatalogPage = {
  group: ProductGroup;
  isDirectCatalog: boolean;
  subcategory?: { id: string; label: string };
  content?: SubcategoryContentEntry;
};

/**
 * Resolve a catalog route once, absorbing all consolidation rules
 * (/angle/, /channel/, /beam/) so head, hero, breadcrumb, FAQs, and
 * structured-data items all agree on which copy applies.
 */
function resolveCatalogPage(
  route: Extract<SiteRoute, { kind: "catalog" }>,
): ResolvedCatalogPage {
  const group = getCategoryById(route.category);
  if (!group) throw new Error(`Unknown catalog group: ${route.category}`);

  const isDirectCatalog = rendersCatalogOnGroupRoute(group.id);
  const subcategory =
    route.subcategory &&
    !isConsolidatedSubcategory(route.category, route.subcategory)
      ? {
          id: route.subcategory,
          label:
            route.subcategoryLabel ??
            getSubcategoryLabel(route.subcategory) ??
            route.subcategory,
        }
      : undefined;

  const contentSubcategoryId =
    subcategory?.id ?? (isDirectCatalog ? group.id : undefined);
  const content = contentSubcategoryId
    ? getSubcategoryContent(group.id, contentSubcategoryId)
    : undefined;

  return { group, isDirectCatalog, subcategory, content };
}

/**
 * True when a catalog route renders a price table directly rather than a
 * multi-subcategory overview hub (all subcategory routes plus consolidated
 * group routes like /beam/, /angle/, /channel/).
 */
export function isDirectCatalogRoute(route: SiteRoute): boolean {
  if (route.kind !== "catalog") return false;
  const resolved = resolveCatalogPage(route);
  return Boolean(resolved.subcategory) || resolved.isDirectCatalog;
}

/**
 * Subcategories of a group that own their own standalone URL (excluding
 * consolidated routes served directly on `/<group>/`).
 */
export function standaloneCatalogSubcategories<T extends { id: string }>(
  groupId: ProductGroupId,
  categories: readonly T[],
): T[] {
  return categories.filter((sub) => !isConsolidatedSubcategory(groupId, sub.id));
}

export function pageHead(route: SiteRoute): PageHead {
  switch (route.kind) {
    case "home":
      return siteConfig.home;
    case "catalog": {
      const { group, subcategory, content } = resolveCatalogPage(route);
      if (content) {
        return {
          title: content.seoTitle,
          description: content.seoDescription,
        };
      }
      if (subcategory) {
        return {
          title: `قیمت ${subcategory.label} امروز | ${siteConfig.brand.name}`,
          description: `قیمت روز ${subcategory.label} از کارخانه‌های معتبر کشور. استعلام قیمت، مشخصات فنی و درخواست پیش‌فاکتور ${subcategory.label} با مشاوره تلفنی ${siteConfig.brand.name}.`,
        };
      }
      if (!group.seoTitle || !group.seoDescription) {
        throw new Error(`Missing head metadata for catalog group: ${group.id}`);
      }
      return { title: group.seoTitle, description: group.seoDescription };
    }
    case "contact":
      return {
        title: `تماس با ما و نشانی | ${siteConfig.brand.name}`,
        description: `شماره‌های تماس، نشانی دفتر و مسیریابی روی نقشه برای ${siteConfig.brand.name}. تماس با واحد فروش و مدیریت برای استعلام قیمت آهن و فولاد.`,
      };
    case "info": {
      const definition = infoPageDefinitions[route.page];
      return {
        title: `${definition.title} | ${siteConfig.brand.name}`,
        description: definition.seoDescription,
      };
    }
    case "guide": {
      const definition = route.guide
        ? guidePageDefinitions[route.guide]
        : guideIndex;
      return {
        title: definition.seoTitle,
        description: definition.seoDescription,
      };
    }
  }
}

/** The trail from the homepage to this page; empty on the homepage itself. */
export function pageBreadcrumb(route: SiteRoute): PageCrumb[] {
  const home: PageCrumb = {
    label: "صفحه اصلی",
    href: siteRoutePath({ kind: "home" }),
  };
  const self = (label: string): PageCrumb => ({
    label,
    href: siteRoutePath(route),
  });

  switch (route.kind) {
    case "home":
      return [];
    case "catalog": {
      const { group, subcategory } = resolveCatalogPage(route);
      const groupCrumb: PageCrumb = {
        label: group.label,
        href: siteRoutePath({ kind: "catalog", category: group.id }),
      };
      return subcategory
        ? [home, groupCrumb, self(subcategory.label)]
        : [home, groupCrumb];
    }
    case "contact":
      return [home, self("تماس با ما")];
    case "info":
      return [home, self(infoPageDefinitions[route.page].title)];
    case "guide": {
      if (!route.guide) return [home, self(guideIndex.title)];
      return [
        home,
        { label: guideIndex.title, href: siteRoutePath({ kind: "guide" }) },
        self(guidePageDefinitions[route.guide].title),
      ];
    }
  }
}

/**
 * Hero presentation data for catalog pages (category hubs, consolidated routes,
 * and subcategory pages). Returns null for non-catalog routes.
 */
export function pageHero(route: SiteRoute): CatalogPageHero | null {
  if (route.kind !== "catalog") return null;
  const { group, subcategory, content } = resolveCatalogPage(route);
  const label = subcategory ? subcategory.label : group.label;
  const h1 = content
    ? content.h1
    : subcategory
      ? `قیمت روز ${subcategory.label}`
      : group.h1;
  const intro = content
    ? content.heroIntro
    : subcategory
      ? `استعلام قیمت روز ${subcategory.label} از کارخانه‌های معتبر کشور. برای دریافت پیش‌فاکتور، استعلام موجودی و مشاوره تخصصی خرید ${subcategory.label} با واحد فروش ${siteConfig.brand.name} تماس بگیرید.`
      : group.intro;

  if (!h1 || !intro) {
    throw new Error(`Missing hero copy for catalog group: ${group.id}`);
  }

  return {
    label,
    h1,
    intro,
    image: group.heroImage ?? group.image,
    breadcrumb: pageBreadcrumb(route),
  };
}

/** Visible FAQs for a route, mirrored into FAQPage JSON-LD by the build. */
export function pageFaqs(route: SiteRoute): readonly PageFaq[] {
  switch (route.kind) {
    case "catalog":
      return resolveCatalogPage(route).content?.faqs ?? [];
    case "guide":
      return (route.guide ? guidePageDefinitions[route.guide].faqs : undefined) ?? [];
    default:
      return [];
  }
}

/**
 * Structured-data ItemList entries for a catalog route's CollectionPage schema.
 * Handles overview hubs, consolidated primary pages (including sibling links
 * such as /beam/ -> /beam/hash/), and standalone subcategory pages uniformly.
 */
export function catalogCollectionItems(
  route: Extract<SiteRoute, { kind: "catalog" }>,
  catalog: Pick<GroupCatalog, "categories">,
  siteUrl = siteConfig.siteUrl,
): PageCollectionItem[] {
  const { group, isDirectCatalog, subcategory } = resolveCatalogPage(route);

  if (subcategory) {
    const sub = catalog.categories.find((entry) => entry.id === subcategory.id);
    return (sub?.factories ?? []).map((factory) => ({
      name: `قیمت ${sub!.label} ${factory.name}`,
    }));
  }

  if (isDirectCatalog) {
    const siblingLinks = standaloneCatalogSubcategories(
      group.id,
      catalog.categories,
    ).map((sub) => ({
      name: `قیمت ${sub.label}`,
      url: `${siteUrl}${subcategoryHref(group.id, sub.id)}`,
    }));
    const primary =
      catalog.categories.find((entry) => entry.id === group.id) ??
      catalog.categories[0];
    const primaryFactories = (primary?.factories ?? []).map((factory) => ({
      name: `قیمت ${primary!.label} ${factory.name}`,
    }));
    return [...siblingLinks, ...primaryFactories];
  }

  return catalog.categories.map((sub) => ({
    name: `قیمت ${sub.label}`,
    url: `${siteUrl}${subcategoryHref(group.id, sub.id)}`,
  }));
}

/** Complete page specification derived from a route alone. */
export function pageSpec(
  route: SiteRoute,
  { siteUrl = siteConfig.siteUrl }: { siteUrl?: string } = {},
): PageSpec {
  const head = pageHead(route);
  const breadcrumb = pageBreadcrumb(route);
  const hero = pageHero(route);
  const faqs = pageFaqs(route);

  switch (route.kind) {
    case "home":
      return {
        head,
        breadcrumb,
        hero,
        faqs,
        noindex: false,
        robots: "index, follow",
        hasDataset: false,
      };
    case "catalog": {
      const { group, subcategory } = resolveCatalogPage(route);
      return {
        head,
        breadcrumb,
        hero,
        faqs,
        noindex: false,
        robots: "index, follow",
        ogImageAlt: subcategory
          ? `قیمت روز ${subcategory.label} | ${siteConfig.brand.name}`
          : `قیمت ${group.label} | ${siteConfig.brand.name}`,
        hasDataset: false,
      };
    }
    case "contact":
      return {
        head,
        breadcrumb,
        hero,
        faqs,
        lastmod: CONTACT_LASTMOD,
        noindex: false,
        robots: "index, follow",
        hasDataset: false,
      };
    case "info": {
      const definition = infoPageDefinitions[route.page];
      const noindex = Boolean(definition.noindex);
      return {
        head,
        breadcrumb,
        hero,
        faqs,
        lastmod: definition.lastmod,
        noindex,
        robots: noindex ? "noindex, follow" : "index, follow",
        hasDataset: false,
      };
    }
    case "guide": {
      if (!route.guide) {
        return {
          head,
          breadcrumb,
          hero,
          faqs,
          lastmod: guideIndex.lastmod,
          noindex: false,
          robots: "index, follow",
          hasDataset: false,
        };
      }
      const definition = guidePageDefinitions[route.guide];
      return {
        head,
        breadcrumb,
        hero,
        faqs,
        lastmod: definition.lastmod,
        noindex: false,
        robots: "index, follow",
        ogType: "article",
        article: {
          headline: definition.title,
          datePublished: definition.publishedAt,
          lastmod: definition.lastmod,
          image: `${siteUrl}${definition.imagePath}`,
        },
        hasDataset: Boolean(definition.hasDataset),
      };
    }
  }
}

/** Permanent redirect stubs derived from catalogRedirectRules. */
export function siteRedirectRoutes(
  siteUrl = siteConfig.siteUrl,
): SiteRedirectRoute[] {
  return catalogRedirectRules.map((rule) => ({
    fromPath: rule.fromPath,
    toPath: rule.toPath,
    toUrl: `${siteUrl}${rule.toPath}`,
    targetLabel: rule.targetLabel,
  }));
}

/** Generated Cloudflare Pages `_redirects` file contents. */
export function buildRedirectsFile(): string {
  return (
    catalogRedirectRules
      .map((rule) => `/${rule.fromPath.join("/")}/ ${rule.toPath} 301`)
      .join("\n") + "\n"
  );
}
