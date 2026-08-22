export function Brand({
  headerLogo = false,
  href = "#top",
}: {
  headerLogo?: boolean;
  href?: string;
}) {
  /*
   * The supplied logo is a stacked lockup: the BD monogram sits above the
   * Persian wordmark, and that wordmark is drawn in black and gold for a light
   * background. Printed whole onto the black header it was both too tall to
   * size a bar around and half-invisible, which is what the old triple
   * drop-shadow was compensating for. The header therefore uses the monogram
   * alone (cropped to its own asset) and sets the name in type, which reads at
   * any size and needs no rim light. Everywhere the logo lands on white -- the
   * quote document, the 404 page -- the full lockup is still the right file.
   */
  return (
    <a
      className={`brand${headerLogo ? " brand-header-logo" : ""}`}
      href={href}
      aria-label="بنیان فولاد داریا، صفحه اصلی"
    >
      {headerLogo ? (
        <img
          className="brand-mark-img"
          src="/brand/bonyan-foulad-daria-mark.webp"
          alt=""
          width="571"
          height="603"
          decoding="async"
          fetchPriority="high"
        />
      ) : (
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <span className="brand-copy">
        <strong>بنیان فولاد داریا</strong>
        <span>BONYAN FOULAD DARIA</span>
      </span>
    </a>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-heading">
      {eyebrow ? <span>{eyebrow}</span> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function CatalogLoadMessage({
  status,
  subject,
}: {
  status: "loading" | "error";
  subject: string;
}) {
  if (status === "error") {
    return (
      <p className="catalog-load-state" role="alert">
        دریافت {subject} ممکن نشد. لطفاً صفحه را دوباره بارگذاری کنید.
      </p>
    );
  }
  return (
    <p className="catalog-load-state" role="status">
      در حال دریافت {subject}…
    </p>
  );
}
