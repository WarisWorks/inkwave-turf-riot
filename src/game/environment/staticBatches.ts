import * as THREE from "three";

/** Per-cell instancing retains culling without a draw call for every pot/window. */
export class StaticBatches {
  private batches = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrices: THREE.Matrix4[] }>();
  private transform = new THREE.Object3D();

  add(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x: number, y: number, z: number, w = 1, h = 1, d = 1, ry = 0, rz = 0) {
    const materialKey = (Array.isArray(material) ? material : [material]).map((m) => m.uuid).join();
    const key = `${geometry.uuid}:${materialKey}:${Math.floor(x / 32)}:${Math.floor(z / 32)}`;
    let batch = this.batches.get(key);
    if (!batch) { batch = { geometry, material, matrices: [] }; this.batches.set(key, batch); }
    this.transform.position.set(x, y, z);
    this.transform.scale.set(w, h, d);
    this.transform.rotation.set(0, ry, rz);
    this.transform.updateMatrix();
    batch.matrices.push(this.transform.matrix.clone());
  }

  finish(group: THREE.Group) {
    const instances: THREE.InstancedMesh[] = [];
    for (const batch of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      mesh.matrixAutoUpdate = false;
      mesh.name = "Environment static batch";
      group.add(mesh);
      instances.push(mesh);
    }
    return instances;
  }
}

