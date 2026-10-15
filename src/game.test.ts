import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import type { CaromDebugApi, CaromState } from "./game";
import * as C from "./constants";
import { obstaclePose } from "./world";

const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function setup(step = 10) {
  const events = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const e = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  engines.push(e);
  const cues: string[] = [];
  e.events.on("cue:played", (v) => cues.push(v.cue));
  await e.initialize();
  const key = (code: string, down = true) =>
    events.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  const tap = async (code: string) => {
    key(code);
    await e.advance(1);
    key(code, false);
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) =>
    events.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: id === 1,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  const d = e.debug;
  const pose = (fn: (s: Readonly<CaromState>) => CaromState) => e.apply(fn);
  const flying = (x: number, y: number, vx: number, vy: number) => {
    pose((s) => d.clearWorld(s));
    pose((s) => d.spawnBall(s));
    pose((s) => d.setScreen(s, "playing"));
    pose((s) => d.setMode(s, "versus"));
    pose((s) => d.setBallHeld(s, false));
    pose((s) => d.setBallPosition(s, x, y));
    pose((s) => d.setBallVelocity(s, vx, vy));
  };
  return { e, d, key, tap, pointer, pose, flying, cues, canvas };
}

describe("state and debug contract", () => {
  it("initializes the whole world and exposes pure detached readings", async () => {
    const { e, d } = await setup();
    const s = d.snapshot(e.state);
    expect(s).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      mode: "solo",
      score: { p1: 0, p2: 0 },
      receiver: "left",
      simTime: 0,
    });
    expect(s.ball).toMatchObject({
      x: C.FIELD_CX,
      y: C.FIELD_CY,
      held: true,
      holdTimer: C.HOLD_TIME,
      speed: 0,
      trail: [],
    });
    expect(s.obstacles).toEqual([obstaclePose(0, 0), obstaclePose(1, 0)]);
    expect(d.reconcile(e.state)).toEqual(e.state);
    const before = structuredClone(e.state);
    expect(e.diagnostics().length).toBeGreaterThanOrEqual(14);
    d.snapshot(e.state);
    e.diagnostics();
    expect(e.state).toEqual(before);
    await e.advance(3);
    expect(e.state.simTime).toBeCloseTo(0.03);
    expect(e.state.ball).toEqual(before.ball);
  });
  it("poses each scalar without integrating and resets the whole state", async () => {
    const { e, d, pose } = await setup();
    const original = e.state;
    pose((s) => d.setScreen(s, "paused"));
    pose((s) => d.setMode(s, "versus"));
    pose((s) => d.setMenuIndex(s, 2));
    pose((s) => d.setTitleIndex(s, 1));
    pose((s) => d.setResumeScreen(s, "countdown"));
    pose((s) => d.setScore(s, 12, 11));
    pose((s) => d.setWinner(s, "right"));
    pose((s) => d.setReceiver(s, "right"));
    pose((s) => d.setPaddleCy(s, "left", 145));
    pose((s) => d.setPaddleVy(s, "left", 123));
    pose((s) => d.setPaddleDriven(s, "left", true));
    pose((s) => d.setBallPosition(s, 90, 145));
    pose((s) => d.setBallVelocity(s, 300, 400));
    pose((s) => d.setBallSpin(s, -300));
    pose((s) => d.setBallHeld(s, false));
    pose((s) => d.setBallHoldTimer(s, 0.3));
    pose((s) => d.setBallServeSign(s, -1));
    pose((s) => d.setAiTracking(s, false));
    pose((s) => d.setAiMovement(s, false));
    pose((s) => d.setObstacleClock(s, 1.2));
    pose((s) => d.setObstacleClockRunning(s, false));
    pose((s) => d.setMuted(s, true));
    const snap = d.snapshot(e.state);
    expect(snap.ball).toMatchObject({
      x: 90,
      y: 145,
      speed: 500,
      spin: -300,
      held: false,
      serveSign: -1,
      holdTimer: 0.3,
    });
    expect(snap.paddles.left).toEqual({
      cy: 145,
      vy: 0,
      driven: true,
      drivenVy: 123,
    });
    expect(snap.obstacles[0]).toEqual(obstaclePose(0, 1.2));
    expect(original.paddles.left.cy).toBe(C.FIELD_CY);
    const current = e.state;
    pose((s) => d.reconcile(s));
    pose((s) => d.reconcile(s));
    expect(e.state).toEqual(current);
    await e.advance(2);
    expect(e.state.ball).toEqual(current.ball);
    pose((s) => d.reset(s));
    expect(e.state).toMatchObject({
      screen: "title",
      mode: "solo",
      simTime: 0,
      muted: true,
      titleIndex: 0,
      ai: { movement: true, tracking: true },
      obstacleClockRunning: true,
    });
    expect(e.state.paddles.left).toEqual(original.paddles.left);
  });
  it("removes entities, rejects absent-ball poses and invalid indices, and respawns at clock pose", async () => {
    const { e, d, pose } = await setup();
    pose((s) => d.clearWorld(s));
    expect(d.snapshot(e.state).ball).toBeNull();
    expect(() => d.setBallPosition(e.state, 0, 0)).toThrow("No ball");
    expect(() => d.setBallVelocity(e.state, 1, 2)).toThrow();
    expect(() => d.drawBallServeSign(e.state)).toThrow();
    expect(() => d.spawnObstacle(e.state, 2)).toThrow();
    pose((s) => d.setScreen(s, "playing"));
    await e.advance(5);
    expect(e.state.score).toEqual({ p1: 0, p2: 0 });
    pose((s) => d.setObstacleClock(s, 2));
    pose((s) => d.spawnObstacle(s, 1));
    pose((s) => d.spawnObstacle(s, 0));
    expect(e.state.obstacles).toEqual([obstaclePose(0, 2), obstaclePose(1, 2)]);
    pose((s) => d.spawnBall(s));
    pose((s) => d.drawBallServeSign(s));
    expect([1, -1]).toContain(e.state.ball?.serveSign);
  });
});

