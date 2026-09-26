import './typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import ts from 'typescript';
const { LEVEL_DEFS, waterRects } = await import('../src/game/levels.ts');
const { CollisionIndex, levelColliders } = await import('../src/game/environment/collision.ts');
const { createOasisEnvironment } = await import('../src/game/environment/oasisEnvironment.ts');
const level = LEVEL_DEFS.oasis;
const solids = levelColliders(level.prims);
const collisionIndex = new CollisionIndex(); collisionIndex.rebuild(solids);
const ast = ts.createSourceFile('engine.ts', readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const names = new Set(['standHeight', 'surfaceTop', 'waterAt', 'inWater', 'resolveActor', 'moveActor']);
const functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const context = vm.createContext({ solids, collisionIndex, levelWater: waterRects(level), GRAV: 22, clamp: (v, min, max) => Math.max(min, Math.min(max, v)), hurt() { throw new Error('Route entered the oasis water hazard'); } });
vm.runInContext(ts.transpileModule(functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const actorAt = (x, z) => ({ x, z, y: 0, vy: 0, grounded: true, swimming: false, climbing: false });

test('oasis scenery leaves every 6v6 spawn slot clear', () => {
  for (const [team, spots] of [[1, level.spawnO], [2, level.spawnV]]) for (let slot = 0; slot < 6; slot++) {
    const lap = Math.floor(slot / spots.length), base = spots[slot % spots.length];
    const spread = lap === 0 ? 0 : (slot % 2 === 0 ? -1 : 1) * (1.35 + lap * 0.65);
    const x = base[0] + spread, z = base[1] + (team === 1 ? 1 : -1) * lap * 1.15;
    assert.equal(context.surfaceTop(x, z), 0);
    assert.equal(context.waterAt(x, z), false);
    const actor = actorAt(x, z); context.resolveActor(actor);
    assert.equal(actor.x, x); assert.equal(actor.z, z);
  }
});

test('both forts remain reachable by walking up their original stairs', () => {
  for (const side of [-1, 1]) {
    const actor = actorAt(side * 20, 0);
    for (let i = 0; i < 120; i++) context.moveActor(actor, 0, -side * 5, 1 / 60);
    assert.ok(Math.abs(actor.z + side * 10) < 0.01);
    assert.ok(Math.abs(actor.y - 2.8) < 0.01);
  }
});

test('both main sand terraces retain their walkable 1.35 m summit', () => {
  for (const side of [-1, 1]) {
    const actor = actorAt(-side * 9, -side * 16);
    for (let i = 0; i < 96; i++) context.moveActor(actor, -side * 5, 0, 1 / 60);
    assert.ok(Math.abs(actor.x + side * 17) < 0.01);
    assert.ok(Math.abs(actor.y - 1.35) < 0.01);
  }
});

test('both shoreline routes remain open and the pond retains its water hazard', () => {
  for (const side of [-1, 1]) {
    const actor = actorAt(side * 7.8, -9);
    for (let i = 0; i < 216; i++) context.moveActor(actor, 0, 5, 1 / 60);
    assert.ok(Math.abs(actor.x - side * 7.8) < 0.01);
    assert.ok(Math.abs(actor.z - 9) < 0.01);
  }
  assert.equal(context.inWater(0, 0, 0), true);
  assert.equal(context.inWater(6.5, 0, 0), false);
  assert.equal(context.inWater(0, 0, 4.5), false);
});

test('oasis geometry stays finite and below 120k triangles without fetching models', () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Procedural desert must not fetch assets'); };
  let environment;
  try {
    environment = createOasisEnvironment();
    let triangles = 0;
    environment.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const position = node.geometry.getAttribute('position');
      assert.ok([...position.array].every(Number.isFinite));
      triangles += (node.geometry.index?.count ?? position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    });
    assert.ok(triangles > 1000 && triangles < 120000, `${triangles} triangles`);
  } finally { environment?.dispose(); globalThis.fetch = oldFetch; }
});

test('leaving the oasis releases its shared geometry, materials and instance buffers once', () => {
  const environment = createOasisEnvironment(), scene = new THREE.Scene();
  scene.add(environment.group);
  const resources = new Set(), disposed = new Map();
  environment.group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    resources.add(node.geometry); resources.add(node.material);
    if (node instanceof THREE.InstancedMesh) resources.add(node);
  });
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
  environment.dispose(); environment.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(disposed.size, resources.size);
  for (const count of disposed.values()) assert.equal(count, 1);
});
