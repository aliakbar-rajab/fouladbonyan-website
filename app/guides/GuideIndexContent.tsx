import {
  guidePageDefinitions,
  guidePageKeys,
  guidePageUrl,
} from "../guide-page-data";

export function GuideIndexContent() {
  return (
    <>
      <section className="content-card">
        <h2>صفحه‌های مرجع</h2>
        <p>
          این بخش برای پاسخ به پرسش‌هایی است که جدول قیمت جواب نمی‌دهد: یک شاخه
          چقدر وزن دارد، دو محصول هم‌نام چه فرقی دارند، و برای گرفتن قیمت چه
          چیزی باید مشخص باشد.
        </p>
        <ul className="guide-card-list">
          {guidePageKeys.map((key) => {
            const definition = guidePageDefinitions[key];
            return (
              <li key={key}>
                <a href={guidePageUrl(key)}>
                  <em>{definition.eyebrow}</em>
                  <strong>{definition.title}</strong>
                  <span>{definition.description}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="content-card legal-copy">
        <h2>این صفحه‌ها از کجا می‌آیند</h2>
        <p>
          جدول‌های وزن و مقایسه‌ها از همان داده قیمتی ساخته می‌شوند که جدول‌های
          این سایت را پر می‌کند، و وزن میلگرد با همان فرمولی محاسبه می‌شود که
          ماشین‌حساب وزن صفحه میلگرد از آن استفاده می‌کند. هر جا داده‌ای در دست
          نبوده — مثلاً وزن اعلامی شاخه هاش — چیزی جای آن ننوشته‌ایم.
        </p>
        <div className="inline-actions">
          <a href="/#prices">قیمت روز آهن و فولاد</a>
          <a href="/quote-process/#quote-form">درخواست پیش‌فاکتور</a>
        </div>
      </section>
    </>
  );
}
