// Combined photoreal finishing pass: screen-space sun god-rays, lens flare
// ghosts + anamorphic streak, film grain, and a gentle vignette. Runs on the
// HDR buffer before OutputPass tonemaps, so ray/flare energy blooms naturally.
// One fullscreen pass instead of four keeps the photo tier affordable.
export const CinematicShader = {
  name: 'CinematicShader',

  uniforms: {
    tDiffuse: { value: null },
    uSunScreen: { value: { x: 0.5, y: 0.5 } }, // sun position in uv space
    uSunVis: { value: 0.0 },                   // 0 when sun behind/off-screen
    uSunColor: { value: { x: 1.0, y: 0.9, z: 0.8 } },
    uAspect: { value: 1.0 },
    uTime: { value: 0.0 },
    uRayThreshold: { value: 1.2 },             // HDR luma floor feeding the rays
    uRayDecay: { value: 0.88 },
    uRayWeight: { value: 0.035 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.35 },
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    #define RAY_SAMPLES 36
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uSunScreen;
    uniform float uSunVis;
    uniform vec3 uSunColor;
    uniform float uAspect;
    uniform float uTime;
    uniform float uRayThreshold;
    uniform float uRayDecay;
    uniform float uRayWeight;
    uniform float uGrain;
    uniform float uVignette;

    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      if (uSunVis > 0.001) {
        // --- volumetric god-rays: march toward the sun accumulating HDR energy;
        // anything occluding the sun's disc kills the samples, carving shafts.
        vec2 delta = (uSunScreen - vUv) / float(RAY_SAMPLES);
        // jitter the start point to trade banding for grain
        vec2 pos = vUv + delta * hash21(vUv * 731.7 + uTime);
        float illum = 1.0;
        vec3 rays = vec3(0.0);
        for (int i = 0; i < RAY_SAMPLES; i++) {
          pos += delta;
          vec3 s = texture2D(tDiffuse, pos).rgb;
          rays += max(vec3(0.0), s - uRayThreshold) * illum;
          illum *= uRayDecay;
        }
        col += rays * uRayWeight * uSunVis;

        // --- anamorphic streak through the sun
        vec2 dv = (vUv - uSunScreen) * vec2(uAspect, 1.0);
        float streak = exp(-abs(dv.y) * 55.0) * exp(-abs(dv.x) * 3.5);
        col += uSunColor * streak * 0.22 * uSunVis;

        // --- lens ghosts mirrored through screen centre
        vec2 toCenter = vec2(0.5) - uSunScreen;
        vec3 tints[3];
        tints[0] = vec3(0.35, 0.55, 1.00);
        tints[1] = vec3(0.30, 1.00, 0.55);
        tints[2] = vec3(1.00, 0.45, 0.35);
        for (int i = 0; i < 3; i++) {
          vec2 gp = uSunScreen + toCenter * (1.25 + float(i) * 0.55);
          float d = length((vUv - gp) * vec2(uAspect, 1.0));
          float r = 0.06 + float(i) * 0.045;
          float g = pow(max(0.0, 1.0 - d / r), 2.5);
          col += tints[i] * g * 0.10 * uSunVis;
        }
      }

      // --- film grain (animated, luma-preserving-ish)
      float n = hash21(vUv * vec2(1483.0, 1741.0) + fract(uTime * 61.7) * 913.0);
      col += (n - 0.5) * uGrain * (0.4 + 0.6 * clamp(luma(col), 0.0, 1.0));

      // --- vignette
      float v = length((vUv - 0.5) * vec2(uAspect, 1.0) * 1.35);
      col *= mix(1.0, smoothstep(1.35, 0.35, v), uVignette);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
