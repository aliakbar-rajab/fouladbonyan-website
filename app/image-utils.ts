export type ResponsiveImageSources = {
  avifSrcSet: string;
  webpSrcSet: string;
  jpgSrcSet: string;
  fallbackSrc: string;
  width: number;
  height: number;
  sizes: string;
};

function buildStandardImageSources(
  imagePath: string,
  sizes: string,
): ResponsiveImageSources {
  const base = imagePath.replace(/\.(jpg|webp|avif)$/, "");
  return {
    avifSrcSet: `${base}-240.avif 240w, ${base}-384.avif 384w`,
    webpSrcSet: `${base}-240.webp 240w, ${base}-384.webp 384w`,
    jpgSrcSet: `${base}-240.jpg 240w, ${base}.jpg 384w`,
    fallbackSrc: imagePath,
    width: 384,
    height: 512,
    sizes,
  };
}

/**
 * Returns responsive srcset, sizes, and dimensions for hero images.
 */
export function getHeroImageSources(imagePath: string): ResponsiveImageSources {
  // Check if this is a dedicated 1680 hero image (e.g. /categories/hero-rebar-1680.jpg)
  if (imagePath.includes("hero-")) {
    const base = imagePath
      .replace(/-1680\.(jpg|webp|avif)$/, "")
      .replace(/\.(jpg|webp|avif)$/, "");
    return {
      avifSrcSet: `${base}-640.avif 640w, ${base}-960.avif 960w, ${base}-1280.avif 1280w, ${base}-1680.avif 1672w`,
      webpSrcSet: `${base}-640.webp 640w, ${base}-960.webp 960w, ${base}-1280.webp 1280w, ${base}-1680.webp 1672w`,
      jpgSrcSet: `${base}-640.jpg 640w, ${base}-960.jpg 960w, ${base}-1280.jpg 1280w, ${base}-1680.jpg 1672w`,
      fallbackSrc: `${base}-1680.jpg`,
      width: 1672,
      height: 941,
      sizes: "100vw",
    };
  }

  // Category image used as hero fallback (e.g. /categories/04-profile.jpg)
  return buildStandardImageSources(imagePath, "100vw");
}

/**
 * Returns responsive srcset, sizes, and dimensions for category grid cards.
 */
export function getCategoryImageSources(
  imagePath: string,
): ResponsiveImageSources {
  return buildStandardImageSources(
    imagePath,
    "(max-width: 560px) 128px, (max-width: 768px) 50vw, (max-width: 1080px) 33vw, 280px",
  );
}

/**
 * Returns thumbnail sources (AVIF / WebP / JPEG) for table and list cards.
 */
export function getThumbnailSources(imagePath: string) {
  const base = imagePath.replace(/\.(jpg|webp|avif)$/, "");
  return {
    avif: `${base}-240.avif`,
    webp: `${base}-240.webp`,
    jpg: imagePath,
  };
}
