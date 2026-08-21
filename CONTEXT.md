# Foulad Bonyan pricing context

Foulad Bonyan publishes Persian market-reference steel prices and gathers quote requests. This context defines the commercial and pricing language shared by the catalog, scraper, and sales-facing UI.

## Commercial boundary

**Informational pricing platform**:
The website publishes market prices and accepts quote requests; it is not an e-commerce, order, payment, or checkout system.
_Avoid_: Online store, ordering system, payment flow

**Market-reference price**:
A published, non-binding price intended for information and estimation, not a promise to sell at that amount.
_Avoid_: Final price, guaranteed price, sale price

**Price unavailable**:
The canonical state of a source row whose upstream price is missing; it is represented as `null`, never zero or an inferred value. The row remains visible in the catalog and its price cell says «تماس بگیرید»; it does not show a price unit.
_Avoid_: Zero price, estimated price, hidden row

**Catalog snapshot**:
A complete generated price payload that may replace the last stored snapshot only after every expected category passes validation. A failed refresh leaves the last stored snapshot live.
_Avoid_: Partial publish, mixed snapshot, best-effort refresh

**Catalog price summary**:
The minimum, maximum, and rounded average of a category's own positive displayed row prices; `Price unavailable` rows are excluded. A category with none currently has a zero summary, a known contradiction recorded under `Open questions`; it is neither an upstream comparison value nor a price estimate.
_Avoid_: Upstream summary, quote estimate, category price

**Displayable price range**:
A catalog price summary eligible for UI or SEO display only when all priced rows in its category share one unit. A mixed-unit category directs users to its row-level prices instead.
_Avoid_: Cross-unit range, mixed-unit summary

**Price movement**:
The upstream-reported `up`, `down`, or `same` status and percentage change, presented as market movement relative to the upstream's prior period. The fetchers copy row movement from upstream product fields and category movement from the upstream comparison payload; they do not diff local snapshots. It is neither stock availability, a Foulad Bonyan calculation, nor a sales guarantee.
_Avoid_: Availability status, local price diff, sales guarantee

**Snapshot fetched time**:
The time when Foulad Bonyan retrieved a complete market-source snapshot, shown in the shared catalog UI as «آخرین دریافت داده» with a date and time.
_Avoid_: Source update time, market update time

**Source update time**:
The time when the market source says a row or factory was last updated, shown in the shared catalog UI as «آخرین بروزرسانی».
_Avoid_: Snapshot fetched time, scrape time

