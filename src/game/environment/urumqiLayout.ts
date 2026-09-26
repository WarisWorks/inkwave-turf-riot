import type { Prim } from "../levels";

/** User-supplied bazaar facades; dimensions are the prepared meshes' proportions. */
export const URUMQI_ASSETS = [
  { id: 1, size: [0.56054676, 0.63049316, 0.98361206] },
  { id: 2, size: [0.53872672, 0.65386957, 0.99932861] },
  { id: 3, size: [0.29191594, 0.83261108, 0.98031616] },
  { id: 4, size: [0.50521851, 0.39898682, 0.99856567] },
  { id: 5, size: [0.70883179, 0.60253906, 0.99822998] },
] as const;

export const URUMQI_BUILDINGS = [
  { asset: 1, x: -23, z: -24, span: 17, rotation: 0 },
  { asset: 2, x: 23, z: 24, span: 17, rotation: Math.PI },
  { asset: 4, x: 23, z: -24, span: 17, rotation: Math.PI },
  { asset: 5, x: -23, z: 24, span: 17, rotation: 0 },
  { asset: 3, x: 0, z: 0, span: 11, rotation: Math.PI / 2 },
].map((b) => {
  const { size } = URUMQI_ASSETS.find((a) => a.id === b.asset)!;
  const scale = b.span / Math.max(size[0], size[2]);
  const turned = Math.abs(Math.sin(b.rotation)) > 0.5;
  return { ...b, y: 0.35, w: size[turned ? 2 : 0] * scale, d: size[turned ? 0 : 2] * scale, h: size[1] * scale };
});

export const URUMQI_STALLS = [[-9, -18], [9, 18], [9, -10], [-9, 10]] as const;
export const URUMQI_PLANTERS = [[-11, -28], [11, 28], [11, -28], [-11, 28], [-25, -8], [25, 8], [-25, 8], [25, -8]] as const;
const box = (x: number, y: number, z: number, w: number, h: number, d: number, c = 0xd7c3a4): Extract<Prim, { t: "box" }> => ({ t: "box", x, y, z, w, h, d, c });

/** The tower has a low market base and a separate tall shaft, so shots can pass above its stalls. */
export function urumqiBuildingVolumes(b: typeof URUMQI_BUILDINGS[number]) {
  const parts = b.asset === 3 ? [
    box(b.x, b.y + 0.425, b.z, b.w, 0.85, b.d),
    box(b.x + 0.72, b.y + b.h / 2, b.z + 0.61, 2.06, b.h, 2.06),
    box(b.x - 4.4, b.y + 1.36, b.z + 0.7, 2.2, 2.72, 1.8),
  ] : [box(b.x, b.y + b.h / 2, b.z, b.w, b.h, b.d)];
  return parts.map(p => ({ ...p, collisionOnly: true }));
}

export const URUMQI_PRIMS: Prim[] = [
  ...URUMQI_BUILDINGS.flatMap((b): Prim[] => [
    box(b.x, 0.175, b.z, b.w + 0.5, 0.35, b.d + 0.5, 0xbc9c78),
    // Closed architectural props use explicit envelopes, never triangle collision.
    ...urumqiBuildingVolumes(b),
  ]),
  // Two raised promenades, with 40 cm stairs at both ends.
  ...[-1, 1].flatMap((side): Prim[] => [
    box(side * 19, 1.2, 0, 10, 2.4, 12, 0xd8c4a4),
    { t: "stairs", x: side * 19, z: -6, dir: -1, w: 6, h: 2.4, run: 6, steps: 6, c: 0xe1ceb0 },
    { t: "stairs", x: side * 19, z: 6, dir: 1, w: 6, h: 2.4, run: 6, steps: 6, c: 0xe1ceb0 },
    box(side * 22.7, 2.95, 0, 1.6, 1.1, 4.4, 0x388b8d),
    box(side * 6, 0.55, -side * 25, 3.4, 1.1, 1.3, 0x328a90),
    box(side * 7.5, 0.55, side * 5, 2.6, 1.1, 1.4, 0xbb8356),
  ]),
  ...URUMQI_STALLS.map(([x, z]) => box(x, 0.6, z, 3, 1.2, 1.7, 0xac714b)),
  ...URUMQI_PLANTERS.map(([x, z]) => box(x, 0.45, z, 1.8, 0.9, 2.6, 0xa4b5aa)),
];
