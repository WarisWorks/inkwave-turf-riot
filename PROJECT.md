# InkWave Turf Riot

## Purpose and users
A desktop-first, Uyghur-language 6v6 ink shooter for players who want short, browser-based matches against bots. The game combines territory painting, distinct character perks, and Uyghur-inspired arenas.

## Core features
- Turf, Zone, and Survival modes; four selectable arenas and three difficulty levels.
- Four weapons, two sub weapons, and three charged specials.
- Swimming in team ink, wall climbing, squid form, and animated match celebrations.
- Six character choices, bot roles, scoreboards, XP, coins, and persistent settings.
- Uyghur RTL interface with ALKATIP Basma typography and touch controls.

## Stack and architecture
- React 19 and TypeScript provide the interface in `src/components/InkWaveApp.tsx`.
- Three.js powers rendering, simulation, input, audio, and bots in `src/game/engine.ts`.
- `src/game/levels.ts` defines arena geometry, water, and spawn points as data.
- `src/game/types.ts` holds shared contracts and loadout definitions.
- `src/game/persist.ts` stores settings and progression in browser localStorage.
- Vite 6 builds the app; Tailwind CSS 4 and `src/styles.css` style it.

## Decisions and constraints
- Preserve the existing UI/engine bridge and data-driven level architecture.
- Keep the Uyghur copy, RTL behavior, and existing visual identity.
- Score the match before preparing the player model for the celebration; reviving a player changes Survival's alive-actor count.
- The merged release uses the existing main-branch version, 2.0.0.
- Regression checks use Node's test runner and the existing TypeScript parser to exercise the actual end-match function in isolation; they do not verify WebGL rendering.

## Development and deployment
- `npm ci`, `npm run dev`, `npm run build`, and `npm test` are the main commands.
- `VITE_MATCH_LEN` shortens matches for manual testing.
- GitHub PRs have Vercel preview deployments. Confirm deployment status before merging.
