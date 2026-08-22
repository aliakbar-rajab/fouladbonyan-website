import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const emptySubscribe = () => () => {};
const getSvgClientSnapshot = () => supportsSVGFilters();
const getSvgServerSnapshot = () => false;


/*
 * Refractive liquid glass.
 *
 * The pane is not frosted: instead of blurring the backdrop, it bends it. A
 * per-element SVG displacement map (a rounded rect whose red/blue channels ramp
 * toward the edges) is fed into `backdrop-filter`, so light behind the pane
 * runs straight through the middle and refracts only along the rim. The three
 * colour channels are displaced by slightly different amounts, which produces
 * the faint chromatic fringe real glass has at its edges.
 *
 * The map depends on the element's pixel size, so it is regenerated from a
 * ResizeObserver rather than authored once in CSS.
 *
 * The pane carries no `style` attribute. Every page here is prerendered and
 * served under `style-src 'self'`, which blocks inline styles outright — the
 * whole material used to arrive dead in production for exactly that reason.
 * So the pane's box (size, radius) and its material tuning (`--glass-frost`,
 * `--glass-saturation`) are the stylesheet's job, keyed off the caller's
 * class; the rounded rect below reads the applied radius back out of the
 * cascade so the two can never drift. Only `--filter-id` is genuinely
 * per-instance, and it is set through CSSOM, which CSP does not police.
 */

type ChannelSelector = "R" | "G" | "B" | "A";

export type GlassSurfaceProps = {
  children?: ReactNode;
  /** Width of the refracting rim, as a fraction of the pane's shorter side. */
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  /** Softness of the displacement map's inner plate — feathers the rim. */
  blur?: number;
  /** Gaussian blur applied to the refracted result. 0 keeps the glass optically clear. */
  displace?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: ChannelSelector;
  yChannel?: ChannelSelector;
  mixBlendMode?: string;
  className?: string;
};

/*
 * Safari and Firefox accept `backdrop-filter: url(...)` in the parser but do
 * not actually resolve the filter reference, which renders the pane as an
 * untouched hole. Feature-detect the property and exclude those two engines,
 * then fall back to a conventional frosted pane.
 */
let svgFilterSupport: boolean | null = null;

function supportsSVGFilters(): boolean {
  if (svgFilterSupport !== null) return svgFilterSupport;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const isWebkit =
    /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);

  if (isWebkit || isFirefox) {
    svgFilterSupport = false;
    return false;
  }

  const probe = document.createElement("div");
  probe.style.backdropFilter = "url(#glass-filter-probe)";
  svgFilterSupport = probe.style.backdropFilter !== "";

  return svgFilterSupport;
}

