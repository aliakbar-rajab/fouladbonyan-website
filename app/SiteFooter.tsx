import { WhatsAppIcon } from "./icons";
import {
  managementContacts,
  officialEmail,
  phones,
  shortAddress,
  whatsappCommunityUrl,
} from "./contact-data";
import { siteConfig } from "./site-config";
import { Brand } from "./site-ui";
import { Strands } from "./Strands";

const quickAccessLinks = [
  { href: "/", label: "صفحه اصلی" },
  { href: "/#products", label: "محصولات فولادی" },
  { href: "/#prices", label: "قیمت روز آهن و فولاد" },
  { href: "/quote-process/", label: "درخواست پیش‌فاکتور" },
  { href: "/contact/", label: "تماس با ما" },
] as const;

const infoPageLinks = [
  { href: "/about/", label: "درباره ما" },
  { href: "/shipping-delivery/", label: "ارسال و تحویل" },
  { href: "/terms/", label: "شرایط استفاده" },
  { href: "/privacy/", label: "حریم خصوصی" },
  { href: "/complaints/", label: "ثبت شکایت و پیگیری" },
] as const;

type SiteFooterProps = {
  homeHref?: string;
  topHref?: string;
};

export function SiteFooter({
  homeHref = "/",
  topHref = "#top",
}: SiteFooterProps) {
  const workingHours = siteConfig.contact.workingHours;

  return (
    <footer className="site-footer" id="contact">
      <div className="footer-strands-layer" aria-hidden="true">
        <Strands
          colors={["#F59E0B", "#D97706", "#FBBF24", "#E06B22", "#38BDF8", "#B45309"]}
          count={5}
          speed={0.09}
          amplitude={1.15}
          waviness={0.85}
          thickness={0.72}
          glow={0.88}
          taper={0.0}
          spread={1.9}
          intensity={0.58}
          saturation={1.3}
          opacity={0.85}
          scale={1.35}
          glass={false}
          refraction={1}
          dispersion={1}
          glassSize={1}
          hueShift={0}
        />
      </div>

      <div className="shell footer-shell">
        <div className="footer-cards-grid">
          {/* Brand & Community Card */}
          <div className="footer-card footer-card-brand">
            <Brand headerLogo href={homeHref} />
            <p className="footer-brand-desc">
              تأمین تخصصی مقاطع فولادی ساختمانی و صنعتی با تضمین اصالت کالا و مشاوره فنی.
            </p>
            <a
              className="footer-whatsapp-btn"
              href={whatsappCommunityUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="footer-whatsapp-icon" aria-hidden="true">
                <WhatsAppIcon />
              </span>
              <span className="footer-whatsapp-text">عضویت در کانال واتساپ</span>
            </a>
          </div>

          {/* Quick Access Card */}
          <div className="footer-card footer-card-nav">
            <h2 className="footer-card-title">دسترسی سریع</h2>
            <nav aria-label="لینک‌های دسترسی سریع فوتر" className="footer-nav-list">
              {quickAccessLinks.map((link) => (
                <a href={link.href} key={link.href} className="footer-nav-link">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Guide & Policies Card */}
          <div className="footer-card footer-card-nav">
            <h2 className="footer-card-title">راهنما و قوانین</h2>
            <nav aria-label="لینک‌های راهنما و قوانین فوتر" className="footer-nav-list">
              {infoPageLinks.map((link) => (
                <a href={link.href} key={link.href} className="footer-nav-link">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Direct Consultation Card */}
          <div className="footer-card footer-card-consultation">
            <div className="footer-consultation-top">
              <span className="footer-consultation-tag">مشاوره و خرید</span>
              <h3 className="footer-consultation-heading">استعلام و پیش‌فاکتور</h3>
            </div>
            <p className="footer-consultation-desc">
              کارشناسان فروش برای استعلام لحظه‌ای و صدور پیش‌فاکتور آماده‌اند.
            </p>
            {workingHours ? (
              <div className="footer-hours-row">
                <span aria-hidden="true" className="footer-hours-icon">◷</span>
                <span>{workingHours}</span>
              </div>
            ) : null}
            <a className="footer-call-btn" href={phones[0].href} dir="ltr">
              <span>{phones[0].label}</span>
              <span className="footer-call-btn-icon" aria-hidden="true">☎</span>
            </a>
          </div>
        </div>

        {/* Sales Communication & Contact Section (Discrete Glass Elements) */}
        <div className="footer-contact-zone" id="phone-numbers">
          <div className="footer-contact-header">
            <div className="footer-contact-title-wrap">
              <h2 className="footer-contact-main-title">خطوط ارتباطی واحد فروش</h2>
              <span className="footer-contact-sub-title">پاسخگویی سریع کارشناسان در ساعات کاری</span>
            </div>
            <a className="footer-contact-hub-link" href="/contact/">
              <span>مشاهده نقشه و نشانی کامل</span>
              <span aria-hidden="true">←</span>
            </a>
          </div>

          <div className="footer-phones-grid">
            {phones.map((phone, idx) => (
              <a href={phone.href} key={phone.href} dir="ltr" className="footer-phone-pill">
                <span className="footer-phone-num">{phone.label}</span>
                <span className="footer-phone-tag">خط {idx + 1}</span>
              </a>
            ))}
          </div>

          <div className="footer-contact-footer-bar">
            <div className="footer-meta-group">
              {officialEmail ? (
                <a className="footer-meta-chip" href={`mailto:${officialEmail}`} dir="ltr">
                  <span aria-hidden="true">✉</span>
                  <span>{officialEmail}</span>
                </a>
              ) : null}
              <address className="footer-meta-chip">
                <span aria-hidden="true">📍</span>
                <span>{shortAddress}</span>
              </address>
            </div>

            <div className="footer-management-group">
              <span className="footer-management-tag">مدیریت:</span>
              <div className="footer-management-chips">
                {managementContacts.map((contact) => (
                  <span className="footer-management-chip" key={contact.href}>
                    <strong>{contact.name}:</strong>
                    <a href={contact.href} dir="ltr">
                      {contact.label}
                    </a>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="footer-bottom">
          <span className="footer-copyright">
            © ۲۰۲۰ بنیان فولاد داریا · کلیه حقوق محفوظ است.
          </span>
          <div className="footer-bottom-links">
            <a href="/privacy/">حریم خصوصی</a>
            <a href="/terms/">شرایط استفاده</a>
            <a href={topHref} className="footer-back-to-top">
              بازگشت به بالا ↑
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

