import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState, PaddleState, Side } from "./game";
import * as C from "./constants";
import {
  clamp,
  obstaclePose,
  parkBall,
  returnTitle,
  startMatch,
} from "./world";
import { itemAt, menuItems } from "./layout";
import { fly } from "./physics";

type State = DeepReadonly<CaromState>;
function confirm(s: State): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex, menuPresses: {} };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : startMatch(next, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return returnTitle(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen, menuPresses: {} }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : returnTitle(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : returnTitle(s);
    default:
      return s;
  }
}

function readInput(state: State, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  // Read pointer streams just once, even on non-menu screens.
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  let s: CaromState = {
    ...state,
    muted: edges.mute ? !state.muted : state.muted,
  };
  api.audio.setMuted(s.muted);
  if (state.screen === "playing" || state.screen === "countdown") {
    return edges.pause
      ? {
          ...s,
          screen: "paused",
          resumeScreen: state.screen,
          menuIndex: 0,
          menuPresses: {},
        }
      : s;
  }
  if (state.screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen, menuPresses: {} };
  if ((state.screen === "howto" || state.screen === "matchover") && edges.back)
    return returnTitle(s);
  const count = menuItems(state.screen).length;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  const movement = (up || down) && state.screen !== "howto";
  let keyboardConfirmed = false;
  if (movement)
    s = { ...s, menuIndex: (s.menuIndex + (up ? -1 : 1) + count) % count };
  else if (edges.confirm) {
    s = confirm(s);
    keyboardConfirmed = true;
  }
  // Events belong to the screen that began this update, never to one just opened.
  if (s.screen !== state.screen || keyboardConfirmed) return s;
  const starts = { ...s.menuPresses };
  let pointerConfirm = -1;
  for (const p of samples) {
    const index = itemAt(state, p.x, p.y);
    if (index >= 0) s = { ...s, menuIndex: index };
    if (p.type === "down") starts[p.id] = index;
    if (p.type === "up") {
      if (index >= 0 && starts[p.id] === index) pointerConfirm = index;
      delete starts[p.id];
    }
  }
  for (const p of contacts) {
    const index = itemAt(state, p.x, p.y);
    if (index >= 0) s = { ...s, menuIndex: index };
  }
  s = { ...s, menuPresses: starts };
  return pointerConfirm >= 0 ? confirm({ ...s, menuIndex: pointerConfirm }) : s;
}

function movePaddle(
  s: State,
  side: Side,
  api: UpdateApi,
  dt: number,
): PaddleState {
  const p = s.paddles[side];
  let vy = p.drivenVy;
  if (!p.driven) {
    if (side === "right" && s.mode === "solo") {
      const tracking =
        s.ai.tracking &&
        s.screen === "playing" &&
        s.ball !== null &&
        s.ball.vx > 0;
      const target =
        tracking && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
      const deadzone = tracking ? C.AI_DEADZONE : C.AI_HOME_DEADZONE;
      const diff = target - p.cy;
      vy =
        !s.ai.movement || Math.abs(diff) <= deadzone
          ? 0
          : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
    } else {
      const solo = s.mode === "solo";
      const prefix = side === "left" ? "p1" : "p2";
      const up =
        api.input.value(`${prefix}-up`) > 0 ||
        (solo && api.input.value("p2-up") > 0);
      const down =
        api.input.value(`${prefix}-down`) > 0 ||
        (solo && api.input.value("p2-down") > 0);
      vy = (Number(down) - Number(up)) * C.PADDLE_SPEED;
    }
  }
  const raw = p.cy + vy * dt;
  const cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  if (cy !== raw && dt > 0) vy = (cy - p.cy) / dt;
  return { ...p, cy, vy };
}

export function update(state: State, api: UpdateApi, dt: number): CaromState {
  let s = readInput(state, api);
  s = { ...s, simTime: state.simTime + dt, muted: api.audio.muted() };
  if (s.screen !== "playing" && s.screen !== "countdown") return s;
  s = {
    ...s,
    paddles: {
      left: movePaddle(s, "left", api, dt),
      right: movePaddle(s, "right", api, dt),
    },
  };
  const cues = new Set<C.CueName>();
  let ball = s.ball;
  if (ball) {
    if (ball.held) {
      const holdTimer = ball.holdTimer - dt;
      ball = { ...ball, holdTimer };
      if (holdTimer <= 0) {
        ball = {
          ...ball,
          holdTimer: 0,
          held: false,
          trail: [],
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        };
        s = { ...s, screen: "playing" };
      }
    } else if (s.screen === "playing") ball = fly(ball, s, dt, cues);
    ball = {
      ...ball,
      trail: [
        ...ball.trail.filter((p) => p.t >= s.simTime - C.TRAIL_TIME),
        { x: ball.x, y: ball.y, t: s.simTime },
      ],
    };
  }
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    ball,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, clock)),
  };
  if (
    ball &&
    !ball.held &&
    (ball.x - C.BALL_R > C.FIELD_W || ball.x + C.BALL_R < 0)
  ) {
    const left = ball.x > C.FIELD_W;
    const score = {
      p1: s.score.p1 + Number(left),
      p2: s.score.p2 + Number(!left),
    };
    const won =
      Math.max(score.p1, score.p2) >= C.WIN_SCORE &&
      Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
    s = won
      ? {
          ...s,
          score,
          winner: left ? "left" : "right",
          screen: "matchover",
          menuIndex: 0,
          menuPresses: {},
        }
      : {
          ...s,
          score,
          receiver: left ? "right" : "left",
          ball: parkBall(),
          screen: "countdown",
        };
    cues.add(C.CUES.score);
  }
  for (const cue of cues) api.audio.play(cue);
  return s;
}
