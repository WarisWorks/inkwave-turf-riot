import type { LevelId } from "./types";

export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Playable area shared by every level (walls sit just outside it). */
export const MAP = { minX: -30, minZ: -38, w: 60, d: 76 };

/**
 * Level building blocks. Boxes use a centre position (like the original harbor code).
 * `deco` pieces use a plain lit material so ground ink never tints them, and are not solid.
 */
export type Prim =
  | { t: "box"; x: number; y: number; z: number; w: number; h: number; d: number; c: number; deco?: boolean }
  | { t: "stairs"; x: number; z: number; dir: 1 | -1; w: number; h: number; run: number; steps: number; c: number }
  | { t: "palm"; x: number; z: number }
  | { t: "poplar"; x: number; z: number }
  | { t: "dome"; x: number; y: number; z: number; r: number; c: number }
  | { t: "peak"; x: number; z: number; r: number; h: number; c: number };

export type LevelDef = {
  id: LevelId;
  sky: number;
  fog: number;
  ground: number;
  wall: number;
  wallCap?: number;
  water: number;
  /** A full-width channel that can only be crossed at the listed [x, halfWidth] lanes. */
  channel?: { rect: Rect; crossings: [x: number, half: number][] };
  /** Ponds and fountains that bots walk around. */
  pools: Rect[];
  spawnO: [number, number][];
  spawnV: [number, number][];
  prims: Prim[];
};

export function waterRects(def: LevelDef): Rect[] {
  return def.channel ? [def.channel.rect, ...def.pools] : def.pools;
}

const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: number, deco = false): Prim => ({
  t: "box",
  x,
  y,
  z,
  w,
  h,
  d,
  c,
  deco,
});
const stairs = (x: number, z: number, dir: 1 | -1, w: number, h: number, run: number, steps: number, c: number): Prim => ({
  t: "stairs",
  x,
  z,
  dir,
  w,
  h,
  run,
  steps,
  c,
});
const palm = (x: number, z: number): Prim => ({ t: "palm", x, z });
const poplar = (x: number, z: number): Prim => ({ t: "poplar", x, z });

/** Maps are point-symmetric so both teams get the same layout: (x, z) → (−x, −z). */
function mirror(p: Prim): Prim {
  if (p.t === "stairs") return { ...p, x: -p.x, z: -p.z, dir: (p.dir * -1) as 1 | -1 };
  return { ...p, x: -p.x, z: -p.z };
}
const sym = (ps: Prim[]) => [...ps, ...ps.map(mirror)];
const flip = (spawns: [number, number][]) => spawns.map(([x, z]) => [-x, -z] as [number, number]);


/** Decorative Uyghur architectural vocabulary built from cheap primitives.
 * These stay mostly at the arena edges so silhouettes become culturally distinct
 * without closing important combat lanes.
 */
function uyghurGate(x: number, z: number, c = 0xd59a63, accent = 0x168f86): Prim[] {
  return [
    box(x - 2.8, 2.2, z, 1.1, 4.4, 1.2, c),
    box(x + 2.8, 2.2, z, 1.1, 4.4, 1.2, c),
    box(x, 4.15, z, 6.7, 0.7, 1.35, accent),
    box(x, 4.7, z, 7.2, 0.18, 1.55, 0xf0d29a, true),
    { t: "dome", x: x - 2.8, y: 4.4, z, r: 0.62, c: accent },
    { t: "dome", x: x + 2.8, y: 4.4, z, r: 0.62, c: accent },
  ];
}
function minaret(x: number, z: number, c = 0xc88954, accent = 0x168f86): Prim[] {
  return [
    box(x, 2.8, z, 2.1, 5.6, 2.1, c),
    box(x, 5.75, z, 2.7, 0.35, 2.7, accent),
    { t: "dome", x, y: 6.0, z, r: 1.18, c: accent },
    box(x, 7.0, z, 0.22, 1.7, 0.22, 0x6b4226, true),
  ];
}
function courtyardFacade(x: number, z: number, w = 10, c = 0xd29a67): Prim[] {
  const parts: Prim[] = [
    box(x, 1.8, z, w, 3.6, 1.1, c),
    box(x, 3.75, z, w + 0.5, 0.28, 1.35, 0x8d4f35, true),
  ];
  for (let i = -2; i <= 2; i++) {
    parts.push(box(x + i * (w / 6), 2.05, z - 0.62, 0.42, 1.35, 0.18, 0x245f73, true));
    parts.push({ t: "dome", x: x + i * (w / 6), y: 2.72, z: z - 0.68, r: 0.34, c: 0x245f73 });
  }
  return parts;
}
function grapeHouse(x: number, z: number): Prim[] {
  const parts: Prim[] = [
    box(x, 2.2, z, 7.5, 4.4, 6.5, 0xb87343),
    box(x, 4.55, z, 8.0, 0.28, 7.0, 0x8d5534, true),
  ];
  for (let ix = -2; ix <= 2; ix++) for (let iy = 0; iy < 3; iy++)
    parts.push(box(x + ix * 1.15, 1.1 + iy * 1.05, z - 3.32, 0.5, 0.42, 0.12, 0x633b29, true));
  return parts;
}

