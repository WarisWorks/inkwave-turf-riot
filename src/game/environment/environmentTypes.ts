/** Metres, Y up. Visual geometry is never queried by gameplay. */
export type CollisionBox = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
export type BuildingPlacement = {
  id: string;
  style: "merchant" | "courtyard" | "terrace" | "lookout";
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rotation?: number;
};
