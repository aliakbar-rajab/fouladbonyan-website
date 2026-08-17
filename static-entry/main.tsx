import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "../app/App";
import ContactPage from "../app/ContactPage";
import InfoPage from "../app/InfoPage";
import { type InfoPageKey } from "../app/info-page-data";
import { buildOrganizationStructuredData } from "../app/site-config";
import { loadBeamPriceData, loadRebarPriceData } from "../app/catalog-data";
import { loadProductPricePayload } from "../app/product-price-data";
import { loadOverviewSummaries } from "../app/catalog-overview";
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

const initialOverviewEl = document.getElementById("initial-overview-data");
if (initialOverviewEl?.textContent) {
  try {
    const overviewData = JSON.parse(initialOverviewEl.textContent);
    loadOverviewSummaries.setCached(overviewData);
  } catch {
    // Ignore invalid JSON
  }
}

const pageFromPath = window.location.pathname
  .replace(/^\/|\/$/g, "")
  .toLowerCase();
const pageName = root.dataset.page || pageFromPath;
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
}

if (root.hasChildNodes()) {
  hydrateRoot(root, <StrictMode>{content}</StrictMode>);
} else {
  createRoot(root).render(<StrictMode>{content}</StrictMode>);
}

