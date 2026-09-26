import type { Prim } from "../levels";
import type { BuildingPlacement } from "./environmentTypes";

const ADOBE = 0xd2a074;
const TILE = 0x268c91;
const box = (x: number, y: number, z: number, w: number, h: number, d: number, c = ADOBE, invisible = false): Prim =>
  ({ t: "box", x, y, z, w, h, d, c, collisionOnly: invisible });

const north: BuildingPlacement[] = [
  { id: "west-courtyard", style: "merchant", x: -22, z: -29, w: 10, d: 12, h: 4 },
  { id: "east-courtyard", style: "courtyard", x: 22, z: -29, w: 10, d: 12, h: 4 },
  { id: "caravanserai", style: "merchant", x: -17, z: -13, w: 10, d: 10, h: 4 },
  { id: "weavers", style: "merchant", x: 18, z: -15, w: 10, d: 10, h: 4 },
  { id: "tea-terrace", style: "terrace", x: -7, z: -18, w: 6, d: 8, h: 2 },
  { id: "lookout", style: "lookout", x: -22, z: 2, w: 10, d: 10, h: 6.4 },
];

export const KASHGAR_BUILDINGS: BuildingPlacement[] = [
  ...north,
  ...north.map((b) => ({ ...b, id: `${b.id}-south`, x: -b.x, z: -b.z, rotation: Math.PI })),
];

export const KASHGAR_STALLS = [
  [-7, -8], [7, -15], [8, -5], [-13, 3],
  [7, 8], [-7, 15], [-8, 5], [13, -3],
] as const;

const side: Prim[] = [
  // Ten 40 cm steps: walkable without jumping, from the street to the roofs.
  { t: "stairs", x: -14.5, z: -18, dir: -1, w: 3, h: 4, run: 8, steps: 10, c: 0xdcb88a },
  { t: "stairs", x: 14.5, z: -20, dir: -1, w: 3, h: 4, run: 8, steps: 10, c: 0xdcb88a },
  { t: "stairs", x: -7, z: -22, dir: -1, w: 3, h: 2, run: 4, steps: 5, c: 0xdcb88a },
  // These decks leave a full street-height passage underneath.
  box(-20, 3.84, -20.5, 3.4, 0.32, 5, 0x966847),
  box(20, 3.84, -21.5, 3.4, 0.32, 3, 0x966847),
  box(-20, 3.84, -5.5, 3.4, 0.32, 5, 0x966847),
  { t: "stairs", x: -20, z: -3, dir: -1, w: 3.4, h: 2.4, base: 4, run: 5, steps: 6, c: 0xdcb88a },
  // A courtyard gate with separate jambs and lintel; the opening is actually passable.
  box(-4.5, 2.2, -27, 1.2, 4.4, 1.4),
  box(4.5, 2.2, -27, 1.2, 4.4, 1.4),
  box(0, 4.15, -27, 7.8, 0.5, 1.4, TILE),
  // Low fountain rim, cover and a clear route around each side.
  box(0, 0.3, -2.9, 6.6, 0.6, 0.65, TILE),
  box(-2.9, 0.3, 0, 0.65, 0.6, 5.2, TILE),
];

export const KASHGAR_PRIMS: Prim[] = [
  ...KASHGAR_BUILDINGS.flatMap((b) => [
    box(b.x, b.h / 2, b.z, b.w, b.h, b.d, ADOBE, true),
    // Thin authored roofs align the visual play surface exactly with the collision top.
    { t: "box" as const, x: b.x, y: b.h - 0.08, z: b.z, w: b.w, h: 0.16, d: b.d, c: 0xe5c396, deco: true, paintable: true },
    ...[-1, 1].flatMap((side) => [-1, 1].map((end) => box(b.x + side * (b.w / 2 - 0.8), b.h + 0.28, b.z + end * (b.d / 2 - 0.16), 1.6, 0.56, 0.32, 0xe4c79f, true))),
  ]),
  ...side,
  ...side.map((p): Prim => p.t === "stairs" ? { ...p, x: -p.x, z: -p.z, dir: p.dir === 1 ? -1 : 1 } : { ...p, x: -p.x, z: -p.z }),
  ...KASHGAR_STALLS.map(([x, z]) => box(x, 0.55, z, 2.6, 1.1, 1.7, 0x94613e)),
  box(0, 0.45, 0, 1.2, 0.9, 1.2, 0xede0bf),
];

/** Landmarks for route QA and future authoring tools; all four tiers are connected. */
export const KASHGAR_ROUTE_POINTS = [
  { name: "spawn courtyard", x: 0.5, y: 0, z: -32.5 },
  { name: "old-city street", x: -11.5, y: 0, z: -29.5 },
  { name: "tea terrace", x: -7.5, y: 2, z: -18.5 },
  { name: "caravanserai roof", x: -17.5, y: 4, z: -13.5 },
  { name: "courtyard roof", x: -22.5, y: 4, z: -29.5 },
  { name: "high lookout", x: -22.5, y: 6.4, z: 2.5 },
  { name: "market street", x: 4.5, y: 0, z: -4.5 },
  { name: "enemy courtyard", x: -0.5, y: 0, z: 32.5 },
];
