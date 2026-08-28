import {
  BeamIcon,
  ChevronLeftBoldIcon,
  QuoteSpecsIcon,
  RebarChartIcon,
  TechnicalGuideIcon,
} from "./icons";

export function KnowledgeSection() {
  return (
    <section
      className="knowledge-section section"
      aria-labelledby="knowledge-heading"
    >
      <div className="shell">
        <div className="quote-card knowledge-card">
          <div className="quote-card-dots" aria-hidden="true" />

          <div className="quote-content knowledge-content">
            <div className="quote-header">
              <h2 id="knowledge-heading" className="quote-title">
                دانش فنی،{" "}
                <span className="quote-gold-highlight">پیش از استعلام</span>
              </h2>
              <p className="quote-desc">
                ابزارها و جدول‌های مرجع برای آماده‌کردن مشخصات خرید پیش از تماس
                با واحد فروش.
              </p>
            </div>

            <div className="knowledge-features" role="list">
              <a
                href="/guide/rebar-weight-chart/"
                className="knowledge-feature-card"
                role="listitem"
              >
                <div className="knowledge-feature-icon" aria-hidden="true">
                  <RebarChartIcon />
                </div>
                <div className="knowledge-feature-text">
                  <strong>جدول وزن میلگرد</strong>
                  <span>بررسی قطر، طول و وزن تقریبی</span>
                </div>
                <ChevronLeftBoldIcon className="knowledge-feature-arrow" />
              </a>

              <a
                href="/guide/beam-weight-chart/"
                className="knowledge-feature-card"
                role="listitem"
              >
                <div className="knowledge-feature-icon" aria-hidden="true">
                  <BeamIcon />
                </div>
                <div className="knowledge-feature-text">
                  <strong>جدول وزن تیرآهن</strong>
                  <span>مرجع وزن شاخه و سایز</span>
                </div>
                <ChevronLeftBoldIcon className="knowledge-feature-arrow" />
              </a>

              <a
                href="/guide/units-and-quote-specs/"
                className="knowledge-feature-card"
                role="listitem"
              >
                <div className="knowledge-feature-icon" aria-hidden="true">
                  <QuoteSpecsIcon />
                </div>
                <div className="knowledge-feature-text">
                  <strong>واحدها و مشخصات استعلام</strong>
                  <span>آماده‌سازی اطلاعات خرید</span>
                </div>
                <ChevronLeftBoldIcon className="knowledge-feature-arrow" />
              </a>
            </div>
          </div>

          <div className="quote-divider" aria-hidden="true">
            <div className="quote-divider-node" />
          </div>

          <div className="quote-action knowledge-action">
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
                <TechnicalGuideIcon className="quote-cube-icon" />
              </div>
            </div>

            <a href="/guide/" className="knowledge-action-btn">
              <span className="quote-btn-text">مرکز راهنمای فنی</span>
              <ChevronLeftBoldIcon className="quote-btn-icon" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
