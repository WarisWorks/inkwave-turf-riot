export type WeaponId = "spritzer" | "roller" | "charger" | "blaster";
export type SubId = "pop-bomb" | "ink-beacon";
export type SpecialId = "tempest" | "reef-rush";
export type Quality = "low" | "high";
export type Difficulty = "easy" | "normal" | "hard";
export type LevelId = "harbor" | "bazaar" | "oasis" | "vineyard";
export type CharacterId = "wave" | "doppa" | "braids" | "telpek" | "scarf" | "dutar";

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
  difficulty: Difficulty;
  level: LevelId;
  character: CharacterId;
  input: InputState;
};

export type FeedLine = { id: number; text: string };

export type BoardRow = {
  name: string;
  team: "orange" | "violet";
  weapon: WeaponId;
  points: number;
  splats: number;
  deaths: number;
  isPlayer: boolean;
  alive: boolean;
};

export type MatchResult = {
  winner: "orange" | "violet" | "tie";
  orange: number;
  blue: number;
  splats: number;
  deaths: number;
  points: number;
  board: BoardRow[];
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
  /** 0–1, fades after the player lands a hit. */
  hit: number;
  /** 0–1, fades after the player splats someone. */
  kill: number;
  board: BoardRow[];
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
    name: "پۈركۈگۈچ",
    kind: "ئاتقۇچ",
    blurb: "تۇراقلىق سىياھ ئېقىمى. ئارىلىق، سىياھ ۋە جەڭ كۈچى تەڭپۇڭ.",
    range: 0.62,
    damage: 0.55,
    fire: 0.88,
    mobility: 0.74,
    cover: 0.58,
  },
  {
    id: "roller",
    name: "دولقۇن دومىلاتقۇچ",
    kind: "دومىلاتقۇچ",
    blurb: "كەڭ دولقۇننى ئالدىغا ئىتتىرىڭ، ئاندىن سەكرەپ تۇرۇپ چاچرىتىڭ.",
    range: 0.38,
    damage: 0.72,
    fire: 0.42,
    mobility: 0.56,
    cover: 0.96,
  },
  {
    id: "charger",
    name: "چاقماق نىشانچى",
    kind: "توپلىغۇچ",
    blurb: "بېسىپ تۇرۇپ كۈچ توپلاڭ. تولۇق قويۇۋەتسىڭىز ئۇزۇن بىر سىزىق كېسىپ ئۆتىدۇ.",
    range: 0.96,
    damage: 0.98,
    fire: 0.26,
    mobility: 0.5,
    cover: 0.4,
  },
  {
    id: "blaster",
    name: "پاقىلداق",
    kind: "پارتلاتقۇچ",
    blurb: "ئېگىز ئېتىلىپ پارتلايدىغان توپ — كەڭ دائىرىنى سىياھقا چىلايدۇ.",
    range: 0.7,
    damage: 0.8,
    fire: 0.4,
    mobility: 0.62,
    cover: 0.76,
  },
];

export const SUBS: { id: SubId; name: string; blurb: string }[] = [
  { id: "pop-bomb", name: "سىياھ بومبىسى", blurb: "بومبىنى ئەگمە ئېتىڭ — ئۇ قويۇق سىياھ كۆلچىكىگە ئايلىنىدۇ." },
  { id: "ink-beacon", name: "سىياھ مايىكى", blurb: "ئەتراپىنى ئۆزلۈكىدىن بويايدىغان چاچقۇچنى ئورنىتىڭ." },
];

export const SPECIALS: { id: SpecialId; name: string; blurb: string }[] = [
  { id: "tempest", name: "سىياھ بورىنى", blurb: "يامغۇر بۇلۇتى چوڭ بىر دائىرە زېمىننى سىياھقا چىلايدۇ." },
  { id: "reef-rush", name: "مەرجان يۈگۈرۈشى", blurb: "خالىغان يەرگە ئۇچقاندەك يۈگۈرۈپ، ئارقىڭىزدا بويالغان ئىز قالدۇرۇڭ." },
];

