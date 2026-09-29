import type { ReactElement } from "react";
import App from "./App";
import ContactPage from "./ContactPage";
import GuidePage from "./GuidePage";
import InfoPage from "./InfoPage";
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
 */
export function pageElement(
  route: SiteRoute,
  { guideReference }: { guideReference?: GuideReference | null } = {},
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
    case "contact":
      return <ContactPage />;
    case "info":
      return <InfoPage page={route.page} />;
    case "guide":
      if (!guideReference) {
        throw new Error("A guide page needs its reference tables to render.");
      }
      return <GuidePage guide={route.guide} reference={guideReference} />;
  }
}
