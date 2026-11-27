import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { siteConfig } from "../../app/site-config.ts";
import { buildGuideReference } from "../../app/steel-reference.ts";
import {
  buildMenuCatalog,
  buildOverviewSummaries,
  primeCatalogReader,
  resetCatalogReader,
} from "../../app/catalog-reader.ts";
import {
  buildRedirectHtml,
  buildSitemapXml,
  renderStaticDocument,
} from "./static-document.mjs";
import { collectSitePageDescriptors } from "./site-pages.mjs";

/**
 * Static site generation: compile the entire static site in memory into a
 * virtual output map (`compileStaticSite`), then flush that virtual site to
 * disk through a thin writer adapter (`writeCompiledSite`).
 *
 * Separating pure compilation from disk writes guarantees a failure part-way
 * through leaves dist untouched and lets SEO and prerender tests assert
 * directly against compiled HTML, sitemap.xml, and _redirects in-process.
 */

const htmlOutputPath = (segments) =>
  segments.length === 0 ? "index.html" : `${segments.join("/")}/index.html`;

function addVirtualFile(files, relPath, content) {
  if (files.has(relPath)) {
    throw new Error(`Duplicate static output path: ${relPath}`);
  }
  files.set(relPath, content);
}

/**
 * The files to modulepreload for a lazily loaded page module: its own chunk
 * and the shared chunks it imports, but not the entry bundle, which the page
 * already loads. `manifest` is Vite's build manifest; null preloads nothing.
 */
export function modulePreloadsFor(manifest, source) {
  if (!manifest || !source) return [];
  if (!manifest[source]) {
    throw new Error(`No chunk for ${source} in the Vite build manifest.`);
  }
  const files = [];
  const visit = (key) => {
    const chunk = manifest[key];
    if (!chunk || chunk.isEntry || files.includes(`/${chunk.file}`)) return;
    files.push(`/${chunk.file}`);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  visit(source);
  return files;
}

/**
 * Pure virtual site compilation: primes the catalog caches from `snapshot`,
 * collects every page descriptor, renders all HTML documents and redirect
 * stubs against `templateHtml`, and builds `sitemap.xml` and `_redirects`.
 * Performs no filesystem I/O.
 */
export async function compileStaticSite({
  templateHtml,
  snapshot,
  manifest = null,
  siteUrl = siteConfig.siteUrl,
}) {
  const menuCatalog = await buildMenuCatalog(snapshot);
  const overviewSummaries = buildOverviewSummaries(snapshot);
  resetCatalogReader();
  primeCatalogReader({
    snapshot,
    menu: menuCatalog,
    overview: overviewSummaries,
  });

  const reference = buildGuideReference(snapshot);

  const { pages, rootLastmod, redirectRoutes, redirectsText } =
    await collectSitePageDescriptors({
      snapshot,
      menuCatalog,
      overviewSummaries,
      reference,
      siteUrl,
    });

  const files = new Map();

  const renderedPages = pages.map((page) => {
    const modulePreloadHrefs = modulePreloadsFor(manifest, page.pageModuleSource);
    const relPath = htmlOutputPath(page.outPath);
    const html = renderStaticDocument(templateHtml, {
      ...page,
      modulePreloadHrefs,
    });
    addVirtualFile(files, relPath, html);
    return {
      ...page,
      modulePreloadHrefs,
      relPath,
      html,
    };
  });

  const sitemapXml = buildSitemapXml({
    siteUrl,
    rootLastmod,
    pages: renderedPages,
  });
  addVirtualFile(files, "sitemap.xml", sitemapXml);
  addVirtualFile(files, "_redirects", redirectsText);

  const renderedRedirects = redirectRoutes.map((redirect) => {
    const relPath = htmlOutputPath(redirect.fromPath);
    const html = buildRedirectHtml({
      toUrl: redirect.toUrl,
      targetLabel: redirect.targetLabel,
    });
    addVirtualFile(files, relPath, html);
    return {
      ...redirect,
      relPath,
      html,
    };
  });

  const sitemapCount = renderedPages.filter((page) => !page.noindex).length;

  return {
    files,
    pages: renderedPages,
    redirects: renderedRedirects,
    sitemapXml,
    redirectsText,
    rootLastmod,
    siteUrl,
    pageCount: renderedPages.length,
    sitemapCount,
  };
}

/**
 * Thin disk writer adapter: flushes a compiled virtual site into `distDir`.
 * Output directories are created sequentially first to avoid parent/child
 * mkdir races on Windows.
 */
export async function writeCompiledSite(distDir, compiled) {
  const outputDirs = new Set();
  for (const relPath of compiled.files.keys()) {
    outputDirs.add(dirname(resolve(distDir, relPath)));
  }
  for (const dir of outputDirs) {
    await mkdir(dir, { recursive: true });
  }
  await Promise.all(
    [...compiled.files.entries()].map(([relPath, content]) =>
      writeFile(resolve(distDir, relPath), content, "utf8"),
    ),
  );

  return {
    pageCount: compiled.pageCount,
    sitemapCount: compiled.sitemapCount,
  };
}

/**
 * Main entry point for static site generation.
 *
 * `readTemplate`, `readSnapshot`, `readManifest`, and `writeSite` are the I/O
 * seams around `compileStaticSite`. Production passes nothing and reads/writes
 * the real build directories; tests can substitute in-memory adapters.
 */
export async function generateStaticSite({
  distDir = resolve(import.meta.dirname, "..", "..", "dist"),
  dataDir = resolve(import.meta.dirname, "..", "..", "app", "data"),
  siteUrl = siteConfig.siteUrl,
  readTemplate = () => readFile(resolve(distDir, "index.html"), "utf8"),
  readSnapshot = async () =>
    JSON.parse(await readFile(resolve(dataDir, "catalog-prices.json"), "utf8")),
  readManifest = () => readViteManifest(distDir),
  writeSite = writeCompiledSite,
} = {}) {
  const [templateHtml, snapshot, manifest] = await Promise.all([
    readTemplate(),
    readSnapshot(),
    readManifest(),
  ]);

  const compiled = await compileStaticSite({
    templateHtml,
    snapshot,
    manifest,
    siteUrl,
  });

  const result = await writeSite(distDir, compiled);
  if (manifest) await rm(resolve(distDir, ".vite"), { recursive: true, force: true });
  return result;
}

/** Vite's build manifest, or null when there is none (a test's distDir). */
async function readViteManifest(distDir) {
  try {
    return JSON.parse(await readFile(resolve(distDir, ".vite", "manifest.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
