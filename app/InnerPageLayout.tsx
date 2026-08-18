import { useEffect, useState, type ReactNode } from "react";
import { siteConfig } from "./site-config";
import { LightPillar } from "./LightPillar";
import { SiteFooter } from "./SiteFooter";
import { Brand } from "./site-ui";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { useMediaQuery } from "./use-media-query";

/**
 * The shared chrome for every non-catalog page: header, hero, content shell and
 * footer. Extracted from InfoPage so the /guide/ reference pages render inside
 * exactly the same frame instead of a second copy of it.
 */
export type InnerPageLayoutProps = {
  documentTitle: string;
  eyebrow: string;
  title: string;
  description: string;
  breadcrumbItems: BreadcrumbItem[];
  /** Extra class on the content grid, for pages that need their own rules. */
  contentClassName?: string;
  children: ReactNode;
};

export function InnerPageLayout({
  documentTitle,
  eyebrow,
  title,
  description,
  breadcrumbItems,
  contentClassName,
  children,
}: InnerPageLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 900px)");

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div id="fb-site" className="inner-page">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>
      <div className="utility-bar" id="top">
        <div className="shell utility-inner">
          <p>مشاوره و استعلام تلفنی محصولات فولادی</p>
          <div role="group" aria-label="شماره‌های تماس">
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
        <div className="shell header-main inner-header-main">
          <Brand headerLogo href="/" />
          <a className="contact-header-catalog" href="/#products">
            <span>قیمت‌های اطلاع‌رسانی و مشخصات محصولات</span>
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
            <a href="/">صفحه اصلی</a>
            <a href="/#products">محصولات</a>
            <a href="/#prices">قیمت‌های اطلاع‌رسانی</a>
            <a href="/about/">درباره ما</a>
            <a href="/contact/">تماس با ما</a>
            <a className="nav-quote" href="/quote-process/#quote-form">
              درخواست پیش‌فاکتور
            </a>
          </nav>
        </div>
      </header>
      <main id="main-content" className="info-main">
        <section className="info-hero">
          <div className="shell">
            <Breadcrumb items={breadcrumbItems} />
            <span>{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </section>
        <div
          className={
            contentClassName ? `shell info-content ${contentClassName}` : "shell info-content"
          }
        >
          {children}
        </div>
      </main>
      <SiteFooter />
      <div className="mobile-actions" role="group" aria-label="اقدام‌های سریع">
        <a href={siteConfig.contact.phones[0].href}>
          <span aria-hidden="true">☎</span>
          تماس
        </a>
        <a href="/quote-process/#quote-form">درخواست پیش‌فاکتور</a>
      </div>
    </div>
  );
}
