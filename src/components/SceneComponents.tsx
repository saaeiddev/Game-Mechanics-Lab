import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, Html, TransformControls, Edges } from "@react-three/drei";
import {
  RigidBody,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import {
  pathfind,
  lineClear,
  nextState,
  type Point,
  type State,
} from "../engine/navigation";
import { input, keyState } from "../engine/input";
import type { SceneData, SceneObject } from "../engine/scene";
import type { Config, Lab } from "../engine/types";
function Shape({ kind }: { kind: SceneObject["kind"] }) {
  return kind === "sphere" ? (
    <sphereGeometry args={[0.5, 24, 16]} />
  ) : kind === "capsule" ? (
    <capsuleGeometry args={[0.35, 0.5, 6, 12]} />
  ) : (
    <boxGeometry />
  );
}
export function Entity({
  o,
  selected,
  onSelect,
  cfg,
  edit,
  mode,
  onTransform,
  report,
  onEvent,
  showVectors,
  showContacts,
  impulseTick,
  capture,
}: {
  o: SceneObject;
  selected: boolean;
  onSelect: () => void;
  cfg: Config;
  edit: boolean;
  showVectors: boolean;
  showContacts: boolean;
  impulseTick: { count: number; id: string };
  capture: (id: string, patch: Partial<SceneObject>) => void;
  onEvent: (v: string) => void;
  mode: "translate" | "rotate" | "scale";
  onTransform: (patch: Partial<SceneObject>) => void;
  report: (v: string) => void;
}) {
  const body = useRef<RapierRigidBody>(null),
    mesh = useRef<THREE.Mesh>(null),
    group = useRef<THREE.Group>(null!),
    tick = useRef(0),
    captureTimer = useRef(0),
    previous = useRef({ x: 0, y: 0, z: 0 }),
    markerTime = useRef(0),
    trail = useRef<[number, number, number][]>([]);
  const lastImpulse = useRef(0);
  useEffect(() => {
    if (
      lastImpulse.current !== impulseTick.count &&
      impulseTick.id === o.id &&
      selected &&
      body.current &&
      o.dynamic &&
      !edit
    ) {
      body.current.applyImpulse(
        { x: 0, y: cfg.impulse * 0.4, z: -cfg.impulse },
        true,
      );
      onEvent(`IMPULSE APPLIED: ${cfg.impulse.toFixed(1)} N·s`);
    }
    lastImpulse.current = impulseTick.count;
  }, [impulseTick, selected, edit, o.id, o.dynamic, cfg.impulse, onEvent]);
  const [contact, setContact] = useState<[number, number, number] | null>(null);
  const [sample, setSample] = useState<{
    p: [number, number, number];
    v: [number, number, number];
    trail: [number, number, number][];
  } | null>(null);
  useFrame((_, dt) => {
    if (edit || !body.current) return;
    captureTimer.current += dt;
    if (o.dynamic && captureTimer.current > 0.1) {
      const p = body.current.translation(),
        q = body.current.rotation(),
        rot = new THREE.Euler().setFromQuaternion(
          new THREE.Quaternion(q.x, q.y, q.z, q.w),
        );
      capture(o.id, {
        x: p.x,
        y: p.y,
        z: p.z,
        rx: rot.x,
        ry: rot.y,
        rz: rot.z,
      });
      captureTimer.current = 0;
    }
    if (!selected) return;
    if (markerTime.current > 0) {
      markerTime.current -= dt;
      if (markerTime.current <= 0) setContact(null);
    }
    tick.current += dt;
    if (tick.current > 0.3) {
      const p = body.current.translation(),
        v = body.current.linvel(),
        acc =
          Math.hypot(
            v.x - previous.current.x,
            v.y - previous.current.y,
            v.z - previous.current.z,
          ) / tick.current;
      report(
        `OBJECT ${o.kind.toUpperCase()}  |  POSITION ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} m  |  SPEED ${Math.hypot(v.x, v.y, v.z).toFixed(1)} m/s  |  ACCEL ${acc.toFixed(1)} m/s²`,
      );
      previous.current = { ...v };
      if (showVectors) {
        trail.current = [...trail.current.slice(-49), [p.x, p.y, p.z]];
        setSample({
          p: [p.x, p.y, p.z],
          v: [v.x, v.y, v.z],
          trail: trail.current,
        });
      }
      tick.current = 0;
    }
  });
  const visual = (
    <mesh
      ref={mesh}
      scale={edit ? [1, 1, 1] : [o.sx, o.sy, o.sz]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Shape kind={o.kind} />
      <meshStandardMaterial
        color={selected ? "#d9ff43" : o.color}
        roughness={0.42}
        metalness={0.15}
      />
      {selected && <Edges color="#ff7139" scale={1.01} />}
    </mesh>
  );
  if (edit) {
    return (
      <>
        <group
          ref={group}
          scale={[o.sx, o.sy, o.sz]}
          position={[o.x, o.y, o.z]}
          rotation={[o.rx, o.ry, o.rz]}
        >
          {visual}
        </group>
        {selected && (
          <TransformControls
            object={group}
            mode={mode}
            onMouseUp={() => {
              const m = group.current;
              if (m)
                onTransform({
                  x: m.position.x,
                  y: m.position.y,
                  z: m.position.z,
                  rx: m.rotation.x,
                  ry: m.rotation.y,
                  rz: m.rotation.z,
                  sx: Math.max(0.1, m.scale.x),
                  sy: Math.max(0.1, m.scale.y),
                  sz: Math.max(0.1, m.scale.z),
                });
            }}
          />
        )}
      </>
    );
  }
  return (
    <>
      <RigidBody
        ref={body}
        type={!o.dynamic ? "fixed" : "dynamic"}
        colliders={
          o.kind === "sphere"
            ? "ball"
            : o.kind === "capsule"
              ? "hull"
              : "cuboid"
        }
        position={[o.x, o.y, o.z]}
        rotation={[o.rx, o.ry, o.rz]}
        restitution={o.restitution ?? cfg.bounce}
        friction={o.friction ?? cfg.friction}
        mass={o.mass ?? cfg.mass}
        gravityScale={o.gravityScale ?? 1}
        linearDamping={cfg.linDamp}
        angularDamping={cfg.angDamp}
        linearVelocity={
          o.id.startsWith("projectile-")
            ? [
                0,
                cfg.launchSpeed * Math.sin((cfg.launchAngle * Math.PI) / 180),
                -cfg.launchSpeed * Math.cos((cfg.launchAngle * Math.PI) / 180),
              ]
            : [cfg.initialX, cfg.initialY, cfg.initialZ]
        }
        onCollisionEnter={({ manifold }) => {
          if (selected) {
            onEvent(
              `COLLISION: ${o.kind.toUpperCase()} contacted another body`,
            );
            if (showContacts && manifold.numSolverContacts() > 0) {
              const p = manifold.solverContactPoint(0);
              setContact([p.x, p.y, p.z]);
              markerTime.current = 0.8;
            }
          }
        }}
      >
        {visual}
      </RigidBody>
      {selected && showContacts && contact && (
        <mesh position={contact}>
          <sphereGeometry args={[0.13, 12, 8]} />
          <meshBasicMaterial color="#ff4e91" />
        </mesh>
      )}
      {selected && showVectors && sample && (
        <>
          <Line
            points={[
              sample.p,
              [
                sample.p[0] + sample.v[0] * 0.3,
                sample.p[1] + sample.v[1] * 0.3,
                sample.p[2] + sample.v[2] * 0.3,
              ],
            ]}
            color="#4be6d4"
            lineWidth={3}
          />
          {sample.trail.length > 1 && (
            <Line points={sample.trail} color="#d9ff43" lineWidth={2} />
          )}
        </>
      )}
    </>
  );
}

export function Player({
  cfg,
  spawn,
  report,
  mode,
  paused,
}: {
  cfg: Config;
  spawn: [number, number, number];
  report: (v: string) => void;
  mode: Lab;
  paused: boolean;
}) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const { world, rapier } = useRapier();
  const { camera, gl } = useThree();
  const yaw = useRef(0),
    pitch = useRef(0);
  useEffect(() => {
    const canvas = gl.domElement;
    let dragging = false,
      last = 0,
      lastY = 0;
    const down = (e: PointerEvent) => {
      if (mode === "camera" && cfg.camera !== "orbit") {
        dragging = true;
        last = e.clientX;
        lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      }
    };
    const move = (e: PointerEvent) => {
      if (dragging) {
        yaw.current -= (e.clientX - last) * 0.004 * cfg.sensitivity;
        last = e.clientX;
        pitch.current = THREE.MathUtils.clamp(
          pitch.current - (e.clientY - lastY) * 0.004 * cfg.sensitivity,
          -0.9,
          0.9,
        );
        lastY = e.clientY;
      }
    };
    const up = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, [gl, mode, cfg.camera, cfg.sensitivity]);
  const jumpHeld = useRef(false),
    timer = useRef(0),
    grounded = useRef(false),
    coyote = useRef(0),
    buffer = useRef(0),
    jumps = useRef(0),
    jumpCooldown = useRef(0);
  useFrame((_, delta) => {
    if (!body.current || paused) return;
    const b = body.current,
      p = b.translation(),
      v = b.linvel(),
      ray = new rapier.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(
      ray,
      0.8,
      true,
      undefined,
      undefined,
      undefined,
      b,
    );
    grounded.current = !!hit;
    let x =
        Number(!!(keyState.KeyD || keyState.ArrowRight)) -
        Number(!!(keyState.KeyA || keyState.ArrowLeft)),
      z =
        Number(!!(keyState.KeyS || keyState.ArrowDown)) -
        Number(!!(keyState.KeyW || keyState.ArrowUp));
    const len = Math.hypot(x, z);
    if (len) {
      x /= len;
      z /= len;
    }
    const speed =
      keyState.ShiftLeft || keyState.ShiftRight ? cfg.sprint : cfg.speed;
    const blend = Math.min(
      1,
      delta *
        (len ? cfg.acceleration : cfg.deceleration) *
        (grounded.current ? 1 : cfg.air),
    );
    let vy = v.y;
    jumpCooldown.current = Math.max(0, jumpCooldown.current - delta);
    if (grounded.current && jumpCooldown.current === 0) {
      coyote.current = cfg.coyote;
      jumps.current = 0;
    } else coyote.current = Math.max(0, coyote.current - delta);
    buffer.current = Math.max(0, buffer.current - delta);
    if (input.jumpQueued || (keyState.Space && !jumpHeld.current)) {
      buffer.current = Math.max(cfg.buffer, 0.035);
      input.jumpQueued = false;
    }
    jumpHeld.current = !!keyState.Space;
    if (
      buffer.current > 0 &&
      (coyote.current > 0 ||
        (grounded.current && jumpCooldown.current === 0) ||
        (cfg.doubleJump && jumps.current === 1))
    ) {
      vy = cfg.jump;
      jumps.current++;
      coyote.current = 0;
      buffer.current = 0;
      jumpCooldown.current = 0.15;
    }
    b.setLinvel(
      {
        x: THREE.MathUtils.lerp(v.x, x * speed, blend),
        y: vy,
        z: THREE.MathUtils.lerp(v.z, z * speed, blend),
      },
      true,
    );
    if (p.y < -12) {
      b.setTranslation({ x: spawn[0], y: spawn[1] + 1, z: spawn[2] }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    if (visual.current && len) {
      const angle = Math.atan2(x, z),
        diff = Math.atan2(
          Math.sin(angle - visual.current.rotation.y),
          Math.cos(angle - visual.current.rotation.y),
        );
      visual.current.rotation.y += diff * Math.min(1, cfg.turn * delta);
    }
    if (
      mode === "camera" &&
      camera instanceof THREE.PerspectiveCamera &&
      (camera.fov !== cfg.cameraFov ||
        camera.near !== cfg.near ||
        camera.far !== cfg.far)
    ) {
      camera.fov = cfg.cameraFov;
      camera.near = cfg.near;
      camera.far = cfg.far;
      camera.updateProjectionMatrix();
    }
    if (mode === "camera" && cfg.camera !== "orbit") {
      const desired =
        cfg.camera === "first"
          ? new THREE.Vector3(
              p.x + cfg.offsetX - Math.sin(yaw.current) * 0.5,
              p.y + 0.8,
              p.z + cfg.offsetZ - Math.cos(yaw.current) * 0.5,
            )
          : cfg.camera === "top"
            ? new THREE.Vector3(
                p.x + cfg.offsetX,
                p.y + cfg.distance,
                p.z + cfg.offsetZ + 0.01,
              )
            : cfg.camera === "isometric"
              ? new THREE.Vector3(
                  p.x + cfg.offsetX + cfg.distance,
                  p.y + cfg.height + 4,
                  p.z + cfg.offsetZ + cfg.distance,
                )
              : new THREE.Vector3(
                  p.x +
                    cfg.offsetX +
                    Math.sin(yaw.current) *
                      cfg.distance *
                      Math.cos(pitch.current),
                  p.y + cfg.height + Math.sin(pitch.current) * cfg.distance,
                  p.z +
                    cfg.offsetZ +
                    Math.cos(yaw.current) *
                      cfg.distance *
                      Math.cos(pitch.current),
                );
      camera.position.lerp(desired, 1 - Math.exp(-cfg.follow * delta));
      camera.lookAt(
        p.x +
          cfg.offsetX -
          (cfg.camera === "first"
            ? Math.sin(yaw.current) * 5 * Math.cos(pitch.current)
            : 0),
        p.y +
          (cfg.camera === "first" ? 0.8 + Math.sin(pitch.current) * 5 : 0.3),
        p.z +
          cfg.offsetZ -
          (cfg.camera === "first"
            ? Math.cos(yaw.current) * 5 * Math.cos(pitch.current)
            : 0),
      );
      if (
        camera instanceof THREE.PerspectiveCamera &&
        camera.fov !== cfg.cameraFov
      ) {
        camera.fov = cfg.cameraFov;
        camera.updateProjectionMatrix();
      }
    }
    timer.current += delta;
    if (timer.current > 0.3) {
      report(
        `PLAYER  x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)}  z ${p.z.toFixed(1)}  |  SPEED ${Math.hypot(v.x, v.y, v.z).toFixed(1)} m/s  |  ${grounded.current ? "GROUNDED" : "AIRBORNE"}${mode === "camera" ? `  |  CAMERA ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}  |  ROTATION ${camera.rotation.x.toFixed(2)}, ${camera.rotation.y.toFixed(2)}, ${camera.rotation.z.toFixed(2)} rad` : ""}`,
      );
      timer.current = 0;
    }
  });
  return (
    <RigidBody
      ref={body}
      colliders="hull"
      position={[spawn[0], spawn[1] + 1, spawn[2]]}
      enabledRotations={[false, false, false]}
      friction={cfg.friction}
      linearDamping={0}
    >
      <group ref={visual}>
        <mesh castShadow position={[0, 0, 0]}>
          <capsuleGeometry args={[0.38, 0.65, 8, 16]} />
          <meshStandardMaterial color="#d9ff43" />
        </mesh>
        <mesh position={[0, 0.38, 0.32]}>
          <boxGeometry args={[0.48, 0.15, 0.15]} />
          <meshStandardMaterial color="#201825" />
        </mesh>
      </group>
    </RigidBody>
  );
}
export function NPC({
  cfg,
  scene,
  report,
  paused,
  start,
  name,
  showTarget,
}: {
  cfg: Config;
  scene: SceneData;
  report: (v: string) => void;
  paused: boolean;
  start: Point;
  name: string;
  showTarget: boolean;
}) {
  const npc = useRef<THREE.Group>(null),
    target = useRef<THREE.Group>(null),
    state = useRef<State>("patrol"),
    pos = useRef<Point>({ ...start }),
    targ = useRef<Point>({ x: 0, z: 4 }),
    heading = useRef(0),
    way = useRef(0),
    path = useRef<Point[]>([]),
    update = useRef(0),
    lost = useRef(0),
    seen = useRef(0),
    idleTime = useRef(0),
    last = useRef<Point>({ x: 0, z: 0 });
  const [view, setView] = useState<{
    state: State;
    path: Point[];
    pos: Point;
    target: Point;
    heading: number;
  }>({
    state: "patrol",
    path: [],
    pos: { ...start },
    target: { x: 0, z: 4 },
    heading: 0,
  });
  const obs = useMemo(
    () =>
      scene.objects
        .filter((o) => !o.dynamic)
        .map((o) => ({ x: o.x, z: o.z, w: o.sx, d: o.sz })),
    [scene],
  );
  useFrame((_, dt) => {
    if (paused) return;
    const d = Math.min(dt, 0.05),
      p = pos.current,
      t = targ.current;
    let dx = Number(!!keyState.KeyD) - Number(!!keyState.KeyA),
      dz = Number(!!keyState.KeyS) - Number(!!keyState.KeyW);
    const tl = Math.hypot(dx, dz) || 1;
    t.x = THREE.MathUtils.clamp(t.x + (dx / tl) * 4 * d, -8, 8);
    t.z = THREE.MathUtils.clamp(t.z + (dz / tl) * 4 * d, -8, 8);
    const dist = Math.hypot(t.x - p.x, t.z - p.z),
      targetAngle = Math.atan2(t.x - p.x, t.z - p.z);
    const angle = Math.abs(
      Math.atan2(
        Math.sin(targetAngle - heading.current),
        Math.cos(targetAngle - heading.current),
      ),
    );
    const visible =
      dist < (state.current === "chase" ? cfg.chase : cfg.detect) &&
      angle < (cfg.fov * Math.PI) / 360 &&
      lineClear(p, t, obs);
    if (visible) {
      lost.current = 0;
      seen.current += d;
      last.current = { ...t };
    } else {
      lost.current += d;
      seen.current = 0;
    }
    idleTime.current = Math.max(0, idleTime.current - d);
    state.current = nextState(
      state.current,
      visible && seen.current >= cfg.reaction,
      dist,
      lost.current,
      cfg.search,
    );
    if (!visible && idleTime.current > 0) state.current = "idle";
    let dest: Point;
    if (state.current === "chase") dest = t;
    else if (state.current === "flee")
      dest = {
        x: THREE.MathUtils.clamp(p.x + (p.x - t.x) * 3, -8, 8),
        z: THREE.MathUtils.clamp(p.z + (p.z - t.z) * 3, -8, 8),
      };
    else if (state.current === "search") dest = last.current;
    else {
      const wp = scene.waypoints[way.current % scene.waypoints.length];
      dest = { x: wp[0], z: wp[1] };
      if (Math.hypot(dest.x - p.x, dest.z - p.z) < 0.6) {
        way.current = (way.current + 1) % scene.waypoints.length;
        idleTime.current = 0.8;
        state.current = "idle";
      }
    }
    update.current -= d;
    if (update.current <= 0) {
      path.current = pathfind(p, dest, obs);
      update.current = 0.5;
      setView({
        state: state.current,
        path: [...path.current],
        pos: { ...p },
        target: { ...t },
        heading: heading.current,
      });
      report(
        `${name} ${state.current.toUpperCase()}  |  TARGET ${dist.toFixed(1)} m  |  ${visible ? "VISIBLE" : "NOT VISIBLE"}  |  PATH ${path.current.length} NODES`,
      );
    }
    const next = path.current[0] ?? (lineClear(p, dest, obs) ? dest : p),
      vx = next.x - p.x,
      vz = next.z - p.z,
      dl = Math.hypot(vx, vz);
    if (dl > 0.08 && state.current !== "idle") {
      p.x += (vx / dl) * Math.min(cfg.aiSpeed * d, dl);
      p.z += (vz / dl) * Math.min(cfg.aiSpeed * d, dl);
      heading.current = Math.atan2(vx, vz);
    }
    if (npc.current) {
      npc.current.position.set(p.x, 0.7, p.z);
      npc.current.rotation.y = heading.current;
    }
    if (target.current) target.current.position.set(t.x, 0.6, t.z);
  });
  return (
    <>
      <group ref={npc} position={[start.x, 0.7, start.z]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.4, 0.6, 8, 16]} />
          <meshStandardMaterial
            color={name === "NPC A" ? "#ff4e91" : "#4be6d4"}
          />
        </mesh>
        <mesh position={[0, 0.25, 0.38]}>
          <boxGeometry args={[0.5, 0.15, 0.1]} />
          <meshStandardMaterial color="#201825" />
        </mesh>
      </group>
      {showTarget && (
        <group ref={target} position={[0, 0.6, 4]}>
          <mesh castShadow>
            <sphereGeometry args={[0.55, 24, 16]} />
            <meshStandardMaterial color="#d9ff43" />
          </mesh>
        </group>
      )}
      <Line
        points={scene.waypoints
          .map((w) => [w[0], 0.05, w[1]] as [number, number, number])
          .concat([[scene.waypoints[0][0], 0.05, scene.waypoints[0][1]]])}
        color="#ff4e91"
        lineWidth={1}
      />
      {view.path.length > 0 && (
        <Line
          points={[
            [view.pos.x, 0.07, view.pos.z],
            ...view.path.map(
              (p) => [p.x, 0.07, p.z] as [number, number, number],
            ),
          ]}
          color="#d9ff43"
          lineWidth={2}
        />
      )}
      {[-1, 1].map((sign) => (
        <Line
          key={sign}
          points={[
            [view.pos.x, 0.06, view.pos.z],
            [
              view.pos.x +
                Math.sin(view.heading + (sign * cfg.fov * Math.PI) / 360) *
                  cfg.detect,
              0.06,
              view.pos.z +
                Math.cos(view.heading + (sign * cfg.fov * Math.PI) / 360) *
                  cfg.detect,
            ],
          ]}
          color="#ff4e91"
          lineWidth={1}
        />
      ))}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[view.pos.x, 0.02, view.pos.z]}
      >
        <ringGeometry args={[cfg.detect - 0.025, cfg.detect, 64]} />
        <meshBasicMaterial color="#ff4e91" transparent opacity={0.55} />
      </mesh>
      <Html position={[view.pos.x, 2, view.pos.z]} center>
        <span className="npc-label">
          {name} / {view.state.toUpperCase()}
        </span>
      </Html>
    </>
  );
}
export function FrameMeter({ report }: { report: (n: number) => void }) {
  const t = useRef(0),
    n = useRef(0);
  useFrame((_, d) => {
    t.current += d;
    n.current++;
    if (t.current > 0.6) {
      report(Math.round(n.current / t.current));
      t.current = 0;
      n.current = 0;
    }
  });
  return null;
}