describe("menus and controls", () => {
  it("navigates with precedence, remembers title choice, and resets on return", async () => {
    const { e, d, tap, key, pose } = await setup();
    key("KeyW");
    key("KeyS");
    key("Enter");
    await e.advance(1);
    expect(e.state.menuIndex).toBe(2);
    expect(e.state.screen).toBe("title");
    key("KeyW", false);
    key("KeyS", false);
    key("Enter", false);
    await tap("Enter");
    expect(e.state.screen).toBe("howto");
    expect(e.state.titleIndex).toBe(2);
    expect(d.menuItemRect(e.state, 1)).toBeNull();
    await tap("Escape");
    expect(e.state.menuIndex).toBe(2);
    await tap("KeyW");
    await tap("Enter");
    expect(e.state.mode).toBe("versus");
    expect(e.state.screen).toBe("countdown");
    expect(d.menuItemRect(e.state, 0)).toBeNull();
    await tap("Escape");
    expect(e.state.screen).toBe("paused");
    const frozen = e.state.ball;
    await e.advance(10);
    expect(e.state.ball).toEqual(frozen);
    await tap("Escape");
    expect(e.state.screen).toBe("countdown");
    await tap("KeyP");
    await tap("KeyS");
    await tap("Enter");
    expect(e.state.score.p1).toBe(0);
    expect(e.state.obstacleClock).toBeCloseTo(0.01);
    await tap("KeyP");
    await tap("KeyW");
    await tap("Enter");
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(1);
    pose((s) => d.setScreen(s, "matchover"));
    await tap("Escape");
    expect(e.state.screen).toBe("title");
  });
  it("uses pointer and multi-frame touch edges, rejecting cross-item clicks", async () => {
    const { e, d, pointer } = await setup();
    const a = d.menuItemRect(e.state, 0)!;
    const b = d.menuItemRect(e.state, 1)!;
    pointer("move", b.x + 20, b.y + 20);
    await e.advance(1);
    expect(e.state.menuIndex).toBe(1);
    pointer("down", a.x + 20, a.y + 20);
    await e.advance(1);
    pointer("up", b.x + 20, b.y + 20);
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    pointer("down", b.x + 20, b.y + 20, 2, "touch");
    await e.advance(1);
    pointer("up", b.x + 20, b.y + 20, 2, "touch");
    await e.advance(1);
    expect(e.state.mode).toBe("versus");
    expect(e.state.titleIndex).toBe(1);
  });
  it("confirms same-frame clicks, prioritizes keyboard confirmation, and wraps menus", async () => {
    const { e, d, pose, key, pointer, tap } = await setup();
    const r = d.menuItemRect(e.state, 2)!;
    pointer("down", r.x + 40, r.y + 20);
    pointer("up", r.x + 40, r.y + 20);
    await e.advance(1);
    expect(e.state.screen).toBe("howto");
    await tap("Enter");
    pose((s) => d.setMenuIndex(s, 0));
    key("Enter");
    pointer("down", r.x + 40, r.y + 20);
    pointer("up", r.x + 40, r.y + 20);
    await e.advance(1);
    key("Enter", false);
    expect(e.state.mode).toBe("solo");
    expect(e.state.screen).toBe("countdown");
    await tap("KeyP");
    await tap("KeyS");
    await tap("KeyS");
    await tap("KeyS");
    expect(e.state.menuIndex).toBe(0);
    await tap("Enter");
    expect(e.state.screen).toBe("countdown");
    pose((s) => d.setScreen(s, "matchover"));
    pose((s) => d.setMenuIndex(s, 0));
    await tap("Enter");
    expect(e.state.screen).toBe("countdown");
    pose((s) => d.setScreen(s, "matchover"));
    pose((s) => d.setMenuIndex(s, 1));
    await tap("Enter");
    expect(e.state.screen).toBe("title");
  });
  it("moves human paddles during the hold, clamps actual vy, and gates drivers", async () => {
    const { e, d, key, tap, pose } = await setup();
    await tap("Enter");
    key("ArrowDown");
    await e.advance(10);
    key("ArrowDown", false);
    expect(e.state.paddles.left.cy).toBeCloseTo(C.FIELD_CY + 72);
    expect(e.state.paddles.right.cy).toBe(C.FIELD_CY);
    pose((s) => d.setMode(s, "versus"));
    key("ArrowUp");
    await e.advance(10);
    key("ArrowUp", false);
    expect(e.state.paddles.right.cy).toBeCloseTo(C.FIELD_CY - 72);
    pose((s) => d.setPaddleCy(s, "left", C.PADDLE_MAX_CY));
    key("KeyS");
    await e.advance(2);
    expect(e.state.paddles.left.vy).toBe(0);
    key("KeyS", false);
    pose((s) => d.setPaddleVy(s, "right", 100));
    expect(e.state.paddles.right.vy).toBe(0);
    pose((s) => d.setPaddleDriven(s, "right", true));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(100);
    expect(e.state.paddles.right.drivenVy).toBe(100);
    pose((s) => d.setPaddleDriven(s, "right", false));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(0);
  });
});

