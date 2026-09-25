# InkWave Turf Riot

A desktop-first 4v4 harbor turf-war shooter. You and three Orange teammates paint the ground against four Violet bots. Whoever owns more turf when the 3-minute match ends wins.

Built with React, Three.js, and Vite.

## Play

```bash
npm install
npm run dev
```

Open the local URL Vite prints (default `http://localhost:5173`).

## Controls

- **WASD** — move (A/D strafe)
- **Mouse** — aim (click-drag or pointer lock)
- **Left click** — shoot
- **Space** — jump
- **Shift** — swim in your own ink (refills tank)
- **Right click** / **C** — throw sub weapon
- **F** — special (when meter is full)
- **Esc** — pause

Loadout includes Spritzer, Swell Roller, Flint Charger, and Popper Blaster, plus Pop Bomb or Ink Beacon, and Ink Tempest or Reef Rush.

## Uyghur edition

All in-game content is in Uyghur (سىياھ دولقۇنى — زېمىن جېڭى): menus, loadout, HUD, kill feed, banners, bot names, and canvas name tags.

- **Font**: ALKATIP Basma, loaded via `@font-face` in `src/styles.css` and applied through the `.alkatip-basma` class on the app root. The engine calls `document.fonts.load()` before redrawing name tags, since canvas text never triggers a web-font download on its own.
- **Direction**: the document is `lang="ug" dir="rtl"`. Layout uses logical utilities (`ms-*`, `ps-*`, `text-start/end`) so the HUD score bar and cards mirror correctly.
- **Ink buttons**: `InkButton` / `InkOption` in `src/components/InkWaveApp.tsx`, styled by the `.ink-*` classes in `src/styles.css`. Blob-shaped faces with a sloshing ink wave, bulb drips off the ledge, hover splatter, and a splat check badge on selected cards. Motion is disabled under `prefers-reduced-motion`.

## Source

Exported from a Grok share of the playable InkWave Turf Riot v1.0.0 build.
