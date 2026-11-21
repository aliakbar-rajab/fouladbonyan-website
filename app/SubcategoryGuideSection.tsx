import { QUOTE_FORM_HREF } from "./quote-handoff";
import { getSubcategoryContent } from "./subcategory-content";

export function SubcategoryGuideSection({
  catalogId,
  categoryId,
}: {
  catalogId: string;
  categoryId: string;
}) {
  const content = getSubcategoryContent(catalogId, categoryId);
  if (!content) return null;

  return (
    <section
      className="subcategory-guide"
      aria-labelledby={`subcategory-guide-title-${categoryId}`}
    >
      <div className="subcategory-guide-card">
        <header className="subcategory-guide-header">
          <h2 id={`subcategory-guide-title-${categoryId}`}>
            {content.guideTitle}
          </h2>
        </header>

        <div className="subcategory-guide-body">
          {content.sections.map((section) => (
            <section
              className="subcategory-guide-block"
              key={section.heading}
            >
              <h3>{section.heading}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul className="subcategory-guide-list">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          {content.specsTable ? (
            <section className="subcategory-guide-block">
              <h3>{content.specsTable.heading}</h3>
              <div
                className="subcategory-spec-table-wrap"
                tabIndex={0}
                role="region"
                aria-label={content.specsTable.heading}
              >
                <table className="subcategory-spec-table">
                  <caption>{content.specsTable.caption}</caption>
                  <thead>
                    <tr>
                      {content.specsTable.columns.map((column) => (
                        <th scope="col" key={column}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {content.specsTable.rows.map((row) => (
                      <tr key={row[0]}>
                        <th scope="row">{row[0]}</th>
                        {row.slice(1).map((cell, index) => (
                          <td key={`${row[0]}-${content.specsTable?.columns[index + 1]}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="subcategory-guide-block">
            <h3>مسیرهای مرتبط و مقایسه سریع</h3>
            <div className="subcategory-related-grid">
              {content.relatedLinks.map((link) => (
                <a
                  href={link.href}
                  key={link.href}
                  className="subcategory-related-card"
                >
                  <strong>{link.label}</strong>
                  <span>{link.description}</span>
                </a>
              ))}
            </div>
          </section>

          <section className="subcategory-guide-block">
            <h3>پرسش‌های متداول خریداران</h3>
            <div className="subcategory-faq-list">
              {content.faqs.map((faq) => (
                <article className="subcategory-faq-item" key={faq.question}>
                  <h4>{faq.question}</h4>
                  <p>{faq.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="subcategory-guide-cta">
            <a href={QUOTE_FORM_HREF}>ثبت درخواست پیش‌فاکتور آنلاین</a>
          </div>
        </div>
      </div>
    </section>
  );
}
