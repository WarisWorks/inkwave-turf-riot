import type { CharacterId } from "../types";

export type CharacterAssetId = "cute" | "boy" | "athlete" | "girl" | "dress";
type Point = readonly [number, number, number];
export type ArmProfile = { shoulder: Point; elbow: Point; wrist: Point; radius: number };
type LegProfile = { hip: Point; knee: Point; ankle: Point };
export type CharacterProfile = {
  neck: number; hip: number; legX: number; skirt: boolean;
  left: ArmProfile; right: ArmProfile;
  legs?: readonly [LegProfile, LegProfile];
  armTop?: number;
  armTorsoSlope?: number;
  armFalloff?: boolean;
  retainArmPose?: boolean;
};
// Normalized anatomical guides for the actual supplied poses, before scaling to game height.
export const CHARACTER_PROFILES: Record<CharacterAssetId, CharacterProfile> = {
  cute: {
    neck: 0.64, hip: 0.35, legX: 0.065, skirt: false, armTop: 0.615, armTorsoSlope: 0.4, armFalloff: true, retainArmPose: true,
    left: { shoulder: [-0.115, 0.60, 0.015], elbow: [-0.205, 0.49, -0.025], wrist: [-0.258, 0.37, -0.027], radius: 0.075 },
    right: { shoulder: [0.115, 0.60, 0.03], elbow: [0.215, 0.485, 0.035], wrist: [0.258, 0.54, 0.14], radius: 0.075 },
    // The supplied walking pose crosses the legs. Follow each limb in 3D
    // instead of assigning its vertices by the sign of X.
    legs: [
      { hip: [-0.065, 0.35, 0.015], knee: [-0.02, 0.20, 0.095], ankle: [0.055, 0.05, 0.21] },
      { hip: [0.065, 0.35, -0.01], knee: [0.04, 0.18, -0.07], ankle: [-0.03, 0.07, -0.19] },
    ],
  },
  boy: {
    neck: 0.61, hip: 0.31, legX: 0.095, skirt: false,
    left: { shoulder: [-0.14, 0.60, 0], elbow: [-0.235, 0.66, 0.015], wrist: [-0.18, 0.85, 0.08], radius: 0.095 },
    right: { shoulder: [0.145, 0.59, 0], elbow: [0.205, 0.44, 0.015], wrist: [0.23, 0.33, 0.055], radius: 0.09 },
  },
  athlete: {
    neck: 0.78, hip: 0.45, legX: 0.072, skirt: false,
    left: { shoulder: [-0.105, 0.74, 0], elbow: [-0.245, 0.72, 0], wrist: [-0.35, 0.77, 0.005], radius: 0.075 },
    right: { shoulder: [0.105, 0.74, 0], elbow: [0.245, 0.72, 0], wrist: [0.35, 0.77, 0.005], radius: 0.075 },
  },
  girl: {
    neck: 0.75, hip: 0.36, legX: 0.055, skirt: true,
    left: { shoulder: [-0.085, 0.72, 0], elbow: [-0.13, 0.53, 0], wrist: [-0.16, 0.37, 0.015], radius: 0.06 },
    right: { shoulder: [0.085, 0.72, 0], elbow: [0.13, 0.53, 0], wrist: [0.16, 0.37, 0.015], radius: 0.06 },
  },
  dress: {
    neck: 0.76, hip: 0.35, legX: 0.055, skirt: true,
    left: { shoulder: [-0.09, 0.70, 0], elbow: [-0.14, 0.58, 0.015], wrist: [-0.06, 0.57, 0.14], radius: 0.07 },
    right: { shoulder: [0.10, 0.70, 0], elbow: [0.15, 0.53, 0.01], wrist: [0.19, 0.39, 0.02], radius: 0.06 },
  },
};
export const CHARACTER_ASSETS: Record<CharacterId, CharacterAssetId> = {
  wave: "cute", doppa: "athlete", braids: "girl", telpek: "athlete", scarf: "dress", dutar: "boy",
};