/* ── پورت · Harbor (the original map) ─────────────────────────────── */

const harborCrates: [number, number, number, number, number][] = [
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

const HARBOR: LevelDef = {
  id: "harbor",
  sky: 0x8fd4ff,
  fog: 0xcfe9ff,
  ground: 0xf0d2ae,
  wall: 0xf6ecdf,
  water: 0x1498b8,
  channel: {
    rect: { minX: -28.2, maxX: 28.2, minZ: -4.45, maxZ: 4.45 },
    crossings: [
      [-18, 2.8],
      [0, 3.8],
      [18, 2.8],
    ],
  },
  pools: [],
  spawnO: [
    [-20, -28],
    [-4, -31],
    [4, -30],
    [8, -27],
  ],
  spawnV: [
    [20, 23],
    [-4, 31],
    [4, 30],
    [-8, 28],
  ],
  prims: [
    // Even the harbor carries Uyghur old-town architecture around its perimeter.
    ...uyghurGate(0, -35, 0xd9a06c, 0x237d82),
    ...uyghurGate(0, 35, 0xd9a06c, 0x237d82),
    ...courtyardFacade(-22, -36, 10, 0xd5a171),
    ...courtyardFacade(22, 36, 10, 0xd5a171),
    box(-20, 1.15, -27, 14, 2.3, 14, 0xffd7b4),
    stairs(-20, -20, 1, 10, 2.3, 6.6, 4, 0xe7d3c0),
    box(20.5, 2.1, -25.5, 13, 4.2, 15, 0xffe3c8),
    box(20.5, 4.28, -25.5, 13.4, 0.28, 15.4, 0xff6a1a),
    box(0, 1.25, 0, 10, 2.5, 12, 0xc9d7e8),
    box(0, 2.72, 0, 10.4, 0.28, 12.3, 0xeef3f8),
    stairs(0, -6, -1, 10, 2.5, 6.4, 4, 0xd5deea),
    stairs(0, 6, 1, 10, 2.5, 6.4, 4, 0xd5deea),
    box(-18, 0.31, 0, 8, 0.62, 10, 0xd7a15e),
    box(18, 0.31, 0, 8, 0.62, 10, 0xd7a15e),
    box(20, 0.7, 23, 14, 1.4, 14, 0xd9e6ff),
    stairs(20, 16, -1, 10, 1.4, 5.6, 3, 0xc9d8ee),
    box(-20.5, 2, 25.5, 13, 4, 15, 0xd5e4ff),
    box(-20.5, 4.1, 25.5, 13.4, 0.26, 15.4, 0x5b4dff),
    ...harborCrates.map((c, i) => box(c[0], c[3] / 2, c[1], c[2], c[3], c[4], i % 2 === 0 ? 0xe0a15a : 0x7ec8e3)),
    box(-9.2, 0.38, 0.4, 2.4, 0.36, 1.1, 0xf2f5f8, true),
    box(9.4, 0.42, -0.6, 2.6, 0.4, 1.15, 0xfff1df, true),
    ...(
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
      ] as [number, number][]
    ).map(([x, z]) => palm(x, z)),
  ],
};

