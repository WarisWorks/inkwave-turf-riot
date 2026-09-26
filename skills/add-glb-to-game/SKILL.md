---
name: add-glb-to-game
description: Integrate supplied GLB or glTF models into an existing game, including asset inspection, optimization, placement, character animation, loading, and verification. Use for replacing a player model, adding buildings or props, fixing imported model appearance, or cleaning up unused originals. This skill integrates existing assets; it does not generate new 3D models.
---

# Add GLB Models to a Game

Make the supplied model appear correctly in the actual game, within its performance budget and existing gameplay architecture. A successful import includes the runtime asset, its game integration, resource ownership, and evidence that it works.

For Three.js/Vite projects, read [the implementation notes](references/threejs.md) when implementing loading, placement, animation, or packaging. For another engine, use its existing importer and actor/prefab system; check the installed engine version before choosing import APIs or adding a plugin.

## Establish what is being replaced

- Read the project's README, project/progress notes, asset registry, loader, actor creation, scene teardown, and build configuration. Reuse working paths.
- Identify whether the asset is a player, NPC, static prop, decorative landmark, or navigable building. Record the intended game object and current runtime URL.
- Find the exact supplied file. Use the user's confirmed selection across turns. If several candidates remain ambiguous, inspect them and ask only for the missing choice; do not silently substitute a different model.
- Preserve existing character IDs, save compatibility, weapons, abilities, physics, and camera behavior when the task only changes appearance.

## Inspect before optimizing

Record source filename, bytes, checksum, meshes/primitives, triangle and vertex counts, bounds, node transforms, materials, texture dimensions, skins, morph targets, animation clips, and required extensions. Use a format-aware loader or validator; a filename containing “animated” proves nothing about its contents.

View the original from front, back, and side. Check hair, headwear, garment shape, fingers, footwear, floating pieces, ground contact, and the pose. Compare with the user's supplied reference when available. Distinguish a defect already present in the source from one introduced by simplification, rigging, or overlapping fallback meshes.

Choose the treatment from the actual asset:

| Asset | Treatment |
| --- | --- |
| Static prop/building | Preserve scene hierarchy/materials; place through a wrapper transform; author simple collision separately where needed. |
| Character with skin and clips | Preserve bones, inverse bind matrices, weights, morphs, and clips; map available actions to gameplay. |
| Skinned character without clips | Use compatible animation or a fitted pose system; do not assume arbitrary clips can bind correctly. |
| Unrigged posed sculpt | Use as a static model, apply restrained procedural motion, or perform a proper rigging pass according to the requested gameplay. Explain animation limits. |

Do not extract only the last mesh from a multi-mesh character: hair, eyes, clothing, and accessories may be separate nodes. A specialized single-mesh pipeline must verify that assumption before transforming an asset.

## Prepare a runtime derivative

Keep authoring inputs separate from deployed assets. Choose distinct source/output paths and refuse accidental in-place processing. Prefer a repeatable recipe that accepts an external source path and produces a small manifest containing provenance, settings, output bytes, and geometry counts.

Choose budgets from camera distance, simultaneous instances, target devices, and the existing scene. For a small stylized browser arena, roughly 10–25k triangles and a 1024 px color texture can be a useful initial character budget; this is a starting point, not a requirement. Measure total visible geometry, material/draw-call count, texture memory, load time, and frame time. Small download size alone does not establish runtime performance.

- Simplify offline with UV boundaries, silhouette, joints, thin details, and material boundaries in mind. Preserve skin/morph attributes if present.
- Compare the derivative against the original after each substantial reduction. Increase the budget or change settings when the face, embroidery, fingers, or silhouette degrades.
- Reduce oversized textures while preserving readable details and alpha where required. Do not convert transparent hair/foliage to opaque JPEG.
- Recompute normals only when needed. Smooth surfaces may benefit; architectural corners and intentional hard edges should stay sharp.
- Preserve the material response unless a simpler material fits the game's established style. Check the result under the game's lighting.
- Mesh compression, texture compression, and simplification solve different problems. Configure and package required decoders/transcoders before choosing compressed output; measure their startup cost too.
- Preserve the complete rigged hierarchy. Do not run a flattening, single-mesh sculpt recipe over a skinned or animated asset.

