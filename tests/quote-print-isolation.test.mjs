import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

/** Class selectors a stylesheet styles, comments stripped. */
function classSelectors(css) {
  const found = new Set();
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of source.matchAll(/([^{}@;]+)\{/g)) {
    for (const name of rule[1].match(/\.[A-Za-z0-9_-]+/g) ?? []) found.add(name);
  }
  return found;
}

/*
 * cinematic.css is the last sheet loaded, so anything it names beats an equal
 * selector in an earlier sheet -- inside `@media print` as much as on screen.
 * The pre-invoice therefore cannot share a class name with it: `.quote-card`
 * once meant both the homepage conversion panel and the pre-invoice's
 * seller/buyer blocks, and the panel silently won, rendering those blocks as
 * dark 26px-radius flex rows on screen and in print.
 */
test("the pre-invoice stylesheet shares no class with the cinematic layer", async () => {
  const [print, cinematic] = await Promise.all([
    read("../app/globals/quote-print.css"),
    read("../app/globals/cinematic.css"),
  ]);

  const printClasses = classSelectors(print);
  const cinematicClasses = classSelectors(cinematic);
  const shared = [...printClasses].filter((name) => cinematicClasses.has(name));

  assert.deepEqual(
    shared,
    [],
    `these classes are styled by both quote-print.css and cinematic.css, and cinematic wins: ${shared.join(", ")}`,
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
