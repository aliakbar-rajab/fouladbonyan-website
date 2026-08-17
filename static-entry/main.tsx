import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../app/App";
import ContactPage from "../app/ContactPage";
import InfoPage from "../app/InfoPage";
import { type InfoPageKey } from "../app/info-page-data";
import { buildOrganizationStructuredData } from "../app/site-config";
import "../app/globals.css";

document.documentElement.lang = "fa";
document.documentElement.dir = "rtl";

const root = document.getElementById("root");

if (!root) {
  throw new Error("React root element was not found.");
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

createRoot(root).render(<StrictMode>{content}</StrictMode>);