describe("ball simulation", () => {
  it("serves on timer expiry without advancing on the serve frame", async () => {
    const { e, d, pose } = await setup();
    pose((s) => d.setScreen(s, "countdown"));
    pose((s) => d.setBallHoldTimer(s, 0.005));
    pose((s) => d.setBallServeSign(s, -1));
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
    expect(e.state.ball?.x).toBe(C.FIELD_CX);
    expect(e.state.ball?.vx).toBeCloseTo(
      -C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE),
    );
    expect(e.state.ball?.vy).toBeCloseTo(
      -C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
    );
    await e.advance(1);
    expect(e.state.ball!.x).toBeLessThan(C.FIELD_CX);
    pose((s) => d.spawnBall(s));
    pose((s) => d.setReceiver(s, "right"));
    pose((s) => d.setBallHoldTimer(s, 0));
    pose((s) => d.setBallServeSign(s, 1));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(e.state.ball!.vy).toBeGreaterThan(0);
  });
  it("reflects walls without changing spin or speed beyond decay, with one cue per frame", async () => {
    const { e, flying, cues } = await setup();
    flying(300, C.BALL_R + 1, 0, -C.SPEED_CAP);
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(C.SPEED_CAP);
    expect(e.state.ball!.y).toBeGreaterThanOrEqual(C.BALL_R);
    expect(cues).toEqual([C.CUES.wallBounce]);
    flying(300, C.FIELD_H - C.BALL_R - 1, 0, C.SPEED_CAP);
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(-C.SPEED_CAP);
  });
  it("bounces paddles, adds spin from integrated motion and caps speed", async () => {
    const { e, d, pose, flying, cues } = await setup();
    flying(C.P1_X1 + C.BALL_R + 1, C.FIELD_CY, -C.SPEED_CAP, 0);
    pose((s) => d.setPaddleDriven(s, "left", true));
    pose((s) => d.setPaddleVy(s, "left", 200));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
      C.SPEED_CAP,
    );
    expect(e.state.ball!.spin).toBeGreaterThan(160);
    expect(cues).toEqual([C.CUES.paddleHit]);
    flying(C.P2_X0 - C.BALL_R - 1, C.FIELD_CY, C.SERVE_SPEED, 0);
    await e.advance(1);
    expect(e.state.ball!.vx).toBeLessThan(0);
    expect(e.state.ball!.spin).toBe(0);
  });
  it("treats paddle end caps as walls", async () => {
    const { e, flying, cues } = await setup();
    flying(
      (C.P1_X0 + C.P1_X1) / 2,
      C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1,
      0,
      500,
    );
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(-500);
    expect(cues).toEqual([C.CUES.wallBounce]);
  });
  it("curves with positive spin and decays by its half-life independently of frame size", async () => {
    const outcomes: { vx: number; vy: number; spin: number }[] = [];
    for (const step of [2, 16]) {
      const { e, d, pose, flying } = await setup(step);
      flying(300, 300, 500, 0);
      pose((s) => d.setBallSpin(s, 400));
      await e.advance((C.SPIN_HALFLIFE * 1000) / step);
      outcomes.push(e.state.ball!);
      expect(e.state.ball!.spin).toBeCloseTo(200);
      expect(e.state.ball!.vy).toBeGreaterThan(0);
      expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(500);
      expect(e.state.ball!.trail.length).toBeGreaterThan(1);
      expect(e.state.ball!.trail[0].t).toBeGreaterThanOrEqual(
        e.state.simTime - C.TRAIL_TIME,
      );
    }
    expect(Math.abs(outcomes[0].vx - outcomes[1].vx)).toBeLessThan(2);
    expect(Math.abs(outcomes[0].vy - outcomes[1].vy)).toBeLessThan(2);
  });
  it("reflects an upright and rotated obstacle and pushes embedded balls out", async () => {
    const { e, d, pose, flying, cues } = await setup();
    flying(468, 220, 500, 0);
    pose((s) => d.spawnObstacle(s, 0));
    pose((s) => d.setObstacleClockRunning(s, false));
    await e.advance(1);
    expect(e.state.ball!.vx).toBe(-500);
    expect(cues).toContain(C.CUES.obstacleBounce);
    flying(490, 220, 500, 0);
    pose((s) => d.spawnObstacle(s, 0));
    pose((s) => d.setObstacleClock(s, 0));
    await e.advance(1);
    expect(e.state.ball!.x).toBeGreaterThanOrEqual(511);
    const t = Math.PI / 4 / C.OBSTACLE_SPIN_RATE;
    const o = obstaclePose(0, t);
    flying(
      o.cx - 22 * Math.cos(o.theta),
      o.cy - 22 * Math.sin(o.theta),
      500,
      0,
    );
    pose((s) => d.spawnObstacle(s, 0));
    pose((s) => d.setObstacleClock(s, t));
    await e.advance(1);
    expect(e.state.ball!.vy).toBeLessThan(-490);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(500);
  });
  it("scores beyond the complete goal edge and enforces a two-point lead", async () => {
    const { e, d, pose, flying, cues } = await setup();
    flying(C.FIELD_W + C.BALL_R - 1, 100, 500, 0);
    pose((s) => d.setScore(s, 10, 10));
    await e.advance(1);
    expect(e.state.score).toEqual({ p1: 11, p2: 10 });
    expect(e.state.screen).toBe("countdown");
    expect(e.state.receiver).toBe("right");
    expect(e.state.ball!.trail).toEqual([]);
    flying(C.FIELD_W + C.BALL_R - 1, 100, 500, 0);
    await e.advance(1);
    expect(e.state.screen).toBe("matchover");
    expect(e.state.winner).toBe("left");
    expect(cues.filter((c) => c === C.CUES.score)).toHaveLength(2);
    flying(-C.BALL_R + 1, 100, -500, 0);
    pose((s) => d.setScore(s, 0, 10));
    await e.advance(1);
    expect(e.state.winner).toBe("right");
  });
  it("freezes live entities while paused but continues simTime and mute input", async () => {
    const { e, d, pose, tap, flying } = await setup();
    flying(400, 400, 500, -100);
    pose((s) => d.spawnObstacle(s, 0));
    await tap("KeyP");
    const frozen = e.state;
    await e.advance(20);
    expect(e.state.ball).toEqual(frozen.ball);
    expect(e.state.obstacles).toEqual(frozen.obstacles);
    expect(e.state.simTime).toBeCloseTo(frozen.simTime + 0.2);
    await tap("KeyM");
    expect(e.state.muted).toBe(true);
    await tap("KeyM");
    expect(e.state.muted).toBe(false);
    await tap("KeyP");
    expect(e.state.ball!.x).toBeGreaterThan(frozen.ball!.x);
  });
});

