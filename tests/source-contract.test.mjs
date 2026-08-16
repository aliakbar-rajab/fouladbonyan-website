import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// app/globals.css is an @import index into app/globals/*.css (kept as
// separate files for maintainability). Tests assert against the resolved
// stylesheet, so read and concatenate the split files in import order —
// same order the build tool inlines them in.
const readGlobalsCss = async () => {
  const index = await read("../app/globals.css");
  const importedPaths = [...index.matchAll(/@import\s+"(\.\/globals\/[^"]+)";/g)].map(
    (match) => match[1],
  );
  const files = await Promise.all(
    importedPaths.map((path) => read(`../app/${path}`)),
  );
  return files.join("\n");
};

test("catalog snapshot producers stay independent from the React catalog presenter", async () => {
  const [catalogTypes, catalogData, productData, quotePricing, presenter] =
    await Promise.all([
      read("../app/catalog-types.ts"),
      read("../app/catalog-data.ts"),
      read("../app/product-price-data.ts"),
      read("../app/quote-pricing.ts"),
      read("../app/RebarPrices.tsx"),
    ]);

  assert.match(catalogTypes, /export type CatalogPriceData/);
  assert.match(catalogTypes, /export type CatalogCategory/);
  assert.match(catalogTypes, /export type CatalogViewRequest/);
  assert.match(presenter, /from "\.\/catalog-types"/);

  for (const source of [catalogData, productData, quotePricing]) {
    assert.match(source, /from "\.\/catalog-types"/);
    assert.doesNotMatch(source, /from "\.\/RebarPrices"/);
  }
});

