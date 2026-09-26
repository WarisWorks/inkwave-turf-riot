import type { Prim } from "../levels";
import type { CollisionBox } from "./environmentTypes";

export function boxBounds(x: number, y: number, z: number, w: number, h: number, d: number): CollisionBox {
  return { minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

/** The same stair dimensions drive rendering, physics, route generation and tests. */
export function stairBoxes(p: Extract<Prim, { t: "stairs" }>): CollisionBox[] {
  const depth = p.run / p.steps;
  return Array.from({ length: p.steps }, (_, i) => {
    const h = p.h * (p.steps - i) / p.steps;
    return boxBounds(p.x, (p.base ?? 0) + h / 2, p.z + p.dir * depth * (i + 0.5), p.w, h, depth);
  });
}

export function levelColliders(prims: Prim[]): CollisionBox[] {
  return prims.flatMap((p) => p.t === "box" && !p.deco ? [boxBounds(p.x, p.y, p.z, p.w, p.h, p.d)] : p.t === "stairs" ? stairBoxes(p) : []);
}

/** A conservative XZ broad phase for movement/height queries. No triangle collision. */
export class CollisionIndex {
  private cells = new Map<string, CollisionBox[]>();
  rebuild(boxes: CollisionBox[]) {
    this.cells.clear();
    for (const b of boxes) for (let x = Math.floor((b.minX - 0.6) / 6); x <= Math.floor((b.maxX + 0.6) / 6); x++)
      for (let z = Math.floor((b.minZ - 0.6) / 6); z <= Math.floor((b.maxZ + 0.6) / 6); z++) {
        const key = `${x}:${z}`;
        const list = this.cells.get(key) ?? [];
        list.push(b); this.cells.set(key, list);
      }
  }
  at(x: number, z: number): readonly CollisionBox[] { return this.cells.get(`${Math.floor(x / 6)}:${Math.floor(z / 6)}`) ?? []; }
}
