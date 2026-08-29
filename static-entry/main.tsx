import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "../app/App";
import ContactPage from "../app/ContactPage";
import InfoPage from "../app/InfoPage";
import GuidePage from "../app/GuidePage";
import type { GuideReference } from "../app/steel-reference";
import { buildGuideReference } from "../app/steel-reference";
import { buildOrganizationStructuredData } from "../app/site-config";
import {
  loadCatalogSnapshot,
  primeCatalogReader,
} from "../app/catalog-reader";
import {
  interpretSiteRoute,
  isHeroRoute,
  isOrganizationRoute,
} from "../app/site-route";
import "../app/globals.css";

function readJsonScript(id: string) {
  const element = document.getElementById(id);
  if (!element?.textContent) return null;
  try {
    return JSON.parse(element.textContent);
  } catch {
    return null;
  }
}

document.documentElement.lang = "fa";
document.documentElement.dir = "rtl";

const root = document.getElementById("root");

if (!root) {
  throw new Error("React root element was not found.");
}
const rootElement = root;

primeCatalogReader({
  snapshot: readJsonScript("initial-page-data"),
  menu: readJsonScript("initial-menu-data"),
  overview: readJsonScript("initial-overview-data"),
});

// Derived reference tables for /guide/*, computed at build time so the page
// hydrates against exactly the bytes it was prerendered from.
const guideReference: GuideReference | null = readJsonScript("initial-guide-data");

const route = interpretSiteRoute({
  pathname: window.location.pathname,
  dataset: rootElement.dataset,
});

const heroPreloadLink = document.getElementById("hero-image-preload");
if (heroPreloadLink && !isHeroRoute(route)) {
  heroPreloadLink.remove();
}

const organizationJsonLd = document.getElementById(
  "organization-structured-data",
);
if (organizationJsonLd) {
  if (isOrganizationRoute(route)) {
    organizationJsonLd.textContent = JSON.stringify(
      buildOrganizationStructuredData(),
    );
  } else {
    organizationJsonLd.remove();
  }
}
async function resolveContent() {
  if (route.kind === "contact") return <ContactPage />;
  if (route.kind === "info") {
    return <InfoPage page={route.page} />;
  }
  if (route.kind === "guide") {
    // Production pages carry a build-time reference payload. The Vite
    // development server has no prerender step, so load the same validated
    // snapshots lazily instead of falling back to the homepage for /guide/*.
    const reference: GuideReference =
      guideReference ??
      (await loadCatalogSnapshot().then((snapshot) =>
        buildGuideReference(snapshot),
      ));
    return <GuidePage guide={route.guide} reference={reference} />;
  }

  return <App />;
}

function waitForWarmup(): Promise<void> {
  if (typeof window === "undefined" || window.location.pathname !== "/") {
    return Promise.resolve();
  }

  const globalScope = window as unknown as {
    __fbPreloaderDone?: boolean;
    __fbPreloaderWarmup?: boolean;
  };

  if (globalScope.__fbPreloaderDone || globalScope.__fbPreloaderWarmup) {
    return Promise.resolve();
  }

  try {
    if (
      window.sessionStorage.getItem("bonyan-foulad-daria-preloader-seen-v9") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return Promise.resolve();
    }
  } catch {
    // sessionStorage unavailable
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("fb:preloader-warmup", done);
      window.removeEventListener("fb:preloader-done", done);
      resolve();
    };

    window.addEventListener("fb:preloader-warmup", done, { once: true });
    window.addEventListener("fb:preloader-done", done, { once: true });
    window.setTimeout(done, 5000);
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue?: T,
): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<T | undefined>((resolve) => {
      window.setTimeout(() => resolve(fallbackValue), timeoutMs);
    }),
  ]);
}

async function whenFirstViewportReady(): Promise<void> {
  if (typeof window === "undefined") return;

  const checks: Promise<unknown>[] = [];

  // 1. Font loading check (Critical Tier 1 — 200ms budget to prevent FOIT/FOUT)
  if ("fonts" in document && typeof document.fonts.ready?.then === "function") {
    checks.push(withTimeout(document.fonts.ready.catch(() => {}), 200));
  }

  // 2. Hero image decode check (Critical Tier 1 — 800ms budget for primary canvas)
  const heroImg = document.querySelector<HTMLImageElement>(
    ".hero-image img, .hero-image picture img",
  );
  if (heroImg) {
    if (heroImg.complete && heroImg.naturalWidth > 0) {
      // Already decoded
    } else if (typeof heroImg.decode === "function") {
      checks.push(withTimeout(heroImg.decode().catch(() => {}), 800));
    } else {
      const imgPromise = new Promise<void>((resolve) => {
        heroImg.addEventListener("load", () => resolve(), { once: true });
        heroImg.addEventListener("error", () => resolve(), { once: true });
      });
      checks.push(withTimeout(imgPromise, 800));
    }
  }

  // 3. Header WebGL LightPillar (Atmospheric Enhancement Tier 2 — 250ms opportunistic budget)
  // If WebGL compiles quickly, it's included before reveal; if slow, fallback header styles display immediately
  const globalScope = window as unknown as { __fbHeaderPillarReady?: boolean };
  if (!globalScope.__fbHeaderPillarReady) {
    const pillarPromise = new Promise<void>((resolve) => {
      const onPillarReady = () => {
        window.removeEventListener("fb:header-pillar-ready", onPillarReady);
        resolve();
      };
      window.addEventListener("fb:header-pillar-ready", onPillarReady, { once: true });
    });
    checks.push(withTimeout(pillarPromise, 250));
  }

  await Promise.all(checks);
}

function signalSiteReady() {
  if (typeof window === "undefined") return;
  (window as unknown as { __fbSiteReady?: boolean }).__fbSiteReady = true;
  try {
    window.dispatchEvent(new CustomEvent("fb:site-ready"));
  } catch {
    // fallback
  }
}

async function mount() {
  await waitForWarmup();
  const content = await resolveContent();
  if (rootElement.hasChildNodes()) {
    hydrateRoot(rootElement, <StrictMode>{content}</StrictMode>);
  } else {
    createRoot(rootElement).render(<StrictMode>{content}</StrictMode>);
  }

  await whenFirstViewportReady();
  signalSiteReady();
}

void mount();