export default function GlassSurface({
  children,
  borderWidth = 0.07,
  brightness = 50,
  opacity = 0.93,
  blur = 6,
  displace = 0,
  distortionScale = -48,
  redOffset = 0,
  greenOffset = 0.6,
  blueOffset = 1.2,
  xChannel = "R",
  yChannel = "G",
  mixBlendMode = "difference",
  className = "",
}: GlassSurfaceProps) {
  const uniqueId = useId().replace(/:/g, "-");
  const filterId = `glass-filter-${uniqueId}`;
  const redGradId = `red-grad-${uniqueId}`;
  const blueGradId = `blue-grad-${uniqueId}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const feImageRef = useRef<SVGFEImageElement>(null);
  const redChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const greenChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const blueChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const gaussianBlurRef = useRef<SVGFEGaussianBlurElement>(null);

  const svgSupported = useSyncExternalStore(
    emptySubscribe,
    getSvgClientSnapshot,
    getSvgServerSnapshot,
  );



  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* CSSOM writes are exempt from `style-src`, so this is the one channel a
       per-instance value can reach the pane through. Nothing paints with it
       until `.glass-surface--svg` lands, which is client-only anyway. */
    container.style.setProperty("--filter-id", `url(#${filterId})`);

    const apply = () => {
      const rect = container.getBoundingClientRect();
      const actualWidth = Math.max(Math.round(rect.width || 400), 10);
      const actualHeight = Math.max(Math.round(rect.height || 200), 10);
      const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);
      /* Whatever radius the stylesheet gave this pane — read per pass so a
         responsive rule cannot leave the map cornered differently. */
      const borderRadius =
        Number.parseFloat(
          getComputedStyle(container).borderTopLeftRadius || "0",
        ) || 0;

      const svgContent = `
        <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#0000"/>
              <stop offset="100%" stop-color="red"/>
            </linearGradient>
            <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#0000"/>
              <stop offset="100%" stop-color="blue"/>
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
          <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradId})" />
          <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
          <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
        </svg>
      `;

      feImageRef.current?.setAttribute(
        "href",
        `data:image/svg+xml,${encodeURIComponent(svgContent)}`,
      );

      for (const [ref, offset] of [
        [redChannelRef, redOffset],
        [greenChannelRef, greenOffset],
        [blueChannelRef, blueOffset],
      ] as const) {
        const node = ref.current;
        if (!node) continue;
        node.setAttribute("scale", (distortionScale + offset).toString());
        node.setAttribute("xChannelSelector", xChannel);
        node.setAttribute("yChannelSelector", yChannel);
      }

      gaussianBlurRef.current?.setAttribute("stdDeviation", displace.toString());
    };

    let applied = false;
    let frame = 0;
    let observer: ResizeObserver | null = null;

    const safeApply = () => {
      if (applied && frame && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(frame);
      if (typeof requestAnimationFrame !== "undefined") {
        frame = requestAnimationFrame(() => {
          apply();
          applied = true;
        });
      } else {
        apply();
        applied = true;
      }
    };

    const initialRect = container.getBoundingClientRect();
    const isNearViewport =
      initialRect.top < (window.innerHeight || 800) + 300 && initialRect.bottom > -300;

    let intersectionObserver: IntersectionObserver | null = null;

    if (isNearViewport) {
      apply();
      applied = true;
    } else if (typeof IntersectionObserver !== "undefined") {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            apply();
            applied = true;
            intersectionObserver?.disconnect();
            intersectionObserver = null;
          }
        },
        { rootMargin: "300px", threshold: 0.01 },
      );
      intersectionObserver.observe(container);
    } else {
      // Fallback if no IntersectionObserver
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => {
          apply();
          applied = true;
        });
      } else {
        window.setTimeout(() => {
          apply();
          applied = true;
        }, 100);
      }
    }

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        if (applied) {
          safeApply();
        }
      });
      observer.observe(container);
    }

    return () => {
      if (frame && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(frame);
      }
      observer?.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [
    borderWidth,
    brightness,
    opacity,
    blur,
    displace,
    distortionScale,
    redOffset,
    greenOffset,
    blueOffset,
    xChannel,
    yChannel,
    mixBlendMode,
    filterId,
    redGradId,
    blueGradId,
  ]);

  return (
    <div
      ref={containerRef}
      className={`glass-surface ${svgSupported ? "glass-surface--svg" : "glass-surface--fallback"} ${className}`.trim()}
    >
      <svg className="glass-surface__filter" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter
            id={filterId}
            colorInterpolationFilters="sRGB"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
          >
            <feImage
              ref={feImageRef}
              x="0"
              y="0"
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              result="map"
            />

            <feDisplacementMap
              ref={redChannelRef}
              in="SourceGraphic"
              in2="map"
              result="dispRed"
            />
            <feColorMatrix
              in="dispRed"
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="red"
            />

            <feDisplacementMap
              ref={greenChannelRef}
              in="SourceGraphic"
              in2="map"
              result="dispGreen"
            />
            <feColorMatrix
              in="dispGreen"
              type="matrix"
              values="0 0 0 0 0
                      0 1 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="green"
            />

            <feDisplacementMap
              ref={blueChannelRef}
              in="SourceGraphic"
              in2="map"
              result="dispBlue"
            />
            <feColorMatrix
              in="dispBlue"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
              result="blue"
            />

            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" result="output" />
            <feGaussianBlur ref={gaussianBlurRef} in="output" stdDeviation="0.7" />
          </filter>
        </defs>
      </svg>

      <div className="glass-surface__content">{children}</div>
    </div>
  );
}
