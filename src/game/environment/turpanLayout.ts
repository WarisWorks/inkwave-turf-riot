/** Shared visual/collision positions for the eight playable grape rows. */
export const TURPAN_VINE_ROWS = [-18, -12, 12, 18].flatMap((x) => [
  { x, z: -16, length: 12 },
  { x: -x, z: 16, length: 12 },
]);

/** The supplied compound sits beyond the west boundary, clear of every combat lane. */
export const TURPAN_LANDMARK = { x: -47, z: 3, height: 22, rotation: Math.PI / 2 };
