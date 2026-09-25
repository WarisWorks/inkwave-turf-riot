import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LEVEL_DEFS, MAP, waterRects, type LevelDef, type Rect } from "./levels";
import { SPECIALS, characterById } from "./types";
import type { BoardRow, CharacterId, CharacterMods, Difficulty, HudSnap, InputState, LevelId, LiveConfig, SpecialId, SubId, WeaponId } from "./types";

const GW = 120;
const GH = 152;
const TW = 480;
const TH = 608;
// Match length in seconds; VITE_MATCH_LEN shortens it for local testing.
const MATCH_LEN = Number(import.meta.env.VITE_MATCH_LEN) || 180;
const GRAV = 22;
const STEP = 1 / 60;


type Team = 1 | 2;

/**
 * The player's painting gun. It hits harder, paints wider and fires faster than the bots' copies
 * of the same weapons; bots keep the base numbers (scaled by difficulty).
 */
const POWER = {
  spritzer: { cd: 0.085, ink: 0.9, speed: 40, life: 0.85, dmg: 17, paintR: 1.35, scale: 1.25, trail: 0.55 },
  blaster: { cd: 0.55, speed: 19, dmg: 34, splash: 45, splashR: 3.8, paintR: 4 },
  charger: { fullCharge: 0.6, reach: [14, 34], line: [0.6, 0.5], dmg: [30, 90], cost: [6, 12] },
  roller: { inkPerSec: 11, paintR: 2, reach: 1.8, dps: 110, flicks: 3, flickDmg: 24, flickPaint: 1.5, flickSpeed: 23 },
} as const;

/** Bot tuning. Only the Violet side scales with difficulty; teammates always play "normal". */
type Tune = { speed: number; cd: number; spread: number; range: number; think: number; dmg: number; meter: number };
const TUNE: Record<Difficulty, Tune> = {
  easy: { speed: 0.86, cd: 1.5, spread: 2.4, range: 0.75, think: 1.6, dmg: 0.7, meter: 0.45 },
  normal: { speed: 1, cd: 1, spread: 1, range: 1, think: 1, dmg: 1, meter: 0.7 },
  hard: { speed: 1.08, cd: 0.78, spread: 0.55, range: 1.2, think: 0.7, dmg: 1.15, meter: 0.9 },
};
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
  char: CharacterId;
  torso: THREE.Object3D;
  /** Neck pivot: tilts the head, eyes and headwear together. */
  headPivot: THREE.Group;
  eyes: THREE.Group[];
  armGun: THREE.Group;
  armSup: THREE.Group;
  /** Sleek swim form, shown instead of the body while swimming. */
  squid: THREE.Group;
  fins: THREE.Object3D[];
  /** 0 = humanoid, 1 = squid; eased so the swap reads as a morph. */
  swim: number;
  blink: number;
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
  /** Grid cells this actor flipped to its own color this match. */
  painted: number;
  rush: number;
  stuck: number;
  /** Smoothed movement velocity, for acceleration and deceleration. */
  mvx: number;
  mvz: number;
  /** Swimming up a wall covered in own ink. */
  climbing: boolean;
  /** Seconds left in a special's charge-up (0 = not charging), and the aim captured at activation. */
  spT: number;
  spX: number;
  spY: number;
  spZ: number;
  /** 1 right after firing, eases back to 0 (recoil pose). */
  recoil: number;
  /** Distance walked since the last footprint, and which foot is next. */
  stepAcc: number;
  stepSide: number;
  char: CharacterId;
  mods: CharacterMods;
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
  /** Paint radius dropped along the flight path (0 = none). */
  trail: number;
  trailAcc: number;
};

type Zone = { alive: boolean; x: number; z: number; team: Team; owner: number; life: number; acc: number; r: number; mesh: THREE.Group };
type Beacon = { alive: boolean; x: number; y: number; z: number; team: Team; owner: number; life: number; acc: number; mesh: THREE.Mesh };

