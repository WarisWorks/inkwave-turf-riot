import './typescript-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import ts from 'typescript';
const { LEVEL_DEFS } = await import('../src/game/levels.ts');
const { CollisionIndex, levelColliders } = await import('../src/game/environment/collision.ts');
const { CityNavigation } = await import('../src/game/environment/cityNavigation.ts');
const { URUMQI_ASSETS } = await import('../src/game/environment/urumqiLayout.ts');
const { createUrumqiEnvironment } = await import('../src/game/environment/urumqiEnvironment.ts');
const { loadSave } = await import('../src/game/persist.ts');
const level = LEVEL_DEFS.urumqi, solids = levelColliders(level.prims);
const collisionIndex = new CollisionIndex(); collisionIndex.rebuild(solids);
const navigation = new CityNavigation(solids, [], { x: level.spawnO[0][0], y: 0, z: level.spawnO[0][1] });
const ast = ts.createSourceFile('engine.ts', readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const names = new Set(['standHeight', 'resolveActor', 'moveActor', 'castWorld']), functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const context = vm.createContext({ solids, collisionIndex, GRAV: 22, clamp: (v, min, max) => Math.max(min, Math.min(max, v)), inWater: () => false, hurt() {} });
vm.runInContext(ts.transpileModule(functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);

test('all twelve Urumqi spawn positions are clear and the old canal is gone', () => {
  assert.equal(level.spawnO.length, 6); assert.equal(level.spawnV.length, 6);
  assert.equal(level.channel, undefined); assert.deepEqual(level.pools, []);
  for (const [x, z] of [...level.spawnO, ...level.spawnV]) {
    assert.equal(context.standHeight(x, z, 80), 0);
    const actor = { x, z, y: 0 }; context.resolveActor(actor);
    assert.equal(actor.x, x); assert.equal(actor.z, z);
  }
});

for (const target of [{ name: 'west promenade', x: -18.5, y: 2.4, z: 0.5 }, { name: 'east promenade', x: 18.5, y: 2.4, z: 0.5 }, { name: 'tower plaza', x: -0.5, y: 0, z: 5.5 }, { name: 'opposing courtyard', x: 0.5, y: 0, z: 33.5 }]) test(`Urumqi bots and real movement can reach the ${target.name}`, () => {
  for (const side of [-1, 1]) {
    const start = { x: 0.5, y: 0, z: side * 33.5 };
    const path = navigation.path(start, target);
    assert.ok(path.length > 0);
    const actor = { ...start, vy: 0, grounded: true, swimming: false, climbing: false };
    for (const point of path) {
      let steps = 0;
      while (Math.hypot(point.x - actor.x, point.z - actor.z) > 0.08 && steps++ < 240) {
        const dx = point.x - actor.x, dz = point.z - actor.z, d = Math.hypot(dx, dz), speed = Math.min(5.7, d * 60);
        context.moveActor(actor, dx / d * speed, dz / d * speed, 1 / 60);
      }
      assert.ok(steps < 240, `Blocked at ${JSON.stringify(actor)}`);
    }
    for (let i = 0; i < 30; i++) context.moveActor(actor, 0, 0, 1 / 60);
    assert.ok(Math.abs(actor.y - target.y) < 0.01);
    assert.ok(Math.hypot(actor.x - target.x, actor.z - target.z) < 0.1);
  }
});

test('the tower blocks shots at its shaft, with clear air above the low market base', () => {
  assert.equal(context.castWorld(-2, 3, -4, 0, 0, 1, 8), null);
  assert.ok(context.castWorld(0.72, 3, -4, 0, 0, 1, 8));
});

test('Urumqi patrol destinations exclude disconnected landmark roofs and cover tops', () => {
  const start = navigation.nearest({ x: 0, y: 0, z: -34 });
  const reached = new Set([start]), queue = [start];
  for (let i = 0; i < queue.length; i++) for (const id of navigation.nodes[queue[i]].links) {
    if (!reached.has(id)) { reached.add(id); queue.push(id); }
  }
  assert.equal(reached.size, navigation.nodes.length);
  assert.ok(navigation.nodes.every(n => n.y <= 2.4));
  assert.ok(navigation.nodes.some(n => n.y === 2.4));
});

test('five embedded-texture Urumqi derivatives stay under 4.2 MB and 95k triangles, with matching layout proportions', () => {
  let bytes = 0, triangles = 0;
  for (const asset of URUMQI_ASSETS) {
    const b = readFileSync(new URL(`../public/models/urumqi/runtime/urumqi-${asset.id}.glb`, import.meta.url));
    assert.equal(b.readUInt32LE(8), b.length); bytes += b.length;
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))), p = g.meshes[0].primitives[0];
    const bounds = g.accessors[p.attributes.POSITION];
    triangles += g.accessors[p.indices].count / 3;
    bounds.max.forEach((v, i) => assert.ok(Math.abs(v - bounds.min[i] - asset.size[i]) < 0.00001));
    assert.equal(g.images.length, 1); assert.ok(g.images.every(i => i.bufferView !== undefined && !i.uri));
  }
  assert.ok(bytes < 4_200_000, String(bytes)); assert.ok(triangles < 95_000, String(triangles));
});

