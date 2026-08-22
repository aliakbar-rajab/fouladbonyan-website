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
import React from "react";

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
const App = (await import("../../app/App.tsx")).default;
const ContactPage = (await import("../../app/ContactPage.tsx")).default;
const InfoPage = (await import("../../app/InfoPage.tsx")).default;
const GuidePage = (await import("../../app/GuidePage.tsx")).default;
const { primeCatalogSnapshot } = await import(
  "../../app/group-catalog.ts"
);
const { loadOverviewSummaries } = await import("../../app/catalog-overview.ts");
const { setMenuCatalog } = await import("../../app/menu-catalog.ts");

const root = document.getElementById("root");

// Same helper static-entry/main.tsx uses to read its embedded payloads, so
// this test can't drift from what production actually does.
const { readJsonScript } = await import("../../app/read-json-script.ts");

const menuCatalog = readJsonScript("initial-menu-data");
if (menuCatalog) setMenuCatalog(menuCatalog);

const guideReference = readJsonScript("initial-guide-data");

const overview = readJsonScript("initial-overview-data");
if (overview) loadOverviewSummaries.setCached(overview);

primeCatalogSnapshot(readJsonScript("initial-page-data"));


const page = root.dataset.page ?? "";
let element;
if (page === "contact") {
  element = React.createElement(ContactPage);
} else if (page === "guide") {
  element = React.createElement(GuidePage, {
    guide: root.dataset.guide || undefined,
    reference: guideReference,
  });
} else if (page) {
  element = React.createElement(InfoPage, { page });
} else {
  element = React.createElement(App);
}

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
