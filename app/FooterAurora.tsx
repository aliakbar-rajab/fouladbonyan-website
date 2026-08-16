import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

/*
 * Footer background: three braided ribbons of light.
 *
 * Every filament is a full-width sine defined for *every* x, so no strand ever
 * begins inside the frame -- the composition has no origin point, it only has
 * a crop. Each braid is additionally warped by a log-polar rotation
 * (`angle = rot * log(|uv| + 1)`), which leaves the middle almost flat but
 * swings the ribbon 25-35 degrees by the time it reaches the far left/right of
 * the canvas, so the light dives out through the outer corners instead of
 * running off as a horizontal bar.
 *
 * The host element is deliberately overscanned well past the footer box (see
 * `.footer-aurora` in globals/footer.css); what the visitor sees is the middle
 * crop of a much larger picture, which is what keeps the knots and turnarounds
 * off-screen.
 *
 * The canvas is opaque black and composited with `mix-blend-mode: screen`, so
 * black contributes nothing and only the light survives -- no muddy alpha
 * fringing around the filaments.
 */

const PALETTE = [
  "#3b2a14", // deep bronze shadow
  "#8c5a1c", // bronze
  "#d9922a", // amber
  "#ffc85c", // gold
  "#7fa8bd", // restrained cool steel -- only the tail of the lower braid
];

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uPalette[5];
uniform float uIntensity;

out vec4 fragColor;

const int CREST_LINES = 13;
const int CORE_LINES = 17;
const int UNDER_LINES = 11;

mat2 rot(float a) {
  return mat2(cos(a), sin(a), -sin(a), cos(a));
}

vec3 ramp(float t) {
  float s = clamp(t, 0.0, 0.9999) * 4.0;
  int i = int(floor(s));
  return mix(uPalette[i], uPalette[i + 1], smoothstep(0.0, 1.0, fract(s)));
}

/*
 * One filament. Filaments in a braid share a baseline but each carries its
 * own phase and its own slowly breathing amplitude, so they weave through one
 * another instead of stacking up as parallel bars.
 *
 * The gaussian factor matters as much as the core: a bare 1/d falloff has a
 * tail long enough that forty filaments across a footer this wide add up to a
 * flat tan fog instead of readable ribbons.
 */
float filament(vec2 p, float phase, float amp) {
  /*
   * A single sine per filament makes the braid read as rake teeth, because
   * every filament is the same curve translated. The long second harmonic
   * (and its opposing drift) pulls neighbours apart at different rates, so
   * the bundle meanders.
   */
  float y = sin(p.x + phase) * amp
          + sin(p.x * 0.43 - phase * 0.55 + 1.7) * amp * 0.42;
  float d = abs(p.y - y);
  return (0.0125 / (d + 0.011)) * exp(-d * d * 7.0);
}