Do not promise the same reduction ratio for every asset. In the originating game, one dense static character sculpt became 676,516 bytes and 19,999 triangles from a 61,048,116-byte source; that result depended on its texture, topology, and visual review.

## Integrate with gameplay

1. Register the runtime model in the existing asset mapping. Update the player, bots, loadout preview, or stage placements that actually use that mapping.
2. Normalize scale and orientation once from observed bounds and game units. Put placement transforms on a wrapper and keep imported child/bone transforms intact. Validate ground contact from several views.
3. Load asynchronously through the game's asset service. Deduplicate concurrent loads by asset identity and limit simultaneous heavy loads. Keep a suitable fallback/loading state until the replacement is ready; hide it after successful attachment so models do not overlap.
4. Keep visual geometry separate from collision, hit volumes, paint surfaces, and navigation unless the game deliberately uses mesh collision. Use simple gameplay volumes and verify doors, stairs, spawn clearance, and reachable routes.
5. Share immutable geometry/textures across instances. Give independently animated actors their own skeleton and animation state. Clone materials only when an instance needs independent material properties.
6. Attach weapons and accessories to the appropriate hand/head/body anchor. Keep team readability without painting over the supplied outfit unless requested.

For authored animation, inspect clip names, bind pose, facing direction, and root motion. Avoid moving an actor twice through both animation and physics. For generated rigs, fit guides to the actual pose: crossed legs cannot be assigned solely by the sign of a vertex's X coordinate. Protect facial/ear vertices from arm weights and normalize skin weights. Fused sleeves or hands touching the head may require retaining the sculpted pose instead of forcing a wide aiming pose. Verify idle, movement, aiming, recoil, and celebration where present.

## Handle lifecycle and failures

Make ownership explicit: the asset cache owns shared resources; an actor owns its instance, skeleton, mixer, and attachments. Removing one actor must not dispose textures still used by others.

Handle missing files, HTTP failures, unsupported extensions, decode errors, and leaving a scene during a load. Abort supported requests and discard or release late results after their owner is gone. A download abort does not automatically cancel decoding already in progress. Avoid unbounded retries or duplicate loads on every frame.

On scene/engine teardown, release owned geometry, materials, textures, skeleton resources, animation bindings, and decoded images as appropriate. Deduplicate shared resources before disposal. Repeated stage switching should not accumulate requests, actors, or GPU allocations.

## Verify in the real game

- Run relevant existing tests, type checks, and production build. Add tests only for meaningful new behavior or regression risks: URL mapping, independent actor animation, load sharing, failure fallback, and late-result cleanup.
- Visually inspect the model in the actual loadout and gameplay, including the usual rear camera view. Check textures, scale, lighting, pose, accessories, clipping, and animation deformation. A build alone cannot verify appearance.
- Check concurrent actors and scene transitions. Profile on the target device before making mobile-performance claims.
- Inspect production output and network paths. Verify every active model and decoder is packaged, filenames match case, the deployment base path works, and the large source is excluded.
- If a viewer or production preview cannot run, report exactly which checks passed and which visual checks remain. Do not describe an unseen model as visually verified.

## Clean up unused originals when requested

First confirm the game, previews, tests, and build use the derivative and no longer need the source. Check dynamic registries and constructed URLs as well as literal filename searches. Update preparation scripts to accept an external original if their old default points at the source being removed.

Delete only the confirmed unused files within the user's cleanup scope. Retain active derivatives, requested reserved models, provenance manifests, and unrelated work. Compare hashes of retained assets before and after cleanup. Excluding an original from production and deleting it from the workspace are separate actions; report the storage reduction accurately. Do not delete authoring originals merely because a derivative was created.

## Finish with a useful handoff

Update existing project progress/asset notes with the selected model, source-to-runtime mapping, budgets, preparation command, integration points, and known animation limits. Preserve earlier history. Briefly report what changed, before/after size when relevant, validation performed, and any remaining checks.
