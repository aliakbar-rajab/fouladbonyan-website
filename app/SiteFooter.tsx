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
      <div className="shell footer-main">
        <div className="footer-col-brand">
          <Brand headerLogo href={homeHref} />
          <p>
            معرفی، استعلام لحظه‌ای و تأمین انواع مقاطع فولادی ساختمانی و صنعتی با تضمین اصالت و مشاوره تخصصی.
          </p>
          <a
            className="footer-whatsapp-cta"
            href={whatsappCommunityUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="footer-whatsapp-badge" aria-hidden="true">
              <WhatsAppIcon />
            </span>
            <span className="footer-whatsapp-label">
              عضویت در کانال واتساپ
            </span>
          </a>
        </div>

        <div className="footer-col-quick">
          <h2>دسترسی سریع</h2>
          <nav aria-label="لینک‌های دسترسی سریع فوتر">
            {quickAccessLinks.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="footer-col-info">
          <h2>راهنما و قوانین</h2>
          <nav aria-label="لینک‌های راهنما و قوانین فوتر">
            {infoPageLinks.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="footer-col-consultation">
          <div className="footer-consultation-card">
            <span className="footer-consultation-badge">مشاوره و خرید</span>
            <h3>استعلام تلفنی و پیش‌فاکتور</h3>
            <p>
              کارشناسان فروش برای اعلام موجودی و صدور پیش‌فاکتور آماده پاسخگویی هستند.
            </p>
            {workingHours ? (
              <div className="footer-hours-pill">
                <span aria-hidden="true">◷</span>
                <span>ساعات کاری: {workingHours}</span>
              </div>
            ) : null}
            <a className="footer-call-action" href={phones[0].href} dir="ltr">
              <span>{phones[0].label}</span>
              <span className="footer-call-icon" aria-hidden="true">☎</span>
            </a>
          </div>
        </div>
      </div>

      <div className="footer-contact-strip" id="phone-numbers">
        <div className="shell footer-contact-strip-inner">
          <div className="footer-strip-header">
            <h2 className="footer-strip-title">خطوط ارتباطی واحد فروش</h2>
            <span className="footer-strip-subtitle">پاسخگویی سریع در ساعات کاری</span>
          </div>

          <div className="footer-phones">
            {phones.map((phone, idx) => (
              <a href={phone.href} key={phone.href} dir="ltr" className="footer-phone-pill">
                <span className="footer-phone-num">{phone.label}</span>
                <span className="footer-phone-tag">خط {idx + 1}</span>
              </a>
            ))}
          </div>

          <div className="footer-contact-secondary">
            <div className="footer-contact-meta">
              {officialEmail ? (
                <a className="footer-meta-item" href={`mailto:${officialEmail}`} dir="ltr">
                  <span aria-hidden="true">✉</span>
                  <span>{officialEmail}</span>
                </a>
              ) : null}
              <address className="footer-meta-item">
                <span aria-hidden="true">📍</span>
                <span>{shortAddress}</span>
              </address>
              <a className="footer-contact-page-link" href="/contact/">
                <span>مشاهده صفحه کامل تماس و نقشه</span>
                <span aria-hidden="true">←</span>
              </a>
            </div>

            <div className="footer-management">
              <span className="footer-management-label">تماس با مدیریت:</span>
              <div className="footer-management-list">
                {managementContacts.map((contact) => (
                  <span className="footer-management-item" key={contact.href}>
                    <strong className="footer-contact-name">
                      {contact.name}:
                    </strong>
                    <a href={contact.href} dir="ltr">
                      {contact.label}
                    </a>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shell footer-bottom">
        <span>© ۲۰۲۰ بنیان فولاد داریا · کلیه حقوق محفوظ است.</span>
        <span className="footer-bottom-links">
          <a href="/privacy/">حریم خصوصی</a>
          <a href="/terms/">شرایط استفاده</a>
          <a href={topHref}>بازگشت به بالا ↑</a>
        </span>
      </div>
    </footer>
  );
}

