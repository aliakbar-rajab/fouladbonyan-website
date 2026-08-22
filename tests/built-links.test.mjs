import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import test from "node:test";

const distDir = resolve(import.meta.dirname, "..", "dist");
const siteOrigin = "https://fouladbonyan.com";

async function collectHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return collectHtmlFiles(path);
      return entry.name.endsWith(".html") ? [path] : [];
    }),
  );
  return nested.flat();
}

function pageUrlFor(file) {
  const outputPath = relative(distDir, file).replaceAll("\\", "/");
  const pathname =
    outputPath === "index.html"
      ? "/"
      : `/${outputPath.replace(/index\.html$/, "")}`;
  return new URL(pathname, siteOrigin);
}

function fileForPathname(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (!clean) return resolve(distDir, "index.html");
  if (extname(clean)) return resolve(distDir, clean);
  return resolve(distDir, clean, "index.html");
}

function anchorHrefs(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map((match) =>
    match[1].replaceAll("&amp;", "&"),
  );
}

test("every prerendered internal navigation and content link resolves", async () => {
  const files = await collectHtmlFiles(distDir);
  const htmlByFile = new Map(
    await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")])),
  );
  const failures = [];
  let checkedLinks = 0;

  for (const [sourceFile, html] of htmlByFile) {
    const sourceUrl = pageUrlFor(sourceFile);
    for (const href of anchorHrefs(html)) {
      if (/^(?:tel:|mailto:)/i.test(href)) {
        assert.match(href, /^(?:tel:\+?\d+|mailto:[^@\s]+@[^@\s]+)$/i);
        continue;
      }

      const targetUrl = new URL(href, sourceUrl);
      if (targetUrl.origin !== siteOrigin) continue;
      checkedLinks += 1;

      const targetFile = fileForPathname(targetUrl.pathname);
      const targetHtml = htmlByFile.get(targetFile);
      if (!targetHtml) {
        failures.push(`${sourceUrl.pathname} -> ${href} (missing route)`);
        continue;
      }

      const fragment = decodeURIComponent(targetUrl.hash.slice(1));
      if (fragment && !targetHtml.includes(`id="${fragment}"`)) {
        failures.push(`${sourceUrl.pathname} -> ${href} (missing #${fragment})`);
      }
    }
  }

  assert.ok(checkedLinks > 1_000, "the audit should cover the full prerendered catalog");
  assert.deepEqual(failures, []);
});
