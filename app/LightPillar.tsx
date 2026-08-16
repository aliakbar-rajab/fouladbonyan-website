import { useEffect, useRef } from "react";

// Decorative animated pillar behind the header/footer. Every site placement
// uses the same grey-over-black look, so the look is baked in here rather than
// passed as props -- there is no second configuration.
const globalClockStart =
  typeof performance !== "undefined" ? performance.now() : 0;

// Quality only ever varies by device capability, never by caller.
const QUALITY_TIERS = {
  low: { iterations: 24, waveIterations: 1, pixelRatio: 0.5, precision: "mediump", stepMultiplier: "1.5", fps: 30 },
  medium: { iterations: 40, waveIterations: 2, pixelRatio: 0.65, precision: "mediump", stepMultiplier: "1.2", fps: 60 },
  high: { iterations: 80, waveIterations: 4, pixelRatio: 0, precision: "highp", stepMultiplier: "1.0", fps: 60 },
} as const;

function pickQuality() {
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  if (isMobile) return QUALITY_TIERS.low;
  if (
    typeof navigator !== "undefined" &&
    navigator.hardwareConcurrency &&
    navigator.hardwareConcurrency <= 4
  ) {
    return QUALITY_TIERS.medium;
  }
  return QUALITY_TIERS.high;
}