export type EngineApi = {
  startMatch: () => void;
  pause: () => void;
  resume: () => void;
  orbit: () => void;
  showcase: () => void;
  setLevel: (id: LevelId) => void;
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
  let hitMark = 0;
  let killMark = 0;
  /** Seconds since the final whistle, for the victory / defeat animation and camera. */
  let endT = 0;
  /** End shot: the open direction the camera settles in, and where it started from. */
  let endAng = 0;
  let endFromAng = 0;
  let endFromDist = 4.6;
  let endFromY = 1.8;
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

  // Etles (ئەتلەس) ikat banners: vertical color bands and diamond motifs whose rows are
  // nudged sideways, like the feathered edges of resist-dyed Uyghur silk.
  function makeEtles(seed: number) {
    const r = mulberry32(seed);
    const W = 128;
    const H = 256;
    const ROW = 2;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    const palettes = [
      ["#c8102e", "#ffc81e", "#10813f", "#1c3597", "#161616", "#f5efe0"],
      ["#d8337f", "#ffd23f", "#16957a", "#2447b0", "#1a1a1a", "#fff4e0"],
      ["#b3122e", "#f7b500", "#6b2fa0", "#0d7894", "#121212", "#f2ead8"],
    ];
    const pal = palettes[seed % palettes.length];
    const pick = (not?: string) => {
      let col = pal[Math.floor(r() * pal.length)];
      while (col === not) col = pal[Math.floor(r() * pal.length)];
      return col;
    };
    const bands: { x: number; w: number; col: string; motif: string; period: number; shift: number }[] = [];
    for (let x = 0; x < W; ) {
      const w = Math.min(W - x, 14 + Math.floor(r() * 26));
      const col = pick(bands[bands.length - 1]?.col);
      bands.push({ x, w, col, motif: pick(col), period: r() > 0.5 ? 64 : 32, shift: Math.floor(r() * 32) });
      x += w;
    }
    const jit = () => (r() - 0.5) * 3.2;
    for (let y = 0; y < H; y += ROW) {
      for (const b of bands) {
        g.fillStyle = b.col;
        g.fillRect(b.x + (b.x ? jit() : 0), y, W - b.x + 4, ROW);
      }
      for (const b of bands) {
        if (b.w < 16) continue;
        const t = ((y + b.shift) % b.period) / b.period;
        const hw = b.w * 0.42 * (1 - Math.abs(t * 2 - 1));
        const cx = b.x + b.w / 2 + jit();
        g.fillStyle = b.motif;
        g.fillRect(cx - hw, y, hw * 2, ROW);
        if (hw > 4) {
          g.fillStyle = b.col;
          g.fillRect(cx - hw * 0.4, y, hw * 0.8, ROW);
        }
      }
    }
    // Zig-zag hem along the bottom.
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    for (let x = 0; x <= W; x += 16) {
      g.moveTo(x, H);
      g.lineTo(x + 8, H - 14);
      g.lineTo(x + 16, H);
    }
    g.fill();
    g.globalCompositeOperation = "source-over";
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const etles = [0, 1, 2].map((i) => new THREE.MeshLambertMaterial({ map: makeEtles(i), transparent: true, alphaTest: 0.5 }));
  const bannerGeo = new THREE.PlaneGeometry(1.8, 3.6);
  const rodGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6);
  rodGeo.rotateZ(Math.PI / 2);
  const rodMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const decoMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const levelGroup = new THREE.Group();
  scene.add(levelGroup);
  const waterMeshes: THREE.Mesh[] = [];
  let levelTrash: { dispose(): void }[] = [];
  let level: LevelDef = LEVEL_DEFS[bridge.config.current.level] ?? LEVEL_DEFS.harbor;
  let levelWater: Rect[] = waterRects(level);

  function hangBanner(x: number, z: number, rotY: number, i: number) {
    const g = new THREE.Group();
    const cloth = new THREE.Mesh(bannerGeo, etles[i % etles.length]);
    cloth.position.y = 2.3;
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(0, 4.12, 0.03);
    g.add(cloth, rod);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    levelGroup.add(g);
  }

  /** Rebuilds solids, meshes, water, sky and the paintable mask for a level. */
  function buildLevel(def: LevelDef) {
    for (const d of levelTrash) d.dispose();
    levelTrash = [];
    levelGroup.clear();
    waterMeshes.length = 0;
    solids.length = 0;
    level = def;
    levelWater = waterRects(def);

    const geos: THREE.BufferGeometry[] = [];
    const deco: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, color: number, m: THREE.Matrix4, isDeco: boolean) => {
      colorize(g, color);
      g.applyMatrix4(m);
      (isDeco ? deco : geos).push(g);
    };
    const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
    function pushBox(cx: number, cy: number, cz: number, w: number, h: number, d: number, color: number, solid = true, isDeco = false) {
      add(new THREE.BoxGeometry(w, h, d), color, at(cx, cy, cz), isDeco);
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
    function pushPalm(x: number, z: number) {
      const h = 3.5;
      add(new THREE.CylinderGeometry(0.1, 0.2, h, 6), 0x8d5a32, at(x, h / 2, z), true);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const m = new THREE.Matrix4().makeRotationX(1.05);
        m.premultiply(new THREE.Matrix4().makeRotationY(ang));
        m.setPosition(x + Math.sin(ang) * 0.45, h - 0.05, z + Math.cos(ang) * 0.45);
        add(new THREE.BoxGeometry(0.22, 0.06, 1.45), i % 2 === 0 ? 0x2fae55 : 0x46c86a, m, true);
      }
    }
    // Tall Xinjiang poplar (تېرەك): a slim trunk under a narrow column of leaves.
    function pushPoplar(x: number, z: number) {
      add(new THREE.CylinderGeometry(0.1, 0.16, 1.6, 6), 0x7a5a3a, at(x, 0.8, z), true);
      add(new THREE.ConeGeometry(0.75, 6.2, 7), 0x4f9a3f, at(x, 4.4, z), true);
      add(new THREE.ConeGeometry(0.55, 4, 7), 0x6fb84f, at(x, 5.8, z), true);
    }

    const ground = new THREE.PlaneGeometry(MAP.w, MAP.d);
    ground.rotateX(-Math.PI / 2);
    add(ground, def.ground, at(0, 0, 0), false);
    pushBox(0, 2.1, -39.2, 64, 4.2, 1.3, def.wall, true);
    pushBox(0, 2.1, 39.2, 64, 4.2, 1.3, def.wall, true);
    pushBox(-31.2, 2.1, 0, 1.3, 4.2, 80, def.wall, true);
    pushBox(31.2, 2.1, 0, 1.3, 4.2, 80, def.wall, true);
    if (def.wallCap !== undefined) {
      pushBox(0, 4.35, -39.2, 64.2, 0.3, 1.5, def.wallCap, false, true);
      pushBox(0, 4.35, 39.2, 64.2, 0.3, 1.5, def.wallCap, false, true);
      pushBox(-31.2, 4.35, 0, 1.5, 0.3, 80.2, def.wallCap, false, true);
      pushBox(31.2, 4.35, 0, 1.5, 0.3, 80.2, def.wallCap, false, true);
    }
    for (const p of def.prims) {
      if (p.t === "box") pushBox(p.x, p.y, p.z, p.w, p.h, p.d, p.c, !p.deco, !!p.deco);
      else if (p.t === "stairs") pushStairs(p.x, p.z, p.dir, p.w, p.h, p.run, p.steps, p.c);
      else if (p.t === "palm") pushPalm(p.x, p.z);
      else if (p.t === "poplar") pushPoplar(p.x, p.z);
      else if (p.t === "dome") add(new THREE.SphereGeometry(p.r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), p.c, at(p.x, p.y, p.z), true);
      else if (p.t === "peak") {
        add(new THREE.ConeGeometry(p.r, p.h, 6), p.c, at(p.x, p.h / 2 - 1, p.z), true);
        add(new THREE.ConeGeometry(p.r * 0.55, p.h * 0.7, 5), 0x9c2f1c, at(p.x + p.r * 0.5, p.h * 0.35 - 1, p.z - p.r * 0.3), true);
      }
    }
    pushBox(-4, 0.06, -33.2, 2.4, 0.1, 2.4, 0xff6a1a, false);
    pushBox(4, 0.06, 33.2, 2.4, 0.1, 2.4, 0x5b4dff, false);

    for (const [list, mat] of [
      [geos, inkMat],
      [deco, decoMat],
    ] as [THREE.BufferGeometry[], THREE.Material][]) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      levelGroup.add(new THREE.Mesh(merged, mat));
      levelTrash.push(merged);
    }

    const waterMat = new THREE.MeshLambertMaterial({ color: def.water, transparent: true, opacity: 0.78 });
    levelTrash.push(waterMat);
    for (const r of levelWater) {
      const g = new THREE.PlaneGeometry(r.maxX - r.minX, r.maxZ - r.minZ);
      levelTrash.push(g);
      const m = new THREE.Mesh(g, waterMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((r.minX + r.maxX) / 2, 0.08, (r.minZ + r.maxZ) / 2);
      levelGroup.add(m);
      waterMeshes.push(m);
    }

    [-30, -19, 16, 31].forEach((z, i) => {
      hangBanner(-30.45, z, Math.PI / 2, i);
      hangBanner(30.45, z, -Math.PI / 2, i + 1);
    });
    hangBanner(-18, -38.45, 0, 2);
    hangBanner(16, -38.45, 0, 0);
    hangBanner(-16, 38.45, Math.PI, 1);
    hangBanner(20, 38.45, Math.PI, 2);

    renderer.setClearColor(def.sky, 1);
    (scene.background as THREE.Color).set(def.sky);
    (scene.fog as THREE.Fog).color.set(def.fog);
    fogCol.set(def.fog);

    for (let iz = 0; iz < GH; iz++) {
      for (let ix = 0; ix < GW; ix++) {
        const x = MAP.minX + ((ix + 0.5) / GW) * MAP.w;
        const z = MAP.minZ + ((iz + 0.5) / GH) * MAP.d;
        mask[iz * GW + ix] = waterAt(x, z) ? 0 : 1;
      }
    }
    clearInk();
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
  /** Open water (not covered by a dock or bridge) within `margin` of a water rect. */
  function waterAt(x: number, z: number, margin = 0) {
    for (const r of levelWater) {
      if (x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin) return surfaceTop(x, z) < 0.4;
    }
    return false;
  }
  /** Near a water rect at all, bridges included. */
  function nearWater(x: number, z: number, margin: number) {
    return levelWater.some((r) => x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin);
  }
  function inWater(x: number, y: number, z: number) {
    return y <= 0.48 && waterAt(x, z);
  }

  let paintDirty = false;
  buildLevel(level);
  function tuneFor(a: Actor): Tune {
    return a.team === 2 ? TUNE[bridge.config.current.difficulty] ?? TUNE.normal : TUNE.normal;
  }

  /** `by` earns turf points for newly flipped cells; `meter` also charges its special. */
  function paint(x: number, z: number, radius: number, team: Team, by: Actor | null = null, meter = true) {
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
    let flipped = 0;
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
        if (dx * dx + dz * dz <= r2) {
          if (grid[i] !== team) flipped++;
          grid[i] = team;
        }
      }
    }
    if (by && by.team === team) {
      by.painted += flipped;
      if (meter) by.special = Math.min(100, by.special + radius * 0.11 * by.mods.meter * (by.isPlayer ? 1 : tuneFor(by).meter));
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
  // Athletic proportions: a slimmer torso, longer legs, arms, and big expressive eyes.
  const geoTorso = new THREE.CapsuleGeometry(0.22, 0.34, 4, 10);
  const geoHead = new THREE.SphereGeometry(0.3, 16, 12);
  const geoEye = new THREE.SphereGeometry(0.095, 10, 8);
  const geoPupil = new THREE.SphereGeometry(0.052, 8, 6);
  const geoGlint = new THREE.SphereGeometry(0.02, 6, 6);
  const geoTent = new THREE.ConeGeometry(0.09, 0.62, 6);
  const geoSideTent = new THREE.ConeGeometry(0.068, 0.46, 6).rotateX(Math.PI);
  const geoLeg = new THREE.CapsuleGeometry(0.075, 0.32, 3, 6);
  const geoShoe = new THREE.SphereGeometry(0.11, 8, 6);
  const geoShort = new THREE.SphereGeometry(0.23, 10, 8);
  const geoArm = new THREE.CapsuleGeometry(0.056, 0.26, 3, 6);
  const geoHand = new THREE.SphereGeometry(0.068, 8, 6);
  const geoSleeve = new THREE.SphereGeometry(0.088, 8, 6);
  const geoSquidBody = new THREE.SphereGeometry(0.34, 14, 10);
  const geoSquidMantle = new THREE.ConeGeometry(0.3, 0.5, 5);
  const geoSquidFin = new THREE.ConeGeometry(0.06, 0.44, 5);
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Glossy team-coloured ink tanks make the guns read as loaded and dangerous.
  const inkGloss = {
    1: new THREE.MeshPhongMaterial({ color: 0xff6a1a, emissive: 0x552000, shininess: 90, specular: 0xffffff }),
    2: new THREE.MeshPhongMaterial({ color: 0x5b4dff, emissive: 0x1d1760, shininess: 90, specular: 0xffffff }),
  } as const;

  function makeWeapon(kind: WeaponId, team: Team) {
    const g = new THREE.Group();
    const accent = cloth[team];
    const tankMat = inkGloss[team];
    const along = (m: THREE.Mesh, z: number, y = 0) => {
      m.rotation.x = Math.PI / 2;
      m.position.set(0, y, z);
      return m;
    };
    if (kind === "spritzer") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.5), dark);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), dark);
      grip.position.set(0, -0.17, -0.06);
      const tank = along(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 12), tankMat), -0.02, 0.19);
      const barrel = along(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.5, 8), accent), 0.42);
      const nozzle = along(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.09, 10), dark), 0.68);
      g.add(body, grip, tank, barrel, nozzle);
    } else if (kind === "roller") {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), dark);
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.02, 12), accent);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, -0.12, 0.52);
      roll.name = "roll";
      const tank = along(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10), tankMat), -0.1, 0.1);
      g.add(handle, roll, tank);
    } else if (kind === "charger") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.05), dark);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.22), accent);
      tip.position.z = 0.6;
      const scope = along(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 8), dark), 0.05, 0.12);
      const tank = along(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10), tankMat), -0.3, -0.1);
      g.add(body, tip, scope, tank);
    } else {
      const body = along(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.44, 10), dark), 0);
      const muzzle = along(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 10), accent), 0.32);
      const tank = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), tankMat);
      tank.position.set(0, 0.2, -0.08);
      g.add(body, muzzle, tank);
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

  // ── Characters ────────────────────────────────────────────────
  // Everyone shares the team-coloured body; headwear and props set each character apart.
  const SKIN: Record<CharacterId, number> = {
    wave: 0xffc7a8,
    doppa: 0xf1b791,
    braids: 0xffd2b5,
    telpek: 0xe7a97f,
    scarf: 0xffcdb0,
    dutar: 0xd99c75,
  };
  const skinMats = new Map<number, THREE.Material>();
  const skinFor = (c: CharacterId) => {
    const hex = SKIN[c];
    if (!skinMats.has(hex)) skinMats.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
    return skinMats.get(hex)!;
  };

  // A doppa's four panels each carry a white almond (badam) motif on dark velvet.
  function makeDoppaTex(base: string, motif: string) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = motif;
    g.strokeStyle = motif;
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const cx = i * 64 + 32;
      g.beginPath();
      g.ellipse(cx, 36, 11, 17, 0.5, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(cx + 9, 17, 7, Math.PI * 0.9, Math.PI * 2.1);
      g.stroke();
      g.fillStyle = base;
      g.beginPath();
      g.ellipse(cx - 1, 38, 4, 7, 0.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = motif;
    }
    g.fillRect(0, 58, 256, 3);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x24160f });
  const doppaMen = new THREE.MeshLambertMaterial({ map: makeDoppaTex("#15181d", "#f4efe4") });
  const doppaGirl = new THREE.MeshLambertMaterial({ map: makeDoppaTex("#8e1230", "#f2c230") });
  const furMat = new THREE.MeshLambertMaterial({ color: 0x3b2618 });
  const furRim = new THREE.MeshLambertMaterial({ color: 0x6b4a32 });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0xa0612c });
  const woodDark = new THREE.MeshLambertMaterial({ color: 0x5a3418 });
  const scarfMat = new THREE.MeshLambertMaterial({ map: etles[1].map, side: THREE.DoubleSide });
  const geoHair = new THREE.SphereGeometry(0.315, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const geoDoppa = new THREE.CylinderGeometry(0.3, 0.36, 0.2, 4).rotateY(Math.PI / 4);
  const geoDoppaSmall = new THREE.CylinderGeometry(0.24, 0.3, 0.16, 4).rotateY(Math.PI / 4);
  const geoBraid = new THREE.CylinderGeometry(0.036, 0.026, 0.62, 5);
  // Telpek: a round sheepskin hat. A position-based wobble keeps seam vertices together
  // while making the surface lumpy like curly fleece.
  const fleece = (g: THREE.BufferGeometry, amp: number) => {
    const pos = g.getAttribute("position");
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = Math.sin(v.x * 41) * Math.sin(v.y * 37) * Math.sin(v.z * 43);
      v.multiplyScalar(1 + n * amp);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  };
  const geoTelpek = fleece(new THREE.SphereGeometry(0.4, 18, 12).scale(1, 0.95, 1), 0.07);
  const geoTelpekRim = fleece(new THREE.TorusGeometry(0.31, 0.085, 8, 22).rotateX(Math.PI / 2), 0.12);
  const geoScarf = new THREE.SphereGeometry(0.345, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const geoKnot = new THREE.SphereGeometry(0.075, 8, 6);
  const geoTail = new THREE.ConeGeometry(0.075, 0.36, 5).rotateX(Math.PI);
  const geoDutarBody = new THREE.SphereGeometry(0.15, 12, 8);
  const geoDutarNeck = new THREE.CylinderGeometry(0.022, 0.028, 1, 5);
  const HEAD_Y = 1.48;

  /**
   * syncVisuals swings tentL/tentR around z by ±0.35 (tuned for the wave kid's tentacles).
   * Other characters hang their swaying parts inside an inner group that cancels that base tilt.
   */
  function swayPivot(x: number, y: number, z: number, side: 1 | -1, parts: THREE.Object3D[]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.rotation.z = 0.35 * side;
    const inner = new THREE.Group();
    inner.rotation.z = -0.35 * side;
    inner.add(...parts);
    pivot.add(inner);
    return pivot;
  }
  const hair = () => {
    const m = new THREE.Mesh(geoHair, hairMat);
    m.position.y = HEAD_Y;
    m.rotation.x = -0.78;
    return m;
  };

  function headwear(char: CharacterId, team: Team): { parts: THREE.Object3D[]; tentL: THREE.Object3D; tentR: THREE.Object3D } {
    if (char === "wave") {
      const tentL = new THREE.Mesh(geoTent, inkGloss[team]);
      const tentR = new THREE.Mesh(geoTent, inkGloss[team]);
      tentL.position.set(-0.16, 1.86, -0.02);
      tentR.position.set(0.16, 1.86, -0.02);
      tentL.rotation.z = 0.35;
      tentR.rotation.z = -0.35;
      const mid = new THREE.Mesh(geoTent, inkGloss[team]);
      mid.position.set(0, 1.92, -0.08);
      mid.scale.set(1.1, 1.15, 1);
      return { parts: [tentL, tentR, mid], tentL, tentR };
    }
    if (char === "braids") {
      const cap = new THREE.Mesh(geoDoppaSmall, doppaGirl);
      cap.position.y = HEAD_Y + 0.31;
      // Braids tied off with a bead of team ink.
      const braid = (x: number) => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(geoBraid, hairMat);
        b.position.set(x, -0.31, 0);
        const tie = new THREE.Mesh(geoKnot, inkGloss[team]);
        tie.position.set(x, -0.63, 0);
        tie.scale.setScalar(0.7);
        g.add(b, tie);
        return g;
      };
      const tentL = swayPivot(-0.09, 1.6, -0.24, 1, [braid(-0.1), braid(-0.03), braid(0.04)]);
      const tentR = swayPivot(0.09, 1.6, -0.24, -1, [braid(-0.04), braid(0.03), braid(0.1)]);
      tentL.rotation.x = tentR.rotation.x = 0.18;
      return { parts: [hair(), cap, tentL, tentR], tentL, tentR };
    }
    if (char === "telpek") {
      const hat = new THREE.Mesh(geoTelpek, furMat);
      hat.position.y = HEAD_Y + 0.33;
      const rim = new THREE.Mesh(geoTelpekRim, furRim);
      rim.position.y = HEAD_Y + 0.2;
      const { tentL, tentR } = sideTentacles(team);
      return { parts: [hair(), hat, rim, tentL, tentR], tentL, tentR };
    }
    if (char === "scarf") {
      const scarf = new THREE.Mesh(geoScarf, scarfMat);
      scarf.position.y = HEAD_Y;
      scarf.rotation.x = -0.82;
      const knot = new THREE.Mesh(geoKnot, scarfMat);
      knot.position.set(0, 1.3, -0.27);
      const tail = () => {
        const t = new THREE.Mesh(geoTail, scarfMat);
        t.position.y = -0.18;
        return t;
      };
      const tentL = swayPivot(-0.05, 1.3, -0.29, 1, [tail()]);
      const tentR = swayPivot(0.05, 1.3, -0.29, -1, [tail()]);
      const side = sideTentacles(team);
      return { parts: [scarf, knot, tentL, tentR, side.tentL, side.tentR], tentL, tentR };
    }
    // doppa and dutar both wear the men's black-and-white doppa.
    const cap = new THREE.Mesh(geoDoppa, doppaMen);
    cap.position.y = HEAD_Y + 0.29;
    const { tentL, tentR } = sideTentacles(team);
    const parts: THREE.Object3D[] = [hair(), cap, tentL, tentR];
    if (char === "dutar") {
      // A long-necked two-string dutar slung across the back.
      const dutar = new THREE.Group();
      const bowl = new THREE.Mesh(geoDutarBody, woodMat);
      bowl.scale.set(1, 1.3, 0.55);
      const neck = new THREE.Mesh(geoDutarNeck, woodDark);
      neck.position.y = 0.62;
      const peg = new THREE.Mesh(geoKnot, woodDark);
      peg.position.y = 1.12;
      peg.scale.setScalar(0.7);
      dutar.add(bowl, neck, peg);
      dutar.position.set(0.08, 0.86, -0.3);
      dutar.rotation.set(0.12, 0, 0.5);
      parts.push(dutar);
    }
    return { parts, tentL, tentR };
  }

  /** Two glossy ink tentacles hanging by the ears: every character is part squid. */
  function sideTentacles(team: Team) {
    const tent = () => {
      const t = new THREE.Mesh(geoSideTent, inkGloss[team]);
      t.position.y = -0.2;
      return t;
    };
    const tentL = swayPivot(-0.25, 1.47, -0.06, 1, [tent()]);
    const tentR = swayPivot(0.25, 1.47, -0.06, -1, [tent()]);
    return { tentL, tentR };
  }

  function makeKid(team: Team, name: string, char: CharacterId = "wave"): Kid {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const skinMat = skinFor(char);
    const torso = new THREE.Mesh(geoTorso, cloth[team]);
    torso.position.y = 0.98;
    const head = new THREE.Mesh(geoHead, skinMat);
    head.position.set(0, HEAD_Y, 0);
    const makeEye = (side: 1 | -1) => {
      const g = new THREE.Group();
      g.position.set(0.105 * side, 1.5, 0.2);
      g.rotation.y = 0.2 * side;
      const white_ = new THREE.Mesh(geoEye, white);
      const pupil_ = new THREE.Mesh(geoPupil, pupil);
      pupil_.position.set(0, -0.006, 0.062);
      const glint = new THREE.Mesh(geoGlint, glintMat);
      glint.position.set(0.022, 0.03, 0.106);
      g.add(white_, pupil_, glint);
      return g;
    };
    const eyes = [makeEye(-1), makeEye(1)];
    const { parts, tentL, tentR } = headwear(char, team);
    const headPivot = new THREE.Group();
    headPivot.position.y = 1.25;
    const headInner = new THREE.Group();
    headInner.position.y = -1.25;
    headInner.add(head, ...eyes, ...parts);
    headPivot.add(headInner);
    const shortM = new THREE.Mesh(geoShort, shorts[team]);
    shortM.position.y = 0.68;
    shortM.scale.set(1.02, 0.5, 1);
    const legs = new THREE.Group();
    const pivL = new THREE.Group();
    const pivR = new THREE.Group();
    pivL.position.set(-0.11, 0.62, 0);
    pivR.position.set(0.11, 0.62, 0);
    const legL = new THREE.Mesh(geoLeg, skinMat);
    const legR = new THREE.Mesh(geoLeg, skinMat);
    legL.position.set(0, -0.22, 0);
    legR.position.set(0, -0.22, 0);
    const shoeL = new THREE.Mesh(geoShoe, dark);
    const shoeR = new THREE.Mesh(geoShoe, dark);
    shoeL.position.set(0, -0.48, 0.05);
    shoeR.position.set(0, -0.48, 0.05);
    shoeL.scale.set(1.1, 0.55, 1.5);
    shoeR.scale.set(1.1, 0.55, 1.5);
    pivL.add(legL, shoeL);
    pivR.add(legR, shoeR);
    legs.add(pivL, pivR);
    // Arms: the gun arm points forward, the support arm reaches across to steady it.
    const makeArm = (x: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.2, 0.02);
      const sleeve = new THREE.Mesh(geoSleeve, cloth[team]);
      const arm = new THREE.Mesh(geoArm, skinMat);
      arm.position.y = -0.19;
      const hand = new THREE.Mesh(geoHand, skinMat);
      hand.position.y = -0.38;
      pivot.add(sleeve, arm, hand);
      return pivot;
    };
    const armGun = makeArm(0.27);
    armGun.rotation.set(-1.35, 0, 0.05);
    const armSup = makeArm(-0.27);
    armSup.rotation.set(-1.15, 0, 0.95);
    const mount = new THREE.Group();
    mount.position.set(0.24, 1.08, 0.3);
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
    body.add(torso, headPivot, shortM, legs, armGun, armSup, mount);

    // Squid form: a glossy teardrop with a pointed mantle, two eyes and trailing fins.
    const squid = new THREE.Group();
    const sBody = new THREE.Mesh(geoSquidBody, inkGloss[team]);
    sBody.scale.set(0.85, 0.42, 1.2);
    sBody.position.set(0, 0.16, -0.05);
    const mantle = new THREE.Mesh(geoSquidMantle, inkGloss[team]);
    mantle.rotation.x = Math.PI / 2;
    mantle.scale.set(1, 1, 0.45);
    mantle.position.set(0, 0.18, 0.38);
    const sEye = (side: 1 | -1) => {
      const e = new THREE.Group();
      e.position.set(0.13 * side, 0.29, 0.16);
      e.scale.setScalar(0.72);
      const w = new THREE.Mesh(geoEye, white);
      const pu = new THREE.Mesh(geoPupil, pupil);
      pu.position.set(0, 0, 0.062);
      e.add(w, pu);
      return e;
    };
    const fins = [-0.16, -0.055, 0.055, 0.16].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.14, -0.45);
      const fin = new THREE.Mesh(geoSquidFin, inkGloss[team]);
      fin.rotation.x = -Math.PI / 2;
      fin.position.z = -0.2;
      pivot.add(fin);
      return pivot;
    });
    squid.add(sBody, mantle, sEye(-1), sEye(1), ...fins);
    squid.visible = false;
    root.add(squid);

    const nameCanvas = document.createElement("canvas");
    nameCanvas.width = 256;
    nameCanvas.height = 64;
    const ntex = new THREE.CanvasTexture(nameCanvas);
    ntex.colorSpace = THREE.SRGBColorSpace;
    const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ntex, transparent: true, depthTest: true }));
    nameSprite.scale.set(1.8, 0.45, 1);
    nameSprite.position.y = char === "telpek" ? 2.5 : 2.3;
    root.add(nameSprite);
    const kid: Kid = {
      root,
      body,
      legs,
      tentL,
      tentR,
      mount,
      weapons,
      nameSprite,
      nameCanvas,
      char,
      torso,
      headPivot,
      eyes,
      armGun,
      armSup,
      squid,
      fins,
      swim: 0,
      blink: 1 + rand() * 3,
    };
    writeName(kid, name, team);
    scene.add(root);
    root.visible = false;
    return kid;
  }

  /** Frees what a kid owns outright: its weapon meshes and name tag. Shared parts stay. */
  function disposeKid(kid: Kid) {
    scene.remove(kid.root);
    kid.mount.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    const mat = kid.nameSprite.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.dispose();
  }

  function setWeapon(kid: Kid, w: WeaponId) {
    (Object.keys(kid.weapons) as WeaponId[]).forEach((k) => {
      kid.weapons[k].visible = k === w;
    });
  }

  const BOTS: { name: string; team: Team; weapon: WeaponId; char: CharacterId }[] = [
    { name: "ئايگۈل", team: 1, weapon: "spritzer", char: "scarf" },
    { name: "باتۇر", team: 1, weapon: "roller", char: "telpek" },
    { name: "دىلشات", team: 1, weapon: "blaster", char: "dutar" },
    { name: "نىگار", team: 2, weapon: "spritzer", char: "braids" },
    { name: "ئەركىن", team: 2, weapon: "charger", char: "doppa" },
    { name: "مەرۋە", team: 2, weapon: "blaster", char: "scarf" },
    { name: "ئالىم", team: 2, weapon: "roller", char: "wave" },
  ];

  const actors: Actor[] = [];
  function blankActor(name: string, team: Team, isPlayer: boolean, weapon: WeaponId, char: CharacterId): Actor {
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
      painted: 0,
      rush: 0,
      stuck: 0,
      mvx: 0,
      mvz: 0,
      climbing: false,
      spT: 0,
      spX: 0,
      spY: 0,
      spZ: 1,
      recoil: 0,
      stepAcc: 0,
      stepSide: 1,
      char,
      mods: characterById(char).mods,
      mesh: makeKid(team, name, char),
    };
  }
  const startChar = bridge.config.current.character;
  actors.push(blankActor("ۋارىس", 1, true, "spritzer", startChar));
  BOTS.forEach((b) => actors.push(blankActor(b.name, b.team, false, b.weapon, b.char)));
  let hero = makeKid(1, "ۋارىس", startChar);
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
      trail: 0,
      trailAcc: 0,
    });
  }

  const MAXD = 420;
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

  // Splats pop in with a little overshoot; young ones are re-scaled each frame in syncVisuals.
  const decalPos = new Float32Array(MAXD * 3);
  const decalQuat = new Float32Array(MAXD * 4);
  const decalR = new Float32Array(MAXD);
  const decalAge = new Float32Array(MAXD).fill(9);
  const POP = 0.22;
  function placeDecal(i: number, scale: number) {
    dummy.position.set(decalPos[i * 3], decalPos[i * 3 + 1], decalPos[i * 3 + 2]);
    dummy.quaternion.set(decalQuat[i * 4], decalQuat[i * 4 + 1], decalQuat[i * 4 + 2], decalQuat[i * 4 + 3]);
    dummy.scale.setScalar(Math.max(0.001, scale));
    dummy.updateMatrix();
    decals.setMatrixAt(i, dummy.matrix);
  }
  function addDecal(x: number, y: number, z: number, nx: number, ny: number, nz: number, radius: number, team: Team) {
    const i = decalCursor % MAXD;
    decalCursor++;
    decalPos[i * 3] = x + nx * 0.04;
    decalPos[i * 3 + 1] = y + ny * 0.04;
    decalPos[i * 3 + 2] = z + nz * 0.04;
    tmpN.set(nx, ny, nz).normalize();
    dummy.quaternion.setFromUnitVectors(zV, tmpN);
    // A random spin keeps repeated splats from lining up.
    dummy.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zV, rand() * Math.PI * 2));
    decalQuat[i * 4] = dummy.quaternion.x;
    decalQuat[i * 4 + 1] = dummy.quaternion.y;
    decalQuat[i * 4 + 2] = dummy.quaternion.z;
    decalQuat[i * 4 + 3] = dummy.quaternion.w;
    decalR[i] = radius * 2;
    decalAge[i] = 0;
    placeDecal(i, 0.001);
    decals.setColorAt(i, team === 1 ? colO : colV);
    decals.count = Math.min(MAXD, decalCursor);
    decals.instanceMatrix.needsUpdate = true;
    if (decals.instanceColor) decals.instanceColor.needsUpdate = true;
  }
  function popDecals(dt: number) {
    let dirty = false;
    const n = Math.min(MAXD, decalCursor);
    for (let i = 0; i < n; i++) {
      if (decalAge[i] >= POP) continue;
      decalAge[i] = Math.min(POP, decalAge[i] + dt);
      const t = decalAge[i] / POP;
      // easeOutBack: overshoot then settle, for a soft "splat".
      const e = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
      placeDecal(i, decalR[i] * e);
      dirty = true;
    }
    if (dirty) decals.instanceMatrix.needsUpdate = true;
  }

  // Wall ink: every splat on a vertical face is remembered so own-colour walls can be swum up.
  const MAXW = 700;
  const wallX = new Float32Array(MAXW);
  const wallY = new Float32Array(MAXW);
  const wallZ = new Float32Array(MAXW);
  const wallR = new Float32Array(MAXW);
  const wallTeam = new Uint8Array(MAXW);
  let wallCursor = 0;
  function inkWall(x: number, y: number, z: number, nx: number, ny: number, nz: number, radius: number, team: Team) {
    addDecal(x, y, z, nx, ny, nz, radius, team);
    const i = wallCursor % MAXW;
    wallCursor++;
    wallX[i] = x;
    wallY[i] = y;
    wallZ[i] = z;
    wallR[i] = radius;
    wallTeam[i] = team;
  }
  // Temporary ink footprints: small ovals that shrink away after a couple of seconds.
  const MAXF = 180;
  const FOOT_LIFE = 2.4;
  const footMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const feet = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), footMat, MAXF);
  feet.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXF * 3), 3);
  feet.frustumCulled = false;
  feet.count = 0;
  scene.add(feet);
  const footX = new Float32Array(MAXF);
  const footY = new Float32Array(MAXF);
  const footZ = new Float32Array(MAXF);
  const footYaw = new Float32Array(MAXF);
  const footAge = new Float32Array(MAXF).fill(99);
  let footCursor = 0;
  function addFoot(x: number, y: number, z: number, yaw: number, team: Team) {
    const i = footCursor % MAXF;
    footCursor++;
    footX[i] = x;
    footY[i] = y;
    footZ[i] = z;
    footYaw[i] = yaw;
    footAge[i] = 0;
    feet.count = Math.min(MAXF, footCursor);
    feet.setColorAt(i, team === 1 ? colO : colV);
    if (feet.instanceColor) feet.instanceColor.needsUpdate = true;
  }
  function updateFeet(dt: number) {
    for (let i = 0; i < MAXF; i++) {
      if (footAge[i] > FOOT_LIFE) continue;
      footAge[i] += dt;
      const fade = Math.min(1, (FOOT_LIFE - footAge[i]) / 0.8);
      const k = Math.max(0.001, fade);
      dummy.position.set(footX[i], footY[i], footZ[i]);
      dummy.rotation.set(0, footYaw[i], 0);
      dummy.scale.set(0.15 * k, 1, 0.24 * k);
      dummy.updateMatrix();
      feet.setMatrixAt(i, dummy.matrix);
    }
    feet.instanceMatrix.needsUpdate = true;
  }

  /** Team of the newest wall splat covering (x, y, z) within `pad`, or 0. */
  function wallTeamAt(x: number, y: number, z: number, pad: number) {
    const n = Math.min(MAXW, wallCursor);
    for (let k = 1; k <= n; k++) {
      const i = (wallCursor - k) % MAXW;
      const r = wallR[i] + pad;
      const dx = x - wallX[i];
      const dy = y - wallY[i];
      const dz = z - wallZ[i];
      if (dx * dx + dy * dy + dz * dz <= r * r) return wallTeam[i];
    }
    return 0;
  }

  const PMAX = 420;
  const pPos = new Float32Array(PMAX * 3);
  const pCol = new Float32Array(PMAX * 3);
  const pVel = new Float32Array(PMAX * 3);
  const pLife = new Float32Array(PMAX);
  /** Ground height under each particle at spawn, so it can bounce there. */
  const pFloor = new Float32Array(PMAX);
  pPos.fill(0);
  for (let i = 0; i < PMAX; i++) pPos[i * 3 + 1] = -40;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const dotTex = new THREE.CanvasTexture(softWhite);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ size: 0.3, map: dotTex, alphaTest: 0.25, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }),
  );
  points.frustumCulled = false;
  scene.add(points);
  let pCursor = 0;
  function burst(x: number, y: number, z: number, team: Team, n: number, speed = 4) {
    const c = team === 1 ? colO : colV;
    const floorY = surfaceTop(x, z) + 0.06;
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
      pFloor[id] = floorY;
      pCol[id * 3] = c.r;
      pCol[id * 3 + 1] = c.g;
      pCol[id * 3 + 2] = c.b;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }
  /** One particle with an explicit velocity (trails, converging charge sparks). */
  function spark(x: number, y: number, z: number, vx: number, vy: number, vz: number, team: Team, life: number) {
    const c = team === 1 ? colO : colV;
    const id = pCursor % PMAX;
    pCursor++;
    pPos[id * 3] = x;
    pPos[id * 3 + 1] = y;
    pPos[id * 3 + 2] = z;
    pVel[id * 3] = vx;
    pVel[id * 3 + 1] = vy;
    pVel[id * 3 + 2] = vz;
    pLife[id] = life;
    pFloor[id] = surfaceTop(x, z) + 0.06;
    pCol[id * 3] = c.r;
    pCol[id * 3 + 1] = c.g;
    pCol[id * 3 + 2] = c.b;
    pGeo.attributes.color.needsUpdate = true;
  }

  // Special effects: a glow orb while a special charges, and a shockwave ring when it bursts.
  type Fx = { alive: boolean; ring: boolean; t: number; dur: number; size: number; owner: number; mesh: THREE.Mesh };
  const fxOrbGeo = new THREE.SphereGeometry(1, 20, 14);
  const fxRingGeo = new THREE.RingGeometry(0.8, 1, 56).rotateX(-Math.PI / 2);
  const fxPool: Fx[] = [];
  for (let i = 0; i < 8; i++) {
    const ring = i >= 4;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(ring ? fxRingGeo : fxOrbGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    fxPool.push({ alive: false, ring, t: 0, dur: 1, size: 1, owner: -1, mesh });
  }
  function spawnFx(ring: boolean, x: number, y: number, z: number, team: Team, dur: number, size: number, owner: number) {
    const fx = fxPool.find((f) => f.ring === ring && !f.alive) ?? fxPool.find((f) => f.ring === ring)!;
    fx.alive = true;
    fx.t = 0;
    fx.dur = dur;
    fx.size = size;
    fx.owner = owner;
    fx.mesh.visible = true;
    fx.mesh.position.set(x, y, z);
    (fx.mesh.material as THREE.MeshBasicMaterial).color.copy(team === 1 ? colO : colV);
  }
  function updateFx(dt: number) {
    for (const fx of fxPool) {
      if (!fx.alive) continue;
      fx.t += dt;
      const k = Math.min(1, fx.t / fx.dur);
      const mat = fx.mesh.material as THREE.MeshBasicMaterial;
      if (fx.ring) {
        fx.mesh.scale.setScalar(0.6 + (fx.size - 0.6) * (1 - Math.pow(1 - k, 3)));
        mat.opacity = 0.9 * (1 - k);
      } else {
        const o = actors[fx.owner];
        if (!o || !o.alive || o.spT <= 0) fx.t = fx.dur;
        else fx.mesh.position.set(o.x, o.y + 1, o.z);
        const pulse = 1 + Math.sin(fx.t * 38) * 0.08;
        fx.mesh.scale.setScalar((0.4 + 1.3 * k) * pulse);
        mat.opacity = 0.18 + 0.32 * k;
      }
      if (fx.t >= fx.dur) {
        fx.alive = false;
        fx.mesh.visible = false;
      }
    }
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
  for (let i = 0; i < 3; i++) zones.push({ alive: false, x: 0, z: 0, team: 1, owner: 0, life: 0, acc: 0, r: 6.5, mesh: makeCloud() });
  const beaconGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8);
  const beaconMat = {
    1: new THREE.MeshLambertMaterial({ color: 0xff6a1a }),
    2: new THREE.MeshLambertMaterial({ color: 0x5b4dff }),
  };
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(beaconGeo, beaconMat[1]);
    mesh.visible = false;
    scene.add(mesh);
    beacons.push({ alive: false, x: 0, y: 0, z: 0, team: 1, owner: 0, life: 0, acc: 0, mesh });
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

  /** Top of the wall in front of an actor at (x, z) with feet at y, or -1 if nothing blocks. */
  function blockerTop(x: number, z: number, y: number) {
    const r = 0.36;
    let top = -1;
    for (let i = 0; i < solids.length; i++) {
      const b = solids[i];
      if (y + 1.2 < b.minY || y > b.maxY - 0.3) continue;
      if (b.maxY <= y + 0.55) continue;
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) top = Math.max(top, b.maxY);
    }
    return top;
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
    paint(x, z, paintR, team, owner);
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
    if (target.isPlayer && by && !by.isPlayer) amount *= tuneFor(by).dmg;
    if (how === "splat") amount *= target.mods.armor;
    if (by?.isPlayer && !target.isPlayer && amount > 0) {
      if (hitMark < 0.55) audio.hit();
      hitMark = 1;
    }
    if (how === "water") target.splat = 100;
    else target.splat = Math.min(100, target.splat + amount);
    if (target.splat < 100) return;
    target.alive = false;
    target.deaths += 1;
    target.respawn = target.isPlayer ? 2.7 : 2.2;
    target.swimming = false;
    target.mesh.root.visible = false;
    burst(target.x, target.y + 0.8, target.z, by?.team ?? (target.team === 1 ? 2 : 1), 28, 7);
    paint(target.x, target.z, 2.3, by?.team ?? (target.team === 1 ? 2 : 1), by);
    shake = Math.min(1, shake + (target.isPlayer || by?.isPlayer ? 0.7 : 0.25));
    audio.thud();
    if (how === "water") {
      pushFeed(target.isPlayer ? "سىز سۇغا چۈشۈپ كەتتىڭىز" : `${target.name} سۇغا چۈشۈپ كەتتى`);
      if (target.isPlayer) setBanner("سۇغا چۈشتىڭىز!");
    } else if (by) {
      by.splats += 1;
      by.special = Math.min(100, by.special + 28 * by.mods.meter * (by.isPlayer ? 1 : tuneFor(by).meter));
      if (by.isPlayer) {
        killMark = 1;
        setBanner("پاكىز زەربە!");
      }
      if (target.isPlayer) setBanner("چاچرىتىلدىڭىز!");
      const kn = by.isPlayer ? "سىز" : by.name;
      pushFeed(target.isPlayer ? `سىز ${kn} تەرىپىدىن چاچرىتىلدىڭىز` : `${target.name} ${kn} تەرىپىدىن چاچرىتىلدى`);
    } else {
      pushFeed(target.isPlayer ? "سىز چاچرىتىلدىڭىز" : `${target.name} چاچرىتىلدى`);
    }
  }

  function spawnProj(p: Omit<Proj, "alive" | "stuck" | "trail" | "trailAcc"> & { trail?: number }) {
    const slot = projs.find((s) => !s.alive) ?? projs[0];
    Object.assign(slot, { trail: 0, trailAcc: 0 }, p, { alive: true, stuck: false });
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
    const P = POWER.spritzer;
    const cost = fromPlayer ? P.ink : 1.15;
    if (actor.ink < cost || actor.fireCd > 0) return;
    actor.ink -= cost;
    actor.fireCd = fromPlayer ? P.cd : 0.2 * tuneFor(actor).cd;
    actor.recoil = Math.max(actor.recoil, 0.55);
    const f = yawForward(actor.yaw);
    const speed = fromPlayer ? P.speed : 34;
    spawnProj({
      x: actor.x + f.x * 0.55,
      y: actor.y + 1.15,
      z: actor.z + f.z * 0.55,
      vx: dir.x * speed,
      vy: dir.y * speed,
      vz: dir.z * speed,
      grav: 7,
      life: fromPlayer ? P.life : 0.78,
      team: actor.team,
      dmg: fromPlayer ? P.dmg : 12,
      splash: 0,
      splashR: 0,
      paintR: fromPlayer ? P.paintR : 0.92,
      hitR: fromPlayer ? 0.34 : 0.28,
      scale: fromPlayer ? P.scale : 0.85,
      kind: "shot",
      owner: actors.indexOf(actor),
      trail: fromPlayer ? P.trail : 0,
    });
    burst(actor.x + f.x * 0.7, actor.y + 1.15, actor.z + f.z * 0.7, actor.team, fromPlayer ? 6 : 3, fromPlayer ? 3.2 : 2);
    if (fromPlayer) {
      shake = Math.min(0.4, shake + 0.035);
      audio.shoot(620);
      audio.splash(0.35);
    }
  }

  function shootBlaster(actor: Actor, dir: THREE.Vector3, fromPlayer: boolean) {
    if (actor.ink < 14 || actor.fireCd > 0) return;
    actor.ink -= 14;
    const P = POWER.blaster;
    actor.fireCd = fromPlayer ? P.cd : 1.05 * tuneFor(actor).cd;
    actor.recoil = 1;
    const f = yawForward(actor.yaw);
    const speed = fromPlayer ? P.speed : 16;
    spawnProj({
      x: actor.x + f.x * 0.6,
      y: actor.y + 1.25,
      z: actor.z + f.z * 0.6,
      vx: dir.x * speed,
      vy: dir.y * speed + 6.5,
      vz: dir.z * speed,
      grav: 14,
      life: 0.95,
      team: actor.team,
      dmg: fromPlayer ? P.dmg : 22,
      splash: fromPlayer ? P.splash : 30,
      splashR: fromPlayer ? P.splashR : 3.1,
      paintR: fromPlayer ? P.paintR : 3.15,
      hitR: 0.35,
      scale: fromPlayer ? 2.1 : 1.7,
      kind: "shot",
      owner: actors.indexOf(actor),
    });
    if (fromPlayer) {
      shake = Math.min(0.6, shake + 0.14);
      burst(actor.x + f.x * 0.8, actor.y + 1.25, actor.z + f.z * 0.8, actor.team, 10, 4);
      audio.shoot(220);
      audio.splash(0.7);
    }
  }

  function shootCharger(actor: Actor, dir: THREE.Vector3, charge: number, fromPlayer: boolean) {
    const P = POWER.charger;
    const cost = fromPlayer ? P.cost[0] + P.cost[1] * charge : 8 + 16 * charge;
    if (actor.ink < cost) return;
    actor.ink -= cost;
    actor.fireCd = 0.35;
    actor.recoil = 1;
    const originY = actor.y + 1.25;
    const maxD = fromPlayer ? P.reach[0] + charge * P.reach[1] : 12 + charge * 30;
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
      paint(actor.x + dir.x * t, actor.z + dir.z * t, fromPlayer ? P.line[0] + charge * P.line[1] : 0.42 + charge * 0.35, actor.team, actor);
    }
    if (hit && !victim) {
      paint(hit.x, hit.z, (fromPlayer ? 1.3 : 0.8) + charge, actor.team, actor);
      if (Math.abs(hit.ny) < 0.65) inkWall(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 0.7 + charge * 0.4, actor.team);
    }
    if (victim) hurt(victim, fromPlayer ? P.dmg[0] + P.dmg[1] * charge : 16 + 86 * charge, actor, "splat");
    burst(actor.x + dir.x * 0.8, originY, actor.z + dir.z * 0.8, actor.team, fromPlayer ? 14 : 8, 3);
    if (fromPlayer) {
      audio.shoot(180 + charge * 520);
      audio.splash(0.4 + charge * 0.5);
      shake = Math.min(1, shake + 0.12 + charge * 0.2);
    }
  }

  function rollerTick(actor: Actor, dt: number, fromPlayer: boolean) {
    const f = yawForward(actor.yaw);
    if (actor.grounded && actor.ink > 0) {
      const P = POWER.roller;
      actor.ink = Math.max(0, actor.ink - (fromPlayer ? P.inkPerSec : 15) * dt);
      paint(actor.x + f.x * 0.8, actor.z + f.z * 0.8, fromPlayer ? P.paintR : 1.5, actor.team, actor);
      const moving = Math.hypot(actor.vx, actor.vz) > 2;
      if (moving) {
        const reach = fromPlayer ? P.reach : 1.45;
        const dps = fromPlayer ? P.dps : 70;
        for (let i = 0; i < actors.length; i++) {
          const o = actors[i];
          if (!o.alive || o.team === actor.team || o.invuln > 0) continue;
          const d = Math.hypot(o.x - actor.x, o.z - actor.z);
          if (d < reach && o.y < actor.y + 1.2) hurt(o, dps * dt, actor, "splat");
        }
      }
    }
  }

  function flickRoller(actor: Actor, dir: THREE.Vector3, fromPlayer: boolean) {
    if (actor.ink < 8) return;
    actor.ink -= 8;
    const f = yawForward(actor.yaw);
    const r = yawRight(actor.yaw);
    const P = POWER.roller;
    actor.recoil = 1;
    const fan = fromPlayer ? P.flicks : 2;
    const speed = fromPlayer ? P.flickSpeed : 20;
    for (let i = -fan; i <= fan; i++) {
      const spread = i * (fromPlayer ? 0.14 : 0.16);
      const dx = dir.x * 0.75 + f.x * 0.25 + r.x * spread;
      const dz = dir.z * 0.75 + f.z * 0.25 + r.z * spread;
      const len = Math.hypot(dx, dz) || 1;
      spawnProj({
        x: actor.x + f.x * 0.8,
        y: actor.y + 0.7,
        z: actor.z + f.z * 0.8,
        vx: (dx / len) * speed,
        vy: 3.5,
        vz: (dz / len) * speed,
        grav: 12,
        life: 0.45,
        team: actor.team,
        dmg: fromPlayer ? P.flickDmg : 16,
        splash: 8,
        splashR: 1.4,
        paintR: fromPlayer ? P.flickPaint : 1.15,
        hitR: 0.3,
        scale: fromPlayer ? 1.4 : 1.15,
        kind: "flick",
        owner: actors.indexOf(actor),
      });
    }
    if (fromPlayer) {
      shake = Math.min(0.6, shake + 0.12);
      audio.shoot(280);
      audio.splash(0.6);
    }
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

  const SPECIAL_CHARGE = 0.75;

  /** Starts a special: a short, readable wind-up before the burst. */
  function useSpecial(actor: Actor, dir: THREE.Vector3) {
    if (actor.special < 100 || !actor.alive || actor.spT > 0) return;
    actor.special = 0;
    actor.spT = SPECIAL_CHARGE;
    actor.spX = dir.x;
    actor.spY = dir.y;
    actor.spZ = dir.z;
    actor.invuln = Math.max(actor.invuln, SPECIAL_CHARGE + 0.2);
    spawnFx(false, actor.x, actor.y + 1, actor.z, actor.team, SPECIAL_CHARGE, 1, actors.indexOf(actor));
    if (actor.isPlayer || Math.hypot(actor.x - actors[0].x, actor.z - actors[0].z) < 22) audio.charge(SPECIAL_CHARGE);
  }

  function chargeTick(actor: Actor, dt: number) {
    actor.spT -= dt;
    // Ink droplets rush inward toward the charging character.
    for (let k = 0; k < 2; k++) {
      const ang = rand() * Math.PI * 2;
      const r = 2 + rand() * 0.8;
      const sx = actor.x + Math.cos(ang) * r;
      const sz = actor.z + Math.sin(ang) * r;
      const sy = actor.y + 0.3 + rand() * 1.6;
      spark(sx, sy, sz, (actor.x - sx) * 3.2, (actor.y + 1 - sy) * 3.2 + 2.2, (actor.z - sz) * 3.2, actor.team, 0.3);
    }
    if (actor.spT <= 0) {
      actor.spT = 0;
      releaseSpecial(actor);
    }
  }

  /** The explosive part every special shares: instant paint, damage and a shockwave. */
  function inkBlast(actor: Actor, radius: number, dmg: number) {
    paint(actor.x, actor.z, radius, actor.team, actor, false);
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2 + rand() * 0.4;
      const rr = radius * (0.8 + rand() * 0.35);
      paint(actor.x + Math.cos(ang) * rr, actor.z + Math.sin(ang) * rr, radius * 0.26, actor.team, actor, false);
    }
    for (const o of actors) {
      if (!o.alive || o.team === actor.team) continue;
      const d = Math.hypot(o.x - actor.x, o.z - actor.z);
      if (d < radius) hurt(o, dmg * (1 - (d / radius) * 0.5), actor, "splat");
    }
    burst(actor.x, actor.y + 0.9, actor.z, actor.team, Math.round(30 + radius * 6), 6 + radius);
    spawnFx(true, actor.x, actor.y + 0.1, actor.z, actor.team, 0.55, radius, -1);
    const near = Math.hypot(actor.x - actors[0].x, actor.z - actors[0].z);
    shake = Math.min(1.2, shake + Math.max(0, 1 - near / 26));
    if (near < 30) audio.boom(radius / 9);
  }

  function releaseSpecial(actor: Actor) {
    const name = SPECIALS.find((s) => s.id === actor.specialId)?.name ?? "";
    if (actor.isPlayer) setBanner(name);
    else pushFeed(`${actor.name} — ${name}!`);
    if (actor.specialId === "burst") {
      inkBlast(actor, 9, 150);
      return;
    }
    inkBlast(actor, 4.5, 70);
    if (actor.specialId === "reef-rush") {
      actor.rush = 6;
      return;
    }
    const hit = castWorld(actor.x, actor.y + 1.3, actor.z, actor.spX, actor.spY, actor.spZ, 28);
    const x = hit ? hit.x : actor.x + actor.spX * 12;
    const z = hit ? hit.z : actor.z + actor.spZ * 12;
    const zone = zones.find((z0) => !z0.alive) ?? zones[0];
    zone.alive = true;
    zone.x = x;
    zone.z = z;
    zone.team = actor.team;
    zone.owner = actors.indexOf(actor);
    zone.life = 5.6;
    zone.acc = 0;
    zone.mesh.visible = true;
    zone.mesh.position.set(x, surfaceTop(x, z) + 4.2, z);
    zone.mesh.children.forEach((c) => {
      const mesh = c as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(actor.team === 1 ? colO : colV);
    });
  }

  function placeBeacon(x: number, y: number, z: number, team: Team, owner: number) {
    const b = beacons.find((k) => !k.alive) ?? beacons[0];
    b.alive = true;
    b.x = x;
    b.y = y;
    b.z = z;
    b.team = team;
    b.owner = owner;
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
      placeBeacon(x, y, z, p.team, p.owner);
      paint(x, z, p.paintR, p.team, owner);
      p.alive = false;
      return;
    }
    if (p.splash > 0 || p.kind === "bomb") {
      splashAt(x, y, z, p.team, p.paintR, p.splash, p.splashR, owner);
      if (Math.abs(ny) < 0.62) inkWall(x, y, z, nx, ny, nz, p.paintR * 0.7, p.team);
    } else {
      paint(x, z, p.paintR, p.team, owner);
      if (Math.abs(ny) < 0.62) inkWall(x, y, z, nx, ny, nz, p.paintR * 0.85, p.team);
      burst(x, y + 0.1, z, p.team, Math.round(6 * p.scale), 3 * Math.max(1, p.scale * 0.8));
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
    if (p.trail > 0) {
      p.trailAcc -= dt;
      if (p.trailAcc <= 0) {
        p.trailAcc = 0.06;
        paint(p.x, p.z, p.trail, p.team, actors[p.owner] ?? null, false);
        spark(p.x, p.y, p.z, p.vx * 0.08 + (rand() - 0.5), -0.5, p.vz * 0.08 + (rand() - 0.5), p.team, 0.35);
      }
    }
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
        paint(a.x, a.z, Math.max(0.7, p.paintR * 0.55), p.team, owner);
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
      else paint(p.x, p.z, p.paintR * 0.6, p.team, actors[p.owner] ?? null);
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
        actor.charge = Math.min(1, actor.charge + dt / POWER.charger.fullCharge);
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
    if (a.climbing) {
      /* vy set by the climber */
    } else if (!a.swimming) a.vy -= GRAV * dt;
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
      paint(a.x, a.z, 1.15, a.team, a);
    }
    if (a.swimming) a.ink = Math.min(100, a.ink + 46 * a.mods.ink * dt);
    else a.ink = Math.min(100, a.ink + (rush ? 0 : 11 * a.mods.ink) * dt);
    if (!rush && floor === (a.team === 1 ? 2 : 1) && a.grounded && a.invuln <= 0) {
      a.splat = Math.min(100, a.splat + 16 * a.mods.armor * dt);
      if (a.splat >= 100) hurt(a, 0, null, "splat");
    } else if (floor === a.team || !a.grounded) {
      a.splat = Math.max(0, a.splat - 22 * dt);
    }
    if (a.invuln > 0) a.invuln -= dt;
    if (a.fireCd > 0) a.fireCd -= dt;
    if (a.subCd > 0) a.subCd -= dt;
  }

  /** Eases actual movement toward the wanted velocity: a snappy start and a soft stop. */
  function steer(a: Actor, tx: number, tz: number, dt: number, grip: number) {
    const speeding = tx * tx + tz * tz > a.mvx * a.mvx + a.mvz * a.mvz;
    const k = 1 - Math.exp(-(speeding ? grip : grip * 0.75) * dt);
    a.mvx += (tx - a.mvx) * k;
    a.mvz += (tz - a.mvz) * k;
  }
  const gripFor = (a: Actor) => (a.climbing ? 20 : a.swimming ? 16 : a.grounded ? 14 : 5);

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
    if (a.spT > 0) chargeTick(a, dt);
    const charging = a.spT > 0;
    // Swim-climb: hold swim and push into a wall painted in your own ink.
    const wx = fwd.x * f + right.x * r;
    const wz = fwd.z * f + right.z * r;
    const wl = Math.hypot(wx, wz);
    let climb = false;
    if (wantSwim && wl > 0.2 && a.rush <= 0 && !charging) {
      const top = blockerTop(a.x + (wx / wl) * 0.55, a.z + (wz / wl) * 0.55, a.y);
      if (top >= 0) {
        // Own ink on the wall at body height; a climber gets a little extra reach, and
        // once the ledge is within ~1 m they vault over it even if the last bit is bare.
        const inked = wallTeamAt(a.x + (wx / wl) * 0.42, a.y + 0.4, a.z + (wz / wl) * 0.42, a.climbing ? 0.75 : 0.4) === a.team;
        climb = inked || (a.climbing && top - a.y < 1.1);
      }
    }
    a.climbing = climb;
    a.swimming = a.climbing || !!(wantSwim && a.grounded && floor === a.team && a.rush <= 0 && !charging);
    let speed = 6.35 * a.mods.run;
    if (a.swimming) speed = 11.4 * a.mods.swim;
    else if (a.rush > 0) speed = 10.2;
    else if (floor && floor !== a.team) speed = 2.65;
    if (a.weapon === "roller" && (fireMouse || input.fire) && a.grounded) speed *= 0.9;
    if (charging) speed *= 0.3;
    const mx = wx * speed;
    const mz = wz * speed;
    if (a.climbing) a.vy = 6.4 * a.mods.swim;
    if (jumpEdge && a.grounded && !a.swimming && !charging) {
      a.vy = 8.5;
      a.grounded = false;
      a.swimming = false;
      audio.blip();
      if (a.weapon === "roller" && (fireMouse || input.fire)) flickRoller(a, playerAim(a), true);
    }
    steer(a, mx, mz, dt, gripFor(a));
    moveActor(a, a.mvx, a.mvz, dt);
    environmentInk(a, dt);
    if (a.swimming) audio.swim(true);
    else audio.swim(false);
    if (charging) {
      a.charge = 0;
      return;
    }
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
      if (waterAt(x, z, 0.8)) continue;
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

  /** Would a hop in direction (dx, dz) come down in water? */
  function waterAhead(x: number, z: number, dx: number, dz: number) {
    for (const d of [1.5, 2.5, 3.5]) if (waterAt(x + dx * d, z + dz * d)) return true;
    return false;
  }

  function segHitsRect(x0: number, z0: number, x1: number, z1: number, r: Rect) {
    let t0 = 0;
    let t1 = 1;
    const p = [x0 - x1, x1 - x0, z0 - z1, z1 - z0];
    const q = [x0 - r.minX, r.maxX - x0, z0 - r.minZ, r.maxZ - z0];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
        continue;
      }
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        t0 = Math.max(t0, t);
      } else {
        if (t < t0) return false;
        t1 = Math.min(t1, t);
      }
    }
    return true;
  }

  /**
   * Where a bot should walk next on its way to (gx, gz) without swimming.
   * Channels: line up with the nearest crossing on your own bank, then walk straight over it.
   * Pools: head for the cheapest visible corner of the pool's padded outline.
   */
  function navTarget(a: Actor, gx: number, gz: number): [number, number] {
    const ch = level.channel;
    if (ch) {
      const half = ch.rect.maxZ;
      const goalSide = gz >= 0 ? 1 : -1;
      const side = a.z >= 0 ? 1 : -1;
      if (side !== goalSide || Math.abs(a.z) <= half + 0.75) {
        const ref = Math.abs(a.z) < half + 2.55 ? a.x : (a.x + gx) / 2;
        let best = ch.crossings[0];
        for (const c of ch.crossings) if (Math.abs(c[0] - ref) < Math.abs(best[0] - ref)) best = c;
        const [bx, bh] = best;
        const lane = half + 3.05;
        if (Math.abs(a.x - bx) > bh) return [bx, side * lane];
        return [bx, goalSide * lane];
      }
    }
    for (const r of level.pools) {
      const m = 1.5;
      const pad = { minX: r.minX - m, maxX: r.maxX + m, minZ: r.minZ - m, maxZ: r.maxZ + m };
      const core = { minX: r.minX - m * 0.6, maxX: r.maxX + m * 0.6, minZ: r.minZ - m * 0.6, maxZ: r.maxZ + m * 0.6 };
      // A goal right on the rim can never be reached without crossing the core; go straight.
      if (gx > core.minX && gx < core.maxX && gz > core.minZ && gz < core.maxZ) continue;
      if (!segHitsRect(a.x, a.z, gx, gz, core)) continue;
      let tx = gx;
      let tz = gz;
      let bestCost = Infinity;
      for (const [cx, cz] of [
        [pad.minX, pad.minZ],
        [pad.minX, pad.maxZ],
        [pad.maxX, pad.minZ],
        [pad.maxX, pad.maxZ],
      ]) {
        const toCorner = Math.hypot(cx - a.x, cz - a.z);
        if (toCorner < 1 || segHitsRect(a.x, a.z, cx, cz, core)) continue;
        const cost = toCorner + Math.hypot(gx - cx, gz - cz);
        if (cost < bestCost) {
          bestCost = cost;
          tx = cx;
          tz = cz;
        }
      }
      return [tx, tz];
    }
    return [gx, gz];
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
    if (a.spT > 0) {
      chargeTick(a, dt);
      steer(a, 0, 0, dt, 10);
      moveActor(a, a.mvx, a.mvz, dt);
      environmentInk(a, dt);
      return;
    }
    const T = tuneFor(a);
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
      a.think = (0.35 + rand() * 0.35) * T.think;
      if (nearest && nd < (a.weapon === "charger" ? 26 : 16) * T.range) a.mode = "fight";
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
    const [tx, tz] = navTarget(a, a.goalX, a.goalZ);
    let dx = tx - a.x;
    let dz = tz - a.z;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist;
    dz /= dist;
    if (blocked(a.x + dx * 1.1, a.z + dz * 1.1, a.y)) {
      const safeHop = !waterAhead(a.x, a.z, dx, dz);
      const sx = -dz;
      const sz = dx;
      const flip = Math.sin(a.phase * 2) > 0 ? 1 : -1;
      dx = sx * flip;
      dz = sz * flip;
      if (a.grounded && safeHop && rand() > 0.4) {
        a.vy = 8.2;
        a.grounded = false;
      }
    }
    // Strafe while fighting, except near the channel where a sidestep means a swim.
    if (a.mode === "fight" && !nearWater(a.x, a.z, 2.5)) {
      dx += Math.cos(a.phase * 3) * 0.8;
      dz += Math.sin(a.phase * 3) * 0.8;
      const m = Math.hypot(dx, dz) || 1;
      dx /= m;
      dz /= m;
    }
    const wantYaw = yawToward(a.mode === "fight" && nearest ? nearest.x - a.x : dx, a.mode === "fight" && nearest ? nearest.z - a.z : dz);
    let dyaw = Math.atan2(Math.sin(wantYaw - a.yaw), Math.cos(wantYaw - a.yaw));
    a.yaw += clamp(dyaw, -3.2 * dt, 3.2 * dt);
    let speed = a.swimming ? 10.2 * a.mods.swim : floor && floor !== a.team ? 2.8 : 5.7 * a.mods.run;
    if (a.weapon === "roller" && a.mode === "push") speed *= 0.92;
    speed *= T.speed;
    const before = Math.hypot(a.vx, a.vz);
    steer(a, dx * speed, dz * speed, dt, gripFor(a) * 0.8);
    moveActor(a, a.mvx, a.mvz, dt);
    if (before < 0.4 && dist > 2) a.stuck += dt;
    else a.stuck = 0;
    if (a.stuck > 0.8) {
      a.stuck = 0;
      pickGoal(a);
      const f = yawForward(a.yaw);
      if (a.grounded && !waterAhead(a.x, a.z, f.x, f.z)) {
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
        a.fireCd = 0.8 * T.cd;
        const aim = fireDirection(a, nearest.x, nearest.y + 1, nearest.z);
        flickRoller(a, aim, false);
      }
    } else if (a.mode === "fight" && nearest && a.fireCd <= 0 && a.ink > 8) {
      const aim = fireDirection(a, nearest.x + (rand() - 0.5) * 1.4 * T.spread, nearest.y + 1, nearest.z + (rand() - 0.5) * 1.4 * T.spread);
      if (a.weapon === "charger") {
        a.charge = Math.min(1, a.charge + (dt * 0.8) / T.cd);
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
      a.specialId = a.weapon === "roller" ? "reef-rush" : a.weapon === "charger" ? "tempest" : "burst";
      useSpecial(a, aim);
    }
    if (a.subCd <= 0 && a.ink > 40 && nearest && nd < 9 && rand() > 0.97) {
      const aim = fireDirection(a, nearest.x, nearest.y, nearest.z);
      a.sub = "pop-bomb";
      throwSub(a, aim, false);
    }
  }

  function respawn(a: Actor) {
    const spots = a.team === 1 ? level.spawnO : level.spawnV;
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
    a.climbing = false;
    a.spT = 0;
    a.mvx = 0;
    a.mvz = 0;
    a.yaw = a.team === 1 ? Math.PI : 0;
    a.charge = 0;
    a.mesh.root.visible = mode === "play";
  }

  function endMatch() {
    if (phase === "ended") return;
    recount();
    phase = "ended";
    paused = false;
    endT = 0;
    const me = actors[0];
    if (!me.alive) respawn(me);
    me.invuln = 0;
    me.swimming = false;
    me.climbing = false;
    me.spT = 0;
    // Pick the most open direction around the player for the end shot, and turn them to face it.
    const face = Math.atan2(-Math.sin(me.yaw), -Math.cos(me.yaw));
    let bestScore = -Infinity;
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
      const ang = face + off;
      const hit = castWorld(me.x, me.y + 1.2, me.z, Math.sin(ang), 0.07, Math.cos(ang), 3.6);
      const score = (hit ? hit.dist : 3.6) - Math.abs(off) * 0.12;
      if (score > bestScore) {
        bestScore = score;
        endAng = ang;
      }
    }
    me.yaw = endAng + Math.PI;
    endFromAng = Math.atan2(camPos.x - me.x, camPos.z - me.z);
    endFromDist = Math.max(1.5, Math.hypot(camPos.x - me.x, camPos.z - me.z));
    endFromY = camPos.y - me.y;
    const winner = Math.abs(orangePct - bluePct) < 0.004 ? "tie" : orangePct > bluePct ? "orange" : "violet";
    const p = actors[0];
    const board = buildBoard();
    const res: NonNullable<HudSnap["result"]> = { winner, orange: orangePct, blue: bluePct, splats: p.splats, deaths: p.deaths, points: board[0].points, board };
    result = res;
    setBanner(winner === "orange" ? "زېمىن بىزنىڭ!" : winner === "violet" ? "زېمىن قولدىن كەتتى" : "تەڭ-تەڭ");
    audio.setTempo(false);
    audio.fanfare(winner === "orange" ? 1 : winner === "violet" ? -1 : 0);
    document.exitPointerLock?.();
    if (!resultSent) {
      resultSent = true;
      bridge.onResult(res);
    }
    publish(true);
  }

  function resetWorld() {
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
    decalAge.fill(9);
    wallCursor = 0;
    footAge.fill(99);
    footCursor = 0;
    feet.count = 0;
    for (const fx of fxPool) {
      fx.alive = false;
      fx.mesh.visible = false;
    }
  }

  function setLevel(id: LevelId) {
    if (level.id === id || !LEVEL_DEFS[id]) return;
    buildLevel(LEVEL_DEFS[id]);
    resetWorld();
    if (mode !== "play") seedMenuInk();
  }

  function startMatch() {
    const cfg = bridge.config.current;
    if (level.id !== cfg.level && LEVEL_DEFS[cfg.level]) buildLevel(LEVEL_DEFS[cfg.level]);
    clearInk();
    result = null;
    resultSent = false;
    feed.length = 0;
    endT = 0;
    camInit = false;
    hitMark = 0;
    killMark = 0;
    countdown = 3;
    timeLeft = MATCH_LEN;
    phase = "countdown";
    paused = false;
    mode = "play";
    orangePct = 0;
    bluePct = 0;
    resetWorld();
    const p = actors[0];
    if (p.char !== cfg.character) {
      disposeKid(p.mesh);
      p.char = cfg.character;
      p.mods = characterById(p.char).mods;
      p.mesh = makeKid(1, p.name, p.char);
    }
    p.name = cfg.name.trim().slice(0, 16) || "ۋارىس";
    p.mesh.nameSprite.visible = true;
    p.weapon = cfg.weapon;
    p.sub = cfg.sub;
    p.specialId = cfg.special;
    writeName(p.mesh, p.name, 1);
    setWeapon(p.mesh, p.weapon);
    actors.forEach((a, idx) => {
      a.splats = 0;
      a.deaths = 0;
      a.painted = 0;
      a.alive = true;
      a.ink = 100;
      a.special = idx === 0 ? 20 : 10;
      a.splat = 0;
      a.rush = 0;
      a.charge = 0;
      a.fireCd = 0;
      a.subCd = 0;
      a.swimming = false;
      a.climbing = false;
      a.spT = 0;
      a.mvx = 0;
      a.mvz = 0;
      a.recoil = 0;
      a.vy = 0;
      const spots = a.team === 1 ? level.spawnO : level.spawnV;
      // The player always takes spot 1; shift bots by one so nobody spawns on top of them.
      const s = a.isPlayer ? spots[1] : spots[(idx + 1) % spots.length];
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
    for (const s of level.spawnO) paint(s[0], s[1], 3.3, 1);
    for (const s of level.spawnV) paint(s[0], s[1], 3.3, 2);
    recount();
    hero.root.visible = false;
    audio.unlock();
    audio.setTempo(false);
    audio.tick(false);
    setBanner("تەييارلىنىڭ!");
    publish(true);
  }

  function setPaused(p: boolean) {
    if (mode !== "play" || phase === "ended") return;
    paused = p;
    if (p) document.exitPointerLock?.();
    publish(true);
  }

  function goOrbit() {
    audio.setTempo(false);
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

  function buildBoard(): BoardRow[] {
    return actors.map((a) => ({
      name: a.name,
      team: a.team === 1 ? "orange" : "violet",
      weapon: a.weapon,
      points: Math.round(a.painted * 0.5),
      splats: a.splats,
      deaths: a.deaths,
      isPlayer: a.isPlayer,
      alive: a.alive,
    }));
  }

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
      hit: hitMark,
      kill: killMark,
      board: mode === "play" ? buildBoard() : [],
    };
    if (force || mode === "play") bridge.onHud(snap);
  }

  function drawMini() {
    const g = mini.getContext("2d");
    if (!g) return;
    const w = mini.width;
    const h = mini.height;
    g.fillStyle = `#${level.ground.toString(16).padStart(6, "0")}`;
    g.fillRect(0, 0, w, h);
    g.drawImage(inkCanvas, 0, 0, w, h);
    g.fillStyle = "rgba(20,152,184,0.55)";
    for (const r of levelWater) {
      const x0 = ((r.minX - MAP.minX) / MAP.w) * w;
      const y0 = (1 - (r.maxZ - MAP.minZ) / MAP.d) * h;
      g.fillRect(x0, y0, ((r.maxX - r.minX) / MAP.w) * w, ((r.maxZ - r.minZ) / MAP.d) * h);
    }
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
    const p = actors[0];
    if (p.alive) {
      const f = yawForward(p.yaw);
      g.save();
      g.translate(((p.x - MAP.minX) / MAP.w) * w, (1 - (p.z - MAP.minZ) / MAP.d) * h);
      g.rotate(Math.atan2(-f.z, f.x));
      g.beginPath();
      g.moveTo(13, 0);
      g.lineTo(5, -5);
      g.lineTo(5, 5);
      g.closePath();
      g.fillStyle = "#f4f7fb";
      g.strokeStyle = "#102033";
      g.lineWidth = 1.5;
      g.fill();
      g.stroke();
      g.restore();
    }
  }

  function syncVisuals(dt: number) {
    const t = performance.now() * 0.001;
    for (const m of waterMeshes) m.position.y = 0.07 + Math.sin(t * 1.6) * 0.02;
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
          paint(x, z, 1.1 + rand(), rand() > 0.5 ? 1 : 2);
          burst(x, 0.4, z, rand() > 0.5 ? 1 : 2, 8, 3);
        }
      }
    } else if (mode === "showcase") {
      const cfg = bridge.config.current;
      if (hero.char !== cfg.character) {
        disposeKid(hero);
        hero = makeKid(1, cfg.name.trim().slice(0, 16) || "ۋارىس", cfg.character);
      }
      setWeapon(hero, cfg.weapon);
      const hy = surfaceTop(0, -24);
      hero.root.visible = true;
      hero.root.position.set(0, hy, -24);
      hero.root.rotation.y = t * 0.55 + Math.PI;
      hero.body.position.y = Math.sin(t * 2) * 0.03;
      camera.position.set(1.5, hy + 1.6, -24 + 3.9);
      camera.lookAt(0, hy + 1.15, -24);
    }
    if (mode !== "play") return;
    const ended = phase === "ended";
    if (ended) endT += dt;
    const outcome = result ? (result.winner === "orange" ? 1 : result.winner === "violet" ? -1 : 0) : 0;
    for (const a of actors) {
      const m = a.mesh;
      m.root.visible = a.alive;
      if (!a.alive) continue;
      m.root.position.set(a.x, a.y, a.z);
      m.root.rotation.y = a.yaw + Math.PI;
      const speed = Math.hypot(a.vx, a.vz);
      const moving = speed > 0.8 && a.grounded && !a.swimming;
      // Cadence and stride follow speed, so easing in and out of a run reads smoothly.
      a.phase += dt * (moving ? 4 + speed * 1.15 : 2.2);
      const stride = moving ? Math.min(0.85, 0.2 + speed * 0.1) : 0.04;
      m.legs.children[0].rotation.x = Math.sin(a.phase) * stride;
      m.legs.children[1].rotation.x = Math.sin(a.phase + Math.PI) * stride;
      const sway = Math.sin(a.phase * 0.6) * 0.12 + (moving ? Math.sin(a.phase) * 0.1 : 0);
      m.tentL.rotation.z = 0.35 + sway;
      m.tentR.rotation.z = -0.35 - sway;
      a.recoil = Math.max(0, a.recoil - dt * 7);

      // Swim morph: the humanoid squashes flat, then the squid form pops up in its place.
      m.swim += ((a.swimming ? 1 : 0) - m.swim) * Math.min(1, dt * 16);
      const inSquid = m.swim > 0.5;
      m.body.visible = !inSquid;
      m.squid.visible = inSquid;
      const charging = a.spT > 0 ? 1 - a.spT / SPECIAL_CHARGE : 0;
      if (!inSquid) {
        m.body.scale.set(1 + m.swim * 0.5, Math.max(0.35, 1 - m.swim * 1.3), 1 + m.swim * 0.5);
        m.body.position.y = (moving ? Math.abs(Math.sin(a.phase)) * 0.05 : 0) + charging * 0.45;
        m.body.rotation.set(-a.recoil * 0.05, charging * charging * 9, 0);
        m.torso.scale.set(1, 1 + (moving ? 0 : Math.sin(t * 2.4 + a.phase * 0.1) * 0.03), 1);
        m.headPivot.rotation.set(Math.sin(t * 1.3 + a.phase) * 0.035 - a.recoil * 0.06, 0, 0);
        m.armGun.rotation.set(-1.35 + a.recoil * 0.4, 0, 0.05);
        m.armSup.rotation.set(-1.15 + a.recoil * 0.28 + (moving ? Math.sin(a.phase) * 0.12 : 0), 0, 0.95);
        m.mount.visible = true;
        m.mount.position.set(0.24, 1.08, 0.3 - a.recoil * 0.13);
        m.mount.rotation.x = -a.recoil * 0.25;
      } else {
        const glide = Math.min(1, Math.hypot(a.vx, a.vz, a.climbing ? a.vy : 0) / 8);
        m.squid.scale.setScalar(0.55 + 0.45 * Math.min(1, (m.swim - 0.5) * 2));
        m.squid.position.set(0, a.climbing ? 0.55 : 0, a.climbing ? 0.2 : 0);
        m.squid.rotation.set(a.climbing ? -Math.PI / 2 : 0, 0, Math.sin(t * 9 + a.phase) * 0.14 * glide);
        m.fins.forEach((f, i) => (f.rotation.y = Math.sin(t * 16 + i * 1.3) * 0.5 * (0.25 + glide)));
      }

      // Eyes: a blink every few seconds.
      m.blink -= dt;
      if (m.blink < -0.12) m.blink = 2 + rand() * 3.5;
      const lid = m.blink < 0 ? 0.12 : 1;
      m.eyes.forEach((e) => {
        e.scale.set(1, lid, 1);
        e.rotation.z = 0;
      });

      const flicker = a.invuln > 0 && a.spT <= 0 && !ended && Math.sin(t * 24) > 0;
      m.root.visible = !flicker;
      const roll = m.weapons.roller.getObjectByName("roll");
      if (roll && a.weapon === "roller") roll.rotation.x += speed * dt * 2.2;

      if (ended) continue;
      // Ink footprints while running, and a spray of droplets behind a swimmer.
      const f = yawForward(a.yaw);
      if (moving) {
        a.stepAcc += speed * dt;
        if (a.stepAcc > 0.85) {
          a.stepAcc = 0;
          a.stepSide = -a.stepSide;
          const r = yawRight(a.yaw);
          addFoot(a.x + r.x * 0.12 * a.stepSide, a.y + 0.03, a.z + r.z * 0.12 * a.stepSide, a.yaw, a.team);
        }
        if (rand() < dt * 5) spark(a.x - f.x * 0.3, a.y + 0.4, a.z - f.z * 0.3, (rand() - 0.5) * 1.2, 1.2, (rand() - 0.5) * 1.2, a.team, 0.5);
      }
      if (a.swimming && speed > 2 && rand() < dt * 50) {
        const back = a.climbing ? 0 : 0.5;
        spark(
          a.x - f.x * back + (rand() - 0.5) * 0.3,
          a.y + (a.climbing ? 0.4 : 0.15),
          a.z - f.z * back + (rand() - 0.5) * 0.3,
          -f.x * speed * 0.15 + (rand() - 0.5),
          1.5 + rand() * 1.5,
          -f.z * speed * 0.15 + (rand() - 0.5),
          a.team,
          0.45,
        );
      }
    }

    // Final whistle: the player celebrates or sulks while the camera swings round to their face.
    const me = actors[0];
    if (ended && me.alive) {
      const m = me.mesh;
      const e = endT;
      m.swim = 0;
      m.body.visible = true;
      m.squid.visible = false;
      m.mount.visible = false;
      m.nameSprite.visible = false;
      m.body.scale.set(1, 1, 1);
      m.root.visible = true;
      if (outcome > 0) {
        m.body.position.y = Math.abs(Math.sin(e * 5.5)) * 0.5;
        m.body.rotation.set(0, Math.sin(e * 2.2) * 0.35, 0);
        m.armGun.rotation.set(-2.75 + Math.sin(e * 11) * 0.25, 0, -0.35);
        m.armSup.rotation.set(-2.75 + Math.sin(e * 11 + 1.2) * 0.25, 0, 0.35);
        m.headPivot.rotation.set(-0.18, 0, Math.sin(e * 5.5) * 0.08);
        m.tentL.rotation.z = 0.35 + Math.sin(e * 14) * 0.35;
        m.tentR.rotation.z = -0.35 - Math.sin(e * 14) * 0.35;
        m.eyes.forEach((eye) => eye.scale.set(1.05, 0.28, 1));
        if (Math.floor(e / 0.32) !== Math.floor((e - dt) / 0.32)) {
          burst(me.x + (rand() - 0.5), me.y + 2.4, me.z + (rand() - 0.5), rand() > 0.35 ? 1 : 2, 14, 5);
        }
      } else if (outcome < 0) {
        m.body.position.y = 0;
        m.body.rotation.set(0.22, Math.sin(e * 0.9) * 0.12, 0);
        m.headPivot.rotation.set(0.5 + Math.sin(e * 1.6) * 0.05, 0, 0);
        m.armGun.rotation.set(-0.18, 0, 0.14);
        m.armSup.rotation.set(-0.18, 0, -0.14);
        m.torso.scale.set(1, 1 + Math.sin(e * 1.4) * 0.05, 1);
        m.tentL.rotation.z = 0.08;
        m.tentR.rotation.z = -0.08;
        m.eyes.forEach((eye, i) => {
          eye.scale.set(1, 0.5, 1);
          eye.rotation.z = i === 0 ? 0.35 : -0.35;
        });
      } else {
        m.body.position.y = Math.abs(Math.sin(e * 2.5)) * 0.12;
        m.body.rotation.set(0, 0, Math.sin(e * 2.5) * 0.08);
        m.armGun.rotation.set(-0.7, 0, -0.9);
        m.armSup.rotation.set(-0.7, 0, 0.9);
        m.headPivot.rotation.set(0, 0, Math.sin(e * 2.5) * 0.15);
      }
    }
    const player = actors[0];
    if (player.weapon === "charger" && player.charge > 0.02 && player.alive && mode === "play") {
      const dir = playerAim(player);
      const reach = POWER.charger.reach[0] + player.charge * POWER.charger.reach[1];
      const hit = castWorld(player.x, player.y + 1.25, player.z, dir.x, dir.y, dir.z, reach);
      const dist = hit ? hit.dist : reach;
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
      const sp = Math.hypot(p.vx, p.vy, p.vz);
      if (sp > 0.5) dummy.quaternion.setFromUnitVectors(zV, tmpN.set(p.vx / sp, p.vy / sp, p.vz / sp));
      else dummy.quaternion.identity();
      const s0 = 0.18 * p.scale;
      dummy.scale.set(s0, s0, s0 * (1 + Math.min(4.5, sp * 0.11)));
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
        const shown = Math.ceil(countdown);
        countdown -= dt;
        if (countdown <= 0) {
          countdown = 0;
          phase = "live";
          setBanner("باشلا!");
          audio.go();
        } else if (Math.ceil(countdown) !== shown) audio.tick(false);
      } else {
        const before = timeLeft;
        timeLeft -= dt;
        if (before > 60 && timeLeft <= 60) {
          setBanner("1 مىنۇت قالدى!");
          audio.chime();
          audio.setTempo(true);
        }
        if (timeLeft > 0 && timeLeft <= 10 && Math.ceil(timeLeft) !== Math.ceil(before)) audio.tick(timeLeft <= 3);
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
            paint(z.x + Math.cos(ang) * rad, z.z + Math.sin(ang) * rad, 1.35, z.team, actors[z.owner] ?? null, false);
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
            paint(b.x + Math.cos(ang) * rad, b.z + Math.sin(ang) * rad, 0.9, b.team, actors[b.owner] ?? null, false);
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
    hitMark = Math.max(0, hitMark - dt * 4);
    killMark = Math.max(0, killMark - dt * 1.6);
    for (let i = 0; i < PMAX; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt;
      pVel[i * 3 + 1] -= 14 * dt;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      // Soft bounce: droplets hop off the ground a couple of times before fading.
      if (pPos[i * 3 + 1] < pFloor[i] && pVel[i * 3 + 1] < 0) {
        pPos[i * 3 + 1] = pFloor[i];
        pVel[i * 3 + 1] *= -0.45;
        pVel[i * 3] *= 0.7;
        pVel[i * 3 + 2] *= 0.7;
      }
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -40;
    }
    pGeo.attributes.position.needsUpdate = true;
    if (paintDirty) {
      inkTex.needsUpdate = true;
      paintDirty = false;
    }
  }

  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const camWant = new THREE.Vector3();
  const lookWant = new THREE.Vector3();
  let camInit = false;

  /** Follows the player with gentle easing; after the whistle it swings round to face them. */
  function updateCamera(dt: number) {
    if (mode !== "play") {
      camInit = false;
      return;
    }
    const a = actors[0];
    const f = yawForward(a.yaw);
    const r = yawRight(a.yaw);
    const ended = phase === "ended";
    if (ended) {
      // Orbit round to the front on an arc (a straight line would pass through the player).
      const k = Math.min(1, endT / 1.1);
      const e = k * k * (3 - 2 * k);
      const target = endAng + Math.sin(endT * 0.4) * 0.25 * e;
      const dA = Math.atan2(Math.sin(target - endFromAng), Math.cos(target - endFromAng));
      const ang = endFromAng + dA * e;
      const dx = Math.sin(ang);
      const dz = Math.cos(ang);
      let reach = endFromDist + (3.4 - endFromDist) * e;
      const hit = castWorld(a.x, a.y + 1.2, a.z, dx, 0.07, dz, reach);
      if (hit) reach = Math.max(1.2, hit.dist - 0.3);
      camPos.set(a.x + dx * reach, a.y + endFromY + (1.45 - endFromY) * e, a.z + dz * reach);
      // Look a little to the player's side so they stand right of centre, clear of the results panel.
      lookWant.set(a.x + r.x * 0.85 * e, a.y + 1.0, a.z + r.z * 0.85 * e);
      camLook.lerp(lookWant, 1 - Math.exp(-6 * dt));
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      return;
    } else {
      const dist = a.swimming ? 3.6 : 4.6;
      const cp = Math.cos(a.pitch);
      const sp = Math.sin(a.pitch);
      const headY = a.y + (a.swimming ? 0.7 : 1.35);
      let cx = a.x - f.x * dist * cp + r.x * 0.3;
      let cy = headY + dist * sp * 0.75 + 0.25;
      let cz = a.z - f.z * dist * cp + r.z * 0.3;
      // castWorld measures distance along its direction, so the ray must be unit length.
      const boom = Math.hypot(cx - a.x, cy - headY, cz - a.z) || 1;
      const hit = castWorld(a.x, headY, a.z, (cx - a.x) / boom, (cy - headY) / boom, (cz - a.z) / boom, boom);
      if (hit && hit.dist < boom) {
        const sc = Math.max(0.25, (hit.dist - 0.25) / boom);
        cx = a.x + (cx - a.x) * sc;
        cy = headY + (cy - headY) * sc;
        cz = a.z + (cz - a.z) * sc;
      }
      camWant.set(cx, cy, cz);
      lookWant.set(a.x + f.x * 1.4, headY - 0.15 + sp * 1.3, a.z + f.z * 1.4);
    }
    // Snap on teleports (match start, respawn); otherwise ease toward the target.
    if (!camInit || camPos.distanceToSquared(camWant) > 64) {
      camPos.copy(camWant);
      camLook.copy(lookWant);
      camInit = true;
    } else {
      camPos.lerp(camWant, 1 - Math.exp(-(ended ? 3 : 14) * dt));
      camLook.lerp(lookWant, 1 - Math.exp(-(ended ? 4 : 24) * dt));
    }
    shake = Math.max(0, shake * Math.exp(-3.5 * dt));
    camera.position.set(camPos.x + (rand() - 0.5) * shake * 0.28, camPos.y + (rand() - 0.5) * shake * 0.2, camPos.z);
    camera.lookAt(camLook);
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
  // Taps are latched at keydown: a press shorter than one frame still counts.
  let queueJump = false;
  let queueSpecial = false;
  let bombLatch = false;
  let specialLatch = false;

  function pollEdges() {
    const input = bridge.config.current.input;
    const jump = held("Space") || input.jump;
    const fire = fireMouse || input.fire;
    const bomb = held("KeyC") || input.bomb;
    const special = held("KeyF") || input.special;
    jumpEdge = queueJump || (jump && !prevJump);
    fireRelease = !fire && prevFire;
    bombEdge = queueBomb || (bomb && !bombLatch);
    specialEdge = queueSpecial || (special && !specialLatch);
    queueBomb = false;
    queueJump = false;
    queueSpecial = false;
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
    updateFx(dt);
    popDecals(dt);
    updateFeet(dt);
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
    if (!e.repeat && mode === "play" && !paused) {
      if (e.code === "Space") queueJump = true;
      else if (e.code === "KeyF") queueSpecial = true;
      else if (e.code === "KeyC") queueBomb = true;
    }
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
    setLevel,
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
      paint(x, z, 1.2 + rand() * 1.6, rand() > 0.5 ? 1 : 2);
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
  let noise: AudioBuffer | null = null;
  // A Hijaz-flavoured maqam line (D Eb F# G A Bb C D) over a dap frame-drum pattern.
  const D4 = 293.66, Eb4 = 311.13, Fs4 = 369.99, G4 = 392, A4 = 440, Bb4 = 466.16, C5 = 523.25, D5 = 587.33;
  const melody = [
    A4, 0, Bb4, A4, G4, 0, Fs4, G4, A4, 0, D5, C5, Bb4, A4, G4, Fs4,
    G4, 0, Fs4, Eb4, D4, 0, Eb4, Fs4, G4, A4, Bb4, A4, G4, Fs4, Eb4, D4,
  ];
  const dap = ["dum", "", "", "tak", "dum", "", "tak", ""];
  let stepMs = 170;
  let step = 0;

  function tone(bus: GainNode, type: OscillatorType, freq: number, at: number, peak: number, len: number, glideTo = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + len);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g);
    g.connect(bus);
    o.start(at);
    o.stop(at + len + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  function drum(kind: string) {
    if (!ctx || !music || !noise) return;
    const t = ctx.currentTime;
    if (kind === "dum") {
      tone(music, "sine", 120, t, 0.16, 0.2, 52);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2400;
    band.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(band);
    band.connect(g);
    g.connect(music);
    src.start(t, Math.random() * 0.5, 0.09);
    src.onended = () => {
      src.disconnect();
      band.disconnect();
      g.disconnect();
    };
  }

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
    noise = buffer;
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
      const t = ctx.currentTime;
      const note = melody[step % melody.length];
      if (note) tone(music, "triangle", note, t, 0.07, 0.24);
      if (step % 16 === 0) tone(music, "sine", D4 / 2, t, 0.05, 1.4);
      const hit = dap[step % dap.length];
      if (hit) drum(hit);
      step++;
      timer = window.setTimeout(loop, stepMs);
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
    /** A wet "splosh" under the player's shots; `amount` 0–1 sets weight and length. */
    splash(amount: number) {
      if (!ctx || !sfx || !noise || ctx.state !== "running") return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2600, t);
      lp.frequency.exponentialRampToValueAtTime(380, t + 0.06 + amount * 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05 + amount * 0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08 + amount * 0.18);
      src.connect(lp);
      lp.connect(g);
      g.connect(sfx);
      src.start(t, Math.random() * 0.6, 0.3);
      src.onended = () => {
        src.disconnect();
        lp.disconnect();
        g.disconnect();
      };
    },
    /** A rising, wobbling whine while a special winds up. */
    charge(len: number) {
      if (!ctx || !sfx || ctx.state !== "running") return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(880, t + len);
      lfo.frequency.value = 18;
      depth.gain.value = 40;
      lfo.connect(depth);
      depth.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + len * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
      o.connect(g);
      g.connect(sfx);
      o.start(t);
      lfo.start(t);
      o.stop(t + len + 0.08);
      lfo.stop(t + len + 0.08);
      o.onended = () => {
        o.disconnect();
        lfo.disconnect();
        depth.disconnect();
        g.disconnect();
      };
    },
    /** The special's burst: a deep thump under a big wet splash. */
    boom(size: number) {
      if (!ctx || !sfx || ctx.state !== "running") return;
      tone(sfx, "sine", 120, ctx.currentTime, 0.22 + size * 0.12, 0.5, 38);
      this.splash(Math.min(1, 0.6 + size * 0.4));
    },
    /** Speeds the music up for the final minute. */
    setTempo(fast: boolean) {
      stepMs = fast ? 132 : 170;
    },
    tick(urgent: boolean) {
      if (!ctx || !sfx || ctx.state !== "running") return;
      tone(sfx, "sine", urgent ? 1480 : 990, ctx.currentTime, urgent ? 0.12 : 0.08, 0.07);
    },
    go() {
      if (!ctx || !sfx || ctx.state !== "running") return;
      tone(sfx, "triangle", 784, ctx.currentTime, 0.09, 0.14);
      tone(sfx, "triangle", 1175, ctx.currentTime + 0.1, 0.1, 0.26);
    },
    hit() {
      if (!ctx || !sfx || ctx.state !== "running") return;
      tone(sfx, "triangle", 1250, ctx.currentTime, 0.05, 0.05, 1700);
    },
    /** 1 = win, -1 = loss, 0 = tie. */
    fanfare(outcome: number) {
      if (!ctx || !sfx || ctx.state !== "running") return;
      const seq = outcome > 0 ? [D4, Fs4, A4, D5] : outcome < 0 ? [A4, G4, Eb4, D4] : [G4, G4];
      seq.forEach((f, i) => tone(sfx!, "triangle", f, ctx!.currentTime + i * 0.13, 0.1, i === seq.length - 1 ? 0.6 : 0.16));
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
