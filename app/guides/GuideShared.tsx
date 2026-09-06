import type { ReactNode } from "react";
import { siteConfig } from "../site-config";

/**
 * The scroll container every guide table sits in.
 *
 * These tables are wider than a phone -- the rebar weight chart is 740px
 * against a 308px box at 375px -- so the wrapper scrolls horizontally. A bare
 * `overflow-x: auto` div is reachable by mouse and touch only: it takes no
 * focus, so a keyboard-only reader cannot scroll it and simply never sees the
 * columns past the edge (WCAG 2.1.1). `tabIndex` makes it a scrollable region
 * they can reach and arrow through, and the name tells them what they landed
 * in rather than announcing an unlabelled "region".
 */
export function GuideTableWrap({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="guide-table-wrap" tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}

export function ComparisonTable({
  caption,
  captionLabel,
  columns,
  rows,
}: {
  caption: ReactNode;
  /** Plain-text name for the scroll region; `caption` may carry markup. */
  captionLabel: string;
  columns: string[];
  rows: { label: string; values: string[] }[];
}) {
  return (
    <GuideTableWrap label={captionLabel}>
      <table className="guide-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">ویژگی</th>
            {columns.map((column) => (
              <th scope="col" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => (
                <td key={`${row.label}-${columns[index]}`}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </GuideTableWrap>
  );
}

export function QuoteChecklist() {
  return (
    <section className="content-card">
      <h2>هنگام استعلام چه چیزی را اعلام کنید</h2>
      <p>
        هر ردیف در جدول‌های قیمت این سایت با همین چند مشخصه از ردیف‌های دیگر جدا
        می‌شود؛ تا این‌ها مشخص نباشد، عدد قابل اعلام نیست:
      </p>
      <ul className="checked-list">
        <li>گروه کالا و زیرگروه دقیق (مثلاً میلگرد آجدار، نه فقط «میلگرد»)</li>
        <li>سایز یا ابعاد و ضخامت مقطع</li>
        <li>استاندارد یا گرید موردنیاز، برگرفته از نقشه یا محاسبات سازه</li>
        <li>کارخانه یا برند موردنظر، اگر برایتان تفاوت دارد</li>
        <li>مقدار و واحد سفارش (کیلوگرم، تن، شاخه، برگ و...)</li>
        <li>محل تحویل و اینکه بار روی کارخانه تحویل شود یا انبار</li>
        <li>نیاز یا عدم نیاز به فاکتور رسمی و احتساب مالیات بر ارزش افزوده</li>
      </ul>
      <div className="inline-actions">
        <a href="/quote-process/#quote-form">آماده‌سازی متن درخواست</a>
        <a href={siteConfig.contact.phones[0].href}>تماس با واحد فروش</a>
      </div>
    </section>
  );
}
