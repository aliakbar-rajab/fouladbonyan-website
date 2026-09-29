import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { afterEach } from "node:test";
import { setupDomEnv } from "./helpers/dom-env.mjs";

/*
 * The Site page module is the one description of a page that the build, the
 * browser boot and the pages themselves all read. These tests hold the three
 * to it: whatever the build writes into <head> and the root's attributes, the
 * browser must read back into the same element, and the page must render the
 * same title and trail.
 */

const dom = setupDomEnv({ url: "https://fouladbonyan.com/", pretendToBeVisual: true });
dom.window.HTMLCanvasElement.prototype.getContext = () => null;

const { cleanup, render, within } = await import("@testing-library/react");
const { collectSitePageDescriptors } = await import("../scripts/lib/site-pages.mjs");
const { buildMenuCatalog, loadOverviewSummaries, primeCatalogSnapshot } =
  await import("../app/catalog-reader.ts");
const { buildGuideReference } = await import("../app/steel-reference.ts");
const { interpretSiteRoute } = await import("../app/site-route.ts");
const { pageElement } = await import("../app/site-page-element.tsx");

const snapshot = JSON.parse(
  await readFile(new URL("../app/data/catalog-prices.json", import.meta.url), "utf8"),
);
primeCatalogSnapshot(snapshot);
const reference = buildGuideReference(snapshot);
const { pages } = await collectSitePageDescriptors({
  snapshot,
  menuCatalog: await buildMenuCatalog(),
  overviewSummaries: await loadOverviewSummaries(),
  reference,
});

const datasetFrom = (rootAttributes) =>
  Object.fromEntries(
    [...rootAttributes.matchAll(/data-([a-z-]+)="([^"]*)"/g)].map(([, name, value]) => [
      name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
      value.replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
    ]),
  );

const browserRouteOf = (page) =>
  interpretSiteRoute({
    pathname: new URL(page.pageUrl).pathname,
    dataset: datasetFrom(page.rootAttributes),
  });

afterEach(cleanup);

test("the browser builds the same root element the build rendered, for every page", () => {
  for (const page of pages) {
    const hydrated = pageElement(browserRouteOf(page), { guideReference: reference });
    assert.equal(hydrated.type, page.rootElement.type, `${page.pageUrl} root component`);
    assert.deepEqual(hydrated.props, page.rootElement.props, `${page.pageUrl} root props`);
  }
});

test("every page renders the <title> and trail the build stamped into its head", () => {
  for (const page of pages) {
    document.title = "";
    const { container, unmount } = render(page.rootElement);

    // Catalog pages keep the served title; every other page sets one on mount,
    // and it has to be the same one or the tab retitles itself on hydration.
    if (page.route.kind !== "home" && page.route.kind !== "catalog") {
      assert.equal(document.title, page.title, `${page.pageUrl} document.title`);
    }

    const trail = container.querySelector('nav[aria-label="مسیر راهنما"]');
    if (!page.breadcrumb.length) {
      assert.equal(trail, null, `${page.pageUrl} should draw no trail`);
    } else {
      const items = within(trail).getAllByRole("listitem");
      assert.deepEqual(
        items.map((item) => item.textContent.replace("/", "").trim()),
        page.breadcrumb.map((crumb) => crumb.name),
        `${page.pageUrl} visible trail vs BreadcrumbList`,
      );
      items.slice(0, -1).forEach((item, index) => {
        assert.equal(
          item.querySelector("a")?.getAttribute("href"),
          new URL(page.breadcrumb[index].url).pathname,
          `${page.pageUrl} crumb ${index} link`,
        );
      });
    }
    unmount();
  }
});
