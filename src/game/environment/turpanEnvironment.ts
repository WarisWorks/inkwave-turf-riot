import * as THREE from "three";
import { StaticBatches } from "./staticBatches";
import { disposeObject } from "./sceneResources";
import { TURPAN_LANDMARK, TURPAN_VINE_ROWS } from "./turpanLayout";

const MINARET_URL = `${import.meta.env?.BASE_URL ?? "/"}models/turpan/historic-minaret.glb`;

/** Detailed grape cultivation around the existing karez and combat lanes. */
export function createTurpanEnvironment() {
  const group = new THREE.Group();
  group.name = "Turpan vineyard";
  const batch = new StaticBatches();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const leaf = new THREE.IcosahedronGeometry(1, 0);
  const grape = new THREE.IcosahedronGeometry(1, 0);
  const trunk = new THREE.CylinderGeometry(0.06, 0.1, 1, 5);
  const basket = new THREE.CylinderGeometry(0.38, 0.29, 0.42, 10);
  const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
  const wood = mat(0x735235), bark = mat(0x5b432c), soil = mat(0x926b45);
  const leaves = [mat(0x55753a), mat(0x729347), mat(0x8da34b)];
  const grapes = [mat(0xb3c85b), mat(0x708f3d), mat(0x675176)];
  const wicker = mat(0xc99555), brick = mat(0xb1855d), dark = mat(0x69533e);
  const earth = mat(0xb59565);
  const materials = [wood, bark, soil, ...leaves, ...grapes, wicker, brick, dark, earth];
  const fieldGeo = new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2);
  const field = new THREE.Mesh(fieldGeo, earth);
  field.position.y = -0.08;
  group.add(field);
  const block = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => batch.add(cube, m, x, y, z, w, h, d);

  function bunch(x: number, y: number, z: number, color: number) {
    const material = grapes[color % grapes.length];
    for (let tier = 0; tier < 3; tier++) {
      const count = 4 - tier, radius = 0.14 - tier * 0.035;
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + tier;
        batch.add(grape, material, x + Math.cos(a) * radius, y - tier * 0.15, z + Math.sin(a) * radius, 0.11, 0.135, 0.11);
      }
    }
    batch.add(grape, material, x, y - 0.43, z, 0.09, 0.12, 0.09);
    batch.add(trunk, bark, x, y + 0.18, z, 0.3, 0.3, 0.3);
  }

  function vineRow(x: number, z: number, length: number, row: number, distant = false) {
    const half = length / 2;
    // The soil bed in the playable area comes from the level's collision primitives.
    if (distant) block(soil, x, 0.25, z, 0.8, 0.5, length);
    for (let offset = -half + 0.5; offset <= half; offset += 2.75) {
      block(wood, x, 1.65, z + offset, 0.14, 3.3, 0.14);
      block(wood, x, 3.2, z + offset, 3.1, 0.12, 0.12);
      batch.add(trunk, bark, x + 0.17, 1.7, z + offset, 1, 2.5, 1, 0, 0.1);
    }
    for (const side of [-1, 0, 1]) block(wood, x + side * 1.25, 3.24, z, 0.055, 0.055, length + 0.4);
    for (let n = 0; n < length / 1.25; n++) {
      const v = z - half + 0.6 + n * 1.25;
      for (const side of [-1, 1]) {
        batch.add(leaf, leaves[(n + row + (side > 0 ? 1 : 0)) % leaves.length], x + side * 0.66, 3.38 + (n % 3) * 0.08, v, 1.07, 0.26, 0.9, n * 0.8);
        if (!distant || n % 3 === 0) bunch(x + side * 0.85, 2.97, v + side * 0.15, row + n);
      }
      // Low growth makes the narrow soil/cover strip read as a planted row.
      batch.add(leaf, leaves[(n + row) % leaves.length], x, 0.88, v, 0.47, 0.38, 0.7, n);
    }
  }
  TURPAN_VINE_ROWS.forEach((row, i) => vineRow(row.x, row.z, row.length, i));

  // The central supa remains open beneath a timber-and-vine canopy.
  for (const x of [-3.5, 3.5]) for (const z of [-2.7, 2.7]) block(wood, x, 2.15, z, 0.18, 2.8, 0.18);
  for (const z of [-2.7, 2.7]) block(wood, 0, 3.5, z, 7.6, 0.15, 0.18);
  for (let x = -3.4; x <= 3.5; x += 1.1) {
    block(wood, x, 3.53, 0, 0.13, 0.13, 6);
    for (const z of [-1.8, 0, 1.8]) {
      batch.add(leaf, leaves[Math.round(x + 4) % 3], x, 3.72, z, 0.86, 0.25, 1.1, x);
      bunch(x, 3.4, z, Math.round(x + 4));
    }
  }

  // Cultivated land continues beyond the arena walls without changing navigation.
  for (const side of [-1, 1]) for (let row = 0; row < 5; row++) {
    vineRow(-26 + row * 12, side * 47, 10, row + 2, true);
  }
  for (let row = 0; row < 3; row++) vineRow(37 + row * 6, 0, 52, row + 1, true);
  for (const side of [-1, 1]) {
    for (const x of [-24, 24]) {
      batch.add(basket, wicker, x, 0.75, side * 10, 1.2, 1.2, 1.2);
      for (let i = 0; i < 3; i++) bunch(x + (i - 1) * 0.18, 1.12, side * 10, i);
    }
    // Harvest racks at the drying houses.
    block(wood, side * 23, 1.5, side * 24, 3.2, 0.12, 1.2);
    for (const dx of [-1.4, 1.4]) block(wood, side * 23 + dx, 0.75, side * 24, 0.12, 1.5, 1);
    for (let i = 0; i < 7; i++) bunch(side * 23 - 1.2 + i * 0.4, 1.72, side * 24, i % 2);
  }
  const instances = batch.finish(group);

  const landmark = new THREE.Group();
  landmark.name = "Historic minaret";
  landmark.position.set(TURPAN_LANDMARK.x, 0, TURPAN_LANDMARK.z);
  landmark.rotation.y = TURPAN_LANDMARK.rotation;
  group.add(landmark);
  // Keep a readable landmark if a network request fails or while its model loads.
  const fallback = new THREE.Group();
  const towerGeo = new THREE.CylinderGeometry(0.9, 2.7, 20, 16);
  const tower = new THREE.Mesh(towerGeo, brick);
  tower.position.set(-6, 10, 2);
  fallback.add(tower);
  const wall = new THREE.Mesh(cube, brick); wall.scale.set(18, 5, 12); wall.position.set(2, 2.5, -2); fallback.add(wall);
  const entry = new THREE.Mesh(cube, dark); entry.scale.set(2.5, 3, 0.1); entry.position.set(2, 1.5, 4.06); fallback.add(entry);
  landmark.add(fallback);
  let disposed = false;
  let model: THREE.Group | null = null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  const ready = (async () => {
    try {
      // A separate chunk keeps the model loader out of other arenas' startup path.
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      if (disposed) return;
      const response = await fetch(MINARET_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), MINARET_URL.slice(0, MINARET_URL.lastIndexOf("/") + 1));
      if (disposed) { disposeObject(gltf.scene); return; }
      model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      if (size.y < 0.01) throw new Error("Empty minaret geometry");
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = TURPAN_LANDMARK.height / size.y;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      // Retain the baked brickwork with the same simple lighting as the game.
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const convert = (source: THREE.Material) => {
          if (!(source instanceof THREE.MeshStandardMaterial)) return source;
          const material = new THREE.MeshLambertMaterial({ map: source.map, color: source.color });
          source.dispose();
          return material;
        };
        node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material);
      });
      landmark.add(model);
      fallback.visible = false;
    } catch (error) {
      if (model) { disposeObject(model); model = null; }
      if (!disposed) console.warn("[Turpan] Minaret unavailable; keeping procedural landmark.", error);
    } finally { window.clearTimeout(timeout); }
  })();

  return {
    group,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort(); window.clearTimeout(timeout);
      group.removeFromParent();
      if (model) disposeObject(model);
      instances.forEach((mesh) => mesh.dispose());
      [cube, leaf, grape, trunk, basket, towerGeo, fieldGeo].forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}
