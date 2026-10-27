# Game Mechanics Lab

A browser-based 3D playground for interactive game mechanics, made with React, TypeScript, Vite, Three.js, React Three Fiber and Rapier.

## Features

- Physics simulation with cubes, spheres, capsules, adjustable gravity, friction, restitution, damping, mass, launch and drop parameters, presets, collider debug view, velocity vectors and recorded trails.
- Physics-based character movement with walking, sprinting, jumping, coyote time, jump buffering, optional double jump, keyboard and touch controls.
- Two NPCs with finite-state behavior, distance and field-of-view detection, obstacle line-of-sight checks, A* grid pathfinding, patrol waypoints, pursuit and search.
- Five camera modes, adjustable field of view, distance, height, sensitivity, clipping and follow speed.
- Level editor with transform gizmos and numeric transforms, selection, duplication, deletion, undo/redo, player spawn, waypoints, example scenes, local save/load and validated JSON import/export.
- Six interactive experiment scenarios, actual simulation measurements, render quality controls and contextual help.

## Development

```sh
npm ci
npm run dev
npm run test
npm run build
```

To run the browser tests, install Playwright's Chromium and then run:

```sh
npx playwright install chromium
npm run test:e2e
```

Move with WASD, jump with Space and sprint with Shift. Drag the viewport to orbit and scroll to zoom. Save stores a scene and settings in browser local storage; Export saves a portable JSON file.

## Current limitations

The experiments are scenario variants built on a shared simulation engine. NPC pathfinding uses a grid and axis-aligned approximations for obstacles. Touch controls and transform gizmos have been tested in a simulated mobile/desktop browser but still need testing on physical devices. The automated tests cover core flows but are not exhaustive, and some advanced controls and visualizations in the original specification are not yet available.

## Deployment

The Vite base path targets `/Game-Mechanics-Lab/`. The GitHub Pages workflow runs unit and browser tests and builds the site after a push to `main`. The repository must have Pages configured to use GitHub Actions. Deployment is not yet verified.
