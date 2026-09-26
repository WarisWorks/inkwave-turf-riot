import * as THREE from "three";
import { StaticBatches } from "./staticBatches";
import { KASHGAR_BUILDINGS, KASHGAR_STALLS } from "./kashgarLayout";

function textileTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#b64345"; c.fillRect(0, 0, 128, 128);
  const colors = ["#ecd99b", "#267f84", "#342e4a", "#d6ac4c"];
  for (let stripe = 0; stripe < 4; stripe++) for (let y = 0; y < 128; y += 2) {
    const width = 3 + 12 * Math.abs(Math.sin(y * Math.PI / 64));
    const center = stripe * 32 + 16 + Math.sin(y * 1.7) * 1.5;
    c.fillStyle = colors[stripe]; c.fillRect(center - width, y, width * 2, 2);
    c.fillStyle = "#ead4a0"; c.fillRect(center - width * 0.24, y, width * 0.48, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Built with shared primitives and canvas textures; no external model assets. */
export function createKashgarEnvironment() {
  const group = new THREE.Group();
  group.name = "Kashgar old city";
  const batch = new StaticBatches();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const column = new THREE.CylinderGeometry(0.42, 0.5, 1, 8);
  const leaf = new THREE.IcosahedronGeometry(1, 0);
  const mountain = new THREE.ConeGeometry(1, 1, 6);
  const pottery = new THREE.LatheGeometry([new THREE.Vector2(0.17, 0), new THREE.Vector2(0.33, 0.12), new THREE.Vector2(0.4, 0.45), new THREE.Vector2(0.23, 0.66), new THREE.Vector2(0.19, 0.83), new THREE.Vector2(0.25, 0.87)], 10);
  const doorArch = new THREE.Shape();
  doorArch.moveTo(-0.6, 0);
  doorArch.absarc(0, 0, 0.6, Math.PI, 0, true);
  doorArch.lineTo(-0.6, 0);
  const doorArchGeo = new THREE.ShapeGeometry(doorArch, 8);
  const archTrim = new THREE.RingGeometry(0.6, 0.69, 12, 1, 0, Math.PI);
  const fabricMap = textileTexture();
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext("2d")!;
  const gradient = shadowContext.createRadialGradient(32, 32, 13, 32, 32, 32);
  gradient.addColorStop(0, "#27203385"); gradient.addColorStop(1, "#27203300");
  shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.7 });
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
  const adobe = mat(0xc9976d);
  const pale = mat(0xe4c79f);
  const rose = mat(0xb78269);
  const wood = mat(0x614530);
  const teal = mat(0x267b81);
  const green = mat(0x607c3d);
  const fruit = mat(0xd5ae46);
  const clay = mat(0xad6347);
  const metal = mat(0x394b4b);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffdca0 });
  const distant = mat(0xb6a9a0);
  const fabric = new THREE.MeshLambertMaterial({ map: fabricMap, side: THREE.DoubleSide });
  const ownedMaterials = [adobe, pale, rose, wood, teal, green, fruit, clay, metal, glow, distant, fabric];
  const block = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) => batch.add(cube, m, x, y, z, w, h, d, ry);

  function facade(x: number, z: number, w: number, h: number, d: number, tone = adobe) {
    // Keep the top below the separate inkable roof deck, avoiding coplanar faces.
    block(tone, x, (h - 0.16) / 2, z, w, h - 0.16, d);
    block(pale, x, h - 0.23, z, w + 0.12, 0.22, d + 0.12);
    const rows = h > 5 ? [1.2, h - 1.25] : [h * 0.46];
    const windowHeight = Math.min(1.25, h * 0.32);
    for (const side of [-1, 1]) {
      const front = z + side * (d / 2 + 0.03);
      const sideX = x + side * (w / 2 + 0.04);
      for (const y of rows) {
        block(teal, x, y + windowHeight / 2 + 0.2, front, w, 0.1, 0.13);
        block(teal, sideX, y + windowHeight / 2 + 0.2, z, 0.12, 0.1, d);
        for (let u = -w / 2 + 1.3; u < w / 2 - 0.6; u += 2.3) {
          if (Math.abs(u) < 1.2 && y < 2) continue;
          block(wood, x + u, y, front, 0.95, windowHeight, 0.15);
          for (const dx of [-0.3, 0, 0.3]) block(pale, x + u + dx, y, front + side * 0.1, 0.05, windowHeight, 0.07);
          block(pale, x + u, y, front + side * 0.1, 0.95, 0.05, 0.07);
          block(teal, x + u, y - windowHeight / 2, front, 1.15, 0.12, 0.28);
        }
        for (let u = -d / 2 + 1.5; u < d / 2 - 0.8; u += 2.6) {
          block(wood, sideX, y, z + u, 0.15, windowHeight, 0.95);
          block(pale, sideX + side * 0.09, y, z + u, 0.08, windowHeight, 0.06);
          block(pale, sideX + side * 0.09, y, z + u, 0.08, 0.06, 0.95);
          block(teal, sideX, y - windowHeight / 2, z + u, 0.27, 0.12, 1.16);
        }
      }
      // Arched timber doors use one shared semicircle and trim, facing outwards.
      const ry = side < 0 ? Math.PI : 0;
      block(wood, x, 0.7, front, 1.2, 1.4, 0.16);
      batch.add(doorArchGeo, wood, x, 1.4, front + side * 0.09, 1, 0.75, 1, ry);
      batch.add(archTrim, pale, x, 1.4, front + side * 0.1, 1, 0.75, 1, ry);
      for (const dx of [-0.645, 0.645]) block(pale, x + dx, 0.7, front, 0.09, 1.4, 0.24);
      for (const dx of [-0.45, -0.15, 0.15, 0.45]) block(pale, x + dx, 0.7, front + side * 0.09, 0.035, 1.35, 0.04);
      // Small timber ends beneath the roof add rhythm without obstructing routes.
      for (let u = -w / 2 + 0.65; u < w / 2; u += 1.25)
        block(wood, x + u, h - 0.45, front, 0.13, 0.16, 0.34);
    }
  }

  for (const b of KASHGAR_BUILDINGS) {
    const tone = b.style === "courtyard" ? rose : b.style === "terrace" ? pale : adobe;
    facade(b.x, b.z, b.w, b.h, b.d, tone);
    batch.add(shadowGeo, shadowMaterial, b.x - 0.65, 0.025, b.z + 0.45, b.w + 4, 1, b.d + 4);
    for (const side of [-1, 1]) {
      block(fabric, b.x + side * b.w * 0.28, b.h * 0.61, b.z + b.d / 2 + 0.16, 1.3, Math.min(1.5, b.h * 0.5), 0.06);
      // Corner parapets leave stairs and connecting decks open.
      block(pale, b.x + side * (b.w / 2 - 0.8), b.h + 0.28, b.z + b.d / 2 - 0.16, 1.6, 0.56, 0.32);
      block(pale, b.x + side * (b.w / 2 - 0.8), b.h + 0.28, b.z - b.d / 2 + 0.16, 1.6, 0.56, 0.32);
    }
  }

  // Quiet, layered residential silhouettes outside the collision boundary.
  for (let side = -1; side <= 1; side += 2) for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
    const z = -43 + i * 10 + (row % 2) * 3;
    const x = side * (36 + row * 10);
    const h = 5 + ((i * 7 + row * 3) % 7);
    facade(x, z, 8.5, h, 8.5, i % 3 === 0 ? rose : adobe);
    block(i % 3 === 0 ? rose : adobe, x + (i % 2 ? 1.5 : -1.5), h + 0.8, z - 1.5, 4, 1.6, 4);
    block(pale, x + (i % 2 ? 1.5 : -1.5), h + 1.6, z - 1.5, 4.2, 0.15, 4.2);
    block(pale, x - 3.9, h + 0.3, z, 0.3, 0.6, 8.5);
    block(pale, x + 3.9, h + 0.3, z, 0.3, 0.6, 8.5);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
    facade(-38 + i * 11, side * 45, 10, 6 + i % 4, 9, i % 3 === 1 ? rose : adobe);
  }
  // Two timber galleries rise above the distant residential skyline.
  for (const side of [-1, 1]) {
    const x = side * 37, z = side * 37;
    facade(x, z, 8, 11, 8, rose);
    block(adobe, x, 11, z, 6.4, 2, 6.4);
    block(wood, x, 12, z, 8.8, 0.25, 8.8);
    block(wood, x, 14.2, z, 8.8, 0.25, 8.8);
    block(pale, x, 14.45, z, 9.2, 0.25, 9.2);
    for (const edge of [-1, 1]) for (let n = -3; n <= 3; n += 1.5) {
      block(wood, x + n, 13.1, z + edge * 3.8, 0.14, 2.2, 0.14);
      block(wood, x + edge * 3.8, 13.1, z + n, 0.14, 2.2, 0.14);
    }
    for (const edge of [-1, 1]) {
      block(teal, x, 12.4, z + edge * 3.8, 8, 0.15, 0.13);
      block(teal, x + edge * 3.8, 12.4, z, 0.13, 0.15, 8);
    }
  }

  for (let i = 0; i < KASHGAR_STALLS.length; i++) {
    const [x, z] = KASHGAR_STALLS[i];
    for (const dx of [-1.45, 1.45]) block(wood, x + dx, 1.45, z, 0.12, 2.9, 0.12);
    block(i % 2 ? fabric : teal, x, 2.65, z, 3.3, 0.13, 2.4);
    block(fabric, x, 2.45, z + 1.15, 3.3, 0.34, 0.06);
    for (let n = 0; n < 9; n++) batch.add(ball, fruit, x - 0.9 + (n % 3) * 0.34, 1.2 + Math.floor(n / 6) * 0.16, z - 0.4 + Math.floor(n / 3) * 0.3, 0.17, 0.17, 0.17);
    batch.add(pottery, clay, x + 0.95, 1.1, z, 0.5, 0.5, 0.5);
  }

  // Lamps, pottery, grape pergolas and slender poplars frame playable streets.
  for (const side of [-1, 1]) {
    for (const z of [-32, -17, 1, 18, 32]) {
      const x = side * 28;
      batch.add(column, wood, x, 0.8, z, 0.25, 1.6, 0.25);
      for (let tier = 0; tier < 3; tier++) batch.add(leaf, green, x, 3.2 + tier * 1.5, z, 0.8 - tier * 0.16, 2.6 - tier * 0.4, 0.85 - tier * 0.16);
    }
    for (const z of [-29, -10, 10, 29]) {
      const x = side * 10.8;
      batch.add(column, metal, x, 1.6, z, 0.12, 3.2, 0.12);
      block(metal, x, 3.15, z, 0.7, 0.1, 0.65);
      block(glow, x, 2.88, z, 0.32, 0.45, 0.32);
      block(metal, x, 2.6, z, 0.48, 0.12, 0.48);
      batch.add(pottery, clay, x + side * 0.5, 0, z + 1, 0.85, 0.9, 0.85);
    }
    const z = side * 31;
    for (const x of [-5.5, 5.5]) block(wood, x, 1.9, z, 0.13, 3.8, 0.13);
    for (let n = 0; n < 9; n++) {
      const x = -5.5 + n * 1.375;
      block(wood, x, 3.7, z, 0.09, 0.12, 3);
      batch.add(leaf, green, x, 3.76, z, 0.9, 0.18, 1.3);
      batch.add(ball, green, x, 3.33, z + 0.45, 0.17, 0.32, 0.17);
    }
  }

  // Curved arch infill instead of a rectangular gateway silhouette.
  const arch = new THREE.Shape();
  arch.moveTo(-3.9, 0); arch.lineTo(-3.9, 1.8); arch.lineTo(3.9, 1.8); arch.lineTo(3.9, 0);
  arch.bezierCurveTo(2.8, 0, 2.2, 0.7, 0, 1.42); arch.bezierCurveTo(-2.2, 0.7, -2.8, 0, -3.9, 0);
  const archGeo = new THREE.ExtrudeGeometry(arch, { depth: 1.42, bevelEnabled: false, curveSegments: 12 });
  for (const z of [-27, 27]) batch.add(archGeo, pale, 0, 2.55, z - 0.71);

  // One tiled fountain landmark and simple distant mountain silhouettes.
  batch.add(column, pale, 0, 1.1, 0, 0.4, 1.8, 0.4);
  batch.add(column, teal, 0, 1.95, 0, 2.1, 0.18, 2.1);
  batch.add(ball, pale, 0, 2.2, 0, 0.28, 0.32, 0.28);
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++)
    batch.add(mountain, distant, -90 + i * 23, 1 + i % 4, side * (99 + i % 3 * 8), 29 + i % 3 * 5, 20 + i % 4 * 4, 19 + i % 3 * 3, i);

  const signCanvas = document.createElement("canvas");
  signCanvas.width = 1024; signCanvas.height = 128;
  const signContext = signCanvas.getContext("2d")!;
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  let disposed = false;
  const drawSign = () => {
    if (disposed) return;
    signContext.fillStyle = "#24646d"; signContext.fillRect(0, 0, 1024, 128);
    signContext.strokeStyle = "#e6ca92"; signContext.lineWidth = 8; signContext.strokeRect(10, 10, 1004, 108);
    signContext.fillStyle = "#fff1cd"; signContext.font = '64px "ALKATIP Basma", serif';
    signContext.direction = "rtl"; signContext.textAlign = "center"; signContext.textBaseline = "middle";
    signContext.fillText("قەشقەر بازىرى", 512, 62); signTexture.needsUpdate = true;
  };
  drawSign();
  void document.fonts?.load('64px "ALKATIP Basma"').then(drawSign, () => {});
  const signMaterial = new THREE.MeshLambertMaterial({ map: signTexture });
  const signGeo = new THREE.PlaneGeometry(5.8, 0.73);
  for (const side of [-1, 1]) batch.add(signGeo, signMaterial, 0, 4.8, side * 27, 1, 1, 1, side < 0 ? Math.PI : 0);

  const instances = batch.finish(group);
  return {
    group,
    dispose() {
      disposed = true;
      group.removeFromParent();
      instances.forEach((m) => m.dispose());
      [cube, ball, column, leaf, pottery, mountain, archGeo, doorArchGeo, archTrim, signGeo, shadowGeo].forEach((g) => g.dispose());
      [...ownedMaterials, signMaterial, shadowMaterial].forEach((m) => m.dispose());
      fabricMap.dispose(); signTexture.dispose(); shadowTexture.dispose();
    },
  };
}
