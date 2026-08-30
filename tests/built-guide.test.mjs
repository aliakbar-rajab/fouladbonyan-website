import assert from "node:assert/strict";
import test from "node:test";
import { guideIndex, guidePageDefinitions, guidePageKeys } from "../app/guide-page-data.ts";
import { parseBreadcrumbLd, readDist } from "./helpers/dist.mjs";

test("F10: editorial guide pages exist with unique metadata, prerendered content, breadcrumbs and sitemap entries", async () => {
  const sitemap = await readDist("sitemap.xml");
  const pages = [
    {
      path: "guide/index.html",
      url: "https://fouladbonyan.com/guide/",
      rootAttributes: 'data-page="guide"',
      seoTitle: guideIndex.seoTitle,
      seoDescription: guideIndex.seoDescription,
      h1: guideIndex.title,
      breadcrumbDepth: 2,
    },
    ...guidePageKeys.map((key) => ({
      path: `guide/${key}/index.html`,
      url: `https://fouladbonyan.com/guide/${key}/`,
      rootAttributes: `data-page="guide" data-guide="${key}"`,
      seoTitle: guidePageDefinitions[key].seoTitle,
      seoDescription: guidePageDefinitions[key].seoDescription,
      h1: guidePageDefinitions[key].title,
      breadcrumbDepth: 3,
    })),
  ];

  const titles = new Set();
  const h1s = new Set();
  const canonicals = new Set();
  const descriptions = new Set();

  for (const page of pages) {
    const html = await readDist(page.path);

    // Unique title / description / canonical
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.equal(title, page.seoTitle, `${page.path} title`);
    titles.add(title);
    assert.match(
      html,
      new RegExp(
        `<link rel="canonical" href="${page.url.replace(/\//g, "\\/")}" />`,
      ),
      `${page.path} must have a self-referential canonical`,
    );
    canonicals.add(page.url);
    const description = html.match(
      /<meta\s+name="description"\s+content="([^"]+)"/,
    )?.[1];
    assert.equal(description, page.seoDescription, `${page.path} description`);
    descriptions.add(description);

    // Exactly one H1, and it is this page's own
    const allH1s = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/g) ?? [];
    assert.equal(allH1s.length, 1, `${page.path} must contain exactly one H1`);
    assert.match(
      html,
      new RegExp(`<h1[^>]*>${page.h1}</h1>`),
      `${page.path} must render its own H1`,
    );
    h1s.add(page.h1);

    // Meaningful content is present before any JavaScript runs
    assert.match(
      html,
      new RegExp(`<div id="root" ${page.rootAttributes}>[\\s\\S]+<\\/div>`),
      `${page.path} #root must be prerendered with content`,
    );
    assert.match(
      html,
      /class="breadcrumb-nav"/,
      `${page.path} must contain DOM breadcrumb navigation`,
    );
    assert.match(
      html,
      /<script id="initial-guide-data" type="application\/json">/,
      `${page.path} must embed the derived reference payload for hydration`,
    );
    // No homepage markup may leak in through the prerender step.
    assert.doesNotMatch(
      html,
      /class="overview-table"|id="overview-table"/,
      `${page.path} must not inherit homepage sections`,
    );

    // BreadcrumbList JSON-LD matching the visible trail
    const breadcrumbLd = parseBreadcrumbLd(
      html,
      `${page.path} must have BreadcrumbList JSON-LD`,
    );
    assert.equal(
      breadcrumbLd.itemListElement.length,
      page.breadcrumbDepth,
      `${page.path} breadcrumb depth`,
    );
    assert.equal(breadcrumbLd.itemListElement[0].name, "صفحه اصلی");
    assert.equal(breadcrumbLd.itemListElement[1].name, guideIndex.title);
    assert.equal(
      breadcrumbLd.itemListElement.at(-1).item,
      page.url,
      `${page.path} breadcrumb must end on itself`,
    );

    // Guide pages are informational, not Organization/Product carriers
    assert.doesNotMatch(html, /<script id="organization-structured-data"/);
    assert.doesNotMatch(html, /"@type":"FAQPage"/);
    // These pages render no hero, so they must not inherit its preload hint.
    assert.doesNotMatch(
      html,
      /id="hero-image-preload"/,
      `${page.path} must not preload a hero image it never renders`,
    );

    // Sitemap
    assert.match(
      sitemap,
      new RegExp(`<loc>${page.url.replace(/\//g, "\\/")}</loc>`),
      `${page.path} must be listed in the sitemap`,
    );
  }

  assert.equal(titles.size, pages.length, "guide titles must be distinct");
  assert.equal(h1s.size, pages.length, "guide H1s must be distinct");
  assert.equal(canonicals.size, pages.length, "canonicals must be distinct");
  assert.equal(
    descriptions.size,
    pages.length,
    "guide descriptions must be distinct",
  );
});

