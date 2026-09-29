/**
 * Hydrates one built page from dist/ inside jsdom and reports what React had to
 * recover from. Run as a child process, one per route, by
 * tests/hydration.test.mjs.
 *
 * The isolation is the point: module-level catalog caches survive for the life
 * of a process, so checking several routes in one process would let an earlier
 * route prime the snapshot a later route is supposed to be missing -- which is
 * exactly the condition that produced React error #418. One process per route
 * keeps every check honest.
 *
 * Usage: node --import tsx tests/helpers/hydrate-route.mjs <route>
 * Prints a single JSON line: { route, recoverable: string[], consoleErrors: string[] }
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const route = process.argv[2] ?? "";
const projectDir = resolve(import.meta.dirname, "..", "..");
const html = await readFile(
  resolve(projectDir, "dist", route, "index.html"),
  "utf8",
);

const dom = new JSDOM(html, {
  url: `https://fouladbonyan.com/${route}${route ? "/" : ""}`,
  pretendToBeVisual: true,
});

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

const consoleErrors = [];
const realConsoleError = console.error;
console.error = (...args) => {
  consoleErrors.push(
    args.map((arg) => (arg?.stack ? arg.stack : String(arg))).join("\n"),
  );
};

const { hydrateRoot } = await import("react-dom/client");
const { primeCatalogReader } = await import(
  "../../app/catalog-reader.ts"
);
const { interpretSiteRoute } = await import("../../app/site-route.ts");
const { pagePayloadIds } = await import("../../app/site-page.ts");
const { pageElement } = await import("../../app/site-page-element.tsx");

const root = document.getElementById("root");

function readJsonScript(id) {
  const element = document.getElementById(id);
  if (!element?.textContent) return null;
  try {
    return JSON.parse(element.textContent);
  } catch {
    return null;
  }
}

// The same steps, in the same order, as static-entry/main.tsx -- the route and
// the element come from the modules the browser boot uses, not a copy of them.
primeCatalogReader({
  snapshot: readJsonScript(pagePayloadIds.catalog),
  menu: readJsonScript(pagePayloadIds.menu),
  overview: readJsonScript(pagePayloadIds.overview),
});

const element = pageElement(
  interpretSiteRoute({ pathname: window.location.pathname, dataset: root.dataset }),
  { guideReference: readJsonScript(pagePayloadIds.guide) },
);

const recoverable = [];
hydrateRoot(root, element, {
  onRecoverableError: (error) => recoverable.push(String(error?.message ?? error)),
});

// Let hydration and the passive effects that follow it settle.
await new Promise((done) => setTimeout(done, 300));
console.error = realConsoleError;

process.stdout.write(
  `${JSON.stringify({ route, recoverable, consoleErrors })}\n`,
);
process.exit(0);