**Quote document date**:
The date when the browser generated a non-binding quote request, not a source update time, snapshot fetched time, or indication that a price is current—see [Open questions](#open-questions) for its price-freshness clarity gap.
_Avoid_: Price date, source update time, snapshot fetched time

**Catalog grouping**:
A market source's collection of price rows, with a category-specific customer-facing label—currently 32 factory-labelled categories (for example, ribbed rebar and beam), 8 group-labelled categories (`box-profile`, `building-profile`, `wire`, `rib-lath`, `steel-mesh`, `chicken-mesh`, `chain-link-mesh`, and `crimped-mesh`), and 6 [grade groupings](#grade-grouping). It does not necessarily represent a physical factory.
_Avoid_: Factory-only grouping

**Grade grouping**:
A third customer-facing form of [Catalog grouping](#catalog-grouping), alongside factory and group, used by `stainless` (میلگرد استیل), `alloy` (میلگرد آلیاژی), `stainless-sheet` (ورق استیل), `wear-resistant-sheet` (ورق ضد سایش), `stainless-profile` (پروفیل استیل), and `stainless-pipe` (لوله استیل). Its values are passed through from upstream `گرید` metadata; the application defines no fixed grade list, and it is not a physical-factory model.
_Avoid_: Factory, generic specification

**Refresh failure**:
A scheduled refresh that cannot fetch or validate the complete catalog snapshot. It leaves the last stored snapshot in Cloudflare KV untouched and triggers no Pages rebuild. A fetch or local-validation failure surfaces as a failed GitHub Actions run (that workflow only fetches, validates, and relays; it never commits); a failure the Worker's own re-validation catches surfaces in its refresh-status record and logs instead.
_Avoid_: Successful refresh, silent publish

**Market source**:
The external publisher of a market-reference price, currently exactly فولاد ایرانیان. Every displayed source-derived price retains this attribution and is not presented as independently verified by Foulad Bonyan.
_Avoid_: Foulad Bonyan verified price, house price

**Price estimate**:
An indicative quote-request calculation derived from the market-price snapshot, distinct from both a source row price and a sales-confirmed final price. It uses rounded means of positive source prices (per kilogram, or per size/specification for selected real piece units), converts tonnes to kilograms, applies the 12-metre rebar weight formula for rebar branches, and adds no markup or VAT (confirmed absent from the current calculation); generated quote totals convert toman to rial by a factor of ten—see [Open questions](#open-questions) for its source-attribution gap.
_Avoid_: Source row price, final price, sale price

**VAT scope**:
VAT is outside a price estimate and, when applicable, is determined by human sales confirmation in the final terms.
_Avoid_: Estimate-inclusive VAT, automatic VAT calculation

**Currency representation**:
Market price rows and price estimates are expressed in toman; a generated quote document converts estimate totals to rial at ten rial per toman. This conversion is a representation change, not markup or VAT.
_Avoid_: Currency conversion as price adjustment

**Quote request**:
A customer's request for pricing or purchase terms that requires human sales follow-up.
_Avoid_: Order, checkout, purchase

**Sales confirmation**:
The human confirmation by sales, phone, or WhatsApp of the final price, stock, delivery, tonnage, and other sale terms.
_Avoid_: Automatic confirmation, online acceptance

## Catalog language

**Catalog**:
A top-level market product family containing related product categories, such as rebar, beam, sheet, profile, pipe, angle, channel, or wire.
_Avoid_: Individual product, price row

**Product category**:
A source-defined market subtype within a catalog, identified and ordered as part of the source contract rather than treated as a freely interchangeable visual tab.
_Avoid_: Arbitrary tab, product family

**Price row**:
One source-derived product offering within a product category, defined by its product details, catalog grouping, sales unit, price state, movement, and source update time.
_Avoid_: Final offer, sales-confirmed quote

**Sales unit**:
The unit attached to a price row, such as kilogram, tonne, branch, sheet, roll, or square metre. A price is meaningful only with its sales unit, and cross-unit values must not form a displayable price range.
_Avoid_: Unitless price, interchangeable unit

## Future considerations

Online sales have been considered but are deliberately deferred: they are neither decided nor scheduled, and must not shape current invariants, seams, or the domain model.

## Open questions

Scheduled-refresh failures have GitHub Actions run status/logs and a Cloudflare Worker status record and logs, but no configured external notification or alerting. Decide separately whether and how that operational gap should be addressed.

Market source currently assumes exactly one source. If a second source is introduced, decide how provenance, comparison, and attribution work; do not redesign the current model pre-emptively.

Source attribution is complete in the shared catalog UI used for rebar, beam, and product catalogs: it renders «منبع: فولاد ایرانیان» with the category source link. Quote-request estimates use the same generated data but currently say only «داده‌های قیمت سایت» or «قیمت واقعی سایت»; they do not name فولاد ایرانیان. Resolve that attribution gap separately; do not change the UI in this session.

The current all-unpriced-category summary is literal zero for min, max, and average. This conflicts with the `Price unavailable` invariant: individual missing prices use `null` because zero can be read as a real price, whereas an aggregate with no priced rows falls through to zero. Resolve the aggregate representation separately; do not change it in this session.

Freshness labeling is incomplete outside the shared catalog UI: quote-request estimates show neither snapshot fetched time nor source update time. Their generated document shows only «تاریخ», the document-preparation date, which could be read as price freshness. The source-update label in the catalog UI also does not explicitly say that the time comes from the market source. Resolve these clarity gaps separately; do not change UI in this session.
