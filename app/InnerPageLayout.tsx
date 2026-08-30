import { useEffect, type ReactNode } from "react";
import { siteConfig } from "./site-config";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { PrimaryNav } from "./site-ui";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

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

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div id="fb-site" className="inner-page">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>
      <SiteHeader
        brandHref="/"
        renderNav={({ closeMobileNav }) => (
          <PrimaryNav onLinkClick={closeMobileNav} />
        )}
      />
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
