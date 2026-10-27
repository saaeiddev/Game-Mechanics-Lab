# Game Mechanics Lab

An early interactive physics sandbox using React, Three.js and Rapier. Spawn cubes and spheres, orbit the camera, pause and reset the simulation, and change gravity, restitution and friction. This is a foundation, not the complete multi-lab application described in the project brief.

## Development

```sh
npm ci
npm run dev
npm run build
```

The Vite base path targets `/Game-Mechanics-Lab/`. The Pages workflow deploys the `main` branch after Pages is configured to use GitHub Actions in repository settings.

## Current limitations

Character controls, NPC AI, camera modes, level editor, persistence, experiment gallery, mobile movement controls, instrumentation, and automated browser tests are not yet implemented. The physics sandbox currently supports cubes and spheres only. Live browser and deployment verification are still required.
