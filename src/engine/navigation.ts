export type Point = { x: number; z: number };
export type Obstacle = { x: number; z: number; w: number; d: number };
export function blocked(x: number, z: number, obs: Obstacle[], margin = 0.3) {
  return obs.some(
    (o) =>
      Math.abs(x - o.x) < o.w / 2 + margin &&
      Math.abs(z - o.z) < o.d / 2 + margin,
  );
}
export function lineClear(a: Point, b: Point, obs: Obstacle[]) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 5);
  for (let i = 0; i <= n; i++) {
    const t = i / Math.max(1, n);
    if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, obs, 0))
      return false;
  }
  return true;
}
export function pathfind(start: Point, end: Point, obs: Obstacle[]): Point[] {
  const lim = 9,
    toCell = (p: Point) => ({
      x: Math.max(-lim, Math.min(lim, Math.round(p.x))),
      z: Math.max(-lim, Math.min(lim, Math.round(p.z))),
    }),
    s = toCell(start),
    e = toCell(end),
    key = (p: Point) => `${p.x},${p.z}`,
    h = (p: Point) => Math.abs(p.x - e.x) + Math.abs(p.z - e.z);
  const open = [s],
    seen = new Map<string, number>([[key(s), 0]]),
    prev = new Map<string, string>();
  let found = "";
  while (open.length) {
    open.sort((a, b) => seen.get(key(a))! + h(a) - (seen.get(key(b))! + h(b)));
    const c = open.shift()!,
      ck = key(c);
    if (ck === key(e)) {
      found = ck;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const p = { x: c.x + dx, z: c.z + dz },
        pk = key(p),
        cost = seen.get(ck)! + 1;
      if (
        Math.abs(p.x) > lim ||
        Math.abs(p.z) > lim ||
        blocked(p.x, p.z, obs, 0.4) ||
        cost >= (seen.get(pk) ?? Infinity)
      )
        continue;
      seen.set(pk, cost);
      prev.set(pk, ck);
      open.push(p);
    }
  }
  if (!found) return [];
  const out: Point[] = [];
  for (let k = found; k !== key(s);) {
    const [x, z] = k.split(",").map(Number);
    out.unshift({ x, z });
    const p = prev.get(k);
    if (!p) return [];
    k = p;
  }
  return out;
}
export type State = "idle" | "patrol" | "chase" | "flee" | "search" | "return";
export function nextState(
  state: State,
  visible: boolean,
  distance: number,
  searchTime: number,
  searchDuration = 3,
): State {
  if (visible && distance < 1.2) return "flee";
  if (visible) return "chase";
  if (state === "chase" || state === "flee") return "search";
  if (state === "search" && searchTime < searchDuration) return "search";
  if (state === "search") return "return";
  return state === "idle" ? "patrol" : state;
}
