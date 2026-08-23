import { toPersianDigits } from "../catalog-utils";
import { guidePageUrl } from "../guide-page-data";
import type { GuideReference } from "../steel-reference";
import { fa, faFixed, list } from "./guide-helpers";

export function RebarWeightGuide({ reference }: { reference: GuideReference }) {
  return (
    <>
      <section className="content-card">
        <h2>فرمول وزن میلگرد</h2>
        <strong className="guide-formula" dir="rtl">
          وزن هر متر (کیلوگرم) = مجذور قطر (میلی‌متر) ÷ ۱۶۲
        </strong>
        <p>
          این همان فرمولی است که ماشین‌حساب وزن در جدول قیمت میلگرد همین سایت از
          آن استفاده می‌کند. برای یک شاخه، حاصل را در طول شاخه (بر حسب متر) ضرب
          کنید. مثلاً میلگرد قطر ۱۶: <b>{toPersianDigits("16²")} ÷ ۱۶۲</b> برابر
          است با {faFixed(16 ** 2 / 162, 3)} کیلوگرم در هر متر، و یک شاخه ۱۲
          متری حدود {faFixed((16 ** 2 / 162) * 12, 2)} کیلوگرم می‌شود.
        </p>
        <p>
          فرمول برای میلگرد فولادی کربنی نوشته شده است. برای میلگرد استیل و
          آلیاژی چگالی متفاوت است و در این صفحه جدول وزنی برای آن‌ها منتشر
          نکرده‌ایم؛ وزن این دو گروه را از واحد فروش بگیرید.
        </p>
      </section>

      {reference.rebarTables.map((table) => (
        <section className="content-card" key={table.id}>
          <h2>{`جدول وزن ${table.label}`}</h2>
          <p>
            {[
              table.standards.length
                ? `استانداردهای موجود در جدول قیمت: ${list(table.standards)}. عرضه توسط ${fa(table.factoryCount)} کارخانه.`
                : "",
              table.branchLengthM === null
                ? "کاتالوگ برای این گروه طول شاخه اعلام نکرده است، بنابراین فقط وزن هر متر آورده شده است."
                : `طول شاخه اعلامی در کاتالوگ ${toPersianDigits(String(table.branchLengthM))} متر است.`,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
          <div className="guide-table-wrap">
            <table className="guide-table">
              <caption>
                {`وزن ${table.label} بر پایه فرمول استاندارد وزن — ${fa(table.rows.length)} سایز`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">قطر (میلی‌متر)</th>
                  <th scope="col">وزن هر متر (کیلوگرم)</th>
                  {table.branchLengthM === null ? null : (
                    <>
                      <th scope="col">
                        {`وزن شاخه ${toPersianDigits(String(table.branchLengthM))} متری (کیلوگرم)`}
                      </th>
                      <th scope="col">تعداد شاخه در هر تن</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.size}>
                    <th scope="row">{toPersianDigits(row.size)}</th>
                    <td>{faFixed(row.kgPerMeter, 3)}</td>
                    {table.branchLengthM === null ? null : (
                      <>
                        <td>
                          <b>{faFixed(row.kgPerBranch ?? 0, 2)}</b>
                        </td>
                        <td>{fa(row.branchesPerTon ?? 0)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inline-actions">
            <a href={table.href}>{`قیمت روز ${table.label}`}</a>
          </div>
        </section>
      ))}

      <section className="content-card legal-copy">
        <h2>وزن محاسباتی در برابر وزن باسکول</h2>
        <p>
          اعداد بالا وزن اسمی‌اند: نتیجه یک فرمول، نه اندازه‌گیری یک شاخه واقعی.
          میلگرد در جدول‌های این سایت بر حسب کیلوگرم قیمت می‌خورد، پس آنچه در
          فاکتور ضرب می‌شود وزن باسکول همان بار است، نه وزن جدول. جدول قیمت
          میلگرد برای هر ردیف «وزن تقریبی» اعلامی خودش را هم نشان می‌دهد و این
          عدد بین کارخانه‌ها یکسان نیست.
        </p>
        <p>
          از این جدول برای برآورد اولیه، تبدیل شاخه به تن و کنترل بار تحویلی
          استفاده کنید؛ برای تسویه، وزن باسکول ملاک است.
        </p>
        <div className="inline-actions">
          <a href="/rebar/">قیمت روز میلگرد</a>
          <a href={guidePageUrl("ribbed-vs-plain-rebar")}>
            تفاوت میلگرد آجدار و ساده
          </a>
          <a href={guidePageUrl("units-and-quote-specs")}>واحدهای فروش</a>
        </div>
      </section>
    </>
  );
}
