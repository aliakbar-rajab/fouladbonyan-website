---
target: homepage (app/App.tsx)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 1
timestamp: 2026-08-26T07-31-44Z
slug: app-app-tsx-homepage
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector+browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good loading/unavailable states; no per-row freshness timestamp on the overview table |
| 2 | Match Between System and Real World | 2 | Mixed-unit price ranges (شاخه / کیلوگرم combined into one range) break real-world mapping |
| 3 | User Control and Freedom | 3 | Clear "clear search"; no easy skip from the pre-content splash screen besides its own skip button |
| 4 | Consistency and Standards | 3 | Three near-duplicate product navigators (grid, tabs, table) stacked in one section |
| 5 | Error Prevention | 2 | An unscoped CSS rule shipped that breaks the About section on mobile |
| 6 | Recognition Rather Than Recall | 3 | Icons/labels on cards and tabs aid recognition |
| 7 | Flexibility and Efficiency of Use | 2 | No saved searches/shortcuts; factory/size filters only reachable via mega-menu |
| 8 | Aesthetic and Minimalist Design | 2 | Decorative glass/gradient/texture surfaces on nearly every section; dense for a lookup tool |
| 9 | Help Recognize/Diagnose/Recover from Errors | 2 | MarketPrices fallback copy points users the wrong direction |
| 10 | Help and Documentation | 3 | Dedicated weight-chart/spec guide section gives real pre-purchase help |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

Not a generic template: real product taxonomy (میلگرد/تیرآهن/ورق/قوطی و پروفیل/لوله/نبشی/ناودانی/مفتول), Persian-numeral toman pricing, IPE/UNP nomenclature, and an unusually well-documented, product-specific implementation (custom WebGL LightPillar, deliberate preloader UX, roving-tabindex tablist) all ground it in the steel trade. The deterministic scan found no systemic templated-slop pattern — its two real hits (a repeated mega-menu accent border, one dead CSS selector) are isolated, not scattered evidence of copy-paste sprawl. The one tension: the "cinematic liquid steel" visual system (frosted glass, SVG distortion, gradient meshes on nearly every surface) reads closer to a premium fintech dashboard than a steel yard, which may work against the gritty-trust signal a procurement/contractor buyer expects.

## Overall Impression

The engineering is genuinely careful — accessibility and performance patterns that most sites get wrong (roving tabindex, session-gated reduced-motion-aware preloader, responsive image pipeline, mobile card layout instead of a cramped table) are done correctly here. But two real defects sit on the default homepage view: a shipped CSS override breaks the About section's layout on every mobile visit, and the primary price table mixes two incompatible units into one number range. Beyond that, the page over-provides navigation (three routes to the same 8 categories) and undersells its own data (no per-row freshness).

## What's Working

- **Roving-tabindex product tablist** (`app/App.tsx` `moveTabFocus`, `app/catalog-utils.ts:48-59`): real `<a role="tab">` elements with Arrow/Home/End keyboard support, activation left to native Enter/click so the URL, `<title>`, and catalog stay in sync — not a faked SPA tab switcher.
- **MarketPrices' three explicit states** (loading/unavailable/ready) with `aria-live`/`role="alert"` handle a real stale-data scenario gracefully instead of showing broken UI.
- **Preloader engineering**: homepage-only, `sessionStorage`-gated to once per session, fully skips for `prefers-reduced-motion`, keyboard-focused skip button, `inert`/`aria-hidden` on the rest of the site while active, layered timeout fail-safes.
- **Responsive price table**: swaps to a dedicated mobile card layout instead of a horizontally-scrolling table.

## Priority Issues

**[P0] Mobile About section is squeezed unreadable by an unscoped CSS rule**
File: `app/globals/cinematic.css:930-932` — `.about-grid { grid-template-columns: minmax(0, 0.92fr) minmax(19rem, 0.68fr); }` has no media guard. `cinematic.css` is imported last in `app/globals.css`, so at equal specificity it overrides `app/globals/footer.css:877-879`'s `@media (max-width: 900px) { .about-grid { grid-template-columns: 1fr; } }`. Verified via live computed styles at 375px width: columns resolve to `47.1px 304px`, wrapping the About paragraph/feature-list text one word per line for several screens of scroll — right at the page's dedicated trust-building section.
Why it matters: every mobile visitor (the majority of traffic for a site with a bottom sticky action bar) hits a visibly broken section right after the price table.
Fix: wrap the `cinematic.css:930` rule in the same `min-width: 901px` guard used elsewhere in that file, or delete it if `footer.css`'s rule already covers desktop.

