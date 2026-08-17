import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "../app/App";
import ContactPage from "../app/ContactPage";
import InfoPage from "../app/InfoPage";
import GuidePage from "../app/GuidePage";
import { type InfoPageKey } from "../app/info-page-data";
import { isGuidePageKey } from "../app/guide-page-data";
import type { GuideReference } from "../app/steel-reference";
import { buildOrganizationStructuredData } from "../app/site-config";
import { loadBeamPriceData, loadRebarPriceData } from "../app/catalog-data";
import { loadProductPricePayload } from "../app/product-price-data";
import { loadOverviewSummaries } from "../app/catalog-overview";
import { setMenuCatalog } from "../app/menu-catalog";
import "../app/globals.css";

document.documentElement.lang = "fa";
document.documentElement.dir = "rtl";

const root = document.getElementById("root");

if (!root) {
  throw new Error("React root element was not found.");
}

const initialDataEl = document.getElementById("initial-page-data");
if (initialDataEl?.textContent) {
  try {
    const { type, data } = JSON.parse(initialDataEl.textContent);
    if (type === "rebar") {
      loadRebarPriceData.setCached(data);
    } else if (type === "beam") {
      loadBeamPriceData.setCached(data);
    } else if (type === "product") {
      loadProductPricePayload.setCached(data);
    }
  } catch {
    // Ignore invalid JSON
  }
}

// Derived reference tables for /guide/*, computed at build time so the page
// hydrates against exactly the bytes it was prerendered from.
let guideReference: GuideReference | null = null;
const initialGuideEl = document.getElementById("initial-guide-data");
if (initialGuideEl?.textContent) {
  try {
    guideReference = JSON.parse(initialGuideEl.textContent) as GuideReference;
  } catch {
    // Ignore invalid JSON
  }
}

// The mega menu renders from this, so it has to be seeded before hydrateRoot:
// seeding it later would leave the client's first render showing the loading
// state against a server-rendered menu, which is a hydration mismatch.
const initialMenuEl = document.getElementById("initial-menu-data");
if (initialMenuEl?.textContent) {
  try {
    setMenuCatalog(JSON.parse(initialMenuEl.textContent));
  } catch {
    // Ignore invalid JSON
  }
}

const initialOverviewEl = document.getElementById("initial-overview-data");
if (initialOverviewEl?.textContent) {
  try {
    const overviewData = JSON.parse(initialOverviewEl.textContent);
    loadOverviewSummaries.setCached(overviewData);
  } catch {
    // Ignore invalid JSON
  }
}

const pathSegments = window.location.pathname
  .replace(/^\/|\/$/g, "")
  .toLowerCase()
  .split("/")
  .filter(Boolean);
const pageName = root.dataset.page || pathSegments[0] || "";
const isOrganizationPage = !pageName || pageName === "about";

const organizationJsonLd = document.getElementById(
  "organization-structured-data",
);
if (organizationJsonLd) {
  if (isOrganizationPage) {
    organizationJsonLd.textContent = JSON.stringify(
      buildOrganizationStructuredData(),
    );
  } else {
    organizationJsonLd.remove();
  }
}
const infoPages = new Set<InfoPageKey>([
  "about",
  "terms",
  "privacy",
  "quote-process",
  "complaints",
  "shipping-delivery",
]);

let content = <App />;
if (pageName === "contact") {
  content = <ContactPage />;
} else if (infoPages.has(pageName as InfoPageKey)) {
  content = <InfoPage page={pageName as InfoPageKey} />;
} else if (pageName === "guide" && guideReference) {
  // Without the prerendered reference payload there is nothing to hydrate
  // against, so fall through to <App /> rather than render an empty guide.
  const requested = root.dataset.guide || pathSegments[1] || "";
  content = (
    <GuidePage
      guide={isGuidePageKey(requested) ? requested : undefined}
      reference={guideReference}
    />
  );
}

if (root.hasChildNodes()) {
  hydrateRoot(root, <StrictMode>{content}</StrictMode>);
} else {
  createRoot(root).render(<StrictMode>{content}</StrictMode>);
}