/* ── قەشقەر بازىرى · Kashgar Bazaar ───────────────────────────────── */

const TILE = 0x1f9e8f;
const BRICK = 0xd99a62;
const AWNINGS = [0xc8102e, TILE, 0xf2c230, 0x3a9a4a];

function stall(x: number, z: number, i: number): Prim[] {
  return [
    box(x, 0.55, z, 2.6, 1.1, 2.2, 0xa8683a),
    box(x - 0.6, 1.25, z, 0.7, 0.3, 0.7, 0xf2c230, true),
    box(x + 0.6, 1.25, z, 0.7, 0.3, 0.7, 0xc8102e, true),
    box(x, 2.45, z, 3.2, 0.12, 2.8, AWNINGS[i % AWNINGS.length], true),
  ];
}

const BAZAAR: LevelDef = {
  id: "bazaar",
  sky: 0x9ed8ff,
  fog: 0xf3e4cc,
  ground: 0xe6c497,
  wall: 0xc9784a,
  wallCap: TILE,
  water: 0x3fb6d9,
  pools: [{ minX: -3.2, maxX: 3.2, minZ: -3.2, maxZ: 3.2 }],
  spawnO: [
    [-8, -30],
    [-3, -32],
    [3, -31],
    [8, -29],
  ],
  spawnV: flip([
    [-8, -30],
    [-3, -32],
    [3, -31],
    [8, -29],
  ]),
  prims: [
    // Strong Kashgar silhouette: ceremonial gates, courtyard façades and edge minarets.
    ...uyghurGate(0, -34, 0xd59a63, TILE),
    ...uyghurGate(0, 34, 0xd59a63, TILE),
    ...courtyardFacade(-20, -36, 12, 0xd49a67),
    ...courtyardFacade(20, 36, 12, 0xd49a67),
    ...minaret(-27.5, -31, BRICK, TILE),
    ...minaret(27.5, 31, BRICK, TILE),
    // Central fountain: a tiled rim you have to hop over, and a domed spout.
    box(0, 0.45, -3.6, 8, 0.9, 0.8, TILE),
    box(0, 0.45, 3.6, 8, 0.9, 0.8, TILE),
    box(-3.6, 0.45, 0, 0.8, 0.9, 6.4, TILE),
    box(3.6, 0.45, 0, 0.8, 0.9, 6.4, TILE),
    box(0, 1.1, 0, 1, 2.2, 1, 0xf2e3c6),
    { t: "dome", x: 0, y: 2.2, z: 0, r: 0.75, c: TILE },
    ...sym([
      // Caravanserai rooftop: the high ground on each side.
      box(-19, 1.6, -14, 10, 3.2, 8, BRICK),
      box(-19, 3.28, -14, 10.4, 0.16, 8.4, TILE),
      stairs(-19, -10, 1, 6, 3.2, 5.6, 7, 0xe3b27e),
      // Domed tower.
      box(-26, 2.5, -2, 4, 5, 4, BRICK),
      { t: "dome", x: -26, y: 5, z: -2, r: 2, c: TILE },
      // Gate arch in front of each base.
      box(-4.5, 1.8, -20, 1, 3.6, 1, 0xf0d9a8),
      box(4.5, 1.8, -20, 1, 3.6, 1, 0xf0d9a8),
      box(0, 3.9, -20, 10, 0.6, 1.1, TILE),
      // Market stalls with striped awnings.
      ...stall(-11, -24, 0),
      ...stall(-11, -18, 1),
      ...stall(11, -24, 2),
      ...stall(11, -18, 3),
      ...stall(-6, -10, 1),
      ...stall(7, -11, 2),
      ...stall(15, -4, 0),
      // Spice sacks.
      box(-2, 0.45, -15, 1.3, 0.9, 1.3, 0xb5652b),
      box(3, 0.5, -16, 1.2, 1.0, 1.2, 0xe0b04a),
      box(-14, 0.5, -27, 1.4, 1.0, 1.4, 0xb5652b),
      box(17, 0.45, -28, 1.3, 0.9, 1.3, 0xe0b04a),
      box(-9, 0.55, -3, 1.4, 1.1, 1.4, 0xb5652b),
      poplar(-28.6, -24),
      poplar(-28.6, -12),
      poplar(28.6, -24),
      poplar(28.6, -12),
    ]),
  ],
};

