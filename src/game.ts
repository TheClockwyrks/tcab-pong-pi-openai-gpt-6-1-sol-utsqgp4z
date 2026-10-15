import type { Game } from "@clockwyrks/simple-2d";
import { ACTIONS, BINDINGS, CUES } from "./constants";
import { initialState } from "./world";
import { debug } from "./debug";
import { update } from "./simulation";
import { render } from "./presentation";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";
export type Mode = "solo" | "versus";
export type Side = "left" | "right";
export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}
export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}
export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}
export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}
export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}
export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";
  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;
  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;
  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;
  readonly simTime: number;
  readonly muted: boolean;
  /** Transient input bookkeeping, never used by the world simulation. */
  readonly menuPresses?: Readonly<Record<number, number>>;
}
export type CaromDebugApi = typeof debug;
export const BACKGROUND = "#101b20";

export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const name of ACTIONS)
      api.input.register(name, { keys: [...BINDINGS[name]] });
    api.audio.define(CUES.paddleHit, {
      wave: "triangle",
      freq: 660,
      freqTo: 330,
      durationMs: 75,
      gain: 0.22,
    });
    api.audio.define(CUES.wallBounce, {
      wave: "sine",
      freq: 260,
      freqTo: 170,
      durationMs: 55,
      gain: 0.15,
    });
    api.audio.define(CUES.obstacleBounce, {
      wave: "triangle",
      freq: 940,
      freqTo: 540,
      durationMs: 100,
      gain: 0.17,
    });
    api.audio.define(CUES.score, {
      wave: "sine",
      freq: 380,
      freqTo: 760,
      durationMs: 260,
      gain: 0.25,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("p1 score", (s) => s.score.p1);
    api.diagnostics.register("p2 score", (s) => s.score.p2);
    for (const key of ["x", "y", "vx", "vy", "spin"] as const)
      api.diagnostics.register(`ball ${key}`, (s) => s.ball?.[key] ?? "absent");
    api.diagnostics.register("ball speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "absent",
    );
    for (const side of ["left", "right"] as const) {
      api.diagnostics.register(`${side} cy`, (s) => s.paddles[side].cy);
      api.diagnostics.register(`${side} vy`, (s) => s.paddles[side].vy);
    }
    return [initialState(), debug];
  },
  update,
  render,
};
