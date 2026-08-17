import { useState } from "react";
import { Brand } from "./site-ui";
import { Breadcrumb } from "./Breadcrumb";
import { WhatsAppIcon } from "./icons";
import { useMediaQuery } from "./use-media-query";
import { localizeCatalogValue } from "./catalog-utils";
import {
  buildGoogleMapsUrl,
  buildWazeUrl,
  siteConfig,
} from "./site-config";
import { LightPillar } from "./LightPillar";
import { SiteFooter } from "./SiteFooter";

const googleMapsUrl = buildGoogleMapsUrl(siteConfig.officeCoordinates);
const wazeUrl = buildWazeUrl(siteConfig.officeCoordinates);

const mapDestinations = [
  {
    label: "مسیریابی با نشان",
    href: siteConfig.neshanShareUrl,
  },
  {
    label: "مسیریابی با گوگل‌مپ",
    href: googleMapsUrl,
  },
  {
    label: "مسیریابی با ویز",
    href: wazeUrl,
  },
];

export default function ContactPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 900px)");

  return (
    <div id="fb-site">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>

      <div className="utility-bar" id="top">
        <div className="shell utility-inner">
          <p>مشاوره و استعلام تلفنی محصولات فولادی</p>
          <div aria-label="شماره‌های تماس">
            {siteConfig.contact.phones.map((phone) => (
              <a href={phone.href} key={phone.href} dir="ltr">
                {phone.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <header className="site-header">
        <LightPillar />

        <div className="shell header-main">
          <Brand headerLogo href="/" />
          <a className="contact-header-catalog" href="/#products">
            <span>قیمت روز مقاطع فولادی و اطلاعات محصولات</span>
            <strong>مشاهده محصولات</strong>
          </a>
          <a className="header-phone" href={siteConfig.contact.phones[0].href}>
            <span aria-hidden="true">☎</span>
            <span>
              <small>تماس با واحد فروش</small>
              <b dir="ltr">{siteConfig.contact.phones[0].label}</b>
            </span>
          </a>
          <button
            className="nav-toggle"
            type="button"
            aria-expanded={mobileNavOpen}
            aria-controls="primary-navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span aria-hidden="true">{mobileNavOpen ? "×" : "☰"}</span>
            <span className="sr-only">فهرست اصلی</span>
          </button>
        </div>

        <div className="nav-wrap">
          <nav
            className="shell primary-nav"
            id="primary-navigation"
            aria-label="فهرست اصلی"
            hidden={isMobile && !mobileNavOpen}
          >
            <a href="/" onClick={() => setMobileNavOpen(false)}>
              صفحه اصلی
            </a>
            <a href="/#products" onClick={() => setMobileNavOpen(false)}>
              قیمت روز محصولات
            </a>
            <a href="/#prices" onClick={() => setMobileNavOpen(false)}>
              راهنمای استعلام
            </a>
            <a href="/about/" onClick={() => setMobileNavOpen(false)}>
              درباره ما
            </a>
            <a aria-current="page">تماس با ما</a>
            <a className="nav-quote" href="/quote-process/#quote-form">
              درخواست پیش‌فاکتور
            </a>
          </nav>
        </div>
      </header>

      <main id="main-content" className="contact-main">
        <section className="contact-hero">
          <div className="shell">
            <Breadcrumb
              items={[
                { label: "صفحه اصلی", href: "/" },
                { label: "تماس با ما" },
              ]}
            />
            <span className="contact-hero-eyebrow">بنیان فولاد داریا</span>
            <h1 className="contact-hero-title">تماس با ما</h1>
          </div>
        </section>

        <section className="contact-body">
          <div className="shell contact-body-grid">
            <div className="contact-info-panel">
              <div className="contact-info-row">
                <span className="contact-info-icon" aria-hidden="true">
                  ☎
                </span>
                <div>
                  <h2>شماره‌های تماس</h2>
                  <ul className="contact-phone-list">
                    {siteConfig.contact.phones.map((phone) => (
                      <li key={phone.href}>
                        <a href={phone.href} dir="ltr">
                          {phone.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="contact-info-row">
                <span className="contact-info-icon" aria-hidden="true">
                  ✉
                </span>
                <div>
                  <h2>ایمیل رسمی</h2>
                  {siteConfig.contact.officialEmail ? (
                    <a href={`mailto:${siteConfig.contact.officialEmail}`}>
                      {siteConfig.contact.officialEmail}
                    </a>
                  ) : (
                    <p className="pending-owner-info">
                      پس از اعلام و تأیید مالک سایت درج می‌شود.
                    </p>
                  )}
                </div>
              </div>

              <div className="contact-info-row">
                <span
                  className="contact-info-icon contact-info-icon-whatsapp"
                  aria-hidden="true"
                >
                  <WhatsAppIcon />
                </span>
                <div>
                  <h2>کامیونیتی واتساپ</h2>
                  <a
                    className="contact-whatsapp-link"
                    href={siteConfig.contact.whatsappCommunityUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    عضویت در کانال واتساپ
                  </a>
                </div>
              </div>

              <div className="contact-info-row">
                <span className="contact-info-icon" aria-hidden="true">
                  ◷
                </span>
                <div>
                  <h2>ساعات کاری</h2>
                  {siteConfig.contact.workingHours ? (
                    <p>{siteConfig.contact.workingHours}</p>
                  ) : (
                    <p className="pending-owner-info">
                      پس از اعلام و تأیید مالک سایت درج می‌شود.
                    </p>
                  )}
                </div>
              </div>

              <div className="contact-info-row">
                <span className="contact-info-icon" aria-hidden="true">
                  👤
                </span>
                <div>
                  <h2>تماس با مدیریت</h2>
                  <ul className="contact-phone-list">
                    {siteConfig.contact.management.map((contact) => (
                      <li key={contact.href}>
                        <strong>{contact.name}</strong>
                        <a href={contact.href} dir="ltr">
                          {contact.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="contact-info-row">
                <span className="contact-info-icon" aria-hidden="true">
                  📍
                </span>
                <div>
                  <h2>نشانی دفتر</h2>
                  <address>
                    {siteConfig.business.address}
                    <br />
                    کد پستی {localizeCatalogValue(siteConfig.business.postalCode)}
                  </address>
                </div>
              </div>
            </div>

            <div className="contact-map-panel">
              <a
                className="map-visual"
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="نمایش مسیر دفتر بنیان فولاد داریا در گوگل‌مپ"
              >
                <svg
                  viewBox="0 0 640 320"
                  role="img"
                  aria-hidden="true"
                  className="map-visual-art"
                >
                  <defs>
                    <radialGradient id="mapGlow" cx="50%" cy="42%" r="75%">
                      <stop offset="0%" stopColor="#3a3b40" />
                      <stop offset="100%" stopColor="#232327" />
                    </radialGradient>
                  </defs>
                  <rect width="640" height="320" fill="url(#mapGlow)" />
                  <g stroke="#4a4a50" strokeWidth="2" fill="none" opacity="0.7">
                    <path d="M0 60 H640" />
                    <path d="M0 140 H640" />
                    <path d="M0 230 H640" />
                    <path d="M110 0 V320" />
                    <path d="M300 0 V320" />
                    <path d="M470 0 V320" />
                  </g>
                  <path
                    d="M0 190 C 140 150, 220 230, 320 190 S 520 130, 640 170"
                    stroke="#f6b500"
                    strokeOpacity="0.35"
                    strokeWidth="14"
                    fill="none"
                  />
                  <g transform="translate(320,150)">
                    <ellipse cx="0" cy="66" rx="30" ry="8" fill="rgb(0 0 0 / 40%)" />
                    <path
                      d="M0 0 C -26 0 -34 26 0 62 C 34 26 26 0 0 0 Z"
                      fill="#f6b500"
                      stroke="#232327"
                      strokeWidth="4"
                    />
                    <circle cx="0" cy="22" r="9" fill="#232327" />
                  </g>
                </svg>
                <span className="map-visual-caption">
                  <strong>{siteConfig.business.address}</strong>
                  <span>برای مسیریابی با گوگل‌مپ کلیک کنید</span>
                </span>
              </a>

              <div className="map-destinations">
                {mapDestinations.map((destination) => (
                  <a
                    key={destination.href}
                    href={destination.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {destination.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter topHref="/" />

      <div className="mobile-actions" aria-label="اقدام‌های سریع">
        <a href={siteConfig.contact.phones[0].href}>
          <span aria-hidden="true">☎</span>
          تماس
        </a>
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
          مسیریابی
        </a>
      </div>
    </div>
  );
}
