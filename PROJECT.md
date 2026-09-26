# InkWave Turf Riot

## Purpose and users
A desktop-first, Uyghur-language 6v6 ink shooter for players who want short, browser-based matches against bots. The game combines territory painting, distinct character perks, and Uyghur-inspired arenas.

## Core features
- Turf, Zone, and Survival modes; four selectable arenas and three difficulty levels.
- Four weapons, two sub weapons, and three charged specials.
- Swimming in team ink, wall climbing, squid form, and animated match celebrations.
- Six character choices using five supplied Uyghur models, bot roles, scoreboards, XP, coins, and persistent settings.
- Uyghur RTL interface with ALKATIP Basma typography and touch controls.

## Stack and architecture
- React 19 and TypeScript provide the interface in `src/components/InkWaveApp.tsx`.
- Three.js powers rendering, simulation, input, audio, and bots in `src/game/engine.ts`.
- `src/game/levels.ts` defines arena geometry, water, and spawn points as data.
- `src/game/environment/` builds Urumqi, Kashgar, Turpan and Taklimakan detail with shared instanced geometry, authors simple collision/roof routes, and provides layered city navigation for Urumqi and Kashgar. Urumqi loads five optimized supplied architecture models; Turpan loads one historic-minaret model. Visual meshes never participate in collision.
- `src/game/characters/` caches five optimized supplied models and generates lightweight per-instance skeletons that follow the existing gameplay poses. The confirmed default is the newly supplied black-doppa boy from `cute-character.glb`; the internal `wave` ID remains compatible with existing saves/perks.
- `src/game/types.ts` holds shared contracts and loadout definitions.
- `src/game/persist.ts` stores settings and progression in browser localStorage.
- Vite 6 builds the app; Tailwind CSS 4 and `src/styles.css` style it.

## Decisions and constraints
- Preserve the existing UI/engine bridge and data-driven level architecture.
- Keep the Uyghur copy, RTL behavior, and existing visual identity.
- Score the match before preparing the player model for the celebration; reviving a player changes Survival's alive-actor count.
- The merged release uses the existing main-branch version, 2.0.0.
- Regression checks use Node's test runner and the existing TypeScript parser to exercise the actual end-match function in isolation; they do not verify WebGL rendering.
- Kashgar uses 0/2/4/6.4 m gameplay tiers and the existing XZ turf ownership grid. Roof and street ink at the same XZ share ownership; independent per-storey scoring is not implemented.
- Architecture uses the existing game’s Three.js geometry and Lambert materials, with explicitly requested models for Urumqi and Turpan’s historic minaret. Kashgar and Taklimakan remain entirely procedural. Taklimakan models its dunes, eroded rock ridges and date palms locally, with simple shaders for sand ripples and water highlights. Stage gameplay builds synchronously; models load asynchronously with procedural fallbacks and never gate match admission.
- Urumqi replaces Harbor with a plaza and two raised side routes; migrate old `harbor` saves to `urumqi`. Its five optimized GLBs total 4.06 MB / 90,713 triangles. The user requested removal of unused GLBs: the 171 MB Urumqi originals are removed, leaving only active optimized runtime models across Urumqi, Turpan and characters. The later new-character integration brings the current count to eleven. Future preparation scripts take external source paths; manifests retain source provenance. Production includes only `models/urumqi/runtime/` from that folder; the Vite asset plugin excludes raw authoring files and dotfiles. Turpan keeps its 949,908-byte derivative, with its original source outside the project. GLTFLoader remains a dynamic chunk, and Urumqi limits concurrent model work to two assets.
- Character derivatives total 3.11 MB / about 76k template triangles; shared geometry/textures and independent skeletons keep 6v6 practical. The user confirmed the latest requested default is `cute-character.glb`, prepared as `cute.glb` (677 KB / 20k triangles). Preserve its short hair, black doppa, embroidered shirt and supplied pose. It uses 3D leg guides for its crossed stance and restrained arm motion to preserve its sculpted sleeves. The prior blue-doppa boy remains the `dutar` model with the offline ponytail correction. The separate ink-swim form is retained. See `docs/CHARACTERS.md`.
- Removed the unused 61,048,116-byte `public/models/characters/cute-character.glb` original at the user's request; keep the active `cute.glb` derivative. Regeneration requires an external source path, while normal development/builds need only the retained runtime assets. Vite packages character GLBs named by `CHARACTER_ASSETS`. `prepare-cute-character.mjs` preserves texture seams and smooths normals; both character recipes retain other manifest entries and source provenance.
- Environment authoring, budgets and validation are documented in `docs/KASHGAR_ENVIRONMENT.md`, `docs/TURPAN_ENVIRONMENT.md`, `docs/OASIS_ENVIRONMENT.md` and `docs/URUMQI_ENVIRONMENT.md`. `?perf=1` explicitly enables the otherwise-hidden renderer counters.

## Development and deployment
- `npm ci`, `npm run dev`, `npm run build`, and `npm test` are the main commands.
- `VITE_MATCH_LEN` shortens matches for manual testing.
- GitHub PRs have Vercel preview deployments. Confirm deployment status before merging.
