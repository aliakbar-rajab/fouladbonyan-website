import type { ReactNode } from "react";
import { siteConfig } from "../site-config";

export function ComparisonTable({
  caption,
  columns,
  rows,
}: {
  caption: ReactNode;
  columns: string[];
  rows: { label: string; values: string[] }[];
}) {
  return (
    <div className="guide-table-wrap">
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
    </div>
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
