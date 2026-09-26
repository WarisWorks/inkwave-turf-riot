# Three.js and Vite integration notes

Use these notes for a browser game already using Three.js. Check the locally installed release and existing source before copying API calls. Extend an existing asset service where possible.

## Loading and URLs

For Vite public assets, `public/models/characters/hero.glb` is served as `models/characters/hero.glb` relative to the configured base URL:

```ts
const url = `${import.meta.env.BASE_URL}models/characters/hero.glb`;
```

Do not include `public/` in the browser URL. Use the project's asset conventions if it imports model URLs instead. A custom build plugin may override Vite's normal public-file copying; inspect it before assuming a file will ship.

Import `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`. `loadAsync(url)` returns the glTF scene and animation clips. For an existing fetch/abort pipeline, use `fetch` with the owner's signal, check `response.ok`, then pass its `ArrayBuffer` to `parseAsync(bytes, resourceBaseUrl)`. The base URL resolves external dependencies; GLB does not guarantee that every resource is embedded. Configure required compression loaders before parsing. See the official [GLTFLoader API](https://threejs.org/docs/pages/GLTFLoader.html).

Cache the in-flight promise, not just the finished mesh, so simultaneous actors reuse one decode. Keep a clear retry policy for rejected promises. Guard attachment after both loading and parsing: the scene or actor may already be disposed. Retain a visible fallback on failure and remove only that fallback when replacement succeeds.

Prefer self-contained runtime files for small games, or explicitly package every external texture/buffer. Required extensions and external resources are declared in the asset; see the [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html). Check the installed loader's extension support rather than assuming the latest website describes your dependency version.

## Placement without destroying transforms

Keep the imported scene beneath an instance wrapper. In the scene's reference pose:

1. Apply the intended facing/up-axis adjustment to the wrapper.
2. Update world matrices and measure bounds, using an identity parent during normalization.
3. Calculate a uniform scale from the desired game height and measured height; reject empty or zero-height bounds.
4. Recompute bounds after scaling, center X/Z if appropriate, and offset by the measured minimum Y for ground contact.
5. Parent the normalized wrapper under the actor/world placement object.

Check pivot choice visually: an asymmetrical building may need an authored doorway/footprint anchor rather than its bounding-box center. Animated bounds vary, so do not recenter the model every frame. Avoid baking transforms into skinned geometry independently of its skeleton/bind matrices.

## Instance and animation ownership

For an authored skinned hierarchy, inspect the installed `three/addons/utils/SkeletonUtils.js` and use its `clone` helper to create independent skeletons. Include the bones under the cloned root. An ordinary `Object3D.clone()` does not provide the same skinned-instance guarantees. Geometry/materials can still be shared; separate animation state and any per-instance material changes.

Use an `AnimationMixer` for the instance with actual imported clips. Update it with delta time in seconds and select/crossfade actions from game state. Check root motion and physics ownership before using locomotion clips. Stop actions and release mixer bindings when disposing the instance.

An unrigged sculpt has no animation to play merely because it loaded as GLB. Preserve its pose, fit a limited procedural rig, or use a proper authoring workflow according to the task. Never reuse anatomy thresholds from a differently posed character without inspecting the new mesh.

## Materials and disposal

Retain imported materials initially. If the game intentionally uses Lambert materials, preserve the relevant color texture, color, alpha mode, and sidedness during conversion and verify the changed lighting. Normal/metalness/roughness behavior will not transfer unchanged to a simpler shading model. Do not apply double-sided rendering globally to hide bad normals.

Track resource ownership explicitly. Three.js GPU resources require disposal; removing a mesh from the scene is insufficient. Dispose an actor's skeleton and instance-only resources when it leaves. Dispose shared geometry, materials, and textures only when their last owner releases them. Stop/uncache animation state. Close owned image bitmaps after the final texture user is done; texture disposal alone does not release every image resource.

## InkWave Turf Riot example

This section applies only when working in the originating repository and these paths exist. Other projects should use their own architecture.

| Concern | Existing integration point |
| --- | --- |
| Roster to runtime asset mapping | `src/game/characters/characterAssets.ts` |
| Shared requests, fallback replacement, character teardown | `src/game/characters/characterLibrary.ts` |
| Fitted procedural skeletons and actor motion | `src/game/characters/characterRig.ts` |
| Actor/gameplay bridge | `src/game/engine.ts` |
| Buildings, landmarks, and resource helpers | `src/game/environment/` |
| Gameplay geometry and routes | `src/game/levels.ts` |
| Runtime model packaging | `vite.config.ts` |
| Provenance and output statistics | `public/models/characters/manifest.json` |

The default `wave` save ID maps to `cute`, which requests `models/characters/cute.glb`. Changing a file without updating the active mapping can leave the old player visible. The `dutar` choice uses the earlier blue-doppa boy. Verify mapping from source instead of assuming those choices remain fixed forever.

`scripts/prepare-model.mjs` is a specialized single-mesh sculpt recipe, not a general glTF optimizer. Inspect its assumptions before reuse: it rebuilds selected geometry and texture data and does not preserve arbitrary scenes, skins, morphs, or clips. The new default's wrapper recipe is:

```sh
node scripts/prepare-cute-character.mjs /external/path/to/cute-character.glb
```

Run this only when regeneration is required and the external source is available. The large original was deleted at the user's request. Ordinary development and builds use the retained `cute.glb`; do not invent a missing source or regenerate the model just to test an integration.

The character loader/rig currently expects the prepared single textured mesh and generates its own skeleton. Adding a genuinely skinned multi-mesh character requires extending that path to preserve the imported rig. Passing such a model through the current sculpt pipeline would lose required data.

The Vite build derives character GLB inclusion from `CHARACTER_ASSETS` and includes only `models/urumqi/runtime/` for Urumqi. Keep new originals outside deployed folders or update the packaging rules intentionally. `.gitignore` does not control what Vite copies.

Relevant checks are `npm test`, `npm run build`, and live model review. Use `docs/CHARACTERS.md` and the environment documents for current budgets and recipes. Do not copy these project-specific limits into an unrelated game without measuring its needs.
