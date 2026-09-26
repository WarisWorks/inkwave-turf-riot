// Wetness / meniscus / ripple treatment adapted for our XZ paint grid from
// jaydendavisnc/inkwave's world/inkShading.js (MIT; public/licenses/inkwave-MIT.txt).
import * as THREE from "three";

const RIPPLE_COUNT = 12;
const WAKE_COUNT = 4;
const DRY_SECONDS = 6;

type Swimmer = { x: number; y: number; z: number; vx: number; vz: number; alive: boolean; swimming: boolean; climbing: boolean; isPlayer: boolean };

export function createLiquidInk(width: number, height: number, texWidth: number, texHeight: number) {
  const wet = new Uint8Array(width * height);
  const birth = new Float32Array(wet.length).fill(-DRY_SECONDS);
  const texture = new THREE.DataTexture(wet, width, height, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const uniforms = {
    inkWet: { value: texture },
    inkTexel: { value: new THREE.Vector2(1 / texWidth, 1 / texHeight) },
    inkClock: { value: 0 },
    inkDetail: { value: 1 },
    inkRipples: { value: Array.from({ length: RIPPLE_COUNT }, () => new THREE.Vector4(0, -999, 0, -99)) },
    inkRippleSize: { value: Array.from({ length: RIPPLE_COUNT }, () => 0) },
    inkWakes: { value: Array.from({ length: WAKE_COUNT }, () => new THREE.Vector4(0, -999, 0, 0)) },
    inkWakeDirs: { value: Array.from({ length: WAKE_COUNT }, () => new THREE.Vector2(0, 1)) },
  };
  let cursor = 0, accumulator = 0, lastRipple = -1;
  return {
    uniforms,
    markCell(index: number) { birth[index] = uniforms.inkClock.value; },
    ripple(x: number, y: number, z: number, size: number) {
      if (uniforms.inkClock.value - lastRipple < 0.045) return;
      lastRipple = uniforms.inkClock.value;
      uniforms.inkRipples.value[cursor].set(x, y, z, lastRipple);
      uniforms.inkRippleSize.value[cursor] = Math.min(1, size);
      cursor = (cursor + 1) % RIPPLE_COUNT;
    },
    update(dt: number, swimmers: readonly Swimmer[], camera: THREE.Vector3, high: boolean) {
      uniforms.inkClock.value += dt;
      uniforms.inkDetail.value = high ? 1 : 0;
      accumulator += dt;
      if (accumulator >= 1 / 12) {
        accumulator = 0;
        for (let i = 0; i < wet.length; i++) wet[i] = Math.round(255 * Math.max(0, 1 - (uniforms.inkClock.value - birth[i]) / DRY_SECONDS));
        texture.needsUpdate = true;
      }
      const active = high ? swimmers.filter(a => a.alive && a.swimming && !a.climbing && Math.hypot(a.vx, a.vz) > 0.5)
        .sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer) || (a.x - camera.x) ** 2 + (a.z - camera.z) ** 2 - (b.x - camera.x) ** 2 - (b.z - camera.z) ** 2).slice(0, WAKE_COUNT) : [];
      for (let i = 0; i < WAKE_COUNT; i++) {
        const a = active[i];
        if (!a) { uniforms.inkWakes.value[i].w = 0; continue; }
        const speed = Math.hypot(a.vx, a.vz);
        uniforms.inkWakes.value[i].set(a.x, a.y, a.z, Math.min(1, speed / 10));
        uniforms.inkWakeDirs.value[i].set(a.vx / speed, a.vz / speed);
      }
    },
    reset() {
      wet.fill(0); birth.fill(-DRY_SECONDS); texture.needsUpdate = true;
      uniforms.inkClock.value = 0; accumulator = 0; cursor = 0; lastRipple = -1;
      uniforms.inkRipples.value.forEach(r => r.set(0, -999, 0, -99));
      uniforms.inkWakes.value.forEach(w => w.w = 0);
    },
    dispose() { texture.dispose(); },
  };
}

export const LIQUID_INK_UNIFORMS = /* glsl */`
  uniform sampler2D inkWet;
  uniform vec2 inkTexel;
  uniform float inkClock;
  uniform float inkDetail;
  uniform vec4 inkRipples[${RIPPLE_COUNT}];
  uniform float inkRippleSize[${RIPPLE_COUNT}];
  uniform vec4 inkWakes[${WAKE_COUNT}];
  uniform vec2 inkWakeDirs[${WAKE_COUNT}];
`;

