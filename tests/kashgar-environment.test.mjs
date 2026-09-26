import './typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const { LEVEL_DEFS } = await import('../src/game/levels.ts');
const { KASHGAR_ROUTE_POINTS, KASHGAR_BUILDINGS } = await import('../src/game/environment/kashgarLayout.ts');
const { levelColliders, CollisionIndex } = await import('../src/game/environment/collision.ts');
const { CityNavigation } = await import('../src/game/environment/cityNavigation.ts');

const level = LEVEL_DEFS.bazaar;
const solids = levelColliders(level.prims);
const navigation = new CityNavigation(solids, level.pools);
const index = new CollisionIndex(); index.rebuild(solids);
const source = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('engine.ts', source, ts.ScriptTarget.Latest, true);
const names = new Set(['standHeight', 'resolveActor', 'moveActor', 'castWorld']);
const functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const context = vm.createContext({ solids, collisionIndex: index, GRAV: 22, clamp: (v, min, max) => Math.max(min, Math.min(max, v)), inWater: () => false, hurt() {} });
vm.runInContext(ts.transpileModule(functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);

test('both teams have six clear ground-level spawn positions', () => {
  assert.equal(level.spawnO.length, 6);
  assert.equal(level.spawnV.length, 6);
  for (const [x, z] of [...level.spawnO, ...level.spawnV]) {
    assert.equal(context.standHeight(x, z, 80), 0);
    const a = { x, z, y: 0 }; context.resolveActor(a);
    assert.equal(a.x, x); assert.equal(a.z, z);
  }
});

test('city collision and buildings are point symmetric', () => {
  for (const b of solids) assert.ok(solids.some((q) => Math.abs(q.minX + b.maxX) < 1e-6 && Math.abs(q.maxX + b.minX) < 1e-6 && Math.abs(q.minZ + b.maxZ) < 1e-6 && Math.abs(q.maxZ + b.minZ) < 1e-6 && Math.abs(q.maxY - b.maxY) < 1e-6));
  assert.equal(KASHGAR_BUILDINGS.length, 12);
});

for (const target of KASHGAR_ROUTE_POINTS.slice(1)) test(`real movement can reach ${target.name} from spawn`, () => {
  const start = KASHGAR_ROUTE_POINTS[0];
  const path = navigation.path(start, target);
  assert.ok(path.length > 0, 'connected navigation route');
  const a = { ...start, vy: 0, vx: 0, vz: 0, grounded: true, swimming: false, climbing: false };
  for (const waypoint of path) {
    let steps = 0;
    while (Math.hypot(waypoint.x - a.x, waypoint.z - a.z) > 0.08 && steps++ < 240) {
      const dx = waypoint.x - a.x, dz = waypoint.z - a.z, distance = Math.hypot(dx, dz);
      const speed = Math.min(5.7, distance * 60);
      context.moveActor(a, dx / distance * speed, dz / distance * speed, 1 / 60);
    }
    assert.ok(steps < 240, `blocked at ${JSON.stringify(a)} on the way to ${JSON.stringify(waypoint)}`);
  }
  for (let i = 0; i < 30; i++) context.moveActor(a, 0, 0, 1 / 60);
  assert.ok(Math.abs(a.y - target.y) < 0.51, `reached height ${a.y}, expected ${target.y}`);
  assert.ok(Math.hypot(a.x - target.x, a.z - target.z) < 1.1);
});

test('bridge has distinct street and roof surfaces; bullets pass underneath', () => {
  assert.equal(context.standHeight(-20, -20.5, 0), 0);
  assert.equal(context.standHeight(-20, -20.5, 4), 4);
  const hit = context.castWorld(-24, 1.1, -20.5, 1, 0, 0, 7.5);
  assert.equal(hit, null);
  const deck = context.castWorld(-20, 6, -20.5, 0, -1, 0, 8);
  assert.ok(deck); assert.equal(deck.y, 4); assert.equal(deck.ny, 1);
});

test('gate opening is passable and the lintel blocks upward shots', () => {
  assert.equal(context.castWorld(0, 1.1, -29, 0, 0, 1, 4), null);
  assert.ok(context.castWorld(0, 2, -27, 0, 1, 0, 4));
});

test('every residential roof has a route from its own spawn courtyard', () => {
  for (const b of KASHGAR_BUILDINGS) {
    const from = b.rotation ? { x: -0.5, y: 0, z: 32.5 } : KASHGAR_ROUTE_POINTS[0];
    const route = navigation.path(from, { x: b.x, y: b.h, z: b.z });
    assert.ok(route.length > 0, b.id);
    assert.equal(route.at(-1).y, b.h);
  }
});
