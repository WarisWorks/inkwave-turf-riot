import type { LevelId } from "./types";
import { URUMQI_PRIMS } from "./environment/urumqiLayout";
import { KASHGAR_PRIMS } from "./environment/kashgarLayout";
import { TURPAN_VINE_ROWS } from "./environment/turpanLayout";
import { OASIS_TERRACES, OASIS_FORTS } from "./environment/oasisLayout";

export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Playable area shared by every level (walls sit just outside it). */
export const MAP = { minX: -30, minZ: -38, w: 60, d: 76 };

/** Zone mode: the central rectangle both teams fight to hold. Snapped to the 0.5 m paint grid. */
export const ZONE: Rect = { minX: -13.5, maxX: 13.5, minZ: -12.5, maxZ: 12.5 };

/**
 * Level building blocks. Boxes use a centre position.
 * `deco` pieces use a plain lit material so ground ink never tints them, and are not solid.
 */
export type Prim =
  | { t: "box"; x: number; y: number; z: number; w: number; h: number; d: number; c: number; deco?: boolean; collisionOnly?: boolean; paintable?: boolean }
  | { t: "stairs"; x: number; z: number; dir: 1 | -1; w: number; h: number; run: number; steps: number; c: number; base?: number }
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

/* ── ئۈرۈمچى · Urumqi bazaar square ─────────────────────────────── */
const URUMQI: LevelDef = {
  id: "urumqi",
  sky: 0xb7d7e7, fog: 0xd4d4c8, ground: 0xd6cbb6,
  wall: 0xbda17f, wallCap: 0x37878b, water: 0x48a5b1,
  pools: [],
  spawnO: [[-8, -34], [-4, -32], [0, -34], [4, -32], [8, -34], [0, -36]],
  spawnV: flip([[-8, -34], [-4, -32], [0, -34], [4, -32], [8, -34], [0, -36]]),
  prims: URUMQI_PRIMS,
};

/* ── قەشقەر بازىرى · Kashgar Bazaar ───────────────────────────────── */

const BAZAAR: LevelDef = {
  id: "bazaar",
  sky: 0xb7d5dc,
  fog: 0xe3cbb0,
  ground: 0xd2bc99,
  wall: 0xc4946c,
  wallCap: 0x278c91,
  water: 0x42afbd,
  pools: [{ minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 }],
  spawnO: [[-8, -32], [-4, -34], [0, -32], [4, -34], [8, -32], [0, -36]],
  spawnV: flip([[-8, -32], [-4, -34], [0, -32], [4, -34], [8, -32], [0, -36]]),
  prims: KASHGAR_PRIMS,
};

/* ── تەكلىماكان ۋاھەسى · Taklamakan Oasis ────────────────────────── */

const RUIN = 0xc9955e;

const OASIS: LevelDef = {
  id: "oasis",
  sky: 0xc8d9dc,
  fog: 0xf0d6ad,
  ground: 0xe6c58c,
  wall: 0xcba16a,
  water: 0x36a6a1,
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
    ...OASIS_TERRACES.map((t) => box(t.x, t.y, t.z, t.w, t.h, t.d, t.color)),
    ...OASIS_FORTS.flatMap(({ x, z }) => [-1, 1].flatMap((side) => [-1, 1].map((end): Prim => ({
      t: "box", x: x + side * 3.3, y: 3.115, z: z + end * 2.9,
      w: 0.95, h: 0.63, d: 0.95, c: RUIN, collisionOnly: true,
    })))),
    ...sym([
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
    ]),
  ],
};

/* ── تۇرپان ئۈزۈمزارلىقى · Turpan Vineyard ────────────────────────── */

const VINE = 0x3f8f3a;

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
    ...TURPAN_VINE_ROWS.map(({ x, z, length }) => box(x, 0.35, z, 0.8, 0.7, length, 0x926b45)),
    ...peaks,
    ...sym([
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
  urumqi: URUMQI,
  bazaar: BAZAAR,
  oasis: OASIS,
  vineyard: VINEYARD,
};
