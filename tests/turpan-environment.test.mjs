import './typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import ts from 'typescript';
const { LEVEL_DEFS, waterRects } = await import('../src/game/levels.ts');
const { CollisionIndex, levelColliders } = await import('../src/game/environment/collision.ts');
const { TURPAN_LANDMARK } = await import('../src/game/environment/turpanLayout.ts');
const { createTurpanEnvironment } = await import('../src/game/environment/turpanEnvironment.ts');
const level = LEVEL_DEFS.vineyard;
const solids = levelColliders(level.prims);
const collisionIndex = new CollisionIndex(); collisionIndex.rebuild(solids);
const source = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('engine.ts', source, ts.ScriptTarget.Latest, true);
const names = new Set(['standHeight', 'surfaceTop', 'waterAt', 'inWater', 'resolveActor', 'moveActor']);
const functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const context = vm.createContext({ solids, collisionIndex, levelWater: waterRects(level), GRAV: 22, clamp: (v, min, max) => Math.max(min, Math.min(max, v)), hurt() { throw new Error('Route entered open water'); } });
vm.runInContext(ts.transpileModule(functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);

test('vineyard planting leaves both teams’ spawn positions clear', () => {
  for (const [x, z] of [...level.spawnO, ...level.spawnV]) {
    assert.equal(context.surfaceTop(x, z), 0);
    const actor = { x, z, y: 0 }; context.resolveActor(actor);
    assert.equal(actor.x, x); assert.equal(actor.z, z);
  }
});

for (const [x] of level.channel.crossings) test(`vineyard canal crossing at x=${x} remains walkable both ways`, () => {
  for (const direction of [-1, 1]) {
    const actor = { x, y: 0, z: -8 * direction, vy: 0, grounded: true, swimming: false, climbing: false };
    for (let i = 0; i < 200; i++) context.moveActor(actor, 0, 5 * direction, 1 / 60);
    assert.ok(actor.z * direction > 8);
    assert.ok(Math.abs(actor.x - x) < 0.01);
  }
});

test('minaret derivative stays below 1 MB and 25k triangles, outside the playable boundary', () => {
  const bytes = readFileSync(new URL('../public/models/turpan/historic-minaret.glb', import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 1_000_000);
  const data = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const primitive = data.meshes[0].primitives[0];
  const positions = data.accessors[primitive.attributes.POSITION];
  assert.ok(data.accessors[primitive.indices].count / 3 <= 25000);
  const scale = TURPAN_LANDMARK.height / (positions.max[1] - positions.min[1]);
  // Rotation is 90 degrees, so source depth is the landmark's world width.
  assert.ok(TURPAN_LANDMARK.x + (positions.max[2] - positions.min[2]) * scale / 2 < -32);
  assert.equal(data.images.length, 1);
  assert.ok(data.images.every((image) => image.bufferView !== undefined && !image.uri));
});

test('a missing minaret keeps a usable procedural landmark and releases resources', async () => {
  const oldFetch = globalThis.fetch, oldWindow = globalThis.window, oldWarn = console.warn;
  globalThis.window = { setTimeout, clearTimeout };
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  console.warn = () => {};
  let environment;
  try {
    environment = createTurpanEnvironment();
    const scene = new THREE.Scene(); scene.add(environment.group);
    await environment.ready;
    const landmark = environment.group.getObjectByName('Historic minaret');
    assert.equal(landmark.children[0].visible, true);
    const geometry = new Set(), material = new Set(), disposedGeometry = new Set(), disposedMaterial = new Set();
    environment.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      geometry.add(node.geometry); material.add(node.material);
    });
    for (const resource of geometry) resource.addEventListener('dispose', () => disposedGeometry.add(resource));
    for (const resource of material) resource.addEventListener('dispose', () => disposedMaterial.add(resource));
    environment.dispose();
    assert.equal(scene.children.length, 0);
    assert.deepEqual(disposedGeometry, geometry);
    assert.deepEqual(disposedMaterial, material);
  } finally { environment?.dispose(); globalThis.fetch = oldFetch; globalThis.window = oldWindow; console.warn = oldWarn; }
});

test('switching stages aborts a pending minaret request without adding late objects', async () => {
  const oldFetch = globalThis.fetch, oldWindow = globalThis.window;
  globalThis.window = { setTimeout, clearTimeout };
  let requestStarted, signal;
  const started = new Promise((resolve) => { requestStarted = resolve; });
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    requestStarted();
  });
  let environment;
  try {
    environment = createTurpanEnvironment();
    const scene = new THREE.Scene(); scene.add(environment.group);
    await started;
    environment.dispose();
    await environment.ready;
    assert.equal(signal.aborted, true);
    assert.equal(scene.children.length, 0);
    assert.equal(environment.group.getObjectByName('Historic minaret').children.length, 1);
  } finally { environment?.dispose(); globalThis.fetch = oldFetch; globalThis.window = oldWindow; }
});
