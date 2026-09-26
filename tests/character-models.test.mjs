import './typescript-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const { CHARACTER_ASSETS } = await import('../src/game/characters/characterAssets.ts');
const { prepareCharacterGeometry, createCharacterRig, CHARACTER_HEIGHT } = await import('../src/game/characters/characterRig.ts');
const { createCharacterLibrary } = await import('../src/game/characters/characterLibrary.ts');
const { DEFAULT_SAVE, loadSave } = await import('../src/game/persist.ts');

function readModel(asset) {
  const bytes = readFileSync(new URL(`../public/models/characters/${asset}.glb`, import.meta.url));
  const size = bytes.readUInt32LE(12), data = JSON.parse(bytes.toString('utf8', 20, 20 + size)), binary = bytes.subarray(28 + size);
  const primitive = data.meshes[0].primitives[0], geometry = new THREE.BufferGeometry();
  const attribute = (id, itemSize) => {
    const accessor = data.accessors[id], view = data.bufferViews[accessor.bufferView];
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const typed = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[accessor.componentType];
    const copied = binary.subarray(start, start + accessor.count * itemSize * typed.BYTES_PER_ELEMENT);
    return new THREE.BufferAttribute(new typed(copied.buffer.slice(copied.byteOffset, copied.byteOffset + copied.byteLength)), itemSize);
  };
  geometry.setAttribute('position', attribute(primitive.attributes.POSITION, 3));
  geometry.setAttribute('normal', attribute(primitive.attributes.NORMAL, 3));
  geometry.setAttribute('uv', attribute(primitive.attributes.TEXCOORD_0, 2));
  geometry.setIndex(attribute(primitive.indices, 1));
  return { bytes, data, geometry };
}
function pose() {
  const body = new THREE.Group(), legs = new THREE.Group(), headPivot = new THREE.Group(), armGun = new THREE.Group(), armSup = new THREE.Group(), mount = new THREE.Group();
  legs.add(new THREE.Group(), new THREE.Group()); body.add(legs, headPivot, armGun, armSup, mount);
  armGun.rotation.set(-1.35, 0, 0.05); armSup.rotation.set(-1.15, 0, 0.95);
  return { body, legs, headPivot, armGun, armSup, mount };
}

test('new and existing default saves select the new supplied character without changing perks or progression', () => {
  assert.equal(CHARACTER_ASSETS[DEFAULT_SAVE.character], 'cute');
  const oldWindow = globalThis.window;
  try {
    globalThis.window = { localStorage: { getItem: () => JSON.stringify({ version: 1, character: 'wave', wins: 12, level: 'urumqi' }) } };
    const save = loadSave(); assert.equal(CHARACTER_ASSETS[save.character], 'cute'); assert.equal(save.wins, 12);
    assert.equal(save.level, 'urumqi');
  } finally { globalThis.window = oldWindow; }
});

test('all five character derivatives stay below 3.2 MB total and their per-model triangle budgets', () => {
  let size = 0;
  for (const asset of new Set(Object.values(CHARACTER_ASSETS))) {
    const { bytes, data, geometry } = readModel(asset); size += bytes.length;
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.ok(geometry.index.count / 3 <= (asset === 'cute' ? 20000 : 14000));
    assert.equal(data.images.length, 1); assert.ok(data.images[0].bufferView !== undefined);
    geometry.dispose();
  }
  assert.ok(size < 3_200_000, String(size));
});

test('the blue-doppa boy has no ponytail hanging behind his neck', () => {
  const { geometry } = readModel('boy');
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    assert.ok(!(x > -0.14 && x < -0.025 && y > 0.59 && y < 0.665 && z < -0.10), 'Long tied hair remains behind the neck');
  }
  geometry.dispose();
});

test('the new character keeps its authored idle pose and assigns crossed boots to the correct legs', () => {
  const { geometry: source } = readModel('cute'), geometry = prepareCharacterGeometry(source, 'cute');
  const p = geometry.getAttribute('position'), weights = geometry.getAttribute('skinWeight'), bones = geometry.getAttribute('skinIndex');
  const material = new THREE.MeshLambertMaterial(), rig = createCharacterRig(geometry, material, 'cute'), refs = pose();
  refs.body.add(rig.mesh); rig.update(refs); refs.body.updateMatrixWorld(true); rig.skeleton.update();
  const vertex = new THREE.Vector3(), original = new THREE.Vector3();
  let forwardBoot = 0, rearBoot = 0;
  for (let i = 0; i < p.count; i++) {
    original.fromBufferAttribute(p, i); rig.mesh.getVertexPosition(i, vertex);
    assert.ok(original.distanceTo(vertex) < 0.00001, 'Idle pose must preserve the supplied silhouette');
    const x = original.x / CHARACTER_HEIGHT, y = original.y / CHARACTER_HEIGHT, z = original.z / CHARACTER_HEIGHT;
    const boneWeight = bone => [0, 1, 2, 3].reduce((sum, j) => sum + (bones.array[i * 4 + j] === bone ? weights.array[i * 4 + j] : 0), 0);
    if (y > 0.65) assert.ok([4, 5, 6, 7].every(bone => boneWeight(bone) === 0), 'Arms must never pull the face or ears');
    if (y < 0.18 && z > 0.14 && x > 0) { assert.ok(boneWeight(2) > 0.99); forwardBoot++; }
    if (y < 0.18 && z < -0.12 && x < 0) { assert.ok(boneWeight(3) > 0.99); rearBoot++; }
  }
  assert.ok(forwardBoot > 10 && rearBoot > 10, 'Check both crossed boots');
  rig.dispose(); material.dispose(); geometry.dispose(); source.dispose();
});

