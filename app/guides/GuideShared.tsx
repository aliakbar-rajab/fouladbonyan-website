import type { ReactNode } from "react";
import { siteConfig } from "../site-config";
import { toPersianDigits } from "../catalog-utils";
import type { CatalogProfile, GuideReference } from "../steel-reference";

export const fa = (value: number, maximumFractionDigits = 0) =>
  value.toLocaleString("fa-IR", { maximumFractionDigits });

/** Fixed precision, so a numeric column stays aligned down its whole length. */
export const faFixed = (value: number, digits: number) =>
  value.toLocaleString("fa-IR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const list = (values: string[]) => toPersianDigits(values.join("، "));

export const sizeRange = (sizes: string[]) =>
  sizes.length > 1
    ? `${toPersianDigits(sizes[0])} تا ${toPersianDigits(sizes[sizes.length - 1])}`
    : toPersianDigits(sizes[0] ?? "—");

export const findProfile = (
  reference: GuideReference,
  groupId: string,
  id: string,
): CatalogProfile | undefined =>
  reference.profiles.find(
    (profile) => profile.groupId === groupId && profile.id === id,
  );

export function profileRow(
  label: string,
  profiles: (CatalogProfile | undefined)[],
  read: (profile: CatalogProfile) => string,
) {
  return {
    label,
    values: profiles.map((profile) => (profile ? read(profile) : "—")),
  };
}

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
