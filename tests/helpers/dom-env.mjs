import { JSDOM } from "jsdom";

/*
 * Shared jsdom bootstrap for component tests: creates a DOM, wires it onto
 * globalThis, and stubs the two APIs jsdom doesn't implement that these
 * components call -- scrollIntoView and matchMedia (every query reports
 * false, the desktop / motion-allowed case). Callers that need to observe or
 * vary either stub (e.g. recording scroll calls, toggling reduced motion)
 * reassign it on the returned `dom.window` after calling this.
 */
export function setupDomEnv({ url, pretendToBeVisual = false } = {}) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url,
    pretendToBeVisual,
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
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  dom.window.Element.prototype.scrollIntoView = () => {};
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

  return dom;
}
