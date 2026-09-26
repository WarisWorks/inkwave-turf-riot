import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual merged endMatch function without a WebGL renderer.
const source = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('engine.ts', source, ts.ScriptTarget.Latest, true);
let fn;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'endMatch') fn = node;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(fn);
const code = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function check(name, { mode = 'turf', orange = 0.6, violet = 0.2, alive = true, lives = 2, enemyLives = 2, zone = 0, winner }) {
  test(name, () => {
    const player = { team: 1, lives, alive, x: 0, y: 0, z: 0, yaw: 0, splats: 4, deaths: 2, swimming: true, climbing: true, spT: 0.5, invuln: 1 };
    let reports = 0;
    let published = 0;
    const grid = new Uint8Array(120 * 152);
    if (zone) grid[76 * 120 + 60] = zone;
    const ctx = vm.createContext({
      phase: 'live', paused: true, orangePct: orange, bluePct: violet,
      actors: [player, { team: 2, lives: enemyLives, alive: true }],
      GW: 120, GH: 152, grid, result: null, resultSent: false,
      endT: 10, endAng: 0, endFromAng: 0, endFromDist: 0, endFromY: 0,
      camPos: { x: 2, y: 3, z: 4 },
      recount() {}, castWorld() { return null; },
      respawn(actor) { actor.alive = true; },
      buildBoard() { return [{ points: 123, splats: player.splats, deaths: player.deaths }]; },
      setBanner() {}, audio: { setTempo() {}, fanfare() {} },
      document: { exitPointerLock() {} },
      publish() { published++; },
      bridge: { config: { current: { gameMode: mode } }, onResult() { reports++; } },
    });
    vm.runInContext(code + '\nendMatch(); endMatch();', ctx);
    assert.equal(ctx.result.winner, winner, name);
    assert.equal(ctx.result.points, 123);
    assert.equal(ctx.result.splats, 4);
    assert.equal(ctx.result.deaths, 2);
    assert.equal(ctx.phase, 'ended');
    assert.equal(ctx.paused, false);
    assert.equal(reports, 1);
    assert.equal(published, 1);
    assert.equal(player.alive, true);
    assert.equal(player.swimming, false);
    assert.equal(player.climbing, false);
    assert.equal(player.spT, 0);
    assert.equal(player.invuln, 0);
    assert.ok(Number.isFinite(ctx.endAng));
    assert.equal(ctx.endT, 0);
  });
}

check('turf winner and celebration', { winner: 'orange' });
check('turf tie tolerance', { orange: 0.4, violet: 0.402, winner: 'tie' });
check('zone control overrides total turf', { mode: 'zone', zone: 2, winner: 'violet' });
check('tied zone uses turf tiebreaker', { mode: 'zone', winner: 'orange' });
check('survival winner ignores turf', { mode: 'survival', lives: 1, enemyLives: 2, winner: 'violet' });
check('dead player cannot turn a survival loss into a tie during celebration', { mode: 'survival', alive: false, winner: 'violet' });
check('dead player cannot turn a survival tie into a win during celebration', { mode: 'survival', alive: false, lives: 2, enemyLives: 1, winner: 'tie' });
