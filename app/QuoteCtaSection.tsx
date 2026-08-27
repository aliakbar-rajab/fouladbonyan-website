import {
  ChevronLeftBoldIcon,
  ClockFastIcon,
  IsometricCubeIcon,
  ShieldSecurityIcon,
  TargetPrecisionIcon,
} from "./icons";

export function QuoteCtaSection() {
  return (
    <section
      className="quote-section section"
      aria-labelledby="quote-heading"
    >
      <div className="shell">
        <div className="quote-card">
          {/* Subtle Golden Glow and Micro-dot Texture (Pure CSS) */}
          <div className="quote-card-ambient" aria-hidden="true" />
          <div className="quote-card-dots" aria-hidden="true" />

          {/* Right Side: Header & Feature Highlights */}
          <div className="quote-content">
            <div className="quote-header">
              <h2 id="quote-heading" className="quote-title">
                مشخصات محصول <span className="quote-gold-highlight">موردنیاز</span> را آماده کنید
              </h2>
              <p className="quote-desc">
                نوع محصول، ابعاد، مقدار و سایر مشخصات را آماده کنید تا واحد فروش
                بتواند استعلام <span className="quote-gold-subtle">دقیق‌تری</span> ارائه کند.
              </p>
            </div>

            {/* 3 Quick Features */}
            <div className="quote-features" role="list">
              <div className="quote-feature-item" role="listitem">
                <span className="quote-feature-icon" aria-hidden="true">
                  <TargetPrecisionIcon />
                </span>
                <div className="quote-feature-text">
                  <strong>استعلام دقیق‌تر</strong>
                  <span>اطلاعات کامل = پاسخ دقیق</span>
                </div>
              </div>

              <div className="quote-feature-item" role="listitem">
                <span className="quote-feature-icon" aria-hidden="true">
                  <ClockFastIcon />
                </span>
                <div className="quote-feature-text">
                  <strong>صرفه‌جویی در زمان</strong>
                  <span>فرآیند سریع‌تر و هدفمند</span>
                </div>
              </div>

              <div className="quote-feature-item" role="listitem">
                <span className="quote-feature-icon" aria-hidden="true">
                  <ShieldSecurityIcon />
                </span>
                <div className="quote-feature-text">
                  <strong>اطلاعات امن</strong>
                  <span>اطلاعات شما محفوظ است</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delicate Vertical Divider with Glowing Center Node */}
          <div className="quote-divider" aria-hidden="true">
            <span className="quote-divider-node" />
          </div>

          {/* Left Side: Hex Badge + Golden Action Button */}
          <div className="quote-action">
            <div className="quote-badge" aria-hidden="true">
              <svg className="quote-hex-svg" viewBox="0 0 96 96" fill="none">
                <polygon
                  points="48,6 86,28 86,72 48,94 10,72 10,28"
                  className="quote-hex-bg"
                />
                <polygon
                  points="48,6 86,28 86,72 48,94 10,72 10,28"
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
