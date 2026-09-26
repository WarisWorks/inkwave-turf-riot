// Offline correction for the supplied blue-doppa boy's rear ponytail.
// Keep the existing outfit/texture; close the trimmed hair surface before export.
import { readFileSync, writeFileSync } from 'node:fs';
import { Vector2, Vector3, ShapeUtils, BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Triangle } from 'three';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

export async function shortenBoyHair(path) {
  const input = readFileSync(path), jsonSize = input.readUInt32LE(12);
  const doc = JSON.parse(input.toString('utf8', 20, 20 + jsonSize)), binary = input.subarray(28 + jsonSize);
  if (doc.nodes?.[0]?.name !== 'Supplied Uyghur boy' || doc.meshes?.length !== 1 || doc.meshes[0].primitives.length !== 1) {
    throw new Error('This correction requires the prepared blue-doppa boy mesh.');
  }
  if (doc.asset.extras?.hairStyle === 'short') return null;
  const primitive = doc.meshes[0].primitives[0];
  const read = (id, components) => {
    const accessor = doc.accessors[id], view = doc.bufferViews[accessor.bufferView];
    const Type = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[accessor.componentType];
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    return new Type(binary.buffer.slice(binary.byteOffset + offset, binary.byteOffset + offset + accessor.count * components * Type.BYTES_PER_ELEMENT));
  };
  const positions = read(primitive.attributes.POSITION, 3), normals = read(primitive.attributes.NORMAL, 3), uvs = read(primitive.attributes.TEXCOORD_0, 2), indices = read(primitive.indices, 1);
  const sourceVertex = i => ({ p: Array.from(positions.subarray(i * 3, i * 3 + 3)), n: Array.from(normals.subarray(i * 3, i * 3 + 3)), uv: Array.from(uvs.subarray(i * 2, i * 2 + 2)) });
  // This small volume surrounds the asymmetric tied hair behind the left ear.
  const distance = ([x, y, z]) => Math.max(-.145 - x, x + .025, .655 - y, y - .784, z + .85 * (y - .76) + .105);
  let faces = [];
  let removed = 0;
  for (let at = 0; at < indices.length; at += 3) {
    const triangle = Array.from(indices.subarray(at, at + 3), sourceVertex), clipped = [];
    for (let i = 0; i < 3; i++) {
      const a = triangle[i], b = triangle[(i + 1) % 3], da = distance(a.p), db = distance(b.p);
      if (da >= 0) clipped.push(a);
      if ((da < 0) !== (db < 0)) {
        const t = da / (da - db), mix = (a, b) => a.map((v, c) => v + t * (b[c] - v));
        clipped.push({ p: mix(a.p, b.p), n: new Vector3(...mix(a.n, b.n)).normalize().toArray(), uv: mix(a.uv, b.uv) });
      }
    }
    if (triangle.some(v => distance(v.p) < 0)) removed++;
    for (let i = 1; i < clipped.length - 1; i++) faces.push([clipped[0], clipped[i], clipped[i + 1]]);
  }
  const key = v => v.p.map(c => Math.round(c * 1e6)).join(',');
  const parent = new Map();
  const root = k => { let r = k; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(k) !== k) { const next = parent.get(k); parent.set(k, r); k = next; } return r; };
  for (const face of faces) {
    const keys = face.map(key); for (const k of keys) if (!parent.has(k)) parent.set(k, k);
    for (const k of keys.slice(1)) parent.set(root(k), root(keys[0]));
  }
  const counts = new Map(); for (const face of faces) { const k = root(key(face[0])); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const largest = [...counts].sort((a,b) => b[1]-a[1])[0][0];
  faces = faces.filter(face => root(key(face[0])) === largest);
  const edges = new Map();
  for (const face of faces) for (let i = 0; i < 3; i++) {
    const a = face[i], b = face[(i + 1) % 3], id = [key(a), key(b)].sort().join('/');
    if (edges.has(id)) edges.delete(id); else edges.set(id, [a, b]);
  }
  const pending = [...edges.values()], loops = [];
  while (pending.length) {
    const [a, b] = pending.pop(), loop = [a, b];
    while (key(loop.at(-1)) !== key(loop[0])) {
      const last = key(loop.at(-1)), i = pending.findIndex(e => key(e[0]) === last || key(e[1]) === last);
      if (i < 0) throw new Error('Open hair boundary; refusing to export');
      const [edge] = pending.splice(i, 1); loop.push(key(edge[0]) === last ? edge[1] : edge[0]);
    }
    loop.pop(); loops.push(loop);
  }
  // Rebuild the small back-of-head patch from the opposite short-haired side.
  // Sampling a single source face for each small triangle avoids crossing UV islands.
  const source = new BufferGeometry(); source.setAttribute('position', new BufferAttribute(positions, 3)); source.setAttribute('normal', new BufferAttribute(normals, 3)); source.setAttribute('uv', new BufferAttribute(uvs, 2)); source.setIndex(new BufferAttribute(indices, 1));
  const material = new MeshBasicMaterial(), mesh = new Mesh(source, material), ray = new Raycaster();
  mesh.updateMatrixWorld(true);
  const sample = p => { ray.set(new Vector3(-p[0], p[1], -.5), new Vector3(0, 0, 1)); return ray.intersectObject(mesh)[0]; };
  const boundary = new Set(loops.flatMap(loop => loop.map(key)));
  const edgeKey = (a,b) => [key(a),key(b)].sort().join('/');
  const boundaryEdges = new Set(loops.flatMap(loop=>loop.map((v,i)=>edgeKey(v,loop[(i+1)%loop.length]))));
  const project = v => {
    if (boundary.has(key(v))) return v;
    const hit = sample(v.p); if (!hit) throw new Error('Cannot reconstruct short-hair patch');
    return { ...v, p: [v.p[0], v.p[1], hit.point.z] };
  };
  const patch = (triangle, depth = 0) => {
    if (depth < 3) {
      const [a,b,c] = triangle, mid = (a,b) => ({ p: a.p.map((v,i)=>(v+b.p[i])/2) });
      const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      // Preserve cut edges; interior vertices follow the intact opposite scalp.
      for (const [v,start,end] of [[ab,a,b],[bc,b,c],[ca,c,a]]) if (boundaryEdges.has(edgeKey(start,end))) { boundary.add(key(v)); boundaryEdges.add(edgeKey(start,v)); boundaryEdges.add(edgeKey(v,end)); }
      for (const t of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]) patch(t,depth+1);
      return;
    }
    const face=triangle.map(project), center=face[0].p.map((_,i)=>face.reduce((sum,v)=>sum+v.p[i],0)/3);
    // The doppa tilts across the head. Sample below its band so mirroring the
    // opposite side cannot paint blue hat pixels into the repaired brown hair.
    const uvShift = Math.max(0, center[1] - .752);
    const hit=sample([center[0],center[1]-uvShift,center[2]]);
    if (!hit) throw new Error('Missing mirrored hair surface');
    const corners=[hit.face.a,hit.face.b,hit.face.c], sourceTriangle = new Triangle(...corners.map(i=>new Vector3().fromArray(positions,i*3)));
    const n = hit.normal.clone(); n.x *= -1;
    for (const v of face) {
      const closest = sourceTriangle.closestPointToPoint(new Vector3(-v.p[0],v.p[1]-uvShift,v.p[2]),new Vector3()), bary=sourceTriangle.getBarycoord(closest,new Vector3());
      v.n=n.toArray(); v.uv=[0,1].map(c=>corners.reduce((sum,i,k)=>sum+uvs[i*2+c]*bary.getComponent(k),0));
    }
    const normal=new Vector3().subVectors(new Vector3(...face[1].p),new Vector3(...face[0].p)).cross(new Vector3().subVectors(new Vector3(...face[2].p),new Vector3(...face[0].p)));
    if(normal.z>0)face.reverse(); faces.push(face);
  };
  for (const loop of loops) for (const indices of ShapeUtils.triangulateShape(loop.map(v=>new Vector2(v.p[0],v.p[1])),[])) patch(indices.map(i=>({p:[...loop[i].p]})));
  source.dispose(); material.dispose();
  const compact = new Map(), vertices = [], nextIndices = [];
  for (const face of faces) for (const v of face) {
    const id = [...v.p, ...v.n, ...v.uv].map(n => Math.round(n * 1e7)).join(',');
    if (!compact.has(id)) { compact.set(id, vertices.length); vertices.push(v); }
    nextIndices.push(compact.get(id));
  }
  const pos = new Float32Array(vertices.flatMap(v => v.p)), normal = new Float32Array(vertices.flatMap(v => v.n)), uv = new Float32Array(vertices.flatMap(v => v.uv));
  const attributes = new Float32Array(vertices.length * 5);
  for(let i=0;i<vertices.length;i++) { attributes.set(normal.subarray(i*3,i*3+3),i*5);attributes.set(uv.subarray(i*2,i*2+2),i*5+3); }
  await MeshoptSimplifier.ready;
  const [reduced] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(nextIndices),pos,3,attributes,5,[.2,.2,.2,1,1],null,42000,.001,['Permissive']);
  const [remap,count] = MeshoptSimplifier.compactMesh(reduced);
  const pack = (array,n) => { const out=new Float32Array(count*n);for(let i=0;i<remap.length;i++) if(remap[i]!==0xffffffff)out.set(array.subarray(i*n,(i+1)*n),remap[i]*n);return out; };
  const packedPos=pack(pos,3), packedNormal=pack(normal,3), packedUV=pack(uv,2);
  const min = [0,1,2].map(c=>Infinity),max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<packedPos.length;i++){min[i%3]=Math.min(min[i%3],packedPos[i]);max[i%3]=Math.max(max[i%3],packedPos[i]);}
  const imageView = doc.bufferViews[doc.images[0].bufferView];
  const texture = binary.subarray(imageView.byteOffset, imageView.byteOffset + imageView.byteLength);
  const buffers = [packedPos, packedNormal, packedUV, new Uint16Array(reduced), texture];
  const chunks = []; let offset = 0;
  doc.bufferViews = buffers.map((array, i) => {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength), padding = Buffer.alloc((4 - bytes.length % 4) % 4);
    const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(i < 4 ? { target: i === 3 ? 34963 : 34962 } : {}) };
    chunks.push(bytes, padding); offset += bytes.length + padding.length; return view;
  });
  for (let i = 0; i < 3; i++) doc.accessors[i].count = count;
  Object.assign(doc.accessors[0], { min, max }); doc.accessors[3].count = reduced.length;
  doc.buffers[0].byteLength = offset; doc.asset.extras = { ...doc.asset.extras, hairStyle: 'short' };
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]), bin = Buffer.concat(chunks);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + bin.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4);
  const result = Buffer.concat([header, padded, binHeader, bin]); writeFileSync(path, result);
  return { runtimeBytes: result.length, runtimeTriangles: reduced.length / 3, vertices: count, bounds: { min, max }, hairStyle: 'short', trimmedTriangles: removed };
}
