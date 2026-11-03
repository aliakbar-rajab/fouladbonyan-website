import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { preview } from "vite";

/*
 * Two layout regressions that only a real engine can catch, because both come
 * from CSS the DOM alone cannot predict:
 *
 * 1. The generated pre-invoice is a fixed 277mm landscape sheet (~1047px).
 *    On a phone it is scaled down to the width of its frame rather than
 *    swiped. An earlier version swiped it inside a scroller, and its
 *    `min-width` propagated out through `.request-form` (a grid item takes
 *    its content's min-content width as its automatic minimum), pushing the
 *    whole form to ~725px inside a 375px viewport where `.inner-page` clipped
 *    it with no way to reach the submit button. A transform does not affect
 *    layout, so the frame has to be given the scaled height by script; if
 *    that ever breaks, the sheet overlaps whatever follows it.
 *
 * 2. `.footer-link-list--contacts a` is a flex row holding a name and an
 *    eleven-digit number in a ~134px column. Held on one nowrap line, the
 *    number ran off the start edge and was clipped: ۰۹۱۲۳۳۰۰۸۱۵ published as
 *    "۲۳۳۰۰۸۱۵".
 *
 * The shared assertion is the honest one for both: nothing may sit outside the
 * viewport unless an ancestor can actually be scrolled to it.
 */

const PHONE = { width: 375, height: 812 };

/**
 * Elements whose box falls outside the viewport with no scrollable ancestor
 * that could bring them back. Hero images are excluded: they are decorative,
 * deliberately bled past the edge, and cropped by design.
 */
function findClippedElements(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const reachableByScrolling = (element) => {
      for (let p = element.parentElement; p; p = p.parentElement) {
        const overflowX = getComputedStyle(p).overflowX;
        if (
          (overflowX === "auto" || overflowX === "scroll") &&
          p.scrollWidth > p.clientWidth + 1
        ) {
          return true;
        }
      }
      return false;
    };

    return [...document.querySelectorAll("body *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return false;
        // Hidden measuring copies (the pre-invoice lays its pages out off
        // screen) cannot be seen, so they cannot be cut off either.
        if (!element.checkVisibility({ visibilityProperty: true })) return false;
        if (box.right <= viewportWidth + 2 && box.left >= -2) return false;
        if (element.closest(".hero-image")) return false;
        return !reachableByScrolling(element);
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return `${element.tagName}.${String(element.className).slice(0, 40)} [${Math.round(box.left)},${Math.round(box.right)}]`;
      });
  });
}

async function startPreview() {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  return {
    base: `http://127.0.0.1:${server.httpServer.address().port}`,
    close: () => new Promise((resolve) => server.httpServer.close(resolve)),
  };
}

test(
  "a generated pre-invoice stays inside the phone viewport instead of clipping the form around it",
  { timeout: 120_000 },
  async () => {
    const server = await startPreview();
    const browser = await chromium.launch({ channel: "chrome" });
    try {
      const page = await browser.newPage({ viewport: PHONE });
      await page.goto(`${server.base}/quote-process/`, { waitUntil: "load" });
      await page.locator("#quote-form").waitFor();

      await page.fill('[name="fullName"]', "کاربر آزمایشی");
      await page.fill('[name="phone"]', "09121234567");
      await page.fill('[name="destination"]', "تهران");
      await page.selectOption('[name="itemProduct-1"]', "میلگرد");
      await page.fill('[name="itemQuantity-1"]', "5");
      await page.check('[name="acceptDisclaimer"]');
      await page.click(".form-submit");
      await page.locator(".inv-pages .print-page").waitFor();
      await page.evaluate(() => document.fonts.ready);

      const layout = await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
        };
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          form: rect(".request-form"),
          frame: rect(".inv-pages-frame"),
          pages: rect(".inv-pages"),
          sheet: rect(".inv-pages .print-page"),
          sheetLayoutWidth: document.querySelector(".inv-pages .print-page").offsetWidth,
          pagesTabIndex: document.querySelector(".inv-pages").getAttribute("tabindex"),
        };
      });

      assert.ok(
        layout.form.width <= layout.viewportWidth,
        `the form is ${Math.round(layout.form.width)}px inside a ${layout.viewportWidth}px viewport`,
      );
      assert.equal(
        layout.documentScrollWidth,
        layout.viewportWidth,
        "the page must not overflow horizontally",
      );
      assert.ok(
        layout.sheet.width < layout.sheetLayoutWidth / 2,
        `the ${layout.sheetLayoutWidth}px sheet should be scaled down on a phone, not shown at ${Math.round(layout.sheet.width)}px`,
      );
      assert.ok(
        layout.sheet.left >= layout.frame.left - 1 && layout.sheet.right <= layout.frame.right + 1,
        `the scaled sheet [${Math.round(layout.sheet.left)},${Math.round(layout.sheet.right)}] must sit inside its frame [${Math.round(layout.frame.left)},${Math.round(layout.frame.right)}]`,
      );
      assert.ok(
        Math.abs(layout.frame.height - layout.pages.height) <= 2,
        `the frame (${Math.round(layout.frame.height)}px) must be as tall as the scaled sheets (${Math.round(layout.pages.height)}px), or they overlap what follows`,
      );
      assert.equal(
        layout.pagesTabIndex,
        "0",
        "a keyboard reader must be able to reach the generated document",
      );
      assert.deepEqual(await findClippedElements(page), []);
      await page.close();
    } finally {
      await browser.close();
      await server.close();
    }
  },
);