// The original shader uses a face atlas and physical lighting. This lighter adaptation
// keeps our existing materials, zone markings and scoring, with no postprocessing pass.
export const LIQUID_INK_COLOR = /* glsl */`
  float amount = smoothstep(0.24, 0.78, ink.a) * upFace;
  float wet = texture2D(inkWet, clamp(uv, 0.0, 1.0)).r;
  float fresh = smoothstep(0.0, 0.97, wet);
  // Resolve the team at blended borders to keep orange/violet clean and readable.
  float team = smoothstep(-0.08, 0.08, ink.b - ink.r);
  vec3 pigment = mix(vec3(1.0, 0.144, 0.010), vec3(0.105, 0.074, 1.0), team);
  vec3 inkNormal = n;
  float lip = 0.0;
  if (amount > 0.01 && inkDetail > 0.5) {
    float ax = texture2D(inkMap, uv + vec2(inkTexel.x, 0.0)).a - texture2D(inkMap, uv - vec2(inkTexel.x, 0.0)).a;
    float az = texture2D(inkMap, uv + vec2(0.0, inkTexel.y)).a - texture2D(inkMap, uv - vec2(0.0, inkTexel.y)).a;
    // Surface tension: a rounded lip and quiet gel swells, smoother while fresh.
    vec2 slope = vec2(ax, az) * (0.48 + fresh * 0.3);
    slope += vec2(sin(vWorld.x * 3.1 + sin(vWorld.z * 2.4) + inkClock * 0.35), cos(vWorld.z * 3.5 + sin(vWorld.x * 2.2) - inkClock * 0.3)) * (0.014 + fresh * 0.015);
    lip = clamp(length(vec2(ax, az)), 0.0, 1.0);
    for (int i = 0; i < ${RIPPLE_COUNT}; i++) {
      vec4 p = inkRipples[i];
      float age = inkClock - p.w;
      if (age <= 0.0 || age >= 1.15 || abs(vWorld.y - p.y) > 0.4) continue;
      vec2 delta = vWorld.xz - p.xz;
      float d = length(delta), x = d - age * 2.4;
      float fade = 1.0 - age / 1.15;
      float envelope = exp(-x * x * 14.0) * fade * fade;
      slope += delta / max(d, 0.001) * sin(x * 17.0) * envelope * 0.18 * inkRippleSize[i];
    }
    for (int i = 0; i < ${WAKE_COUNT}; i++) {
      vec4 swimmer = inkWakes[i];
      if (swimmer.w < 0.01 || abs(vWorld.y - swimmer.y) > 0.4) continue;
      vec2 delta = vWorld.xz - swimmer.xz;
      vec2 forward = inkWakeDirs[i], side = vec2(-forward.y, forward.x);
      float back = -dot(delta, forward), lateral = dot(delta, side);
      float edge = abs(lateral) - back * 0.43;
      float envelope = smoothstep(-0.25, 0.2, back) * (1.0 - smoothstep(0.2, 3.2, back));
      slope += side * sign(lateral) * sin(edge * 12.0) * exp(-edge * edge * 8.0) * envelope * swimmer.w * 0.24;
    }
    inkNormal = normalize(n - vec3(slope.x, 0.0, slope.y));
  }
  vec3 eye = normalize(cameraPosition - vWorld);
  vec3 halfLight = normalize(sunDir + eye);
  float sheen = pow(max(0.0, dot(inkNormal, halfLight)), mix(24.0, 100.0, fresh));
  float fresnel = pow(1.0 - max(0.0, dot(inkNormal, eye)), 4.0);
  vec3 inkColor = pigment * (0.79 + 0.19 * max(0.0, dot(inkNormal, sunDir)) + fresh * 0.055 + lip * 0.06);
  inkColor += vec3(1.0, 0.96, 0.9) * sheen * (0.1 + fresh * 0.5);
  inkColor += mix(pigment, vec3(0.65, 0.8, 1.0), 0.35) * fresnel * (0.06 + fresh * 0.12);
  vec3 col = mix(base * (1.0 - lip * 0.08), inkColor, amount);
`;

/** Solid, scalloped ink coverage. A soft white brush is still used for mist particles. */
export function makeInkBrush(hex: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = hex;
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) {
    const angle = i / 96 * Math.PI * 2;
    const r = 59 + Math.sin(angle * 7 + 0.8) * 2 + Math.sin(angle * 11) * 1.4;
    const x = 64 + Math.cos(angle) * r, y = 64 + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  return canvas;
}