test("F10: guide content is real reference material linked into the product tree", async () => {
  const rebarChart = await readDist("guide/rebar-weight-chart/index.html");
  const beamChart = await readDist("guide/beam-weight-chart/index.html");
  const ribbedVsPlain = await readDist(
    "guide/ribbed-vs-plain-rebar/index.html",
  );
  const beamTypes = await readDist("guide/ipe-vs-hash-beam/index.html");
  const units = await readDist("guide/units-and-quote-specs/index.html");
  const guideHome = await readDist("guide/index.html");

  // Weight tables are rendered as real tables, in the HTML, with many rows.
  for (const [name, html] of [
    ["rebar-weight-chart", rebarChart],
    ["beam-weight-chart", beamChart],
  ]) {
    assert.match(html, /<table class="guide-table">/, `${name} needs a table`);
    const bodyRows = html.match(/<tr><th scope="row">/g) ?? [];
    assert.ok(
      bodyRows.length >= 9,
      `${name} rendered only ${bodyRows.length} table rows`,
    );
  }

  // The rebar chart states the formula it uses and the branch weight column.
  assert.match(rebarChart, /مجذور قطر \(میلی‌متر\) ÷ ۱۶۲/);
  assert.match(rebarChart, /وزن شاخه ۱۲ متری \(کیلوگرم\)/);
  assert.match(rebarChart, /تعداد شاخه در هر تن/);

  // The beam chart quotes mills by name rather than computing a weight.
  assert.match(beamChart, /class="guide-mill-list"/);
  assert.match(beamChart, /ذوب آهن/);
  // Missing هاش weights are disclosed instead of invented.
  assert.match(beamChart, /چرا جدول وزن هاش اینجا نیست/);

  // Every guide links into the catalog it describes.
  const outboundLinks = [
    ["rebar-weight-chart", rebarChart, ["/rebar/", "/rebar/ribbed/", "/rebar/simple/"]],
    ["beam-weight-chart", beamChart, ["/beam/beam/", "/beam/hash/"]],
    ["ribbed-vs-plain-rebar", ribbedVsPlain, ["/rebar/", "/rebar/ribbed/", "/rebar/simple/"]],
    ["ipe-vs-hash-beam", beamTypes, ["/beam/", "/beam/beam/", "/beam/hash/"]],
    ["units-and-quote-specs", units, ["/quote-process/#quote-form"]],
  ];
  for (const [name, html, hrefs] of outboundLinks) {
    for (const href of hrefs) {
      assert.match(
        html,
        new RegExp(`href="${href.replace(/[/#]/g, (c) => `\\${c}`)}"`),
        `${name} must link to ${href}`,
      );
    }
  }

  // The index links to each guide, and the homepage/category knowledge
  // sections link the index (the redesigned footer no longer does).
  for (const key of guidePageKeys) {
    assert.match(
      guideHome,
      new RegExp(`href="/guide/${key}/"`),
      `guide index must link to ${key}`,
    );
  }
  for (const [name, html] of [
    ["homepage", await readDist("index.html")],
    ["rebar category", await readDist("rebar/index.html")],
  ]) {
    assert.match(
      html,
      /<a href="\/guide\/" class="knowledge-action-btn">/,
      `${name} must link to the guide index via the knowledge section`,
    );
  }
});
