import * as THREE from "three";
import { CHARACTER_PROFILES, type ArmProfile, type CharacterAssetId } from "./characterAssets";

export const CHARACTER_HEIGHT = 1.8;
export type CharacterPose = {
  body: THREE.Group; headPivot: THREE.Group; legs: THREE.Group;
  armGun: THREE.Group; armSup: THREE.Group; mount: THREE.Group;
};
const smooth = (a: number, b: number, x: number) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const vector = (p: readonly number[]) => new THREE.Vector3(p[0], p[1], p[2]);

/** Add shared skin weights to a normalized, +Z-facing copy of a supplied static mesh. */
export function prepareCharacterGeometry(source: THREE.BufferGeometry, asset: CharacterAssetId) {
  const geometry = source.clone(); geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!, size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 0.01) { geometry.dispose(); throw new Error("Empty character geometry"); }
  geometry.translate(-center.x, -bounds.min.y, -center.z).scale(1 / size.y, 1 / size.y, 1 / size.y);
  const p = geometry.getAttribute("position"), indices = new Uint16Array(p.count * 4), weights = new Float32Array(p.count * 4);
  const profile = CHARACTER_PROFILES[asset], point = new THREE.Vector3(), nearest = new THREE.Vector3();
  const arms = [profile.left, profile.right].map(a => ({ ...a, upper: new THREE.Line3(vector(a.shoulder), vector(a.elbow)), lower: new THREE.Line3(vector(a.elbow), vector(a.wrist)) }));
  const legs = profile.legs?.map(leg => [new THREE.Line3(vector(leg.hip), vector(leg.knee)), new THREE.Line3(vector(leg.knee), vector(leg.ankle))]);
  const legDistance = (segments: THREE.Line3[]) => Math.min(...segments.map(segment => {
    segment.closestPointToPoint(point, true, nearest); return nearest.distanceToSquared(point);
  }));
  for (let i = 0; i < p.count; i++) {
    point.fromBufferAttribute(p, i);
    const { x, y } = point;
    let bodyBone = 0, bodyWeight = 0;
    if (y > profile.neck - 0.025) { bodyBone = 1; bodyWeight = smooth(profile.neck - 0.025, profile.neck + 0.065, y); }
    else if (y < profile.hip + 0.035) {
      bodyBone = legs ? (legDistance(legs[0]) < legDistance(legs[1]) ? 2 : 3) : (x < 0 ? 2 : 3);
      bodyWeight = 1 - smooth(profile.hip - 0.055, profile.hip + 0.035, y);
      if (profile.skirt) bodyWeight *= 1 - 0.8 * smooth(0.06, 0.18, y);
    }
    const side = x < 0 ? 0 : 1, arm = arms[side];
    arm.upper.closestPointToPoint(point, true, nearest); const du = nearest.distanceTo(point);
    arm.lower.closestPointToPoint(point, true, nearest); const dl = nearest.distanceTo(point);
    const bottom = Math.min(arm.shoulder[1], arm.elbow[1], arm.wrist[1]) - 0.10;
    const top = profile.armTop ?? Math.max(arm.shoulder[1], arm.elbow[1], arm.wrist[1]) + 0.055;
    const torsoEdge = Math.abs(arm.shoulder[0]) * 0.86 + Math.max(0, arm.shoulder[1] - y) * (profile.armTorsoSlope ?? 0.16);
    const outer = smooth(torsoEdge, torsoEdge + 0.025, Math.abs(x));
    // Sleeve cross-sections need consistent weights: distance falloff across their
    // thickness stretches them apart. Blend only at the shoulder and wrist boundary.
    // The cartoon boy's left hand touches his hat in the supplied sculpt; retain
    // that signature pose rather than tearing the joined hand/hat surface apart.
    const preserveHatHand = asset === "boy" && side === 0;
    const radialWeight = profile.armFalloff ? 1 - smooth(arm.radius, arm.radius * 1.6, Math.min(du, dl)) : 1;
    const armWeight = preserveHatHand || Math.min(du, dl) > arm.radius * 1.6 ? 0
      : outer * radialWeight * smooth(bottom, bottom + 0.035, y) * (1 - smooth(top, top + 0.025, y));
    const foreWeight = smooth(-0.035, 0.035, du - dl);
    const at = i * 4, upperBone = side === 0 ? 4 : 6;
    indices.set([bodyBone, 0, upperBone, upperBone + 1], at);
    weights.set([bodyWeight * (1 - armWeight), (1 - bodyWeight) * (1 - armWeight), armWeight * (1 - foreWeight), armWeight * foreWeight], at);
  }
  geometry.scale(CHARACTER_HEIGHT, CHARACTER_HEIGHT, CHARACTER_HEIGHT);
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function createCharacterRig(geometry: THREE.BufferGeometry, material: THREE.Material, asset: CharacterAssetId) {
  const p = CHARACTER_PROFILES[asset];
  const bone = (name: string, position: readonly number[]) => {
    const b = new THREE.Bone(); b.name = name; b.position.copy(vector(position).multiplyScalar(CHARACTER_HEIGHT)); return b;
  };
  const root = bone("root", [0, 0, 0]), head = bone("head", [0, p.neck, 0]);
  const leftLeg = bone("left leg", p.legs?.[0].hip ?? [-p.legX, p.hip, 0]);
  const rightLeg = bone("right leg", p.legs?.[1].hip ?? [p.legX, p.hip, 0]);
  const makeArm = (a: ArmProfile, name: string) => {
    const upper = bone(`${name} upper arm`, a.shoulder);
    const lower = bone(`${name} forearm`, vector(a.elbow).sub(vector(a.shoulder)).toArray());
    upper.add(lower); root.add(upper);
    return { upper, lower, restUpper: vector(a.elbow).sub(vector(a.shoulder)).normalize(), restLower: vector(a.wrist).sub(vector(a.elbow)).normalize(), wrist: vector(a.wrist).sub(vector(a.elbow)).multiplyScalar(CHARACTER_HEIGHT) };
  };
  root.add(head, leftLeg, rightLeg);
  const left = makeArm(p.left, "left"), right = makeArm(p.right, "right");
  const skeleton = new THREE.Skeleton([root, head, leftLeg, rightLeg, left.upper, left.lower, right.upper, right.lower]);
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = `Supplied ${asset} character`;
  mesh.add(root); mesh.bind(skeleton);
  // Conservative animated bounds avoid clipping limbs without per-frame vertex scans.
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.7);
  mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -0.35, -1), new THREE.Vector3(1, 2.2, 1.5));
  const direction = new THREE.Vector3(), inverse = new THREE.Quaternion(), hand = new THREE.Vector3();
  const poseArm = (arm: typeof left, rotation: THREE.Euler, support: boolean) => {
    if (p.skirt || p.retainArmPose) {
      // Preserve sculpted sleeves and the supplied carry pose, with restrained
      // recoil/celebration motion. The weapon follows the authored hand position.
      arm.upper.rotation.set((rotation.x + (support ? 1.15 : 1.35)) * 0.16, 0, (rotation.z - (support ? 0.95 : 0.05)) * 0.16);
      arm.lower.quaternion.identity();
      return;
    }
    direction.set(0, -1, 0).applyEuler(rotation);
    arm.upper.quaternion.setFromUnitVectors(arm.restUpper, direction);
    inverse.copy(arm.upper.quaternion).invert();
    direction.set(0, -0.94, 0.34).normalize().applyEuler(rotation).applyQuaternion(inverse);
    arm.lower.quaternion.setFromUnitVectors(arm.restLower, direction);
  };
  return { mesh, head, root, skeleton, update(pose: CharacterPose) {
    head.quaternion.copy(pose.headPivot.quaternion);
    leftLeg.rotation.x = pose.legs.children[0].rotation.x * (p.skirt ? 0.55 : 0.8);
    rightLeg.rotation.x = pose.legs.children[1].rotation.x * (p.skirt ? 0.55 : 0.8);
    poseArm(right, pose.armGun.rotation, false); poseArm(left, pose.armSup.rotation, true);
    // Keep the existing paint weapon seated in the imported model's moving hand.
    right.lower.localToWorld(hand.copy(right.wrist)); pose.body.worldToLocal(hand);
    pose.mount.position.copy(hand); pose.mount.position.z += 0.06;
  }, dispose() { skeleton.dispose(); } };
}
