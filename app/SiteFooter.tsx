import { LightPillar } from "./LightPillar";
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
      <LightPillar
        topColor="#f6b500"
        bottomColor="#000000"
        intensity={0.8}
        rotationSpeed={0.2}
        glowAmount={0.003}
        pillarWidth={8}
        pillarHeight={0.3}
        noiseIntensity={0}
        pillarRotation={0}
        interactive={false}
        mixBlendMode="normal"
      />

      <div className="shell footer-shell">
        <div className="footer-primary">
          <section className="fg-glass footer-card footer-card--brand">
            {/* The raster logo carries dark lettering, which is unreadable on
                this base -- the text lockup is the legible one here. */}
            <Brand href={homeHref} />
            <p className="footer-brand-desc">
              تأمین تخصصی مقاطع فولادی ساختمانی و صنعتی با تضمین اصالت کالا و
              مشاوره فنی.
            </p>
            <a
              className="footer-whatsapp"
              href={whatsappCommunityUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="footer-whatsapp-icon" aria-hidden="true">
                <WhatsAppIcon />
              </span>
              <span>عضویت در کانال واتساپ</span>
            </a>
          </section>

          <nav className="fg-glass footer-card footer-card--nav" aria-labelledby="footer-nav-quick">
            <h2 className="footer-card-title" id="footer-nav-quick">
              دسترسی سریع
            </h2>
            <ul className="footer-link-list">
              {quickAccessLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="fg-glass footer-card footer-card--nav" aria-labelledby="footer-nav-info">
            <h2 className="footer-card-title" id="footer-nav-info">
              راهنما و قوانین
            </h2>
            <ul className="footer-link-list">
              {infoPageLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <section className="fg-glass footer-card footer-card--cta">
            <span className="footer-cta-tag">مشاوره و خرید</span>
            <h2 className="footer-card-title">استعلام و پیش‌فاکتور</h2>
            <p className="footer-cta-desc">
              کارشناسان فروش برای استعلام لحظه‌ای و صدور پیش‌فاکتور آماده‌اند.
            </p>
            <a className="footer-call" href={phones[0].href} dir="ltr">
              <span className="footer-call-icon" aria-hidden="true">
                ☎
              </span>
              <span>{phones[0].label}</span>
            </a>
          </section>
        </div>

        <div className="footer-lines" id="phone-numbers">
          <div className="footer-lines-head">
            <h2 className="footer-lines-title">خطوط ارتباطی واحد فروش</h2>
            {workingHours ? (
              <span className="footer-lines-hours">
                <span aria-hidden="true">◷</span> ساعات کاری {workingHours}
              </span>
            ) : null}
            <a className="footer-lines-map" href="/contact/">
              نقشه و نشانی کامل
              <span aria-hidden="true">←</span>
            </a>
          </div>

          <ul className="footer-lines-list">
            {phones.map((phone) => (
              <li key={phone.href}>
                <a className="fg-pill" href={phone.href} dir="ltr">
                  {phone.label}
                </a>
              </li>
            ))}
            {managementContacts.map((contact) => (
              <li className="footer-line-item--named" key={contact.href}>
                <a className="fg-pill fg-pill--named" href={contact.href}>
                  <span className="fg-pill-name">{contact.name}</span>
                  <span dir="ltr">{contact.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-base">
          <div className="footer-base-contact">
            {officialEmail ? (
              <a className="fg-chip" href={`mailto:${officialEmail}`} dir="ltr">
                <span aria-hidden="true">✉</span>
                {officialEmail}
              </a>
            ) : null}
            <address className="fg-chip">
              <span aria-hidden="true">⌖</span>
              {shortAddress}
            </address>
          </div>

          <div className="footer-base-legal">
            <span className="footer-copyright">
              © ۲۰۲۰ بنیان فولاد داریا · کلیه حقوق محفوظ است.
            </span>
            <a href="/privacy/">حریم خصوصی</a>
            <a href="/terms/">شرایط استفاده</a>
            <a className="footer-top-link" href={topHref}>
              بازگشت به بالا <span aria-hidden="true">↑</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
