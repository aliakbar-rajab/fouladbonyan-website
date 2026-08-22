import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "../app/App";
import ContactPage from "../app/ContactPage";
import InfoPage from "../app/InfoPage";
import GuidePage from "../app/GuidePage";
import { type InfoPageKey } from "../app/info-page-data";
import { isGuidePageKey } from "../app/guide-page-data";
import type { GuideReference } from "../app/steel-reference";
import { buildGuideReference } from "../app/steel-reference";
import { buildOrganizationStructuredData } from "../app/site-config";
import { primeCatalogSnapshot } from "../app/group-catalog";
import { loadBeamPriceData, loadRebarPriceData } from "../app/catalog-data";
import { loadProductPricePayload } from "../app/product-price-data";
import { loadOverviewSummaries } from "../app/catalog-overview";
import { setMenuCatalog } from "../app/menu-catalog";
import { readJsonScript } from "../app/read-json-script";
import "../app/globals.css";

document.documentElement.lang = "fa";
document.documentElement.dir = "rtl";

const root = document.getElementById("root");

if (!root) {
  throw new Error("React root element was not found.");
}
const rootElement = root;

primeCatalogSnapshot(readJsonScript("initial-page-data"));

// Derived reference tables for /guide/*, computed at build time so the page
// hydrates against exactly the bytes it was prerendered from.
const guideReference: GuideReference | null = readJsonScript("initial-guide-data");

// The mega menu renders from this, so it has to be seeded before hydrateRoot:
// seeding it later would leave the client's first render showing the loading
// state against a server-rendered menu, which is a hydration mismatch.
const menuCatalog = readJsonScript("initial-menu-data");
if (menuCatalog) {
  setMenuCatalog(menuCatalog);
}

const overviewData = readJsonScript("initial-overview-data");
if (overviewData) {
  loadOverviewSummaries.setCached(overviewData);
}

const pathSegments = window.location.pathname
  .replace(/^\/|\/$/g, "")
  .toLowerCase()
  .split("/")
  .filter(Boolean);
const pageName = rootElement.dataset.page || pathSegments[0] || "";
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

async function resolveContent() {
  if (pageName === "contact") return <ContactPage />;
  if (infoPages.has(pageName as InfoPageKey)) {
    return <InfoPage page={pageName as InfoPageKey} />;
  }
  if (pageName === "guide") {
    // Production pages carry a build-time reference payload. The Vite
    // development server has no prerender step, so load the same validated
    // snapshots lazily instead of falling back to the homepage for /guide/*.
    const reference =
      guideReference ??
      buildGuideReference(
        ...(await Promise.all([
          loadRebarPriceData(),
          loadBeamPriceData(),
          loadProductPricePayload(),
        ])),
      );
    const requested = rootElement.dataset.guide || pathSegments[1] || "";
    return (
      <GuidePage
        guide={isGuidePageKey(requested) ? requested : undefined}
        reference={reference}
      />
    );
  }
  return <App />;
}

async function mount() {
  const content = await resolveContent();
  if (rootElement.hasChildNodes()) {
    hydrateRoot(rootElement, <StrictMode>{content}</StrictMode>);
  } else {
    createRoot(rootElement).render(<StrictMode>{content}</StrictMode>);
  }
}

void mount();
