import {
  ChevronLeftBoldIcon,
  ClockFastIcon,
  IsometricCubeIcon,
  ShieldSecurityIcon,
  TargetPrecisionIcon,
} from "./icons";

export function QuoteCtaSection() {
  return (
    <section className="quote-section section" aria-labelledby="quote-heading">
      <div className="shell">
        <div className="quote-card">
          <div className="quote-card-dots" aria-hidden="true" />

          <div className="quote-content">
            <div className="quote-header">
              <h2 id="quote-heading" className="quote-title">
                مشخصات محصول{" "}
                <span className="quote-gold-highlight">موردنیاز</span> را آماده
                کنید
              </h2>
              <p className="quote-desc">
                نوع محصول، ابعاد، مقدار و سایر مشخصات را آماده کنید تا واحد فروش
                بتواند استعلام{" "}
                <span className="quote-gold-subtle">دقیق‌تری</span> ارائه کند.
              </p>
            </div>

            <div className="quote-features" role="list">
              <div className="quote-feature-item" role="listitem">
                <div className="quote-feature-icon" aria-hidden="true">
                  <TargetPrecisionIcon />
                </div>
                <div className="quote-feature-text">
                  <strong>استعلام دقیق‌تر</strong>
                  <span>پاسخ متناسب با تناژ و مشخصات</span>
                </div>
              </div>

              <div className="quote-feature-item" role="listitem">
                <div className="quote-feature-icon" aria-hidden="true">
                  <ClockFastIcon />
                </div>
                <div className="quote-feature-text">
                  <strong>صرفه‌جویی در زمان</strong>
                  <span>فرآیند سریع‌تر و هدفمند</span>
                </div>
              </div>

              <div className="quote-feature-item" role="listitem">
                <div className="quote-feature-icon" aria-hidden="true">
                  <ShieldSecurityIcon />
                </div>
                <div className="quote-feature-text">
                  <strong>اطلاعات امن</strong>
                  <span>محفوظ بودن مشخصات خرید</span>
                </div>
              </div>
            </div>
          </div>

          <div className="quote-divider" aria-hidden="true">
            <div className="quote-divider-node" />
          </div>

          <div className="quote-action">
            <div className="quote-badge" aria-hidden="true">
              <svg
                className="quote-hex-svg"
                viewBox="0 0 100 115"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon
                  points="50,2 96,28 96,87 50,113 4,87 4,28"
                  className="quote-hex-bg"
                />
                <polygon
                  points="50,2 96,28 96,87 50,113 4,87 4,28"
                  className="quote-hex-border"
                />
              </svg>
              <div className="quote-cube-wrapper">
                <IsometricCubeIcon className="quote-cube-icon" />
              </div>
            </div>

            <a href="/quote-process/#quote-form" className="quote-cta-btn">
              <span className="quote-btn-text">تکمیل فرم پیش‌سفارش</span>
              <ChevronLeftBoldIcon className="quote-btn-icon" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
