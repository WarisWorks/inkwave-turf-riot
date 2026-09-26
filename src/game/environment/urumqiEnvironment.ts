import * as THREE from "three";
import { StaticBatches } from "./staticBatches";
import { disposeObject } from "./sceneResources";
import { URUMQI_ASSETS, URUMQI_BUILDINGS, urumqiBuildingVolumes, URUMQI_PLANTERS, URUMQI_STALLS } from "./urumqiLayout";

/** A bazaar square framed by the five supplied Urumqi models. */
export function createUrumqiEnvironment() {
  const group = new THREE.Group();
  group.name = "Urumqi bazaar square";
  const batch = new StaticBatches();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const leaf = new THREE.IcosahedronGeometry(1, 1);
  const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
  const stone = mat(0xc49a70), teal = mat(0x277b83), timber = mat(0x745138);
  const green = mat(0x648451), gold = mat(0xe6b767), cloth = mat(0xb75744), dark = mat(0x3a5862);
  const cubeAt = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => batch.add(cube, m, x, y, z, w, h, d);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), mat(0xb6b6a6));
  backdrop.position.y = -0.05; group.add(backdrop);

  for (const [x, z] of URUMQI_PLANTERS) {
    cubeAt(timber, x, 1.8, z, 0.16, 2.7, 0.16);
    batch.add(leaf, green, x, 3.4, z, 0.7, 1.8, 0.8);
    batch.add(leaf, green, x, 4.6, z, 0.5, 1.2, 0.6);
  }
  URUMQI_STALLS.forEach(([x, z], i) => {
    for (const dx of [-1.4, 1.4]) for (const dz of [-0.8, 0.8]) cubeAt(timber, x + dx, 1.7, z + dz, 0.11, 3.4, 0.11);
    for (let n = 0; n < 6; n++) cubeAt(n % 2 ? gold : i % 2 ? teal : cloth, x - 1.5 + n * 0.6, 3.45, z, 0.6, 0.12, 2.4);
    for (let n = -1; n <= 1; n++) batch.add(leaf, gold, x + n * 0.8, 1.36, z, 0.3, 0.17, 0.35);
  });
  // Lamps sit on the edge planters, keeping all street lanes unobstructed.
  for (const x of [-25, 25]) for (const z of [-8, 8]) {
    cubeAt(dark, x, 2.7, z, 0.12, 4.5, 0.12);
    cubeAt(dark, x, 4.9, z, 0.9, 0.12, 0.9);
    cubeAt(gold, x, 4.55, z, 0.45, 0.6, 0.45);
  }
  // Shaded arcade trim along the outer sides of the two raised promenades.
  for (const side of [-1, 1]) {
    for (const z of [-4.5, 0, 4.5]) cubeAt(teal, side * 23.5, 3.8, z, 0.16, 2.8, 0.16);
    cubeAt(teal, side * 23.5, 5.2, 0, 0.25, 0.2, 10);
    for (const z of [-4.5, -3, -1.5, 0, 1.5, 3, 4.5]) cubeAt(timber, side * 22.5, 5.2, z, 2.2, 0.12, 0.1);
  }
  // Distant city blocks behind the supplied architecture establish an urban horizon.
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 15, z = side * (49 + i % 2 * 7), h = 9 + (i * 7 % 13);
    cubeAt(i % 2 ? stone : dark, x, h / 2, z, 10, h, 9);
    cubeAt(teal, x, h, z, 10.5, 0.3, 9.5);
    for (let y = 3; y < h - 1; y += 2.8) for (const dx of [-3, 0, 3]) cubeAt(gold, x + dx, y, z - side * 4.55, 1.2, 1.3, 0.08);
  }
  batch.finish(group);

  const placeholders = URUMQI_BUILDINGS.map((b) => {
    const root = new THREE.Group(); root.name = `Urumqi ${b.asset} fallback`;
    for (const volume of urumqiBuildingVolumes(b)) {
      const block = new THREE.Mesh(cube, stone);
      block.position.set(volume.x - b.x, volume.y - b.y, volume.z - b.z);
      block.scale.set(volume.w, volume.h, volume.d); root.add(block);
      const cap = new THREE.Mesh(cube, teal);
      cap.position.set(volume.x - b.x, volume.y - b.y + volume.h / 2, volume.z - b.z);
      cap.scale.set(volume.w, 0.12, volume.d); root.add(cap);
    }
    root.position.set(b.x, b.y, b.z); group.add(root);
    return root;
  });
  let disposed = false;
  const controllers = new Set<AbortController>();
  const ready = (async () => {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    if (disposed) return;
    // Two concurrent decodes keep startup and stage changes responsive.
    const queue = [...URUMQI_ASSETS];
    const worker = async () => {
      while (!disposed && queue.length) {
        const asset = queue.shift()!;
        const controller = new AbortController(); controllers.add(controller);
        const timeout = globalThis.setTimeout(() => controller.abort(), 15000);
        const url = `${import.meta.env?.BASE_URL ?? "/"}models/urumqi/runtime/urumqi-${asset.id}.glb`;
        let model: THREE.Group | undefined;
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.arrayBuffer();
          if (disposed) return;
          const gltf = await new GLTFLoader().parseAsync(data, url.slice(0, url.lastIndexOf("/") + 1));
          model = gltf.scene;
          if (disposed) { disposeObject(model); return; }
          const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
          if (!Number.isFinite(size.length()) || Math.min(size.x, size.y, size.z) <= 0) throw new Error("Empty Urumqi geometry");
          const center = bounds.getCenter(new THREE.Vector3());
          const index = URUMQI_BUILDINGS.findIndex((b) => b.asset === asset.id), b = URUMQI_BUILDINGS[index];
          const scale = b.span / Math.max(size.x, size.z);
          model.scale.setScalar(scale); model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
          model.traverse((node) => {
            if (!(node instanceof THREE.Mesh)) return;
            const convert = (source: THREE.Material) => {
              if (!(source instanceof THREE.MeshStandardMaterial)) return source;
              const material = new THREE.MeshLambertMaterial({ map: source.map, color: source.color });
              source.dispose(); return material;
            };
            node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material);
          });
          const root = new THREE.Group(); root.name = `Urumqi ${asset.id} model`;
          root.position.set(b.x, b.y, b.z); root.rotation.y = b.rotation;
          root.add(model); group.add(root); placeholders[index].visible = false;
        } catch (error) {
          if (model) disposeObject(model);
          if (!disposed) console.warn(`[Urumqi] Model ${asset.id} unavailable; keeping architectural fallback.`, error);
        } finally { globalThis.clearTimeout(timeout); controllers.delete(controller); }
      }
    };
    await Promise.all([worker(), worker()]);
  })().catch((error: unknown) => { if (!disposed) console.warn("[Urumqi] Model loader unavailable; keeping architectural fallbacks.", error); });

  return { group, ready, dispose() {
    if (disposed) return;
    disposed = true; controllers.forEach((controller) => controller.abort());
    group.removeFromParent(); disposeObject(group);
  } };
}
