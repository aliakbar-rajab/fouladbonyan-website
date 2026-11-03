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
  /** The small label over the title; a page that does not need one omits it. */
  eyebrow?: string;
  title: string;
  description: string;
  /** Extra class on the content grid, for pages that need their own rules. */
  contentClassName?: string;
  /** Extra class on the hero band, e.g. the slim variant a tool page uses. */
  heroClassName?: string;
  /** Rendered inside the hero band under the description. */
  heroExtra?: ReactNode;
  /**
   * The fixed call/quote bar phones get. A page that brings its own bar (the
   * quote form shows its live total there) turns this one off.
   */
  mobileActions?: boolean;
  children: ReactNode;
};

export function InnerPageLayout({
  route,
  eyebrow,
  title,
  description,
  contentClassName,
  heroClassName,
  heroExtra,
  mobileActions = true,
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
        <section className={heroClassName ? `info-hero ${heroClassName}` : "info-hero"}>
          <div className="shell">
            <Breadcrumb items={pageBreadcrumb(route)} />
            {eyebrow ? <span>{eyebrow}</span> : null}
            <h1>{title}</h1>
            <p>{description}</p>
            {heroExtra}
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
      {mobileActions ? (
        <div className="mobile-actions" role="group" aria-label="اقدام‌های سریع">
          <a href={siteConfig.contact.phones[0].href}>
            <span aria-hidden="true">☎</span>
            تماس
          </a>
          <a href={QUOTE_FORM_HREF}>درخواست پیش‌فاکتور</a>
        </div>
      ) : null}
    </div>
  );
}
