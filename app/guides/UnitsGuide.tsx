import { guidePageUrl } from "../guide-page-data";
import type { GuideReference } from "../steel-reference";
import { QuoteChecklist, fa } from "./GuideShared";

export function UnitsGuide({ reference }: { reference: GuideReference }) {
  return (
    <>
      <section className="content-card">
        <h2>واحدهایی که مقاطع فولادی با آن قیمت می‌خورند</h2>
        <p>
          «قیمت چند است؟» تا وقتی واحد مشخص نباشد جواب ندارد. جدول زیر واحدهای
          واقعی به‌کاررفته در جدول‌های قیمت این سایت را نشان می‌دهد، به‌همراه
          تعداد ردیفی که با هر واحد قیمت خورده‌اند.
        </p>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <caption>
              برداشت‌شده از داده قیمت{" "}
              <time dateTime={reference.sourceDateIso}>
                {reference.sourceDateLabel}
              </time>
            </caption>
            <thead>
              <tr>
                <th scope="col">واحد</th>
                <th scope="col">تعداد ردیف قیمت</th>
                <th scope="col">بیشتر در کدام گروه‌ها</th>
              </tr>
            </thead>
            <tbody>
              {reference.unitUsage.map((usage) => (
                <tr key={usage.unit}>
                  <th scope="row">{usage.unit}</th>
                  <td>{fa(usage.rowCount)}</td>
                  <td>
                    <ul className="guide-mill-list">
                      {usage.examples.map((example) => (
                        <li key={example.href}>
                          <a href={example.href}>{example.label}</a>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-card">
        <h2>کیلوگرم در برابر شاخه</h2>
        <p>
          <b>کیلوگرم</b> پرکاربردترین واحد است: مبلغ از ضرب وزن در قیمت هر کیلو
          درمی‌آید و وزن باسکول بار، نه وزن جدول، ملاک فاکتور است. سفارش «تن» هم
          همین است با ضریب هزار.
        </p>
        <p>
          <b>شاخه</b> یعنی قیمت برای یک شاخه کامل اعلام شده است. مقایسه یک
          پیشنهاد شاخه‌ای با یک پیشنهاد کیلویی فقط وقتی درست است که وزن همان شاخه
          از همان کارخانه را داشته باشید — و آن وزن بین کارخانه‌ها یکسان نیست.
        </p>
        <p>
          <b>برگ، طاقه و مترمربع</b> در محصولات مفتولی و توری به کار می‌روند؛
          آنجا ابعاد ورق یا رول بخشی از تعریف کالاست و بدون آن عدد قابل مقایسه
          نیست.
        </p>
        <div className="inline-actions">
          <a href={guidePageUrl("rebar-weight-chart")}>جدول وزن میلگرد</a>
          <a href={guidePageUrl("beam-weight-chart")}>جدول وزن تیرآهن</a>
          <a href="/#prices">قیمت‌های اطلاع‌رسانی</a>
        </div>
      </section>

      <QuoteChecklist />

      <section className="content-card legal-copy">
        <h2>قیمت سایت، قیمت قطعی نیست</h2>
        <p>
          اعدادی که در جدول‌ها می‌بینید برای شناخت حدود بازار است. قیمت قطعی،
          موجودی و زمان تحویل فقط پس از بررسی واحد فروش و در پیش‌فاکتور دارای
          مدت اعتبار قابل استناد است.
        </p>
        <div className="inline-actions">
          <a href="/quote-process/">فرایند درخواست پیش‌فاکتور</a>
          <a href="/terms/">شرایط استفاده</a>
        </div>
      </section>
    </>
  );
}
