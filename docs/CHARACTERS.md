# Supplied Uyghur characters

The default player now uses the newly supplied **`cute-character.glb`**: the boy with a black doppa, short curly hair, embroidered white shirt and boots. The user explicitly confirmed that this is the file meant by the latest request for “character.glb.” Its optimized runtime copy is `cute.glb`. The existing `wave` ID, balanced perk and saved progression remain compatible.

## Assets and roster

| Character ID | Supplied source | Appearance |
| --- | --- | --- |
| wave | `cute-character.glb` | New black-doppa boy; default |
| doppa | `animated+boy+character+3d+model.glb` | Embroidered shirt, boots and small dark doppa |
| braids | `girl character 3d model.glb` | Original braids and patterned dress |
| telpek | `animated+boy+character+3d+model.glb` | Rounded fur hat |
| scarf | `traditional dress character 3d model (1).glb` | Original Etles outfit |
| dutar | `3d cartoon boy model.glb` | Previous blue-doppa boy, corrected short hair and a dutar |

The same roster is used for the player, loadout showcase and bots. Team-colored ink packs, weapons and name tags retain combat readability without tinting the supplied clothing.

Five runtime models in `public/models/characters/` total **3,109,140 bytes** and **75,998 triangles**. Each uses one embedded 1024 px base-color JPEG. The new `cute.glb` is **676,516 bytes / 19,999 triangles**, prepared from a **61,048,116-byte / 1,883,938-triangle** source. Its preparation preserves UV seams and recomputes smooth normals to avoid visible artifacts from simplifying the dense sculpt. The other four derivatives remain unchanged.

The unused 61,048,116-byte `cute-character.glb` original was deleted at the user's request after verifying the game uses `cute.glb`. All runtime models and manifest provenance remain unchanged. Normal development and builds need no original; regenerating the derivative requires an external source GLB. Vite derives the character GLB allowlist from `CHARACTER_ASSETS`: it ships `cute.glb` and the other four active derivatives. The earlier, different `character.glb` with an authored skin disappeared from its observed path in a prior session; it is not required for this integration. The four earlier sources remain in `/tmp/inkwave-removed-models-vq60b2hs/models`; this temporary location is not a permanent archive.

## Animation and lifecycle

The five sources used by the current roster contain no skins or animation clips, including the file named “animated boy.” `characterAssets.ts` records anatomical guides for their actual poses. `characterRig.ts` normalizes each mesh to 1.8 m, generates four skin weights per vertex and creates an independent eight-bone skeleton for each instance. Geometry, materials and decoded textures are shared across all instances of an asset.

The new boy retains the supplied walking stance and raised-hand pose. Its crossed legs use separate 3D limb guides, so vertices on the opposite side of the body stay attached to the correct leg. Its arm weights stop below the face/ears and fade around the torso. Arms add restrained recoil and celebration motion to the authored pose; the paint weapon follows the right hand. This avoids stretching the sculpted shirt into a different aiming pose.

The previous blue-doppa boy retains his sculpted hand-on-hat pose. Girls retain their authored sleeve/carry poses with restrained recoil and hip-held weapons. These are lightweight procedural rigs, not artist-authored animation clips. Facial expressions remain baked into the supplied textures.

Swimming and wall climbing still use the existing ink-swim form. Gameplay collision, hit volumes, weapons, perks and movement rules are unchanged.

`characterLibrary.ts` caches one request/decode per asset per engine. While loading or on failure, a procedural Uyghur character with headwear remains visible. Downloads time out after 15 seconds. Replacing a character disposes its independent skeleton; engine teardown aborts outstanding requests, discards late decodes, detaches instances and releases shared resources once. Stage changes reuse the character cache.

## Rebuild and verify

```sh
# Rebuild the new default only when an external original is available.
node scripts/prepare-cute-character.mjs /path/to/cute-character.glb

# Rebuild the four earlier models from their original source folder when needed.
node scripts/prepare-character-models.mjs /path/to/original/model/folder

npm test
npm run build
```

Both preparation scripts retain other entries in the shared manifest. The common recipe uses Three.js's bundled mesh simplifier and Python/Pillow; it does not edit the originals. The new character opts into UV-seam preservation and smooth normals. Existing models keep their previous settings.

The blue-doppa boy passes through `scripts/shorten-boy-hair.mjs`: trim the tied rear hair, discard its disconnected tip, rebuild the small scalp patch from the opposite short-haired side, and return to the 14k triangle budget. This correction is calibrated to that sculpt and now applies to the `dutar` model only. Review the mesh if replacing its source.

Twelve character tests cover save compatibility, asset budgets, the old ponytail correction, the new authored idle pose, crossed-boot assignments, face/ear isolation, normalized weights, independent animated skeletons and shared loading/disposal. **All 58 project tests, TypeScript and the Vite build pass.** Browser review covered the source/optimized model comparison, the fitted rig, loadout and live gameplay on the verified development server.

The complete production output is **9,232,566 bytes (about 8.8 MiB)**, excluding the existing remote interface font. All eleven active GLBs are packaged; the large new source is excluded. A separate production browser preview was not verified this session: sandbox permissions prevented a new preview listener, and automatic approval review blocked the attempted preview origin because it could point to an unrelated local app. File-level production checks verified the packaged model matches the tested runtime asset.

The existing large engine-chunk warning remains (about 733 kB). Physical phone performance and detailed animation/garment review during all specials remain follow-up playtests.
