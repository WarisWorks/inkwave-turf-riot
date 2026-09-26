# Project Progress

## Current Status
Version 2.1.0 integrates selected mechanics and liquid-ink visuals from Jayden Davis's Inkwave while preserving the existing React/TypeScript/Three.js architecture, supplied Uyghur characters, four arenas, saves, 6v6 teams and three game modes. The loadout now has seven weapons: Dualies with two dodge rolls, an arcing Slosher and a charged Splatling join the original four. Ink has wetness, edge relief, impact ripples and swim wakes; wall decals clip to their hit surfaces. Swim jumping, camera framing, aiming and fast-projectile collision are improved. The incoming lobby, Zone/Survival and event fixes are retained.

All 83 tests and the production build pass. Live browser checks verified all three new weapon types, two-roll use, charge/release, painting, stage changes across all four arenas, a swim leap in low quality, and the responsive 390×844 loadout. Sampled desktop gameplay ran at 60 FPS; this is not a physical phone benchmark. All eleven runtime GLBs remain unchanged and match their packaged copies. The existing large engine bundle warning remains (about 752 kB).

The default remains the optimized black-doppa `cute.glb`. The reusable `add-glb-to-game` skill and previous Downloads model optimization work remain documented below.

## Completed
- Integrated the v2.1 Inkwave feature port: three new weapon state machines/models, bots, Uyghur loadout/help, charge/roll HUD, swim leaps, wet ink/wakes and clipped wall splats.
- Added fifteen executable arsenal, save, wetness/wake, pooled projectile, wall-occlusion and per-volley regression checks; all 83 tests pass.
- Retained upstream MIT attribution in the source, Credits and production assets; documented exact source revision and port boundaries in `docs/INKWAVE_INTEGRATION.md`.
- Recovered the incoming lobby and game-mode session histories omitted by the concurrently completed progress-log merge resolution; retained the local Downloads-library history.
- Restyled the main menu as a Splatoon-inspired lobby: tilted hanging signs for Play/Stage/Loadout, dark slanted tags for the rest, and a dark status card (level, striped XP bar, coin counter, Etles-ikat nameplate, Mode/Stage rows with map thumbnail, stats). Checked at 1000×600 and 390×844.
- Fixed arena events never firing: the 0.35 s score tick reset the event clock. Events now reset at match start, clear at the whistle and menu, and the sandstorm eases fog/sky toward sand, including the painted-ground shader's fog.
- Zone mode: live capture with hysteresis, 100-point knockout, ground border band + light curtain + minimap/stage-preview outline, bot zone duty, and a HUD with control points, zone share and holder.
- Survival mode: lives-left scoring (no bonus for standing fighters), eliminated fighters stay down, a wiped-out team ends the match, lives HUD/hearts/pips, a spectator camera for an eliminated player, and a lives column on the scoreboard.
- Mode-aware end banners, end splash and results (headline score, knockout/wipeout note), coins shown on results and the player card, mode shown on Play, How-to rows for each mode and events.
- Removed 22 `Object3D.add` console errors per load from empty tentacle pivots.
- Optimized the external Downloads model library: 47 GLBs reduced from 2.14 GB to 88.15 MB using the confirmed Balanced profile; saved copies and reports in `~/Downloads/3D Model/Game Ready`, preserving all originals.
- Created the reusable `add-glb-to-game` skill, with Three.js integration notes covering model selection, optimization, rigs, loading, packaging, validation, and authorized source cleanup. Linked its project copy from the README.
- Removed the unused `cute-character.glb` original, freeing 61,048,116 bytes while retaining all eleven active GLBs and manifest provenance. Character regeneration now requires an external source path.
- Integrated the new confirmed `cute-character.glb` as default `wave`, retaining saves/perks and optimizing its 61 MB source to 677 KB. Preserved UV seams and smoothed normals; the later cleanup removed the original.
- Fitted crossed-leg guides and protected face/ear vertices from arm motion. Preserved the authored carry pose with restrained recoil. Added two character checks; all 58 project tests pass, with loadout/live gameplay review.
- Removed the ponytail from `boy.glb`, rebuilt the rear scalp using the opposite short-haired side, retained the embedded texture, and added repeatable offline preparation plus a regression check. Browser-verified the front/back/profile and live Urumqi gameplay.
- Removed five unused Urumqi source GLBs, freeing 171,166,932 bytes; kept all ten active models unchanged. Urumqi preparation now takes an external source folder.
- Restored the four supplied Uyghur character models as 2.41 MB of optimized runtime assets; set the confirmed blue-doppa boy as the default while preserving the existing `wave` save ID and balanced perk.
- Replaced procedural player/bot visuals with shared textured meshes and independent lightweight skeletons; retained movement, weapons, perks, ink-swim form and character selection.
- Removed spiky hair/ink ear-tentacles from fallback characters, updated Uyghur character labels and added team-colored ink packs.
- Added nine character asset/rig/lifecycle checks; all 55 tests pass. Browser-verified loadout selection and the supplied blue-doppa character during production gameplay.
- Replaced Port with Urumqi, updated the Uyghur stage name/preview/minimap and migrated legacy `harbor` saves without resetting progression.
- Integrated all five supplied Urumqi models, optimized from 171,166,932 to 4,057,344 bytes and 90,713 triangles; preserved original hashes and excluded source assets from production.
- Added the tower plaza, streets, market stalls, planted cover, lamps, city skyline and two 2.4 m promenades. Restricted Urumqi patrol navigation to reachable streets/platforms.
- Added bounded model loading, architectural fallbacks, cancellation and late-decode cleanup. Twelve Urumqi checks bring the suite to 46 passing tests.
- Modeled Taklimakan’s layered dune horizon, eroded sandstone ridges, curved date palms, shoreline stones/reeds, detailed forts, gateways, cloth shelters and caravan camps with shared geometry.
- Added desert sand ripples/grain, warmer lighting/haze and animated water highlights while preserving the original pond, fort stairs, terrace heights and bot routes.
- Added six Oasis checks for 6v6 spawn clearance, fort/terrace access, shoreline paths, geometry budget/no downloads and complete disposal.
- Added the historic minaret to Turpan as a decorative landmark outside the west wall; reduced the supplied 57.9 MB / 1.9M-triangle model to 949,908 bytes and 23,988 triangles.
- Added timber grape trellises, leafy canopies, hanging grape bunches, harvest baskets/racks, a central vine pavilion and cultivated background rows.
- Kept minaret loading specific to Turpan, with cancellation, decoded-resource cleanup and a procedural fallback. Added nine tests for Turpan routes, asset budget and loading lifecycle.
- Built 12 procedural houses and two timber gallery landmarks, surrounded by 52 inexpensive residential silhouettes; shared low-poly geometry provides arched doors, lattice windows, cornices and turquoise trim.
- Added four connected gameplay heights, market cover, stair/bridge routes, passable gates, textile details, grape pergolas, poplars, and a fountain landmark.
- Removed the former Kashgar GLB loader/cache and loading UI. Only explicitly requested Turpan/Urumqi assets have asynchronous model paths; gameplay construction stays synchronous.
- Added layered A* navigation, collision broad-phase indexing and exact ground raycasts that preserve bridge underpasses.
- Moved the 955,512,747-byte original model library outside the project. The optimized Turpan minaret and characters were subsequently added back; the full old source library is not deployed. Unused Urumqi originals were removed in the later cleanup session.
- Updated authoring documentation for all four arenas; 46 tests cover match outcomes, routes, saves, environment budgets and lifecycle cleanup.
- Combined both branches' imports, actor state, weapon recoil, movement animation, and end-match behavior.
- Preserved wall climbing, charged specials, squid form, and celebrations alongside main's game modes and arena changes.
- Calculated Survival results before reviving the player for the celebration.
- Removed duplicate recoil fields and assignments introduced by the automatic merge.
- Aligned package metadata with the existing v2.0.0 UI version and corrected the README roster description.
- Added project context and executable end-match regression checks.

