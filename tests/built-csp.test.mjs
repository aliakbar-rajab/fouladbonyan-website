import assert from "node:assert/strict";
import test from "node:test";
import { readdir } from "node:fs/promises";
import { readDist } from "./helpers/dist.mjs";

/*
 * F18. The site's CSP is a `<meta>` tag in `index.html` that every generator
 * clones, and it is the only copy — `public/_headers` sets no CSP. Two things
 * used to break against it, silently and in opposite directions: Cloudflare
 * Pages injects its Web Analytics beacon before `</body>` and `script-src`
 * had no origin for it, and every prerendered `GlassSurface`/`LightPillar`
 * shipped a `style` attribute that `style-src 'self'` refused to apply — which
 * dropped the panes' radius, frost and, fatally, their `--filter-id`, so the
 * refractive material never rendered in production at all.
 */
const EXPECTED_CSP =
  "default-src 'self'; " +
  "script-src 'self' https://static.cloudflareinsights.com; " +
  "style-src 'self'; " +
  "img-src 'self' data:; " +
  "font-src 'self'; " +
  "media-src 'self'; " +
  "connect-src 'self'; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'none'";

test("F18: every generated page carries the exact CSP, with the analytics beacon origin and nothing looser", async () => {
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const pages = entries
    .filter((entry) => entry.endsWith("index.html"))
    .map((entry) => entry.split("\\").join("/"))
    .filter((p) => !p.endsWith("angle/angle/index.html") && !p.endsWith("channel/channel/index.html"));
  assert.equal(pages.length, 66, `expected the full page set, got ${pages.length}`);

  for (const page of pages) {
    const html = await readDist(page);

    const csp = html.match(
      /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
    )?.[1];
    assert.equal(csp, EXPECTED_CSP, `${page} must ship the site CSP verbatim`);

    // The beacon loads from static.cloudflareinsights.com and reports to a
    // relative /cdn-cgi/rum, which the Cloudflare edge answers on our own
    // origin -- so connect-src stays 'self' and no other origin is allowed.
    assert.doesNotMatch(csp, /\*/, `${page} CSP must name no wildcard origin`);
    assert.doesNotMatch(
      csp,
      /'unsafe-inline'|'unsafe-eval'|'unsafe-hashes'/,
      `${page} CSP must not relax script or style execution`,
    );
  }
});

test("F18: no prerendered element carries a style attribute the CSP would refuse", async () => {
  const entries = await readdir(new URL("../dist", import.meta.url), {
    recursive: true,
  });
  const pages = entries
    .filter((entry) => entry.endsWith("index.html"))
    .map((entry) => entry.split("\\").join("/"));

  for (const page of pages) {
    const html = await readDist(page);
    const inlineStyles = html.match(/<[a-zA-Z][^>]*\sstyle="[^"]*"/g) ?? [];
    assert.deepEqual(
      inlineStyles,
      [],
      `${page} would emit ${inlineStyles.length} blocked inline style(s): ${inlineStyles.join(" | ")}`,
    );
  }
});

test("F18: the glass panes get their box and material from the stylesheet, not from a style attribute", async () => {
  const cssName = (await readdir(new URL("../dist/assets", import.meta.url)))
    .find((file) => file.endsWith(".css"));
  const css = await readDist(`assets/${cssName}`);

  // Every declaration the minifier left on a rule whose selector list names
  // exactly this class. The minifier drops leading zeroes, so compare numbers
  // rather than the literal text it emitted.
  const declarationsFor = (className) => {
    const found = [];
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (selectors.split(",").some((one) => one.trim() === className)) {
        found.push(...body.split(";"));
      }
    }
    return new Map(
      found
        .map((declaration) => declaration.split(":"))
        .filter((pair) => pair.length === 2)
        .map(([property, value]) => [property.trim(), value.trim()]),
    );
  };

  // GlassSurface reads the applied radius back out of the cascade to corner
  // its displacement map, so a missing rule here silently squares the glass.
  for (const [className, radius, frost, saturation] of [
    [".fg-glass", 18, 0.03, 0.92],
    [".fg-pill", 13, 0.02, 0.94],
    [".fg-chip", 11, 0.02, 0.94],
  ]) {
    const declarations = declarationsFor(className);
    assert.ok(
      declarations.size > 0,
      `${className} must have a rule carrying the pane's box and material`,
    );
    assert.equal(
      declarations.get("border-radius"),
      `${radius}px`,
      `${className} radius must come from the stylesheet`,
    );
    assert.equal(
      Number(declarations.get("--glass-frost")),
      frost,
      `${className} frost must come from the stylesheet`,
    );
    assert.equal(
      Number(declarations.get("--glass-saturation")),
      saturation,
      `${className} saturation must come from the stylesheet`,
    );
  }
});
