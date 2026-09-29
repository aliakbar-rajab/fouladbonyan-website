import { QUOTE_FORM_HREF } from "./quote-handoff";
import { useEffect, type ReactNode } from "react";
import { siteConfig } from "./site-config";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { PrimaryNav } from "./site-ui";
import { Breadcrumb } from "./Breadcrumb";
import { pageBreadcrumb, pageHead } from "./site-page";
import { siteRoutePath, type SiteRoute } from "./site-route";

/**
 * The shared chrome for every non-catalog page: header, hero, content shell and
 * footer. Extracted from InfoPage so the /guide/ reference pages render inside
 * exactly the same frame instead of a second copy of it.
 */
export type InnerPageLayoutProps = {
  /** The page this frame is for: its <title>, trail and nav mark come from it. */
  route: SiteRoute;
  eyebrow: string;
  title: string;
  description: string;
  /** Extra class on the content grid, for pages that need their own rules. */
  contentClassName?: string;
  children: ReactNode;
};

export function InnerPageLayout({
  route,
  eyebrow,
  title,
  description,
  contentClassName,
  children,
}: InnerPageLayoutProps) {
  // The same title the build stamps into <head>, so hydration never retitles
  // the tab. The primary nav marks this page when it is one it lists.
  const documentTitle = pageHead(route).title;
  const currentHref = siteRoutePath(route);

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
          <PrimaryNav currentHref={currentHref} onLinkClick={closeMobileNav} />
        )}
      />
      <main id="main-content" className="info-main">
        <section className="info-hero">
          <div className="shell">
            <Breadcrumb items={pageBreadcrumb(route)} />
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
        <a href={QUOTE_FORM_HREF}>درخواست پیش‌فاکتور</a>
      </div>
    </div>
  );
}