describe("AI and presentation", () => {
  it("tracks an approaching ball, returns home without tracking, and obeys movement gate", async () => {
    const { e, d, pose, flying } = await setup();
    flying(300, 600, 500, 0);
    pose((s) => d.setMode(s, "solo"));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(C.AI_SPEED);
    pose((s) => d.setAiMovement(s, false));
    const cy = e.state.paddles.right.cy;
    await e.advance(5);
    expect(e.state.paddles.right.cy).toBe(cy);
    pose((s) => d.setAiMovement(s, true));
    pose((s) => d.setAiTracking(s, false));
    pose((s) => d.setPaddleCy(s, "right", 600));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(-C.AI_SPEED);
    pose((s) => d.setPaddleDriven(s, "right", true));
    pose((s) => d.setPaddleVy(s, "right", 75));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(75);
  });
  it("draws every screen without mutating state, and records real drawing", async () => {
    const { e, d, pose } = await setup();
    e.startRecording();
    for (const screen of [
      "title",
      "howto",
      "countdown",
      "playing",
      "paused",
      "matchover",
    ] as const) {
      pose((s) => d.setScreen(s, screen));
      await e.advance(1);
    }
    const record = e.stopRecording();
    expect(record.frames).toHaveLength(6);
    expect(record.ops.length).toBeGreaterThan(100);
    expect(record.frames.every((f) => !f.truncated)).toBe(true);
  });
});

