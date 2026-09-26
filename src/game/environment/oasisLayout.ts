/** The original climbable terraces, shared by collision and desert detailing. */
const northTerraces = [
  { x: -16, y: 0.225, z: -14, w: 12, h: 0.45, d: 9, color: 0xeac27f },
  { x: -16.5, y: 0.675, z: -14.3, w: 8.5, h: 0.45, d: 6.5, color: 0xe4b873 },
  { x: -17, y: 1.125, z: -14.6, w: 5, h: 0.45, d: 4, color: 0xdcae68 },
  { x: 14, y: 0.225, z: -23, w: 10, h: 0.45, d: 7, color: 0xeac27f },
  { x: 14.5, y: 0.675, z: -23.3, w: 6, h: 0.45, d: 4.5, color: 0xe4b873 },
  { x: -22, y: 0.225, z: -3, w: 8, h: 0.45, d: 9, color: 0xeac27f },
  { x: -22.5, y: 0.675, z: -3.3, w: 5, h: 0.45, d: 5.5, color: 0xe4b873 },
];
export const OASIS_TERRACES = [...northTerraces, ...northTerraces.map((p) => ({ ...p, x: -p.x, z: -p.z }))];
export const OASIS_FORTS = [{ x: 20, z: -10, facing: 1 }, { x: -20, z: 10, facing: -1 }];
export const OASIS_PALMS = [
  { x: -8, z: -5.5, h: 6.2 }, { x: 7.5, z: -6, h: 7.1 }, { x: 0, z: -6.5, h: 5.5 },
  { x: 8, z: 5.5, h: 6.2 }, { x: -7.5, z: 6, h: 7.1 }, { x: 0, z: 6.5, h: 5.5 },
  { x: -28, z: -22, h: 7.5 }, { x: 28, z: 22, h: 7.5 },
  { x: 27.5, z: -16, h: 6.4 }, { x: -27.5, z: 16, h: 6.4 },
];
