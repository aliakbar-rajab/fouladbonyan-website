import { useEffect, useLayoutEffect, useRef } from "react";
import { PreparedRequestActions } from "./request-form-shared";
import { siteConfig } from "./site-config";
import {
  formatPersianNumber,
  parsePersianNumber,
  rialToWords,
  toPersianDigits,
} from "./persian-numbers.mjs";
import {
  buildFallbackPage,
  buildInvoicePages,
  preparePrinting,
  SHEET_WIDTH_PX,
} from "./quote-invoice-pages";
import {
  quoteDisclaimer,
  type GeneratedQuote,
  type GeneratedQuoteItem,
} from "./quote-types";

/*
 * The generated pre-invoice, in the standalone پیش‌فاکتور app's format.
 *
 * The markup below is the app's print clone (its index.html sheet after
 * replaceFormControlsWithText): every input is the <span>, and every textarea
 * the <div>, that the app prints in its place, with the same classes, so its
 * stylesheet -- ported to globals/quote-print.css -- lays it out identically.
 * This sheet is only the source: quote-invoice-pages.ts clones it into the
 * A4 pages that are shown and printed, exactly as the app does.
 */

const LOGO_SRC = "/brand/bonyan-foulad-daria-mark-print.webp";
const DOCUMENT_TITLE = "پیش‌فاکتور";
/** A fresh landscape document in the app starts with seven item rows. */
const DEFAULT_ROW_COUNT = 7;

const seller = {
  name: siteConfig.brand.name,
  address: `${siteConfig.business.city}، ${siteConfig.business.address}`,
  postalCode: toPersianDigits(siteConfig.business.postalCode),
  nationalId: siteConfig.business.nationalId
    ? toPersianDigits(siteConfig.business.nationalId)
    : "",
  // The three lines the app's company profile prints.
  phones: siteConfig.contact.phones
    .slice(0, 3)
    .map((phone) => phone.label)
    .join(" / "),
  website: new URL(siteConfig.siteUrl).hostname.replace(/^(?!www\.)/, "www."),
};

const formatAmount = (value: number) => value.toLocaleString("fa-IR");

function formatQuantity(quantity: string) {
  const parsed = parsePersianNumber(quantity);
  return parsed !== null ? formatPersianNumber(parsed, 3) : toPersianDigits(quantity);
}

// The app turns every digit typed into a text field into a Persian one.
function describeItem(item: GeneratedQuoteItem) {
  const dimensions = item.dimensions.trim();
  return toPersianDigits(dimensions ? `${item.product} — ${dimensions}` : item.product);
}

function notesText(quote: GeneratedQuote) {
  const lines: string[] = [];
  if (quote.notes) lines.push(`توضیحات خریدار: ${quote.notes}`);
  if (quote.pricedItemCount < quote.items.length) {
    lines.push(
      `جمع کل فقط ${formatPersianNumber(quote.pricedItemCount)} ردیف از ${formatPersianNumber(quote.items.length)} ردیف را در بر می‌گیرد؛ مبلغ ردیف‌های «استعلام فروش» را واحد فروش اعلام می‌کند.`,
    );
  }
  lines.push(quoteDisclaimer);
  return toPersianDigits(lines.join("\n"));
}

