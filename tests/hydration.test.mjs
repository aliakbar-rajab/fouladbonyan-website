import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const projectDir = resolve(import.meta.dirname, "..");
const readDist = (path) =>
  readFile(new URL(`../dist/${path}`, import.meta.url), "utf8");

/*
 * One route per page type, plus both halves of the split that caused React
 * error #418: `rebar` is the group the mega menu opens on, so its snapshot
 * happens to be present on /rebar/ pages and absent everywhere else. Before the
 * menu got its own payload, the second kind of route hydrated a populated menu
 * against a "loading" placeholder.
 */
const ROUTES = [
  "", // homepage — ships no price snapshot at all
  "rebar", // category whose snapshot IS embedded
  "sheet", // category whose snapshot is NOT the menu's default group
  "beam",
  "rebar/ribbed", // subcategory, menu default group
  "wire/chicken-mesh", // subcategory, different catalog
  "contact",
  "about",
  "guide",
  "guide/rebar-weight-chart",
];

async function hydrate(route) {
  const { stdout } = await run(
    process.execPath,
    ["--import", "tsx", "tests/helpers/hydrate-route.mjs", route],
    { cwd: projectDir, timeout: 120_000 },
  );
  const line = stdout.trim().split("\n").at(-1);
  return JSON.parse(line);
}

test("built pages hydrate with no recoverable React errors", async (t) => {
  for (const route of ROUTES) {
    await t.test(`/${route}`, async () => {
      const result = await hydrate(route);
      assert.deepEqual(
        result.recoverable,
        [],
        `/${route} hydrated with a mismatch:\n${result.recoverable.join("\n")}`,
      );
      const hydrationWarnings = result.consoleErrors.filter((message) =>
        /hydrat/i.test(message),
      );
      assert.deepEqual(
        hydrationWarnings,
        [],
        `/${route} logged hydration warnings:\n${hydrationWarnings.join("\n")}`,
      );
    });
  }
});

test("the mega menu payload ships exactly where <App /> is rendered", async () => {
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const pages = entries.filter((entry) => entry.endsWith("index.html"));
  assert.ok(pages.length > 0);

  for (const page of pages) {
    const html = await readDist(page.split("\\").join("/"));
    const rendersApp = !/<div id="root"[^>]*\sdata-page=/.test(html);
    assert.equal(
      html.includes('<script id="initial-menu-data"'),
      rendersApp,
      rendersApp
        ? `${page} renders <App /> and must embed initial-menu-data`
        : `${page} does not render <App /> and must not carry initial-menu-data`,
    );
  }
});

test("the mega menu payload carries menu metadata and no price rows", async () => {
  const html = await readDist("index.html");
  const payload = JSON.parse(
    html.match(
      /<script id="initial-menu-data" type="application\/json">([\s\S]*?)<\/script>/,
    )[1],
  );

  assert.equal(payload.length, 8, "one entry per product group");
  for (const group of payload) {
    assert.ok(group.id && group.label && group.initialCategoryId);
    assert.ok(group.categories.length > 0);
    assert.ok(group.factories.length <= 16, "factories are capped for the menu");
    assert.ok(group.sizes.length <= 16, "sizes are capped for the menu");
    for (const category of group.categories) {
      assert.ok(category.id && category.label);
      assert.deepEqual(
        Object.keys(category).sort(),
        ["id", "label"],
        "menu categories must not carry catalog rows",
      );
    }
  }

  // A menu payload anywhere near the size of a price snapshot means the full
  // catalog leaked back into it.
  assert.ok(
    html.match(
      /<script id="initial-menu-data" type="application\/json">([\s\S]*?)<\/script>/,
    )[1].length < 30_000,
    "menu payload must stay small",
  );
  assert.doesNotMatch(
    JSON.stringify(payload),
    /"price"|"factories":\[\{|"rows"/,
    "menu payload must not contain price rows",
  );
});