## In Progress
- No partially implemented features in this integration; deployment and physical-device playtests remain follow-up work.

## Remaining / TODO
- The confirmed new default is integrated. Detailed animation and physical-device playtests remain; the unused earlier `character.glb` is not needed for this integration.
- Playtest route balance, wall-ink climbing on conservative building envelopes, and all weapons from elevated positions.
- Profile on physical lower-end phones; browser viewport checks do not establish mobile GPU performance.
- Confirm Vercel's production build and manually review the preview's merged character animations.
- Exercise swimming, wall climbing, and specials across the four arenas in the preview.

## Known Issues
- The five active source character files have no original skeletons or animation clips. Lightweight generated rigs preserve the new boy’s carry pose, the earlier boy’s hand-on-doppa pose, and restrained arm movement for dresses whose sculpted sleeves touch the garment. Facial expressions remain baked; detailed animation and physical-device checks remain follow-up work.
- The previous session's native build limitation is resolved locally after installing the project lockfile dependencies. Production builds now pass. Vite still reports the large engine chunk warning (about 752 kB including shared Three.js code, with a separate 45 kB GLTFLoader chunk).
- Automated tests isolate actual gameplay functions and navigation modules; they do not replace full competitive playtests. Browser checks cover all four environments, decoded models, shaders, sampled live gameplay and menu-based stage switching. Urumqi uses closed building envelopes, with separate central-tower volumes; facade recesses and interiors remain inaccessible.
- Turf retains the original shared XZ ownership: roof and street at the same position share ink/scoring. Building interiors and precise collision against ornamental recesses are intentionally not implemented.
- The requested reference image directory was absent; the user explicitly approved proceeding from the written direction.

## Technical Decisions
- Port selected Inkwave features at revision `2a32efea9ef253478dfeb7c4dcd2c49162264d5b` into isolated TypeScript weapon/rendering modules. Preserve the current engine, data levels, rigs and XZ scoring; retain the MIT notice in production. Full upstream maps, per-face atlas, gamepad, Super Jump and postprocessing are outside this balanced integration.
- Use the actual supplied Uyghur character models. Use the newly confirmed black-doppa `cute-character.glb` as default and retain the corrected blue-doppa boy for `dutar`; keep character IDs/perks compatible, share prepared meshes/textures and create independent actor skeletons. Cache character assets across stages and dispose them on engine teardown.
- Preserve the engine/UI bridge, 6v6 roster, character/weapon/mode logic and data-defined maps; isolate the city renderer and navigation in `src/game/environment/`.
- Prefer the existing game’s procedural architecture. The user explicitly requested models for Turpan’s historic minaret and then all five models in the Urumqi folder. Ship optimized derivatives only; Kashgar and Taklimakan remain procedural.
- Use explicit collision boxes and thin paintable roof decks. Procedural visual detail never participates in gameplay queries.
- Use instancing, shared Lambert materials, a two-light setup and contact cards. Taklimakan’s dunes, rock ridges and palm fronds are generated meshes; its sand/water detail uses small shader extensions. Fabric, contact shading and signs use small generated canvas textures where needed.
- Keep active optimized GLBs in the project; the user's cleanup requests supersede earlier choices to retain unused Urumqi originals and the new `cute-character.glb` source. Preparation scripts accept external source paths and manifests retain provenance. Vite emits only `models/urumqi/runtime/` from that folder and character GLBs listed by `CHARACTER_ASSETS`, excludes dotfiles, and retains all eleven active models.
- Merge main into the PR branch to preserve both histories and both sets of features.
- Keep the PR's new character rig and adapt main's weapon-weight motion, running lean, and airborne poses to it.
- Preserve main's mode-specific winner rules and resolve the winner before celebration state changes.
- v2.1.0 adds the balanced Inkwave feature integration; retain compatible character, stage and progression IDs.

