import * as THREE from "three";

/** New kits use the same team materials and weapon mount as the existing characters. */
export function makeArsenalModel(kind: "dualies" | "slosher" | "splatling", shell: THREE.Material, accent: THREE.Material, ink: THREE.Material) {
  const group = new THREE.Group();
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group = group) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z); parent.add(part); return part;
  };
  const barrel = (r: number, length: number, x: number, y: number, z: number, material: THREE.Material, parent = group) => {
    const part = mesh(new THREE.CylinderGeometry(r, r, length, 10), material, x, y, z, parent);
    part.rotation.x = Math.PI / 2; return part;
  };
  if (kind === "dualies") {
    for (const side of [0, -0.62]) {
      const pistol = new THREE.Group();
      pistol.name = side === 0 ? "right-pistol" : "left-pistol";
      pistol.position.x = side; group.add(pistol);
      mesh(new THREE.BoxGeometry(0.16, 0.18, 0.32), shell, 0, 0, 0.12, pistol);
      mesh(new THREE.BoxGeometry(0.09, 0.2, 0.11), shell, 0, -0.16, 0.04, pistol);
      barrel(0.065, 0.24, 0, 0, 0.37, accent, pistol);
      barrel(0.088, 0.07, 0, 0, 0.51, shell, pistol);
      mesh(new THREE.SphereGeometry(0.09, 10, 8), ink, 0, 0.14, 0.04, pistol);
    }
  } else if (kind === "slosher") {
    mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.4, 14, 1, true), accent, 0, 0, 0.25);
    // Open rim, visible reservoir and metal handle.
    const surface = mesh(new THREE.CircleGeometry(0.27, 18), ink, 0, 0.14, 0.25);
    surface.rotation.x = -Math.PI / 2;
    const rim = mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 18), shell, 0, 0.2, 0.25);
    rim.rotation.x = Math.PI / 2;
    const handle = mesh(new THREE.TorusGeometry(0.25, 0.028, 6, 14, Math.PI), shell, 0, 0.2, 0.25);
    handle.rotation.y = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 14), shell, 0, -0.2, 0.25);
  } else {
    barrel(0.2, 0.4, 0, 0, 0, shell);
    barrel(0.13, 0.3, 0, 0.26, -0.13, ink);
    mesh(new THREE.BoxGeometry(0.1, 0.25, 0.12), shell, 0, -0.22, -0.1);
    const drum = new THREE.Group(); drum.name = "rotary-drum"; group.add(drum);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      barrel(0.045, 0.54, Math.cos(angle) * 0.13, Math.sin(angle) * 0.13, 0.42, accent, drum);
    }
    barrel(0.2, 0.07, 0, 0, 0.57, shell, drum);
    barrel(0.04, 0.62, 0, 0, 0.42, ink, drum);
  }
  return group;
}
