import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { create } from "zustand";
import { motion } from "motion/react";
import {
  defaultScene,
  validateScene,
  type SceneData,
  type SceneObject,
} from "./engine/scene";
import type { Config, Lab } from "./engine/types";
import { input, keyState } from "./engine/input";
import { Entity, Player, NPC, FrameMeter } from "./components/SceneComponents";
import "./style.css";

const initial: Config = {
  gravity: -9.81,
  bounce: 0.5,
  friction: 0.6,
  mass: 1,
  linDamp: 0.05,
  angDamp: 0.05,
  launchSpeed: 11,
  launchAngle: 20,
  spawnHeight: 5,
  initialX: 0,
  initialY: 0,
  initialZ: 0,
  impulse: 5,
  speed: 4,
  sprint: 7,
  jump: 6,
  acceleration: 12,
  deceleration: 12,
  air: 0.5,
  coyote: 0.12,
  buffer: 0.12,
  doubleJump: false,
  detect: 7,
  chase: 10,
  fov: 110,
  aiSpeed: 2.5,
  reaction: 0.3,
  search: 3,
  camera: "orbit",
  cameraFov: 50,
  distance: 8,
  height: 5,
  follow: 5,
  sensitivity: 1,
  offsetX: 0,
  offsetZ: 0,
  near: 0.1,
  far: 100,
  turn: 10,
};
type ConfigUpdater = Config | ((current: Config) => Config);
const useConfig = create<{
  cfg: Config;
  setCfg: (value: ConfigUpdater) => void;
}>((set) => ({
  cfg: initial,
  setCfg: (value) =>
    set((state) => ({
      cfg: typeof value === "function" ? value(state.cfg) : value,
    })),
}));
const labs: [Lab, string, string][] = [
  ["overview", "00", "Overview"],
  ["character", "01", "Character controller"],
  ["physics", "02", "Physics sandbox"],
  ["ai", "03", "NPC intelligence"],
  ["camera", "04", "Camera systems"],
  ["editor", "05", "Level editor"],
  ["experiments", "06", "Experiments"],
];
const palette = ["#ff7139", "#d9ff43", "#ff4e91", "#4be6d4", "#b79afa"];
const makeObject = (
  kind: SceneObject["kind"],
  i: number,
  dynamic = false,
): SceneObject => ({
  id: crypto.randomUUID(),
  kind,
  x: (Math.random() - 0.5) * 3,
  y: dynamic ? 5 + i * 0.7 : 0.6,
  z: (Math.random() - 0.5) * 3,
  rx: 0,
  ry: 0,
  rz: 0,
  sx: 1,
  sy: 1,
  sz: 1,
  color: palette[i % palette.length],
  dynamic,
});
function experimentScene(name: string): SceneData {
  const base = defaultScene();
  const fixed = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    i: number,
  ): SceneObject => ({ ...makeObject("cube", i), x, y, z, sx, sy, sz });
  if (name === "Gravity")
    return {
      ...base,
      objects: [
        { ...makeObject("cube", 0, true), x: -2, y: 7, z: 0, gravityScale: 1 },
        {
          ...makeObject("sphere", 1, true),
          x: 2,
          y: 7,
          z: 0,
          gravityScale: 0.165,
        },
      ],
    };
  if (name === "Collision")
    return {
      ...base,
      objects: [
        fixed(0, 1, 0, 3, 2, 0.7, 1),
        {
          ...makeObject("sphere", 0, true),
          id: "projectile-" + crypto.randomUUID(),
          x: 0,
          y: 2,
          z: 7,
        },
      ],
    };
  if (name === "Projectile")
    return {
      ...base,
      objects: [
        fixed(0, 0.5, -4, 5, 1, 1, 2),
        {
          ...makeObject("sphere", 0, true),
          id: "projectile-" + crypto.randomUUID(),
          x: 0,
          y: 2,
          z: 7,
        },
      ],
    };
  if (name === "Jump")
    return {
      ...base,
      objects: Array.from({ length: 4 }, (_, i) =>
        fixed(-3 + i * 2, 0.4 + i * 0.4, -1 - i * 2, 1.7, 0.5, 1.7, i),
      ),
    };
  if (name === "NPC detection")
    return {
      ...base,
      objects: [fixed(0, 1, 0, 2, 2, 5, 0), fixed(-4, 0.5, 2, 2, 1, 2, 1)],
    };
  return {
    ...base,
    objects: [fixed(-3, 0.5, 0, 3, 1, 3, 0), fixed(3, 1, -3, 3, 2, 3, 1)],
  };
}
function Input() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.code === "Space" && !keyState.Space) input.jumpQueued = true;
      keyState[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keyState[e.code] = false;
    };
    const blur = () =>
      Object.keys(keyState).forEach((k) => (keyState[k] = false));
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  return null;
}
function Control({
  title,
  value,
  min,
  max,
  step = 0.1,
  set,
  unit = "",
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  set: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="control">
      <div>
        <span>{title}</span>
        <b>
          {value.toFixed(step < 0.1 ? 2 : 1)} <small>{unit}</small>
        </b>
      </div>
      <input
        type="range"
        aria-label={title}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(+e.target.value)}
      />
    </div>
  );
}
function validSettings(value: unknown): value is Config {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const limits: Record<string, [number, number]> = {
    gravity: [-30, 0],
    bounce: [0, 1],
    friction: [0, 1],
    mass: [0.1, 10],
    linDamp: [0, 2],
    angDamp: [0, 2],
    launchSpeed: [1, 25],
    launchAngle: [0, 80],
    spawnHeight: [1, 15],
    initialX: [-20, 20],
    initialY: [-20, 20],
    initialZ: [-20, 20],
    impulse: [0, 30],
    speed: [1, 10],
    sprint: [1, 15],
    jump: [1, 12],
    acceleration: [1, 30],
    deceleration: [1, 30],
    air: [0, 1],
    coyote: [0, 0.4],
    buffer: [0, 0.4],
    detect: [1, 12],
    chase: [1, 20],
    fov: [20, 360],
    aiSpeed: [0.5, 6],
    reaction: [0, 3],
    search: [0, 10],
    cameraFov: [25, 100],
    distance: [2, 18],
    height: [1, 12],
    follow: [1, 15],
    sensitivity: [0.1, 3],
    offsetX: [-5, 5],
    offsetZ: [-5, 5],
    near: [0.01, 5],
    far: [20, 100],
    turn: [1, 25],
  };
  return (
    Object.entries(initial).every(([key, def]) => {
      const v = data[key];
      if (typeof v !== typeof def) return false;
      if (typeof v === "number") {
        const limit = limits[key];
        return Number.isFinite(v) && !!limit && v >= limit[0] && v <= limit[1];
      }
      return true;
    }) &&
    ["orbit", "first", "third", "top", "isometric"].includes(
      data.camera as string,
    )
  );
}
function WaypointEditor({
  scene,
  commit,
}: {
  scene: SceneData;
  commit: (scene: SceneData) => void;
}) {
  return (
    <>
      <div className="rule" />
      <label>
        PATROL WAYPOINTS <span>{scene.waypoints.length}</span>
      </label>
      {scene.waypoints.map((wp, i) => (
        <div className="waypoint" key={i}>
          <span>POINT {i + 1}</span>
          {([0, 1] as const).map((axis) => (
            <input
              key={axis}
              aria-label={`Waypoint ${i + 1} ${axis ? "Z" : "X"}`}
              type="number"
              step="0.5"
              value={wp[axis]}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (Number.isFinite(n)) {
                  const w = scene.waypoints.map(
                    (v) => [...v] as [number, number],
                  );
                  w[i][axis] = n;
                  commit({ ...scene, waypoints: w });
                }
              }}
            />
          ))}
          <button
            disabled={scene.waypoints.length <= 2}
            onClick={() =>
              commit({
                ...scene,
                waypoints: scene.waypoints.filter((_, j) => j !== i),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="secondary"
        onClick={() =>
          commit({ ...scene, waypoints: [...scene.waypoints, [0, 0]] })
        }
      >
        ADD WAYPOINT +
      </button>
    </>
  );
}
class ViewportBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="viewport-error">
        3D view unavailable. Enable WebGL in your browser or try another device.
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [lab, setLab] = useState<Lab>("overview"),
    [scene, setScene] = useState<SceneData>(defaultScene),
    [history, setHistory] = useState<SceneData[]>([]),
    [future, setFuture] = useState<SceneData[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [running, setRunning] = useState(true),
    [edit, setEdit] = useState(true),
    [epoch, setEpoch] = useState(0),
    [fps, setFps] = useState(0),
    [metric, setMetric] = useState("SIMULATION READY"),
    [message, setMessage] = useState("Ready to experiment."),
    [experiment, setExperiment] = useState("Gravity"),
    [consoleOpen, setConsoleOpen] = useState(true),
    [gizmo, setGizmo] = useState<"translate" | "rotate" | "scale">("translate"),
    [physicsDebug, setPhysicsDebug] = useState(false),
    [showVectors, setShowVectors] = useState(false),
    [showContacts, setShowContacts] = useState(false),
    [events, setEvents] = useState<string[]>([]),
    [dialog, setDialog] = useState<"help" | "settings" | null>(null),
    [quality, setQuality] = useState<"balanced" | "low" | "high">("balanced"),
    [impulseTick, setImpulseTick] = useState({ count: 0, id: "" });
  const cfg = useConfig((s) => s.cfg),
    setCfg = useConfig((s) => s.setCfg);
  const upload = useRef<HTMLInputElement>(null);
  const live = useRef(new Map<string, Partial<SceneObject>>());
  const capture = useCallback((id: string, patch: Partial<SceneObject>) => {
    live.current.set(id, patch);
  }, []);
  const scenes = useRef<Partial<Record<Lab, SceneData>>>({});
  const config = (k: keyof Config, v: number | string | boolean) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const commit = (s: SceneData) => {
    setHistory((h) => [...h.slice(-29), scene]);
    setFuture([]);
    setScene(s);
  };
  const update = (patch: Partial<SceneObject>) => {
    if (!selected) return;
    commit({
      ...scene,
      objects: scene.objects.map((o) =>
        o.id === selected ? { ...o, ...patch } : o,
      ),
    });
  };
  const current = scene.objects.find((o) => o.id === selected);
  const reset = () => {
    live.current.clear();
    setEpoch((v) => v + 1);
    setRunning(true);
    setMessage("Simulation reset.");
  };
  const add = (kind: SceneObject["kind"], dynamic = lab === "physics") => {
    const o = makeObject(kind, scene.objects.length, dynamic);
    if (dynamic) o.y = cfg.spawnHeight;
    commit({ ...scene, objects: [...scene.objects, o] });
    setSelected(o.id);
  };
  const nav = (next: Lab) => {
    live.current.clear();
    input.jumpQueued = false;
    keyState.Space = false;
    if (next === "experiments" && !scenes.current.experiments) {
      setExperiment("Gravity");
      setCfg((c) => ({ ...c, gravity: -9.81 }));
    }
    setLab(next);
    setSelected(null);
    setMetric("SIMULATION READY");
    setEpoch((e) => e + 1);
    setEdit(true);
    scenes.current[lab] = scene;
    setScene(
      scenes.current[next] ??
        (next === "physics"
          ? {
              ...defaultScene(),
              objects: [
                makeObject("cube", 0, true),
                makeObject("sphere", 1, true),
              ],
            }
          : next === "experiments"
            ? experimentScene("Gravity")
            : defaultScene()),
    );
    setHistory([]);
    setFuture([]);
  };
  const snapshot = () => ({
    ...scene,
    objects: scene.objects.map((o) =>
      o.dynamic && !(lab === "editor" && edit)
        ? { ...o, ...live.current.get(o.id) }
        : o,
    ),
    settings: cfg,
  });
  const save = () => {
    try {
      localStorage.setItem("gml-scene-v1", JSON.stringify(snapshot()));
      setMessage("Scene saved locally on this device.");
    } catch {
      setMessage("Could not save scene in this browser.");
    }
  };
  const load = () => {
    try {
      const s = JSON.parse(localStorage.getItem("gml-scene-v1") || "null");
      if (!validateScene(s)) throw Error();
      if (validSettings(s.settings)) setCfg(s.settings);
      commit(s);
      setSelected(null);
      reset();
      setMessage("Saved scene loaded.");
    } catch {
      setMessage("No valid saved scene found.");
    }
  };
  const exportScene = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot(), null, 2)], {
        type: "application/json",
      }),
    );
    a.download = "game-mechanics-scene.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importScene = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 500000) throw Error();
      const data = JSON.parse(await f.text());
      if (!validateScene(data)) throw Error();
      if (validSettings(data.settings)) setCfg(data.settings);
      commit(data);
      setSelected(null);
      reset();
      setMessage("Scene imported.");
    } catch {
      setMessage("Invalid scene file. Import a valid Game Mechanics Lab JSON.");
    }
    e.target.value = "";
  };
  const preset = (name: string) => {
    if (name === "Low gravity") setCfg({ ...cfg, gravity: -2 });
    if (name === "Moon gravity") setCfg({ ...cfg, gravity: -1.62 });
    if (name === "High friction") setCfg({ ...cfg, friction: 1, bounce: 0.1 });
    if (name === "Bouncy") setCfg({ ...cfg, bounce: 1 });
    if (name === "Earth")
      setCfg({ ...cfg, gravity: -9.81, bounce: 0.5, friction: 0.6 });
    if (name === "Projectile test") {
      setScene({
        ...defaultScene(),
        objects: [
          {
            ...makeObject("sphere", 0, true),
            id: "projectile-" + crypto.randomUUID(),
            x: 0,
            y: 2,
            z: 7,
          },
        ],
      });
      setSelected(null);
    }
    if (name === "Falling tower") {
      setScene({
        ...defaultScene(),
        objects: Array.from({ length: 12 }, (_, i) => ({
          ...makeObject("cube", i, true),
          x: (i % 2) * 1.05 - 0.525,
          y: 1 + Math.floor(i / 2) * 1.02,
          z: 0,
        })),
      });
      setSelected(null);
    }
    reset();
    setMessage(`${name} preset applied.`);
  };
  const selectExperiment = (name: string) => {
    setExperiment(name);
    setEpoch((e) => e + 1);
    if (name === "Gravity") setCfg({ ...cfg, gravity: -9.81 });
    if (name === "Collision") setCfg({ ...cfg, bounce: 0.9 });
    if (name === "Jump") setCfg({ ...cfg, jump: 7 });
    if (name === "Projectile") setCfg({ ...cfg, gravity: -9.81 });
    setScene(experimentScene(name));
  };
  const effective =
    lab === "experiments"
      ? experiment === "NPC detection"
        ? "ai"
        : experiment === "Camera movement"
          ? "camera"
          : experiment === "Jump"
            ? "character"
            : "physics"
      : lab;
  const hasPlayer =
    effective === "character" ||
    effective === "camera" ||
    (effective === "editor" && !edit);
  const objectEdit = effective === "editor" && edit;
  const report = useCallback((s: string) => setMetric(s), []);
  const fpsReport = useCallback((n: number) => setFps(n), []);
  const logEvent = useCallback(
    (v: string) => setEvents((e) => (e.at(-1) === v ? e : [...e.slice(-5), v])),
    [],
  );
  return (
    <div className="app">
      <Input />
      <header>
        <div className="brand">
          <span className="brandmark">✳</span>
          <span>
            GAME
            <br />
            MECHANICS <b>LAB</b>
          </span>
        </div>
        <span className="head-label">INTERACTIVE SYSTEMS / 001</span>
        <div className="header-right">
          <span className="status" aria-live="polite">
            <span className="sr-only">Simulation status: </span>
            <i /> {running ? "SIMULATION LIVE" : "PAUSED"}
          </span>
          <span className="head-label">{fps} FPS</span>
          <button
            className="iconbtn"
            onClick={() => setRunning(!running)}
            title={running ? "Pause" : "Play"}
          >
            {running ? "Ⅱ" : "▶"}
          </button>
          <button className="iconbtn" onClick={reset} title="Reset">
            ↻
          </button>
          <button
            className="iconbtn"
            title="Stop and reset"
            aria-label="Stop and reset"
            onClick={() => {
              setEpoch((e) => e + 1);
              setRunning(false);
              setMessage("Simulation stopped and reset.");
            }}
          >
            ■
          </button>
          <button
            className="iconbtn"
            title="Help"
            aria-label="Help"
            onClick={() => setDialog("help")}
          >
            ?
          </button>
          <button
            className="iconbtn"
            title="Settings"
            aria-label="Settings"
            onClick={() => setDialog("settings")}
          >
            ⚙
          </button>
          <button className="top-save" onClick={save}>
            SAVE SCENE ↗
          </button>
        </div>
      </header>
      <main>
        <aside className="nav">
          <div className="small">
            WORKSPACE <span>01 / 06</span>
          </div>
          <h2>
            THE
            <br />
            LAB<span className="dot">.</span>
          </h2>
          <p>Explore the forces that make virtual worlds move.</p>
          <div className="navlist">
            {labs.map(([id, n, title]) => (
              <button
                key={id}
                className={"navitem " + (lab === id ? "active" : "")}
                onClick={() => nav(id)}
              >
                <span>{n}</span>
                <strong>{title}</strong>
                <span>↗</span>
              </button>
            ))}
          </div>
          <div className="nav-note">
            <span>CREATIVE SYSTEMS / 2026</span>
            <p>
              Build. Break. Understand.
              <br />
              Repeat.
            </p>
          </div>
        </aside>
        <section className="workspace">
          <motion.div
            key={lab}
            className="workspace-top"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
          >
            <div>
              <div className="eyebrow">
                {lab === "overview"
                  ? "A CREATIVE SPACE TO EXPERIMENT"
                  : `EXPERIMENT / ${labs.find((l) => l[0] === lab)?.[1]}`}
              </div>
              <h1>
                {lab === "overview" ? (
                  <>
                    PLAY WITH
                    <br />
                    <em>THE RULES.</em>
                  </>
                ) : (
                  <>
                    {labs.find((l) => l[0] === lab)?.[2].split(" ")[0]}
                    <br />
                    <em>
                      {labs
                        .find((l) => l[0] === lab)?.[2]
                        .split(" ")
                        .slice(1)
                        .join(" ") || "LAB."}
                    </em>
                  </>
                )}
              </h1>
              <p>
                {lab === "overview"
                  ? "An interactive playground for the mechanics behind games."
                  : lab === "ai"
                    ? "Move the lime target with WASD and observe the NPC."
                    : hasPlayer
                      ? "Move with WASD · jump with Space · sprint with Shift."
                      : objectEdit
                        ? "Select an object in the viewport to edit its properties."
                        : "Change the forces. See what happens."}
              </p>
            </div>
            <div className="index">
              {labs.find((l) => l[0] === lab)?.[1]}
              <span>/06</span>
            </div>
          </motion.div>
          {lab === "experiments" && (
            <div className="chips">
              {[
                "Gravity",
                "Jump",
                "Collision",
                "NPC detection",
                "Camera movement",
                "Projectile",
              ].map((e) => (
                <button
                  key={e}
                  className={experiment === e ? "chosen" : ""}
                  onClick={() => selectExperiment(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <div className="viewport">
            <div className="viewport-label">
              <span>● LIVE VIEWPORT</span>
              <span>DRAG TO ORBIT · SCROLL TO ZOOM</span>
            </div>
            <Suspense
              fallback={
                <div className="loading">LOADING PHYSICS ENGINE...</div>
              }
            >
              <ViewportBoundary>
                <Canvas
                  shadows
                  camera={{ position: [10, 10, 13], fov: 50 }}
                  dpr={[
                    1,
                    quality === "low" ? 1 : quality === "high" ? 2 : 1.5,
                  ]}
                >
                  <color attach="background" args={["#ded7c7"]} />
                  <ambientLight intensity={1.6} />
                  <directionalLight
                    position={[5, 12, 8]}
                    intensity={3}
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                  />
                  <FrameMeter report={fpsReport} />
                  <Physics
                    debug={physicsDebug}
                    key={`${epoch}-${effective}-${edit}`}
                    gravity={[0, cfg.gravity, 0]}
                    paused={!running}
                  >
                    <RigidBody type="fixed" colliders={false}>
                      <CuboidCollider
                        args={[10, 0.15, 10]}
                        position={[0, -0.15, 0]}
                        friction={cfg.friction}
                        restitution={cfg.bounce}
                      />
                      <mesh receiveShadow position={[0, -0.16, 0]}>
                        <boxGeometry args={[20, 0.3, 20]} />
                        <meshStandardMaterial color="#302733" />
                      </mesh>
                    </RigidBody>
                    {scene.objects.map((o) => (
                      <Entity
                        key={o.id}
                        o={o}
                        selected={o.id === selected}
                        onSelect={() => setSelected(o.id)}
                        cfg={cfg}
                        edit={objectEdit}
                        mode={gizmo}
                        onTransform={update}
                        report={report}
                        onEvent={logEvent}
                        showVectors={showVectors}
                        showContacts={showContacts}
                        impulseTick={impulseTick}
                        capture={capture}
                      />
                    ))}
                    {hasPlayer && (
                      <Player
                        cfg={cfg}
                        spawn={scene.spawn}
                        report={report}
                        mode={effective}
                        paused={!running}
                      />
                    )}
                  </Physics>
                  {effective === "ai" && (
                    <>
                      <NPC
                        key={`a-${epoch}`}
                        cfg={cfg}
                        scene={scene}
                        report={report}
                        paused={!running}
                        start={{ x: -6, z: -5 }}
                        name="NPC A"
                        showTarget
                      />
                      <NPC
                        key={`b-${epoch}`}
                        cfg={cfg}
                        scene={scene}
                        report={report}
                        paused={!running}
                        start={{ x: 6, z: -5 }}
                        name="NPC B"
                        showTarget={false}
                      />
                    </>
                  )}
                  <Grid
                    position={[0, 0.002, 0]}
                    args={[20, 20]}
                    cellSize={1}
                    cellColor="#8b7f8c"
                    sectionSize={5}
                    sectionColor="#c9bdc8"
                    fadeDistance={35}
                  />
                  {(effective !== "camera" || cfg.camera === "orbit") && (
                    <OrbitControls
                      makeDefault
                      minDistance={4}
                      maxDistance={35}
                    />
                  )}
                </Canvas>
              </ViewportBoundary>
            </Suspense>
            <div className="viewport-bottom">
              <span>ENGINE / RAPIER</span>
              <span>
                OBJECTS {String(scene.objects.length).padStart(2, "0")}
              </span>
            </div>
            {(hasPlayer || effective === "ai") && (
              <div className="touchpad">
                <button
                  onPointerDown={() => (keyState.KeyW = true)}
                  onPointerUp={() => (keyState.KeyW = false)}
                  onPointerCancel={() => (keyState.KeyW = false)}
                >
                  ↑
                </button>
                <div>
                  <button
                    onPointerDown={() => (keyState.KeyA = true)}
                    onPointerUp={() => (keyState.KeyA = false)}
                    onPointerCancel={() => (keyState.KeyA = false)}
                  >
                    ←
                  </button>
                  <button
                    onPointerDown={() => (keyState.KeyS = true)}
                    onPointerUp={() => (keyState.KeyS = false)}
                    onPointerCancel={() => (keyState.KeyS = false)}
                  >
                    ↓
                  </button>
                  <button
                    onPointerDown={() => (keyState.KeyD = true)}
                    onPointerUp={() => (keyState.KeyD = false)}
                    onPointerCancel={() => (keyState.KeyD = false)}
                  >
                    →
                  </button>
                </div>
                {hasPlayer && (
                  <button
                    onPointerDown={() => {
                      keyState.Space = true;
                      input.jumpQueued = true;
                    }}
                    onPointerUp={() => (keyState.Space = false)}
                    onPointerCancel={() => (keyState.Space = false)}
                  >
                    JUMP
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="bottom">
            <button onClick={() => setConsoleOpen(!consoleOpen)}>
              {consoleOpen ? "−" : "+"} CONSOLE
            </button>
            <span>
              <b>●</b> {running ? "SIMULATION RUNNING" : "SIMULATION PAUSED"}
            </span>
            <span>{fps} FPS</span>
            <span>GRAVITY {cfg.gravity.toFixed(2)} m/s²</span>
          </div>
          {consoleOpen && (
            <div className="console">
              <div>{metric}</div>
              <div>{message}</div>
              {events.map((event, i) => (
                <div key={i}>{event}</div>
              ))}
            </div>
          )}
          {lab === "overview" && (
            <div className="quick">
              <span>QUICK START ↗</span>
              {labs.slice(1).map(([id, , title]) => (
                <button key={id} onClick={() => nav(id)}>
                  {title} ↗
                </button>
              ))}
            </div>
          )}
        </section>
        <aside className="inspector">
          <div className="inspector-head">
            <span>CONTROL PANEL</span>
            <span>↗</span>
          </div>
          <h3>
            {lab === "overview" ? (
              <>
                Make a<br />
                <em>little chaos.</em>
              </>
            ) : (
              <>
                Tune the
                <br />
                <em>mechanics.</em>
              </>
            )}
          </h3>
          <p className="muted">
            {lab === "ai"
              ? "Change perception and speed. The NPC follows a grid path and checks line of sight."
              : lab === "editor"
                ? "Build a scene, select objects, and switch to play mode."
                : "Adjust the parameters and experiment with the simulation."}
          </p>
          <div className="rule" />
          {(effective === "physics" || lab === "overview") && (
            <>
              <label>
                ADD OBJECT <span>01</span>
              </label>
              <div className="spawn">
                {(["cube", "sphere", "capsule"] as const).map((k) => (
                  <button key={k} onClick={() => add(k, true)}>
                    <b>+</b>
                    <span>{k.toUpperCase()}</span>
                  </button>
                ))}
              </div>
              <button
                className="secondary"
                onClick={() => {
                  const o = {
                    ...makeObject("sphere", scene.objects.length, true),
                    id: "projectile-" + crypto.randomUUID(),
                    x: 0,
                    y: 2,
                    z: 7,
                  };
                  commit({ ...scene, objects: [...scene.objects, o] });
                  setSelected(o.id);
                }}
              >
                LAUNCH PROJECTILE ↗
              </button>
              <div className="rule" />
              <label>
                PHYSICS PRESETS <span>02</span>
              </label>
              <div className="chips panelchips">
                {[
                  "Earth",
                  "Low gravity",
                  "Moon gravity",
                  "High friction",
                  "Bouncy",
                  "Falling tower",
                  "Projectile test",
                ].map((p) => (
                  <button key={p} onClick={() => preset(p)}>
                    {p}
                  </button>
                ))}
              </div>
              <Control
                title="Gravity"
                value={cfg.gravity}
                min={-30}
                max={0}
                set={(v) => config("gravity", v)}
                unit="m/s²"
              />
              <Control
                title="Restitution"
                value={cfg.bounce}
                min={0}
                max={1}
                step={0.05}
                set={(v) => config("bounce", v)}
              />
              <Control
                title="Friction"
                value={cfg.friction}
                min={0}
                max={1}
                step={0.05}
                set={(v) => config("friction", v)}
              />
              <label className="debug-label">
                <input
                  type="checkbox"
                  checked={physicsDebug}
                  onChange={(e) => setPhysicsDebug(e.target.checked)}
                />{" "}
                SHOW COLLIDERS
              </label>
              <label className="debug-label">
                <input
                  type="checkbox"
                  checked={showVectors}
                  onChange={(e) => setShowVectors(e.target.checked)}
                />{" "}
                VELOCITY &amp; TRAIL
              </label>
              <label className="debug-label">
                <input
                  type="checkbox"
                  checked={showContacts}
                  onChange={(e) => setShowContacts(e.target.checked)}
                />{" "}
                COLLISION MARKERS
              </label>
              <p className="hint">
                Select a body in the viewport to inspect its measured position,
                speed and acceleration.
              </p>
              <Control
                title="Linear damping"
                value={cfg.linDamp}
                min={0}
                max={2}
                step={0.05}
                set={(v) => config("linDamp", v)}
              />
              <Control
                title="Angular damping"
                value={cfg.angDamp}
                min={0}
                max={2}
                step={0.05}
                set={(v) => config("angDamp", v)}
              />
              <Control
                title="Drop height"
                value={cfg.spawnHeight}
                min={1}
                max={15}
                set={(v) => config("spawnHeight", v)}
                unit="m"
              />
              {(["X", "Y", "Z"] as const).map((axis) => (
                <Control
                  key={axis}
                  title={`Initial velocity ${axis}`}
                  value={cfg[`initial${axis}`]}
                  min={-20}
                  max={20}
                  set={(v) => config(`initial${axis}`, v)}
                  unit="m/s"
                />
              ))}
              <p className="hint">
                Initial velocity changes apply to newly created objects or after
                reset.
              </p>
              <Control
                title="Launch speed"
                value={cfg.launchSpeed}
                min={1}
                max={25}
                set={(v) => config("launchSpeed", v)}
                unit="m/s"
              />
              <Control
                title="Launch angle"
                value={cfg.launchAngle}
                min={0}
                max={80}
                step={1}
                set={(v) => config("launchAngle", v)}
                unit="°"
              />
              <Control
                title="Mass"
                value={cfg.mass}
                min={0.1}
                max={10}
                set={(v) => config("mass", v)}
                unit="kg"
              />
              {current && (
                <>
                  <div className="rule" />
                  <label>SELECTED BODY</label>
                  <Control
                    title="Impulse"
                    value={cfg.impulse}
                    min={0}
                    max={30}
                    set={(v) => config("impulse", v)}
                    unit="N·s"
                  />
                  <button
                    className="secondary"
                    disabled={!current.dynamic}
                    onClick={() =>
                      setImpulseTick((t) => ({
                        count: t.count + 1,
                        id: current.id,
                      }))
                    }
                  >
                    APPLY IMPULSE ↗
                  </button>
                  <Control
                    title="Object mass"
                    value={current.mass ?? cfg.mass}
                    min={0.1}
                    max={10}
                    set={(v) => update({ mass: v })}
                    unit="kg"
                  />
                  <Control
                    title="Object friction"
                    value={current.friction ?? cfg.friction}
                    min={0}
                    max={1}
                    step={0.05}
                    set={(v) => update({ friction: v })}
                  />
                  <Control
                    title="Object bounce"
                    value={current.restitution ?? cfg.bounce}
                    min={0}
                    max={1}
                    step={0.05}
                    set={(v) => update({ restitution: v })}
                  />
                  <button
                    className="secondary"
                    onClick={() =>
                      update({
                        mass: undefined,
                        friction: undefined,
                        restitution: undefined,
                      })
                    }
                  >
                    USE WORLD PHYSICS
                  </button>
                </>
              )}
            </>
          )}
          {(effective === "character" ||
            effective === "camera" ||
            (effective === "editor" && !edit)) && (
            <>
              <label>
                CHARACTER SETTINGS <span>01</span>
              </label>
              <Control
                title="Walking speed"
                value={cfg.speed}
                min={1}
                max={10}
                set={(v) => config("speed", v)}
                unit="m/s"
              />
              <Control
                title="Sprint speed"
                value={cfg.sprint}
                min={1}
                max={15}
                set={(v) => config("sprint", v)}
                unit="m/s"
              />
              <Control
                title="Rotation speed"
                value={cfg.turn}
                min={1}
                max={25}
                set={(v) => config("turn", v)}
              />
              <Control
                title="Jump strength"
                value={cfg.jump}
                min={1}
                max={12}
                set={(v) => config("jump", v)}
              />
              <Control
                title="Acceleration"
                value={cfg.acceleration}
                min={1}
                max={30}
                set={(v) => config("acceleration", v)}
              />
              <Control
                title="Deceleration"
                value={cfg.deceleration}
                min={1}
                max={30}
                set={(v) => config("deceleration", v)}
              />
              <Control
                title="Coyote time"
                value={cfg.coyote}
                min={0}
                max={0.4}
                step={0.01}
                set={(v) => config("coyote", v)}
                unit="s"
              />
              <Control
                title="Jump buffer"
                value={cfg.buffer}
                min={0}
                max={0.4}
                step={0.01}
                set={(v) => config("buffer", v)}
                unit="s"
              />
              <label className="debug-label">
                <input
                  type="checkbox"
                  checked={cfg.doubleJump}
                  onChange={(e) => config("doubleJump", e.target.checked)}
                />{" "}
                DOUBLE JUMP
              </label>
              <Control
                title="Ground friction"
                value={cfg.friction}
                min={0}
                max={1}
                step={0.05}
                set={(v) => config("friction", v)}
              />
              <Control
                title="Air control"
                value={cfg.air}
                min={0}
                max={1}
                step={0.05}
                set={(v) => config("air", v)}
              />
              <Control
                title="Gravity"
                value={cfg.gravity}
                min={-30}
                max={0}
                set={(v) => config("gravity", v)}
              />
            </>
          )}
          {effective === "ai" && (
            <>
              <label>
                PERCEPTION & BEHAVIOR <span>01</span>
              </label>
              <Control
                title="Detection radius"
                value={cfg.detect}
                min={1}
                max={12}
                set={(v) => config("detect", v)}
                unit="m"
              />
              <Control
                title="Chase distance"
                value={cfg.chase}
                min={1}
                max={20}
                set={(v) => config("chase", v)}
                unit="m"
              />
              <Control
                title="Field of view"
                value={cfg.fov}
                min={20}
                max={360}
                step={5}
                set={(v) => config("fov", v)}
                unit="°"
              />
              <Control
                title="NPC movement speed"
                value={cfg.aiSpeed}
                min={0.5}
                max={6}
                set={(v) => config("aiSpeed", v)}
              />
              <Control
                title="Reaction delay"
                value={cfg.reaction}
                min={0}
                max={3}
                set={(v) => config("reaction", v)}
                unit="s"
              />
              <Control
                title="Search duration"
                value={cfg.search}
                min={0}
                max={10}
                set={(v) => config("search", v)}
                unit="s"
              />
              <WaypointEditor scene={scene} commit={commit} />
              <p className="hint">
                Pink line: patrol route. Lime line: A* path. The NPC checks
                distance, viewing angle and obstacles.
              </p>
            </>
          )}
          {effective === "camera" && (
            <>
              <div className="rule" />
              <label>
                CAMERA MODE <span>02</span>
              </label>
              <select
                value={cfg.camera}
                onChange={(e) => config("camera", e.target.value)}
                aria-label="Camera mode"
              >
                <option value="orbit">Free orbit</option>
                <option value="first">First person</option>
                <option value="third">Third-person follow</option>
                <option value="top">Top-down</option>
                <option value="isometric">Isometric</option>
              </select>
              <Control
                title="Field of view"
                value={cfg.cameraFov}
                min={25}
                max={100}
                step={1}
                set={(v) => config("cameraFov", v)}
                unit="°"
              />
              <Control
                title="Distance"
                value={cfg.distance}
                min={2}
                max={18}
                set={(v) => config("distance", v)}
              />
              <Control
                title="Height"
                value={cfg.height}
                min={1}
                max={12}
                set={(v) => config("height", v)}
              />
              <Control
                title="Camera offset X"
                value={cfg.offsetX}
                min={-5}
                max={5}
                set={(v) => config("offsetX", v)}
              />
              <Control
                title="Camera offset Z"
                value={cfg.offsetZ}
                min={-5}
                max={5}
                set={(v) => config("offsetZ", v)}
              />
              <Control
                title="Mouse sensitivity"
                value={cfg.sensitivity}
                min={0.1}
                max={3}
                set={(v) => config("sensitivity", v)}
              />
              <Control
                title="Near clipping"
                value={cfg.near}
                min={0.01}
                max={5}
                step={0.01}
                set={(v) => config("near", v)}
              />
              <Control
                title="Far clipping"
                value={cfg.far}
                min={20}
                max={100}
                step={1}
                set={(v) => config("far", v)}
              />
              <Control
                title="Follow speed"
                value={cfg.follow}
                min={1}
                max={15}
                set={(v) => config("follow", v)}
              />
            </>
          )}
          {lab === "editor" && (
            <>
              <label>
                LEVEL EDITOR <span>01</span>
              </label>
              <div className="chips panelchips">
                <button
                  className={edit ? "chosen" : ""}
                  onClick={() => {
                    setEdit(true);
                    reset();
                  }}
                >
                  EDIT
                </button>
                <button
                  className={!edit ? "chosen" : ""}
                  onClick={() => {
                    setEdit(false);
                    reset();
                  }}
                >
                  PLAY
                </button>
              </div>
              {edit && (
                <>
                  <div className="chips panelchips">
                    {(["translate", "rotate", "scale"] as const).map((m) => (
                      <button
                        key={m}
                        className={gizmo === m ? "chosen" : ""}
                        onClick={() => setGizmo(m)}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="spawn">
                    {(["cube", "sphere", "capsule"] as const).map((k) => (
                      <button key={k} onClick={() => add(k, false)}>
                        <b>+</b>
                        <span>{k.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                  <div className="chips panelchips">
                    <button
                      disabled={!history.length}
                      onClick={() => {
                        if (!history.length) return;
                        setFuture((f) => [scene, ...f]);
                        setScene(history[history.length - 1]);
                        setHistory((h) => h.slice(0, -1));
                      }}
                    >
                      UNDO
                    </button>
                    <button
                      disabled={!future.length}
                      onClick={() => {
                        if (!future.length) return;
                        setHistory((h) => [...h, scene]);
                        setScene(future[0]);
                        setFuture((f) => f.slice(1));
                      }}
                    >
                      REDO
                    </button>
                    <button
                      disabled={!current}
                      onClick={() => {
                        if (!current) return;
                        const o = {
                          ...current,
                          id: crypto.randomUUID(),
                          x: current.x + 1,
                        };
                        commit({ ...scene, objects: [...scene.objects, o] });
                        setSelected(o.id);
                      }}
                    >
                      DUPLICATE
                    </button>
                    <button
                      disabled={!current}
                      onClick={() => {
                        commit({
                          ...scene,
                          objects: scene.objects.filter(
                            (o) => o.id !== selected,
                          ),
                        });
                        setSelected(null);
                      }}
                    >
                      DELETE
                    </button>
                  </div>
                  {current && (
                    <>
                      <div className="rule" />
                      <label>
                        SELECTED OBJECT{" "}
                        <span>{current.kind.toUpperCase()}</span>
                      </label>
                      <div className="editor-fields">
                        {(
                          [
                            "x",
                            "y",
                            "z",
                            "rx",
                            "ry",
                            "rz",
                            "sx",
                            "sy",
                            "sz",
                          ] as const
                        ).map((k) => (
                          <label key={k}>
                            {k.toUpperCase()}
                            <input
                              type="number"
                              step="0.1"
                              min={k.startsWith("s") ? 0.1 : -20}
                              max="20"
                              value={current[k]}
                              onChange={(e) => {
                                const n = e.target.valueAsNumber;
                                if (Number.isFinite(n))
                                  update({
                                    [k]: k.startsWith("s")
                                      ? Math.max(0.1, n)
                                      : n,
                                  });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <div className="rule" />
                      <label>OBJECT PHYSICS</label>
                      <Control
                        title="Object mass"
                        value={current.mass ?? cfg.mass}
                        min={0.1}
                        max={10}
                        set={(v) => update({ mass: v })}
                        unit="kg"
                      />
                      <Control
                        title="Object friction"
                        value={current.friction ?? cfg.friction}
                        min={0}
                        max={1}
                        step={0.05}
                        set={(v) => update({ friction: v })}
                      />
                      <Control
                        title="Object bounce"
                        value={current.restitution ?? cfg.bounce}
                        min={0}
                        max={1}
                        step={0.05}
                        set={(v) => update({ restitution: v })}
                      />
                      <button
                        className="secondary"
                        onClick={() =>
                          update({
                            mass: undefined,
                            friction: undefined,
                            restitution: undefined,
                          })
                        }
                      >
                        USE WORLD PHYSICS
                      </button>
                      <div className="editor-extra">
                        <label>
                          COLOR{" "}
                          <input
                            type="color"
                            value={current.color}
                            onChange={(e) => update({ color: e.target.value })}
                          />
                        </label>
                        <label>
                          DYNAMIC{" "}
                          <input
                            type="checkbox"
                            checked={current.dynamic}
                            onChange={(e) =>
                              update({ dynamic: e.target.checked })
                            }
                          />
                        </label>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="rule" />
              <label>
                PLAYER SPAWN <span>02</span>
              </label>
              <div className="editor-fields">
                {(["X", "Y", "Z"] as const).map((k, i) => (
                  <label key={k}>
                    {k}
                    <input
                      type="number"
                      step="0.5"
                      value={scene.spawn[i]}
                      onChange={(e) => {
                        const n = e.target.valueAsNumber;
                        if (Number.isFinite(n)) {
                          const spawn = [...scene.spawn] as [
                            number,
                            number,
                            number,
                          ];
                          spawn[i] = n;
                          commit({ ...scene, spawn });
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
              <WaypointEditor scene={scene} commit={commit} />
              <div className="rule" />
              <label>
                EXAMPLE LEVELS <span>03</span>
              </label>
              <div className="chips panelchips">
                {["Blocks", "Platforms", "Empty"].map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      let example = defaultScene();
                      if (name === "Empty")
                        example = { ...example, objects: [] };
                      if (name === "Platforms")
                        example = {
                          ...example,
                          objects: Array.from({ length: 5 }, (_, i) => ({
                            ...makeObject("cube", i),
                            x: -4 + i * 2,
                            y: 0.4 + i * 0.5,
                            z: 0,
                            sx: 1.6,
                            sy: 0.5,
                            sz: 1.6,
                          })),
                        };
                      commit(example);
                      setSelected(null);
                      reset();
                      setMessage(name + " level loaded.");
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="rule" />
              <label>
                SCENE FILE <span>04</span>
              </label>
              <div className="chips panelchips">
                <button onClick={save}>SAVE</button>
                <button onClick={load}>LOAD</button>
                <button onClick={exportScene}>EXPORT</button>
                <button onClick={() => upload.current?.click()}>IMPORT</button>
                <button
                  onClick={() => {
                    commit(defaultScene());
                    setSelected(null);
                    reset();
                  }}
                >
                  RESET
                </button>
                <button
                  onClick={() => {
                    commit({ ...defaultScene(), objects: [] });
                    setSelected(null);
                    reset();
                  }}
                >
                  NEW
                </button>
              </div>
              <input
                ref={upload}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={importScene}
              />
              <p className="hint">
                Scene files are saved locally or exported as JSON. Changes are
                stored on your device.
              </p>
            </>
          )}
          {lab === "experiments" && (
            <>
              <div className="rule" />
              <label>ABOUT THIS EXPERIMENT</label>
              <p className="hint">
                {experiment === "Gravity"
                  ? "The orange cube uses the chosen world gravity; the lime sphere uses 16.5% of it. Set Earth gravity to compare Earth and Moon conditions."
                  : experiment === "Jump"
                    ? "Jump velocity and gravity work together to determine jump height."
                    : experiment === "Collision"
                      ? "Restitution controls how much energy is retained in a collision."
                      : experiment === "NPC detection"
                        ? "The NPC combines field of view, range and line-of-sight checks."
                        : experiment === "Camera movement"
                          ? "Camera position and follow speed change the player’s view."
                          : "Launch a sphere and observe its path under gravity."}
              </p>
            </>
          )}
          <button className="reset" onClick={reset}>
            ↻ RESET SIMULATION <span>↗</span>
          </button>
          <div className="footer-note">
            A CREATIVE SPACE FOR CURIOUS MINDS
            <br />
            GAME MECHANICS LAB © 2026
          </div>
        </aside>
      </main>
      {dialog && (
        <div className="dialog-backdrop" onClick={() => setDialog(null)}>
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={dialog === "help" ? "Help" : "Settings"}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="dialog-close"
              aria-label="Close dialog"
              onClick={() => setDialog(null)}
            >
              ×
            </button>
            <div className="eyebrow">
              LABORATORY / {dialog === "help" ? "HELP" : "SETTINGS"}
            </div>
            <h2>{dialog === "help" ? "HOW TO PLAY." : "YOUR WORKSPACE."}</h2>
            {dialog === "help" ? (
              <>
                <p>
                  Move the character or target using WASD. Press Space to jump
                  and hold Shift to sprint.
                </p>
                <p>
                  Drag in the viewport to orbit, scroll to zoom, and select an
                  object to inspect it. In the level editor, use the transform
                  controls and switch to Play to test your scene.
                </p>
                <p>
                  Save stores a scene on this device. Export creates a portable
                  JSON file. Reset restarts the current simulation.
                </p>
              </>
            ) : (
              <>
                <label>
                  RENDER QUALITY
                  <select
                    value={quality}
                    onChange={(e) =>
                      setQuality(e.target.value as "low" | "balanced" | "high")
                    }
                  >
                    <option value="low">Low · 1× pixel ratio</option>
                    <option value="balanced">Balanced · up to 1.5×</option>
                    <option value="high">High · up to 2×</option>
                  </select>
                </label>
                <p>
                  Lower quality can improve performance on less powerful
                  devices.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