## Next Recommended Tasks
1. Playtest roof/street combat and route balance on desktop and a physical phone.
2. Confirm the deployment preview and tune quality/performance from device measurements.
3. Tune the three new weapons, Zone capture thresholds and Survival lives from real playtests.

## Session History

### 2026-09-26

**Goal**
Resolve GitHub PR #12's conflicts with main while preserving both branches' functionality.

**Completed**
- Integrated main at `079f67f` into the PR branch based on `7a8f289`.
- Resolved conflicts in the app version, engine imports, decal capacity, recoil, scoring, and animations.
- Verified TypeScript with `node node_modules/typescript/bin/tsc -b --force`.
- Passed all seven `npm test` cases covering Turf/Zone/Survival outcomes, celebration state, and single result publication.
- Passed `git diff --check`.

**Files Changed**
- `src/components/InkWaveApp.tsx`
- `src/game/engine.ts`
- `src/game/levels.ts` (main's arena changes)
- `src/game/persist.ts` and `src/game/types.ts` (combined branch additions)
- `package.json` and `package-lock.json`
- `README.md`, `PROJECT.md`, and `PROGRESS.md`
- `tests/end-match.test.mjs`

**Important Notes**
- Production bundling was blocked by the host's native-module policy, not by a TypeScript failure.
- No browser playtest was performed in this session.
- This task updates the PR branch; merging the PR into main is a separate action.

**Next**
- Confirm remote mergeability and deployment checks, then review the preview before merging.

### 2026-09-26 — Kashgar environment redesign

**Goal**
Replace the simple Kashgar block arena with a dense, stylized Uyghur old city while preserving the existing paint shooter.

**Completed**
- Inspected project history, engine, level data, collision, bots, ink, UI and all candidate architecture model metadata; visually reviewed the viable assets.
- Built a shared GLB loader/cache and optimized three selected assets to 3,798,588 bytes combined, preserving source files.
- Authored 12 houses, four height tiers, six roof links, street/terrace/roof routes, gateways, eight market stalls, background houses and local architectural details.
- Added simple collision, spatial indexing, city pathfinding, correct shots beneath bridges, loading progress, fallback behavior and opt-in renderer counters.
- Added `docs/KASHGAR_ENVIRONMENT.md` and updated project/README context.
- Passed builds after major phases, 24 Node regression tests, and diff whitespace validation.
- Browser-checked actual GLB decoding, rendering, shaders, live 6v6 gameplay and fallback availability with one model temporarily unavailable; restored the model immediately afterward.
- Verified the production preview loads its packaged GLBs and enters a live match. At a 390 × 844 viewport, touch controls, scoring and minimap remained available; the sampled desktop-host viewport test ran at 60 FPS. Restored normal viewport sizing afterward.

**Files Changed**
- `src/game/environment/*`
- `src/game/engine.ts`, `src/game/levels.ts`
- `src/components/InkWaveApp.tsx`, `src/styles.css`
- `public/models/kashgar/*`, `scripts/prepare-kashgar-assets.py`
- `vite.config.ts`
- `tests/environment-loader.test.mjs`, `tests/kashgar-environment.test.mjs`, `tests/typescript-loader.mjs`
- `docs/KASHGAR_ENVIRONMENT.md`, `PROJECT.md`, `PROGRESS.md`, `README.md`

**Important Notes**
- Reference images were not present. The user approved using the written direction.
- Several architecture-named GLBs are mosque scenes; the selected house models and corner landmarks were chosen after visual inspection.
- Local sampled gameplay initially measured around 58–60 FPS, 280–330k triangles and 380–430 draw calls. This is not a low-end mobile benchmark.
- Original `public/models/` files were already untracked when work began. No source asset was modified, committed or uploaded.
- No new npm runtime dependencies or lockfile changes. Asset preparation requires Python/Pillow; tests use Node 22.15+ module hooks and the installed TypeScript compiler.
- The production allowlist excludes unoptimized original models. Add future public runtime files explicitly in `vite.config.ts`.

**Next**
- Playtest the routes and rooftop combat on target devices, then verify the deployment preview.

### 2026-09-26 — Remove GLBs and keep procedural architecture

**Goal**
Follow the user’s revised direction: remove heavy GLB files and build all architecture using the current game’s existing geometry/material approach.

**Completed**
- Replaced imported house meshes and background landmarks with instanced boxes, low-segment door arches, timber lattice, plaster cornices and gallery towers using shared Lambert materials.
- Preserved the four height tiers, connected roofs, stairs, bridges, market details, collision, bots, painting and existing UI.
- Removed GLTFLoader, preload/cache contracts, loading/fallback UI, GLB preparation tooling, runtime manifests and five obsolete asset/loading tests.
- Restored standard Vite public-asset handling and removed stray public-directory OS metadata from the output.
- Moved all 30 files in `public/models/` (955,512,747 bytes) outside the project to a temporary recoverable backup.
- Passed `npm run build` (TypeScript and Vite), all 19 `npm test` cases and `git diff --check`.
- Browser-checked the production city, immediate match countdown, live 6v6 painting, pause/menu flow and stage switching.

**Files Changed**
- `src/game/environment/kashgarEnvironment.ts`, `kashgarLayout.ts`, `environmentTypes.ts`, `sceneResources.ts`
- `src/game/engine.ts`, `src/components/InkWaveApp.tsx`, `src/styles.css`, `vite.config.ts`
- Removed `public/models/`, `src/game/environment/assetLoader.ts`, `src/game/environment/kashgarAssets.ts`, `scripts/prepare-kashgar-assets.py`, `tests/environment-loader.test.mjs`
- `tests/kashgar-environment.test.mjs`
- `docs/KASHGAR_ENVIRONMENT.md`, `PROJECT.md`, `README.md`, `PROGRESS.md`

**Important Notes**
- Temporary backup: `/tmp/inkwave-removed-models-vq60b2hs/models`. It is outside the project and will not be bundled; temporary storage is not a permanent archive.
- Production output is 992,400 bytes (about 0.95 MiB), excluding the existing externally hosted UI font. No GLBs remain in source or output. The engine chunk is 661,539 bytes.
- Sampled local desktop gameplay showed 60 FPS, roughly 135–145k visible triangles and 424–539 draw calls. Earlier GLB views showed roughly 280–330k triangles; these are observations from different live views, not a controlled device benchmark.
- No new dependencies or package-lock changes. Earlier session history below its original heading records the now-superseded GLB implementation.

**Next**
- Playtest rooftop combat and route balance on desktop and a physical phone, then confirm the deployment preview.

### 2026-09-26 — Turpan historic minaret and vineyard

**Goal**
Use the supplied historic-minaret model for Turpan and add vineyard detail, respecting the earlier preference for lightweight assets.

**Completed**
- Recovered the named model from the temporary backup, inspected its geometry/materials and visually reviewed an optimized derivative.
- Added a reproducible offline preparation script using the simplifier bundled with Three.js and Python/Pillow; reduced geometry from 1,897,127 to 23,988 triangles and file size from 57,919,628 to 949,908 bytes.
- Placed the complete tower/courtyard compound outside the west boundary, facing the arena, with simple fallback architecture while loading or after failure.
- Added eight detailed playable grape rows and thirteen background rows, a vine-covered central pavilion, grape clusters, harvest props and ground beneath the background planting.
- Shared the existing instancing helper between Kashgar and Turpan; preserved gameplay collision, five canal crossings and spawn clearance.
- Added nine regression tests; all 28 tests and the production TypeScript/Vite build passed. Diff whitespace validation passed.
- Browser-checked real model decoding, vineyard rendering, live 6v6 painting and menu-based stage switching after reloading the preview.

**Files Changed**
- `src/game/environment/turpanEnvironment.ts`, `turpanLayout.ts`, `staticBatches.ts`
- `src/game/environment/kashgarEnvironment.ts`, `sceneResources.ts`
- `src/game/engine.ts`, `src/game/levels.ts`
- `public/models/turpan/historic-minaret.glb`, `manifest.json`
- `scripts/prepare-turpan-minaret.mjs`, `tests/turpan-environment.test.mjs`
- `PROJECT.md`, `PROGRESS.md`, `README.md`, `docs/TURPAN_ENVIRONMENT.md`, `docs/KASHGAR_ENVIRONMENT.md`

**Important Notes**
- This user request explicitly supersedes the previous no-model rule only for the Turpan historic minaret. Other source models remain outside the project, and Kashgar stays procedural.
- The landmark uses uniform scale to 22 m tall at X=-47, Z=3. It is decorative, outside collision/ink ownership, and does not create an accessible building interior.
- The runtime model uses one embedded 1024 px base-color image with Lambert shading; no normal/roughness maps or geometry decoder are needed. Its loader is dynamically imported when Turpan is selected. Loading never blocks match admission.
- Stage changes abort pending downloads and release mesh/texture/bitmap resources; late decoded models are discarded. Request failure retains the procedural landmark.
- Production output: 2,038,769 bytes (about 1.95 MiB), including the model and manifest but excluding the existing externally hosted font. The large engine-chunk warning remains.
- Local sampled Turpan gameplay showed 60 FPS, around 140k triangles and 309 draw calls; this is not a benchmark for lower-end phones.
- No npm dependencies or lockfile changes. The offline script requires Python with Pillow. The temporary model-review page was removed after inspection.

**Next**
- Playtest Turpan on a physical phone and review the deployment preview; tune foliage density only if target-device profiling warrants it.

### 2026-09-26 — Taklimakan 3D environment modeling

**Goal**
Make Taklimakan more visually distinctive with lightweight 3D modeling while keeping the existing game architecture and playable routes.

**Completed**
- Added curved wind-shaped dunes in two distant layers, layered sandstone ridges, custom date-palm trunks/fronds, shoreline rocks/reeds, caravan tents and pottery.
- Detailed the existing forts with masonry courses, niches, corner battlements and cloth shelters; added curved gateway infill.
- Reused the original climbable terraces and fort platforms. Added matching collision boxes for the new fort battlements, leaving stair approaches clear.
- Added a desert-only sand shader style, warm directional lighting/cool sky fill, haze and subtle animated highlights on the original water plane.
- Kept all Taklimakan geometry procedural with no extra model/texture requests or dependencies.
- Passed all 34 regression tests, the TypeScript/Vite production build and whitespace validation.
- Browser-checked the production desert, shader rendering, match countdown and live 6v6 painting. Sampled gameplay ran at 60 FPS with about 104k visible triangles and 384 draw calls.

**Files Changed**
- `src/game/environment/oasisEnvironment.ts`, `oasisLayout.ts`
- `src/game/engine.ts`, `src/game/levels.ts`
- `tests/oasis-environment.test.mjs`
- `PROJECT.md`, `PROGRESS.md`, `README.md`, `docs/OASIS_ENVIRONMENT.md`

**Important Notes**
- The large dune slopes and rock ridges are scenery outside the arena. Gameplay still uses the existing 0.45 m terrace steps and simple box collision; no terrain physics rewrite was introduced.
- The pond’s rectangular hazard is unchanged, and shoreline detail traces that boundary. Small vegetation, cloth and pottery remain decorative.
- The whole decorative environment contains 100,358 triangles in 103 batches/meshes, with 12 shared geometries and 14 materials; it is frustum-culled and tested below 120k triangles.
- Production output is 2,046,223 bytes (about 1.95 MiB), 7,454 bytes larger than the previous Turpan build. This includes Turpan’s existing model and excludes the externally hosted font. The engine-chunk warning remains at about 720 kB.
- No GLBs were added. Turpan’s optimized historic minaret is still the only runtime GLB. Physical phone performance and competitive balance remain unverified.

**Next**
- Playtest Taklimakan’s elevated combat and shoreline routes on a physical phone, then review the deployment preview.


### 2026-09-26 — Replace Port with Urumqi

**Goal**
Turn the remaining Port arena into Urumqi using all five models supplied in `public/models/urumqi/`.

**Completed**
- Inspected source GLB metadata and visually reviewed all five optimized buildings before layout placement.
- Replaced the canal/docks with a tower plaza, four corner architecture compounds, stalls, planter cover, lamps and two raised promenades with 40 cm steps.
- Added the Urumqi stage ID/name/blurb, geometry-derived preview and minimap outlines; migrated old Port saves while preserving progression.
- Reused the existing collision, ink and layered navigation systems. Filtered disconnected decorative roofs from Urumqi bot destinations.
- Prepared five standard GLBs with embedded 1024 px textures: 171,166,932 source bytes became 4,057,344 runtime bytes and 90,713 triangles. Removed two floating dome artifacts from the tower derivative only. Verified every original source hash remained unchanged.
- Added two-worker asynchronous loading, 15-second download timeouts, individual fallbacks, request cancellation and late-decoded resource disposal.
- Excluded Urumqi authoring sources/dotfiles from production while retaining all runtime public assets.
- Passed all 46 regression tests, the TypeScript/Vite production build and whitespace checks. Verified source exclusion and all five derivatives in the packaged output.
- Browser-reviewed actual decoded models, production Urumqi gameplay/painting and menu-based switching through Taklimakan, Turpan, Kashgar and back to Urumqi. Sampled production play ran at 60 FPS with about 132k visible triangles and 439 draw calls.

**Files Changed**
- `src/game/environment/urumqiLayout.ts`, `urumqiEnvironment.ts`, `cityNavigation.ts`
- `src/game/engine.ts`, `levels.ts`, `types.ts`, `persist.ts`
- `src/components/InkWaveApp.tsx`, `vite.config.ts`
- `public/models/urumqi/runtime/*.glb`, `manifest.json`
- `scripts/prepare-model.mjs`, `prepare-urumqi-models.mjs`, `prepare-turpan-minaret.mjs`
- `tests/urumqi-environment.test.mjs`
- `PROJECT.md`, `PROGRESS.md`, `README.md`, `docs/URUMQI_ENVIRONMENT.md` and related environment guides

**Important Notes**
- The latest user request explicitly authorizes Urumqi models despite the earlier preference to remove heavy GLBs. Originals stay intact in the named folder; only optimized derivatives are shipped and requested by the game.
- Urumqi buildings use conservative closed envelopes; decorative facades keep their baked textures, while streets, stairs, platforms and cover use the existing ink system. The central tower has separate shaft/base/service-building collision.
- Urumqi uses the same 60 × 76 m arena and six spawn slots per team. Its raised routes mirror each other; differing corner model footprints still need balance playtesting.
- Final production output is 6,110,985 bytes (about 5.83 MiB), excluding the existing externally hosted font. The pre-existing engine-chunk warning remains at about 724 kB. No npm dependencies or lockfile changes.
- Physical phone performance is unverified. The temporary model-review page was removed.

**Next**
- Playtest the Urumqi facade edges, promenade combat and route balance on desktop and a physical phone; then review the deployment preview.


### 2026-09-26 — Use the supplied Uyghur characters

**Goal**
Replace the unwanted spiky/punk default character with the Uyghur character assets the user had supplied earlier.

**Completed**
- Found all four original character GLBs in the earlier model backup and visually inspected optimized versions. Confirmed none contains an existing skin or animation clip.
- User explicitly selected the cartoon boy with the blue doppa as the default. Kept `wave` as the internal ID so current saves pick up the new appearance and retain their balanced perk.
- Used four supplied models for all six character choices and bots, retaining distinct telpek/doppa/dutar accessories and updating labels for the actual outfits.
- Reduced 144,118,832 source bytes to 2,405,876 runtime bytes; each model has 14k triangles and one embedded 1024 px image. Verified all original hashes unchanged.
- Added shared asset caching, eight-bone per-instance rigs, normalized skin weights, hand-mounted weapons, team-colored packs and original-pose preservation for the boy’s hat hand and girls’ garments.
- Removed the original spikes/ink ear-tentacles from loading/failure fallbacks. Kept the ink-swim form and all combat, collision, controls and perks.
- Added nine regression checks, bringing the suite to 55 passing tests. TypeScript/Vite build and whitespace checks passed.
- Browser-reviewed original models, loadout switching and live production gameplay. A local Urumqi sample with supplied characters ran at 60 FPS, about 242k visible triangles and 160 draw calls.

**Files Changed**
- `src/game/characters/characterAssets.ts`, `characterRig.ts`, `characterLibrary.ts`
- `src/game/engine.ts`, `src/game/types.ts`
- `public/models/characters/*.glb`, `manifest.json`
- `scripts/prepare-character-models.mjs`, `scripts/prepare-model.mjs`
- `tests/character-models.test.mjs`
- `docs/CHARACTERS.md`, `README.md`, `PROJECT.md`, `PROGRESS.md`

**Important Notes**
- The source models remain unchanged in `/tmp/inkwave-removed-models-vq60b2hs/models`; runtime derivatives are now in the project. The temporary source location is not a permanent archive.
- These are generated lightweight rigs over static sculpts, not artist-authored animation clips. The cartoon boy keeps his sculpted hat-touching hand; girls use their original carry poses with gentle recoil to avoid pulling sleeves away from attached dresses. Facial expressions are baked into the assets.
- Character replacements share meshes/materials but own skeletons; disposing one actor never invalidates another. Failed requests retain human Uyghur fallbacks, and late decodes are released after engine teardown.
- Final build: 8,527,731 bytes (about 8.13 MiB). Existing engine chunk warning remains at about 732 kB. No npm dependencies or lockfile changes. The temporary model-review page was removed.

**Next**
- Playtest all character/weapon combinations, swimming and celebrations on a physical phone; refine authored animation weights where garment motion needs it.


### 2026-09-26 — Remove unused GLBs

**Goal**
Clean old GLB files that the game no longer uses.

**Completed**
- Audited every GLB against the environment loaders and character roster.
- Deleted only the five unused `public/models/urumqi/urumqi-1.glb` through `urumqi-5.glb` originals, freeing 171,166,932 bytes.
- Kept all ten active runtime models: five Urumqi buildings, Turpan’s historic minaret and four character meshes. Verified their SHA-256 hashes match before cleanup in both `public/` and the production output.
- Changed the Urumqi preparation script to accept an external source folder and updated authoring documentation.
- The user explicitly reserved a newly supplied `characters/character.glb` for future character work. Added a production exclusion so this unused asset will not enlarge downloads. No cleanup command targeted it.
- Passed all 55 tests, TypeScript/Vite build, script syntax/missing-argument checks and whitespace checks. Production contains exactly ten active GLBs and totals 8,527,731 bytes.

**Files Changed**
- Removed `public/models/urumqi/urumqi-{1,2,3,4,5}.glb`
- `scripts/prepare-urumqi-models.mjs`, `vite.config.ts`
- `README.md`, `PROJECT.md`, `PROGRESS.md`
- `docs/URUMQI_ENVIRONMENT.md`, `docs/CHARACTERS.md`

**Important Notes**
- Removing originals reduces workspace storage; these files were already excluded from production. Runtime meshes, gameplay and source provenance manifests remain unchanged.
- The reserved new character appeared during the audit, then disappeared from its observed path during validation without a cleanup command touching it. Asked the user for its new location; preserve it for future integration when located.
- The existing large engine-chunk warning remains. No dependencies or lockfile changes.

**Next**
- Confirm the reserved character’s location before future character work; review its authored skin when integrating it.


### 2026-09-26 — Correct the boy’s hair

**Goal**
Remove the unwanted long ponytail from the selected blue-doppa boy.

**Completed**
- Confirmed the ponytail belonged to the supplied boy sculpt; boy and girl models were not combined by the renderer.
- Trimmed the tail, removed its disconnected tip and rebuilt the small rear scalp patch from the opposite short-haired side. Kept the original embedded texture byte-for-byte, with the outfit, face and signature hat-hand pose.
- Added `shorten-boy-hair.mjs` to the preparation recipe so regeneration retains the correction. Both `wave` and `dutar` use the corrected derivative.
- Kept the boy below the 14k triangle budget (13,999 triangles, 575,652 bytes); four runtime characters now total 2,432,624 bytes. Other active GLBs are unchanged.
- Added a regression check rejecting hanging hair behind the neck; all 56 tests pass, including rig and lifecycle checks. TypeScript/Vite builds and whitespace checks pass.
- Browser-reviewed front/back/profile views and a live Urumqi match. Removed the temporary review page afterward.
- Preserved the newly appearing `cute-character.glb` source. Build filtering now reads the active roster mapping so unused character sources stay local without increasing deployment size.

**Files Changed**
- `public/models/characters/boy.glb`, `public/models/characters/manifest.json`
- `scripts/shorten-boy-hair.mjs`, `scripts/prepare-character-models.mjs`
- `tests/character-models.test.mjs`, `vite.config.ts`
- `docs/CHARACTERS.md`, `PROJECT.md`, `PROGRESS.md`

**Important Notes**
- Hair repair is offline and calibrated to the supplied boy sculpt; review its geometry again if replacing that source. It adds no game-frame processing.
- Existing character animation limitations and the large engine-chunk warning remain. No npm dependencies changed.
- New source characters are preserved; integrating them is separate work.

**Next**
- Reload the game to pick up the corrected model; continue device playtests and review the reserved new character for future integration.


### 2026-09-26 — Use the newly supplied character

**Goal**
Use the newly added character as the player. The user confirmed that “character.glb” means `public/models/characters/cute-character.glb`.

**Completed**
- Inspected the source and compared its appearance with the optimized mesh. It has no authored skeleton or animation clips.
- Prepared `cute.glb` at 676,516 bytes and 19,999 triangles from the unchanged 61,048,116-byte / 1,883,938-triangle source. UV-seam preservation and regenerated smooth normals retain the face and embroidered clothing without simplification artifacts.
- Mapped the existing `wave` default to the new asset, preserving old saves, progression and balanced perk. Updated the Uyghur description to the black doppa. The corrected blue-doppa boy remains available as `dutar`.
- Added anatomy guides for the crossed legs, explicit arm height/torso limits and the authored carry pose with restrained recoil. The weapon follows the supplied right hand; face and ears stay outside arm weights.
- Added an independent preparation script and retained other manifest entries when rebuilding either the new or old character sets. The build automatically includes the optimized new asset and excludes its large source.
- Passed 58 tests, the TypeScript/Vite build, script syntax and whitespace checks. New checks cover the unchanged idle silhouette, correct crossed-boot assignments, face/ear isolation and loading the correct default asset URL.
- Browser-reviewed source/runtime appearance, the fitted rig, loadout and live Urumqi gameplay on the verified development server. Removed the temporary review page.

**Files Changed**
- `public/models/characters/cute.glb`, `manifest.json`
- `src/game/characters/characterAssets.ts`, `characterRig.ts`, `src/game/types.ts`
- `scripts/prepare-cute-character.mjs`, `prepare-character-models.mjs`, `prepare-model.mjs`
- `tests/character-models.test.mjs`
- `README.md`, `PROJECT.md`, `PROGRESS.md`, `docs/CHARACTERS.md`

**Important Notes**
- Five runtime character templates total 3,109,140 bytes / 75,998 triangles; the full build is 9,232,566 bytes (about 8.8 MiB), with eleven active GLBs. The new source hash is unchanged.
- The new character preserves its sculpted walking stance and uses procedural animation; it has no artist-authored clips. This avoids pulling the fused shirt/sleeves into a different aiming pose.
- A separate production browser preview could not be checked: sandbox permissions prevented a new preview listener, and automatic approval review blocked the attempted local origin because it could point to an unrelated app. Used the previously verified development game instead; production-file checks confirm the packaged model matches the tested runtime file.
- Existing large engine-chunk warning remains at about 733 kB. No new dependencies or lockfile changes.

**Next**
- Reload the game to see the new default; playtest movement, recoil and specials on a physical phone.

### 2026-09-26 — Delete the unused original character

**Goal**
Remove the large original character model once confirmed that the game uses its optimized copy.

**Completed**
- Deleted `public/models/characters/cute-character.glb`, freeing 61,048,116 bytes. Kept the active 676,516-byte `cute.glb` used by the default player.
- Verified all eleven runtime GLBs and the character provenance manifest are byte-identical to their pre-cleanup versions, including the packaged production copies.
- Required an external source path for character regeneration and updated current asset instructions. The original is unnecessary for normal development or builds.
- Passed all 58 tests, TypeScript/Vite production build, preparation-script syntax and missing-argument checks, and whitespace validation.

**Files Changed**
- Deleted `public/models/characters/cute-character.glb`
- `scripts/prepare-cute-character.mjs`
- `README.md`, `PROJECT.md`, `PROGRESS.md`, `docs/CHARACTERS.md`

**Important Notes**
- This cleanup follows the user's latest request and supersedes the earlier decision to preserve this original locally. Regenerating the optimized model requires an external original.
- Workspace storage is reduced; production size remains 9,232,566 bytes because the original was already excluded. All eleven active models remain packaged.
- No gameplay or runtime asset changes. The existing large engine-chunk warning remains.

**Next**
- Continue the previously planned movement and performance playtests on a physical phone.

### 2026-09-26 — Document the GLB integration workflow as a skill

**Goal**
Write a reusable `SKILL.md` explaining how to put supplied GLB models into games, using the lessons from this project's character and environment work.

**Completed**
- Created `add-glb-to-game` with selection guidance and a workflow from inspection through optimization, placement, animation, lifecycle cleanup, and production verification.
- Added conditional Three.js/Vite notes and this game's real integration paths, including the limits of its single-mesh preparation and generated character rig.
- Documented preservation of model identity, independent skeletons, UV/texture quality, fallback replacement, source/runtime separation, and verification before deleting unused originals.
- Added Codex UI metadata and a README link. Validated skill frontmatter, local reference links, metadata, and whitespace; checked technical guidance against installed Three.js source and official loader/glTF documentation.
- Installed the validated skill at `/Users/waris/.codex/skills/add-glb-to-game` and verified that all installed files match the project copy.

**Files Changed**
- `skills/add-glb-to-game/SKILL.md`
- `skills/add-glb-to-game/references/threejs.md`
- `skills/add-glb-to-game/agents/openai.yaml`
- `README.md`, `PROGRESS.md`

**Important Notes**
- This is a documentation/skill change; game code and runtime assets are unchanged. The previous session's 58 passing tests and successful build remain the latest game validation; they were not rerun for documentation alone.
- Budgets and sculpt-rig recipes are examples with explicit limits, not mandatory settings for every game or imported model.

**Next**
- Use the skill for the next supplied GLB integration; continue physical-device playtests for the existing game.


### 2026-09-26 — Optimize the Downloads GLB library

**Goal**
Create lightweight copies of every GLB in `~/Downloads/3D Model` for games and other 3D uses. The user confirmed the Balanced profile and keeping every original.

**Completed**
- Inspected all 47 source GLBs: 2,144,831,336 bytes and 62,306,531 triangles, with embedded textures and no skins or animation clips.
- Prepared 47 self-contained GLB copies totaling 88,154,160 bytes (95.89% smaller) and 1,690,019 triangles. Individual files range from about 0.65 to 2.98 MB.
- Preserved node transforms, scene hierarchy, mesh parts, material definitions, and color/normal/metallic-roughness texture assignments. The multipart minaret retains all 41 meshes. Reduced textures to at most 1024 pixels and used per-model simplification settings after comparison.
- Verified all source hashes unchanged; checked GLB structure, indices, finite geometry, image decoding, materials, scene data, output sizes, and bounds changes. All 47 original/optimized pairs loaded without errors and were reviewed from front, side, and back in a temporary Three.js browser viewer.
- Saved the verified copies beside the originals in `~/Downloads/3D Model/Game Ready`, with `README.md`, `size-comparison.csv`, and `optimization-report.json`. Verified the copied files match the reviewed outputs.
- Removed the temporary review page and source copies from the game repository. No runtime game models or application code changed.

**Files Changed**
- External: `~/Downloads/3D Model/Game Ready/` — 47 optimized GLBs and three report/instruction files.
- Repository: `PROGRESS.md` only.

**Important Notes**
- Originals remain in the parent Downloads folder. Workspace storage was not reduced by deleting sources; the new copies are suitable for smaller transfers and runtime use.
- The copies use standard embedded JPEG/PNG textures without a required geometry/texture compression decoder. They remain static models; this task did not add rigs or animation.
- Triangle reduction and texture resizing trade some close-up detail for smaller assets. The report records settings, source/output hashes, counts, and per-part bounds changes. Keep the originals for close-up authoring or future reprocessing.
- Blender's headless preview crashed locally; completed visual review with Three.js in the browser instead. Game tests/build were not rerun because game code and assets were unchanged.

**Next**
- Use files from `Game Ready` for future integrations; fit their collision, scale, and animation to the destination game as needed.

### 2026-09-26 — Splatoon-style lobby

**Goal**
Make the menu cards look like a Splatoon lobby (user-supplied Splatoon 3 references), keeping Uyghur text, ALKATIP and RTL.

**Completed**
- Added `LobbySign` and `LobbyTag`, replaced the menu panel and player card, and added lime/ink/slate tokens and `.lobby-*`, `.sign-*`, `.status-*` styles, with reduced-motion support.
- The Play sign shows stage, mode and team size; Stage and Loadout signs show the current choice. The status card's tags open How to play and Stage select. The menu version badge moved into the card.
- `tsc -b`, `npm run build` and `npm test` (68) pass; desktop 1000×600 and phone 390×844 screenshots reviewed.

**Files Changed**
- `src/components/InkWaveApp.tsx`, `src/styles.css`, `README.md`, `PROGRESS.md`

**Important Notes**
- Inspired by the reference look only: every shape is original CSS/SVG and no Nintendo assets or logos are used.
- The sandbox blocks the ALKATIP font host, so screenshots used the fallback font; outlined titles use `paint-order: stroke fill` so joined Uyghur letters keep clean strokes.

**Next**
- Review the lobby with the real ALKATIP font on a phone.

### 2026-09-26 — Game-mode and HUD review

**Goal**
Check the v2.0.0 core/UI update and make its new features work as described.

**Completed**
- Found arena events could never trigger (their reset sat inside the score tick) and fixed it; sandstorm fog now reaches the ground shader and eases in/out.
- Made Zone a real mode: continuous capture/control scoring with knockout, in-world/minimap/preview zone marking, bot zone duty, and HUD/result support.
- Made Survival a real mode: correct lives scoring, permanent elimination, wipeout early end, spectating, lives HUD and scoreboard column.
- Mode-aware banners, results and menu text; coins visible; How-to covers every mode; version badge moved into the HUD centre stack so it never overlaps chips.
- Fixed pre-existing empty `Object3D.add` errors (22 per load).
- `tsc -b`, `npm run build` and `npm test` (68 tests, including 6 new zone-rule tests and extended end-match cases) pass.
- Headless SwiftShader playtests: zone capture/flip/knockout and results (Urumqi), survival respawn/elimination/spectate/wipeout and results (Kashgar), natural event trigger and sandstorm (Taklamakan), menu and stage screens.

**Files Changed**
- `src/game/engine.ts`, `src/game/types.ts`, `src/game/levels.ts`
- `src/components/InkWaveApp.tsx`, `src/styles.css`
- `tests/end-match.test.mjs`, `tests/zone-mode.test.mjs`
- `README.md`, `PROJECT.md`, `PROGRESS.md`

**Important Notes**
- Survival scoring changed from `lives + alive` to `lives`; the old formula gave standing fighters an extra life. End-match tests were updated to the corrected rule.
- `HudSnap` gained `mode`, `zone`, `survival` and `event`; `MatchResult` gained `mode`, `zone` and `lives`; `BoardRow` gained `lives`.

**Next**
- Playtest Zone thresholds (50% capture / 12-point lead / 36% hold) and Survival's 3 lives with real players.

### 2026-09-26 — Balanced Inkwave integration (v2.1.0)

**Goal**
Bring improvements from `jaydendavisnc/inkwave` into the user's game while preserving their characters and architecture. The user selected a balanced upgrade of ink visuals, weapons and gameplay polish.

**Completed**
- Reviewed both repositories and pinned the MIT source revision. Adapted Dualies, Slosher and Splatling with their distinct firing/charge/windup patterns, ink budgets and local bot balance.
- Added two collision-respecting paid dodge rolls with stable travel distance, a recovery firing boost, 3D weapon previews, recoil/spinning barrel animation, Uyghur help and charge/roll HUD.
- Added a higher-resolution paint texture, six-second wetness, gel/edge shading, twelve impact ripples and four prioritized swim wakes. Low quality skips detailed ripple/wake shading.
- Clipped wall ink to its hit box after a browser check revealed large splats overhanging short cover. Verified the correction visually with live bucket combat.
- Enabled swim leaps, improved shoulder camera/crosshair aiming and swept projectile collision, and kept key taps queued until a simulation step consumes them.
- Preserved concurrent main updates and recovered their omitted session records without deleting existing history. Updated README/project decisions and shipped upstream attribution.
- Passed 83 tests, strict TypeScript/Vite build, whitespace checks and byte comparisons for all eleven source/production GLBs. No dependencies or runtime models changed.
- Browser checks: Dualies painted 77 points and consumed both rolls; Slosher painted 45 points in Kashgar; Splatling reached full charge and streamed/painted in Oasis; low-quality Turpan swim leap reached about 1.97 m above ground. Reviewed seven-weapon loadout and live Splatling HUD/touch controls at 390×844, plus desktop visuals. No Three.js shader errors were logged; unrelated browser-extension connection errors were present.

**Files Changed**
- `src/game/weapons/arsenal.ts`, `src/game/weapons/weaponModels.ts`
- `src/game/rendering/liquidInk.ts`, `src/game/engine.ts`, `src/game/types.ts`
- `src/components/InkWaveApp.tsx`, `package.json`, `package-lock.json` (version metadata only)
- `tests/arsenal.test.mjs`, `tests/projectile-collision.test.mjs`
- `public/licenses/inkwave-MIT.txt`, `docs/INKWAVE_INTEGRATION.md`
- `README.md`, `PROJECT.md`, `PROGRESS.md`

**Important Notes**
- Selective feature adaptation, not replacement with upstream's unrelated application or Git history. The user chose this balanced scope.
- Existing supplied meshes have sculpted poses; weapons use the current mounts without re-authoring the character rigs. Existing shared XZ turf ownership remains.
- The temporary browser integration page is removed after verification. The game remains available through the normal local Vite server.
- The existing bundle-size warning remains; physical phone performance and weapon balance still need playtesting. No deployment or push was performed.

**Next**
- Playtest all seven weapons on a physical phone and desktop; review the local v2.1 build before publishing a deployment.
