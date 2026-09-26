// Adapted from jaydendavisnc/inkwave (MIT), config.js and game/weapons.js.
// See public/licenses/inkwave-MIT.txt. Timing is independent of rendering and collision.
import type { WeaponId } from "../types";

export const ARSENAL = {
  dualies: { interval: 0.083, ink: 0.85, speed: 34, life: 0.62, damage: 15, radius: 0.95, rollInk: 7, rollTime: 0.3, rollDist: 2.8, rolls: 2, lockTime: 0.5, lockInterval: 0.07 },
  slosher: { interval: 0.62, windup: 0.13, ink: 7.5, speed: 17, gravity: 22, damage: 58, radius: 1.45, drops: 5 },
  splatling: { chargeTime: 0.85, burstMin: 0.3, burstMax: 1.7, interval: 0.066, ink: 0.95, speed: 42, life: 0.8, damage: 16, radius: 1.05 },
} as const;

export type ArsenalState = {
  hand: number;
  dodgeTime: number;
  dodgeX: number;
  dodgeZ: number;
  rolls: number;
  lock: number;
  slosh: number;
  stream: number;
  streamDuration: number;
};

export type ArsenalActor = {
  weapon: WeaponId;
  ink: number;
  fireCd: number;
  charge: number;
  arsenal: ArsenalState;
  alive: boolean;
  swimming: boolean;
  grounded: boolean;
  spT: number;
};

export type ArsenalShot = { kind: "dualies" | "slosher" | "splatling"; hand: number };

export function createArsenalState(): ArsenalState {
  return { hand: 1, dodgeTime: 0, dodgeX: 0, dodgeZ: 0, rolls: 2, lock: 0, slosh: -1, stream: 0, streamDuration: 0 };
}

/** Cancels windups and streams on diving, special use or death; reserved slosh ink stays spent. */
export function cancelArsenal(a: ArsenalActor) {
  a.charge = 0;
  a.arsenal.slosh = -1;
  a.arsenal.stream = 0;
  a.arsenal.streamDuration = 0;
}

export function tryDodge(a: ArsenalActor, x: number, z: number, firing: boolean): boolean {
  const s = a.arsenal, w = ARSENAL.dualies;
  const length = Math.hypot(x, z);
  if (a.weapon !== "dualies" || !a.alive || !a.grounded || a.swimming || a.spT > 0 || !firing || length < 0.3 || s.dodgeTime > 0 || s.rolls <= 0 || a.ink < w.rollInk) return false;
  a.ink -= w.rollInk;
  s.rolls--;
  s.lock = 0;
  s.dodgeTime = w.rollTime;
  s.dodgeX = x / length;
  s.dodgeZ = z / length;
  return true;
}

/** Integral of upstream's fast-out roll curve: the same travel distance at every step rate. */
export function advanceDodge(a: ArsenalActor, dt: number): { x: number; z: number } | null {
  const s = a.arsenal, w = ARSENAL.dualies;
  if (s.dodgeTime <= 0 || dt <= 0) return null;
  const u0 = 1 - s.dodgeTime / w.rollTime;
  const u1 = Math.min(1, u0 + dt / w.rollTime);
  const integral = (u: number) => u - u * u * u / 3;
  const speed = 1.5 * w.rollDist * (integral(u1) - integral(u0)) / dt;
  s.dodgeTime = Math.max(0, s.dodgeTime - dt);
  if (s.dodgeTime < 1e-6) { s.dodgeTime = 0; s.lock = w.lockTime; }
  return { x: s.dodgeX * speed, z: s.dodgeZ * speed };
}

/** The engine owns fireCd's countdown. This returns commands for its existing projectile pool. */
export function stepArsenal(a: ArsenalActor, dt: number, fire: boolean, cooldownScale = 1): ArsenalShot | null {
  const s = a.arsenal;
  if (!a.alive || a.swimming || a.spT > 0) { cancelArsenal(a); return null; }
  if (a.weapon === "dualies") {
    s.lock = Math.max(0, s.lock - dt);
    if (!fire && s.lock <= 0 && s.dodgeTime <= 0) s.rolls = ARSENAL.dualies.rolls;
    if (!fire || s.dodgeTime > 0 || a.fireCd > 0 || a.ink < ARSENAL.dualies.ink) return null;
    a.ink -= ARSENAL.dualies.ink;
    a.fireCd = (s.lock > 0 ? ARSENAL.dualies.lockInterval : ARSENAL.dualies.interval) * cooldownScale;
    s.hand *= -1;
    return { kind: "dualies", hand: s.hand };
  }
  if (a.weapon === "slosher") {
    if (s.slosh >= 0) {
      s.slosh += dt;
      if (s.slosh < ARSENAL.slosher.windup) return null;
      s.slosh = -1;
      a.fireCd = (ARSENAL.slosher.interval - ARSENAL.slosher.windup) * cooldownScale;
      return { kind: "slosher", hand: 0 };
    }
    if (fire && a.fireCd <= 0 && a.ink >= ARSENAL.slosher.ink) {
      a.ink -= ARSENAL.slosher.ink;
      s.slosh = 0;
    }
    return null;
  }
  if (a.weapon === "splatling") {
    const w = ARSENAL.splatling;
    if (s.stream > 0) {
      s.stream = Math.max(0, s.stream - dt);
      a.charge = s.stream / s.streamDuration;
      if (s.stream <= 0 || a.ink < w.ink) {
        cancelArsenal(a);
        a.fireCd = Math.max(a.fireCd, 0.22);
        return null;
      }
      if (a.fireCd > 0) return null;
      a.ink -= w.ink;
      a.fireCd = w.interval * cooldownScale;
      return { kind: "splatling", hand: 0 };
    }
    if (fire && a.fireCd <= 0 && a.ink >= w.ink * 5) {
      a.charge = Math.min(1, a.charge + dt / w.chargeTime);
    } else if (!fire && a.charge > 0) {
      s.streamDuration = w.burstMin + (w.burstMax - w.burstMin) * a.charge;
      s.stream = s.streamDuration;
      a.charge = 1;
      a.fireCd = 0;
    }
  }
  return null;
}

export function arsenalMoveScale(a: ArsenalActor): number {
  if (a.weapon === "dualies" && a.arsenal.lock > 0) return 0.28;
  if (a.weapon === "slosher" && a.arsenal.slosh >= 0) return 0.65;
  if (a.weapon === "splatling" && a.charge > 0) return a.arsenal.stream > 0 ? 0.6 : 0.45;
  return 1;
}
