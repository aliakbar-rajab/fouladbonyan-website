import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { preview } from "vite";
import { onRequestGet } from "../functions/api/market-prices.js";

async function measureMarket(page) {
  return page.locator("#market-prices").evaluate(section => {
    const reserved = parseFloat(getComputedStyle(section).getPropertyValue("--market-ready-min-height"));
    const outer = section.getBoundingClientRect().height;
    section.style.minBlockSize = "0px";
    const natural = section.getBoundingClientRect().height;
    section.style.removeProperty("min-block-size");
    return { reserved, outer, natural, cards: section.querySelectorAll(".market-price-card").length };
  });
}

function assertFootprint(geometry, context) {
  // Fresh content can be shorter than stale content (which has a retry
  // button), but neither may grow beyond the reservation. Two CSS pixels
  // permit fractional rounding, not an extra text line or card row.
  assert.ok(geometry.natural <= geometry.reserved + 2,
    `${context}: natural ready height ${geometry.natural}px exceeds reserved ${geometry.reserved}px; remeasure all states before updating the reservation`);
  assert.ok(Math.abs(geometry.outer - geometry.reserved) <= 2,
    `${context}: rendered height ${geometry.outer}px differs from reserved ${geometry.reserved}px`);
}

// Exercise the real endpoint mapping so adding an instrument or changing its
// label changes the fixture too. No upstream service is needed by this test.
async function marketFixture() {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const pending = [];
  globalThis.caches = { default: {
    match: async () => undefined,
    put: async () => {},
  } };
  // Fail explicitly if the endpoint gains an unrepresented upstream key.
  globalThis.fetch = async () => Response.json({ current: Object.fromEntries(
    ["geram18", "price_dollar_rl", "crypto-tether-irr", "price_eur"].map(key =>
      [key, { p: "123,456,780", dp: "1.25", dt: "high" }]),
  ) });
  try {
    const response = await onRequestGet({
      request: new Request("https://example.test/api/market-prices"),
      waitUntil: promise => pending.push(promise),
    });
    await Promise.all(pending);
    assert.equal(response.status, 200, "Update the upstream fixture for new instruments");
    return await response.json();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
}

test("built market ready content matches its reserved footprint", { timeout: 120_000 }, async t => {
  const fixture = await marketFixture();
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome" });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const width of [390, 768, 1440]) {
      await t.test(`${width}px: ready, stale, and surplus cards`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
        let payload = fixture;
        await page.route("**/api/market-prices", route => route.fulfill({ json: payload }));
        for (const variant of ["ready", "stale", "surplus"]) {
          payload = structuredClone(fixture);
          if (variant === "stale") payload.fetchedAt = "2000-01-01T00:00:00Z";
          if (variant === "surplus") payload.items.push({ ...payload.items[0], id: "extra" });
          await page.goto(`${base}/rebar/ribbed/`, { waitUntil: "load" });
          await page.locator(".market-price-card").first().waitFor();
          await page.evaluate(() => document.fonts.ready);
          const geometry = await measureMarket(page);
          assert.equal(geometry.cards, 4, "The reserved footprint assumes four visible instruments");
          assertFootprint(geometry, `${width}px ${variant}`);
        }

        // Negative control: prove the same guard actually rejects content
        // growth rather than merely reading the CSS minimum back to itself.
        await page.locator(".market-price-card h3").first().evaluate(heading => {
          heading.textContent = "نام بسیار طولانی ابزار بازار ".repeat(40);
        });
        const oversized = await measureMarket(page);
        assert.throws(() => assertFootprint(oversized, `${width}px oversized label`), /exceeds reserved/);
        await page.close();
      });
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
});

test("homepage keeps steel prices ahead of compact market failures and usable mobile controls", { timeout: 120_000 }, async t => {
  const fixture = await marketFixture();
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const width of [320, 390, 820, 1440]) {
      await t.test(`${width}px: recovery preserves the price workspace`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        let recover = false;
        await page.route("**/api/market-prices", route => route.fulfill(
          recover ? { json: fixture } : { status: 503, json: { error: "unavailable" } },
        ));
        await page.goto(base);
        const skip = page.locator(".fb-preloader__skip");
        if (await skip.isVisible()) await skip.click();
        await page.locator(".market-status-actions").waitFor();
        await page.evaluate(() => document.fonts.ready);
        const measure = () => page.evaluate(() => {
          const market = document.querySelector("#market-prices").getBoundingClientRect();
          const prices = document.querySelector("#price-workspace").getBoundingClientRect();
          const rail = document.querySelector(".market-status-rail")?.getBoundingClientRect();
          return { marketTop: market.top + scrollY, priceTop: prices.top + scrollY,
            height: market.height, railWidth: rail?.width, width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth };
        });
        const before = await measure();
        assert.ok(before.marketTop > before.priceTop, "Supplementary rates follow steel prices");
        assert.ok(before.height < 250, "Failure must not reserve an empty card grid");
        assert.ok(before.railWidth >= Math.min(width - 40, 1200), "Status uses the full shell");
        assert.equal(before.scrollWidth, width);
        if (width <= 900) {
          assert.equal(await page.locator(".overview-table-wrapper").isVisible(), false);
          assert.equal(await page.locator(".overview-mobile-cards").isVisible(), true);
          const cardsFit = await page.locator(".overview-card").evaluateAll(cards =>
            cards.every(card => card.scrollWidth <= card.clientWidth));
          assert.ok(cardsFit, "Price cards keep values and actions within their bounds");
        }
        if (width <= 640) {
          assert.equal(await page.locator("#product-family-select").inputValue(), "");
          const pause = page.locator(".carousel-pause");
          await pause.click();
          assert.equal(await pause.getAttribute("aria-pressed"), "true");
          const box = await pause.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width);
        }
        const retry = page.locator(".market-status-actions button");
        await retry.scrollIntoViewIfNeeded();
        // The mobile header intentionally compacts when leaving the hero.
        // Compare recovery at the same scroll position and header state.
        if (width <= 900) {
          await page.waitForFunction(() => document.querySelector(".site-header.is-compact"));
        }
        await page.waitForTimeout(300);
        const beforeRecovery = await measure();
        recover = true;
        await retry.click();
        await page.locator(".market-price-card").first().waitFor();
        assert.ok(Math.abs((await measure()).priceTop - beforeRecovery.priceTop) < 2,
          "Recovering market rates must not move the price workspace");
        await page.close();
      });
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
});
