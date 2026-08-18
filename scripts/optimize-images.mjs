import { readdir } from "node:fs/promises";
import { resolve, parse } from "node:path";
import sharp from "sharp";

const categoriesDir = resolve(import.meta.dirname, "..", "public", "categories");

const HERO_WIDTHS = [640, 960, 1280, 1672];

const AVIF_OPTIONS = { quality: 65, effort: 4 };
const WEBP_OPTIONS = { quality: 80, effort: 4 };
const JPEG_OPTIONS = { quality: 80, mozjpeg: true };

async function processHeroImage(file) {
  const filePath = resolve(categoriesDir, file);
  const { name } = parse(file); // e.g. hero-rebar-1680
  const prefix = name.replace(/-1680$/, ""); // e.g. hero-rebar

  console.log(`Processing hero image: ${file}`);
  const inputBuffer = await sharp(filePath).toBuffer();

  for (const width of HERO_WIDTHS) {
    const suffix = width === 1672 ? "1680" : `${width}`;
    
    // AVIF
    const avifPath = resolve(categoriesDir, `${prefix}-${suffix}.avif`);
    await sharp(inputBuffer)
      .resize(width, null, { withoutEnlargement: true })
      .avif(AVIF_OPTIONS)
      .toFile(avifPath);

    // WebP
    const webpPath = resolve(categoriesDir, `${prefix}-${suffix}.webp`);
    await sharp(inputBuffer)
      .resize(width, null, { withoutEnlargement: true })
      .webp(WEBP_OPTIONS)
      .toFile(webpPath);

    // JPEG (for widths < 1680)
    if (width < 1672) {
      const jpgPath = resolve(categoriesDir, `${prefix}-${suffix}.jpg`);
      await sharp(inputBuffer)
        .resize(width, null, { withoutEnlargement: true })
        .jpeg(JPEG_OPTIONS)
        .toFile(jpgPath);
    }
  }
}

// width 384 is also written unsuffixed (the "default" category image); width
// 240 only ever appears as an explicit -240 file, alongside its JPEG fallback.
const CATEGORY_TARGETS = [
  { width: 240, suffixes: ["-240"], jpeg: true },
  { width: 384, suffixes: ["", "-384"], jpeg: false },
];

async function processCategoryImage(file) {
  const filePath = resolve(categoriesDir, file);
  const { name } = parse(file); // e.g. 01-rebar

  console.log(`Processing category photo: ${file}`);
  const inputBuffer = await sharp(filePath).toBuffer();

  for (const { width, suffixes, jpeg } of CATEGORY_TARGETS) {
    const resized = () => sharp(inputBuffer).resize(width, null, { withoutEnlargement: true });

    for (const suffix of suffixes) {
      await resized().avif(AVIF_OPTIONS).toFile(resolve(categoriesDir, `${name}${suffix}.avif`));
      await resized().webp(WEBP_OPTIONS).toFile(resolve(categoriesDir, `${name}${suffix}.webp`));
    }

    if (jpeg) {
      await resized().jpeg(JPEG_OPTIONS).toFile(resolve(categoriesDir, `${name}-240.jpg`));
    }
  }
}

async function main() {
  console.log("Optimizing images in public/categories/...");
  const files = await readdir(categoriesDir);

  for (const file of files) {
    if (file.startsWith("hero-") && file.endsWith(".jpg") && !file.match(/-\d{3,4}\.jpg$/)) {
      // hero file without size suffix if any
      await processHeroImage(file);
    } else if (file.startsWith("hero-") && file.endsWith("-1680.jpg")) {
      await processHeroImage(file);
    } else if (file.match(/^0\d-.*\.jpg$/) && !file.match(/-\d{3}\.jpg$/)) {
      await processCategoryImage(file);
    }
  }

  console.log("Image optimization complete!");
}

main().catch((err) => {
  console.error("Image optimization failed:", err);
  process.exit(1);
});
