# InkWave Turf Riot

A desktop-first 6v6 ink shooter across four arenas. You and five Orange teammates face six Violet bots in Turf, Zone, or Survival mode. In Turf, whoever owns more ground when the 3-minute match ends wins.

Built with React, Three.js, and Vite.

## Play

```bash
npm install
npm run dev
```

Open the local URL Vite prints (default `http://localhost:5173`).

To test the end-of-match flow without waiting three minutes, shorten the match:

```bash
VITE_MATCH_LEN=75 npm run dev
```

## Controls

- **WASD** — move (A/D strafe)
- **Mouse** — aim (click-drag or pointer lock)
- **Left click** — shoot
- **Space** — jump; leap out of ink while swimming; dodge with Dualies while moving and firing
- **Shift** — swim in your own ink (refills tank)
- **Right click** / **C** — throw sub weapon
- **F** — special (when meter is full)
- **Esc** — pause
- **Tab** (hold) — scoreboard

Loadout includes Spritzer, Swell Roller, Flint Charger, Popper Blaster, Twinfin Dualies, Tidebucket Slosher, and Gyre Splatling, plus Pop Bomb or Ink Beacon, and Ink Burst, Ink Tempest, or Reef Rush.

## Game modes

Pick a mode under **جەڭ ئۇسۇلى** on the stage screen; the menu's Play button shows the current stage and mode.

| Mode | Rules | HUD |
|---|---|---|
| زېمىن جېڭى · Turf | More inked ground at the whistle wins. | Turf % per team and a shared bar. |
| مەركەزنى ئىگىلەش · Zone | The centre rectangle (`ZONE` in `src/game/levels.ts`) is marked on the ground, by a light curtain, on the minimap and on the stage previews. A team takes it by inking at least 50% of its paintable ground while leading by 12 points, and keeps it until its share drops below 36%. Holding it banks 100/60 control points per second; **100 is a knockout** (a full minute of control). Otherwise most points wins at the whistle, then zone share, then turf. Bots on painter/defender duty work the zone; attackers join whenever their team does not hold it. | Control points with a progress strip per team, the zone-share bar with its capture line, and who holds the centre. |
| ئاخىرقى ئەترەت · Survival | Every fighter has 3 lives. A fighter who spends them all is out for the match. Wiping out the other team ends the match at once; otherwise more lives left at the whistle wins. | Team lives with one pip per fighter, your own hearts, a "N lives left" note while respawning, and a spectator card that follows a living teammate once you are out. The scoreboard adds a lives column. |

Results name the mode, its headline score (turf %, control points or lives left), a knockout or wipeout note, and the coins earned. Coins are also shown on the player card.

**Arena events**: every 42 s of play a festival wave charges everyone's special faster for 14 s. In Taklamakan a sandstorm can roll in instead for 18 s: fog and sky blend to sand (including the painted ground), and bots see only about two thirds as far. A chip under the clock names the event and counts it down.

## Inkwave upgrade (v2.1)