**[P0] Primary price table mixes two incompatible units into one range**
Files: `app/catalog-overview.ts:24-25` (`overviewUnit` returns the literal string `"شاخه / کیلوگرم"` for پیس/weight-priced groups), rendered by `app/SteelPriceOverview.tsx`. On the homepage's default view, تیرآهن shows "۸۵٬۵۰۰ تا ۵۳٬۱۸۱٬۸۰۰ تومان" under one "شاخه / کیلوگرم" unit label — a per-bar price and a per-kg price collapsed into a single range spanning three orders of magnitude.
Why it matters: this is the homepage's primary, default content for a price-lookup tool; a number range that can mean two different units gives no usable signal until the visitor clicks through.
Fix: split into two unit-labeled values/rows, or normalize the summary view to one canonical unit.

**[P1] MarketPrices fallback copy points the wrong direction**
File: `app/MarketPrices.tsx:81-82` — "…مرجع اصلی خرید در جدول‌های تخصصی قیمت فولاد بالاست" ("…is above"), but per `app/App.tsx` render order (`<MarketPrices />` at line 295, then the `#prices` section at line 297) the price tables render *below*, not above.
Why it matters: sends a reader scrolling the wrong direction at the exact moment they're looking for the actual prices.
Fix: change "بالاست" to "پایین است" (or remove the directional claim entirely).

**[P2] Preloader adds real weight to every first-time homepage visit**
Files: `public/preloader/fb-preloader.js`, `public/preloader/assets/tr2.mp4` (~1.7MB). Well-engineered (session-gated, `prefers-reduced-motion`-aware full skip, progressive streaming, skip button, timeout fail-safes) but still adds payload and an extra gate before a price-lookup tool becomes usable on a first visit.
Fix: re-encode at a lower bitrate/shorter duration, or add a lighter AV1/WebM source ahead of the mp4 fallback.

**[P2] Three redundant navigators to the same 8 categories**
CategoryGrid (8 cards), the product tablist (8 tabs), and SteelPriceOverview's table rows all link to the identical 8 group routes, stacked in the same homepage section.
Fix: consolidate to one navigator (tabs or cards) plus the table; the third becomes pure scroll cost.

**[P3] Pre-content splash/preloader gate**
An unskippable-feeling "enter site" beat before any real content, for a tool whose value proposition is speed. Mitigated by the engineering above, but still one extra decision before the price a visitor came for.

**[P3] Miscellaneous cleanups**: dead `.hero-kicker` CSS (`app/globals/hero.css:137-149`, unused anywhere in the codebase — this is also why the detector's `hero.css:141` side-tab hit is a false positive for the live page); hero carousel prev/next controls measure 38×41px, short of the 44×44 comfort target; hardcoded hex colors in `market-prices.css` and mega-menu panels sit outside the `var(--…)` token system; no dark-mode/`prefers-color-scheme` support anywhere; search placeholder doesn't hint that factory/size filtering exists (only reachable via the mega menu).

## Persona Red Flags

**Jordan (first-timer)**: hits the splash gate before seeing anything; then meets three stacked "price overview" navigators in one scroll; then the تیرآهن/لوله mixed-unit range leaves them unsure whether it's ۸۵ هزار or ۵۳ میلیون تومان.

**Casey (distracted mobile)**: scrolls past all 8 full-bleed category cards before reaching the tabs/table; lands on the visibly broken one-word-per-line About section and may assume the site is malfunctioning; the first real content beat under the hero is "market rates unavailable."

**Sam (screen-reader/keyboard)**: the hero's secondary CTA duplicates the primary CTA with no distinguishing accessible description; the misdirected "بالاست" alert sends them scrolling the wrong way; linear tab order passes through the same 8 category links three times (grid, tablist, table) before reaching new content.

## Minor Observations

- Copyright-year pattern (`new Date().getFullYear().toLocaleString(...)`) is a fragile one-off, cosmetic only.
- Mega-menu section-label accent border (`header.css:358-364`) is a deliberate, consistently-applied style, not templated sprawl — keep or restyle as taste dictates.
- `header.css:52,76,241` layout-property transitions are real but functionally inert above 900px and fire only ~1-2×/session (IntersectionObserver-gated, not scroll-driven).

## Questions to Consider

- Three navigators all point at the same 8 categories — cut two, and does time-to-price actually get worse for anyone?
- Does the fintech-style glassmorphism help or hurt trust with a procurement buyer who expects a steel yard, not a dashboard?
- If the homepage's default price table can't state a single unit, should the summary view exist at all, or should it link straight to the per-category tables where units are unambiguous?