/* ── تەكلىماكان ۋاھەسى · Taklamakan Oasis ────────────────────────── */

const SAND = [0xeac27f, 0xe4b873, 0xdcae68];
const RUIN = 0xc9955e;

const OASIS: LevelDef = {
  id: "oasis",
  sky: 0xa9dcff,
  fog: 0xf7dfae,
  ground: 0xf0cf8e,
  wall: 0xd4a86a,
  water: 0x2fb3a0,
  pools: [{ minX: -6, maxX: 6, minZ: -4, maxZ: 4 }],
  spawnO: [
    [-8, -30],
    [-3, -32],
    [3, -31],
    [7, -30],
  ],
  spawnV: flip([
    [-8, -30],
    [-3, -32],
    [3, -31],
    [7, -30],
  ]),
  prims: [
    // Oasis settlement: mud-brick gates and watchtowers frame the desert arena.
    ...uyghurGate(0, -34, 0xc9945c, 0x2b8c7f),
    ...uyghurGate(0, 34, 0xc9945c, 0x2b8c7f),
    ...courtyardFacade(-18, -36, 11, 0xc18a58),
    ...courtyardFacade(18, 36, 11, 0xc18a58),
    ...minaret(-27, 30, 0xb77d4d, 0x2b8c7f),
    ...minaret(27, -30, 0xb77d4d, 0x2b8c7f),
    ...sym([
      // Palms ringing the pond.
      palm(-8, -5.5),
      palm(7.5, -6),
      palm(0, -6.5),
      // Dunes: 0.45 m terraces you can walk straight up.
      box(-16, 0.225, -14, 12, 0.45, 9, SAND[0]),
      box(-16.5, 0.675, -14.3, 8.5, 0.45, 6.5, SAND[1]),
      box(-17, 1.125, -14.6, 5, 0.45, 4, SAND[2]),
      box(14, 0.225, -23, 10, 0.45, 7, SAND[0]),
      box(14.5, 0.675, -23.3, 6, 0.45, 4.5, SAND[1]),
      box(-22, 0.225, -3, 8, 0.45, 9, SAND[0]),
      box(-22.5, 0.675, -3.3, 5, 0.45, 5.5, SAND[1]),
      // Ruined fort with a stair up: the high ground.
      box(20, 1.4, -10, 8, 2.8, 7, RUIN),
      stairs(20, -6.5, 1, 5, 2.8, 4.2, 6, 0xbf8a55),
      // Broken mud-brick walls for cover.
      box(-6, 1.1, -14, 6, 2.2, 1.2, RUIN),
      box(-9, 0.8, -7, 1.2, 1.6, 4, 0xbf8a55),
      box(6, 2, -15, 3, 4, 3, 0xbf8a55),
      box(4, 0.6, -18, 5, 1.2, 1, RUIN),
      // Watchtower in the corner.
      box(-27, 3, -34, 3, 6, 3, RUIN),
      poplar(-28.6, -24),
      poplar(-28.6, -12),
      poplar(28.6, -24),
      poplar(28.6, -6),
    ]),
  ],
};

/* ── تۇرپان ئۈزۈمزارلىقى · Turpan Vineyard ────────────────────────── */

const VINE = 0x3f8f3a;
const LEAF = 0x5fae4a;
const GRAPE = 0x9fd35a;

function trellis(x: number): Prim[] {
  return [
    box(x, 0.8, -16, 0.7, 1.6, 12, VINE),
    box(x, 2.2, -16, 2.4, 0.14, 12.4, LEAF, true),
    box(x, 1.95, -20, 0.5, 0.4, 0.5, GRAPE, true),
    box(x, 1.95, -16, 0.5, 0.4, 0.5, GRAPE, true),
    box(x, 1.95, -12, 0.5, 0.4, 0.5, GRAPE, true),
  ];
}

