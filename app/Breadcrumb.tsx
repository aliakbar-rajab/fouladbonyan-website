export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="مسیر راهنما" className="breadcrumb-nav">
      <div className="shell">
        <ol className="breadcrumb-list">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li
                /*
                 * Position, not label: a trail is a fixed ordered list that is
                 * never reordered, and a crumb's label is not unique within it.
                 * /beam/beam/, /angle/angle/, /channel/channel/ and
                 * /profile/box-profile/ all repeat their group's label as the
                 * leaf, which collided the keys and had React warning on four
                 * shipped pages.
                 */
                key={index}
                className="breadcrumb-item"
                aria-current={isLast ? "page" : undefined}
              >
                {item.href && !isLast ? (
                  <a href={item.href}>{item.label}</a>
                ) : (
                  <span>{item.label}</span>
                )}
                {!isLast ? (
                  <span className="breadcrumb-separator" aria-hidden="true">
                    /
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
