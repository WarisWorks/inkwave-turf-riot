import * as THREE from "three";
import type { CharacterId } from "../types";
import { disposeObject } from "../environment/sceneResources";
import { CHARACTER_ASSETS, type CharacterAssetId } from "./characterAssets";
import { createCharacterRig, prepareCharacterGeometry, type CharacterPose } from "./characterRig";

type Template = { geometry: THREE.BufferGeometry; material: THREE.MeshLambertMaterial };
export type CharacterAttachment = { update(): void; dispose(): void };

/** One decoded/weighted copy of each supplied character per engine, shared by all actors. */
export function createCharacterLibrary() {
  const cache = new Map<CharacterAssetId, Promise<Template | null>>();
  const templates = new Set<Template>(), requests = new Set<AbortController>(), attachments = new Set<CharacterAttachment>();
  const owned = new THREE.Group();
  const badgeGeo = new THREE.BoxGeometry(0.25, 0.3, 0.09);
  const strapGeo = new THREE.BoxGeometry(0.035, 0.42, 0.04);
  const capGeo = new THREE.CylinderGeometry(0.105, 0.12, 0.075, 4).rotateY(Math.PI / 4);
  const capMat = new THREE.MeshLambertMaterial({ color: 0x233348 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xf2dc9c });
  const furGeo = new THREE.SphereGeometry(0.145, 14, 10).scale(1, 0.8, 1);
  const furMat = new THREE.MeshLambertMaterial({ color: 0x543724 });
  const bowlGeo = new THREE.SphereGeometry(0.13, 10, 8).scale(1, 1.45, 0.6);
  const neckGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.78, 6);
  const wood = new THREE.MeshLambertMaterial({ color: 0x925b32 });
  const teamMats = [new THREE.MeshLambertMaterial({ color: 0xff6a1a }), new THREE.MeshLambertMaterial({ color: 0x6452ed })];
  for (const [geometry, material] of [[badgeGeo, teamMats[0]], [strapGeo, teamMats[1]], [capGeo, capMat], [furGeo, furMat], [bowlGeo, wood], [neckGeo, trimMat]] as const) owned.add(new THREE.Mesh(geometry, material));
  let disposed = false;

  function load(asset: CharacterAssetId) {
    let result = cache.get(asset);
    if (!result) {
      result = (async () => {
        const controller = new AbortController(); requests.add(controller);
        const timeout = globalThis.setTimeout(() => controller.abort(), 15000);
        let scene: THREE.Group | undefined;
        try {
          const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
          if (disposed) return null;
          const url = `${import.meta.env?.BASE_URL ?? "/"}models/characters/${asset}.glb`;
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = await response.arrayBuffer();
          if (disposed) return null;
          scene = (await new GLTFLoader().parseAsync(bytes, url.slice(0, url.lastIndexOf("/") + 1))).scene;
          if (disposed) { disposeObject(scene); scene = undefined; return null; }
          let source: THREE.Mesh | undefined;
          scene.traverse(node => { if (node instanceof THREE.Mesh) source = node; });
          if (!source || !(source.material instanceof THREE.MeshStandardMaterial)) throw new Error("Expected a single supplied textured character mesh");
          const geometry = prepareCharacterGeometry(source.geometry, asset);
          const material = new THREE.MeshLambertMaterial({ map: source.material.map, color: source.material.color });
          // The shared template owns the base-color texture from this point onward.
          source.material.map = null; disposeObject(scene); scene = undefined;
          const template = { geometry, material }; templates.add(template); return template;
        } catch (error) {
          if (scene) disposeObject(scene);
          if (!disposed) console.warn(`[Characters] ${asset} unavailable; keeping the Uyghur fallback.`, error);
          return null;
        } finally { globalThis.clearTimeout(timeout); requests.delete(controller); }
      })();
      cache.set(asset, result);
    }
    return result;
  }

  return {
    attach(char: CharacterId, team: 1 | 2, pose: CharacterPose, fallback: THREE.Group): CharacterAttachment {
      const group = new THREE.Group(); group.name = "Supplied Uyghur avatar"; pose.body.add(group);
      let released = false, rig: ReturnType<typeof createCharacterRig> | undefined;
      const attachment: CharacterAttachment = {
        update() { rig?.update(pose); },
        dispose() { if (released) return; released = true; group.removeFromParent(); rig?.dispose(); attachments.delete(attachment); },
      };
      attachments.add(attachment);
      void load(CHARACTER_ASSETS[char]).then(template => {
        if (!template || released || disposed) return;
        rig = createCharacterRig(template.geometry, template.material, CHARACTER_ASSETS[char]);
        group.add(rig.mesh);
        // A small team-colored ink pack preserves team readability without repainting the outfit.
        const pack = new THREE.Mesh(badgeGeo, teamMats[team - 1]); pack.position.set(0, 0.92, -0.16); group.add(pack);
        for (const x of [-0.12, 0.12]) { const strap = new THREE.Mesh(strapGeo, teamMats[team - 1]); strap.position.set(x, 0.98, -0.13); group.add(strap); }
        if (char === "doppa" || char === "telpek") {
          const hat = new THREE.Mesh(char === "telpek" ? furGeo : capGeo, char === "telpek" ? furMat : capMat);
          hat.position.y = char === "telpek" ? 0.38 : 0.39; rig.head.add(hat);
          if (char === "doppa") {
            const trim = new THREE.Mesh(capGeo, trimMat); trim.scale.set(1.015, 0.13, 1.015); trim.position.y = 0.36; rig.head.add(trim);
          }
        }
        if (char === "dutar") {
          const instrument = new THREE.Group(); instrument.position.set(0.1, 0.72, -0.31); instrument.rotation.z = -0.32;
          const bowl = new THREE.Mesh(bowlGeo, wood), neck = new THREE.Mesh(neckGeo, wood); neck.position.y = 0.52;
          instrument.add(bowl, neck); group.add(instrument);
        }
        rig.update(pose); fallback.visible = false;
      });
      return attachment;
    },
    /** Exposed for lifecycle checks and future optional preload UI; gameplay never waits on it. */
    async ready() { await Promise.all(cache.values()); },
    dispose() {
      if (disposed) return; disposed = true;
      requests.forEach(request => request.abort());
      for (const attachment of [...attachments]) attachment.dispose();
      for (const template of templates) owned.add(new THREE.Mesh(template.geometry, template.material));
      disposeObject(owned); owned.clear(); templates.clear(); cache.clear();
    },
  };
}
