import { describe, it, expect } from "vitest";
import { blocked, lineClear, pathfind, nextState } from "../engine/navigation";
import { defaultScene, validateScene } from "../engine/scene";
describe("navigation", () => {
  const walls = [{ x: 0, z: 0, w: 2, d: 4 }];
  it("detects blocked lines and obstacle cells", () => {
    expect(blocked(0, 0, walls)).toBe(true);
    expect(lineClear({ x: -4, z: 0 }, { x: 4, z: 0 }, walls)).toBe(false);
    expect(lineClear({ x: -4, z: 5 }, { x: 4, z: 5 }, walls)).toBe(true);
  });
  it("routes around an obstacle without traversing it", () => {
    const path = pathfind({ x: -4, z: 0 }, { x: 4, z: 0 }, walls);
    expect(path.length).toBeGreaterThan(8);
    expect(path.at(-1)).toEqual({ x: 4, z: 0 });
    expect(path.every((p) => !blocked(p.x, p.z, walls, 0.4))).toBe(true);
  });
  it("transitions through pursuit, search and return", () => {
    expect(nextState("patrol", true, 4, 0)).toBe("chase");
    expect(nextState("chase", false, 5, 1)).toBe("search");
    expect(nextState("search", false, 5, 4)).toBe("return");
    expect(nextState("chase", true, 0.5, 0)).toBe("flee");
  });
});
describe("scene validation", () => {
  it("accepts a JSON round trip of a scene", () => {
    expect(validateScene(JSON.parse(JSON.stringify(defaultScene())))).toBe(
      true,
    );
  });
  it("rejects invalid and incomplete scenes", () => {
    expect(
      validateScene({
        version: 1,
        objects: [],
        spawn: [0, 0, 0],
        waypoints: [],
      }),
    ).toBe(false);
    const s = defaultScene();
    s.objects[0].sx = -1;
    expect(validateScene(s)).toBe(false);
    expect(validateScene(null)).toBe(false);
    const duplicate = defaultScene();
    duplicate.objects[1].id = duplicate.objects[0].id;
    expect(validateScene(duplicate)).toBe(false);
    const bad = defaultScene() as unknown as { objects: unknown[] };
    bad.objects[0] = null;
    expect(validateScene(bad)).toBe(false);
    const invalid = defaultScene();
    invalid.objects[0].mass = -2;
    expect(validateScene(invalid)).toBe(false);
    const valid = defaultScene();
    valid.objects[0].mass = 2;
    valid.objects[0].friction = 0.4;
    expect(validateScene(JSON.parse(JSON.stringify(valid)))).toBe(true);
  });
});