describe("collision robustness", () => {
  it("agrees on contacts, direction, speed, and point timing at 2ms and 16ms", async () => {
    const results: {
      time: number;
      vx: number;
      vy: number;
      speed: number;
      cues: string[];
    }[] = [];
    for (const step of [2, 16]) {
      const { e, d, pose, flying, cues } = await setup(step);
      flying(200, 360, -700, -200);
      pose((s) => d.setBallSpin(s, 150));
      pose((s) => d.setPaddleCy(s, "right", C.PADDLE_MIN_CY));
      pose((s) => d.setScore(s, 10, 0));
      for (
        let frame = 0;
        frame < 5000 / step && e.state.screen === "playing";
        frame++
      )
        await e.advance(1);
      expect(e.state.screen).toBe("matchover");
      const b = e.state.ball!;
      results.push({
        time: e.state.simTime,
        vx: b.vx,
        vy: b.vy,
        speed: Math.hypot(b.vx, b.vy),
        cues,
      });
    }
    expect(results[0].cues).toEqual(results[1].cues);
    expect(results[0].cues).toContain(C.CUES.paddleHit);
    expect(results[0].cues).toContain(C.CUES.score);
    expect(Math.sign(results[0].vx)).toBe(Math.sign(results[1].vx));
    expect(Math.sign(results[0].vy)).toBe(Math.sign(results[1].vy));
    expect(Math.abs(results[0].speed - results[1].speed)).toBeLessThan(10);
    expect(Math.abs(results[0].time / results[1].time - 1)).toBeLessThan(0.08);
  }, 20000);
  it("reflects obstacle corners and the inside least-penetration face", async () => {
    const { e, d, pose, flying } = await setup(2);
    flying(474, 144, 500, 500);
    pose((s) => d.spawnObstacle(s, 0));
    pose((s) => d.setObstacleClockRunning(s, false));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeLessThan(0);
    expect(e.state.ball!.vy).toBeLessThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
      Math.hypot(500, 500),
    );
    flying(490, 154, 0, 500);
    pose((s) => d.spawnObstacle(s, 0));
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(-500);
    expect(e.state.ball!.y).toBeLessThanOrEqual(139);
  });
  it("substeps cap-speed shots without tunnelling through a paddle", async () => {
    const { e, flying, cues } = await setup(16);
    flying(C.P1_X1 + C.BALL_R + 12, C.FIELD_CY, -C.SPEED_CAP, 0);
    await e.advance(1);
    expect(e.state.ball!.x).toBeGreaterThanOrEqual(C.P1_X1 + C.BALL_R);
    expect(e.state.ball!.vx).toBe(C.SPEED_CAP);
    expect(cues).toEqual([C.CUES.paddleHit]);
    flying(56, C.FIELD_CY + C.PADDLE_HALF + C.BALL_R + 1, 0, -500);
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(500);
  });
});