void main() {
  /*
   * x is normalised by width, not by height. Normalising both axes by height
   * (the usual shadertoy convention) means a narrow phone viewport only ever
   * samples a sliver of each sine, and every filament flattens into a
   * horizontal bar. Width normalisation keeps the same slice of the
   * composition on screen at every aspect ratio; y stays height-normalised so
   * the braids keep their vertical layout.
   */
  vec2 uv;
  uv.x = (2.0 * gl_FragCoord.x - uResolution.x) / uResolution.x * 3.9;
  uv.y = -(2.0 * gl_FragCoord.y - uResolution.y) / uResolution.y;

  float t = uTime;
  vec3 col = vec3(0.0);

  // Crest -- enters over the far inline-start corner, brightest of the three.
  {
    vec2 p = uv * rot(-0.32 * log(length(uv) + 1.0));
    p.x = -p.x;
    p.y += 0.56;
    for (int i = 0; i < CREST_LINES; i++) {
      float fi = float(i);
      float phase = 0.80 * fi + 7.6 + t * 0.10;
      float amp = sin(1.5 + 0.20 * fi + t * 0.20) * 0.30;
      col += ramp(fi / float(CREST_LINES - 1) * 0.52 + 0.34)
           * filament(p, phase, amp) * 0.105;
    }
  }

  // Core -- a dim, dense haze drifting the other way, right behind the cards.
  {
    vec2 p = uv * rot(-0.20 * log(length(uv) + 1.0));
    p.y += 0.02;
    for (int i = 0; i < CORE_LINES; i++) {
      float fi = float(i);
      float phase = 0.74 * fi + 4.8 - t * 0.085;
      float amp = sin(2.0 + 0.16 * fi + t * 0.17) * 0.32;
      col += ramp(fi / float(CORE_LINES - 1) * 0.46 + 0.06)
           * filament(p, phase, amp) * 0.07;
    }
  }

  // Under -- rides in low from the far inline-end corner.
  {
    vec2 p = uv * rot(0.36 * log(length(uv) + 1.0));
    p.y -= 0.58;
    for (int i = 0; i < UNDER_LINES; i++) {
      float fi = float(i);
      float phase = 0.86 * fi + 2.2 + t * 0.12;
      float amp = sin(1.1 + 0.22 * fi + t * 0.23) * 0.28;
      col += ramp(fi / float(UNDER_LINES - 1) * 0.40 + 0.48)
           * filament(p, phase, amp) * 0.125;
    }
  }

  /*
   * Bias the whole composition toward the outer thirds of the canvas. This is
   * what sells the light as arriving from beyond the viewport rather than
   * living inside the footer -- and it hands the middle back to the content,
   * where the cards need a calm backdrop.
   */
  col *= uIntensity * (0.6 + 0.4 * smoothstep(0.55, 2.7, abs(uv.x)));

  // Soft shoulder so the hot cores roll off to gold rather than clipping white.
  col = vec3(1.0) - exp(-col * 1.28);

  fragColor = vec4(col, 1.0);
}
`;

const buildPalette = () =>
  PALETTE.map((hex) => {
    const c = new Color(hex);
    return [c.r, c.g, c.b] as [number, number, number];
  });

export type FooterAuroraProps = {
  /** Overall brightness of the braids. */
  intensity?: number;
  /** Multiplier on the drift/breathing rate of every braid. */
  speed?: number;
};

export function FooterAurora({
  intensity = 1,
  speed = 1,
}: FooterAuroraProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const settings = useRef({ intensity, speed });

  useEffect(() => {
    settings.current = { intensity, speed };
  }, [intensity, speed]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let hasWebGL = false;
    try {
      const probe = document.createElement("canvas");
      hasWebGL = Boolean(
        typeof probe.getContext === "function" &&
          (probe.getContext("webgl2") || probe.getContext("webgl")),
      );
    } catch {
      // WebGL unavailable -- the CSS base gradient stands on its own.
    }
    if (!hasWebGL) return;

    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer({
        alpha: false,
        antialias: false,
        // The braids are pure soft gradients, so 1.5x is indistinguishable
        // from 2x here and costs a third of the fill.
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    if (!gl) return;

    gl.clearColor(0, 0, 0, 1);
    if (gl.canvas instanceof HTMLCanvasElement) {
      gl.canvas.style.display = "block";
      gl.canvas.style.width = "100%";
      gl.canvas.style.height = "100%";
    }

    const geometry = new Triangle(gl);
    if (geometry.attributes?.uv) {
      delete geometry.attributes.uv;
    }

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [host.offsetWidth || 1, host.offsetHeight || 1] },
        uPalette: { value: buildPalette() },
        uIntensity: { value: intensity },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    host.appendChild(gl.canvas);

    const resize = () => {
      if (!renderer) return;
      const width = host.offsetWidth;
      const height = host.offsetHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [width, height];
    };
    resize();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(host);

    const draw = (elapsedMs: number) => {
      if (!renderer) return;
      program.uniforms.uTime.value = (elapsedMs * 0.001) * settings.current.speed;
      program.uniforms.uIntensity.value = settings.current.intensity;
      renderer.render({ scene: mesh });
    };

    let frame = 0;
    let visible = true;
    const loop = (now: number) => {
      if (!visible) {
        frame = 0;
        return;
      }
      draw(now);
      frame = requestAnimationFrame(loop);
    };

    const motionQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    let reducedMotion = motionQuery?.matches ?? false;

    const sync = () => {
      if (reducedMotion) {
        if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
        // A single frame from a point in the cycle where the braids are open.
        draw(3400);
      } else if (visible && !frame) {
        frame = requestAnimationFrame(loop);
      }
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      sync();
    };
    motionQuery?.addEventListener("change", onMotionChange);

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          visible = entries[0]?.isIntersecting ?? true;
          if (visible) {
            sync();
          } else if (frame) {
            cancelAnimationFrame(frame);
            frame = 0;
          }
        },
        { threshold: 0.01 },
      );
      intersectionObserver.observe(host);
    } else {
      sync();
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      motionQuery?.removeEventListener("change", onMotionChange);
      if (gl.canvas?.parentNode === host) {
        host.removeChild(gl.canvas);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // Braid geometry is fixed at compile time; intensity/speed ride the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="footer-aurora-canvas" ref={hostRef} aria-hidden="true" />;
}

export default FooterAurora;
