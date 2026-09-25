import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { HudSnap, InputState, LiveConfig, SpecialId, SubId, WeaponId } from "./types";

const MAP = { minX: -30, minZ: -38, w: 60, d: 76 };
const GW = 120;
const GH = 152;
const TW = 480;
const TH = 608;
const MATCH_LEN = 180;
const GRAV = 22;
const STEP = 1 / 60;

const SPAWN_O: [number, number][] = [
  [-20, -28],
  [-4, -31],
  [4, -30],
  [8, -27],
];
const SPAWN_V: [number, number][] = [
  [20, 23],
  [-4, 31],
  [4, 30],
  [-8, 28],
];

type Team = 1 | 2;
type Box = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };

type Kid = {
  root: THREE.Group;
  body: THREE.Group;
  legs: THREE.Group;
  tentL: THREE.Object3D;
  tentR: THREE.Object3D;
  mount: THREE.Group;
  weapons: Record<WeaponId, THREE.Group>;
  nameSprite: THREE.Sprite;
  nameCanvas: HTMLCanvasElement;
};

type Actor = {
  name: string;
  team: Team;
  isPlayer: boolean;
  x: number;
  y: number;
  z: number;
  vy: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  alive: boolean;
  splat: number;
  ink: number;
  special: number;
  invuln: number;
  respawn: number;
  weapon: WeaponId;
  sub: SubId;
  specialId: SpecialId;
  fireCd: number;
  subCd: number;
  charge: number;
  think: number;
  goalX: number;
  goalZ: number;
  mode: "push" | "fight";
  target: number;
  phase: number;
  swimming: boolean;
  grounded: boolean;
  splats: number;
  deaths: number;
  rush: number;
  stuck: number;
  mesh: Kid;
};

type Proj = {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grav: number;
  life: number;
  team: Team;
  dmg: number;
  splash: number;
  splashR: number;
  paintR: number;
  hitR: number;
  scale: number;
  kind: "shot" | "bomb" | "beacon" | "flick";
  stuck: boolean;
  owner: number;
};

type Zone = { alive: boolean; x: number; z: number; team: Team; life: number; acc: number; r: number; mesh: THREE.Group };
type Beacon = { alive: boolean; x: number; y: number; z: number; team: Team; life: number; acc: number; mesh: THREE.Mesh };

export type EngineApi = {
  startMatch: () => void;
  pause: () => void;
  resume: () => void;
  orbit: () => void;
  showcase: () => void;
};

type Bridge = {
  config: { current: LiveConfig };
  onHud: (h: HudSnap) => void;
  onReady: () => void;
  onError: (m: string) => void;
  onResult: (r: NonNullable<HudSnap["result"]>) => void;
  onApi: (api: EngineApi) => void;
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function yawForward(yaw: number) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}
function yawRight(yaw: number) {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}
function yawToward(dx: number, dz: number) {
  return Math.atan2(-dx, -dz);
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getPos: () => { x: number; y: number; z: number };
      setKeys: (codes: string[]) => void;
      setSteer: (v: number) => void;
      kind: string;
    };
    __inkwave?: { startMatch: () => void; getPhase: () => string };
  }
}

