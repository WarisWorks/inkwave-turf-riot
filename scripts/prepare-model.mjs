// Offline only. Requires the installed Three.js package and Python 3 + Pillow.
// Shared single-mesh GLB preparation used by the stage-specific scripts.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

export async function prepareModel(source, destination, name, triangles = 24000, removeFloatingParts = false, options = {}) {
const input = readFileSync(source);
if (input.readUInt32LE(0) !== 0x46546c67 || input.readUInt32LE(4) !== 2) throw new Error('Expected GLB v2');
const jsonSize = input.readUInt32LE(12);
const original = JSON.parse(input.toString('utf8', 20, 20 + jsonSize));
const binary = input.subarray(28 + jsonSize);
const primitive = original.meshes[0].primitives[0];
if (original.meshes.length !== 1 || original.meshes[0].primitives.length !== 1 || original.nodes.length !== 1 || original.nodes[0].matrix || original.nodes[0].scale || original.nodes[0].rotation) {
  throw new Error('This preparation recipe expects a single mesh with at most a node translation.');
}

function attribute(index, components) {
  const a = original.accessors[index], view = original.bufferViews[a.bufferView];
  if (a.sparse || ![5123, 5125, 5126].includes(a.componentType)) throw new Error('Unsupported source accessor');
  const bytes = a.componentType === 5123 ? 2 : 4;
  const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = view.byteStride ?? bytes * components;
  const result = a.componentType === 5126 ? new Float32Array(a.count * components) : new Uint32Array(a.count * components);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < components; c++) {
    const at = offset + i * stride + c * bytes;
    result[i * components + c] = a.componentType === 5126 ? binary.readFloatLE(at) : bytes === 2 ? binary.readUInt16LE(at) : binary.readUInt32LE(at);
  }
  return result;
}

