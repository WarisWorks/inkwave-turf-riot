# Inkwave feature integration

## Source and scope

Source: [jaydendavisnc/inkwave](https://github.com/jaydendavisnc/inkwave), revision `2a32efea9ef253478dfeb7c4dcd2c49162264d5b`, MIT © 2026 Jayden Davis. The complete notice is retained in `public/licenses/inkwave-MIT.txt`, packaged by Vite and linked in Credits.

This is a selective code/feature port into InkWave Turf Riot, not a Git-history merge between unrelated apps. The user chose a balanced upgrade: better ink visuals, more weapons and gameplay polish while preserving their characters and architecture.

Preserved: React/TypeScript/Vite; the engine/UI bridge; all eleven optimized GLBs; six character choices and perks; Urumqi, Kashgar, Oasis and Turpan; 6v6; Turf, Zone and Survival rules; localStorage progression; Uyghur/RTL; touch input; existing specials and wall climbing. Concurrent main-branch lobby and game-mode improvements are retained.

## Adapted systems

| Upstream source | Local integration | Adaptation |
| --- | --- | --- |
| `src/config.js`, `src/game/weapons.js` | `src/game/weapons/arsenal.ts` | Dualies alternate hands, two paid dodge rolls and a firing boost after a roll; Slosher windup; Splatling charge/release stream. Damage, range and enemy cadence fit the existing player/bot balance. The roll curve is integrated analytically for stable travel at different simulation steps. |
| `src/world/inkShading.js`, swim-wake behavior | `src/game/rendering/liquidInk.ts` | Freshness/rounded lip, gel normals, wet sheen, finite expanding ripple packets and four V-shaped wakes using the existing XZ texture. No 4K face atlas, physical-material replacement or new postprocessing renderer. |
| Weapon concepts | `src/game/weapons/weaponModels.ts` | Original local procedural models reuse team materials and the existing mounts. Imported character meshes/rigs remain untouched. |

`engine.ts` owns collision, pooled projectiles, bots, audio, match state, input and rendering. The new state machine returns shot commands; the engine emits them through the original pool. A shared hit set prevents a bucket wave's five drops from stacking damage on one opponent. Fast shots use swept actor checks, with world occlusion checked first. Pooled slots clear the hit set when reused. Wall splats carry per-instance hit-box bounds into their shader, preventing large decals from extending past cover during their pop animation.

## Controls and feedback

- Dualies: fire + movement + jump (Space, or the touch jump button) rolls. Two rolls are available; releasing fire after the recovery restores them. Rolls cost seven ink and use normal movement collision; they grant no invulnerability. A short recovery slows movement and tightens/faster-fires shots.
- Slosher: hold fire; 0.13-second windup, roughly 0.62-second repeats. Reserved ink is spent once. Each wave hits each opponent at most once.
- Splatling: hold up to 0.85 seconds to charge; release for a 0.3–1.7-second stream. Ink is spent per round. Diving, death, respawn, a new match and special activation cancel stored attacks. The charge bar shows spinup and remaining stream.
- Swim + jump now leaps out of own ink. Ordinary jumps, climbing, all older weapons and specials remain available.
- The shoulder camera clears the character's head, gently widens with movement, and aims projectiles toward the center camera ray's world hit. Input edges are consumed only when a simulation step can use them.

## Rendering and performance

Paint color uses a 960×1216 canvas (previously 480×608); ownership remains the original 120×152 CPU grid. A separate 120×152 single-channel wetness texture updates at 12 Hz. Wetness changes appearance only and never removes ownership. It dries over six seconds and resets with stage/match changes. The shader has twelve impact slots and at most four nearby swimmers, always prioritizing the player. Height gating prevents a ripple being drawn on another storey.

High quality includes gel normals, edge relief, impact ripples and wakes. Low quality skips those loops and retains readable team colors and drying gloss. New weapon meshes use existing shared materials; all new geometries are disposed with their owning character. The wetness texture is explicitly disposed on engine teardown. No dependencies, external assets or model downloads were added.

Existing XZ ownership still means roof/street ink at the same position shares turf. This integration does not add upstream's independent per-face scoring, Super Jump map, gamepad controls, day/dusk stages, locker or its full postprocessing pipeline.

## Validation

- `npm test` passes all 83 checks: existing environment, character, Zone/Survival and match-result checks, plus arsenal timing/resources, save compatibility, roll distances/cancellation, wetness/wake lifecycle, fast projectile collision and per-volley damage checks.
- `npm run build`: strict TypeScript and production assets, including the MIT notice.
- Live browser checks cover new loadout choices, supplied characters, actual firing/painting, dodge use, charge/release, stage switching and quality settings. A temporary test page drives the actual `mountInkWave` bridge with scripted inputs; it is removed after verification.
- Physical phone performance and competitive balance remain playtest work. The existing large engine bundle warning remains.
