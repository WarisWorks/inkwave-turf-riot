import './typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ARSENAL, createArsenalState, stepArsenal, tryDodge, advanceDodge, arsenalMoveScale } from '../src/game/weapons/arsenal.ts';
import { createLiquidInk } from '../src/game/rendering/liquidInk.ts';
import { WEAPONS } from '../src/game/types.ts';
import { loadSave } from '../src/game/persist.ts';

const actor = (weapon, extra = {}) => ({ weapon, ink: 100, fireCd: 0, charge: 0, arsenal: createArsenalState(), alive: true, swimming: false, grounded: true, spT: 0, ...extra });
function tick(a, dt, fire) { a.fireCd = Math.max(0, a.fireCd - dt); return stepArsenal(a, dt, fire); }

test('all seven weapons keep their IDs and survive save loading without losing progression', () => {
  assert.equal(WEAPONS.length, 7);
  assert.equal(new Set(WEAPONS.map(w => w.id)).size, 7);
  try {
    for (const w of WEAPONS) {
      globalThis.window = { localStorage: { getItem: () => JSON.stringify({ version: 1, weapon: w.id, xp: 3240, coins: 721, character: 'dutar', level: 'harbor' }) } };
      const save = loadSave();
      assert.equal(save.weapon, w.id); assert.equal(save.character, 'dutar');
      assert.equal(save.xp, 3240); assert.equal(save.coins, 721); assert.equal(save.level, 'urumqi');
    }
  } finally { delete globalThis.window; }
});

test('dualies alternate hands, respect cooldown and never spend unavailable ink', () => {
  const a = actor('dualies');
  assert.equal(tick(a, 0, true).hand, -1);
  assert.equal(tick(a, 0.01, true), null);
  assert.equal(tick(a, 0.1, true).hand, 1);
  a.ink = 0.5;
  assert.equal(tick(a, 1, true), null); assert.equal(a.ink, 0.5);
});

test('two dodge rolls cost ink, cannot chain during a roll, and recover only after release and lock', () => {
  const a = actor('dualies');
  assert.equal(tryDodge(a, 1, 0, true), true);
  assert.equal(a.ink, 93);
  assert.equal(tryDodge(a, 1, 0, true), false);
  assert.equal(tick(a, 0.01, true), null);
  advanceDodge(a, 0.3);
  assert.ok(arsenalMoveScale(a) < 1);
  assert.equal(tryDodge(a, 0, 1, true), true);
  advanceDodge(a, 0.3);
  assert.equal(tryDodge(a, 1, 0, true), false);
  tick(a, 0.1, false); assert.equal(a.arsenal.rolls, 0);
  tick(a, 0.41, false); assert.equal(a.arsenal.rolls, 2);
  assert.equal(a.ink, 86);
});

test('dodge travel is consistent at 30, 60, 144 Hz, including a partial last step', () => {
  for (const hz of [30, 60, 144]) {
    const a = actor('dualies'); tryDodge(a, 3, 4, true);
    let x = 0, z = 0;
    for (let i = 0; i < hz; i++) { const v = advanceDodge(a, 1 / hz); if (v) { x += v.x / hz; z += v.z / hz; } }
    assert.ok(Math.abs(Math.hypot(x, z) - ARSENAL.dualies.rollDist) < 1e-8);
    assert.equal(a.arsenal.dodgeTime, 0);
  }
});

test('dodge rejects airborne, swimming, dead, special-charging, stationary and empty actors', () => {
  for (const extra of [{ grounded: false }, { swimming: true }, { alive: false }, { spT: 0.3 }, { ink: 6 }]) {
    const a = actor('dualies', extra); assert.equal(tryDodge(a, 1, 0, true), false);
  }
  assert.equal(tryDodge(actor('dualies'), 0, 0, true), false);
  assert.equal(tryDodge(actor('spritzer'), 1, 0, true), false);
});

test('bucket reserves one cost then completes its windup even if fire is released', () => {
  const a = actor('slosher');
  assert.equal(tick(a, 0, true), null); assert.equal(a.ink, 92.5);
  assert.equal(tick(a, 0.1, false), null);
  assert.equal(tick(a, 0.031, false).kind, 'slosher');
  assert.equal(tick(a, 0.1, true), null); assert.equal(a.ink, 92.5);
});

test('splatling charge controls stream length, drains its meter and costs ink per round', () => {
  for (const charge of [0.25, 1]) {
    const a = actor('splatling');
    assert.equal(tick(a, ARSENAL.splatling.chargeTime * charge, true), null);
    assert.equal(a.charge, charge); assert.equal(a.ink, 100);
    tick(a, 0, false);
    assert.equal(a.arsenal.streamDuration, 0.3 + 1.4 * charge);
    let shots = 0;
    for (let t = 0; t < 2; t += 1 / 60) if (tick(a, 1 / 60, false)) shots++;
    assert.ok(shots > 5); assert.ok(shots < 30);
    assert.ok(Math.abs(a.ink - (100 - shots * ARSENAL.splatling.ink)) < 1e-8);
    assert.equal(a.charge, 0); assert.equal(a.arsenal.stream, 0);
  }
});

test('diving, death and specials cancel queued bucket throws and splatling bursts', () => {
  for (const weapon of ['slosher', 'splatling']) for (const extra of [{ swimming: true }, { alive: false }, { spT: 0.2 }]) {
    const a = actor(weapon); tick(a, 0.85, true);
    if (weapon === 'splatling') tick(a, 0, false);
    Object.assign(a, extra);
    assert.equal(tick(a, 1, false), null);
    assert.equal(a.charge, 0); assert.equal(a.arsenal.stream, 0); assert.equal(a.arsenal.slosh, -1);
  }
});

test('fresh ink dries, repaints fresh, and clears all ripple/wake state at a match reset', () => {
  const ink = createLiquidInk(4, 4, 16, 16);
  const camera = { x: 0, z: 0 };
  ink.markCell(5); ink.update(0.1, [], camera, true);
  const pixels = ink.uniforms.inkWet.value.image.data;
  assert.ok(pixels[5] > 240); assert.equal(pixels[4], 0);
  ink.update(3, [], camera, true); assert.ok(pixels[5] > 100 && pixels[5] < 140);
  ink.update(3, [], camera, true); assert.equal(pixels[5], 0);
  ink.markCell(5); ink.update(0.1, [], camera, true); assert.ok(pixels[5] > 240);
  ink.ripple(1, 2, 3, 1);
  ink.reset(); assert.ok(pixels.every(p => p === 0));
  assert.equal(ink.uniforms.inkRipples.value[0].y, -999);
  let disposed = 0; ink.uniforms.inkWet.value.addEventListener('dispose', () => disposed++);
  ink.dispose(); assert.equal(disposed, 1);
});

test('swim wakes are bounded, prioritize the human player, and are disabled on low quality', () => {
  const ink = createLiquidInk(4, 4, 16, 16);
  const swimmers = Array.from({ length: 12 }, (_, i) => ({ x: i, y: 0, z: 0, vx: 6, vz: 0, swimming: true, climbing: false, alive: true, isPlayer: i === 11 }));
  ink.update(0.1, swimmers, { x: 0, z: 0 }, true);
  assert.equal(ink.uniforms.inkWakes.value.length, 4);
  assert.equal(ink.uniforms.inkWakes.value[0].x, 11);
  ink.update(0.1, swimmers, { x: 0, z: 0 }, false);
  assert.ok(ink.uniforms.inkWakes.value.every(w => w.w === 0));
  assert.equal(ink.uniforms.inkDetail.value, 0);
  ink.dispose();
});