const positions = attribute(primitive.attributes.POSITION, 3);
const translation = original.nodes[0].translation ?? [0, 0, 0];
for (let i = 0; i < positions.length; i++) positions[i] += translation[i % 3];
const normals = attribute(primitive.attributes.NORMAL, 3);
const uv = attribute(primitive.attributes.TEXCOORD_0, 2);
const indices = attribute(primitive.indices, 1);
const attributes = new Float32Array(positions.length / 3 * 5);
for (let i = 0; i < positions.length / 3; i++) {
  attributes.set(normals.subarray(i * 3, i * 3 + 3), i * 5);
  attributes.set(uv.subarray(i * 2, i * 2 + 2), i * 5 + 3);
}
await MeshoptSimplifier.ready;
const flags = options.preserveTextureSeams ? ['Prune'] : ['Permissive', 'Prune'];
let [reduced, error] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attributes, 5, [0.2, 0.2, 0.2, 1, 1], null, triangles * 3, 0.025, flags);
// The supplied tower has two disconnected domes suspended in empty space.
// Weld UV seams for connectivity only, then retain its principal structure.
if (removeFloatingParts) {
  const parent = new Map(), welded = new Map();
  const root = (i) => { let r = i; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(i) !== i) { const next = parent.get(i); parent.set(i, r); i = next; } return r; };
  for (const i of reduced) {
    if (parent.has(i)) continue;
    parent.set(i, i);
    const key = Array.from(positions.subarray(i * 3, i * 3 + 3), v => Math.round(v * 1e5)).join(',');
    if (welded.has(key)) parent.set(root(i), root(welded.get(key)));
    else welded.set(key, i);
  }
  for (let i = 0; i < reduced.length; i += 3) {
    parent.set(root(reduced[i + 1]), root(reduced[i]));
    parent.set(root(reduced[i + 2]), root(reduced[i]));
  }
  const counts = new Map();
  for (const i of reduced) { const r = root(i); counts.set(r, (counts.get(r) ?? 0) + 1); }
  const largest = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  reduced = reduced.filter(i => root(i) === largest);
}
const [remap, vertexCount] = MeshoptSimplifier.compactMesh(reduced);
function compact(array, components) {
  const result = new Float32Array(vertexCount * components);
  for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) result.set(array.subarray(i * components, (i + 1) * components), remap[i] * components);
  return result;
}
const pos = compact(positions, 3), normal = compact(normals, 3), texcoord = compact(uv, 2);
if (options.smoothNormals) {
  // Dense sculpts can carry noisy source normals after decimation. Average face
  // normals across positional UV seams without changing the texture coordinates.
  const keys = [], sums = new Map();
  for (let i = 0; i < vertexCount; i++) {
    const key = Array.from(pos.subarray(i * 3, i * 3 + 3), v => Math.round(v * 1e6)).join(',');
    keys.push(key); if (!sums.has(key)) sums.set(key, [0, 0, 0]);
  }
  for (let i = 0; i < reduced.length; i += 3) {
    const [a, b, c] = reduced.subarray(i, i + 3);
    const u = [0, 1, 2].map(k => pos[b * 3 + k] - pos[a * 3 + k]);
    const v = [0, 1, 2].map(k => pos[c * 3 + k] - pos[a * 3 + k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const vertex of [a, b, c]) for (let k = 0; k < 3; k++) sums.get(keys[vertex])[k] += n[k];
  }
  for (let i = 0; i < vertexCount; i++) {
    const n = sums.get(keys[i]), length = Math.hypot(...n);
    if (length > 0) normal.set(n.map(v => v / length), i * 3);
  }
}
const compactIndices = vertexCount < 65536 ? new Uint16Array(reduced) : reduced;
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (let i = 0; i < pos.length; i++) { bounds.min[i % 3] = Math.min(bounds.min[i % 3], pos[i]); bounds.max[i % 3] = Math.max(bounds.max[i % 3], pos[i]); }

const temp = mkdtempSync(join(tmpdir(), 'inkwave-texture-'));
let texture;
try {
  const textureIndex = original.materials[primitive.material].pbrMetallicRoughness.baseColorTexture.index;
  const image = original.images[original.textures[textureIndex].source];
  const view = original.bufferViews[image.bufferView];
  writeFileSync(join(temp, 'source.jpg'), binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
  execFileSync('python3', ['-c', 'from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert("RGB"); im.thumbnail((1024,1024), getattr(Image,"Resampling",Image).LANCZOS); im.save(sys.argv[2], quality=84, optimize=True)', join(temp, 'source.jpg'), join(temp, 'color.jpg')]);
  texture = readFileSync(join(temp, 'color.jpg'));
} finally { rmSync(temp, { recursive: true, force: true }); }

const chunks = [], views = [], accessors = [];
let byteOffset = 0;
function addView(data, target) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const index = views.length;
  views.push({ buffer: 0, byteOffset, byteLength: bytes.length, ...(target ? { target } : {}) });
  chunks.push(bytes, Buffer.alloc((4 - bytes.length % 4) % 4));
  byteOffset += bytes.length + (4 - bytes.length % 4) % 4;
  return index;
}
function addAccessor(data, components, type, componentType, extra = {}) {
  const bufferView = addView(data, type === 'SCALAR' ? 34963 : 34962);
  accessors.push({ bufferView, componentType, count: data.length / components, type, ...extra });
  return accessors.length - 1;
}
const positionAccessor = addAccessor(pos, 3, 'VEC3', 5126, bounds);
const normalAccessor = addAccessor(normal, 3, 'VEC3', 5126);
const uvAccessor = addAccessor(texcoord, 2, 'VEC2', 5126);
const indexAccessor = addAccessor(compactIndices, 1, 'SCALAR', vertexCount < 65536 ? 5123 : 5125);
const imageView = addView(texture);
const document = {
  asset: { version: '2.0', generator: 'InkWave offline simplification' }, scene: 0,
  scenes: [{ nodes: [0] }], nodes: [{ name, mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor, TEXCOORD_0: uvAccessor }, indices: indexAccessor, material: 0 }] }],
  materials: [{ name: 'Baked architecture', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
  textures: [{ source: 0 }], images: [{ bufferView: imageView, mimeType: 'image/jpeg' }],
  buffers: [{ byteLength: byteOffset }], bufferViews: views, accessors,
};
const json = Buffer.from(JSON.stringify(document));
const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const bin = Buffer.concat(chunks);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonPadded.length + bin.length, 8); header.writeUInt32LE(jsonPadded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, jsonPadded, binHeader, bin]);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, output);
return { source: basename(source), sourceSha256: createHash('sha256').update(input).digest('hex'), sourceBytes: input.length, sourceTriangles: indices.length / 3, runtimeBytes: output.length, runtimeTriangles: reduced.length / 3, vertices: vertexCount, simplificationError: error, maxTextureSize: 1024, bounds, removeFloatingParts, ...options };
}
