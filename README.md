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