const MetaIcons = {
  date: (
    <svg className="inv-meta-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 2v4M16 2v4M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </svg>
  ),
  number: (
    <svg className="inv-meta-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </svg>
  ),
  validity: (
    <svg className="inv-meta-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  seller: (
    <svg className="inv-card-head-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  ),
  buyer: (
    <svg className="inv-card-head-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
};

function PartyField({
  label,
  value,
  multiline = false,
  ltr = false,
  postal = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  ltr?: boolean;
  postal?: boolean;
}) {
  const className = multiline
    ? "inv-input inv-field-value inv-autogrow print-field-value"
    : "inv-input inv-field-value print-field-value";
  const Tag = multiline ? "div" : "span";
  return (
    <div className={postal ? "inv-field inv-field-wide inv-field-postal" : "inv-field inv-field-wide"}>
      <span className="inv-field-label">{label}</span>
      <Tag className={className} dir={ltr ? "ltr" : "rtl"}>
        {value}
      </Tag>
    </div>
  );
}

function InvoiceSourceSheet({ quote }: { quote: GeneratedQuote }) {
  const hasPricedRows = quote.pricedItemCount > 0;
  const money = (value: number) => (hasPricedRows ? `${formatAmount(value)} ریال` : "");
  const taxPercent =
    quote.taxRate === null
      ? ""
      : formatPersianNumber(Math.round(quote.taxRate * 10_000) / 100, 2);
  const words = hasPricedRows ? rialToWords(quote.payableRial) : "";
  const blankRows = Math.max(0, DEFAULT_ROW_COUNT - quote.items.length);

  return (
    <article className="invoice-sheet orientation-landscape header-gray" dir="rtl">
      <header className="inv-head">
        <p className="inv-doc-title inv-editable-field">{DOCUMENT_TITLE}</p>
        <div className="inv-brand">
          <span className="inv-logo-chip">
            <img alt="آرم شرکت" className="inv-logo" src={LOGO_SRC} />
          </span>
          <div className="inv-brand-text">
            <p className="inv-company-name-display inv-editable-field" dir="rtl">
              {seller.name}
            </p>
          </div>
        </div>
        <dl className="inv-meta">
          <div>
            <dt>
              {MetaIcons.date}
              <span>تاریخ</span>
            </dt>
            <dd>
              <span className="inv-input print-field-value" dir="ltr">
                {quote.date}
              </span>
            </dd>
          </div>
          <div>
            <dt>
              {MetaIcons.number}
              <span>شماره پیش‌فاکتور</span>
            </dt>
            <dd>
              <span className="inv-input print-field-value" dir="ltr">
                {quote.number}
              </span>
            </dd>
          </div>
          <div className="inv-meta-validity">
            <dt>
              {MetaIcons.validity}
              <span>اعتبار پیش‌فاکتور</span>
            </dt>
            <dd>
              {/* The app's default «پایان روز جاری»: valid to the end of the
                  issue date, which is what it prints. Site prices are daily. */}
              <span className="inv-input print-field-value" dir="ltr">
                {quote.date}
              </span>
            </dd>
          </div>
        </dl>
      </header>

      <section className="inv-parties">
        <div className="inv-card" aria-label="مشخصات فروشنده">
          <header className="inv-card-head">
            {MetaIcons.seller}
            مشخصات فروشنده
          </header>
          <div className="inv-card-grid">
            <PartyField label="نام شخص حقیقی / حقوقی" value={seller.name} />
            <PartyField label="نشانی" value={seller.address} multiline />
            <PartyField label="کد پستی" value={seller.postalCode} ltr postal />
            <PartyField label="شناسه ملی" value={seller.nationalId} ltr />
            <PartyField label="تلفن" value={seller.phones} multiline ltr />
          </div>
        </div>

        <div className="inv-card" aria-label="مشخصات خریدار">
          <header className="inv-card-head">
            {MetaIcons.buyer}
            مشخصات خریدار
          </header>
          <div className="inv-card-grid">
            <PartyField label="نام شخص حقیقی / حقوقی" value={toPersianDigits(quote.fullName)} />
            {/* The request asks for the destination city, not a full address. */}
            <PartyField label="نشانی" value={toPersianDigits(quote.destination)} multiline />
            <PartyField label="کد پستی" value="" ltr postal />
            <PartyField label="شناسه ملی" value="" ltr />
            <PartyField label="تلفن" value={toPersianDigits(quote.phone)} multiline ltr />
          </div>
        </div>
      </section>

      <div className="inv-table-frame">
        <table className="inv-table">
          <colgroup>
            <col className="inv-col-del inv-no-print" />
            <col className="inv-col-row" />
            <col className="inv-col-desc" />
            <col className="inv-col-qty" />
            <col className="inv-col-unit" />
            <col className="inv-col-price" />
            <col className="inv-col-total" />
          </colgroup>
          <thead>
            <tr>
              <th className="inv-no-print" />
              <th>ردیف</th>
              <th>شرح کالا یا خدمات</th>
              <th>تعداد / مقدار</th>
              <th>واحد</th>
              <th>مبلغ واحد (ریال)</th>
              <th>مبلغ کل (ریال)</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, index) => (
              <tr key={index}>
                <td className="inv-no-print" />
                <td className="row-index">
                  <span className="row-index-badge" />
                </td>
                <td>
                  <div
                    className="cell-input cell-textarea print-field-value"
                    data-row-field="description"
                  >
                    {describeItem(item)}
                  </div>
                </td>
                <td>
                  <span
                    className="cell-input cell-input-num print-field-value"
                    dir="ltr"
                    data-row-field="quantity"
                  >
                    {formatQuantity(item.quantity)}
                  </span>
                </td>
                <td>
                  <span className="cell-input print-field-value" data-row-field="unit">
                    {item.unit}
                  </span>
                </td>
                <td>
                  <span
                    className="cell-input cell-input-num print-field-value"
                    dir={item.unitPriceRial ? "ltr" : "rtl"}
                    data-row-field="unitPrice"
                  >
                    {item.unitPriceRial ? formatAmount(item.unitPriceRial) : "استعلام فروش"}
                  </span>
                </td>
                <td className="cell-computed" data-row-computed="total">
                  {item.totalRial ? formatAmount(item.totalRial) : ""}
                </td>
              </tr>
            ))}
            {Array.from({ length: blankRows }, (_, index) => (
              <tr key={`blank-${index}`}>
                <td className="inv-no-print" />
                <td className="row-index">
                  <span className="row-index-badge" />
                </td>
                <td>
                  <div
                    className="cell-input cell-textarea print-field-value"
                    data-row-field="description"
                  />
                </td>
                <td>
                  <span
                    className="cell-input cell-input-num print-field-value"
                    dir="ltr"
                    data-row-field="quantity"
                  />
                </td>
                <td>
                  <span className="cell-input print-field-value" data-row-field="unit" />
                </td>
                <td>
                  <span
                    className="cell-input cell-input-num print-field-value"
                    dir="ltr"
                    data-row-field="unitPrice"
                  />
                </td>
                <td className="cell-computed" data-row-computed="total" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="inv-summary">
        <div className="inv-totals">
          <div>
            <span>جمع کل</span>
            <strong data-total="grossTotal">{money(quote.totalRial)}</strong>
          </div>
          <div className="inv-tax-row">
            <span>
              مالیات و عوارض
              <span className="inv-tax-percent-wrap">
                (
                <span className="inv-input inv-tax-percent print-field-value" dir="ltr">
                  {taxPercent}
                </span>
                ٪)
              </span>
            </span>
            <strong data-total="taxTotal">{money(quote.taxRial)}</strong>
          </div>
          <div className="inv-total-final">
            <span>مبلغ قابل پرداخت</span>
            <strong data-total="netTotal">{money(quote.payableRial)}</strong>
          </div>
        </div>
        <section className={words ? "inv-amount-words" : "inv-amount-words is-empty"}>
          {/* The space between the two spans is the app's markup whitespace,
              and it is part of where the line breaks. */}
          <span className="inv-amount-words-label">مبلغ به حروف</span>{" "}
          <span className="inv-amount-words-value" data-total="netTotalWords">
            {words}
          </span>
        </section>
        <div className="inv-notes">
          <span className="inv-notes-label">توضیحات</span>
          <div className="inv-input inv-textarea print-field-value" dir="rtl">
            {notesText(quote)}
          </div>
        </div>

        {/* Left empty on purpose: this is an unsigned, auto-generated estimate,
            so the company stamp the app can print here stays off it. */}
        <div className="inv-signature-block inv-signature-buyer">
          <p className="inv-signature-label">مهر و امضای خریدار</p>
          <div className="inv-signature-area" />
        </div>
        <div className="inv-signature-block inv-signature-seller">
          <p className="inv-signature-label">مهر و امضای فروشنده</p>
          <div className="inv-signature-area" />
        </div>
      </section>

      <footer className="inv-footer">
        <p className="inv-footer-site">
          <span className="inv-input inv-footer-site-input print-field-value" dir="auto">
            {seller.website}
          </span>
        </p>
      </footer>
    </article>
  );
}

function ContinuationHead({ quote }: { quote: GeneratedQuote }) {
  return (
    <header className="print-continuation-head">
      <div className="print-continuation-brand">
        <img alt="" src={LOGO_SRC} />
        <strong>{seller.name}</strong>
      </div>
      <div className="print-continuation-title">ادامهٔ {DOCUMENT_TITLE}</div>
      <div className="print-continuation-meta">
        <div>شماره: {quote.number}</div>
        <div>
          تاریخ: {quote.date} · <span data-continuation-page />
        </div>
      </div>
    </header>
  );
}

/** Resolves once the sheet's face and the logo are ready to be measured. */
async function sheetAssetsReady(root: HTMLElement) {
  await Promise.all([
    document.fonts?.load('400 12px "Vazirmatn"'),
    document.fonts?.load('800 12px "Vazirmatn"'),
    ...Array.from(root.querySelectorAll("img")).map((image) =>
      image.decode().catch(() => undefined),
    ),
  ]);
  await document.fonts?.ready;
}

export function QuoteDocument({
  quote,
  preparedText,
  onCopy,
  copyMessage,
}: {
  quote: GeneratedQuote;
  /** The same summary the copy button puts on the clipboard. */
  preparedText: string;
  onCopy: () => void;
  copyMessage: string;
}) {
  const actionsRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const continuationRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  // The document replaces the submit button as the form's result, so move the
  // reader there once it exists.
  useEffect(() => {
    actionsRef.current?.focus();
  }, []);

  useEffect(() => {
    const pages = pagesRef.current;
    if (!pages) return;
    return preparePrinting(pages);
  }, []);

  // Real-size A4 sheets, scaled down to the width they are given -- the app's
  // fitSheetScale. The frame takes the scaled height; see .inv-pages-frame.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const pages = pagesRef.current;
    if (!frame || !pages) return;
    const fit = () => {
      // The exact width, rounded down: clientWidth rounds a fractional frame
      // up, and the sheet's edge then gets clipped by a pixel.
      const width = frame.getBoundingClientRect().width;
      const scale = Math.min(1, Math.floor((width / SHEET_WIDTH_PX) * 1e4) / 1e4);
      pages.style.setProperty("--inv-scale", String(scale));
      frame.style.height = `${Math.ceil(pages.offsetHeight * scale)}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    observer.observe(pages);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const sheet = sheetRef.current?.firstElementChild;
    const continuationHead = continuationRef.current?.firstElementChild;
    const mount = mountRef.current;
    const pages = pagesRef.current;
    if (!(sheet instanceof HTMLElement) || !(continuationHead instanceof HTMLElement)) return;
    if (!mount || !pages) return;

    let cancelled = false;
    void (async () => {
      await sheetAssetsReady(sheet);
      if (cancelled) return;
      const sources = { sheet, continuationHead, mount, number: quote.number };
      pages.replaceChildren(...(buildInvoicePages(sources) ?? [buildFallbackPage(sources)]));
    })();
    return () => {
      cancelled = true;
    };
  }, [quote]);

  return (
    <section className="quote-document" aria-label="پیش‌فاکتور آماده چاپ">
      <div className="quote-document-actions" ref={actionsRef} tabIndex={-1}>
        <strong>پیش‌فاکتور غیرقطعی آماده است.</strong>
        <div className="quote-document-action-buttons">
          <button type="button" onClick={() => window.print()}>
            چاپ یا ذخیره PDF
          </button>
          <PreparedRequestActions
            onCopy={onCopy}
            copyLabel="کپی مشخصات درخواست"
            contactLabel="تماس با واحد فروش"
            contactHref={siteConfig.contact.phones[0].href}
            emailTitle="درخواست پیش‌فاکتور غیرقطعی"
            emailBody={preparedText}
          />
        </div>
        <p className="copy-status" role="status" aria-live="polite">
          {copyMessage}
        </p>
      </div>

      <div className="inv-preview">
        <div className="inv-pages-frame" ref={frameRef}>
          {/*
            Filled by quote-invoice-pages.ts with the solved A4 pages.
            Focusable so a keyboard reader can reach the document they made.
          */}
          <div
            className="inv-pages"
            ref={pagesRef}
            role="region"
            aria-label="برگه‌های پیش‌فاکتور"
            tabIndex={0}
          />
        </div>
      </div>

      <div className="inv-measure" aria-hidden="true" inert>
        <div ref={sheetRef}>
          <InvoiceSourceSheet quote={quote} />
        </div>
        <div ref={continuationRef}>
          <ContinuationHead quote={quote} />
        </div>
        <div ref={mountRef} />
      </div>
    </section>
  );
}
