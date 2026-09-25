# InkWave Turf Riot

A desktop-first 4v4 harbor turf-war shooter. You and three Orange teammates paint the ground against four Violet bots. Whoever owns more turf when the 3-minute match ends wins.

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
- **Space** — jump
- **Shift** — swim in your own ink (refills tank)
- **Right click** / **C** — throw sub weapon
- **F** — special (when meter is full)
- **Esc** — pause
- **Tab** (hold) — scoreboard

Loadout includes Spritzer, Swell Roller, Flint Charger, and Popper Blaster, plus Pop Bomb or Ink Beacon, and Ink Tempest or Reef Rush.

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
| پورت · Harbor | The original map. A water channel splits the middle; cross on the two docks or the central platform. |
| قەشقەر بازىرى · Kashgar Bazaar | Tight market lanes of awning stalls, gate arches, domed towers, caravanserai rooftops, and a tiled fountain in the centre. |
| تەكلىماكان ۋاھەسى · Taklamakan Oasis | Open sand with walk-up dune terraces, mud-brick ruins, a hilltop fort, and a palm-ringed pond. |
| تۇرپان ئۈزۈمزارلىقى · Turpan Vineyard | Grape-trellis lanes, a karez canal with five crossings, grape-drying houses, and the Flaming Mountains on the horizon. |

Levels are plain data in `src/game/levels.ts` (boxes, stairs, trees, domes, water rects, spawns, colours). The engine builds them at runtime and the stage screen draws its map previews from the same data. Maps are point-symmetric via `sym()`, so both teams get the same layout. Bots cross channels at the listed `crossings` and walk around `pools`.

## Characters

Choose in **قورال-جابدۇق** (loadout); the model spins in the middle of the screen. Each has one small perk, and the bots use them too.

| Character | Look | Perk |
|---|---|---|
| دولقۇنچاق | Ink-tentacle hair | Balanced |
| دوپپىلىق يىگىت | Black doppa with white badam motifs | Run speed +8% |
| ئۆرۈمە چاچلىق قىز | Crimson doppa and long braids | Swim speed +12% |
| تەلپەكلىك باتۇر | Sheepskin telpek | Takes 10% less damage |
| ئەتلەس ياغلىقلىق قىز | Etles-silk headscarf | Special charges 15% faster |
| دۇتارچى | Doppa and a dutar on the back | Ink refills 15% faster |

## v1.1 gameplay

- **Difficulty**: Easy / Normal / Hard in Settings. Only the Violet bots scale (speed, reaction, aim spread, fire rate, damage to you, special charge); your teammates always play Normal.
- **Smarter bots**: bots route across the water channel via the two docks or the central platform instead of walking into it, and they now charge and fire their specials too.
- **Feedback**: hit marker and splat burst on the crosshair, hit sound, low-ink prompt, special-ready tag, a "1 minute left" callout, and a final 10-second countdown with ticks.
- **Scoreboard**: hold Tab (or tap نەتىجە on touch) mid-match; the results screen shows both teams with turf points, splats, washouts and an MVP crown.
- **Progression**: every match earns XP (turf points + 50 per splat + 300 for a win). The player card shows level, XP bar and personal best.
- **Etles (ئەتلەس) banners**: procedural ikat-silk banners hang on the harbor walls, and an ikat strip accents the menu and results.
- **Music**: a Hijaz-flavoured maqam line over a dap frame-drum pattern that speeds up in the final minute, plus win/lose jingles.

## Uyghur edition

All in-game content is in Uyghur (سىياھ دولقۇنى — زېمىن جېڭى): menus, loadout, HUD, kill feed, banners, bot names, and canvas name tags.

- **Font**: ALKATIP Basma, loaded via `@font-face` in `src/styles.css` and applied through the `.alkatip-basma` class on the app root. The engine calls `document.fonts.load()` before redrawing name tags, since canvas text never triggers a web-font download on its own.
- **Direction**: the document is `lang="ug" dir="rtl"`. Layout uses logical utilities (`ms-*`, `ps-*`, `text-start/end`) so the HUD score bar and cards mirror correctly.
- **Ink buttons**: `InkButton` / `InkOption` in `src/components/InkWaveApp.tsx`, styled by the `.ink-*` classes in `src/styles.css`. Blob-shaped faces with a sloshing ink wave, bulb drips off the ledge, hover splatter, and a splat check badge on selected cards. Motion is disabled under `prefers-reduced-motion`.

## Source

Exported from a Grok share of the playable InkWave Turf Riot v1.0.0 build.