test('existing Port saves migrate to Urumqi without resetting progression or other stage selections', () => {
  const oldWindow = globalThis.window;
  try {
    for (const id of ['harbor', 'urumqi', 'bazaar', 'oasis', 'vineyard']) {
      globalThis.window = { localStorage: { getItem: () => JSON.stringify({ version: 1, level: id, wins: 9, xp: 3400, coins: 78 }) } };
      const save = loadSave();
      assert.equal(save.level, id === 'harbor' ? 'urumqi' : id);
      assert.equal(save.wins, 9); assert.equal(save.xp, 3400); assert.equal(save.coins, 78);
    }
  } finally { globalThis.window = oldWindow; }
});

test('missing assets keep all fallback buildings and dispose every shared resource exactly once', async () => {
  const oldFetch = globalThis.fetch, oldWarn = console.warn; let environment;
  globalThis.fetch = async () => ({ ok: false, status: 404 }); console.warn = () => {};
  try {
    environment = createUrumqiEnvironment(); await environment.ready;
    const scene = new THREE.Scene(); scene.add(environment.group);
    assert.equal(environment.group.children.filter(n => n.name.endsWith('fallback') && n.visible).length, 5);
    const resources = new Set(), disposed = new Map();
    environment.group.traverse(n => {
      if (!(n instanceof THREE.Mesh)) return;
      resources.add(n.geometry); resources.add(n.material);
      if (n instanceof THREE.InstancedMesh) resources.add(n);
    });
    for (const r of resources) r.addEventListener('dispose', () => disposed.set(r, (disposed.get(r) ?? 0) + 1));
    environment.dispose(); environment.dispose();
    assert.equal(scene.children.length, 0); assert.equal(disposed.size, resources.size);
    for (const count of disposed.values()) assert.equal(count, 1);
  } finally { environment?.dispose(); globalThis.fetch = oldFetch; console.warn = oldWarn; }
});

test('leaving Urumqi aborts the two active requests and never starts queued models', async () => {
  const oldFetch = globalThis.fetch; let environment, signalReady;
  const started = new Promise(resolve => { signalReady = resolve; }), signals = [];
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    signals.push(options.signal);
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    if (signals.length === 2) signalReady();
  });
  try {
    environment = createUrumqiEnvironment(); await started;
    environment.dispose(); await environment.ready;
    assert.equal(signals.length, 2); assert.ok(signals.every(signal => signal.aborted));
    assert.equal(environment.group.children.filter(n => n.name.endsWith('model')).length, 0);
  } finally { environment?.dispose(); globalThis.fetch = oldFetch; }
});

test('models decoded after stage disposal release geometry, materials and textures without entering the scene', async () => {
  const oldFetch = globalThis.fetch, oldParse = GLTFLoader.prototype.parseAsync;
  let environment, decodingReady; const pending = [], resources = [], disposed = new Set();
  const decoding = new Promise(resolve => { decodingReady = resolve; });
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  GLTFLoader.prototype.parseAsync = () => new Promise(resolve => {
    const scene = new THREE.Group(), geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture }); scene.add(new THREE.Mesh(geometry, material));
    for (const r of [geometry, texture, material]) { resources.push(r); r.addEventListener('dispose', () => disposed.add(r)); }
    pending.push(() => resolve({ scene })); if (pending.length === 2) decodingReady();
  });
  try {
    environment = createUrumqiEnvironment(); await decoding; environment.dispose();
    pending.forEach(resolve => resolve()); await environment.ready;
    assert.equal(disposed.size, resources.length);
    assert.equal(environment.group.children.filter(n => n.name.endsWith('model')).length, 0);
  } finally { pending.forEach(resolve => resolve()); environment?.dispose(); globalThis.fetch = oldFetch; GLTFLoader.prototype.parseAsync = oldParse; }
});
