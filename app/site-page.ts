import {
  getCategoryById,
  getSubcategoryLabel,
  isSingleSubcategoryGroup,
} from "./category-meta";
import { guideIndex, guidePageDefinitions } from "./guide-page-data";
import { infoPageDefinitions } from "./info-page-data";
import { siteConfig } from "./site-config";
import { siteRoutePath, type SiteRoute } from "./site-route";

/**
 * The Site page: what a page of the site is, apart from how it is rendered.
 * Its <title> and meta description, its breadcrumb trail, and the ids of the
 * JSON payloads it hydrates from -- each worked out from the route alone.
 *
 * These used to be written twice: once in the build's page catalogue
 * (scripts/lib/site-pages.mjs), and again in each page (the title it set on
 * hydration, the trail it drew), with only a comment asking the two to agree.
 * The contact page did not -- it retitled itself the moment it hydrated -- and
 * the visible trail and the BreadcrumbList JSON-LD were two separate lists.
 * The build and the pages now both ask this module, so they cannot disagree.
 */

export type PageHead = { title: string; description: string };

/** One step of a trail. `href` is the page's own path, the last step's too. */
export type PageCrumb = { label: string; href: string };

/** The JSON <script> ids a prerendered page carries for hydration. */
export const pagePayloadIds = {
  /** The one catalog group a catalog page shows. */
  catalog: "initial-page-data",
  menu: "initial-menu-data",
  overview: "initial-overview-data",
  guide: "initial-guide-data",
} as const;

/**
 * A single-category group (angle, channel) is its category page; there is no
 * separate subcategory page to title or trail to.
 */
function catalogPage(route: Extract<SiteRoute, { kind: "catalog" }>) {
  const group = getCategoryById(route.category);
  if (!group) throw new Error(`Unknown catalog group: ${route.category}`);
  const subcategory =
    route.subcategory && !isSingleSubcategoryGroup(route.category)
      ? {
          id: route.subcategory,
          label:
            route.subcategoryLabel ??
            getSubcategoryLabel(route.subcategory) ??
            route.subcategory,
        }
      : undefined;
  return { group, subcategory };
}

export function pageHead(route: SiteRoute): PageHead {
  switch (route.kind) {
    case "home":
      return siteConfig.home;
    case "catalog": {
      const { group, subcategory } = catalogPage(route);
      if (!subcategory) {
        return { title: group.seoTitle, description: group.seoDescription };
      }
      return {
        title: `قیمت ${subcategory.label} امروز | ${siteConfig.brand.name}`,
        description: `قیمت روز ${subcategory.label} از کارخانه‌های معتبر کشور. استعلام قیمت، مشخصات فنی و درخواست پیش‌فاکتور ${subcategory.label} با مشاوره تلفنی ${siteConfig.brand.name}.`,
      };
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
  const home: PageCrumb = { label: "صفحه اصلی", href: siteRoutePath({ kind: "home" }) };
  const self = (label: string): PageCrumb => ({ label, href: siteRoutePath(route) });

  switch (route.kind) {
    case "home":
      return [];
    case "catalog": {
      const { group, subcategory } = catalogPage(route);
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