for (const asset of new Set(Object.values(CHARACTER_ASSETS))) test(`${asset}: valid independent rigs animate the original mesh without changing shared geometry`, () => {
  const { geometry: source } = readModel(asset), geometry = prepareCharacterGeometry(source, asset);
  const p = geometry.getAttribute('position'), weights = geometry.getAttribute('skinWeight'), bones = geometry.getAttribute('skinIndex');
  assert.ok(Math.abs(geometry.boundingBox.max.y - CHARACTER_HEIGHT) < 0.00001);
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < 0.00001);
    for (let j = 0; j < 4; j++) assert.ok(bones.array[i * 4 + j] < 8);
  }
  const material = new THREE.MeshLambertMaterial(), a = createCharacterRig(geometry, material, asset), b = createCharacterRig(geometry, material, asset);
  const refs = pose(); refs.body.add(a.mesh); refs.legs.children[0].rotation.x = 0.8;
  a.update(refs); refs.body.updateMatrixWorld(true); a.skeleton.update(); b.mesh.updateMatrixWorld(true); b.skeleton.update();
  assert.notEqual(a.skeleton, b.skeleton); assert.equal(a.mesh.geometry, b.mesh.geometry);
  assert.notEqual(a.skeleton.bones[2].rotation.x, b.skeleton.bones[2].rotation.x);
  let moved = 0;
  const point = new THREE.Vector3(), original = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    original.fromBufferAttribute(p, i); a.mesh.getVertexPosition(i, point);
    assert.ok(point.toArray().every(Number.isFinite));
    assert.ok(point.length() < 3, `Unexpected deformation ${point.toArray()}`);
    if (original.distanceTo(point) > 0.03) moved++;
  }
  assert.ok(moved > p.count * 0.03); assert.ok(refs.mount.position.toArray().every(Number.isFinite));
  a.dispose(); b.dispose(); geometry.dispose(); source.dispose(); material.dispose();
});

test('one request and shared geometry serve multiple actors; replacing an actor preserves other skeletons', async () => {
  const oldFetch = globalThis.fetch, oldParse = GLTFLoader.prototype.parseAsync; let calls = 0;
  const source = readModel('cute').geometry, sourceMaterial = new THREE.MeshStandardMaterial(), scene = new THREE.Group(); scene.add(new THREE.Mesh(source, sourceMaterial));
  globalThis.fetch = async url => { assert.ok(url.endsWith('/models/characters/cute.glb')); calls++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; };
  GLTFLoader.prototype.parseAsync = async () => ({ scene });
  const library = createCharacterLibrary(), a = pose(), b = pose(), fa = new THREE.Group(), fb = new THREE.Group();
  try {
    const first = library.attach('wave', 1, a, fa), second = library.attach('wave', 2, b, fb);
    await library.ready();
    assert.equal(calls, 1); assert.equal(fa.visible, false); assert.equal(fb.visible, false);
    const meshes = []; for (const parent of [a.body, b.body]) parent.traverse(n => { if (n instanceof THREE.SkinnedMesh) meshes.push(n); });
    assert.equal(meshes.length, 2); assert.equal(meshes[0].geometry, meshes[1].geometry);
    assert.notEqual(meshes[0].skeleton, meshes[1].skeleton);
    let disposed = 0; meshes[0].geometry.addEventListener('dispose', () => disposed++);
    first.dispose(); assert.equal(disposed, 0); second.update();
    library.dispose(); library.dispose(); assert.equal(disposed, 1);
    assert.equal(b.body.getObjectByName('Supplied Uyghur avatar'), undefined);
  } finally { library.dispose(); globalThis.fetch = oldFetch; GLTFLoader.prototype.parseAsync = oldParse; }
});

test('a failed character request retains the fallback and cleanup aborts pending requests', async () => {
  const oldFetch = globalThis.fetch, oldWarn = console.warn;
  let library; console.warn = () => {};
  try {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    library = createCharacterLibrary(); const fallback = new THREE.Group(); library.attach('wave', 1, pose(), fallback);
    await library.ready(); assert.equal(fallback.visible, true); library.dispose();
    let started, signal; const request = new Promise(resolve => { started = resolve; });
    globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => { signal = options.signal; signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); started(); });
    library = createCharacterLibrary(); library.attach('wave', 1, pose(), new THREE.Group());
    const ready = library.ready(); await request; library.dispose(); await ready; assert.equal(signal.aborted, true);
  } finally { library?.dispose(); globalThis.fetch = oldFetch; console.warn = oldWarn; }
});

test('a late character decode is released after engine teardown and never attached', async () => {
  const oldFetch = globalThis.fetch, oldParse = GLTFLoader.prototype.parseAsync;
  let decodingStarted, finish; const decoding = new Promise(resolve => { decodingStarted = resolve; });
  const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture(), material = new THREE.MeshStandardMaterial({ map: texture }), scene = new THREE.Group(); scene.add(new THREE.Mesh(geometry, material));
  let released = 0; for (const r of [geometry, texture, material]) r.addEventListener('dispose', () => released++);
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  GLTFLoader.prototype.parseAsync = () => new Promise(resolve => { finish = () => resolve({ scene }); decodingStarted(); });
  const library = createCharacterLibrary(), refs = pose();
  try {
    library.attach('wave', 1, refs, new THREE.Group()); const ready = library.ready(); await decoding;
    library.dispose(); finish(); await ready;
    assert.equal(released, 3); assert.equal(refs.body.getObjectByName('Supplied Uyghur avatar'), undefined);
  } finally { finish?.(); library.dispose(); globalThis.fetch = oldFetch; GLTFLoader.prototype.parseAsync = oldParse; }
});
