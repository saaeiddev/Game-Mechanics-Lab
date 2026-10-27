# Game Mechanics Lab

A work-in-progress browser-based 3D game mechanics playground built with React, TypeScript, Vite, Three.js, React Three Fiber and Rapier.

## Current work

- Physics scene with cubes, spheres, capsules, gravity, mass, friction, restitution and projectile spawning.
- Physics-based character movement with keyboard and touch controls.
- NPC finite-state behavior with distance, field-of-view and line-of-sight checks, A* grid pathfinding and patrol waypoints.
- Orbit, first-person, follow, top-down and isometric camera modes.
- A basic level editor with selection, numeric transforms, duplication, deletion, undo/redo, player spawn, waypoints, example scenes, local save/load and JSON import/export.
- Six experiment entry points using the shared simulation.

These features compile but have **not been verified in a browser**. The project is not yet complete against its full specification. In particular, visual object gizmos, complete character mechanics, full physics telemetry/debug tools, robust camera interactions, individual dedicated experiment scenes, and comprehensive browser and mobile testing remain outstanding. Do not deploy this branch as a finished product.

## Local development

```sh
npm ci
npm run dev
npm run test
npm run build
```

Open the Vite URL shown in the terminal. Move with WASD, jump with Space and sprint with Shift. Drag the viewport to orbit and scroll to zoom. Scene data is stored in browser local storage or exported as JSON.

## Deployment

The Vite base path targets `/Game-Mechanics-Lab/`. A GitHub Actions workflow is included for GitHub Pages when the repository is configured to use Actions as the Pages source and the work is ready to merge. Deployment has not been verified.
