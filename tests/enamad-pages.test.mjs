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
import { calculateApproximateTotal } from "../app/quote-engine.ts";
import { loadQuotePriceEstimates } from "../app/quote-pricing.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("all required informational pages are defined and linked from the footer", async () => {
  const footer = await read("../app/SiteFooter.tsx");
  const expectedPages = [
    "about",
    "terms",
    "privacy",
    "quote-process",
    "complaints",
    "shipping-delivery",
  ];

  assert.deepEqual(Object.keys(infoPageDefinitions), expectedPages);
  for (const page of expectedPages) {
    assert.match(footer, new RegExp(`href: "/${page}/"`));
  }
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
  // The email and working hours are now confirmed, so neither should still
  // be listed among the still-missing required fields.
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

test("homepage navigation reaches the quote form directly", async () => {
  // The CTA moved out of MegaMenu into the shared header when the three
  // per-page copies of that header were collapsed into one component; the
  // requirement it guards -- one click from any page to the quote form -- is
  // unchanged.
  const header = await read("../app/SiteHeader.tsx");

  assert.match(header, /const QUOTE_HREF = "\/quote-process\/#quote-form";/);
  assert.match(
    header,
    /<a\s+className="header-quote"[\s\S]*?href=\{QUOTE_HREF\}[\s\S]*?درخواست پیش‌فاکتور/,
  );
});

test("quote estimates reuse site price data and calculate weight-based totals", async () => {
  assert.equal(calculateApproximateTotal(67_293, 1, "تن"), 67_293_000);
  assert.equal(calculateApproximateTotal(67_293, 10, "کیلوگرم"), 672_930);
  assert.equal(calculateApproximateTotal(67_293, 2, "شاخه"), null);
  assert.equal(calculateApproximateTotal(67_293, 2, "عدد"), null);

  const estimates = await loadQuotePriceEstimates();
  for (const product of ["میلگرد", "تیرآهن", "هاش", "ورق فولادی"]) {
    assert.ok(estimates[product], `missing estimate for ${product}`);
    assert.ok(estimates[product].unitPriceTomanPerKg > 0);
    assert.ok(estimates[product].rowCount > 0);
  }
});
