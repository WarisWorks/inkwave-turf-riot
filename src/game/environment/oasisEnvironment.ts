import * as THREE from "three";
import { StaticBatches } from "./staticBatches";
import { OASIS_FORTS, OASIS_PALMS, OASIS_TERRACES } from "./oasisLayout";

/** Small animated highlights on the existing water plane, without extra render passes. */
export function prepareOasisWater(material: THREE.MeshLambertMaterial, clock: { value: number }) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.oasisTime = clock;
    shader.vertexShader = `varying vec2 oasisWaterXZ;\n${shader.vertexShader}`.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      oasisWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
    `);
    shader.fragmentShader = `varying vec2 oasisWaterXZ;\nuniform float oasisTime;\n${shader.fragmentShader}`.replace("#include <color_fragment>", `
      #include <color_fragment>
      float wave = sin(oasisWaterXZ.x * 3.2 + sin(oasisWaterXZ.y * 1.9) * 0.6 + oasisTime * 0.65);
      float crossingWave = sin(oasisWaterXZ.y * 4.1 - oasisTime * 0.9);
      float glint = smoothstep(0.88, 1.0, wave) * (0.5 + crossingWave * 0.5);
      diffuseColor.rgb *= 0.92 + crossingWave * 0.04;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.85, 0.78), glint * 0.3);
    `);
  };
  material.customProgramCacheKey = () => "oasis-water-v1";
}

/** A wind-shaped ridge with a rounded windward slope and steeper slip face. */
function duneGeometry() {
  const geometry = new THREE.PlaneGeometry(2, 2, 36, 24).rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const crest = 0.2 * Math.cos(x * Math.PI * 0.5) + 0.1 * Math.sin(x * 4);
    const across = Math.max(0, 1 - x * x);
    const along = Math.max(0, 1 - Math.abs((z - crest) / (z > crest ? 1 - crest : 1 + crest)));
    const y = Math.pow(across, 0.7) * Math.pow(along, z > crest ? 0.85 : 1.9);
    positions.setY(i, y);
    color.setHex(0xe5ba7c).multiplyScalar(0.91 + y * 0.09);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Long, curved fronds are actual folded geometry, shared by every date palm. */
function frondGeometry() {
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const width = Math.sin(Math.PI * t) * 0.3;
    const y = Math.sin(t * Math.PI) * 0.42 - t * t * 0.35;
    for (const side of [-1, 0, 1]) vertices.push(side * width, y - Math.abs(side) * 0.06, t);
    if (i < 8) for (let j = 0; j < 2; j++) {
      const a = i * 3 + j;
      indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Ring-based eroded sandstone; reused at different scales along the distant rim. */
function rockGeometry() {
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const rings = 8, sides = 9, color = new THREE.Color();
  for (let ring = 0; ring <= rings; ring++) for (let i = 0; i <= sides; i++) {
    const t = ring / rings, a = (i % sides) / sides * Math.PI * 2;
    const radius = (0.84 + Math.sin(t * 19) * 0.12) * (1 - t * 0.47);
    vertices.push(Math.cos(a) * radius + Math.sin(t * 5) * 0.16, t, Math.sin(a) * radius);
    color.setHex(ring % 3 === 0 ? 0xc28d59 : 0xd4a572);
    colors.push(color.r, color.g, color.b);
    if (ring < rings && i < sides) {
      const a0 = ring * (sides + 1) + i, b = a0 + sides + 1;
      indices.push(a0, b, a0 + 1, a0 + 1, b, b + 1);
    }
  }
  // Close the top; the base is buried in the surrounding sand.
  vertices.push(Math.sin(5) * 0.16, 1, 0); color.setHex(0xe0b47b); colors.push(color.r, color.g, color.b);
  const top = vertices.length / 3 - 1;
  for (let i = 0; i < sides; i++) indices.push(top, rings * (sides + 1) + i + 1, rings * (sides + 1) + i);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** All scenery is generated locally; the existing level primitives own physics/ink. */
export function createOasisEnvironment() {
  const group = new THREE.Group(); group.name = "Taklimakan dunes and oasis";
  const batches = new StaticBatches();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const dune = duneGeometry(), rock = rockGeometry(), frond = frondGeometry();
  const pebble = new THREE.IcosahedronGeometry(1, 0);
  const trunk = new THREE.CylinderGeometry(0.12, 0.18, 1, 7);
  const ring = new THREE.CylinderGeometry(0.18, 0.19, 0.07, 7);
  const pot = new THREE.LatheGeometry([new THREE.Vector2(0.2, 0), new THREE.Vector2(0.38, 0.2), new THREE.Vector2(0.42, 0.5), new THREE.Vector2(0.22, 0.7), new THREE.Vector2(0.2, 0.9)], 9);
  const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
  const sandstone = mat(0xc29561), pale = mat(0xe3bd85), shadow = mat(0x735638);
  const wood = mat(0x765a3b), clay = mat(0xaf6f4b), teal = mat(0x397e78);
  const foliage = [mat(0x647e42), mat(0x7d9551), mat(0x486b3d)];
  foliage.forEach((material) => { material.side = THREE.DoubleSide; });
  const date = mat(0x9a623d), reeds = mat(0x8b9a56);
  const terrain = new THREE.MeshLambertMaterial({ vertexColors: true });
  const earth = mat(0xd8b27a);
  const cloth = new THREE.MeshLambertMaterial({ color: 0xd9aa70, side: THREE.DoubleSide });
  const materials = [sandstone, pale, shadow, wood, clay, teal, ...foliage, date, reeds, terrain, earth, cloth];
  const block = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) => batches.add(cube, m, x, y, z, w, h, d, ry);

  const groundGeo = new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, earth); ground.position.y = -0.1; group.add(ground);
  const canopyGeo = new THREE.PlaneGeometry(1, 1, 6, 4).rotateX(-Math.PI / 2);
  const canopyPositions = canopyGeo.attributes.position;
  for (let i = 0; i < canopyPositions.count; i++) canopyPositions.setY(i, -0.18 * Math.sin((canopyPositions.getX(i) + 0.5) * Math.PI) * Math.sin((canopyPositions.getZ(i) + 0.5) * Math.PI));
  canopyGeo.computeVertexNormals();
  teal.side = THREE.DoubleSide;
  // Broad dunes overlap outside the walls; no hidden slopes intrude into play space.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      batches.add(dune, terrain, side * 51, -0.08, -66 + i * 22, 19, 7 + i % 3 * 3, 22, side * 0.08);
      batches.add(dune, terrain, -73 + i * 24, -0.08, side * 64, 26, 9 + i % 3 * 3, 21, 0.15 * side);
    }
    for (let i = 0; i < 5; i++) {
      batches.add(dune, terrain, side * 88, -0.08, -78 + i * 36, 30, 15 + i % 3 * 4, 33, 0.1);
      batches.add(dune, terrain, -72 + i * 36, -0.08, side * 98, 35, 16 + i % 2 * 7, 30, 0.2);
    }
    // Isolated, layered sandstone outcrops break up the dune horizon.
    for (let i = 0; i < 5; i++) {
      const x = side * (38 + i % 2 * 3), z = -31 + i * 16;
      batches.add(rock, terrain, x, 0, z, 2.6 + i % 2, 7 + i % 3 * 2, 5.8, 0.2);
      batches.add(rock, terrain, x + side * 2.8, -0.1, z + 2, 2.2, 4 + i % 3, 4.6, 0.3);
    }
  }

  // Terrace edges stay at their authored heights; small buried stones soften the blocks.
  for (const t of OASIS_TERRACES) {
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      batches.add(pebble, i % 2 ? pale : sandstone, t.x - t.w / 2 + 0.4 + i * (t.w - 0.8) / 4, t.y + 0.04, t.z + side * (t.d / 2 - 0.08), 0.4, 0.2, 0.26, i);
    }
  }

  // Brick courses, recessed niches and corner battlements dress the existing forts.
  for (const fort of OASIS_FORTS) {
    const { x, z, facing } = fort;
    for (const side of [-1, 1]) {
      block(pale, x + side * 3.95, 2.58, z, 0.16, 0.22, 7.15);
      for (let course = 0; course < 5; course++) {
        block(shadow, x + side * 4.015, 0.45 + course * 0.44, z, 0.018, 0.035, 6.95);
      }
      for (const end of [-1, 1]) {
        block(pale, x + side * 3.3, 3.04, z + end * 2.9, 0.95, 0.48, 0.95);
        block(sandstone, x + side * 3.3, 3.35, z + end * 2.9, 0.75, 0.16, 0.75);
      }
      block(shadow, x + side * 4.03, 1.55, z - facing * 1.5, 0.03, 1.2, 0.6);
      block(pale, x + side * 4.06, 2.2, z - facing * 1.5, 0.1, 0.12, 0.85);
    }
    // Cloth and timber shelter sits behind the fort, away from its stair approach.
    const back = z - facing * 5.1;
    for (const dx of [-2.4, 2.4]) block(wood, x + dx, 1.7, back, 0.12, 3.4, 0.12);
    batches.add(canopyGeo, teal, x, 3.15, back, 5.1, 1, 2.4);
    block(pale, x, 2.94, back + facing * 1.17, 5.1, 0.35, 0.06);
    batches.add(pot, clay, x + 2.8, 0, back + facing * 0.7, 0.8, 0.9, 0.8);
  }

  // Courtyard gateways receive a curved arch while keeping their central passage open.
  const archShape = new THREE.Shape();
  archShape.moveTo(-2.25, 0); archShape.lineTo(-2.25, 1.25); archShape.lineTo(2.25, 1.25); archShape.lineTo(2.25, 0);
  archShape.bezierCurveTo(1.6, 0.2, 1.2, 0.72, 0, 1.08); archShape.bezierCurveTo(-1.2, 0.72, -1.6, 0.2, -2.25, 0);
  const archGeo = new THREE.ExtrudeGeometry(archShape, { depth: 1.2, bevelEnabled: false, curveSegments: 8 });
  for (const z of [-34, 34]) {
    batches.add(archGeo, pale, 0, 2.55, z - 0.6);
    for (const x of [-2.8, 2.8]) {
      for (let course = 0; course < 8; course++) block(shadow, x, 0.4 + course * 0.5, z - Math.sign(z) * 0.606, 1.04, 0.035, 0.015);
    }
  }

  // Curved date palms with trunk collars, folded fronds and hanging dates.
  for (const [index, palm] of OASIS_PALMS.entries()) {
    const bend = index % 2 ? 0.6 : -0.6;
    for (let section = 0; section < 8; section++) {
      const t = section / 8;
      const x = palm.x + bend * t * t;
      batches.add(trunk, wood, x, palm.h * (t + 1 / 16), palm.z, 1, palm.h / 8 + 0.035, 1, 0, -bend * t * 0.18);
      batches.add(ring, shadow, x, palm.h * t + 0.14, palm.z);
    }
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + index;
      batches.add(frond, foliage[i % 3], palm.x + bend, palm.h, palm.z, 1.3, 2.5, 3.1 + i % 3 * 0.2, a);
    }
    for (let i = 0; i < 3; i++) batches.add(pebble, date, palm.x + bend + Math.cos(i * 2) * 0.3, palm.h - 0.45, palm.z + Math.sin(i * 2) * 0.3, 0.2, 0.5, 0.2);
  }

  // Irregular rocks and reeds trace the actual rectangular water hazard, not a false shore.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 13; i++) {
      const x = -5.9 + i * 0.98;
      batches.add(pebble, i % 3 ? pale : sandstone, x, 0.14, side * 4.16, 0.5, 0.22 + i % 3 * 0.03, 0.29, i);
      if (i % 3 === 1) for (let stem = 0; stem < 4; stem++) block(reeds, x + stem * 0.1, 0.37 + stem * 0.03, side * 4.32, 0.025, 0.8, 0.025);
    }
    for (let i = 0; i < 8; i++) batches.add(pebble, pale, side * 6.14, 0.16, -3.7 + i * 1.05, 0.28, 0.23, 0.5, i);
  }

  // A pair of expedition shelters outside the arena suggest a caravan resting place.
  const tentGeo = new THREE.BufferGeometry();
  tentGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, 0, -1, 0, 1, -1, 1, 0, -1, -1, 0, 1, 0, 1, 1, 1, 0, 1], 3));
  tentGeo.setIndex([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5]); tentGeo.computeVertexNormals();
  for (const side of [-1, 1]) {
    const x = side * 18, z = side * 45;
    batches.add(tentGeo, cloth, x, 0.1, z, 4, 3.8, 3, 0.2);
    block(wood, x, 1.95, z - 2.9, 0.12, 3.9, 0.12);
    block(wood, x, 1.95, z + 2.9, 0.12, 3.9, 0.12);
    for (let i = 0; i < 4; i++) batches.add(pot, clay, x + 4.5, 0, z - 1.5 + i, 0.8, 1.2 - i * 0.12, 0.8);
  }

  const instances = batches.finish(group);
  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent();
      instances.forEach((mesh) => mesh.dispose());
      [cube, dune, rock, frond, pebble, trunk, ring, pot, groundGeo, canopyGeo, archGeo, tentGeo].forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}
