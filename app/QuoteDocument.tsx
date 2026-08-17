import { useEffect, useRef } from "react";
import { PreparedRequestActions } from "./request-form-shared";
import { siteConfig } from "./site-config";
import { rialToWords } from "./persian-numbers";
import { quoteDisclaimer, type GeneratedQuote } from "./quote-types";
import { toPersianDigits } from "./catalog-utils";

const formatRial = (value: number) =>
  `${value.toLocaleString("fa-IR")} ریال`;

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
          <img src="/brand/bonyan-foulad-daria-logo.webp" alt="بنیان فولاد داریا" />
          <div className="quote-print-company">
            <p>برآورد قیمت غیرقطعی</p>
            <h2>{siteConfig.brand.name}</h2>
            <span>تامین و استعلام محصولات فولادی</span>
          </div>
          <dl>
            <div><dt>تاریخ:</dt><dd>{quote.date}</dd></div>
            <div><dt>وضعیت:</dt><dd>غیرقطعی</dd></div>
          </dl>
        </header>

        <section className="quote-customer-details" aria-label="مشخصات خریدار">
          <p className="quote-customer-buyer">
            <strong>نام خریدار:</strong> {quote.fullName}
          </p>
          <div className="quote-customer-meta">
            <p><strong>شماره تماس:</strong> <b dir="ltr">{toPersianDigits(quote.phone)}</b></p>
            <p><strong>شهر مقصد:</strong> {quote.destination}</p>
          </div>
        </section>

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
                <td>{(index + 1).toLocaleString("fa-IR")}</td>
                <td>{item.product}</td>
                <td>{Number(item.quantity).toLocaleString("fa-IR")}</td>
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
          <div className="quote-print-notes">
            <p><strong>مبلغ به حروف:</strong> {rialToWords(quote.totalRial)}</p>
            <p><strong>توضیحات خریدار:</strong> {quote.notes || "ندارد"}</p>
            <p>{quoteDisclaimer}</p>
          </div>
        </section>

        <footer className="quote-print-footer">
          <address>
            <strong>نشانی:</strong> {siteConfig.business.address}، {siteConfig.business.city}<br />
            <strong>تلفن:</strong> <span dir="ltr">{siteConfig.contact.phones.map((phone) => phone.label).join(" - ")}</span>
          </address>
        </footer>
          </article>
        </div>
      </div>
    </section>
  );
}
