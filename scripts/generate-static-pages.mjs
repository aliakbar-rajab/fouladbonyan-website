import { generateStaticSite } from "./lib/prerender-pipeline.mjs";

try {
  const { pageCount, sitemapCount } = await generateStaticSite();
  console.log(
    `تولید و پیش‌رندر ${pageCount.toLocaleString("fa-IR")} صفحه ایستا و بروزرسانی sitemap با ${sitemapCount.toLocaleString("fa-IR")} آدرس با موفقیت انجام شد.`,
  );
} catch (error) {
  console.error("خطا در پیش‌رندر صفحات ایستا:", error);
  process.exit(1);
}
