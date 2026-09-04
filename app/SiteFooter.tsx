import GlassSurface, { type GlassSurfaceProps } from "./GlassSurface";
import { LightPillar } from "./LightPillar";
import { WhatsAppIcon } from "./icons";
import { footerQuickLinks, siteConfig } from "./site-config";
import { Brand } from "./site-ui";

/*
 * Sales lines are judged by look, not order: repeated digits and round
 * endings read as "prettier" in Iranian phone-number culture. This maps
 * `siteConfig.contact.phones` indices to display slots so the prettiest
 * number (the one already used as the primary CTA number, index 0) anchors
 * the center, flanked by the next-prettiest, with the two plainer numbers
 * pushed to the outer edges.
 */
const phoneDisplayOrder = [3, 2, 0, 1, 4] as const;

/*
 * Two tunings of the same material — the refraction half. Large panes bend a
 * light pillar visibly around their rim; small objects use a shallower scale so
 * a 2.6rem pill does not read as a lens. The pane's box and its frost/saturation
 * are rules in `globals/footer.css`, not props: a style attribute would be
 * blocked by the site's `style-src 'self'`.
 */
const largeGlass = {
  distortionScale: -48,
  redOffset: 0,
  greenOffset: 0.6,
  blueOffset: 1.2,
  borderWidth: 0.07,
  blur: 6,
} satisfies Partial<GlassSurfaceProps>;

const smallGlass = {
  distortionScale: -15,
  redOffset: 0,
  greenOffset: 0.2,
  blueOffset: 0.4,
  borderWidth: 0.08,
  blur: 4,
} satisfies Partial<GlassSurfaceProps>;

type SiteFooterProps = {
  topHref?: string;
};

export function SiteFooter({ topHref = "#top" }: SiteFooterProps) {
  const workingHours = siteConfig.contact.workingHours;

  return (
    <footer className="site-footer" id="contact">
      <LightPillar />

      <div className="shell footer-shell">
        <div className="footer-primary">
          <GlassSurface
            className="fg-glass fg-glass--brand"
            {...largeGlass}
          >
            <section className="footer-card footer-card--brand">
              {/* The raster logo carries dark lettering, which is unreadable on
                  this base -- the text lockup is the legible one here. */}
              <Brand href="/" />
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
            {...largeGlass}
          >
            <nav className="footer-card footer-card--nav" aria-labelledby="footer-nav-quick">
              <p className="footer-card-title" id="footer-nav-quick">
                دسترسی سریع
              </p>
              <ul className="footer-link-list">
                {footerQuickLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </GlassSurface>

          <GlassSurface
            className="fg-glass fg-glass--nav"
            {...largeGlass}
          >
            <nav className="footer-card footer-card--nav" aria-labelledby="footer-nav-mgmt">
              <p className="footer-card-title" id="footer-nav-mgmt">
                تماس با مدیریت
              </p>
              <ul className="footer-link-list footer-link-list--contacts">
                {siteConfig.contact.management.map((contact) => (
                  <li key={contact.href}>
                    <a href={contact.href}>
                      <span className="footer-contact-name">{contact.name}</span>
                      <span className="footer-contact-number" dir="ltr">
                        {contact.label}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </GlassSurface>

          <GlassSurface
            className="fg-glass fg-glass--cta"
            {...largeGlass}
          >
            <section className="footer-card footer-card--cta">
              <span className="footer-cta-tag">مشاوره و خرید</span>
              <p className="footer-card-title">استعلام و پیش‌فاکتور</p>
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
            <p className="footer-lines-title">خطوط ارتباطی واحد فروش</p>
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

          <ul className="footer-lines-list footer-lines-list--spread">
            {phoneDisplayOrder.map((phoneIndex) => {
              const phone = siteConfig.contact.phones[phoneIndex];
              return (
                <li key={phone.href}>
                  <GlassSurface
                    className={
                      phoneIndex === 0 ? "fg-pill fg-pill--primary" : "fg-pill"
                    }
                    {...smallGlass}
                  >
                    <a className="fg-pill-link" href={phone.href} dir="ltr">
                      {phone.label}
                    </a>
                  </GlassSurface>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="footer-base">
          <div className="footer-base-contact">
            {siteConfig.contact.officialEmail ? (
              <GlassSurface
                className="fg-chip fg-chip--link"
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
              © {new Date().getFullYear().toLocaleString("fa-IR", { useGrouping: false })} {siteConfig.brand.name} · کلیه حقوق محفوظ است.
            </span>
            <a href="/privacy/">حریم خصوصی</a>
            <a href="/terms/">شرایط استفاده</a>
            <a href="/shipping-delivery/">شرایط ارسال</a>
            <a href="/complaints/">ثبت شکایت</a>
            <a className="footer-top-link" href={topHref}>
              بازگشت به بالا <span aria-hidden="true">↑</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
