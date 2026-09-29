import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
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
import { pagePayloadIds } from "../app/site-page";
import { pageElement } from "../app/site-page-element";
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

const root = document.getElementById("root");

if (!root) {
  throw new Error("React root element was not found.");
}
const rootElement = root;

primeCatalogReader({
  snapshot: readJsonScript(pagePayloadIds.catalog),
  menu: readJsonScript(pagePayloadIds.menu),
  overview: readJsonScript(pagePayloadIds.overview),
});

// Derived reference tables for /guide/*, computed at build time so the page
// hydrates against exactly the bytes it was prerendered from.
const guideReference: GuideReference | null = readJsonScript(
  pagePayloadIds.guide,
);

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
  // Production guide pages carry a build-time reference payload. The Vite
  // development server has no prerender step, so it loads the same validated
  // snapshot lazily instead of falling back to the homepage for /guide/*.
  const reference =
    route.kind === "guide" && !guideReference
      ? buildGuideReference(await loadCatalogSnapshot())
      : guideReference;
  return pageElement(route, { guideReference: reference });
}

/*
 * Hold hydration until the brand intro says it is safe to start work behind
 * it. `fb:preloader-warmup` is the only signal to wait for: the preloader
 * raises it on every path it can take -- including the ones where it skips the
 * video entirely -- and always before it tears the overlay down, which is what
 * it is waiting on us for in turn.
 */
function waitForWarmup(): Promise<void> {
  if (window.location.pathname !== "/") return Promise.resolve();

  const globalScope = window as unknown as { __fbPreloaderWarmup?: boolean };
  if (globalScope.__fbPreloaderWarmup) return Promise.resolve();

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
    window.addEventListener("fb:preloader-warmup", () => resolve(), {
      once: true,
    });
    // The preloader script can fail to load or run at all; nothing may ever
    // raise the signal, and the site still has to appear.
    window.setTimeout(resolve, 5000);
  });
}

/** Settle when `promise` does, or when its budget runs out -- whichever first. */
function withTimeout(promise: Promise<unknown>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}

async function whenFirstViewportReady(): Promise<void> {
  const checks: Promise<unknown>[] = [];

  // 1. Font loading check (Critical Tier 1 — 200ms budget to prevent FOIT/FOUT)
  checks.push(withTimeout(document.fonts.ready.catch(() => {}), 200));

  // 2. Hero image decode check (Critical Tier 1 — 800ms budget for primary canvas)
  const heroImg = document.querySelector<HTMLImageElement>(
    ".hero-image img, .hero-image picture img",
  );
  if (heroImg && !(heroImg.complete && heroImg.naturalWidth > 0)) {
    checks.push(withTimeout(heroImg.decode().catch(() => {}), 800));
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
  (window as unknown as { __fbSiteReady?: boolean }).__fbSiteReady = true;
  window.dispatchEvent(new CustomEvent("fb:site-ready"));
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
