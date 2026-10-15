# Carom

A browser-only paddle duel with a twist: moving your paddle at contact puts spin on the ball. Two swaying, rotating obstacles turn the court into a bank-shot puzzle. Play against the computer or challenge a friend on one keyboard. First to **11**, winning by **2**.

All graphics are drawn on canvas and all four sounds are synthesized. No downloaded assets, accounts, services, or credentials are needed. The Simple 2D engine handles the clock, input, audio, touch controls, canvas fitting, and debug overlay.

## Run locally

Use a current Node.js version supported by Vite (Node 22.12+ recommended).

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. To build and inspect the static production site:

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/` to the root of any static web server. There is no server-side component or further build step.

## Controls

| Control | Action |
| --- | --- |
| W / S | Move the left paddle |
| ↑ / ↓ | Move the right paddle in Versus; the left paddle in Solo |
| W / S or ↑ / ↓ | Navigate menus |
| Enter / Space | Confirm a menu selection |
| P / Escape | Pause or resume |
| Escape | Return from the field guide or match result |
| M | Toggle sound |
| Backtick | Toggle the engine's diagnostic overlay |

Menus also accept mouse clicks and touch. On touch devices, the engine supplies vertical paddle sliders and menu buttons. The court automatically fits the window without changing the simulation.

Hit near a paddle's center for a flat return, or near an edge for a steep one. Move as you strike to curve the flight. Lime arcs around the ball indicate spin; its trail shows the recent path. Coral bars reflect the ball off their current angle without increasing its speed.

## Checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests run the real engine over an in-process canvas and a counted clock, exercising menus, pointer gestures, serves, movement, collisions, spin decay, goals, deuce, pause, AI, diagnostics, and recording. Tests never need a browser or real-time waits.

## Source map

- `src/game.ts`: exported immutable state contract, initialization, and engine binding.
- `src/world.ts`: initial state, parking, match resets, obstacle pose formulas.
- `src/simulation.ts`: input transitions, paddle movement, AI, serving, and scoring.
- `src/physics.ts`: sub-stepped flight and oriented collision resolution.
- `src/presentation.ts` and `src/layout.ts`: canvas drawing and shared menu hit regions.
- `src/debug.ts`: versioned poses and detached snapshots, returned only through `engine.debug`.
- `src/game.test.ts`: simulation and integration tests.
- `showcase/`: player description, screenshots, and a four-second engine draw-command replay.

The supplied `src/main.ts`, `src/constants.ts`, engine, HTML, and toolchain configuration remain unchanged. See `specs/` for the full game contract and `engine/` for the runtime API. Debug poses operate through `engine.apply`; nothing is attached to the browser's global object.
