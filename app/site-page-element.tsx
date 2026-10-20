import type { ReactElement } from "react";
import App from "./App";
import type { SiteRoute } from "./site-route";
import type { GuideReference } from "./steel-reference";

/**
 * The React tree a route renders: the one switch the prerender, the browser
 * boot and the hydration test all use.
 *
 * There were three -- the build's page catalogue, static-entry/main.tsx and a
 * copy inside tests/helpers/hydrate-route.mjs -- and they did not agree on how
 * a catalog page learns which catalog it is. The build passed it as props; the
 * browser rendered a bare <App /> that went back to the DOM for it. One switch
 * means the element the server rendered and the element the browser hydrates
 * are built by the same call, from the same route.
 *
 * Kept apart from site-page.ts because the pages import that module for their
 * own titles and trails, and this one imports the pages.
 *
 * The homepage and the catalog pages -- most of the site's traffic -- are the
 * App, which ships in the main bundle. The contact, info (including the quote
 * form) and guide pages are loaded only on their own routes: the browser boot
 * awaits `loadRoutePages` before hydrating, and the prerendered HTML stays on
 * screen meanwhile, so nothing flashes. The prerender adds a modulepreload for
 * the route's chunk (`routePageSource`), so it downloads alongside the bundle.
 */

export type RoutePages = {
  ContactPage?: typeof import("./ContactPage").default;
  InfoPage?: typeof import("./InfoPage").default;
  GuidePage?: typeof import("./GuidePage").default;
};

/**
 * The page component a route needs beyond the App, loaded on demand. Resolves
 * to nothing for the homepage and catalog pages.
 */
export async function loadRoutePages(route: SiteRoute): Promise<RoutePages> {
  switch (route.kind) {
    case "home":
    case "catalog":
      return {};
    case "contact":
      return { ContactPage: (await import("./ContactPage")).default };
    case "info":
      return { InfoPage: (await import("./InfoPage")).default };
    case "guide":
      return { GuidePage: (await import("./GuidePage")).default };
  }
}

/**
 * The source module behind each lazily loaded page, as Vite's build manifest
 * names it -- what the prerender looks up to preload a route's chunk.
 */
export function routePageSource(route: SiteRoute): string | null {
  switch (route.kind) {
    case "home":
    case "catalog":
      return null;
    case "contact":
      return "app/ContactPage.tsx";
    case "info":
      return "app/InfoPage.tsx";
    case "guide":
      return "app/GuidePage.tsx";
  }
}

function required<T>(page: T | undefined, name: string): T {
  if (!page) {
    throw new Error(`${name} is not loaded; await loadRoutePages(route) first.`);
  }
  return page;
}

export function pageElement(
  route: SiteRoute,
  {
    guideReference,
    pages = {},
  }: { guideReference?: GuideReference | null; pages?: RoutePages } = {},
): ReactElement {
  switch (route.kind) {
    case "home":
      return <App />;
    case "catalog":
      return (
        <App
          initialCategory={route.category}
          initialSubcategory={route.subcategory}
          initialSubcategoryLabel={route.subcategoryLabel}
        />
      );
    case "contact": {
      const ContactPage = required(pages.ContactPage, "ContactPage");
      return <ContactPage />;
    }
    case "info": {
      const InfoPage = required(pages.InfoPage, "InfoPage");
      return <InfoPage page={route.page} />;
    }
    case "guide": {
      if (!guideReference) {
        throw new Error("A guide page needs its reference tables to render.");
      }
      const GuidePage = required(pages.GuidePage, "GuidePage");
      return <GuidePage guide={route.guide} reference={guideReference} />;
    }
  }
}

/** `pageElement`, after loading whatever page component the route needs. */
export async function loadPageElement(
  route: SiteRoute,
  options: { guideReference?: GuideReference | null } = {},
): Promise<ReactElement> {
  return pageElement(route, { ...options, pages: await loadRoutePages(route) });
}
