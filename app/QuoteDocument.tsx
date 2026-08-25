import { useEffect, useRef } from "react";
import { PreparedRequestActions } from "./request-form-shared";
import { siteConfig } from "./site-config";
import { rialToWords } from "./persian-numbers";
import { quoteDisclaimer, type GeneratedQuote } from "./quote-types";
import { toPersianDigits } from "./catalog-utils";
import { parsePersianNumber } from "./quote-engine";

const formatRial = (value: number) => `${value.toLocaleString("fa-IR")} ریال`;

function formatQuoteQuantity(quantity: string) {
  const parsed = parsePersianNumber(quantity);
  return parsed !== null
    ? parsed.toLocaleString("fa-IR")
    : toPersianDigits(quantity);
}

export function QuoteDocument({
  quote,
  onCopy,
  copyMessage,
}: {
  quote: GeneratedQuote;
  onCopy: () => void;
  copyMessage: string;
}) {
  const calculableItems = quote.items.filter((item) => item.totalRial !== null);
  const emptyRowCount = Math.max(0, 8 - quote.items.length);
  const actionsRef = useRef<HTMLDivElement>(null);

  // The document replaces the submit button as the form's result, so move the
  // reader there once it exists.
  useEffect(() => {
    actionsRef.current?.focus();
  }, []);

  return (
    <section className="quote-document" aria-label="پیش‌نویس برآورد آماده چاپ">
      <div className="quote-document-actions" ref={actionsRef} tabIndex={-1}>
        <strong>پیش‌نویس برآورد غیرقطعی آماده است.</strong>
        <div className="quote-document-action-buttons">
          <button type="button" onClick={() => window.print()}>
            چاپ یا ذخیره PDF
          </button>
          <PreparedRequestActions
            onCopy={onCopy}
            copyLabel="کپی مشخصات درخواست"
            contactLabel="تماس با واحد فروش"
            contactHref={siteConfig.contact.phones[0].href}
          />
        </div>
        <p className="copy-status" role="status" aria-live="polite">
          {copyMessage}
        </p>
      </div>
      <div className="quote-print-viewport">
        <div className="quote-print-scroll">
          <article className="quote-print-sheet" dir="rtl">
            <header className="quote-print-header">
              <p className="quote-print-doc-title">برآورد قیمت غیرقطعی</p>
              <div className="quote-print-brand">
                <img src="/brand/bonyan-foulad-daria-logo.webp" alt="آرم شرکت" />
                <div className="quote-print-company">
                  <h2>{siteConfig.brand.name}</h2>
                  <span>تامین و استعلام محصولات فولادی</span>
                </div>
              </div>
              <dl className="quote-print-meta">
                <div>
                  <dt>تاریخ</dt>
                  <dd>{quote.date}</dd>
                </div>
                <div>
                  <dt>وضعیت</dt>
                  <dd>غیرقطعی</dd>
                </div>
              </dl>
            </header>

            <section className="quote-parties">
              <div className="quote-card" aria-label="مشخصات فروشنده">
                <header className="quote-card-head">مشخصات فروشنده</header>
                <div className="quote-card-grid">
                  <div className="quote-field quote-field-wide">
                    <span className="quote-field-label">نام</span>
                    <span className="quote-field-value">{siteConfig.brand.name}</span>
                  </div>
                  <div className="quote-field quote-field-wide">
                    <span className="quote-field-label">نشانی</span>
                    <span className="quote-field-value">
                      {siteConfig.business.address}، {siteConfig.business.city}
                    </span>
                  </div>
                  <div className="quote-field quote-field-wide">
                    <span className="quote-field-label">تلفن</span>
                    <span className="quote-field-value" dir="ltr">
                      {siteConfig.contact.phones.map((phone) => phone.label).join(" / ")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="quote-card" aria-label="مشخصات خریدار">
                <header className="quote-card-head">مشخصات خریدار</header>
                <div className="quote-card-grid">
                  <div className="quote-field quote-field-wide">
                    <span className="quote-field-label">نام</span>
                    <span className="quote-field-value">{quote.fullName}</span>
                  </div>
                  <div className="quote-field quote-field-wide">
                    <span className="quote-field-label">شهر مقصد</span>
                    <span className="quote-field-value">{quote.destination}</span>
                  </div>
                  <div className="quote-field quote-field-wide">
                    <span className="quote-field-label">تلفن</span>
                    <span className="quote-field-value" dir="ltr">
                      {toPersianDigits(quote.phone)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <div className="quote-table-frame">
              <table className="quote-print-table">
                <colgroup>
                  <col className="quote-col-row" />
                  <col className="quote-col-product" />
                  <col className="quote-col-qty" />
                  <col className="quote-col-unit" />
                  <col className="quote-col-unit-price" />
                  <col className="quote-col-total" />
                  <col className="quote-col-notes" />
                </colgroup>
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>شرح کالا</th>
                    <th>تعداد</th>
                    <th>واحد</th>
                    <th>مبلغ واحد (ریال)</th>
                    <th>مبلغ کل (ریال)</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, index) => (
                    <tr key={`${item.product}-${index}`}>
                      <td className="quote-cell-index">{(index + 1).toLocaleString("fa-IR")}</td>
                      <td className="quote-cell-product">{item.product}</td>
                      <td>{formatQuoteQuantity(item.quantity)}</td>
                      <td>{item.unit}</td>
                      <td>{item.unitPriceRial ? item.unitPriceRial.toLocaleString("fa-IR") : "استعلام فروش"}</td>
                      <td>{item.totalRial ? item.totalRial.toLocaleString("fa-IR") : "استعلام فروش"}</td>
                      <td>{item.dimensions || "-"}</td>
                    </tr>
                  ))}
                  {Array.from({ length: emptyRowCount }, (_, index) => (
                    <tr className="quote-print-empty-row" key={`empty-${index}`}>
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section className="quote-print-summary">
              <div className="quote-total-box">
                <div>
                  <span>جمع ردیف‌های قابل محاسبه</span>
                  <strong>{formatRial(quote.totalRial)}</strong>
                </div>
                <div>
                  <span>تعداد ردیف‌های برآوردشده</span>
                  <strong>
                    {calculableItems.length.toLocaleString("fa-IR")} از {quote.items.length.toLocaleString("fa-IR")}
                  </strong>
                </div>
                <div className="quote-total-final">
                  <span>جمع برآوردی پیش‌فاکتور</span>
                  <strong>{formatRial(quote.totalRial)}</strong>
                </div>
              </div>
              <div className="quote-amount-words">
                <span className="quote-amount-words-label">مبلغ به حروف</span>
                <span className="quote-amount-words-value">{rialToWords(quote.totalRial)}</span>
              </div>
              <div className="quote-print-notes">
                <p><strong>توضیحات خریدار:</strong> {quote.notes || "ندارد"}</p>
                <p>{quoteDisclaimer}</p>
              </div>
            </section>

            <footer className="quote-print-footer">
              <span>{siteConfig.brand.alternateName}</span>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}
