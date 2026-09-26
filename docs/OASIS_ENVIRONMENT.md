# Taklimakan oasis

Taklimakan is a desert arena surrounded by modeled dune ridges and eroded sandstone. The original pond, climbable sand terraces, fort platforms, ruined cover walls and mirrored spawns remain in place. New date palms, irregular shoreline stones, reeds, brick courses, niches, battlements, curved gateway infill, sagging cloth shelters, pottery and distant caravan tents give the existing layout a more developed 3D setting.

## Geometry and ownership

- `oasisLayout.ts` holds the original terrace dimensions, fort detailing anchors and palm placements.
- `oasisEnvironment.ts` generates geometry and uses the shared `StaticBatches` helper. There are no imported models, external textures, random runtime layouts or new dependencies.
- Dunes use a 36 × 24 subdivided surface with a curved crest and asymmetric windward/slip-face profile. Forty-eight overlapping instances form two bands outside the arena.
- Twenty sandstone outcrops use low-segment ring meshes with varying radius and alternating vertex colors. Their elongated shapes suggest wind erosion.
- Ten date palms combine curved segmented trunks, collars, folded frond meshes and date clusters. Shared leaf geometry provides shape and depth from above and below.
- The background ground plane fills the space below dunes, outcrops and two caravan shelters. All of this stays outside the playable map.
- Existing gameplay geometry is still built by the engine from `levels.ts`. The two fort roofs now have eight small corner battlement colliders, aligned with the visible detail; their central stair approaches remain open.

The environment owns its meshes, materials and instance buffers. Stage changes/unmount detach the group and dispose each owned resource. Both construction and disposal are synchronous and require no network request.

## Rendering

The arena uses a pale sky, warm sand haze, cool sky fill and one low warm directional light. Lambert materials and vertex colors match the existing renderer; no shadow-map or postprocessing passes are added.

A desert-only branch in the existing turf shader adds subtle sand grain and wind ripples underneath ink. The original XZ ink ownership and scoring are unchanged. The oasis water uses a small Lambert shader extension with moving highlights; the existing water-plane bob and rectangular water hazard remain intact. Stage switches restore the other arenas’ lighting and shader styles.

The complete decorative environment has 100,358 triangles, 679 instances/meshes, 103 batches/meshes, 12 geometries and 14 materials before culling. These are total authored counts, not all necessarily visible in a frame. Keep its geometry below the 120k-triangle regression budget. Visible gameplay also includes the existing arena, characters and effects.

The production output grew by 7,454 bytes compared with the Turpan-only update, to 2,046,223 bytes (about 1.95 MiB), including Turpan’s existing minaret and excluding the remotely hosted interface font. Taklimakan adds no GLB or texture downloads. The existing engine-chunk warning remains (about 720 kB).

## Gameplay and authoring constraints

- Decorative dune slopes are outside the arena and are not traversable terrain. Inside, the original 0.45 m stepped sand terraces remain paintable and climbable.
- The central pond retains the same X/Z hazard rectangle: -6…6 by -4…4. Shore stones trace that rectangle so decoration does not advertise safe ground over water.
- Small palms, reeds, fabrics and pottery remain decorative, like the original vegetation. Major cover and fort battlements use simple boxes; ornament is not exact triangle collision.
- The original pool-routing bot behavior is retained. Kashgar’s layered navigation is not applied to Taklimakan.
- If adding a large playable object, author matching collision in `levels.ts` and verify the actual movement paths. Do not cover spawn positions, fort stairs or either side of the pond with new obstacles.

## Verification

```sh
npm test
npm run build
npm run preview
# Add ?perf=1 to inspect renderer counters.
```

Six new regression checks verify all twelve expanded spawn slots, both fort stair routes, both main terrace summits, both shore routes and the water hazard, finite/budgeted procedural geometry without fetching assets, and complete resource disposal. Together with existing Kashgar, Turpan and match-result coverage, 34 tests pass.

Browser checks cover the production scene, real shader compilation, match countdown and live 6v6 painting. Physical lower-end phones and competitive balance still need playtesting; desktop browser measurements do not establish mobile GPU performance.
