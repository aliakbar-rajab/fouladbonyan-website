import React, { useEffect, useRef } from "react";
import type * as ThreeTypes from "three";

export interface LightPillarProps {
  topColor?: string;
  bottomColor?: string;
  intensity?: number;
  rotationSpeed?: number;
  interactive?: boolean;
  className?: string;
  glowAmount?: number;
  pillarWidth?: number;
  pillarHeight?: number;
  noiseIntensity?: number;
  mixBlendMode?: React.CSSProperties["mixBlendMode"];
  pillarRotation?: number;
  quality?: "low" | "medium" | "high";
}

const globalClockStart =
  typeof performance !== "undefined" ? performance.now() : 0;

export function LightPillar({
  topColor = "#5227FF",
  bottomColor = "#FF9FFC",
  intensity = 1.0,
  rotationSpeed = 0.3,
  interactive = false,
  className = "",
  glowAmount = 0.005,
  pillarWidth = 3.0,
  pillarHeight = 0.4,
  noiseIntensity = 0.5,
  mixBlendMode = "screen",
  pillarRotation = 0,
  quality = "high",
}: LightPillarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const rendererRef = useRef<ThreeTypes.WebGLRenderer | null>(null);
  const materialRef = useRef<ThreeTypes.ShaderMaterial | null>(null);
  const sceneRef = useRef<ThreeTypes.Scene | null>(null);
  const cameraRef = useRef<ThreeTypes.OrthographicCamera | null>(null);
  const geometryRef = useRef<ThreeTypes.PlaneGeometry | null>(null);
  const mouseRef = useRef<ThreeTypes.Vector2 | null>(null);
  const rotationSpeedRef = useRef(rotationSpeed);

  useEffect(() => {
    rotationSpeedRef.current = rotationSpeed;
  }, [rotationSpeed]);

  useEffect(() => {
    const container = containerRef.current;
    if (
      !container ||
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      (typeof window.WebGLRenderingContext === "undefined" &&
        typeof window.WebGL2RenderingContext === "undefined")
    ) {
      return;
    }

    let isDestroyed = false;
    let cleanupListeners: (() => void) | null = null;

    import("three")
      .then((THREE) => {
        if (isDestroyed || !containerRef.current) return;

        const currentContainer = containerRef.current;
        let hasWebGL = false;
        try {
          const probe = document.createElement("canvas");
          hasWebGL = Boolean(
            typeof probe.getContext === "function" &&
              (probe.getContext("webgl2") ||
                probe.getContext("webgl") ||
                probe.getContext("experimental-webgl")),
          );
        } catch {
          // WebGL unavailable
        }
        if (!hasWebGL) return;

        const width = currentContainer.clientWidth || 1;
        const height = currentContainer.clientHeight || 1;
        const winW = window.innerWidth || 1;
        const winH = window.innerHeight || 1;
        const initialRect = currentContainer.getBoundingClientRect();

        const isMobile =
          typeof navigator !== "undefined" &&
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
          );
        const isLowEndDevice =
          isMobile ||
          (typeof navigator !== "undefined" &&
            Boolean(
              navigator.hardwareConcurrency &&
                navigator.hardwareConcurrency <= 4,
            ));

        let effectiveQuality = quality;
        if (isLowEndDevice && quality === "high") effectiveQuality = "medium";
        if (isMobile && quality !== "low") effectiveQuality = "low";

        const qualitySettings = {
          low: {
            iterations: 24,
            waveIterations: 1,
            pixelRatio: 0.5,
            precision: "mediump",
            stepMultiplier: 1.5,
          },
          medium: {
            iterations: 40,
            waveIterations: 2,
            pixelRatio: 0.65,
            precision: "mediump",
            stepMultiplier: 1.2,
          },
          high: {
            iterations: 80,
            waveIterations: 4,
            pixelRatio: Math.min(
              typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              2,
            ),
            precision: "highp",
            stepMultiplier: 1.0,
          },
        };

        const settings =
          qualitySettings[effectiveQuality] || qualitySettings.medium;

        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        cameraRef.current = camera;

        let renderer: ThreeTypes.WebGLRenderer;
        try {
          renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: true,
            powerPreference:
              effectiveQuality === "high" ? "high-performance" : "low-power",
            precision: settings.precision as "highp" | "mediump" | "lowp",
            stencil: false,
            depth: false,
          });
        } catch {
          return;
        }

        renderer.setSize(width, height);
        renderer.setPixelRatio(settings.pixelRatio);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.pointerEvents = "none";

        while (currentContainer.firstChild) {
          currentContainer.removeChild(currentContainer.firstChild);
        }
        currentContainer.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const parseColor = (hex: string): ThreeTypes.Vector3 => {
          const color = new THREE.Color(hex);
          return new THREE.Vector3(color.r, color.g, color.b);
        };

        const mouse = new THREE.Vector2(0, 0);
        mouseRef.current = mouse;

        const vertexShader = `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `;

        const fragmentShader = `
          precision ${settings.precision} float;

          uniform float uTime;
          uniform vec2 uResolution;
          uniform vec2 uWindowResolution;
          uniform vec2 uCanvasOffset;
          uniform float uPixelRatio;
          uniform vec2 uMouse;
          uniform vec3 uTopColor;
          uniform vec3 uBottomColor;
          uniform float uIntensity;
          uniform bool uInteractive;
          uniform float uGlowAmount;
          uniform float uPillarWidth;
          uniform float uPillarHeight;
          uniform float uNoiseIntensity;
          uniform float uRotCos;
          uniform float uRotSin;
          uniform float uPillarRotCos;
          uniform float uPillarRotSin;
          uniform float uWaveSin;
          uniform float uWaveCos;
          varying vec2 vUv;

          const float STEP_MULT = ${settings.stepMultiplier.toFixed(1)};
          const int MAX_ITER = ${settings.iterations};
          const int WAVE_ITER = ${settings.waveIterations};

          #if __VERSION__ < 300
          vec3 customTanh(vec3 x) {
            vec3 e2x = exp(clamp(2.0 * x, -20.0, 20.0));
            return (e2x - 1.0) / (e2x + 1.0);
          }
          #define tanh customTanh
          #endif

          void main() {
            vec2 screenCoord = (gl_FragCoord.xy / uPixelRatio) + uCanvasOffset;
            vec2 screenUv = vec2(
              (screenCoord.x / uWindowResolution.x * 2.0 - 1.0) * (uWindowResolution.x / uWindowResolution.y),
              (screenCoord.y / uWindowResolution.y * 2.0 - 1.0)
            );

            vec2 uv = vec2(
              uPillarRotCos * screenUv.x - uPillarRotSin * screenUv.y,
              uPillarRotSin * screenUv.x + uPillarRotCos * screenUv.y
            );

            vec3 ro = vec3(0.0, 0.0, -10.0);
            vec3 rd = normalize(vec3(uv, 1.0));

            float rotC = uRotCos;
            float rotS = uRotSin;
            if(uInteractive && (uMouse.x != 0.0 || uMouse.y != 0.0)) {
              float a = uMouse.x * 6.283185;
              rotC = cos(a);
              rotS = sin(a);
            }

            vec3 col = vec3(0.0);
            float t = 0.1;
            
            for(int i = 0; i < MAX_ITER; i++) {
              vec3 p = ro + rd * t;
              p.xz = vec2(rotC * p.x - rotS * p.z, rotS * p.x + rotC * p.z);

              vec3 q = p;
              q.y = p.y * uPillarHeight;
              q.x += uTime * 0.25;
              q.z += uTime * 0.15;
              
              float freq = 0.28;
              float amp = 1.35;
              for(int j = 0; j < WAVE_ITER; j++) {
                q.xz = vec2(uWaveCos * q.x - uWaveSin * q.z, uWaveSin * q.x + uWaveCos * q.z);
                q += sin(vec3(q.z, q.x, q.y) * freq + vec3(uTime * 0.12, uTime * 0.06, uTime * 0.09) * float(j + 1)) * amp;
                freq *= 1.5;
                amp *= 0.48;
              }
              
              vec2 ribbonCoord = vec2(q.x * 0.36 + q.y * 0.28, q.z * 0.55 - q.y * 0.18);
              float d = length(cos(ribbonCoord)) - 0.48;
              float bound = length(vec2(p.x * 0.22, p.z)) - uPillarWidth;
              float k = 4.0;
              float h = max(k - abs(d - bound), 0.0);
              d = max(d, bound) + h * h * 0.0625 / k;
              d = abs(d) * 0.44 + 0.12;

              float grad = clamp((10.0 - p.y) / 22.0, 0.0, 1.0);
              col += mix(uBottomColor, uTopColor, grad) / d;

              t += d * STEP_MULT;
              if(t > 50.0) break;
            }

            float widthNorm = uPillarWidth / 3.0;
            col = tanh(col * uGlowAmount / widthNorm);
            
            col -= fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 15.0 * uNoiseIntensity;
            
            gl_FragColor = vec4(col * uIntensity, 1.0);
          }
        `;

        const pillarRotRad = (pillarRotation * Math.PI) / 180;
        const waveSin = Math.sin(0.4);
        const waveCos = Math.cos(0.4);

        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(width, height) },
            uWindowResolution: { value: new THREE.Vector2(winW, winH) },
            uCanvasOffset: {
              value: new THREE.Vector2(
                initialRect.left,
                winH - initialRect.bottom,
              ),
            },
            uPixelRatio: { value: settings.pixelRatio },
            uMouse: { value: mouse },
            uTopColor: { value: parseColor(topColor) },
            uBottomColor: { value: parseColor(bottomColor) },
            uIntensity: { value: intensity },
            uInteractive: { value: interactive },
            uGlowAmount: { value: glowAmount },
            uPillarWidth: { value: pillarWidth },
            uPillarHeight: { value: pillarHeight },
            uNoiseIntensity: { value: noiseIntensity },
            uRotCos: { value: 1.0 },
            uRotSin: { value: 0.0 },
            uPillarRotCos: { value: Math.cos(pillarRotRad) },
            uPillarRotSin: { value: Math.sin(pillarRotRad) },
            uWaveSin: { value: waveSin },
            uWaveCos: { value: waveCos },
          },
          transparent: true,
          depthWrite: false,
          depthTest: false,
        });
        materialRef.current = material;

        const geometry = new THREE.PlaneGeometry(2, 2);
        geometryRef.current = geometry;
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        let mouseMoveTimeout: number | null = null;
        const handleMouseMove = (event: MouseEvent) => {
          if (!interactive || !mouseRef.current) return;

          if (mouseMoveTimeout) return;

          mouseMoveTimeout = window.setTimeout(() => {
            mouseMoveTimeout = null;
          }, 16);

          const rect = currentContainer.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          mouseRef.current.set(x, y);
        };

        if (interactive) {
          currentContainer.addEventListener("mousemove", handleMouseMove, {
            passive: true,
          });
        }

        const motionQuery =
          typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-reduced-motion: reduce)")
            : null;
        let reducedMotion = motionQuery?.matches ?? false;

        let isVisible = true;
        let lastTime = performance.now();
        const targetFPS = effectiveQuality === "low" ? 30 : 60;
        const frameTime = 1000 / targetFPS;

        const updateCanvasPosition = () => {
          if (!currentContainer || !materialRef.current) return;
          const rect = currentContainer.getBoundingClientRect();
          const curWinW = window.innerWidth || 1;
          const curWinH = window.innerHeight || 1;
          materialRef.current.uniforms.uCanvasOffset.value.set(
            rect.left,
            curWinH - rect.bottom,
          );
          materialRef.current.uniforms.uWindowResolution.value.set(
            curWinW,
            curWinH,
          );
        };

        const renderSingleFrame = (tVal: number) => {
          if (
            !materialRef.current ||
            !rendererRef.current ||
            !sceneRef.current ||
            !cameraRef.current
          )
            return;
          updateCanvasPosition();
          materialRef.current.uniforms.uTime.value = tVal;
          materialRef.current.uniforms.uRotCos.value = Math.cos(tVal * 0.3);
          materialRef.current.uniforms.uRotSin.value = Math.sin(tVal * 0.3);
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        const animate = (currentTime: number) => {
          if (!isVisible || reducedMotion) {
            rafRef.current = null;
            return;
          }

          if (
            !materialRef.current ||
            !rendererRef.current ||
            !sceneRef.current ||
            !cameraRef.current
          )
            return;

          const deltaTime = currentTime - lastTime;

          if (deltaTime >= frameTime) {
            updateCanvasPosition();
            const t =
              (currentTime - globalClockStart) *
              0.001 *
              rotationSpeedRef.current;
            materialRef.current.uniforms.uTime.value = t;
            materialRef.current.uniforms.uRotCos.value = Math.cos(t * 0.3);
            materialRef.current.uniforms.uRotSin.value = Math.sin(t * 0.3);
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            lastTime = currentTime - (deltaTime % frameTime);
          }

          rafRef.current = requestAnimationFrame(animate);
        };

        const startOrStopLoop = () => {
          if (reducedMotion) {
            if (rafRef.current) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            renderSingleFrame(3.4);
          } else if (isVisible && !rafRef.current) {
            lastTime = performance.now();
            rafRef.current = requestAnimationFrame(animate);
          } else if (!isVisible && rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        };

        startOrStopLoop();

        const onMotionChange = (event: MediaQueryListEvent) => {
          reducedMotion = event.matches;
          startOrStopLoop();
        };
        motionQuery?.addEventListener("change", onMotionChange);

        const updateSize = () => {
          if (
            !rendererRef.current ||
            !materialRef.current ||
            !containerRef.current
          )
            return;
          const newWidth = containerRef.current.clientWidth || 1;
          const newHeight = containerRef.current.clientHeight || 1;
          rendererRef.current.setSize(newWidth, newHeight);
          materialRef.current.uniforms.uResolution.value.set(
            newWidth,
            newHeight,
          );
          updateCanvasPosition();
          if (reducedMotion) {
            renderSingleFrame(3.4);
          }
        };

        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            updateSize();
          });
          resizeObserver.observe(currentContainer);
        }

        window.addEventListener("resize", updateSize, { passive: true });
        window.addEventListener("scroll", updateCanvasPosition, {
          passive: true,
        });

        let intersectionObserver: IntersectionObserver | null = null;
        if (typeof IntersectionObserver !== "undefined") {
          intersectionObserver = new IntersectionObserver(
            (entries) => {
              isVisible = entries[0]?.isIntersecting ?? true;
              startOrStopLoop();
            },
            { threshold: 0.01 },
          );
          intersectionObserver.observe(currentContainer);
        }

        cleanupListeners = () => {
          window.removeEventListener("resize", updateSize);
          window.removeEventListener("scroll", updateCanvasPosition);
          resizeObserver?.disconnect();
          intersectionObserver?.disconnect();
          motionQuery?.removeEventListener("change", onMotionChange);
          if (interactive) {
            currentContainer.removeEventListener(
              "mousemove",
              handleMouseMove,
            );
          }
        };
      })
      .catch(() => {
        // Failed to load three
      });

    return () => {
      isDestroyed = true;
      if (cleanupListeners) cleanupListeners();

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        if (
          container &&
          container.contains(rendererRef.current.domElement)
        ) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
      if (materialRef.current) {
        materialRef.current.dispose();
      }
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }

      rendererRef.current = null;
      materialRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      geometryRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality]);

  useEffect(() => {
    if (!materialRef.current) return;
    import("three").then((THREE) => {
      if (!materialRef.current) return;
      const color = new THREE.Color(topColor);
      materialRef.current.uniforms.uTopColor.value.set(
        color.r,
        color.g,
        color.b,
      );
    });
  }, [topColor]);

  useEffect(() => {
    if (!materialRef.current) return;
    import("three").then((THREE) => {
      if (!materialRef.current) return;
      const color = new THREE.Color(bottomColor);
      materialRef.current.uniforms.uBottomColor.value.set(
        color.r,
        color.g,
        color.b,
      );
    });
  }, [bottomColor]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uIntensity.value = intensity;
  }, [intensity]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uInteractive.value = interactive;
  }, [interactive]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uGlowAmount.value = glowAmount;
  }, [glowAmount]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uPillarWidth.value = pillarWidth;
  }, [pillarWidth]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uPillarHeight.value = pillarHeight;
  }, [pillarHeight]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uNoiseIntensity.value = noiseIntensity;
  }, [noiseIntensity]);

  useEffect(() => {
    if (!materialRef.current) return;
    const pillarRotRad = (pillarRotation * Math.PI) / 180;
    materialRef.current.uniforms.uPillarRotCos.value = Math.cos(pillarRotRad);
    materialRef.current.uniforms.uPillarRotSin.value = Math.sin(pillarRotRad);
  }, [pillarRotation]);

  return (
    <div
      ref={containerRef}
      className={`light-pillar-container ${className}`}
      style={{ mixBlendMode, pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}

export default LightPillar;
