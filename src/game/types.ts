export type WeaponId = "spritzer" | "roller" | "charger" | "blaster";
export type SubId = "pop-bomb" | "ink-beacon";
export type SpecialId = "tempest" | "reef-rush";
export type Quality = "low" | "high";

export type InputState = {
  ax: number;
  ay: number;
  fire: boolean;
  jump: boolean;
  swim: boolean;
  bomb: boolean;
  special: boolean;
  lookX: number;
  lookY: number;
};

export type LiveConfig = {
  name: string;
  weapon: WeaponId;
  sub: SubId;
  special: SpecialId;
  sens: number;
  volume: number;
  invertY: boolean;
  quality: Quality;
  input: InputState;
};

export type FeedLine = { id: number; text: string };

export type MatchResult = {
  winner: "orange" | "violet" | "tie";
  orange: number;
  blue: number;
  splats: number;
  deaths: number;
};

export type HudSnap = {
  phase: "menu" | "countdown" | "live" | "ended";
  paused: boolean;
  time: number;
  orange: number;
  blue: number;
  ink: number;
  special: number;
  splat: number;
  swimming: boolean;
  charging: number;
  weapon: WeaponId;
  sub: SubId;
  specialId: SpecialId;
  respawn: number;
  countdown: number;
  locked: boolean;
  feed: FeedLine[];
  banner: string;
  result: MatchResult | null;
  rush: number;
};

export type WeaponInfo = {
  id: WeaponId;
  name: string;
  kind: string;
  blurb: string;
  range: number;
  damage: number;
  fire: number;
  mobility: number;
  cover: number;
};

export const WEAPONS: WeaponInfo[] = [
  {
    id: "spritzer",
    name: "Spritzer",
    kind: "Shooter",
    blurb: "A steady stream. Balanced range, ink, and fight.",
    range: 0.62,
    damage: 0.55,
    fire: 0.88,
    mobility: 0.74,
    cover: 0.58,
  },
  {
    id: "roller",
    name: "Swell Roller",
    kind: "Roller",
    blurb: "Push a wide wave, then flick it off a jump.",
    range: 0.38,
    damage: 0.72,
    fire: 0.42,
    mobility: 0.56,
    cover: 0.96,
  },
  {
    id: "charger",
    name: "Flint Charger",
    kind: "Charger",
    blurb: "Hold to charge. A full release cuts a long line.",
    range: 0.96,
    damage: 0.98,
    fire: 0.26,
    mobility: 0.5,
    cover: 0.4,
  },
  {
    id: "blaster",
    name: "Popper Blaster",
    kind: "Blaster",
    blurb: "Lob a burst that pops and soaks a wide patch.",
    range: 0.7,
    damage: 0.8,
    fire: 0.4,
    mobility: 0.62,
    cover: 0.76,
  },
];

export const SUBS: { id: SubId; name: string; blurb: string }[] = [
  { id: "pop-bomb", name: "Pop Bomb", blurb: "Arc a bomb that bursts into a thick puddle." },
  { id: "ink-beacon", name: "Ink Beacon", blurb: "Plant a sprinkler that paints around itself." },
];

export const SPECIALS: { id: SpecialId; name: string; blurb: string }[] = [
  { id: "tempest", name: "Ink Tempest", blurb: "A rain cloud soaks a big circle of turf." },
  { id: "reef-rush", name: "Reef Rush", blurb: "Sprint anywhere and leave a painted wake." },
];

export function weaponById(id: WeaponId): WeaponInfo {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}
