# Turpan vineyard

Turpan keeps its original karez canal, five crossings, drying houses, two team spawn areas and Flaming Mountains. Eight planted grape rows now have timber trellises, low vine growth, overhead foliage and hanging bunches. A vine-covered supa pavilion spans the central bridge. Harvest racks/baskets and thirteen additional rows beyond the walls make the arena read as cultivated land. An extended ground plane supports the background planting and landmark.

## Historic minaret

The user explicitly selected `historic minaret 3d model.glb` for Turpan after the previous removal of the heavy model library. This is Turpan’s only model; Urumqi separately uses five supplied buildings, while Kashgar and Taklimakan remain procedural.

The supplied asset includes a tapered, patterned brick minaret and its surrounding courtyard compound. It is placed outside the west wall at X=-47, Z=3, with a uniform scale to 22 m tall and a 90-degree turn toward the arena. Its entire footprint stays outside the combat boundary; it has no gameplay collision, interior access or turf scoring.

| Asset | Original | Runtime derivative |
| --- | ---: | ---: |
| File size | 57,919,628 bytes | 949,908 bytes |
| Triangles | 1,897,127 | 23,988 |
| Vertices | 1,007,602 | 18,431 |
| Textures | Base color, roughness/metalness, normal | One embedded 1024 px JPEG base color |

The original remains intact at `/tmp/inkwave-removed-models-vq60b2hs/models/historic minaret 3d model.glb`. Temporary storage is not a permanent archive; keep a durable source copy outside `public/` if future asset editing is needed. Only the derivative and its measured manifest belong in `public/models/turpan/`.

## Implementation

- `turpanLayout.ts` defines the shared row positions and landmark transform. The narrow soil beds are solid boxes in `levels.ts`; visual posts, foliage and grapes are decorative.
- `turpanEnvironment.ts` builds the vineyard from shared low-segment geometry and Lambert materials. `staticBatches.ts` is shared with Kashgar and groups repeated meshes into 32 m cells for culling.
- The minaret uses a dynamic import of Three.js’s GLTFLoader, fetched only when Turpan is selected. No external decoder or new npm dependency is required. The baked texture uses Lambert shading to match the existing game.
- Gameplay and Start remain available while the model loads. A simple procedural tower/compound remains visible on failure; a 15-second request timeout prevents a hanging download.
- Leaving Turpan aborts its pending request and disposes geometry, materials, instance buffers, textures and decoded image bitmaps. A late decode is discarded and disposed rather than attached to a different stage.
- Five bridge lanes and both teams’ spawn positions retain clearance. Grapevine soil beds are now 0.7 m tall, with canopy beams around 3.2 m; the central pavilion leaves headroom above its raised platform.

## Rebuild the derivative

The offline script uses the meshoptimizer simplifier bundled with the installed Three.js package and Python 3 with Pillow. It expects the supplied single static mesh with identity node transforms. It preserves normals/UV attributes during simplification, compacts vertex buffers, resizes the base-color image, and writes a standard GLB without compressed-geometry extensions.

```sh
node scripts/prepare-turpan-minaret.mjs '/path/to/historic minaret 3d model.glb'
npm test
npm run build
```

The manifest records source hash, original/runtime sizes, triangle/vertex counts, simplification error and texture limit. Review the silhouette and brick pattern in the game after regenerating; the simplification target is 24k triangles with at most 2.5% normalized error (the measured output was about 0.34%). Keep the original out of the deployment folder.

## Verification

`tests/turpan-environment.test.mjs` checks actual player movement over all five crossings in both directions, clear spawn positions, the derivative’s transfer/geometry budget and its off-arena footprint. It also checks missing-model fallback/resource disposal and cancellation during a pending stage request. Existing Kashgar routes and match-result tests remain intact.

Use `?perf=1` for optional renderer counters. Desktop preview checks cover the real decoded model, vineyards, live 6v6 painting and stage switching. Physical phone performance and competitive balance still need playtesting. The pre-existing large engine-chunk warning remains; the app now also emits a separate GLTFLoader chunk.
