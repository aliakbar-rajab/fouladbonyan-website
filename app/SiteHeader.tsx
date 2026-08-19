import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand } from "./site-ui";
import { LightPillar } from "./LightPillar";
import { MenuIcon, CloseIcon, PhoneIcon } from "./icons";
import { siteConfig } from "./site-config";

/*
 * One header for every route. App.tsx, ContactPage.tsx and InnerPageLayout.tsx
 * each carried their own copy of this markup, which is why they had drifted
 * apart into three slightly different bars. The navigation is the only part
 * that genuinely differs per route, so it arrives as a render prop and the
 * chrome around it lives here once.
 *
 * The bar is two bands: identity plus the two actions on top, navigation
 * beneath. Both are full-bleed, so the rule between them spans the whole
 * viewport instead of stopping under the logo the way the old grid-scoped
 * nav row did.
 */
type SiteHeaderProps = {
  brandHref?: string;
  navLabel?: string;
  renderNav: (args: {
    mobileOpen: boolean;
    closeMobileNav: () => void;
  }) => ReactNode;
};

const QUOTE_HREF = "/quote-process/#quote-form";

export function SiteHeader({
  brandHref = "#top",
  renderNav,
}: SiteHeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  /*
   * Above the nav-toggle breakpoint, the identity band scrolls away with the
   * page and only `.header-nav` stays pinned -- a plain CSS `position:
   * sticky` on that band, no JS involved. Below it, navigation lives behind
   * the toggle button in this same band, so the whole header has to stay
   * reachable instead of scrolling off; `compact` is what lets it give most
   * of its height back once the reader has left the top, without losing the
   * toggle. A sentinel above the header drives that state: an
   * IntersectionObserver fires twice per visit, where a scroll listener would
   * run on every frame.
   */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver !== "function") return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <>
      <div className="header-sentinel" ref={sentinelRef} aria-hidden="true" />

      <header
        className={`site-header${compact ? " is-compact" : ""}${mobileNavOpen ? " is-nav-open" : ""}`}
        id="top"
      >
        <LightPillar />

        <div className="header-bar">
          <div className="shell header-bar-inner">
            <Brand headerLogo href={brandHref} />

            <div className="header-actions">
              {/*
                Labelled explicitly because the copy beside the icon is hidden
                below 1080px, which would otherwise leave a tel: link whose
                whole accessible name was a decorative glyph. The label repeats
                the visible text so it still satisfies label-in-name where the
                copy is shown.
              */}
              <a
                className="header-phone"
                href={siteConfig.contact.phones[0].href}
                aria-label={`تماس با واحد فروش ${siteConfig.contact.phones[0].label}`}
              >
                <PhoneIcon className="header-phone-icon" />
                <span className="header-phone-copy">
                  <small>تماس با واحد فروش</small>
                  <b dir="ltr">{siteConfig.contact.phones[0].label}</b>
                </span>
              </a>

              <button
                className="nav-toggle"
                type="button"
                aria-expanded={mobileNavOpen}
                aria-controls="primary-navigation"
                aria-label={mobileNavOpen ? "بستن فهرست" : "فهرست اصلی"}
                onClick={() => setMobileNavOpen((open) => !open)}
              >
                {mobileNavOpen ? (
                  <CloseIcon className="nav-toggle-icon" />
                ) : (
                  <MenuIcon className="nav-toggle-icon" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/*
        Outside `<header>` on purpose: a `position: sticky` box can only stay
        stuck while its own parent's box is still in the scrollport, and the
        identity band above is short. Sitting here instead, its containing
        block is the page-spanning wrapper around header+main+footer, so it
        stays stuck for the whole scroll. `.site-header.is-nav-open` (a
        sibling selector, since this is no longer a descendant) still finds
        it for the mobile drawer. The quote CTA sits beside the navigation
        rather than in the bar: it is the one solid yellow element on the
        header, and on a phone it then falls inside the collapsible panel as
        a full-width button instead of fighting the logo for a 375px row.
      */}
      <div className="header-nav">
        <LightPillar />

        <div className="shell header-nav-inner">
          {renderNav({ mobileOpen: mobileNavOpen, closeMobileNav })}

          <a
            className="header-quote"
            href={QUOTE_HREF}
            onClick={closeMobileNav}
          >
            درخواست پیش‌فاکتور
          </a>
        </div>
      </div>
    </>
  );
}