test(
  "no page clips content off the edge of a phone viewport",
  { timeout: 180_000 },
  async (t) => {
    const server = await startPreview();
    const browser = await chromium.launch({ channel: "chrome" });
    try {
      const page = await browser.newPage({ viewport: PHONE });
      for (const route of [
        "/",
        "/rebar/",
        "/rebar/ribbed/",
        "/beam/beam/",
        "/contact/",
        "/about/",
        "/guide/",
        "/guide/rebar-weight-chart/",
      ]) {
        await t.test(route, async () => {
          await page.goto(`${server.base}${route}`, { waitUntil: "load" });
          const skip = page.locator(".fb-preloader__skip");
          if (await skip.isVisible()) await skip.click();
          await page.locator("#main-content, .inner-page").first().waitFor();
          await page.evaluate(() => document.fonts.ready);

          assert.deepEqual(
            await findClippedElements(page),
            [],
            `${route} clips content that nothing can scroll to`,
          );
        });
      }

      // Negative control: prove the sweep rejects real clipping rather than
      // reading an empty page back to itself.
      await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.cssText =
          "width:900px;height:20px;background:red;position:relative";
        document.querySelector("#main-content, .inner-page").append(probe);
      });
      assert.notDeepEqual(await findClippedElements(page), []);
      await page.close();
    } finally {
      await browser.close();
      await server.close();
    }
  },
);

test(
  "every management phone number in the footer is shown in full",
  { timeout: 120_000 },
  async () => {
    const server = await startPreview();
    const browser = await chromium.launch({ channel: "chrome" });
    try {
      const page = await browser.newPage({ viewport: PHONE });
      await page.goto(server.base, { waitUntil: "load" });
      const skip = page.locator(".fb-preloader__skip");
      if (await skip.isVisible()) await skip.click();
      await page.locator(".footer-link-list--contacts").waitFor();
      await page.evaluate(() => document.fonts.ready);

      const numbers = await page.evaluate(() =>
        [...document.querySelectorAll(".footer-contact-number")].map(
          (element) => {
            const box = element.getBoundingClientRect();
            const link = element.closest("a").getBoundingClientRect();
            return {
              text: element.textContent,
              left: Math.round(box.left),
              right: Math.round(box.right),
              linkLeft: Math.round(link.left),
              linkRight: Math.round(link.right),
            };
          },
        ),
      );

      assert.ok(numbers.length > 0, "expected management contacts in the footer");
      for (const number of numbers) {
        assert.ok(
          number.left >= number.linkLeft - 1 &&
            number.right <= number.linkRight + 1,
          `${number.text} runs outside its own link box (${number.left}–${number.right} against ${number.linkLeft}–${number.linkRight}); its leading digits are being clipped`,
        );
      }
      await page.close();
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
