import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

/*
 * This test used to restate seven colour pairs as hex literals. Restating them
 * is how it stopped guarding anything: #0E1215 and #6B6C76 had both been
 * superseded in the stylesheets and appeared nowhere in the site any more,
 * while the assertions naming them still passed, because a contrast ratio
 * between two numbers is true whether or not the site uses either.
 *
 * It now reads the stylesheets. Every colour named below has to still be in
 * them -- as a `:root` token resolved by name, or as a literal some rule uses
 * -- so a colour that gets retuned or dropped fails here instead of quietly
 * leaving the palette unguarded.
 */

const GLOBALS = new URL("../app/globals/", import.meta.url);

async function readStylesheets() {
  const files = (await readdir(GLOBALS)).filter((name) => name.endsWith(".css"));
  const sources = await Promise.all(
    files.map(async (name) => [
      name,
      await readFile(new URL(name, GLOBALS), "utf8"),
    ]),
  );
  return Object.fromEntries(sources);
}

const stylesheets = await readStylesheets();
const allCss = Object.values(stylesheets).join("\n");

/** Every `--token: #hex` declared in the shared token block. */
const tokens = Object.fromEntries(
  [...stylesheets["base.css"].matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map(
    ([, name, value]) => [name, value],
  ),
);

/** Every hex literal any stylesheet actually uses. */
const literals = new Set(
  [...allCss.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(([hex]) =>
    normalize(hex),
  ),
);

function normalize(hex) {
  const value = hex.replace("#", "").toLowerCase();
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value.slice(0, 6);
  return `#${full}`;
}

/** A colour named by a `:root` token, resolved to what the token says today. */
function token(name) {
  const value = tokens[name];
  assert.ok(value, `base.css no longer declares ${name}`);
  return normalize(value);
}

/** A colour written as a literal in the stylesheets, checked to still be there. */
function used(hex) {
  const value = normalize(hex);
  assert.ok(
    literals.has(value),
    `${hex} is not used by any stylesheet any more, so asserting its contrast guards nothing`,
  );
  return value;
}

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(foreground, background) {
  const values = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("core palette combinations meet WCAG AA contrast", () => {
  /*
   * Each pair is one real combination the site renders, measured off the
   * running page. The ratio floor is AA for normal text (4.5:1); none of these
   * is large enough to qualify for the 3:1 large-text allowance.
   */
  const combinations = [
    // Brand button: dark ink on the brand yellow.
    ["ink on brand", used("#111417"), token("--brand-yellow")],
    // Body copy on the two dark grounds the cinematic layer paints.
    ["body on steel", used("#F3F5F6"), token("--steel-950")],
    ["body on panel", used("#F3F5F6"), used("#10161A")],
    // Muted and error text on the dark ground.
    ["muted on dark", used("#929DA3"), used("#0B0F12")],
    ["error on dark", used("#EF6D7D"), used("#0B0F12")],
    // Currency and unit metadata beside every displayed price, and the stat
    // captions under the summary: --muted on white.
    ["metadata on white", token("--muted"), token("--white")],
    // The tightest pair on the page: the source card's prose, at 11.5px.
    ["source prose on white", used("#71727B"), token("--white")],
  ];

  for (const [name, foreground, background] of combinations) {
    const contrast = ratio(foreground, background);
    assert.ok(
      contrast >= 4.5,
      `${name}: ${foreground} on ${background} is ${contrast.toFixed(2)}:1, below AA 4.5:1`,
    );
  }
});