const peaks: Prim[] = (
  [
    [-62, 60, 10, 12],
    [-46, 64, 12, 16],
    [-30, 57, 9, 11],
    [-14, 65, 13, 18],
    [2, 58, 10, 13],
    [18, 64, 12, 17],
    [34, 57, 9, 12],
    [50, 62, 11, 15],
    [-38, 74, 14, 20],
    [26, 76, 15, 21],
  ] as [number, number, number, number][]
).map(([x, z, r, h], i) => ({ t: "peak", x, z, r, h, c: [0xc9462c, 0xb23a22, 0xd9582f][i % 3] }));

const VINEYARD: LevelDef = {
  id: "vineyard",
  sky: 0x92d3ff,
  fog: 0xe6e0cf,
  ground: 0xdcbc8c,
  wall: 0xc98b5a,
  wallCap: 0xa85a32,
  water: 0x2a8fb0,
  channel: {
    rect: { minX: -28.2, maxX: 28.2, minZ: -2.2, maxZ: 2.2 },
    crossings: [
      [-20, 1.3],
      [-10, 1.3],
      [0, 2.8],
      [10, 1.3],
      [20, 1.3],
    ],
  },
  pools: [],
  spawnO: [
    [-8, -30],
    [-3, -32],
    [3, -31],
    [8, -29],
  ],
  spawnV: flip([
    [-8, -30],
    [-3, -32],
    [3, -31],
    [8, -29],
  ]),
  prims: [
    // Turpan skyline: grape-drying houses and traditional courtyard entrances.
    ...grapeHouse(-24, -31),
    ...grapeHouse(24, 31),
    ...grapeHouse(24, -31),
    ...grapeHouse(-24, 31),
    ...uyghurGate(0, -34, 0xb87343, 0x8f5b37),
    ...uyghurGate(0, 34, 0xb87343, 0x8f5b37),
    // Footbridges over the karez, and a two-step supa pavilion in the middle.
    ...[-20, -10, 10, 20].map((x) => box(x, 0.225, 0, 4, 0.45, 5.8, 0x9b6b43)),
    box(0, 0.225, 0, 9, 0.45, 7.4, 0x8a5530),
    box(0, 0.675, 0, 7, 0.45, 5.4, 0xa0643a),
    box(0, 3.2, 0, 7.6, 0.16, 6, VINE, true),
    box(-3.5, 1.9, -2.7, 0.2, 2.6, 0.2, 0x6b4226, true),
    box(3.5, 1.9, -2.7, 0.2, 2.6, 0.2, 0x6b4226, true),
    box(-3.5, 1.9, 2.7, 0.2, 2.6, 0.2, 0x6b4226, true),
    box(3.5, 1.9, 2.7, 0.2, 2.6, 0.2, 0x6b4226, true),
    box(-1.5, 2.9, 0, 0.5, 0.45, 0.5, GRAPE, true),
    box(1.6, 2.9, 1, 0.5, 0.45, 0.5, GRAPE, true),
    ...peaks,
    ...sym([
      // Grape trellis rows make long lanes toward the canal.
      ...trellis(-18),
      ...trellis(-12),
      ...trellis(12),
      ...trellis(18),
      // Brick grape-drying house with a lattice face and a stair to the roof.
      box(22, 1.6, -28, 8, 3.2, 7, 0xb5703f),
      stairs(22, -24.5, 1, 5, 3.2, 5.6, 7, 0xa8653a),
      ...[-31, -29.8, -28.6, -27.4, -26.2].map((z) => box(17.95, 1.6, z, 0.1, 2.6, 0.35, 0x7a4526, true)),
      // Low vine hedges and pots near the canal.
      box(-5, 0.6, -8, 3, 1.2, 0.7, VINE),
      box(6, 0.6, -13, 0.7, 1.2, 3, VINE),
      box(-24, 0.5, -10, 1.2, 1.0, 1.2, 0xb5652b),
      box(4, 0.5, -27, 1.3, 1.0, 1.3, 0xe0a15a),
      poplar(-28.6, -24),
      poplar(-28.6, -12),
      poplar(28.6, -12),
      poplar(28.6, -6),
    ]),
  ],
};

export const LEVEL_DEFS: Record<LevelId, LevelDef> = {
  harbor: HARBOR,
  bazaar: BAZAAR,
  oasis: OASIS,
  vineyard: VINEYARD,
};