export function mountInkWave(canvas: HTMLCanvasElement, mini: HTMLCanvasElement, bridge: Bridge) {
  const rand = mulberry32(11);
  const keys = new Set<string>();
  const scripted = new Set<string>();
  const held = (code: string) => keys.has(code) || scripted.has(code);

  let mode: "orbit" | "showcase" | "play" = "orbit";
  let phase: HudSnap["phase"] = "menu";
  let paused = false;
  let countdown = 0;
  let timeLeft = MATCH_LEN;
  let orangePct = 0;
  let bluePct = 0;
  let result: HudSnap["result"] = null;
  let resultSent = false;
  let feedId = 1;
  const feed: { id: number; text: string }[] = [];
  let banner = "";
  let bannerT = 0;
  let shake = 0;
  let orbitAng = 0.4;
  let hudAcc = 0;
  let miniAcc = 0;
  let scoreAcc = 0;
  let dead = false;
  let raf = 0;
  let lookDX = 0;
  let lookDY = 0;
  let dragLook = false;
  let lastPX = 0;
  let lastPY = 0;
  let fireMouse = false;
  let jumpEdge = false;
  let bombEdge = false;
  let specialEdge = false;
  let fireRelease = false;
  let prevJump = false;
  let prevFire = false;
  let locked = false;

  const solids: Box[] = [];
  const grid = new Uint8Array(GW * GH);
  const mask = new Uint8Array(GW * GH);

  const inkCanvas = document.createElement("canvas");
  inkCanvas.width = TW;
  inkCanvas.height = TH;
  const ictx = inkCanvas.getContext("2d", { alpha: true })!;
  const inkTex = new THREE.CanvasTexture(inkCanvas);
  inkTex.colorSpace = THREE.SRGBColorSpace;
  inkTex.wrapS = inkTex.wrapT = THREE.ClampToEdgeWrapping;
  inkTex.generateMipmaps = false;
  inkTex.minFilter = THREE.LinearFilter;
  inkTex.magFilter = THREE.LinearFilter;
  inkTex.flipY = true;

  function makeBrush(hex: string) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grd.addColorStop(0, hex);
    grd.addColorStop(0.55, hex);
    grd.addColorStop(1, hex + "00");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return c;
  }
  const brush: Record<Team, HTMLCanvasElement> = { 1: makeBrush("#ff6a1a"), 2: makeBrush("#5b4dff") };
  const softWhite = makeBrush("#ffffff");

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch {
    bridge.onError("بۇ توركۆرگۈچ 3D مۇسابىقىنى قوزغىتالمىدى.");
    return () => {};
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x8fd4ff, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd4ff);
  scene.fog = new THREE.Fog(0xcfe9ff, 42, 110);
  const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 200);

  scene.add(new THREE.HemisphereLight(0xd7f1ff, 0xffd2ad, 1.25));
  const sun = new THREE.DirectionalLight(0xfff6e4, 1.45);
  sun.position.set(22, 34, 10);
  scene.add(sun);

  const fogCol = new THREE.Color(0xcfe9ff);
  const sunDir = new THREE.Vector3(0.42, 0.86, 0.28).normalize();
  const inkMat = new THREE.ShaderMaterial({
    uniforms: {
      inkMap: { value: inkTex },
      uMin: { value: new THREE.Vector2(MAP.minX, MAP.minZ) },
      uSize: { value: new THREE.Vector2(MAP.w, MAP.d) },
      sunDir: { value: sunDir },
      fogColor: { value: fogCol },
      fogNear: { value: 42 },
      fogFar: { value: 110 },
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vColor;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vColor = color;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D inkMap;
      uniform vec2 uMin;
      uniform vec2 uSize;
      uniform vec3 sunDir;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec3 vColor;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vec3 n = normalize(vNormalW);
        float wrap = clamp(dot(n, sunDir) * 0.5 + 0.58, 0.0, 1.0);
        vec3 base = vColor * (0.48 + 0.62 * wrap);
        vec2 uv = (vWorld.xz - uMin) / uSize;
        vec4 ink = texture2D(inkMap, clamp(uv, 0.0, 1.0));
        float upFace = smoothstep(0.4, 0.85, n.y);
        vec3 col = mix(base, ink.rgb, clamp(ink.a, 0.0, 1.0) * upFace);
        float fog = smoothstep(fogNear, fogFar, length(vWorld - cameraPosition));
        col = mix(col, fogColor, fog);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const geos: THREE.BufferGeometry[] = [];
  function colorize(geo: THREE.BufferGeometry, hex: number) {
    const c = new THREE.Color(hex);
    const n = geo.getAttribute("position").count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return geo;
  }
  function pushBox(cx: number, cy: number, cz: number, w: number, h: number, d: number, color: number, solid = true) {
    const g = new THREE.BoxGeometry(w, h, d);
    colorize(g, color);
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(cx, cy, cz));
    geos.push(g);
    if (solid) {
      solids.push({
        minX: cx - w / 2,
        maxX: cx + w / 2,
        minY: cy - h / 2,
        maxY: cy + h / 2,
        minZ: cz - d / 2,
        maxZ: cz + d / 2,
      });
    }
  }
  function pushStairs(x: number, zEdge: number, dir: number, width: number, totalH: number, run: number, steps: number, color: number) {
    const sd = run / steps;
    for (let i = 0; i < steps; i++) {
      const h = (totalH * (steps - i)) / steps;
      const zc = zEdge + dir * (sd * i + sd / 2);
      pushBox(x, h / 2, zc, width, h, Math.max(0.2, sd - 0.06), color, true);
    }
  }

  const ground = new THREE.PlaneGeometry(MAP.w, MAP.d);
  ground.rotateX(-Math.PI / 2);
  colorize(ground, 0xf0d2ae);
  ground.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0));
  geos.push(ground);

  pushBox(0, 2.1, -39.2, 64, 4.2, 1.3, 0xf6ecdf, true);
  pushBox(0, 2.1, 39.2, 64, 4.2, 1.3, 0xf6ecdf, true);
  pushBox(-31.2, 2.1, 0, 1.3, 4.2, 80, 0xf6ecdf, true);
  pushBox(31.2, 2.1, 0, 1.3, 4.2, 80, 0xf6ecdf, true);

  pushBox(-20, 1.15, -27, 14, 2.3, 14, 0xffd7b4, true);
  pushStairs(-20, -20, 1, 10, 2.3, 6.6, 4, 0xe7d3c0);
  pushBox(20.5, 2.1, -25.5, 13, 4.2, 15, 0xffe3c8, true);
  pushBox(20.5, 4.28, -25.5, 13.4, 0.28, 15.4, 0xff6a1a, true);

  pushBox(0, 1.25, 0, 10, 2.5, 12, 0xc9d7e8, true);
  pushBox(0, 2.72, 0, 10.4, 0.28, 12.3, 0xeef3f8, true);
  pushStairs(0, -6, -1, 10, 2.5, 6.4, 4, 0xd5deea);
  pushStairs(0, 6, 1, 10, 2.5, 6.4, 4, 0xd5deea);
  pushBox(-18, 0.31, 0, 8, 0.62, 10, 0xd7a15e, true);
  pushBox(18, 0.31, 0, 8, 0.62, 10, 0xd7a15e, true);

  pushBox(20, 0.7, 23, 14, 1.4, 14, 0xd9e6ff, true);
  pushStairs(20, 16, -1, 10, 1.4, 5.6, 3, 0xc9d8ee);
  pushBox(-20.5, 2, 25.5, 13, 4, 15, 0xd5e4ff, true);
  pushBox(-20.5, 4.1, 25.5, 13.4, 0.26, 15.4, 0x5b4dff, true);

  const crates: [number, number, number, number, number][] = [
    [0, -15, 1.5, 1.05, 1.5],
    [-8, -12, 1.7, 1.15, 1.2],
    [7, -13, 1.2, 0.85, 1.9],
    [3, -9, 1.6, 0.7, 1.1],
    [-2, 13, 1.6, 1.05, 1.6],
    [9, 11, 1.3, 1.2, 1.3],
    [-11, 15, 2.2, 0.9, 1.2],
    [-7, 9, 1.1, 0.75, 1.7],
    [16, -10, 1.5, 1.05, 1.4],
    [-16, 10, 1.3, 1.0, 2.1],
    [11, 18, 1.4, 0.8, 1.4],
    [-2, -18, 1.2, 0.9, 1.2],
  ];
  crates.forEach((c, i) => {
    const h = c[3];
    pushBox(c[0], h / 2, c[1], c[2], h, c[4], i % 2 === 0 ? 0xe0a15a : 0x7ec8e3, true);
  });

  pushBox(-9.2, 0.38, 0.4, 2.4, 0.36, 1.1, 0xf2f5f8, false);
  pushBox(9.4, 0.42, -0.6, 2.6, 0.4, 1.15, 0xfff1df, false);

  function pushPalm(x: number, z: number) {
    const h = 3.5;
    const trunk = new THREE.CylinderGeometry(0.1, 0.2, h, 6);
    colorize(trunk, 0x8d5a32);
    trunk.applyMatrix4(new THREE.Matrix4().makeTranslation(x, h / 2, z));
    geos.push(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.BoxGeometry(0.22, 0.06, 1.45);
      colorize(leaf, i % 2 === 0 ? 0x2fae55 : 0x46c86a);
      const ang = (i / 6) * Math.PI * 2;
      const m = new THREE.Matrix4().makeRotationX(1.05);
      m.premultiply(new THREE.Matrix4().makeRotationY(ang));
      m.setPosition(x + Math.sin(ang) * 0.45, h - 0.05, z + Math.cos(ang) * 0.45);
      leaf.applyMatrix4(m);
      geos.push(leaf);
    }
  }
  [
    [-28.4, -12],
    [-28.2, 8],
    [28.4, -14],
    [28.2, 6],
    [-12, -36.2],
    [8, -36.3],
    [-8, 36.2],
    [14, 36.1],
    [28.3, 22],
    [-28.4, 24],
  ].forEach(([x, z]) => pushPalm(x, z));

  pushBox(-4, 0.06, -33.2, 2.4, 0.1, 2.4, 0xff6a1a, false);
  pushBox(4, 0.06, 33.2, 2.4, 0.1, 2.4, 0x5b4dff, false);

  const merged = mergeGeometries(geos, false);
  if (merged) scene.add(new THREE.Mesh(merged, inkMat));
  else geos.forEach((g) => scene.add(new THREE.Mesh(g, inkMat)));

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 8.6),
    new THREE.MeshLambertMaterial({ color: 0x1498b8, transparent: true, opacity: 0.78 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.08;
  scene.add(water);

  const clouds: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfffaf4 }),
    );
    c.scale.set(3.2 + rand(), 0.7, 1.5 + rand());
    c.position.set(-20 + i * 10, 16 + rand() * 4, -8 + rand() * 16);
    scene.add(c);
    clouds.push(c);
  }

  function standHeight(x: number, z: number, feetY: number) {
    let h = 0;
    for (let i = 0; i < solids.length; i++) {
      const b = solids[i];
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      if (b.maxY <= feetY + 0.5) h = Math.max(h, b.maxY);
    }
    return h;
  }
  function surfaceTop(x: number, z: number) {
    return standHeight(x, z, 80);
  }
  function inWater(x: number, y: number, z: number) {
    if (y > 0.48) return false;
    if (Math.abs(z) > 4.45 || Math.abs(x) > 28.2) return false;
    return surfaceTop(x, z) < 0.4;
  }

  for (let iz = 0; iz < GH; iz++) {
    for (let ix = 0; ix < GW; ix++) {
      const x = MAP.minX + ((ix + 0.5) / GW) * MAP.w;
      const z = MAP.minZ + ((iz + 0.5) / GH) * MAP.d;
      const h = surfaceTop(x, z);
      const channel = Math.abs(z) <= 4.45 && Math.abs(x) <= 28.2 && h < 0.4;
      mask[iz * GW + ix] = channel ? 0 : 1;
    }
  }

  let paintDirty = false;
  function paint(x: number, z: number, radius: number, team: Team, fromPlayer = false) {
    const u = (x - MAP.minX) / MAP.w;
    const v = (z - MAP.minZ) / MAP.d;
    if (u < -0.05 || v < -0.05 || u > 1.05 || v > 1.05) return;
    const cx = u * TW;
    const cy = (1 - v) * TH;
    const rad = Math.max(2, radius * (TW / MAP.w));
    const img = brush[team];
    ictx.drawImage(img, cx - rad, cy - rad, rad * 2, rad * 2);
    paintDirty = true;
    const gx = Math.floor(u * GW);
    const gz = Math.floor(v * GH);
    const gr = Math.ceil(radius * (GW / MAP.w)) + 1;
    const r2 = radius * radius;
    for (let iz = gz - gr; iz <= gz + gr; iz++) {
      if (iz < 0 || iz >= GH) continue;
      for (let ix = gx - gr; ix <= gx + gr; ix++) {
        if (ix < 0 || ix >= GW) continue;
        const i = iz * GW + ix;
        if (!mask[i]) continue;
        const wx = MAP.minX + ((ix + 0.5) / GW) * MAP.w;
        const wz = MAP.minZ + ((iz + 0.5) / GH) * MAP.d;
        const dx = wx - x;
        const dz = wz - z;
        if (dx * dx + dz * dz <= r2) grid[i] = team;
      }
    }
    if (fromPlayer) {
      const p = actors[0];
      if (p) p.special = Math.min(100, p.special + radius * 0.11);
    }
  }
  function teamAt(x: number, z: number): number {
    const u = (x - MAP.minX) / MAP.w;
    const v = (z - MAP.minZ) / MAP.d;
    const ix = Math.floor(u * GW);
    const iz = Math.floor(v * GH);
    if (ix < 0 || iz < 0 || ix >= GW || iz >= GH) return 0;
    return grid[iz * GW + ix];
  }
  function recount() {
    let o = 0;
    let b = 0;
    let t = 0;
    for (let i = 0; i < grid.length; i++) {
      if (!mask[i]) continue;
      t++;
      if (grid[i] === 1) o++;
      else if (grid[i] === 2) b++;
    }
    orangePct = t ? o / t : 0;
    bluePct = t ? b / t : 0;
  }

  function clearInk() {
    ictx.clearRect(0, 0, TW, TH);
    grid.fill(0);
    paintDirty = true;
  }

  const skin = new THREE.MeshLambertMaterial({ color: 0xffc7a8 });
  const cloth = {
    1: new THREE.MeshLambertMaterial({ color: 0xff6a1a }),
    2: new THREE.MeshLambertMaterial({ color: 0x5b4dff }),
  } as const;
  const shorts = {
    1: new THREE.MeshLambertMaterial({ color: 0xc2410c }),
    2: new THREE.MeshLambertMaterial({ color: 0x3a2ec4 }),
  } as const;
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c2430 });
  const white = new THREE.MeshLambertMaterial({ color: 0xfff8f2 });
  const pupil = new THREE.MeshLambertMaterial({ color: 0x1a1020 });
  const geoTorso = new THREE.CapsuleGeometry(0.26, 0.28, 4, 8);
  const geoHead = new THREE.SphereGeometry(0.3, 14, 12);
  const geoEye = new THREE.SphereGeometry(0.075, 8, 8);
  const geoPupil = new THREE.SphereGeometry(0.038, 8, 8);
  const geoTent = new THREE.ConeGeometry(0.09, 0.62, 6);
  const geoLeg = new THREE.CapsuleGeometry(0.085, 0.26, 3, 6);
  const geoShoe = new THREE.SphereGeometry(0.11, 8, 6);
  const geoShort = new THREE.SphereGeometry(0.24, 10, 8);

  function makeWeapon(kind: WeaponId, team: Team) {
    const g = new THREE.Group();
    const accent = cloth[team];
    if (kind === "spritzer") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.42), dark);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 6), accent);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = 0.32;
      g.add(body, barrel);
    } else if (kind === "roller") {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.45), dark);
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.84, 10), accent);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, -0.12, 0.48);
      roll.name = "roll";
      g.add(handle, roll);
    } else if (kind === "charger") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.95), dark);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.2), accent);
      tip.position.z = 0.5;
      g.add(body, tip);
    } else {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.36, 8), dark);
      body.rotation.x = Math.PI / 2;
      const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 8), accent);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.z = 0.26;
      g.add(body, muzzle);
    }
    return g;
  }

  function writeName(kid: Kid, text: string, team: Team) {
    const g = kid.nameCanvas.getContext("2d")!;
    g.clearRect(0, 0, 256, 64);
    g.font = '34px "ALKATIP Basma", Fredoka, serif';
    g.direction = "rtl";
    g.textAlign = "center";
    g.fillStyle = team === 1 ? "#ff6a1a" : "#8d86ff";
    g.strokeStyle = "#102033";
    g.lineWidth = 6;
    g.strokeText(text, 128, 44);
    g.fillText(text, 128, 44);
    const map = (kid.nameSprite.material as THREE.SpriteMaterial).map;
    if (map) map.needsUpdate = true;
  }

  function makeKid(team: Team, name: string): Kid {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const torso = new THREE.Mesh(geoTorso, cloth[team]);
    torso.position.y = 0.92;
    const head = new THREE.Mesh(geoHead, skin);
    head.position.set(0, 1.48, 0);
    const eyeL = new THREE.Mesh(geoEye, white);
    const eyeR = new THREE.Mesh(geoEye, white);
    eyeL.position.set(-0.1, 1.52, 0.22);
    eyeR.position.set(0.1, 1.52, 0.22);
    const pL = new THREE.Mesh(geoPupil, pupil);
    const pR = new THREE.Mesh(geoPupil, pupil);
    pL.position.set(-0.1, 1.51, 0.28);
    pR.position.set(0.1, 1.51, 0.28);
    const tentL = new THREE.Mesh(geoTent, cloth[team]);
    const tentR = new THREE.Mesh(geoTent, cloth[team]);
    tentL.position.set(-0.16, 1.86, -0.02);
    tentR.position.set(0.16, 1.86, -0.02);
    tentL.rotation.z = 0.35;
    tentR.rotation.z = -0.35;
    const mid = new THREE.Mesh(geoTent, cloth[team]);
    mid.position.set(0, 1.92, -0.08);
    mid.scale.set(1.1, 1.15, 1);
    const shortM = new THREE.Mesh(geoShort, shorts[team]);
    shortM.position.y = 0.62;
    shortM.scale.set(1.05, 0.55, 1.05);
    const legs = new THREE.Group();
    const pivL = new THREE.Group();
    const pivR = new THREE.Group();
    pivL.position.set(-0.12, 0.52, 0);
    pivR.position.set(0.12, 0.52, 0);
    const legL = new THREE.Mesh(geoLeg, skin);
    const legR = new THREE.Mesh(geoLeg, skin);
    legL.position.set(0, -0.18, 0);
    legR.position.set(0, -0.18, 0);
    const shoeL = new THREE.Mesh(geoShoe, dark);
    const shoeR = new THREE.Mesh(geoShoe, dark);
    shoeL.position.set(0, -0.38, 0.05);
    shoeR.position.set(0, -0.38, 0.05);
    shoeL.scale.set(1.15, 0.55, 1.45);
    shoeR.scale.set(1.15, 0.55, 1.45);
    pivL.add(legL, shoeL);
    pivR.add(legR, shoeR);
    legs.add(pivL, pivR);
    const mount = new THREE.Group();
    mount.position.set(0.22, 0.98, 0.18);
    const weapons = {
      spritzer: makeWeapon("spritzer", team),
      roller: makeWeapon("roller", team),
      charger: makeWeapon("charger", team),
      blaster: makeWeapon("blaster", team),
    };
    (Object.keys(weapons) as WeaponId[]).forEach((k) => {
      weapons[k].visible = k === "spritzer";
      mount.add(weapons[k]);
    });
    body.add(torso, head, eyeL, eyeR, pL, pR, tentL, tentR, mid, shortM, legs, mount);
    const nameCanvas = document.createElement("canvas");
    nameCanvas.width = 256;
    nameCanvas.height = 64;
    const ntex = new THREE.CanvasTexture(nameCanvas);
    ntex.colorSpace = THREE.SRGBColorSpace;
    const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ntex, transparent: true, depthTest: true }));
    nameSprite.scale.set(1.8, 0.45, 1);
    nameSprite.position.y = 2.25;
    root.add(nameSprite);
    const kid: Kid = { root, body, legs, tentL, tentR, mount, weapons, nameSprite, nameCanvas };
    writeName(kid, name, team);
    scene.add(root);
    root.visible = false;
    return kid;
  }

  function setWeapon(kid: Kid, w: WeaponId) {
    (Object.keys(kid.weapons) as WeaponId[]).forEach((k) => {
      kid.weapons[k].visible = k === w;
    });
  }

  const BOTS: { name: string; team: Team; weapon: WeaponId }[] = [
    { name: "ئايگۈل", team: 1, weapon: "spritzer" },
    { name: "باتۇر", team: 1, weapon: "roller" },
    { name: "دىلشات", team: 1, weapon: "blaster" },
    { name: "نىگار", team: 2, weapon: "spritzer" },
    { name: "ئەركىن", team: 2, weapon: "charger" },
    { name: "مەرۋە", team: 2, weapon: "blaster" },
    { name: "ئالىم", team: 2, weapon: "roller" },
  ];

  const actors: Actor[] = [];
  function blankActor(name: string, team: Team, isPlayer: boolean, weapon: WeaponId): Actor {
    return {
      name,
      team,
      isPlayer,
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      yaw: team === 1 ? Math.PI : 0,
      pitch: 0.18,
      vx: 0,
      vz: 0,
      alive: false,
      splat: 0,
      ink: 100,
      special: 35,
      invuln: 0,
      respawn: 0,
      weapon,
      sub: "pop-bomb",
      specialId: "tempest",
      fireCd: 0,
      subCd: 0,
      charge: 0,
      think: 0,
      goalX: 0,
      goalZ: team === 1 ? 10 : -10,
      mode: "push",
      target: -1,
      phase: rand() * 6,
      swimming: false,
      grounded: true,
      splats: 0,
      deaths: 0,
      rush: 0,
      stuck: 0,
      mesh: makeKid(team, name),
    };
  }
  actors.push(blankActor("ۋارىس", 1, true, "spritzer"));
  BOTS.forEach((b) => actors.push(blankActor(b.name, b.team, false, b.weapon)));
  const hero = makeKid(1, "ۋارىس");
  hero.root.visible = false;

  // Name tags are drawn on canvas, which never triggers a web-font load on its own.
  // Load ALKATIP Basma explicitly, then redraw every tag with the real letterforms.
  document.fonts?.load('34px "ALKATIP Basma"', "ئۇيغۇر").then(() => {
    if (dead) return;
    actors.forEach((a) => writeName(a.mesh, a.name, a.team));
    writeName(hero, bridge.config.current.name.trim().slice(0, 16) || "ۋارىس", 1);
  }, () => {});

  const MAXP = 72;
  const shotGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const shotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const shotMesh = new THREE.InstancedMesh(shotGeo, shotMat, MAXP);
  shotMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
  shotMesh.frustumCulled = false;
  scene.add(shotMesh);
  const projs: Proj[] = [];
  for (let i = 0; i < MAXP; i++) {
    projs.push({
      alive: false,
      x: 0,
      y: -20,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      grav: 0,
      life: 0,
      team: 1,
      dmg: 0,
      splash: 0,
      splashR: 0,
      paintR: 0.8,
      hitR: 0.2,
      scale: 1,
      kind: "shot",
      stuck: false,
      owner: 0,
    });
  }

  const MAXD = 180;
  const decalGeo = new THREE.PlaneGeometry(1, 1);
  const decalMap = new THREE.CanvasTexture(softWhite);
  decalMap.colorSpace = THREE.SRGBColorSpace;
  const decalMat = new THREE.MeshBasicMaterial({
    map: decalMap,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const decals = new THREE.InstancedMesh(decalGeo, decalMat, MAXD);
  decals.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXD * 3), 3);
  decals.frustumCulled = false;
  decals.count = 0;
  scene.add(decals);
  let decalCursor = 0;
  const dummy = new THREE.Object3D();
  const upV = new THREE.Vector3(0, 1, 0);
  const zV = new THREE.Vector3(0, 0, 1);
  const tmpN = new THREE.Vector3();
  const colO = new THREE.Color(0xff6a1a);
  const colV = new THREE.Color(0x5b4dff);

  function addDecal(x: number, y: number, z: number, nx: number, ny: number, nz: number, radius: number, team: Team) {
    const i = decalCursor % MAXD;
    decalCursor++;
    dummy.position.set(x + nx * 0.04, y + ny * 0.04, z + nz * 0.04);
    tmpN.set(nx, ny, nz).normalize();
    dummy.quaternion.setFromUnitVectors(zV, tmpN);
    dummy.scale.setScalar(radius * 2);
    dummy.updateMatrix();
    decals.setMatrixAt(i, dummy.matrix);
    decals.setColorAt(i, team === 1 ? colO : colV);
    decals.count = Math.min(MAXD, decalCursor);
    decals.instanceMatrix.needsUpdate = true;
    if (decals.instanceColor) decals.instanceColor.needsUpdate = true;
  }

  const PMAX = 420;
  const pPos = new Float32Array(PMAX * 3);
  const pCol = new Float32Array(PMAX * 3);
  const pVel = new Float32Array(PMAX * 3);
  const pLife = new Float32Array(PMAX);
  pPos.fill(0);
  for (let i = 0; i < PMAX; i++) pPos[i * 3 + 1] = -40;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }),
  );
  points.frustumCulled = false;
  scene.add(points);
  let pCursor = 0;
  function burst(x: number, y: number, z: number, team: Team, n: number, speed = 4) {
    const c = team === 1 ? colO : colV;
    for (let i = 0; i < n; i++) {
      const id = pCursor % PMAX;
      pCursor++;
      pPos[id * 3] = x;
      pPos[id * 3 + 1] = y;
      pPos[id * 3 + 2] = z;
      pVel[id * 3] = (rand() - 0.5) * speed;
      pVel[id * 3 + 1] = rand() * speed;
      pVel[id * 3 + 2] = (rand() - 0.5) * speed;
      pLife[id] = 0.35 + rand() * 0.45;
      pCol[id * 3] = c.r;
      pCol[id * 3 + 1] = c.g;
      pCol[id * 3 + 2] = c.b;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  const zones: Zone[] = [];
  const beacons: Beacon[] = [];
  function makeCloud() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
      m.position.set((i - 2) * 0.7, rand(), (i % 2) * 0.4);
      g.add(m);
    }
    g.visible = false;
    scene.add(g);
    return g;
  }
  for (let i = 0; i < 3; i++) zones.push({ alive: false, x: 0, z: 0, team: 1, life: 0, acc: 0, r: 6.5, mesh: makeCloud() });
  const beaconGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8);
  const beaconMat = {
    1: new THREE.MeshLambertMaterial({ color: 0xff6a1a }),
    2: new THREE.MeshLambertMaterial({ color: 0x5b4dff }),
  };
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(beaconGeo, beaconMat[1]);
    mesh.visible = false;
    scene.add(mesh);
    beacons.push({ alive: false, x: 0, y: 0, z: 0, team: 1, life: 0, acc: 0, mesh });
  }

  const laser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1, 5),
    new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.85 }),
  );
  laser.visible = false;
  scene.add(laser);

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const aimDir = new THREE.Vector3();

  function castWorld(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number) {
    let bestT = maxDist;
    let nx = 0;
    let ny = 1;
    let nz = 0;
    let hit = false;
    for (let i = 0; i < solids.length; i++) {
      const b = solids[i];
      let tmin = 0;
      let tmax = bestT;
      let face = 0;
      const o = [ox, oy, oz];
      const d = [dx, dy, dz];
      const mn = [b.minX, b.minY, b.minZ];
      const mx = [b.maxX, b.maxY, b.maxZ];
      let ok = true;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-8) {
          if (o[a] < mn[a] || o[a] > mx[a]) {
            ok = false;
            break;
          }
        } else {
          let t1 = (mn[a] - o[a]) / d[a];
          let t2 = (mx[a] - o[a]) / d[a];
          let entering = -1;
          if (t1 > t2) {
            const s = t1;
            t1 = t2;
            t2 = s;
            entering = 1;
          } else entering = -1;
          if (t1 > tmin) {
            tmin = t1;
            face = a * 2 + (entering < 0 ? 0 : 1);
          }
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) {
            ok = false;
            break;
          }
        }
      }
      if (!ok || tmax < 0 || tmin > bestT || tmin < 0.04) continue;
      bestT = Math.max(tmin, 0);
      hit = true;
      nx = 0;
      ny = 0;
      nz = 0;
      const axis = Math.floor(face / 2);
      const sign = face % 2 === 0 ? -1 : 1;
      if (axis === 0) nx = sign;
      else if (axis === 1) ny = sign;
      else nz = sign;
    }
    const step = 0.45;
    for (let t = 0.2; t < bestT; t += step) {
      const x = ox + dx * t;
      const y = oy + dy * t;
      const z = oz + dz * t;
      const gh = surfaceTop(x, z);
      if (y <= gh + 0.02 && oy > surfaceTop(ox, oz) - 0.2) {
        bestT = t;
        hit = true;
        nx = 0;
        ny = 1;
        nz = 0;
        break;
      }
    }
    if (!hit) return null;
    return { dist: bestT, x: ox + dx * bestT, y: oy + dy * bestT, z: oz + dz * bestT, nx, ny, nz };
  }

  function resolveActor(a: Actor) {
    const r = 0.36;
    const head = a.y + 1.45;
    for (let i = 0; i < solids.length; i++) {
      const b = solids[i];
      if (head < b.minY + 0.02) continue;
      if (a.y > b.maxY - 0.02) continue;
      if (b.maxY <= a.y + 0.55) continue;
      const minX = b.minX - r;
      const maxX = b.maxX + r;
      const minZ = b.minZ - r;
      const maxZ = b.maxZ + r;
      if (a.x < minX || a.x > maxX || a.z < minZ || a.z > maxZ) continue;
      const oL = a.x - minX;
      const oR = maxX - a.x;
      const oB = a.z - minZ;
      const oF = maxZ - a.z;
      const m = Math.min(oL, oR, oB, oF);
      if (m === oL) a.x = minX - 0.001;
      else if (m === oR) a.x = maxX + 0.001;
      else if (m === oB) a.z = minZ - 0.001;
      else a.z = maxZ + 0.001;
    }
    a.x = clamp(a.x, -29.4, 29.4);
    a.z = clamp(a.z, -37.4, 37.4);
  }

  function blocked(x: number, z: number, y: number) {
    const r = 0.36;
    for (let i = 0; i < solids.length; i++) {
      const b = solids[i];
      if (y + 1.2 < b.minY || y > b.maxY - 0.3) continue;
      if (b.maxY <= y + 0.55) continue;
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    }
    return false;
  }

  function pushFeed(text: string) {
    feed.unshift({ id: feedId++, text });
    if (feed.length > 4) feed.pop();
  }
  function setBanner(text: string) {
    banner = text;
    bannerT = 1.4;
  }

  function splashAt(x: number, y: number, z: number, team: Team, paintR: number, dmg: number, splashR: number, owner: Actor | null) {
    paint(x, z, paintR, team, !!owner?.isPlayer);
    burst(x, y + 0.2, z, team, 16, 6);
    if (dmg <= 0) return;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      if (!a.alive || a.team === team || a.invuln > 0) continue;
      const dx = a.x - x;
      const dz = a.z - z;
      const dy = a.y + 0.8 - y;
      const d = Math.hypot(dx, dz, dy);
      if (d < splashR) hurt(a, dmg * (1 - d / splashR), owner, "splat");
    }
  }

  function hurt(target: Actor, amount: number, by: Actor | null, how: "splat" | "water") {
    if (!target.alive || (how === "splat" && target.invuln > 0)) return;
    if (how === "water") target.splat = 100;
    else target.splat = Math.min(100, target.splat + amount);
    if (target.splat < 100) return;
    target.alive = false;
    target.deaths += 1;
    target.respawn = target.isPlayer ? 2.7 : 2.2;
    target.swimming = false;
    target.mesh.root.visible = false;
    burst(target.x, target.y + 0.8, target.z, by?.team ?? (target.team === 1 ? 2 : 1), 28, 7);
    paint(target.x, target.z, 2.3, by?.team ?? (target.team === 1 ? 2 : 1), !!by?.isPlayer);
    shake = Math.min(1, shake + (target.isPlayer || by?.isPlayer ? 0.7 : 0.25));
    audio.thud();
    if (how === "water") {
      pushFeed(target.isPlayer ? "سىز سۇغا چۈشۈپ كەتتىڭىز" : `${target.name} سۇغا چۈشۈپ كەتتى`);
      if (target.isPlayer) setBanner("سۇغا چۈشتىڭىز!");
    } else if (by) {
      by.splats += 1;
      if (by.isPlayer) {
        by.special = Math.min(100, by.special + 28);
        setBanner("پاكىز زەربە!");
      }
      if (target.isPlayer) setBanner("چاچرىتىلدىڭىز!");
      const kn = by.isPlayer ? "سىز" : by.name;
      pushFeed(target.isPlayer ? `سىز ${kn} تەرىپىدىن چاچرىتىلدىڭىز` : `${target.name} ${kn} تەرىپىدىن چاچرىتىلدى`);
    } else {
      pushFeed(target.isPlayer ? "سىز چاچرىتىلدىڭىز" : `${target.name} چاچرىتىلدى`);
    }
  }

  function spawnProj(p: Omit<Proj, "alive" | "stuck">) {
    const slot = projs.find((s) => !s.alive) ?? projs[0];
    Object.assign(slot, p, { alive: true, stuck: false });
  }

  function fireDirection(actor: Actor, aimX: number, aimY: number, aimZ: number) {
    vA.set(aimX - actor.x, aimY - (actor.y + 1.15), aimZ - actor.z);
    if (vA.lengthSq() < 0.01) {
      const f = yawForward(actor.yaw);
      vA.set(f.x, 0.05, f.z);
    }
    return vA.normalize();
  }

  function shootSpritzer(actor: Actor, dir: THREE.Vector3, fromPlayer: boolean) {
    if (actor.ink < 1.1 || actor.fireCd > 0) return;
    actor.ink -= 1.15;
    actor.fireCd = fromPlayer ? 0.11 : 0.2;
    const f = yawForward(actor.yaw);
    spawnProj({
      x: actor.x + f.x * 0.55,
      y: actor.y + 1.15,
      z: actor.z + f.z * 0.55,
      vx: dir.x * 34,
      vy: dir.y * 34,
      vz: dir.z * 34,
      grav: 7,
      life: 0.78,
      team: actor.team,
      dmg: 12,
      splash: 0,
      splashR: 0,
      paintR: 0.92,
      hitR: 0.28,
      scale: 0.85,
      kind: "shot",
      owner: actors.indexOf(actor),
    });
    burst(actor.x + f.x * 0.7, actor.y + 1.15, actor.z + f.z * 0.7, actor.team, 3, 2);
    if (fromPlayer) {
      shake = Math.min(0.4, shake + 0.035);
      audio.shoot(620);
    }
  }

  function shootBlaster(actor: Actor, dir: THREE.Vector3, fromPlayer: boolean) {
    if (actor.ink < 14 || actor.fireCd > 0) return;
    actor.ink -= 14;
    actor.fireCd = fromPlayer ? 0.72 : 1.05;
    const f = yawForward(actor.yaw);
    spawnProj({
      x: actor.x + f.x * 0.6,
      y: actor.y + 1.25,
      z: actor.z + f.z * 0.6,
      vx: dir.x * 16,
      vy: dir.y * 16 + 6.5,
      vz: dir.z * 16,
      grav: 14,
      life: 0.95,
      team: actor.team,
      dmg: 22,
      splash: 30,
      splashR: 3.1,
      paintR: 3.15,
      hitR: 0.35,
      scale: 1.7,
      kind: "shot",
      owner: actors.indexOf(actor),
    });
    if (fromPlayer) audio.shoot(220);
  }

  function shootCharger(actor: Actor, dir: THREE.Vector3, charge: number, fromPlayer: boolean) {
    const cost = 8 + 16 * charge;
    if (actor.ink < cost) return;
    actor.ink -= cost;
    actor.fireCd = 0.35;
    const originY = actor.y + 1.25;
    const maxD = 12 + charge * 30;
    const hit = castWorld(actor.x, originY, actor.z, dir.x, dir.y, dir.z, maxD);
    const end = hit ? hit.dist : maxD;
    let victim: Actor | null = null;
    let victimT = end;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      if (!a.alive || a === actor || a.team === actor.team || a.invuln > 0) continue;
      const px = actor.x;
      const py = originY;
      const pz = actor.z;
      const qx = px + dir.x * end;
      const qy = py + dir.y * end;
      const qz = pz + dir.z * end;
      const abx = qx - px;
      const aby = qy - py;
      const abz = qz - pz;
      const apx = a.x - px;
      const apy = a.y + 0.85 - py;
      const apz = a.z - pz;
      const ab2 = abx * abx + aby * aby + abz * abz || 1;
      const t = clamp((apx * abx + apy * aby + apz * abz) / ab2, 0, 1);
      const cx = px + abx * t;
      const cy = py + aby * t;
      const cz = pz + abz * t;
      const d2 = (cx - a.x) ** 2 + (cy - (a.y + 0.85)) ** 2 + (cz - a.z) ** 2;
      if (d2 < 0.55 && t * end < victimT) {
        victim = a;
        victimT = t * end;
      }
    }
    const reach = victim ? victimT : end;
    const steps = Math.max(2, Math.floor(reach / 0.85));
    for (let s = 1; s <= steps; s++) {
      const t = (reach * s) / steps;
      paint(actor.x + dir.x * t, actor.z + dir.z * t, 0.42 + charge * 0.35, actor.team, fromPlayer);
    }
    if (hit && !victim) {
      paint(hit.x, hit.z, 0.8 + charge, actor.team, fromPlayer);
      if (hit.ny < 0.65) addDecal(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 0.7 + charge * 0.4, actor.team);
    }
    if (victim) hurt(victim, 16 + 86 * charge, actor, "splat");
    burst(actor.x + dir.x * 0.8, originY, actor.z + dir.z * 0.8, actor.team, 8, 3);
    if (fromPlayer) {
      audio.shoot(180 + charge * 520);
      shake = Math.min(1, shake + 0.12 + charge * 0.2);
    }
  }

  function rollerTick(actor: Actor, dt: number, fromPlayer: boolean) {
    const f = yawForward(actor.yaw);
    if (actor.grounded && actor.ink > 0) {
      const cost = 15 * dt;
      actor.ink = Math.max(0, actor.ink - cost);
      paint(actor.x + f.x * 0.7, actor.z + f.z * 0.7, 1.5, actor.team, fromPlayer);
      const moving = Math.hypot(actor.vx, actor.vz) > 2;
      if (moving) {
        for (let i = 0; i < actors.length; i++) {
          const o = actors[i];
          if (!o.alive || o.team === actor.team || o.invuln > 0) continue;
          const d = Math.hypot(o.x - actor.x, o.z - actor.z);
          if (d < 1.45 && o.y < actor.y + 1.2) hurt(o, 70 * dt, actor, "splat");
        }
      }
    }
  }

  function flickRoller(actor: Actor, dir: THREE.Vector3, fromPlayer: boolean) {
    if (actor.ink < 8) return;
    actor.ink -= 8;
    const f = yawForward(actor.yaw);
    const r = yawRight(actor.yaw);
    for (let i = -2; i <= 2; i++) {
      const spread = i * 0.16;
      const dx = dir.x * 0.75 + f.x * 0.25 + r.x * spread;
      const dz = dir.z * 0.75 + f.z * 0.25 + r.z * spread;
      const len = Math.hypot(dx, dz) || 1;
      spawnProj({
        x: actor.x + f.x * 0.8,
        y: actor.y + 0.7,
        z: actor.z + f.z * 0.8,
        vx: (dx / len) * 20,
        vy: 3.5,
        vz: (dz / len) * 20,
        grav: 12,
        life: 0.45,
        team: actor.team,
        dmg: 16,
        splash: 8,
        splashR: 1.4,
        paintR: 1.15,
        hitR: 0.3,
        scale: 1.15,
        kind: "flick",
        owner: actors.indexOf(actor),
      });
    }
    if (fromPlayer) audio.shoot(280);
  }

  function throwSub(actor: Actor, dir: THREE.Vector3, fromPlayer: boolean) {
    if (actor.subCd > 0 || actor.ink < 26) return;
    const bomb = actor.sub === "pop-bomb";
    actor.ink -= bomb ? 30 : 26;
    actor.subCd = 0.45;
    const f = yawForward(actor.yaw);
    spawnProj({
      x: actor.x + f.x * 0.5,
      y: actor.y + 1.3,
      z: actor.z + f.z * 0.5,
      vx: dir.x * (bomb ? 13 : 11),
      vy: 7.5 + dir.y * 4,
      vz: dir.z * (bomb ? 13 : 11),
      grav: 16,
      life: bomb ? 1.5 : 1.3,
      team: actor.team,
      dmg: bomb ? 18 : 6,
      splash: bomb ? 36 : 8,
      splashR: bomb ? 3.5 : 1.6,
      paintR: bomb ? 3.5 : 1.2,
      hitR: 0.3,
      scale: bomb ? 1.5 : 1.2,
      kind: bomb ? "bomb" : "beacon",
      owner: actors.indexOf(actor),
    });
    if (fromPlayer) audio.shoot(160);
  }

  function useSpecial(actor: Actor, dir: THREE.Vector3) {
    if (actor.special < 100 || !actor.alive) return;
    actor.special = 0;
    if (actor.specialId === "reef-rush") {
      actor.rush = 6;
      setBanner(actor.isPlayer ? "مەرجان يۈگۈرۈشى" : "");
      audio.chime();
      return;
    }
    const hit = castWorld(actor.x, actor.y + 1.3, actor.z, dir.x, dir.y, dir.z, 28);
    const x = hit ? hit.x : actor.x + dir.x * 12;
    const z = hit ? hit.z : actor.z + dir.z * 12;
    const zone = zones.find((z0) => !z0.alive) ?? zones[0];
    zone.alive = true;
    zone.x = x;
    zone.z = z;
    zone.team = actor.team;
    zone.life = 5.6;
    zone.acc = 0;
    zone.mesh.visible = true;
    zone.mesh.position.set(x, surfaceTop(x, z) + 4.2, z);
    zone.mesh.children.forEach((c) => {
      const mesh = c as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(actor.team === 1 ? colO : colV);
    });
    if (actor.isPlayer) {
      setBanner("سىياھ بورىنى");
      audio.chime();
    }
  }

  function placeBeacon(x: number, y: number, z: number, team: Team) {
    const b = beacons.find((k) => !k.alive) ?? beacons[0];
    b.alive = true;
    b.x = x;
    b.y = y;
    b.z = z;
    b.team = team;
    b.life = 4.2;
    b.acc = 0;
    b.mesh.visible = true;
    b.mesh.material = beaconMat[team];
    b.mesh.position.set(x, y + 0.2, z);
  }

  function impactProj(p: Proj, x: number, y: number, z: number, nx: number, ny: number, nz: number) {
    const owner = actors[p.owner] ?? null;
    if (p.kind === "bomb") {
      if (!p.stuck) {
        p.stuck = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = p.vy = p.vz = 0;
        p.life = 0.62;
        return;
      }
    }
    if (p.kind === "beacon") {
      placeBeacon(x, y, z, p.team);
      paint(x, z, p.paintR, p.team, !!owner?.isPlayer);
      p.alive = false;
      return;
    }
    if (p.splash > 0 || p.kind === "bomb") splashAt(x, y, z, p.team, p.paintR, p.kind === "bomb" ? p.splash : p.splash, p.splashR, owner);
    else {
      paint(x, z, p.paintR, p.team, !!owner?.isPlayer);
      if (ny < 0.62) addDecal(x, y, z, nx, ny, nz, p.paintR * 0.85, p.team);
      burst(x, y + 0.1, z, p.team, 6, 3);
    }
    if (p.kind === "bomb") audio.thud();
    p.alive = false;
  }

  function updateProj(p: Proj, dt: number) {
    if (!p.alive) return;
    if (p.stuck) {
      p.life -= dt;
      if (p.life <= 0) impactProj(p, p.x, p.y, p.z, 0, 1, 0);
      return;
    }
    const ox = p.x;
    const oy = p.y;
    const oz = p.z;
    p.vy -= p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.life -= dt;
    const dx = p.x - ox;
    const dy = p.y - oy;
    const dz = p.z - oz;
    const dist = Math.hypot(dx, dy, dz) || 0.0001;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      if (!a.alive || a.team === p.team || a.invuln > 0 || i === p.owner) continue;
      const cy = clamp(p.y, a.y + 0.15, a.y + 1.5);
      if ((a.x - p.x) ** 2 + (cy - p.y) ** 2 + (a.z - p.z) ** 2 < (0.42 + p.hitR) ** 2) {
        const owner = actors[p.owner] ?? null;
        if (p.dmg > 0) hurt(a, p.dmg, owner, "splat");
        paint(a.x, a.z, Math.max(0.7, p.paintR * 0.55), p.team, !!owner?.isPlayer);
        if (p.splash > 0 || p.kind === "bomb") splashAt(p.x, p.y, p.z, p.team, p.paintR, p.splash, p.splashR, owner);
        else burst(p.x, p.y, p.z, p.team, 8, 4);
        p.alive = false;
        return;
      }
    }
    const hit = castWorld(ox, oy, oz, dx / dist, dy / dist, dz / dist, dist);
    if (hit) {
      impactProj(p, hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz);
      return;
    }
    if (p.y < -2 || p.life <= 0) {
      if (p.kind === "shot" && p.splash > 0) splashAt(p.x, Math.max(0.2, p.y), p.z, p.team, p.paintR, p.splash, p.splashR, actors[p.owner] ?? null);
      else if (p.life <= 0 && p.kind === "bomb") impactProj(p, p.x, p.y, p.z, 0, 1, 0);
      else paint(p.x, p.z, p.paintR * 0.6, p.team, !!(actors[p.owner]?.isPlayer));
      p.alive = false;
    }
  }

  function playerAim(actor: Actor) {
    camera.getWorldDirection(vC);
    vB.copy(camera.position).addScaledVector(vC, 50);
    fireDirection(actor, vB.x, vB.y, vB.z);
    aimDir.copy(vA);
    return aimDir;
  }

  function handlePlayerFire(actor: Actor, dt: number, fireHeld: boolean) {
    if (!actor.alive || countdown > 0 || actor.swimming) {
      if (actor.swimming) actor.charge = 0;
      return;
    }
    const dir = playerAim(actor);
    if (actor.weapon === "roller") {
      if (fireHeld) rollerTick(actor, dt, true);
      if (fireRelease) flickRoller(actor, dir, true);
      return;
    }
    if (actor.weapon === "charger") {
      if (fireHeld && actor.ink > 2) {
        actor.charge = Math.min(1, actor.charge + dt / 0.85);
        actor.ink = Math.max(0, actor.ink - dt * 4);
      }
      if (fireRelease && actor.charge > 0.08) {
        shootCharger(actor, dir, actor.charge, true);
        actor.charge = 0;
      }
      if (!fireHeld) actor.charge = Math.max(0, actor.charge);
      return;
    }
    if (!fireHeld) return;
    if (actor.weapon === "spritzer") shootSpritzer(actor, dir, true);
    else shootBlaster(actor, dir, true);
  }

  function moveActor(a: Actor, mx: number, mz: number, dt: number) {
    const ox = a.x;
    const oz = a.z;
    a.vx = mx;
    a.vz = mz;
    const steps = 2;
    for (let s = 0; s < steps; s++) {
      a.x += (mx * dt) / steps;
      a.z += (mz * dt) / steps;
      resolveActor(a);
    }
    const prevY = a.y;
    if (!a.swimming) a.vy -= GRAV * dt;
    else a.vy = 0;
    let ny = a.y + a.vy * dt;
    const gh = standHeight(a.x, a.z, prevY);
    if (ny <= gh) {
      ny = gh;
      if (a.vy < 0) a.vy = 0;
      a.grounded = true;
    } else a.grounded = false;
    for (let i = 0; i < solids.length; i++) {
      const b = solids[i];
      if (a.x < b.minX || a.x > b.maxX || a.z < b.minZ || a.z > b.maxZ) continue;
      const head = ny + 1.45;
      if (a.vy > 0 && head > b.minY && prevY + 1.45 <= b.minY + 0.05) {
        a.vy = 0;
        ny = b.minY - 1.45;
      }
    }
    a.y = ny;
    a.vx = (a.x - ox) / dt;
    a.vz = (a.z - oz) / dt;
    if (inWater(a.x, a.y, a.z)) hurt(a, 100, null, "water");
  }

  function environmentInk(a: Actor, dt: number) {
    if (!a.alive) return;
    const floor = a.grounded ? teamAt(a.x, a.z) : 0;
    const rush = a.rush > 0;
    if (rush) {
      a.rush -= dt;
      a.ink = Math.min(100, a.ink + 30 * dt);
      paint(a.x, a.z, 1.15, a.team, a.isPlayer);
    }
    if (a.swimming) a.ink = Math.min(100, a.ink + 46 * dt);
    else a.ink = Math.min(100, a.ink + (rush ? 0 : 11) * dt);
    if (!rush && floor === (a.team === 1 ? 2 : 1) && a.grounded && a.invuln <= 0) {
      a.splat = Math.min(100, a.splat + 16 * dt);
      if (a.splat >= 100) hurt(a, 0, null, "splat");
    } else if (floor === a.team || !a.grounded) {
      a.splat = Math.max(0, a.splat - 22 * dt);
    }
    if (a.invuln > 0) a.invuln -= dt;
    if (a.fireCd > 0) a.fireCd -= dt;
    if (a.subCd > 0) a.subCd -= dt;
  }

  function updatePlayer(dt: number, input: InputState) {
    const a = actors[0];
    if (!a.alive) {
      a.respawn -= dt;
      if (a.respawn <= 0) respawn(a);
      return;
    }
    let f = 0;
    let r = 0;
    if (held("KeyW") || held("ArrowUp")) f += 1;
    if (held("KeyS") || held("ArrowDown")) f -= 1;
    if (held("KeyD") || held("ArrowRight")) r += 1;
    if (held("KeyA") || held("ArrowLeft")) r -= 1;
    f += input.ay;
    r += input.ax;
    const mag = Math.hypot(f, r);
    if (mag > 1) {
      f /= mag;
      r /= mag;
    }
    if (held("KeyQ")) a.yaw += 1.7 * dt;
    if (held("KeyE")) a.yaw -= 1.7 * dt;
    const fwd = yawForward(a.yaw);
    const right = yawRight(a.yaw);
    const floor = teamAt(a.x, a.z);
    const wantSwim = held("ShiftLeft") || held("ShiftRight") || input.swim;
    a.swimming = !!(wantSwim && a.grounded && floor === a.team && a.rush <= 0);
    let speed = 6.35;
    if (a.swimming) speed = 11.4;
    else if (a.rush > 0) speed = 10.2;
    else if (floor && floor !== a.team) speed = 2.65;
    if (a.weapon === "roller" && (fireMouse || input.fire) && a.grounded) speed *= 0.9;
    const mx = (fwd.x * f + right.x * r) * speed;
    const mz = (fwd.z * f + right.z * r) * speed;
    if (jumpEdge && a.grounded && !a.swimming) {
      a.vy = 8.5;
      a.grounded = false;
      a.swimming = false;
      audio.blip();
      if (a.weapon === "roller" && (fireMouse || input.fire)) flickRoller(a, playerAim(a), true);
    }
    moveActor(a, mx, mz, dt);
    environmentInk(a, dt);
    if (a.swimming) audio.swim(true);
    else audio.swim(false);
    const firing = fireMouse || input.fire;
    handlePlayerFire(a, dt, firing);
    if (bombEdge) throwSub(a, playerAim(a), true);
    if (specialEdge) useSpecial(a, playerAim(a));
  }

  function pickGoal(a: Actor) {
    let bestX = a.team === 1 ? 6 : -6;
    let bestZ = a.team === 1 ? 18 : -18;
    let best = -1;
    for (let n = 0; n < 8; n++) {
      const x = -24 + rand() * 48;
      const z = -32 + rand() * 64;
      if (Math.abs(z) < 5 && surfaceTop(x, z) < 0.4) continue;
      const owned = teamAt(x, z) === a.team ? 0 : 2;
      const forwardBias = a.team === 1 ? z : -z;
      const score = owned * 3 + forwardBias * 0.05 - Math.hypot(x - a.x, z - a.z) * 0.02;
      if (score > best) {
        best = score;
        bestX = x;
        bestZ = z;
      }
    }
    a.goalX = bestX;
    a.goalZ = bestZ;
  }

  function updateBot(a: Actor, dt: number) {
    if (!a.alive) {
      a.respawn -= dt;
      if (a.respawn <= 0) respawn(a);
      return;
    }
    if (countdown > 0) {
      environmentInk(a, dt);
      return;
    }
    a.think -= dt;
    a.phase += dt;
    let nearest: Actor | null = null;
    let nd = 999;
    for (let i = 0; i < actors.length; i++) {
      const o = actors[i];
      if (!o.alive || o.team === a.team) continue;
      const d = Math.hypot(o.x - a.x, o.z - a.z);
      if (d < nd) {
        nd = d;
        nearest = o;
      }
    }
    if (a.think <= 0) {
      a.think = 0.35 + rand() * 0.35;
      if (nearest && nd < (a.weapon === "charger" ? 26 : 16)) a.mode = "fight";
      else {
        a.mode = "push";
        pickGoal(a);
      }
    }
    const floor = teamAt(a.x, a.z);
    if (a.ink < 18 && floor === a.team && a.grounded) a.swimming = true;
    if (a.swimming && a.ink > 78) a.swimming = false;
    if (a.mode === "fight" && nearest) {
      a.goalX = nearest.x;
      a.goalZ = nearest.z;
    }
    let dx = a.goalX - a.x;
    let dz = a.goalZ - a.z;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist;
    dz /= dist;
    if (blocked(a.x + dx * 1.1, a.z + dz * 1.1, a.y)) {
      const sx = -dz;
      const sz = dx;
      const flip = Math.sin(a.phase * 2) > 0 ? 1 : -1;
      dx = sx * flip;
      dz = sz * flip;
      if (a.grounded && rand() > 0.4) {
        a.vy = 8.2;
        a.grounded = false;
      }
    }
    if (a.mode === "fight") {
      dx += Math.cos(a.phase * 3) * 0.8;
      dz += Math.sin(a.phase * 3) * 0.8;
      const m = Math.hypot(dx, dz) || 1;
      dx /= m;
      dz /= m;
    }
    const wantYaw = yawToward(a.mode === "fight" && nearest ? nearest.x - a.x : dx, a.mode === "fight" && nearest ? nearest.z - a.z : dz);
    let dyaw = Math.atan2(Math.sin(wantYaw - a.yaw), Math.cos(wantYaw - a.yaw));
    a.yaw += clamp(dyaw, -3.2 * dt, 3.2 * dt);
    let speed = a.swimming ? 10.2 : floor && floor !== a.team ? 2.8 : 5.7;
    if (a.weapon === "roller" && a.mode === "push") speed *= 0.92;
    const before = Math.hypot(a.vx, a.vz);
    moveActor(a, dx * speed, dz * speed, dt);
    if (before < 0.4 && dist > 2) a.stuck += dt;
    else a.stuck = 0;
    if (a.stuck > 0.8) {
      a.stuck = 0;
      pickGoal(a);
      if (a.grounded) {
        a.vy = 8.2;
        a.grounded = false;
      }
    }
    environmentInk(a, dt);
    if (a.rush > 0) {
      /* filled in environment */
    }
    const fwd = yawForward(a.yaw);
    if (a.weapon === "roller") {
      if (a.ink > 8) rollerTick(a, dt, false);
      if (a.mode === "fight" && nearest && nd < 7 && a.fireCd <= 0) {
        a.fireCd = 0.8;
        const aim = fireDirection(a, nearest.x, nearest.y + 1, nearest.z);
        flickRoller(a, aim, false);
      }
    } else if (a.mode === "fight" && nearest && a.fireCd <= 0 && a.ink > 8) {
      const aim = fireDirection(a, nearest.x + (rand() - 0.5) * 1.4, nearest.y + 1, nearest.z + (rand() - 0.5) * 1.4);
      if (a.weapon === "charger") {
        a.charge = Math.min(1, a.charge + dt * 0.8);
        if (a.charge > 0.65 && nd < 24) {
          shootCharger(a, aim, a.charge, false);
          a.charge = 0;
        }
      } else if (a.weapon === "blaster") shootBlaster(a, aim, false);
      else shootSpritzer(a, aim, false);
    } else if (a.mode === "push" && a.fireCd <= 0 && a.ink > 20) {
      const aim = fireDirection(a, a.x + fwd.x * 7, surfaceTop(a.x + fwd.x * 7, a.z + fwd.z * 7) + 0.2, a.z + fwd.z * 7);
      if (a.weapon === "spritzer") shootSpritzer(a, aim, false);
      else if (a.weapon === "blaster" && rand() > 0.5) shootBlaster(a, aim, false);
      else a.fireCd = 0.25;
    }
    if (a.special >= 100 && rand() > 0.92) {
      const aim = fireDirection(a, a.x + fwd.x * 10, a.y, a.z + fwd.z * 10);
      a.specialId = a.weapon === "roller" ? "reef-rush" : "tempest";
      useSpecial(a, aim);
    }
    if (a.subCd <= 0 && a.ink > 40 && nearest && nd < 9 && rand() > 0.97) {
      const aim = fireDirection(a, nearest.x, nearest.y, nearest.z);
      a.sub = "pop-bomb";
      throwSub(a, aim, false);
    }
  }

  function respawn(a: Actor) {
    const spots = a.team === 1 ? SPAWN_O : SPAWN_V;
    const s = a.isPlayer ? spots[1] : spots[Math.floor(rand() * spots.length)];
    a.x = s[0];
    a.z = s[1];
    a.y = surfaceTop(a.x, a.z);
    a.vy = 0;
    a.splat = 0;
    a.ink = 100;
    a.alive = true;
    a.invuln = a.isPlayer ? 2.1 : 1.15;
    a.swimming = false;
    a.yaw = a.team === 1 ? Math.PI : 0;
    a.charge = 0;
    a.mesh.root.visible = mode === "play";
  }

  function endMatch() {
    if (phase === "ended") return;
    recount();
    phase = "ended";
    paused = false;
    const winner = Math.abs(orangePct - bluePct) < 0.004 ? "tie" : orangePct > bluePct ? "orange" : "violet";
    const p = actors[0];
    result = { winner, orange: orangePct, blue: bluePct, splats: p.splats, deaths: p.deaths };
    setBanner(winner === "orange" ? "زېمىن بىزنىڭ!" : winner === "violet" ? "زېمىن قولدىن كەتتى" : "تەڭ-تەڭ");
    document.exitPointerLock?.();
    if (!resultSent) {
      resultSent = true;
      bridge.onResult(result);
    }
    publish(true);
  }

  function startMatch() {
    const cfg = bridge.config.current;
    clearInk();
    result = null;
    resultSent = false;
    feed.length = 0;
    countdown = 3;
    timeLeft = MATCH_LEN;
    phase = "countdown";
    paused = false;
    mode = "play";
    orangePct = 0;
    bluePct = 0;
    projs.forEach((p) => (p.alive = false));
    zones.forEach((z) => {
      z.alive = false;
      z.mesh.visible = false;
    });
    beacons.forEach((b) => {
      b.alive = false;
      b.mesh.visible = false;
    });
    decalCursor = 0;
    decals.count = 0;
    const p = actors[0];
    p.name = cfg.name.trim().slice(0, 16) || "ۋارىس";
    p.weapon = cfg.weapon;
    p.sub = cfg.sub;
    p.specialId = cfg.special;
    writeName(p.mesh, p.name, 1);
    setWeapon(p.mesh, p.weapon);
    actors.forEach((a, idx) => {
      a.splats = 0;
      a.deaths = 0;
      a.alive = true;
      a.ink = 100;
      a.special = idx === 0 ? 20 : 10;
      a.splat = 0;
      a.rush = 0;
      a.charge = 0;
      a.fireCd = 0;
      a.subCd = 0;
      a.swimming = false;
      a.vy = 0;
      const spots = a.team === 1 ? SPAWN_O : SPAWN_V;
      const s = a.isPlayer ? spots[1] : spots[idx % spots.length];
      a.x = s[0];
      a.z = s[1];
      a.y = surfaceTop(a.x, a.z);
      a.yaw = a.team === 1 ? Math.PI : 0;
      a.pitch = 0.16;
      a.invuln = 1.2;
      a.mesh.root.visible = true;
      if (!a.isPlayer) {
        const spec = BOTS[idx - 1];
        a.weapon = spec.weapon;
        setWeapon(a.mesh, a.weapon);
        writeName(a.mesh, a.name, a.team);
      }
    });
    for (const s of SPAWN_O) paint(s[0], s[1], 3.3, 1, false);
    for (const s of SPAWN_V) paint(s[0], s[1], 3.3, 2, false);
    recount();
    hero.root.visible = false;
    audio.unlock();
    audio.chime();
    setBanner("جەڭ باشلاندى!");
    publish(true);
  }

  function setPaused(p: boolean) {
    if (mode !== "play" || phase === "ended") return;
    paused = p;
    if (p) document.exitPointerLock?.();
    publish(true);
  }

  function goOrbit() {
    mode = "orbit";
    phase = "menu";
    paused = false;
    hero.root.visible = false;
    actors.forEach((a) => (a.mesh.root.visible = false));
    document.exitPointerLock?.();
  }
  function goShowcase() {
    mode = "showcase";
    const cfg = bridge.config.current;
    const hy = surfaceTop(0, -24);
    hero.root.visible = true;
    hero.root.position.set(0, hy, -24);
    setWeapon(hero, cfg.weapon);
    writeName(hero, cfg.name.trim().slice(0, 16) || "ۋارىس", 1);
    actors.forEach((a) => (a.mesh.root.visible = false));
  }

  const audio = createAudio();

  function publish(force = false) {
    const p = actors[0];
    const snap: HudSnap = {
      phase: mode === "play" ? (countdown > 0 && phase !== "ended" ? "countdown" : phase) : "menu",
      paused,
      time: Math.max(0, timeLeft),
      orange: orangePct,
      blue: bluePct,
      ink: p ? p.ink / 100 : 1,
      special: p ? p.special / 100 : 0,
      splat: p ? p.splat / 100 : 0,
      swimming: p?.swimming ?? false,
      charging: p?.charge ?? 0,
      weapon: p?.weapon ?? "spritzer",
      sub: p?.sub ?? "pop-bomb",
      specialId: p?.specialId ?? "tempest",
      respawn: p && !p.alive ? Math.max(0, p.respawn) : 0,
      countdown: phase === "ended" ? 0 : Math.max(0, countdown),
      locked,
      feed: feed.slice(0, 4),
      banner: bannerT > 0 ? banner : "",
      result,
      rush: p?.rush ?? 0,
    };
    if (force || mode === "play") bridge.onHud(snap);
  }

  function drawMini() {
    const g = mini.getContext("2d");
    if (!g) return;
    const w = mini.width;
    const h = mini.height;
    g.fillStyle = "#e6d3b4";
    g.fillRect(0, 0, w, h);
    g.drawImage(inkCanvas, 0, 0, w, h);
    g.fillStyle = "rgba(20,152,184,0.55)";
    const waterY = (1 - (0 - MAP.minZ) / MAP.d) * h;
    const waterH = (8.8 / MAP.d) * h;
    g.fillRect(0, waterY - waterH, w, waterH);
    const dot = (x: number, z: number, color: string, rad: number) => {
      const u = (x - MAP.minX) / MAP.w;
      const v = (z - MAP.minZ) / MAP.d;
      g.fillStyle = color;
      g.beginPath();
      g.arc(u * w, (1 - v) * h, rad, 0, Math.PI * 2);
      g.fill();
    };
    for (const a of actors) {
      if (!a.alive) continue;
      dot(a.x, a.z, a.team === 1 ? "#ff6a1a" : "#5b4dff", a.isPlayer ? 5 : 3.2);
    }
  }

  function syncVisuals(dt: number) {
    const t = performance.now() * 0.001;
    water.position.y = 0.07 + Math.sin(t * 1.6) * 0.02;
    clouds.forEach((c, i) => {
      c.position.x += dt * (0.35 + i * 0.05);
      if (c.position.x > 36) c.position.x = -36;
    });
    if (mode === "orbit") {
      orbitAng += dt * 0.08;
      const r = 34;
      camera.position.set(Math.sin(orbitAng) * r, 13.5, Math.cos(orbitAng) * r * 0.92);
      camera.lookAt(0, 1.4, 0);
      if (Math.random() < dt * 0.7) {
        const x = -18 + rand() * 36;
        const z = -28 + rand() * 56;
        if (!inWater(x, 0, z)) {
          paint(x, z, 1.1 + rand(), rand() > 0.5 ? 1 : 2, false);
          burst(x, 0.4, z, rand() > 0.5 ? 1 : 2, 8, 3);
        }
      }
    } else if (mode === "showcase") {
      const cfg = bridge.config.current;
      setWeapon(hero, cfg.weapon);
      const hy = surfaceTop(0, -24);
      hero.root.visible = true;
      hero.root.position.set(0, hy, -24);
      hero.root.rotation.y = t * 0.55 + Math.PI;
      hero.body.position.y = Math.sin(t * 2) * 0.03;
      camera.position.set(2.3, hy + 1.75, -24 + 4.8);
      camera.lookAt(0, hy + 1.2, -24);
    }
    if (mode !== "play") return;
    for (const a of actors) {
      const m = a.mesh;
      m.root.visible = a.alive;
      if (!a.alive) continue;
      m.root.position.set(a.x, a.y, a.z);
      m.root.rotation.y = a.yaw + Math.PI;
      const moving = Math.hypot(a.vx, a.vz) > 0.8 && a.grounded && !a.swimming;
      a.phase += dt * (moving ? 11 : 2.2);
      m.legs.children[0].rotation.x = Math.sin(a.phase) * (moving ? 0.75 : 0.06);
      m.legs.children[1].rotation.x = Math.sin(a.phase + Math.PI) * (moving ? 0.75 : 0.06);
      m.tentL.rotation.z = 0.35 + Math.sin(a.phase * 0.6) * 0.12;
      m.tentR.rotation.z = -0.35 - Math.sin(a.phase * 0.6) * 0.12;
      m.body.position.y = a.swimming ? -0.35 : Math.sin(a.phase) * (moving ? 0.04 : 0.01);
      m.body.scale.set(a.swimming ? 1.15 : 1, a.swimming ? 0.42 : 1, a.swimming ? 1.35 : 1);
      m.legs.visible = !a.swimming;
      m.mount.visible = !a.swimming;
      const blink = a.invuln > 0 && Math.sin(t * 24) > 0;
      m.root.visible = !blink;
      const roll = m.weapons.roller.getObjectByName("roll");
      if (roll && a.weapon === "roller") roll.rotation.x += Math.hypot(a.vx, a.vz) * dt * 2.2;
    }
    const player = actors[0];
    if (player.weapon === "charger" && player.charge > 0.02 && player.alive && mode === "play") {
      const dir = playerAim(player);
      const hit = castWorld(player.x, player.y + 1.25, player.z, dir.x, dir.y, dir.z, 8 + player.charge * 28);
      const dist = hit ? hit.dist : 8 + player.charge * 28;
      vA.set(player.x, player.y + 1.25, player.z);
      vB.copy(vA).addScaledVector(dir, dist);
      const mid = vA.add(vB).multiplyScalar(0.5);
      laser.position.copy(mid);
      tmpN.copy(dir);
      laser.quaternion.setFromUnitVectors(upV, tmpN);
      laser.scale.set(1, dist, 1);
      laser.visible = true;
    } else laser.visible = false;

    let shown = 0;
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      if (!p.alive) continue;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.18 * p.scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      shotMesh.setMatrixAt(shown, dummy.matrix);
      shotMesh.setColorAt(shown, p.team === 1 ? colO : colV);
      shown++;
    }
    shotMesh.count = shown;
    shotMesh.instanceMatrix.needsUpdate = true;
    if (shotMesh.instanceColor) shotMesh.instanceColor.needsUpdate = true;

    for (const z of zones) {
      if (!z.alive) continue;
      z.mesh.position.y = surfaceTop(z.x, z.z) + 3.6 + Math.sin(t * 2) * 0.2;
      z.mesh.rotation.y += dt * 0.4;
    }
  }

  function simulate(dt: number) {
    const input = bridge.config.current.input;
    if (mode === "play" && !paused && phase !== "ended") {
      if (countdown > 0) {
        countdown -= dt;
        if (countdown <= 0) {
          countdown = 0;
          phase = "live";
          bannerT = 0;
        }
      } else {
        timeLeft -= dt;
        if (timeLeft <= 0) {
          timeLeft = 0;
          endMatch();
        }
      }
      if (timeLeft > 0) {
        updatePlayer(dt, input);
        for (let i = 1; i < actors.length; i++) updateBot(actors[i], dt);
        for (const p of projs) updateProj(p, dt);
        for (const z of zones) {
          if (!z.alive) continue;
          z.life -= dt;
          z.acc -= dt;
          if (z.acc <= 0) {
            z.acc = 0.12;
            const ang = rand() * Math.PI * 2;
            const rad = rand() * z.r;
            paint(z.x + Math.cos(ang) * rad, z.z + Math.sin(ang) * rad, 1.35, z.team, false);
          }
          if (z.life <= 0) {
            z.alive = false;
            z.mesh.visible = false;
          }
        }
        for (const b of beacons) {
          if (!b.alive) continue;
          b.life -= dt;
          b.acc -= dt;
          if (b.acc <= 0) {
            b.acc = 0.18;
            const ang = rand() * Math.PI * 2;
            const rad = 0.4 + rand() * 2.4;
            paint(b.x + Math.cos(ang) * rad, b.z + Math.sin(ang) * rad, 0.9, b.team, false);
          }
          if (b.life <= 0) {
            b.alive = false;
            b.mesh.visible = false;
          }
        }
        scoreAcc += dt;
        if (scoreAcc > 0.35) {
          scoreAcc = 0;
          recount();
        }
      }
    }
    bannerT = Math.max(0, bannerT - dt);
    for (let i = 0; i < PMAX; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt;
      pVel[i * 3 + 1] -= 8 * dt;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -40;
    }
    pGeo.attributes.position.needsUpdate = true;
    if (paintDirty) {
      inkTex.needsUpdate = true;
      paintDirty = false;
    }
  }

  function updateCamera(dt: number) {
    if (mode !== "play") return;
    const a = actors[0];
    const dist = a.swimming ? 3.5 : 4.7;
    const cp = Math.cos(a.pitch);
    const sp = Math.sin(a.pitch);
    const f = yawForward(a.yaw);
    const r = yawRight(a.yaw);
    const headY = a.y + (a.swimming ? 0.7 : 1.35);
    let cx = a.x - f.x * dist * cp + r.x * 0.62;
    let cy = headY + dist * sp * 0.75 + 0.25;
    let cz = a.z - f.z * dist * cp + r.z * 0.62;
    const hit = castWorld(a.x, headY, a.z, cx - a.x, cy - headY, cz - a.z, Math.hypot(cx - a.x, cy - headY, cz - a.z));
    if (hit && hit.dist < Math.hypot(cx - a.x, cy - headY, cz - a.z)) {
      const sc = Math.max(0.25, (hit.dist - 0.25) / Math.hypot(cx - a.x, cy - headY, cz - a.z));
      cx = a.x + (cx - a.x) * sc;
      cy = headY + (cy - headY) * sc;
      cz = a.z + (cz - a.z) * sc;
    }
    shake = Math.max(0, shake * Math.exp(-3.5 * dt));
    camera.position.set(cx + (rand() - 0.5) * shake * 0.28, cy + (rand() - 0.5) * shake * 0.2, cz);
    camera.lookAt(a.x + f.x * 1.4, headY - 0.15 + sp * 1.3, a.z + f.z * 1.4);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const q = bridge.config.current?.quality ?? "high";
    const cap = q === "high" ? 1.5 : 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function consumeLook() {
    const cfg = bridge.config.current;
    const input = cfg.input;
    lookDX += input.lookX;
    lookDY += input.lookY;
    input.lookX = 0;
    input.lookY = 0;
    if (mode !== "play" || paused || phase === "ended") {
      lookDX = 0;
      lookDY = 0;
      return;
    }
    const sens = 0.00215 * (cfg.sens || 1);
    const p = actors[0];
    p.yaw -= lookDX * sens;
    const ySign = cfg.invertY ? 1 : -1;
    p.pitch += lookDY * sens * ySign;
    p.pitch = clamp(p.pitch, -0.75, 0.95);
    lookDX = 0;
    lookDY = 0;
  }

  let queueBomb = false;
  let bombLatch = false;
  let specialLatch = false;

  function pollEdges() {
    const input = bridge.config.current.input;
    const jump = held("Space") || input.jump;
    const fire = fireMouse || input.fire;
    const bomb = held("KeyC") || input.bomb;
    const special = held("KeyF") || input.special;
    jumpEdge = jump && !prevJump;
    fireRelease = !fire && prevFire;
    bombEdge = queueBomb || (bomb && !bombLatch);
    specialEdge = special && !specialLatch;
    queueBomb = false;
    prevJump = jump;
    prevFire = fire;
    bombLatch = bomb;
    specialLatch = special;
  }

  let last = performance.now();
  let acc = 0;
  let lastQuality = "";
  function frame(now: number) {
    if (dead) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const cfg = bridge.config.current;
    if (cfg.quality !== lastQuality) {
      lastQuality = cfg.quality;
      resize();
    }
    if (audio.current() !== cfg.volume) audio.setVolume(cfg.volume);
    if (!paused) consumeLook();
    else {
      lookDX = 0;
      lookDY = 0;
      cfg.input.lookX = 0;
      cfg.input.lookY = 0;
    }
    pollEdges();
    acc += dt;
    let steps = 0;
    let first = true;
    while (acc >= STEP && steps < 5) {
      if (!first) {
        jumpEdge = false;
        bombEdge = false;
        specialEdge = false;
        fireRelease = false;
      }
      simulate(STEP);
      first = false;
      acc -= STEP;
      steps++;
    }
    updateCamera(dt);
    syncVisuals(dt);
    miniAcc += dt;
    if (miniAcc > 0.18 && mode === "play") {
      miniAcc = 0;
      drawMini();
    }
    hudAcc += dt;
    if (hudAcc > 0.1) {
      hudAcc = 0;
      publish(false);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  const typing = () => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (typing()) return;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === "Escape") {
      if (e.repeat) return;
      if (mode === "play" && phase !== "ended" && !paused) setPaused(true);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onBlur = () => {
    keys.clear();
    fireMouse = false;
    dragLook = false;
  };
  const onVis = () => {
    if (document.hidden) keys.clear();
    audio.resume();
  };
  const onMouseDown = (e: MouseEvent) => {
    audio.unlock();
    if (e.button === 2 && mode === "play" && !paused && phase !== "ended") queueBomb = true;
    if (e.button !== 0) return;
    if (e.target !== canvas) return;
    if (mode !== "play" || paused || phase === "ended") return;
    dragLook = true;
    fireMouse = true;
    lastPX = e.clientX;
    lastPY = e.clientY;
    const lock = canvas.requestPointerLock?.();
    if (lock && typeof (lock as Promise<void>).catch === "function") (lock as Promise<void>).catch(() => {});
  };
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      fireMouse = false;
      dragLook = false;
    }
  };
  const onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement === canvas) {
      lookDX += e.movementX;
      lookDY += e.movementY;
      return;
    }
    if (!dragLook) return;
    lookDX += e.clientX - lastPX;
    lookDY += e.clientY - lastPY;
    lastPX = e.clientX;
    lastPY = e.clientY;
  };
  const onLock = () => {
    locked = document.pointerLockElement === canvas;
    publish(true);
  };
  const onContext = (e: Event) => {
    if (mode === "play") e.preventDefault();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  document.addEventListener("pointerlockchange", onLock);
  canvas.addEventListener("contextmenu", onContext);
  window.addEventListener("resize", resize);

  const player = actors[0];
  window.__controlsTest = {
    kind: "fps-strafe",
    getYaw: () => player.yaw,
    getSpeed: () => Math.hypot(player.vx, player.vz),
    getPos: () => ({ x: player.x, y: player.y, z: player.z }),
    setKeys: (codes: string[]) => {
      scripted.clear();
      codes.forEach((c) => scripted.add(c));
    },
    setSteer: () => {},
  };
  const api: EngineApi = {
    startMatch,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    orbit: goOrbit,
    showcase: goShowcase,
  };
  window.__inkwave = { startMatch, getPhase: () => phase };
  bridge.onApi(api);

  // Basis self-check: yaw 0 faces −Z, yaw π faces +Z, D is +right.
  const f0 = yawForward(0);
  const r0 = yawRight(0);
  if (Math.abs(f0.z + 1) > 1e-4 || Math.abs(r0.x - 1) > 1e-4) {
    bridge.onError("باشقۇرۇش سىستېمىسىنى قوزغىتىش مەغلۇپ بولدى.");
  }

  resize();
  seedMenuInk();
  bridge.onReady();
  raf = requestAnimationFrame(frame);

  function seedMenuInk() {
    for (let i = 0; i < 22; i++) {
      const x = -22 + rand() * 44;
      const z = -30 + rand() * 60;
      if (inWater(x, 0, z)) continue;
      paint(x, z, 1.2 + rand() * 1.6, rand() > 0.5 ? 1 : 2, false);
    }
  }

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("pointerlockchange", onLock);
    canvas.removeEventListener("contextmenu", onContext);
    window.removeEventListener("resize", resize);
    if (window.__controlsTest) delete window.__controlsTest;
    inkTex.dispose();
    renderer.dispose();
    audio.close();
  };
}

function createAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let music: GainNode | null = null;
  let vol = 0.7;
  let swimGain: GainNode | null = null;
  let swimOn = false;
  let timer = 0;
  const notes = [262, 330, 392, 494, 392, 330, 294, 370];
  let step = 0;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    sfx = ctx.createGain();
    music = ctx.createGain();
    master.gain.value = vol * vol;
    music.gain.value = 0.22;
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    swimGain = ctx.createGain();
    swimGain.gain.value = 0;
    src.connect(filter);
    filter.connect(swimGain);
    swimGain.connect(sfx);
    src.start();
    const loop = () => {
      if (!ctx || !music) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = notes[step % notes.length];
      step++;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      o.connect(g);
      g.connect(music);
      o.start();
      o.stop(ctx.currentTime + 0.3);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
      timer = window.setTimeout(loop, 320);
    };
    timer = window.setTimeout(loop, 400);
  }

  return {
    current: () => vol,
    unlock() {
      ensure();
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    resume() {
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    setVolume(v: number) {
      vol = v;
      if (ctx && master) master.gain.setTargetAtTime(v * v, ctx.currentTime, 0.03);
    },
    shoot(freq: number) {
      if (!ctx || !sfx || ctx.state !== "running") return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.45), ctx.currentTime + 0.09);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      o.connect(g);
      g.connect(sfx);
      o.start();
      o.stop(ctx.currentTime + 0.11);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    },
    thud() {
      if (!ctx || !sfx || ctx.state !== "running") return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(140, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0.16, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      o.connect(g);
      g.connect(sfx);
      o.start();
      o.stop(ctx.currentTime + 0.22);
    },
    blip() {
      if (!ctx || !sfx || ctx.state !== "running") return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 540;
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      o.connect(g);
      g.connect(sfx);
      o.start();
      o.stop(ctx.currentTime + 0.09);
    },
    chime() {
      if (!ctx || !sfx || ctx.state !== "running") return;
      [523, 659, 784].forEach((f, i) => {
        const o = ctx!.createOscillator();
        const g = ctx!.createGain();
        o.type = "triangle";
        o.frequency.value = f;
        const t0 = ctx!.currentTime + i * 0.06;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.connect(g);
        g.connect(sfx!);
        o.start(t0);
        o.stop(t0 + 0.22);
      });
    },
    swim(on: boolean) {
      if (!ctx || !swimGain) return;
      if (swimOn === on) return;
      swimOn = on;
      swimGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.05);
    },
    close() {
      window.clearTimeout(timer);
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