test("brand, contact details, RTL, and palette match the approved contract", async () => {
  const [component, siteConfig, siteUi, html, css, preloader, headerLogo] = await Promise.all([
    read("../app/App.tsx"),
    read("../app/site-config.ts"),
    read("../app/site-ui.tsx"),
    read("../index.html"),
    readGlobalsCss(),
    read("../public/preloader/fb-preloader.js"),
    readFile(
      new URL(
        "../public/brand/bonyan-foulad-daria-logo.webp",
        import.meta.url,
      ),
    ),
  ]);
  const combined = `${component}\n${siteConfig}\n${siteUi}\n${html}\n${preloader}`;

  assert.match(html, /<html lang="fa" dir="rtl">/);
  assert.match(combined, /بنیان فولاد داریا/);
  assert.match(combined, /BONYAN FOULAD DARIA/);
  assert.doesNotMatch(combined, /Foolad/i);
  assert.match(siteConfig, /021-88888280/);
  assert.match(siteConfig, /021-88888780/);
  assert.match(siteConfig, /021-88888122/);
  assert.match(siteConfig, /021-88889005/);
  assert.match(siteConfig, /021-88889006/);
  assert.doesNotMatch(combined, /021-88888180|\+98-21-88888180/);
  assert.match(
    siteConfig,
    /آجودانیه پورابتهاج نبش لشکری ساختمان سرو واحد ۳۰۳/,
  );
  // officialEmail is confirmed as info@fouladbonyan.com; guard that it's the
  // only email address referenced anywhere across these brand-critical files.
  const emailMatches = combined.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? [];
  assert.deepEqual(new Set(emailMatches), new Set(["info@fouladbonyan.com"]));
  assert.match(css, /--brand-yellow:\s*#f6b500/i);
  assert.match(css, /--brand-dark:\s*#3b3b3e/i);
  assert.match(component, /<Brand headerLogo \/>/);
  assert.match(siteUi, /src="\/brand\/bonyan-foulad-daria-logo\.webp"/);
  assert.match(
    css,
    /\.header-main\s*\{[^}]*min-height:\s*8\.4rem/is,
  );
  assert.match(
    css,
    /\.brand-header-logo img\s*\{[^}]*width:\s*10\.5rem[^}]*height:\s*10\.5rem/is,
  );
  assert.deepEqual([...headerLogo.subarray(0, 4)], [0x52, 0x49, 0x46, 0x46]);
  assert.ok(headerLogo.length < 200_000);
});

test("request forms stay local and never simulate a confirmed submission", async () => {
  const [component, requestForms, quoteTypes, siteConfig, footer, workflow] = await Promise.all([
    read("../app/App.tsx"),
    read("../app/QuoteRequestForm.tsx"),
    read("../app/quote-types.ts"),
    read("../app/site-config.ts"),
    read("../app/SiteFooter.tsx"),
    read("../.github/workflows/pages.yml"),
  ]);

  assert.doesNotMatch(requestForms, /fetch\(|ثبت موفق|سفارش شما ثبت شد/);
  assert.doesNotMatch(workflow, /LEAD_ENDPOINT/);
  assert.match(requestForms, /اطلاعات این فرم در مرورگر شما آماده می‌شود/);
  assert.match(
    quoteTypes,
    /ثبت این درخواست به معنی ثبت سفارش، انعقاد قرارداد، تضمین موجودی یا قطعی‌شدن قیمت نیست/,
  );
  assert.match(siteConfig, /tel:\+982188888280/);
  assert.match(siteConfig, /tel:\+982188888780/);
  assert.match(siteConfig, /tel:\+982188888122/);
  assert.match(siteConfig, /tel:\+982188889005/);
  assert.match(siteConfig, /tel:\+982188889006/);
  assert.match(
    component,
    /\(max-width: 900px\) and \(hover: none\) and \(pointer: coarse\)/,
  );
  assert.match(
    component,
    /const contactHref = isDirectCallDevice\s*\?\s*siteConfig\.contact\.phones\[0\]\.href\s*:\s*"#phone-numbers"/,
  );
  assert.match(footer, /id="phone-numbers"/);
});

test("preloader is session-scoped and fail-open", async () => {
  const [html, css, script] = await Promise.all([
    read("../index.html"),
    read("../public/preloader/fb-preloader.css"),
    read("../public/preloader/fb-preloader.js"),
  ]);

  assert.match(html, /src="\/preloader\/fb-preloader\.js"/);
  assert.doesNotMatch(html, /\son\w+=/i);
  assert.doesNotMatch(css, /#fb-site\s*\{[^}]*opacity\s*:\s*0/is);
  assert.match(script, /sessionStorage/);
  assert.match(script, /prefers-reduced-motion/);
  assert.match(script, /window\.setTimeout\(showPlaybackPrompt,\s*8000\)/);
  assert.match(script, /<video[\s\S]*?autoplay[\s\S]*?preload="metadata"/);
  assert.match(script, /poster="\/preloader\/assets\/tr2-poster\.jpg"/);
  assert.match(script, /video\.muted = true/);
  assert.equal((script.match(/tr2\.mp4/g) ?? []).length, 1);
  assert.match(script, /video\?\.addEventListener\("ended", finish/);
  assert.match(script, /video\?\.addEventListener\("error", showPlaybackPrompt/);
  assert.match(script, /class="fb-preloader__play"/);
  assert.match(script, /skip\?\.focus\(\)/);
  assert.match(html, /href="\/fonts\/b-titr-bold\.woff"/);
  assert.match(css, /font-family:\s*"B Titr"/);
  assert.match(css, /url\("\/fonts\/b-titr-bold\.woff"\)/);
  assert.match(css, /\.fb-preloader__latin\s*\{[^}]*color:\s*#fff[^}]*Arial/is);
  assert.match(
    css,
    /\.fb-preloader__accent\s*\{[^}]*color:\s*#f6b500[^}]*font-size:\s*0\.75em/is,
  );
  assert.match(
    css,
    /\.fb-preloader__brand strong \.fb-preloader__accent\s*\{[^}]*font-size:\s*0\.5em/is,
  );
  assert.match(script, /<span>بنیان فولاد<\/span>/);
  assert.match(script, /class="fb-preloader__accent">داریا<\/span>/);
  assert.match(script, /<span>BONYAN FOULAD<\/span>/);
  assert.match(script, /class="fb-preloader__accent">DARIA<\/span>/);
});

test("core palette combinations meet WCAG AA contrast", () => {
  const relativeLuminance = (hex) => {
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
  };
  const ratio = (foreground, background) => {
    const values = [
      relativeLuminance(foreground),
      relativeLuminance(background),
    ].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };

  assert.ok(ratio("#222226", "#F6B500") >= 4.5);
  assert.ok(ratio("#FFFFFF", "#3B3B3E") >= 4.5);
  assert.ok(ratio("#65656C", "#FFFFFF") >= 4.5);
});

test("source exposes one H1 and complete social metadata", async () => {
  const [component, html, robots, sitemap] = await Promise.all([
    read("../app/HeroCarousel.tsx"),
    read("../index.html"),
    read("../public/robots.txt"),
    read("../public/sitemap.xml"),
  ]);

  assert.equal((component.match(/<h1[ >]/g) ?? []).length, 1);
  for (const token of [
    'rel="canonical"',
    'property="og:url"',
    'property="og:image"',
    'name="twitter:card"',
    'type="application/ld\\+json"',
    'http-equiv="Content-Security-Policy"',
  ]) {
    assert.match(html, new RegExp(token));
  }
  assert.match(robots, /Sitemap: https:\/\/fouladbonyan\.com\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/fouladbonyan\.com\/<\/loc>/);
});

test("mega-menu labels stay outside the document heading outline", async () => {
  const navigation = await read("../app/MegaMenu.tsx");

  assert.match(navigation, /id="product-navigation"/);
  assert.equal(
    (navigation.match(/className="mega-group-label"/g) ?? []).length,
    10,
  );
  assert.doesNotMatch(navigation, /<h[1-6]\b/);
});

test("mega-menu shares App mobile state and selection callbacks", async () => {
  const [app, navigation] = await Promise.all([
    read("../app/App.tsx"),
    read("../app/MegaMenu.tsx"),
  ]);

  assert.match(app, /onClick=\{toggleMobileNav\}/);
  assert.match(app, /mobileOpen=\{mobileNavOpen\}/);
  assert.match(app, /onMobileToggle=\{toggleMobileNav\}/);
  assert.match(app, /onMobileClose=\{closeMobileNav\}/);
  assert.match(app, /<CategoryGrid onSelectGroup=\{goToGroup\}/);
  assert.match(app, /onSelectGroup=\{goToGroup\}/);
  assert.match(app, /onSelectRebarView=\{goToRebarView\}/);
  assert.match(app, /onSelectBeamView=\{goToBeamView\}/);
  assert.match(app, /onSelectProductView=\{goToProductView\}/);
  assert.match(navigation, /hidden=\{isMobile && !props\.mobileOpen\}/);
  assert.doesNotMatch(navigation, /\[mobileNavOpen,\s*setMobileNavOpen\]/);
});

test("homepage hero uses sharp landscape images", async () => {
  const [component, categoryMeta, css] = await Promise.all([
    read("../app/HeroCarousel.tsx"),
    read("../app/category-meta.ts"),
    readGlobalsCss(),
  ]);
  assert.match(categoryMeta, /hero-rebar-1680\.jpg/);
  assert.match(categoryMeta, /hero-beam-1680\.jpg/);
  assert.match(categoryMeta, /hero-sheet-1680\.jpg/);
  assert.match(component, /width="1672"/);
  assert.match(component, /height="941"/);
  assert.match(
    component,
    /<h1>\s*<span>بنیان فولاد داریا؛<\/span>\s*<span>همراه مطمئن استعلام آهن و فولاد<\/span>\s*<\/h1>/,
  );
  assert.match(css, /\.hero h1 span\s*\{[^}]*display:\s*block/is);
});

test("about section does not render the square-profile photo", async () => {
  const component = await read("../app/App.tsx");
  const aboutSection = component.match(
    /<section className="about section"[\s\S]*?<\/section>/,
  )?.[0];

  assert.ok(aboutSection);
  assert.doesNotMatch(aboutSection, /about-visual|<img/);
});

test("homepage uses the supplied dense steel tread photo and cross-fades banners every 1.7 seconds", async () => {
  const [component, css, texture] = await Promise.all([
    read("../app/HeroCarousel.tsx"),
    readGlobalsCss(),
    readFile(
      new URL("../public/textures/dark-chequered-plate.png", import.meta.url),
    ),
  ]);

  assert.match(component, /const HERO_SLIDE_INTERVAL_MS = 1_700/);
  assert.match(
    component,
    /window\.setInterval\(\(\) => \{[\s\S]*?\}, HERO_SLIDE_INTERVAL_MS\)/,
  );
  assert.match(
    component,
    /heroSlides\.map\(\(item, index\) => \([\s\S]*?className=\{`hero-image\$\{/,
  );
  assert.match(
    css,
    /\.hero-image\s*\{[^}]*opacity:\s*0[^}]*transition:[^}]*opacity 650ms ease-in-out/is,
  );
  assert.match(css, /\.hero-image\.is-active\s*\{[^}]*opacity:\s*1/is);
  assert.doesNotMatch(css, /@keyframes hero-reveal/);
  assert.match(
    css,
    /nth-child\(even of \.rebar-row-group\)[\s\S]*?background:\s*#3b3b3e/is,
  );
  assert.match(
    css,
    /\.products::after\s*\{[^}]*url\("\/textures\/dark-chequered-plate\.png"\)/is,
  );
  assert.match(
    css,
    /\.products,\s*\.about\s*\{[^}]*background-color:\s*#3b3b3e/is,
  );
  assert.match(
    css,
    /\.products::after\s*\{[^}]*background-size:\s*auto,\s*2752px auto/is,
  );
  assert.match(
    css,
    /\.products \.section-heading h2,[\s\S]*?color:\s*var\(--white\)/,
  );
  assert.deepEqual([...texture.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.ok(texture.length > 5_000_000);
});

test("rebar prices are sourced, validated, and refreshed on a schedule", async () => {
  const [component, navigation, fetcher, workflow, priceData] = await Promise.all([
    read("../app/RebarPrices.tsx"),
    read("../app/MegaMenu.tsx"),
    read("../scripts/fetch-rebar-prices.mjs"),
    read("../.github/workflows/pages.yml"),
    read("../app/data/rebar-prices.json").then(JSON.parse),
  ]);

  assert.deepEqual(
    priceData.categories.map((category) => category.label).sort(),
    [
      "میلگرد آجدار",
      "میلگرد ساده",
      "میلگرد استیل",
      "میلگرد آلیاژی",
    ].sort(),
  );
  assert.match(component, /rebar-kind-tabs/);
  assert.match(component, /ارزش افزوده/);
  assert.match(component, /محاسبه وزن میلگرد/);
  assert.match(navigation, /قیمت میلگرد استیل/);
  assert.match(navigation, /قیمت میلگرد آلیاژی/);
  assert.match(navigation, /کارخانه‌های میلگرد/);
  assert.match(navigation, /سایزهای میلگرد/);
  assert.match(fetcher, /__NEXT_DATA__/);
  assert.match(fetcher, /www\.fooladiranian\.com\/productlist/);
  assert.doesNotMatch(fetcher, /existingDataIsUsable|console\.warn/);
  assert.match(fetcher, /validateCatalogPriceData/);
  assert.match(workflow, /schedule:/);
  // Runs hourly, Saturday-Thursday, 06:00-21:00 Asia/Tehran (matches the
  // Iranian market's active hours; Friday is skipped as a closed day).
  assert.match(workflow, /cron:\s*"0 6-21 \* \* 0-4,6"/);
  assert.match(workflow, /timezone:\s*"Asia\/Tehran"/);
  assert.equal(priceData.categories.length, 4);
  assert.ok(
    priceData.categories.every((category) =>
      category.factories.some((factory) => factory.rows.length > 0),
    ),
  );
});

test("beam and hash prices are sourced and exposed through the catalog", async () => {
  const [component, app, navigation, styles, fetcher, priceData, packageJson] =
    await Promise.all([
      read("../app/BeamPrices.tsx"),
      read("../app/App.tsx"),
      read("../app/MegaMenu.tsx"),
      readGlobalsCss(),
      read("../scripts/fetch-beam-prices.mjs"),
      read("../app/data/beam-prices.json").then(JSON.parse),
      read("../package.json").then(JSON.parse),
    ]);

  assert.deepEqual(
    priceData.categories.map((category) => category.label),
    ["تیرآهن", "تیرآهن هاش"],
  );
  assert.match(component, /beam-kind-tabs/);
  assert.match(component, /PriceCatalog/);
  assert.match(navigation, /قیمت هاش/);
  assert.match(navigation, /کارخانه‌های تیرآهن/);
  assert.match(navigation, /سایزهای تیرآهن/);
  assert.match(app, /<BeamPrices/);
  assert.match(styles, /grid-template-areas:\s*"other types factories sizes"/);
  assert.match(
    styles,
    /\.mega-other-products > div\s*\{[^}]*grid-template-columns:\s*1fr/is,
  );
  assert.match(fetcher, /__NEXT_DATA__/);
  assert.match(
    fetcher,
    /%D8%AA%DB%8C%D8%B1%D8%A2%D9%87%D9%86-%D9%87%D8%A7%D8%B4/,
  );
  assert.doesNotMatch(fetcher, /existingDataIsUsable|console\.warn/);
  assert.match(fetcher, /validateCatalogPriceData/);
  assert.match(packageJson.scripts["prices:update"], /prices:update:beam/);
  assert.equal(priceData.categories.length, 2);
  assert.ok(
    priceData.categories.every((category) =>
      category.factories.some((factory) => factory.rows.length > 0),
    ),
  );
  assert.ok(
    priceData.categories
      .find((category) => category.id === "beam")
      .factories.length >= 8,
  );
});

test("all remaining product groups expose complete live price catalogs", async () => {
  const [component, app, navigation, fetcher, priceData, packageJson] =
    await Promise.all([
      read("../app/ProductPrices.tsx"),
      read("../app/App.tsx"),
      read("../app/MegaMenu.tsx"),
      read("../scripts/fetch-product-prices.mjs"),
      read("../app/data/product-prices.json").then(JSON.parse),
      read("../package.json").then(JSON.parse),
    ]);

  assert.deepEqual(
    priceData.catalogs.map((catalog) => catalog.id),
    ["sheet", "profile", "pipe", "angle", "channel", "wire"],
  );
  assert.deepEqual(
    Object.fromEntries(
      priceData.catalogs.map((catalog) => [
        catalog.id,
        catalog.categories.length,
      ]),
    ),
    {
      sheet: 15,
      profile: 7,
      pipe: 10,
      angle: 1,
      channel: 1,
      wire: 6,
    },
  );
  const rows = priceData.catalogs.flatMap((catalog) =>
    catalog.categories.flatMap((category) =>
      category.factories.flatMap((factory) => factory.rows),
    ),
  );
  assert.ok(rows.length >= 1_500);
  assert.ok(
    priceData.catalogs.every((catalog) =>
      catalog.categories.every((category) =>
        category.factories.some((factory) => factory.rows.length > 0),
      ),
    ),
  );
  assert.ok(rows.some((row) => row.specifications?.length));
  assert.match(component, /PriceCatalog/);
  assert.match(app, /<ProductPrices/);
  assert.match(navigation, /loadProductPriceCatalog/);
  assert.match(navigation, /انواع \{megaCatalog\.label\}/);
  assert.match(fetcher, /__NEXT_DATA__/);
  assert.match(fetcher, /mapWithConcurrency/);
  assert.match(fetcher, /ورق-سیاه/);
  assert.match(fetcher, /پروفیل-صنعتی/);
  assert.match(fetcher, /لوله-مانیسمان/);
  assert.match(fetcher, /توری-حصاری/);
  assert.doesNotMatch(fetcher, /existingDataIsUsable|console\.warn/);
  assert.match(fetcher, /validateProductPricePayload/);
  assert.match(packageJson.scripts["prices:update"], /prices:update:products/);
});

test("CI workflow pins actions, limits write permissions by job, and no longer deploys to GitHub Pages", async () => {
  const workflow = await read("../.github/workflows/pages.yml");

  assert.doesNotMatch(
    workflow,
    /uses:\s+actions\/[\w-]+@v\d+\s*$/m,
  );
  assert.match(workflow, /permissions:\s*\{\}/);
  assert.match(
    workflow,
    /refresh:[\s\S]*?permissions:\s*\n\s+contents: write[\s\S]*?prices:update/,
  );
  assert.match(
    workflow,
    /refresh:[\s\S]*?prices:update[\s\S]*?git push origin HEAD:main/,
  );
  assert.doesNotMatch(workflow, /price-data/);

  // Hosting moved to Cloudflare Pages, which watches main directly, so this
  // workflow's job is CI verification (and the price refresh) only -- it
  // must not also try to publish to GitHub Pages.
  assert.doesNotMatch(workflow, /deploy-pages|configure-pages|github-pages/);
  assert.doesNotMatch(workflow, /^\s*deploy:/m);
  assert.match(workflow, /build:[\s\S]*?permissions:\s*\n\s+contents: read/);
});
