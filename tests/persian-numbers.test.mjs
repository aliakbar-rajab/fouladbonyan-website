import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPersianNumber,
  parsePersianNumber,
  rialToWords,
  toAsciiDigits,
  toPersianDigits,
} from "../app/persian-numbers.mjs";

test("toAsciiDigits converts Persian, Arabic, and mixed digits to ASCII", () => {
  assert.equal(toAsciiDigits("۰۱۲۳۴۵۶۷۸۹"), "0123456789");
  assert.equal(toAsciiDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
  assert.equal(toAsciiDigits("۱۲۳٤٥"), "12345");
  assert.equal(toAsciiDigits("شماره ۱۲-۳۴۵"), "شماره 12-345");
  assert.equal(toAsciiDigits(1234), "1234");
  assert.equal(toAsciiDigits(""), "");
  assert.equal(toAsciiDigits(null), "");
  assert.equal(toAsciiDigits(undefined), "");
});

test("toPersianDigits converts ASCII, Arabic, and mixed digits to Persian", () => {
  assert.equal(toPersianDigits("0123456789"), "۰۱۲۳۴۵۶۷۸۹");
  assert.equal(toPersianDigits("٠١٢٣٤٥٦٧٨٩"), "۰۱۲۳۴۵۶۷۸۹");
  assert.equal(toPersianDigits("021-88888280"), "۰۲۱-۸۸۸۸۸۲۸۰");
  assert.equal(toPersianDigits("امروز دوشنبه 26 مرداد"), "امروز دوشنبه ۲۶ مرداد");
  assert.equal(toPersianDigits(9876), "۹۸۷۶");
  assert.equal(toPersianDigits(""), "");
  assert.equal(toPersianDigits(null), "");
  assert.equal(toPersianDigits(undefined), "");
});

test("parsePersianNumber parses Latin, Persian, Arabic, and mixed digits", () => {
  assert.equal(parsePersianNumber("125"), 125);
  assert.equal(parsePersianNumber("۱۲۵"), 125);
  assert.equal(parsePersianNumber("١٢٥"), 125);
  assert.equal(parsePersianNumber("۱۲3٤5"), 12345);
  assert.equal(parsePersianNumber(42), 42);
  assert.equal(parsePersianNumber(0), 0);
  assert.equal(parsePersianNumber("۰"), 0);
  assert.equal(parsePersianNumber("0"), 0);
});

test("parsePersianNumber parses slash decimals, Arabic separators, and standard dots", () => {
  assert.equal(parsePersianNumber("12.5"), 12.5);
  assert.equal(parsePersianNumber("۱۲.۵"), 12.5);
  assert.equal(parsePersianNumber("١٢.٥"), 12.5);
  assert.equal(parsePersianNumber("7/5"), 7.5);
  assert.equal(parsePersianNumber("۷/۵"), 7.5);
  assert.equal(parsePersianNumber("۱٢/٣"), 12.3);
  assert.equal(parsePersianNumber("۲٫۵"), 2.5);
  assert.equal(parsePersianNumber("۰٫۷۵"), 0.75);
});

test("parsePersianNumber handles thousand separators in Persian and Latin formats", () => {
  assert.equal(parsePersianNumber("1,000"), 1000);
  assert.equal(parsePersianNumber("۱,۰۰۰"), 1000);
  assert.equal(parsePersianNumber("۱٬۲۵۰"), 1250);
  assert.equal(parsePersianNumber("۳۵٬۴۰۰٬۰۰۰"), 35400000);
  assert.equal(parsePersianNumber("1,250.75"), 1250.75);
  assert.equal(parsePersianNumber("۱٬۲۵۰/۷۵"), 1250.75);
});

test("parsePersianNumber trims whitespace and handles negative values", () => {
  assert.equal(parsePersianNumber("   ۱۰   "), 10);
  assert.equal(parsePersianNumber("  -۲۵  "), -25);
  assert.equal(parsePersianNumber("-۷/۵"), -7.5);
});

test("parsePersianNumber safely returns null for empty, noisy, or malformed inputs", () => {
  assert.equal(parsePersianNumber(""), null);
  assert.equal(parsePersianNumber("   "), null);
  assert.equal(parsePersianNumber("-"), null);
  assert.equal(parsePersianNumber(null), null);
  assert.equal(parsePersianNumber(undefined), null);
  assert.equal(parsePersianNumber("نامعتبر"), null);
  assert.equal(parsePersianNumber("12 متری"), null);
  assert.equal(parsePersianNumber("طول*1250"), null);
  assert.equal(parsePersianNumber("A3"), null);
  assert.equal(parsePersianNumber(Number.NaN), null);
  assert.equal(parsePersianNumber(Number.POSITIVE_INFINITY), null);
});

test("formatPersianNumber formats numbers with Persian numerals and fraction precision", () => {
  assert.equal(formatPersianNumber(1000), "۱٬۰۰۰");
  assert.equal(formatPersianNumber(35400000), "۳۵٬۴۰۰٬۰۰۰");
  assert.equal(formatPersianNumber(12.345, 2), "۱۲٫۳۵");
  assert.equal(formatPersianNumber(0), "۰");
  assert.equal(formatPersianNumber(null), "");
  assert.equal(formatPersianNumber(undefined), "");
  assert.equal(formatPersianNumber(Number.NaN), "");
});

test("rialToWords converts Rial amounts to Persian words accurately", () => {
  assert.equal(rialToWords(0), "صفر ریال");
  assert.equal(rialToWords(-100), "صفر ریال");
  assert.equal(rialToWords(null), "صفر ریال");
  assert.equal(rialToWords(undefined), "صفر ریال");
  assert.equal(rialToWords(Number.NaN), "صفر ریال");
  assert.equal(rialToWords(5), "پنج ریال");
  assert.equal(rialToWords(25), "بیست و پنج ریال");
  assert.equal(rialToWords(350), "سیصد و پنجاه ریال");
  assert.equal(rialToWords(1000), "یک هزار ریال");
  assert.equal(rialToWords(1250), "یک هزار و دویست و پنجاه ریال");
  assert.equal(
    rialToWords(250000000),
    "دویست و پنجاه میلیون ریال",
  );
  assert.equal(
    rialToWords(1234567890),
    "یک میلیارد و دویست و سی و چهار میلیون و پانصد و شصت و هفت هزار و هشتصد و نود ریال",
  );
});
