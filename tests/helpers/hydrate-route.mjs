/**
 * Hydrates one built page from dist/ inside a fresh jsdom window in-process
 * and reports what React had to recover from.
 *
 * Resets the catalog-reader store before and after each route so checking
 * several routes in one Node process keeps the same isolation as separate
 * processes: an earlier route can never prime a snapshot, menu, or overview
 * payload that a later route is supposed to be missing.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const projectDir = resolve(import.meta.dirname, "..", "..");

let runtimePromise;

function installDomGlobals(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.Node = dom.window.Node;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame;

  dom.window.Element.prototype.scrollIntoView = () => {};
  // LightPillar asks for a WebGL context; jsdom has no canvas backend and the
  // component already no-ops without one.
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  dom.window.matchMedia = (query) => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

function loadRuntime() {
  runtimePromise ??= Promise.all([
    import("react-dom/client"),
    import("../../app/catalog-reader.ts"),
    import("../../app/site-route.ts"),
    import("../../app/site-page.ts"),
    import("../../app/site-page-element.tsx"),
  ]).then(
    ([reactDom, catalogReader, siteRoute, sitePage, sitePageElement]) => ({
      hydrateRoot: reactDom.hydrateRoot,
      primeCatalogReader: catalogReader.primeCatalogReader,
      resetCatalogReader: catalogReader.resetCatalogReader,
      interpretSiteRoute: siteRoute.interpretSiteRoute,
      pagePayloadIds: sitePage.pagePayloadIds,
      loadPageElement: sitePageElement.loadPageElement,
    }),
  );
  return runtimePromise;
}

function readJsonScript(id) {
  const element = document.getElementById(id);
  if (!element?.textContent) return null;
  try {
    return JSON.parse(element.textContent);
  } catch {
    return null;
  }
}

export async function hydrateRoute(route = "") {
  const html = await readFile(
    resolve(projectDir, "dist", route, "index.html"),
    "utf8",
  );

  const dom = new JSDOM(html, {
    url: `https://fouladbonyan.com/${route}${route ? "/" : ""}`,
    pretendToBeVisual: true,
  });
  installDomGlobals(dom);

  const {
    hydrateRoot,
    primeCatalogReader,
    resetCatalogReader,
    interpretSiteRoute,
    pagePayloadIds,
    loadPageElement,
  } = await loadRuntime();

  const consoleErrors = [];
  const recoverable = [];
  const realConsoleError = console.error;
  let reactRoot;

  console.error = (...args) => {
    consoleErrors.push(
      args.map((arg) => (arg?.stack ? arg.stack : String(arg))).join("\n"),
    );
  };

  try {
    resetCatalogReader();

    const root = document.getElementById("root");

    // The same steps, in the same order, as static-entry/main.tsx -- the route
    // and the element come from the modules the browser boot uses, not a copy.
    primeCatalogReader({
      snapshot: readJsonScript(pagePayloadIds.catalog),
      menu: readJsonScript(pagePayloadIds.menu),
      overview: readJsonScript(pagePayloadIds.overview),
    });

    const element = await loadPageElement(
      interpretSiteRoute({
        pathname: window.location.pathname,
        dataset: root.dataset,
      }),
      { guideReference: readJsonScript(pagePayloadIds.guide) },
    );

    reactRoot = hydrateRoot(root, element, {
      onRecoverableError: (error) =>
        recoverable.push(String(error?.message ?? error)),
    });

    // Let hydration and the passive effects that follow it settle.
    await new Promise((done) => setTimeout(done, 150));

    return {
      route,
      recoverable: [...recoverable],
      consoleErrors: [...consoleErrors],
    };
  } finally {
    reactRoot?.unmount();
    resetCatalogReader();
    console.error = realConsoleError;
    dom.window.close();
  }
}
