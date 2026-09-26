import * as THREE from "three";

/** Release shared scene resources once, including per-instance GPU buffers. */
export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Sprite) {
      if (node instanceof THREE.InstancedMesh) node.dispose();
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
  }
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => {
    texture.dispose();
    if (typeof ImageBitmap !== "undefined" && texture.source.data instanceof ImageBitmap) texture.source.data.close();
  });
}
