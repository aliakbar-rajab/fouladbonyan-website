import { ChevronLeftBoldIcon } from "./icons";

export function QuoteCtaSection() {
  return (
    <section
      className="quote-section section"
      aria-labelledby="quote-heading"
    >
      <div className="shell quote-layout">
        <div className="quote-intro">
          <h2 id="quote-heading">مشخصات محصول موردنیاز را آماده کنید</h2>
          <p>
            نوع محصول، ابعاد، مقدار و سایر مشخصات را آماده کنید تا واحد فروش
            بتواند استعلام دقیق‌تری ارائه کند.
          </p>
        </div>
        <div className="quote-action">
          <a href="/quote-process/#quote-form" className="quote-cta-btn">
            <span>تکمیل فرم پیش‌سفارش</span>
            <ChevronLeftBoldIcon className="quote-btn-icon" />
          </a>
        </div>
      </div>
    </section>
  );
}
