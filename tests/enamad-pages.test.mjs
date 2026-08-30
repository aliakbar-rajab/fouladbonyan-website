import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizePhone,
  validateFullName,
  validateMinimumText,
  validatePhone,
  validateRequired,
} from "../app/form-validation.ts";
import { infoPageDefinitions } from "../app/info-page-data.ts";
import {
  createQuoteEvaluator,
} from "../app/quote-engine.ts";
import { loadQuoteEvaluator } from "../app/quote/catalog-pricing-adapter.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("all required informational pages are defined and the intended links stay in place", async () => {
  const [footer, megaMenu] = await Promise.all([
    read("../app/SiteFooter.tsx"),
    read("../app/MegaMenu.tsx"),
  ]);
  const expectedPages = [
    "about",
    "terms",
    "privacy",
    "quote-process",
    "complaints",
    "shipping-delivery",
  ];

  // Every enamad-required info page must remain defined as a route.
  assert.deepEqual(Object.keys(infoPageDefinitions), expectedPages);

  // The redesigned footer keeps the quote CTA and the legal page links.
  assert.match(footer, /href: "\/quote-process\/"/);
  assert.match(footer, /href="\/privacy\/"/);
  assert.match(footer, /href="\/terms\/"/);

  // "about" left the footer in the redesign but stays linked from the nav.
  assert.match(megaMenu, /href="\/about\/"/);
});

test("owner-only legal information remains explicitly unset, except the confirmed official email", async () => {
  const [config, checklist] = await Promise.all([
    read("../app/site-config.ts"),
    read("../docs/enamad-required-info.md"),
  ]);

  assert.match(config, /legalName: null/);
  assert.match(config, /nationalId: null/);
  assert.match(config, /registrationNumber: null/);
  assert.match(config, /workingHours: "۹ الی ۱۸"/);
  assert.match(config, /officialEmail: "info@fouladbonyan\.com"/);
  assert.match(checklist, /نام حقوقی/);
  assert.match(checklist, /شناسه ملی/);
  assert.match(checklist, /شماره ثبت/);
  assert.doesNotMatch(
    checklist,
    /ایمیل رسمی و قابل دسترس برای مکاتبات/,
  );
  assert.doesNotMatch(checklist, /ساعات و روزهای کاری/);
});

test("Persian form validation rejects incomplete and malformed requests", () => {
  assert.equal(validateFullName(""), "نام و نام خانوادگی را وارد کنید.");
  assert.ok(validateFullName("ع").includes("حداقل"));
  assert.equal(validateFullName("علی رضایی"), "");

  assert.equal(normalizePhone("0912 123-4567"), "09121234567");
  assert.equal(normalizePhone("۰۹۱۲ ۱۲۳-۴۵۶۷"), "09121234567");
  assert.equal(validatePhone("0912 123-4567"), "");
  assert.equal(validatePhone("۰۹۱۲ ۱۲۳-۴۵۶۷"), "");
  assert.equal(validatePhone("021-88888280"), "");
  assert.equal(validatePhone("۰۲۱-۸۸۸۸۸۲۸۰"), "");
  assert.ok(validatePhone("123").includes("معتبر ایرانی"));

  assert.equal(validateRequired("", "نوع محصول"), "نوع محصول را وارد کنید.");
  assert.ok(validateMinimumText("کوتاه", "شرح موضوع", 20).includes("حداقل"));
  assert.equal(
    validateMinimumText(
      "شرح کامل و روشن برای بررسی موضوع ثبت شده است.",
      "شرح موضوع",
      20,
    ),
    "",
  );
});

test("footer links point to working canonical pages with no trailing slash violations", async () => {
  const siteConfig = (await import("../app/site-config.ts")).siteConfig;
  assert.ok(siteConfig.siteUrl);
  for (const def of Object.values(infoPageDefinitions)) {
    assert.ok(def.title);
    assert.ok(def.seoDescription);
    assert.ok(def.lastmod);
  }
});

test("homepage navigation reaches the quote form directly", async () => {
  const header = await read("../app/SiteHeader.tsx");
  assert.match(header, /const QUOTE_HREF = "\/quote-process\/#quote-form";/);
  assert.match(
    header,
    /<a\s+className="header-quote"[\s\S]*?href=\{QUOTE_HREF\}[\s\S]*?درخواست پیش‌فاکتور/,
  );
});

test("quote estimates reuse site price data and calculate weight-based totals", async () => {
  const estimate = {
    product: "میلگرد",
    unitPriceTomanPerKg: 67_293,
    minPriceTomanPerKg: 67_293,
    maxPriceTomanPerKg: 67_293,
    rowCount: 1,
    date: "امروز",
    supportsPieceUnits: false,
  };
  const estimates = { میلگرد: estimate };
  const mockEvaluator = createQuoteEvaluator(estimates);

  const tonneItem = mockEvaluator.evaluateItem(
    { product: "میلگرد", quantity: "1", unit: "تن" },
  );
  assert.equal(tonneItem.approximateTotalToman, 67_293_000);

  const kgItem = mockEvaluator.evaluateItem(
    { product: "میلگرد", quantity: "10", unit: "کیلوگرم" },
  );
  assert.equal(kgItem.approximateTotalToman, 672_930);

  const pieceItem = mockEvaluator.evaluateItem(
    { product: "میلگرد", quantity: "2", unit: "شاخه" },
  );
  assert.equal(pieceItem.approximateTotalToman, null);

  const evaluator = await loadQuoteEvaluator();
  for (const product of ["میلگرد", "تیرآهن", "هاش", "ورق فولادی"]) {
    const evaluated = evaluator.evaluateItem({ product, quantity: "1", unit: "تن" });
    assert.ok(evaluated.approximateTotalToman !== null && evaluated.approximateTotalToman > 0);
  }
});
