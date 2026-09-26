# Urumqi bazaar square

Urumqi replaces the former Port/Harbor arena. The menu uses **ئۈرۈمچى**, the preview draws the new collision layout, and saved `harbor` selections migrate to `urumqi` without changing progression. Kashgar, Turpan and Taklimakan keep their existing layouts.

## Layout and assets

All five optimized derivatives in `public/models/urumqi/runtime/` are used. Models 1, 2, 4 and 5 frame the four corner courtyards; model 3 forms the central tower landmark. Street combat runs around them, with market stalls, planter cover, lamps, two 2.4 m promenades and stairs at both ends. The original water channel and docks are removed. Six explicit spawn positions per team remain on clear ground.

| Model | Source bytes | Runtime bytes | Runtime triangles |
| --- | ---: | ---: | ---: |
| urumqi-1 | 54,326,720 | 758,344 | 15,742 |
| urumqi-2 | 2,352,016 | 721,332 | 15,985 |
| urumqi-3 | 58,959,324 | 1,124,228 | 27,006 |
| urumqi-4 | 27,137,956 | 729,396 | 16,000 |
| urumqi-5 | 28,390,916 | 724,044 | 15,980 |
| Total | 171,166,932 | 4,057,344 | 90,713 |

The unused originals were removed from the project at the user's request, freeing 171,166,932 bytes. Only `public/models/urumqi/runtime/` is retained and shipped; the manifest keeps the original hashes and preparation metadata. Each derivative has one embedded 1024 px base-color JPEG and retained normals/UVs. The two detached domes floating beside the source tower are removed from its derivative by retaining the main connected structure. No external texture requests or geometry decoder are needed.

`urumqiLayout.ts` defines placements, proportions, collision and playable platforms. GLBs are uniformly scaled, centered in XZ and grounded on 35 cm plinths. Buildings are closed architectural props with conservative box envelopes; ornamental recesses and interiors are not playable. The central model has separate low-base, shaft and service-building collision so its full-height bounding box does not block shots through empty air. Streets, stairs, platforms and cover use the existing ink shader; the imported decorative facades retain baked textures. Turf still shares XZ ownership across heights.

`urumqiEnvironment.ts` provides instanced local detail, a modest city skyline and the GLB lifecycle. Existing layered city navigation connects the streets and promenades for bots; its optional entry point excludes unreachable decorative roofs and cover tops from patrol destinations. The two main side routes mirror each other; the supplied corner buildings differ in footprint, so competitive balance still needs playtesting.

## Loading and deployment

The stage builds synchronously. Two model requests/decodes run concurrently, with a 15-second download timeout and an architectural fallback for each missing asset. GLTFLoader is dynamically imported only on a model-using stage. Leaving Urumqi aborts active requests, drops queued ones, disposes shared geometry/materials/textures, and discards late decodes. Start never waits for models.

Vite serves the public directory during development, and production uses a public-asset emission plugin. Under `models/urumqi/`, only `runtime/` is included; the filter also excludes any reintroduced authoring sources and dotfiles. Other public runtime assets, including Turpan's minaret and the characters, are retained. Removing unused originals reduces workspace storage; they were already excluded from deployment. The complete build with characters is about 8.13 MiB, excluding the remotely hosted font. The pre-existing engine-chunk warning remains (about 732 kB).

## Regeneration

```sh
node scripts/prepare-urumqi-models.mjs /path/to/original-urumqi-models
npm test
npm run build
```

Regeneration requires obtaining the original five files (`urumqi-1.glb` through `urumqi-5.glb`) in an external folder; they are no longer included in the project. The recipe reuses `scripts/prepare-model.mjs` with Three.js's bundled mesh simplifier and Python/Pillow. It accepts the supplied single indexed mesh with identity transforms. It writes derivatives to the runtime folder without changing external source GLBs. The manifest records source hashes, sizes, triangle counts, error and exact prepared bounds. If regenerating with changed source assets, update `URUMQI_ASSETS` proportions from the manifest and review the layout in the browser; the asset regression check detects mismatched proportions.

## Validation

- All 55 Node tests pass, including 12 Urumqi checks for spawn clearance, real movement along bot routes from both ends, tower raycasts, model budgets/proportions, unreachable-roof exclusion, legacy saves, missing models, bounded concurrency/cancellation, shared-resource disposal and late decode cleanup.
- TypeScript and the Vite production build pass; packaged output contains all five derivatives and no original Urumqi GLBs. Runtime asset hashes remain unchanged after cleanup.
- Browser review covered the five decoded assets, the renamed stage, production match entry live bot painting, and menu-based switching through all four arenas. A local production gameplay sample showed 60 FPS, about 132k visible triangles and 439 draw calls. This is a desktop-host sample, not a physical phone benchmark.
- Physical mobile performance, facade-edge collision feel and competitive route balance remain playtest tasks.