export const LEVELS: { id: LevelId; name: string; blurb: string }[] = [
  { id: "harbor", name: "پورت", blurb: "ئوتتۇرىدىن سۇ ئۆتىدۇ — ئىككى پىرىستان ياكى مەركىزى سۇپا ئارقىلىق ئۆتۈڭ." },
  { id: "bazaar", name: "قەشقەر بازىرى", blurb: "دۇكانلار، دەرۋازىلار ۋە ئوتتۇرىدىكى فونتان — يېقىن ئارىلىقتىكى قىزغىن جەڭ." },
  { id: "oasis", name: "تەكلىماكان ۋاھەسى", blurb: "قۇم دۆڭلىرى، قەدىمىي خارابىلەر ۋە ئوتتۇرىدىكى كۆل." },
  { id: "vineyard", name: "تۇرپان ئۈزۈمزارلىقى", blurb: "ئۈزۈم باراڭلىرى، كارىز ئېرىقى ۋە ئوتلۇق تاغ مەنزىرىسى." },
];

export function levelById(id: LevelId) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

/** Small multipliers; 1 means no change. `armor` scales damage taken. */
export type CharacterMods = { run: number; swim: number; armor: number; meter: number; ink: number };

export type CharacterInfo = { id: CharacterId; name: string; trait: string; blurb: string; mods: CharacterMods };

const BASE_MODS: CharacterMods = { run: 1, swim: 1, armor: 1, meter: 1, ink: 1 };

export const CHARACTERS: CharacterInfo[] = [
  { id: "wave", name: "دولقۇنچاق", trait: "تەڭپۇڭ", blurb: "سىياھ چېچى بىلەن ھەممە ئىشقا تەييار.", mods: BASE_MODS },
  {
    id: "doppa",
    name: "دوپپىلىق يىگىت",
    trait: "يۈگۈرۈش سۈرئىتى ‎+8%",
    blurb: "بادام نەقىشلىك دوپپىسى بىلەن كوچىلاردا ئۇچقاندەك يۈگۈرىدۇ.",
    mods: { ...BASE_MODS, run: 1.08 },
  },
  {
    id: "braids",
    name: "ئۆرۈمە چاچلىق قىز",
    trait: "ئۈزۈش سۈرئىتى ‎+12%",
    blurb: "ئۇزۇن ئۆرۈمە چاچلىرى دولقۇندەك لەپىلدەيدۇ.",
    mods: { ...BASE_MODS, swim: 1.12 },
  },
  {
    id: "telpek",
    name: "تەلپەكلىك باتۇر",
    trait: "مۇداپىئە ‎+10%",
    blurb: "قېلىن تەلپىكى سىياھ زەربىسىنى يۇمشىتىدۇ.",
    mods: { ...BASE_MODS, armor: 0.9 },
  },
  {
    id: "scarf",
    name: "ئەتلەس ياغلىقلىق قىز",
    trait: "ئالاھىدە ماھارەت ‎+15%",
    blurb: "ئەتلەس ياغلىقى ئالاھىدە كۈچنى تېز يىغىدۇ.",
    mods: { ...BASE_MODS, meter: 1.15 },
  },
  {
    id: "dutar",
    name: "دۇتارچى",
    trait: "سىياھ تولۇقلاش ‎+15%",
    blurb: "دۇتارنىڭ ئاھاڭى بىلەن سىياھ تېز تولىدۇ.",
    mods: { ...BASE_MODS, ink: 1.15 },
  },
];

export function characterById(id: CharacterId) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export const DIFFICULTIES: { id: Difficulty; name: string }[] = [
  { id: "easy", name: "ئاسان" },
  { id: "normal", name: "ئادەتتىكى" },
  { id: "hard", name: "قىيىن" },
];

/** Ranks by turf points, with each splat worth 60 points. */
export function mvpIndex(board: BoardRow[]): number {
  let best = -1;
  let bestScore = -1;
  board.forEach((r, i) => {
    const score = r.points + r.splats * 60;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export function weaponById(id: WeaponId): WeaponInfo {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}
