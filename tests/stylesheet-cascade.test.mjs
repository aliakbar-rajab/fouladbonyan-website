import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

/*
 * The stylesheets are one global namespace resolved by import order, so any
 * sheet can silently take over a class name another sheet owns. That is not
 * hypothetical: `.quote-card` once meant both the homepage conversion panel
 * (cinematic.css) and the pre-invoice's seller/buyer blocks (quote-print.css),
 * cinematic.css loads last, and the pre-invoice's blocks rendered as dark
 * 26px-radius flex rows for as long as it took someone to notice.
 *
 * Components cannot own their styles here: the prerender runs App.tsx and its
 * page components under plain `node --import tsx`, and so do the jsdom tests,
 * and neither can parse a CSS import -- `node --import tsx -e "import('./x.css')"`
 * fails with `SyntaxError: Unexpected token '.'`. CSS Modules would need a
 * stub loader wired into both before a single component could import one, so
 * the global sheet is load-bearing for the static build rather than an
 * oversight.
 *
 * What is available is making the overlaps declared instead of accidental.
 * Every pair below is a real relationship the stylesheets have today: the
 * later sheet restyles class names the earlier one already defines. A pair
 * that is not listed is a collision, and fails.
 */

/** Sheets, in the order app/globals.css imports them. */
async function importOrder() {
  const globals = await read("../app/globals.css");
  return [...globals.matchAll(/@import\s+"\.\/globals\/([^"]+)"/g)].map(
    ([, name]) => name,
  );
}

/** The class names a stylesheet styles, comments and at-rules stripped. */
function classSelectors(css) {
  const found = new Set();
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack = [];
  for (const match of source.matchAll(/([^{}]*)([{}])/g)) {
    const [, selector, brace] = match;
    const text = selector.trim();
    if (brace === "{") {
      stack.push(text);
      if (!text.startsWith("@")) {
        for (const name of text.match(/\.[A-Za-z][\w-]*/g) ?? []) {
          found.add(name);
        }
      }
    } else if (stack.length) {
      stack.pop();
    }
  }
  return found;
}

/**
 * Declared cascade relationships: `later sheet` -> the earlier sheets whose
 * class names it deliberately restyles, with the number of names as of now.
 *
 * The counts are commentary, not assertions -- an intentional override may
 * gain or lose a rule. The pairing is the assertion.
 *
 * cinematic.css is the site's final visual layer and legitimately restyles the
 * component sheets. It is deliberately NOT declared over quote-print.css: the
 * pre-invoice is a printed document with its own look, and the class the two
 * once shared is exactly the bug above.
 */
const DECLARED_OVERRIDES = {
  "hero.css": ["header.css"],
  "home-sections.css": ["base.css", "hero.css"],
  "market-prices.css": ["home-sections.css"],
  "rebar.css": ["home-sections.css", "market-prices.css"],
  "footer.css": ["header.css", "glass-surface.css"],
  "contact.css": ["base.css", "home-sections.css"],
  "info.css": ["base.css", "contact.css", "home-sections.css"],
  "forms.css": ["info.css"],
  // quote-print.css also carries the quote-process page's responsive layout,
  // which refines the shared form and info rules on narrow screens.
  "quote-print.css": ["forms.css", "info.css"],
  "cinematic.css": [
    "home-sections.css",
    "rebar.css",
    "hero.css",
    "market-prices.css",
    "base.css",
    "contact.css",
    "header.css",
    "info.css",
  ],
};

test("no stylesheet takes over another's class names undeclared", async () => {
  const order = await importOrder();
  const position = new Map(order.map((name, index) => [name, index]));
  const selectors = new Map(
    await Promise.all(
      order.map(async (name) => [
        name,
        classSelectors(await read(`../app/globals/${name}`)),
      ]),
    ),
  );

  const undeclared = [];
  for (const later of order) {
    for (const earlier of order) {
      if (position.get(earlier) >= position.get(later)) continue;
      const shared = [...selectors.get(later)].filter((name) =>
        selectors.get(earlier).has(name),
      );
      if (!shared.length) continue;
      if (DECLARED_OVERRIDES[later]?.includes(earlier)) continue;
      undeclared.push(
        `${later} restyles ${shared.length} class name(s) that ${earlier} owns, ` +
          `and wins by loading later: ${shared.sort().join(", ")}`,
      );
    }
  }

  assert.deepEqual(
    undeclared,
    [],
    `undeclared cascade collisions:\n  ${undeclared.join("\n  ")}\n` +
      "Either rename the class, or add the pair to DECLARED_OVERRIDES if the override is intended.",
  );
});

test("every declared override is still a real one", async () => {
  const order = await importOrder();
  const position = new Map(order.map((name, index) => [name, index]));
  const selectors = new Map(
    await Promise.all(
      order.map(async (name) => [
        name,
        classSelectors(await read(`../app/globals/${name}`)),
      ]),
    ),
  );

  const stale = [];
  for (const [later, earlierSheets] of Object.entries(DECLARED_OVERRIDES)) {
    for (const earlier of earlierSheets) {
      assert.ok(position.has(later), `${later} is no longer imported`);
      assert.ok(position.has(earlier), `${earlier} is no longer imported`);
      assert.ok(
        position.get(earlier) < position.get(later),
        `${later} is declared over ${earlier} but no longer loads after it`,
      );
      const shared = [...selectors.get(later)].filter((name) =>
        selectors.get(earlier).has(name),
      );
      if (!shared.length) stale.push(`${later} over ${earlier}`);
    }
  }

  assert.deepEqual(
    stale,
    [],
    `these overrides no longer overlap and should be removed from DECLARED_OVERRIDES:\n  ${stale.join("\n  ")}`,
  );
});

/*
 * `body` and `#fb-site` carry the dark theme unconditionally from
 * cinematic.css. The print block has to out-specify that, or a printed
 * pre-invoice lands on a black page wherever the browser prints backgrounds.
 */
test("print resets the themed backgrounds with enough specificity to win", async () => {
  const css = await read("../app/globals/quote-print.css");
  const printBlock = css.slice(css.indexOf("@media print"));

  assert.match(printBlock, /html body \{[^}]*background:\s*#fff/);
  assert.match(printBlock, /html #fb-site \{[^}]*background:\s*#fff/);
});