const VERTEX_SHADER = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Ray-marched ribbon inside a rounded bound, tinted from black at the base to
// mid-grey at the top. All look constants (colors, glow, pillar size, the
// 49deg tilt, the 0.4rad wave rotation) are compile-time literals.
const fragmentShader = (tier: (typeof QUALITY_TIERS)[keyof typeof QUALITY_TIERS]) => `#version 300 es
precision ${tier.precision} float;

uniform float uTime;
uniform vec2 uWindowResolution;
uniform vec2 uCanvasOffset;
uniform float uPixelRatio;
out vec4 fragColor;

const float STEP_MULT = ${tier.stepMultiplier};
const int MAX_ITER = ${tier.iterations};
const int WAVE_ITER = ${tier.waveIterations};
const vec3 TOP_COLOR = vec3(0.2510, 0.2510, 0.2510);
const vec3 BOTTOM_COLOR = vec3(0.0);
const float INTENSITY = 3.0;
const float GLOW_AMOUNT = 0.005;
const float PILLAR_WIDTH = 4.5;
const float PILLAR_HEIGHT = 0.1;
const float NOISE_INTENSITY = 0.9;
const float PILLAR_ROT_COS = 0.656059;
const float PILLAR_ROT_SIN = 0.754710;
const float WAVE_COS = 0.921061;
const float WAVE_SIN = 0.389418;

void main() {
  vec2 screenCoord = (gl_FragCoord.xy / uPixelRatio) + uCanvasOffset;
  vec2 screenUv = vec2(
    (screenCoord.x / uWindowResolution.x * 2.0 - 1.0) * (uWindowResolution.x / uWindowResolution.y),
    (screenCoord.y / uWindowResolution.y * 2.0 - 1.0)
  );

  vec2 uv = vec2(
    PILLAR_ROT_COS * screenUv.x - PILLAR_ROT_SIN * screenUv.y,
    PILLAR_ROT_SIN * screenUv.x + PILLAR_ROT_COS * screenUv.y
  );

  vec3 ro = vec3(0.0, 0.0, -10.0);
  vec3 rd = normalize(vec3(uv, 1.0));

  float rotC = cos(uTime * 0.3);
  float rotS = sin(uTime * 0.3);

  vec3 col = vec3(0.0);
  float t = 0.1;

  for (int i = 0; i < MAX_ITER; i++) {
    vec3 p = ro + rd * t;
    p.xz = vec2(rotC * p.x - rotS * p.z, rotS * p.x + rotC * p.z);

    vec3 q = p;
    q.y = p.y * PILLAR_HEIGHT;
    q.x += uTime * 0.25;
    q.z += uTime * 0.15;

    float freq = 0.28;
    float amp = 1.35;
    for (int j = 0; j < WAVE_ITER; j++) {
      q.xz = vec2(WAVE_COS * q.x - WAVE_SIN * q.z, WAVE_SIN * q.x + WAVE_COS * q.z);
      q += sin(vec3(q.z, q.x, q.y) * freq + vec3(uTime * 0.12, uTime * 0.06, uTime * 0.09) * float(j + 1)) * amp;
      freq *= 1.5;
      amp *= 0.48;
    }

    vec2 ribbonCoord = vec2(q.x * 0.36 + q.y * 0.28, q.z * 0.55 - q.y * 0.18);
    float d = length(cos(ribbonCoord)) - 0.48;
    float bound = length(vec2(p.x * 0.22, p.z)) - PILLAR_WIDTH;
    float k = 4.0;
    float h = max(k - abs(d - bound), 0.0);
    d = max(d, bound) + h * h * 0.0625 / k;
    d = abs(d) * 0.44 + 0.12;

    float grad = clamp((10.0 - p.y) / 22.0, 0.0, 1.0);
    col += mix(BOTTOM_COLOR, TOP_COLOR, grad) / d;

    t += d * STEP_MULT;
    if (t > 50.0) break;
  }

  col = tanh(col * GLOW_AMOUNT / (PILLAR_WIDTH / 3.0));
  col -= fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 15.0 * NOISE_INTENSITY;

  fragColor = vec4(col * INTENSITY, 1.0);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, fragmentSource: string) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function LightPillar() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return undefined;

    const tier = pickQuality();
    const pixelRatio = tier.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: tier === QUALITY_TIERS.high ? "high-performance" : "low-power",
    });
    if (!gl) return undefined;

    const program = createProgram(gl, fragmentShader(tier));
    if (!program) return undefined;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    const uTime = gl.getUniformLocation(program, "uTime");
    const uWindowResolution = gl.getUniformLocation(program, "uWindowResolution");
    const uCanvasOffset = gl.getUniformLocation(program, "uCanvasOffset");
    gl.uniform1f(gl.getUniformLocation(program, "uPixelRatio"), pixelRatio);

    container.replaceChildren(canvas);

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const render = (time: number) => {
      const rect = container.getBoundingClientRect();
      gl.uniform2f(
        uCanvasOffset,
        rect.left,
        (window.innerHeight || 1) - rect.bottom,
      );
      gl.uniform2f(
        uWindowResolution,
        window.innerWidth || 1,
        window.innerHeight || 1,
      );
      gl.uniform1f(uTime, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const motionQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    let reducedMotion = motionQuery?.matches ?? false;
    let isVisible = true;
    let frame: number | null = null;
    let lastTime = performance.now();
    const frameTime = 1000 / tier.fps;

    const animate = (currentTime: number) => {
      const delta = currentTime - lastTime;
      if (delta >= frameTime) {
        render((currentTime - globalClockStart) * 0.001 * 0.15);
        lastTime = currentTime - (delta % frameTime);
      }
      frame = requestAnimationFrame(animate);
    };

    const startOrStopLoop = () => {
      if (reducedMotion || !isVisible) {
        if (frame) cancelAnimationFrame(frame);
        frame = null;
        // A still frame keeps the panel from going blank when the loop stops.
        if (reducedMotion) render(3.4);
        return;
      }
      if (!frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(animate);
      }
    };

    const onResize = () => {
      resize();
      if (reducedMotion || !isVisible) render(3.4);
    };
    const onScroll = () => {
      if (reducedMotion || !isVisible) render(3.4);
    };
    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      startOrStopLoop();
    };

    resize();
    startOrStopLoop();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(onResize)
        : null;
    resizeObserver?.observe(container);

    const intersectionObserver =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              isVisible = entries[0]?.isIntersecting ?? true;
              startOrStopLoop();
            },
            { threshold: 0.01 },
          )
        : null;
    intersectionObserver?.observe(container);

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    motionQuery?.addEventListener("change", onMotionChange);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      motionQuery?.removeEventListener("change", onMotionChange);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="light-pillar-container"
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}

export default LightPillar;
