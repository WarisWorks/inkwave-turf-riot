import type { Quality, SpecialId, SubId, WeaponId } from "./types";

export type SaveData = {
  version: 1;
  name: string;
  weapon: WeaponId;
  sub: SubId;
  special: SpecialId;
  wins: number;
  matches: number;
  splats: number;
  sens: number;
  volume: number;
  invertY: boolean;
  quality: Quality;
};

const KEY = "inkwave-turf-riot-v1";

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  name: "Waris",
  weapon: "spritzer",
  sub: "pop-bomb",
  special: "tempest",
  wins: 0,
  matches: 0,
  splats: 0,
  sens: 1,
  volume: 0.7,
  invertY: false,
  quality: "high",
};

export function rankTitle(wins: number): string {
  if (wins >= 15) return "Wave Legend";
  if (wins >= 8) return "Reef Captain";
  if (wins >= 3) return "Tide Runner";
  return "Fresh Recruit";
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return { ...DEFAULT_SAVE };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return { ...DEFAULT_SAVE };
    return { ...DEFAULT_SAVE, ...parsed, version: 1 };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(data: SaveData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}
