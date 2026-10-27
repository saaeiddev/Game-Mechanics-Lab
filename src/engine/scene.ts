export type SceneObject = {
  id: string;
  kind: "cube" | "sphere" | "capsule";
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
  dynamic: boolean;
  mass?: number;
  friction?: number;
  restitution?: number;
  gravityScale?: number;
};
export type SceneData = {
  version: 1;
  objects: SceneObject[];
  spawn: [number, number, number];
  waypoints: [number, number][];
  settings?: unknown;
};
export const defaultScene = (): SceneData => ({
  version: 1,
  objects: [
    {
      id: "a",
      kind: "cube",
      x: -2,
      y: 0.5,
      z: 1,
      rx: 0,
      ry: 0,
      rz: 0,
      sx: 2,
      sy: 1,
      sz: 2,
      color: "#ff7139",
      dynamic: false,
    },
    {
      id: "b",
      kind: "cube",
      x: 2,
      y: 0.5,
      z: -1,
      rx: 0,
      ry: 0,
      rz: 0,
      sx: 2,
      sy: 1,
      sz: 3,
      color: "#4be6d4",
      dynamic: false,
    },
  ],
  spawn: [0, 1, 5],
  waypoints: [
    [-6, -5],
    [6, -5],
    [6, 5],
    [-6, 5],
  ],
});
export function validateScene(v: unknown): v is SceneData {
  if (!v || typeof v !== "object") return false;
  const s = v as SceneData;
  return (
    s.version === 1 &&
    Array.isArray(s.objects) &&
    s.objects.length <= 150 &&
    Array.isArray(s.spawn) &&
    s.spawn.length === 3 &&
    s.spawn.every((n) => Number.isFinite(n) && Math.abs(n) < 100) &&
    Array.isArray(s.waypoints) &&
    s.waypoints.length >= 2 &&
    s.waypoints.length <= 30 &&
    s.waypoints.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((n) => Number.isFinite(n) && Math.abs(n) < 100),
    ) &&
    new Set(s.objects.map((o) => o && o.id)).size === s.objects.length &&
    s.objects.every(
      (o) =>
        !!o &&
        typeof o === "object" &&
        typeof o.id === "string" &&
        o.id.length > 0 &&
        o.id.length <= 100 &&
        ["cube", "sphere", "capsule"].includes(o.kind) &&
        typeof o.color === "string" &&
        /^#[0-9a-f]{6}$/i.test(o.color) &&
        typeof o.dynamic === "boolean" &&
        [o.x, o.y, o.z, o.rx, o.ry, o.rz, o.sx, o.sy, o.sz].every(
          (n) =>
            typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 100,
        ) &&
        o.sx > 0 &&
        o.sy > 0 &&
        o.sz > 0 &&
        (
          [
            ["mass", 0.1, 10],
            ["friction", 0, 1],
            ["restitution", 0, 1],
            ["gravityScale", 0, 5],
          ] as const
        ).every(
          ([key, min, max]) =>
            o[key] === undefined ||
            (typeof o[key] === "number" &&
              Number.isFinite(o[key]) &&
              o[key]! >= min &&
              o[key]! <= max),
        ),
    )
  );
}