Selected mechanics and liquid-ink ideas from [Jayden Davis's INKWAVE](https://github.com/jaydendavisnc/inkwave) are integrated into this game's existing React/TypeScript engine. Your supplied characters, four arenas, Uyghur UI, saves, 6v6 teams and three modes are retained.

- **Twinfin Dualies · قوش تاپانچا**: alternating pistols. Move + fire + Space for a dodge; chain two rolls, then release fire to recover. Each roll costs seven ink. Landing briefly steadies and speeds up fire.
- **Tidebucket Slosher · دولقۇن چېلىكى**: a short windup followed by a five-drop arc over cover. Each wave can damage a given opponent once.
- **Gyre Splatling · قۇيۇن ئاتقۇچ**: hold fire to spin up, release for a sustained stream. More charge means a longer burst; swimming cancels it. The reticle meter fills and drains with the weapon.
- **Liquid ink**: denser scalloped splats, wet highlights that settle over six seconds, rounded ink edges, impact ripples and V-shaped swim wakes. Low quality keeps the ink colors and drying sheen while skipping ripple/wake detail.
- **Handling**: swim jumps, a clearer shoulder camera with gentle speed-based FOV, crosshair-aware aiming, and swept projectile checks against actors and cover. Queued keyboard taps wait for the next simulation step even on high-refresh displays.

See [integration notes](docs/INKWAVE_INTEGRATION.md) for source attribution, architecture and tuning. The upstream MIT notice ships in [the game assets](public/licenses/inkwave-MIT.txt) and is linked from Credits.

## Movement, specials and animation (v1.4)

- **Swim-climb walls**: shots that hit a wall leave team ink on it. Hold swim (Shift) and push into a wall carrying your team's ink to swim straight up it; near the ledge you vault over even if the last stretch is bare.
- **Specials charge, then burst**: every special now has a 0.75 s wind-up (the character lifts and spins inside a glow orb while ink droplets rush in, with a rising whine) followed by an explosive ink burst: instant paint, damage and an expanding shockwave ring. The new default special, **سىياھ پارتلىشى** (Ink Burst), covers a 9 m radius at once; Ink Tempest and Reef Rush add a smaller burst before their own effect.
- **Motion**: movement accelerates and decelerates smoothly for players and bots; stride and cadence follow speed.
- **Squid form**: swimming morphs the character into a glossy squid with a pointed mantle, eyes and wagging fins, trailing ink droplets; it turns upright while climbing.
- **Ink feel**: shots render as stretched droplets along their flight so rapid fire reads as a stream; particles are soft round droplets that bounce; wall splats pop in with a little overshoot.
- **Characters**: slimmer, athletic proportions with arms in a two-handed aim pose, large expressive eyes with pupils and highlights that blink, glossy ink tentacles on every character, idle breathing and head bob, a recoil kick on every shot, and temporary ink footprints while running.
- **Camera**: eased follow, closer to centre; after the whistle it arcs round to face the player.
- **Victory / defeat**: the player hops with arms up, happy eyes and confetti on a win, or droops with sad eyes on a loss; the results panel slides in beside them after a short celebration.
- Key taps (jump, sub, special) are latched at key-down, so a press shorter than a frame is never lost.

## Your painting gun (v1.3)

The player's weapons are tuned well above the bots' copies (bots keep the base numbers, scaled by difficulty). Tuning lives in `POWER` at the top of `src/game/engine.ts`.

| Weapon | Bots | Player |
|---|---|---|
| Spritzer | 12 dmg every 0.11 s, paint radius 0.92 | 17 dmg every 0.085 s (≈1.8× damage per second), paint radius 1.35, faster and longer shots that drip an ink trail, 22% less ink per shot |
| Swell Roller | 70 dmg/s, paint radius 1.5, 5-drop flick | 110 dmg/s over a wider reach, paint radius 2.0, 7-drop flick at 24 dmg, 27% less ink |
| Flint Charger | 0.85 s charge, 16–102 dmg | 0.6 s charge, 30–120 dmg (a full charge splats in one hit), longer reach, wider painted line |
| Popper Blaster | 22 + 30 splash, every 0.72 s | 34 + 45 splash over a bigger radius, every 0.55 s, paint radius 4.0 |

Shots also have a bigger muzzle burst, heavier impact splashes, a wet splash sound layer and more camera kick. The gun models carry glossy team-coloured ink tanks.

## Stages

Pick a stage from **مەيدان تاللاش** in the menu; the menu backdrop switches to it live.

| Stage | Layout |
|---|---|
| ئۈرۈمچى · Urumqi | A bazaar square using the five supplied Urumqi models, with a central tower, market cover and raised side promenades. |
| قەشقەر بازىرى · Kashgar Bazaar | Procedural adobe courtyard houses, market streets, tea terraces, connected roofs and bridges, high lookouts, grape pergolas, and a fountain square inside a layered old-city skyline. |
| تەكلىماكان ۋاھەسى · Taklamakan Oasis | Sculpted dune horizons, eroded sandstone ridges, climbable sand terraces, detailed ruined forts, caravan shelters, and a date-palm oasis with rippling water. |
| تۇرپان ئۈزۈمزارلىقى · Turpan Vineyard | Leafy grape-trellis lanes and harvest baskets, a vine-covered karez pavilion with five crossings, grape-drying houses, the historic minaret, and the Flaming Mountains. |

Levels are plain data in `src/game/levels.ts` (boxes, stairs, trees, domes, water rects, spawns, colours). The engine builds them at runtime and the stage screen draws its map previews from the same data. Maps are point-symmetric via `sym()`, so both teams get the same layout. Bots cross channels at the listed `crossings` and walk around `pools`.

Urumqi replaces the original Port stage and migrates existing Port selections. Its five optimized models total about 4.06 MB; unused originals have been removed from the project. Streets and raised promenades remain paintable. See [Urumqi environment authoring](docs/URUMQI_ENVIRONMENT.md) for the layout, asset recipe and checks.

Kashgar's layout lives in `src/game/environment/kashgarLayout.ts`. Kashgar's architecture uses shared Three.js primitives and the game's lightweight materials, with no model downloads for this stage. Simple boxes and a layered navigation graph connect four gameplay heights. Add `?perf=1` to inspect FPS and renderer counters. See [Kashgar environment authoring](docs/KASHGAR_ENVIRONMENT.md) for geometry, collision, budgets and tests.

Turpan uses one optimized historic-minaret model (about 950 KB) as a landmark outside the west boundary, plus procedural vineyards and grape pergolas. Its model loads only on this stage and does not delay match start. See [Turpan environment authoring](docs/TURPAN_ENVIRONMENT.md) for the asset recipe, layout and checks.

Taklimakan uses lightweight procedural 3D modeling for curved dunes, layered sandstone and date palms, with warm lighting and animated water highlights. The existing fort stairs, sand terraces and paths around the pond remain playable. See [Taklimakan environment authoring](docs/OASIS_ENVIRONMENT.md).

## Characters

Choose in **قورال-جابدۇق** (loadout); the model spins in the middle of the screen. The default uses the optimized `cute.glb`, prepared from the supplied `cute-character.glb`: a boy with a black doppa and embroidered white shirt. The unused 61 MB original has been removed; the game needs only the 677 KB runtime copy. Five optimized supplied models provide all six character choices and bot appearances, with separate hats/instruments for variants. Each keeps its existing perk. See [character assets and animation](docs/CHARACTERS.md).

| Character | Look | Perk |
|---|---|---|
| دوپپىلىق بالا | New supplied boy with a black doppa, embroidered shirt and boots | Balanced |
| دوپپىلىق يىگىت | Supplied boy in an embroidered shirt, boots and doppa | Run speed +8% |
| ئۆرۈمە چاچلىق قىز | Supplied girl with long braids and a patterned dress | Swim speed +12% |
| تەلپەكلىك باتۇر | Sheepskin telpek | Takes 10% less damage |
| ئەتلەس كىيىملىك قىز | Supplied traditional Etles outfit | Special charges 15% faster |
| دۇتارچى | Previous blue-doppa boy with short hair and a dutar on the back | Ink refills 15% faster |

## v1.1 gameplay

- **Difficulty**: Easy / Normal / Hard in Settings. Only the Violet bots scale (speed, reaction, aim spread, fire rate, damage to you, special charge); your teammates always play Normal.
- **Smarter bots**: bots route across the water channel via the two docks or the central platform instead of walking into it, and they now charge and fire their specials too.
- **Feedback**: hit marker and splat burst on the crosshair, hit sound, low-ink prompt, special-ready tag, a "1 minute left" callout, and a final 10-second countdown with ticks.
- **Scoreboard**: hold Tab (or tap نەتىجە on touch) mid-match; the results screen shows both teams with turf points, splats, washouts and an MVP crown.
- **Progression**: every match earns XP (turf points + 50 per splat + 300 for a win). The player card shows level, XP bar and personal best.
- **Etles (ئەتلەس) banners**: procedural ikat-silk banners hang on the arena walls, and an ikat strip accents the menu and results.
- **Music**: a Hijaz-flavoured maqam line over a dap frame-drum pattern that speeds up in the final minute, plus win/lose jingles.

## Uyghur edition

All in-game content is in Uyghur (سىياھ دولقۇنى — زېمىن جېڭى): menus, loadout, HUD, kill feed, banners, bot names, and canvas name tags.

- **Font**: ALKATIP Basma, loaded via `@font-face` in `src/styles.css` and applied through the `.alkatip-basma` class on the app root. The engine calls `document.fonts.load()` before redrawing name tags, since canvas text never triggers a web-font download on its own.
- **Direction**: the document is `lang="ug" dir="rtl"`. Layout uses logical utilities (`ms-*`, `ps-*`, `text-start/end`) so the HUD score bar and cards mirror correctly.
- **Lobby (main menu)**: a Splatoon-inspired lobby built from original shapes. Play, Stage and Loadout are tilted, hanging signs (`LobbySign`: halftone face, splat badge, caption band, idle sway on Play); Settings, How to play and Credits are dark slanted tags (`LobbyTag`). The player card is a dark status panel with level, a striped XP bar, a zero-padded coin counter, an Etles-ikat nameplate (the name is editable in place), Mode and Stage rows with quick-change tags and a map thumbnail, and four stats. Styles live under `.lobby-*`, `.sign-*` and `.status-*` in `src/styles.css`; the lime/ink/slate tokens are in `@theme`.
- **Ink buttons**: `InkButton` / `InkOption` in `src/components/InkWaveApp.tsx`, styled by the `.ink-*` classes in `src/styles.css`. Blob-shaped faces with a sloshing ink wave, bulb drips off the ledge, hover splatter, and a splat check badge on selected cards. Motion is disabled under `prefers-reduced-motion`.

## GLB integration skill

Use [add-glb-to-game](skills/add-glb-to-game/SKILL.md) for the reusable workflow to inspect, optimize, integrate, animate, verify, and clean up supplied 3D models. Its [Three.js notes](skills/add-glb-to-game/references/threejs.md) explain this project's integration points.

## Source

Exported from a Grok share of the playable InkWave Turf Riot v1.0.0 build.
