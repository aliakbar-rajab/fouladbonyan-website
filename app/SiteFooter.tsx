import GlassSurface, { type GlassSurfaceProps } from "./GlassSurface";
import { LightPillar } from "./LightPillar";
import { WhatsAppIcon } from "./icons";
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

/*
 * Two tunings of the same material. Large panes refract hard enough to bend a
 * light pillar visibly around their rim; small objects use a shallower scale so
 * a 2.6rem pill does not read as a lens.
 */
const largeGlass = {
  backgroundOpacity: 0.03,
  saturation: 0.92,
  distortionScale: -48,
  redOffset: 0,
  greenOffset: 0.6,
  blueOffset: 1.2,
  borderWidth: 0.07,
  blur: 6,
} satisfies Partial<GlassSurfaceProps>;

const smallGlass = {
  backgroundOpacity: 0.02,
  saturation: 0.94,
  distortionScale: -15,
  redOffset: 0,
  greenOffset: 0.2,
  blueOffset: 0.4,
  borderWidth: 0.08,
  blur: 4,
} satisfies Partial<GlassSurfaceProps>;

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
      <LightPillar />

      <div className="shell footer-shell">
        <div className="footer-primary">
          <GlassSurface
            className="fg-glass fg-glass--brand"
            borderRadius={18}
            {...largeGlass}
          >
            <section className="footer-card footer-card--brand">
              {/* The raster logo carries dark lettering, which is unreadable on
                  this base -- the text lockup is the legible one here. */}
              <Brand href={homeHref} />
              <p className="footer-brand-desc">
                تأمین تخصصی مقاطع فولادی ساختمانی و صنعتی با تضمین اصالت کالا و
                مشاوره فنی.
              </p>
              <a
                className="footer-whatsapp"
                href={siteConfig.contact.whatsappCommunityUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="footer-whatsapp-icon" aria-hidden="true">
                  <WhatsAppIcon />
                </span>
                <span>عضویت در کانال واتساپ</span>
              </a>
            </section>
          </GlassSurface>

          <GlassSurface
            className="fg-glass fg-glass--nav"
            borderRadius={18}
            {...largeGlass}
          >
            <nav className="footer-card footer-card--nav" aria-labelledby="footer-nav-quick">
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
          </GlassSurface>

          <GlassSurface
            className="fg-glass fg-glass--nav"
            borderRadius={18}
            {...largeGlass}
          >
            <nav className="footer-card footer-card--nav" aria-labelledby="footer-nav-info">
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
          </GlassSurface>

          <GlassSurface
            className="fg-glass fg-glass--cta"
            borderRadius={18}
            {...largeGlass}
          >
            <section className="footer-card footer-card--cta">
              <span className="footer-cta-tag">مشاوره و خرید</span>
              <h2 className="footer-card-title">استعلام و پیش‌فاکتور</h2>
              <p className="footer-cta-desc">
                کارشناسان فروش برای استعلام لحظه‌ای و صدور پیش‌فاکتور آماده‌اند.
              </p>
              <a className="footer-call" href={siteConfig.contact.phones[0].href} dir="ltr">
                <span className="footer-call-icon" aria-hidden="true">
                  ☎
                </span>
                <span>{siteConfig.contact.phones[0].label}</span>
              </a>
            </section>
          </GlassSurface>
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
            {siteConfig.contact.phones.map((phone) => (
              <li key={phone.href}>
                <GlassSurface className="fg-pill" borderRadius={13} {...smallGlass}>
                  <a className="fg-pill-link" href={phone.href} dir="ltr">
                    {phone.label}
                  </a>
                </GlassSurface>
              </li>
            ))}
            {siteConfig.contact.management.map((contact) => (
              <li className="footer-line-item--named" key={contact.href}>
                <GlassSurface
                  className="fg-pill fg-pill--named"
                  borderRadius={13}
                  {...smallGlass}
                >
                  <a className="fg-pill-link" href={contact.href}>
                    <span className="fg-pill-name">{contact.name}</span>
                    <span dir="ltr">{contact.label}</span>
                  </a>
                </GlassSurface>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-base">
          <div className="footer-base-contact">
            {siteConfig.contact.officialEmail ? (
              <GlassSurface
                className="fg-chip fg-chip--link"
                width="auto"
                borderRadius={11}
                {...smallGlass}
              >
                <a
                  className="fg-chip-content"
                  href={`mailto:${siteConfig.contact.officialEmail}`}
                  dir="ltr"
                >
                  <span aria-hidden="true">✉</span>
                  {siteConfig.contact.officialEmail}
                </a>
              </GlassSurface>
            ) : null}
            <GlassSurface
              className="fg-chip"
              width="auto"
              borderRadius={11}
              {...smallGlass}
            >
              <address className="fg-chip-content">
                <span aria-hidden="true">⌖</span>
                {siteConfig.business.shortAddress}
              </address>
            </GlassSurface>
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
