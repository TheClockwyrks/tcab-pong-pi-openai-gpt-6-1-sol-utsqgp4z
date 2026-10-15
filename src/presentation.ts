import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import * as C from "./constants";
import { menuItemRect, menuItems } from "./layout";

const INK = "#edf0dd",
  SUB = "#84999d",
  LINE = "#2a3b40";
const LIME = "#d7f779",
  BLUE = "#8ec9e9",
  CORAL = "#f18c73";
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  copy: string,
  x: number,
  y: number,
  size = 14,
  color = SUB,
  weight = 400,
  align: CanvasTextAlign = "left",
  mono = true,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${mono ? '"Courier New", monospace' : '"Arial", sans-serif'}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function line(
  ctx: Context,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color = LINE,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function bar(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  radius = 6,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}
function circle(
  ctx: Context,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function arrow(ctx: Context, x: number, y: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  ctx.moveTo(x + 2, y - 6);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x + 2, y + 6);
  ctx.stroke();
}
function ground(ctx: Context): void {
  ctx.fillStyle = "#26363a";
  // Batch one row per path: cheap to paint, and bounded for the recorder.
  for (let y = 32; y < C.FIELD_H; y += 32) {
    ctx.beginPath();
    for (let x = 32; x < C.FIELD_W; x += 32) {
      ctx.moveTo(x + 0.7, y);
      ctx.arc(x, y, 0.7, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  line(ctx, 32, 32, C.FIELD_W - 32, 32);
  line(ctx, 32, C.FIELD_H - 32, C.FIELD_W - 32, C.FIELD_H - 32);
}
function footer(ctx: Context, s: DeepReadonly<CaromState>, menu = false): void {
  text(
    ctx,
    menu
      ? "↑ ↓ / W S  SELECT     ENTER  CONFIRM"
      : s.mode === "versus"
        ? "W / S  P1     ↑ / ↓  P2"
        : "W / S OR ↑ / ↓  MOVE",
    48,
    701,
    11,
  );
  text(
    ctx,
    menu ? "A GAME OF ANGLES." : "P / ESC  PAUSE",
    C.FIELD_CX,
    701,
    11,
    SUB,
    400,
    "center",
  );
  text(
    ctx,
    `M  SOUND ${s.muted ? "OFF" : "ON"}`,
    C.FIELD_W - 48,
    701,
    11,
    s.muted ? CORAL : SUB,
    400,
    "right",
  );
}
function menus(ctx: Context, s: DeepReadonly<CaromState>): void {
  const items = menuItems(s.screen);
  items.forEach((item, i) => {
    const r = menuItemRect(s, i);
    if (!r) return;
    const active = s.menuIndex === i;
    if (active) bar(ctx, r.x, r.y, r.w, r.h, LIME, 3);
    else line(ctx, r.x, r.y + r.h, r.x + r.w, r.y + r.h);
    text(
      ctx,
      `0${i + 1}`,
      r.x + 20,
      r.y + r.h / 2,
      12,
      active ? "#43512d" : SUB,
    );
    text(
      ctx,
      item,
      r.x + 58,
      r.y + r.h / 2,
      19,
      active ? "#17251e" : INK,
      700,
      "left",
      false,
    );
    if (active) arrow(ctx, r.x + r.w - 30, r.y + r.h / 2, "#17251e");
  });
}
function titleDiagram(ctx: Context): void {
  const x = 582,
    y = 158,
    w = 598,
    h = 410;
  text(ctx, "THE FIELD / 01", x, y - 28, 12, INK);
  text(ctx, "SPIN. BANK. SCORE.", x + w, y - 28, 11, SUB, 400, "right");
  ctx.strokeStyle = "#405359";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([5, 9]);
  line(ctx, x + w / 2, y, x + w / 2, y + h);
  ctx.setLineDash([]);
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 62, 0, Math.PI * 2);
  ctx.stroke();
  bar(ctx, x + 24, y + 222, 9, 68, LIME, 4);
  bar(ctx, x + w - 33, y + 92, 9, 68, BLUE, 4);
  for (const [ox, oy, angle] of [
    [216, 110, -0.38],
    [382, 300, -0.38],
  ]) {
    ctx.save();
    ctx.translate(x + ox, y + oy);
    ctx.rotate(angle);
    bar(ctx, -6, -44, 12, 88, CORAL, 4);
    ctx.restore();
  }
  // A bank-shot diagram: a live game's visual language, with its arc explained.
  ctx.strokeStyle = "#647d69";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.moveTo(x + 34, y + 250);
  ctx.bezierCurveTo(x + 160, y + 245, x + 228, y + 213, x + 274, y + 155);
  ctx.bezierCurveTo(x + 315, y + 105, x + 380, y + 40, x + 450, y + 1);
  ctx.lineTo(x + 492, y + 69);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 492, y + 69);
  ctx.quadraticCurveTo(x + 509, y + 95, x + 532, y + 104);
  ctx.stroke();
  circle(ctx, x + 532, y + 104, C.BALL_R, INK);
  circle(ctx, x + 532, y + 104, 3, "#ffffff");
  line(ctx, x + 110, y + 326, x + 190, y + 270, "#52664c");
  text(ctx, "01 / CURVE THE FLIGHT", x + 32, y + 349, 11, LIME);
  text(ctx, "02 / PLAY THE ANGLE", x + 340, y + 365, 11, CORAL);
  text(
    ctx,
    "TWO PADDLES. TWO OBSTACLES. NO STRAIGHT ANSWERS.",
    x,
    y + h + 30,
    11,
  );
}
function title(ctx: Context, s: DeepReadonly<CaromState>): void {
  text(ctx, "↗  CAROM / PADDLE SPORT", 48, 58, 12, INK);
  text(
    ctx,
    "LOCAL PLAY    /    VOL. 01",
    C.FIELD_W - 48,
    58,
    12,
    SUB,
    400,
    "right",
  );
  text(ctx, "A DIFFERENT KIND OF RICOCHET", 100, 159, 12, LIME);
  text(ctx, C.TITLE_TEXT, 92, 237, 106, INK, 900, "left", false);
  text(ctx, "Put a little spin on it.", 100, 311, 21, SUB, 400, "left", false);
  menus(ctx, s);
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE}. WIN BY ${C.WIN_LEAD}.`,
    100,
    608,
    12,
    INK,
  );
  titleDiagram(ctx);
  footer(ctx, s, true);
}
function field(ctx: Context, s: DeepReadonly<CaromState>): void {
  ctx.setLineDash([8, 14]);
  line(ctx, C.NET_X, 120, C.NET_X, C.FIELD_H - 60);
  ctx.setLineDash([]);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 72, 0, Math.PI * 2);
  ctx.stroke();
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.shadowColor = "#f18c7333";
    ctx.shadowBlur = 18;
    bar(ctx, -C.OBSTACLE_HW, -C.OBSTACLE_HH, C.OBSTACLE_W, C.OBSTACLE_H, CORAL);
    ctx.shadowBlur = 0;
    circle(ctx, 0, 0, 3, "#a34d3e");
    ctx.restore();
  }
  for (const side of ["left", "right"] as const) {
    ctx.save();
    ctx.shadowColor = side === "left" ? "#d7f77955" : "#8ec9e955";
    ctx.shadowBlur = 20;
    bar(
      ctx,
      side === "left" ? C.P1_X0 : C.P2_X0,
      s.paddles[side].cy - C.PADDLE_HALF,
      C.PADDLE_W,
      C.PADDLE_H,
      side === "left" ? LIME : BLUE,
    );
    ctx.restore();
  }
  if (s.ball) {
    const b = s.ball;
    b.trail.forEach((p, i) => {
      const alpha = Math.max(0, 1 - (s.simTime - p.t) / C.TRAIL_TIME);
      ctx.globalAlpha = alpha * 0.35;
      circle(
        ctx,
        p.x,
        p.y,
        C.BALL_R * (0.3 + (0.6 * i) / Math.max(1, b.trail.length)),
        INK,
      );
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = "#edf0dd66";
    ctx.shadowBlur = 20;
    circle(ctx, b.x, b.y, C.BALL_R, INK);
    ctx.restore();
    if (Math.abs(b.spin) > 40) {
      ctx.strokeStyle = LIME;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const start = s.simTime * Math.sign(b.spin) * 8;
      ctx.arc(b.x, b.y, C.BALL_R + 6, start, start + Math.PI * 1.2);
      ctx.stroke();
    }
  }
  // Keep the scores outside the obstacles' swept area.
  text(ctx, "PLAYER 01", C.FIELD_CX - 310, 28, 11, LIME, 400, "center");
  text(
    ctx,
    s.mode === "solo" ? "COMPUTER" : "PLAYER 02",
    C.FIELD_CX + 310,
    28,
    11,
    BLUE,
    400,
    "center",
  );
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    C.FIELD_CX - 310,
    72,
    56,
    INK,
    700,
    "center",
    false,
  );
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    C.FIELD_CX + 310,
    72,
    56,
    INK,
    700,
    "center",
    false,
  );
  text(
    ctx,
    s.mode === "solo" ? "SOLO" : "VERSUS",
    C.FIELD_CX,
    51,
    12,
    INK,
    400,
    "center",
  );
  text(
    ctx,
    `TO ${C.WIN_SCORE} / +${C.WIN_LEAD}`,
    C.FIELD_CX,
    76,
    10,
    SUB,
    400,
    "center",
  );
  text(ctx, C.TITLE_TEXT, 48, 58, 19, INK, 800, "left", false);
  text(ctx, "PADDLE DUEL", C.FIELD_W - 48, 58, 11, SUB, 400, "right");
  footer(ctx, s);
  if (s.screen === "countdown") {
    text(
      ctx,
      "GET READY",
      C.FIELD_CX,
      C.FIELD_CY - 66,
      14,
      LIME,
      700,
      "center",
    );
    text(
      ctx,
      `SERVING ${s.receiver === "left" ? "←" : "→"}`,
      C.FIELD_CX,
      C.FIELD_CY + 55,
      11,
      SUB,
      400,
      "center",
    );
    const progress = 1 - (s.ball?.holdTimer ?? C.HOLD_TIME) / C.HOLD_TIME;
    bar(ctx, C.FIELD_CX - 40, C.FIELD_CY + 77, 80, 3, LINE, 0);
    bar(ctx, C.FIELD_CX - 40, C.FIELD_CY + 77, 80 * progress, 3, LIME, 0);
  }
}
function howto(ctx: Context, s: DeepReadonly<CaromState>): void {
  text(ctx, "CAROM / FIELD GUIDE", 100, 92, 13, LIME);
  text(ctx, "Make the angle yours.", 96, 160, 56, INK, 800, "left", false);
  const blocks = [
    [
      "01 / MOVE",
      "W / S  ·  LEFT PADDLE",
      "↑ / ↓  ·  RIGHT PADDLE",
      "In Solo, either set moves you.",
    ],
    [
      "02 / SPIN",
      "MOVE THROUGH THE HIT",
      "Your paddle's motion bends the ball.",
      "Hit near an edge for a sharper angle.",
    ],
    [
      "03 / BANK",
      "USE THE CORAL BARS",
      "The obstacles rotate and sway.",
      "Read the face. Find a new way through.",
    ],
  ];
  blocks.forEach((b, i) => {
    const x = 100 + i * 378;
    line(ctx, x, 252, x + 330, 252);
    text(ctx, b[0], x, 282, 13, [LIME, BLUE, CORAL][i]);
    text(ctx, b[1], x, 333, 15, INK, 700);
    text(ctx, b[2], x, 376, 14, SUB, 400, "left", false);
    text(ctx, b[3], x, 405, 14, SUB, 400, "left", false);
  });
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE}, LEADING BY ${C.WIN_LEAD}.`,
    100,
    492,
    18,
    INK,
    700,
  );
  text(
    ctx,
    "Score beyond the other paddle. P / ESC pauses. M toggles sound.",
    100,
    527,
    16,
    SUB,
    400,
    "left",
    false,
  );
  menus(ctx, s);
  footer(ctx, s, true);
}
export function render(s: DeepReadonly<CaromState>, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  ground(ctx);
  if (s.screen === "title") title(ctx, s);
  else if (s.screen === "howto") howto(ctx, s);
  else {
    field(ctx, s);
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#101b20dc";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      bar(ctx, 396, 159, 488, s.screen === "paused" ? 438 : 370, "#14242a", 5);
      line(ctx, 440, 194, 840, 194, LIME);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        C.FIELD_CX,
        224,
        12,
        LIME,
        400,
        "center",
      );
      const headline =
        s.screen === "paused"
          ? "Paused."
          : s.winner === "left"
            ? "Player 01 wins."
            : s.mode === "solo"
              ? "Computer wins."
              : "Player 02 wins.";
      text(ctx, headline, C.FIELD_CX, 279, 43, INK, 800, "center", false);
      text(
        ctx,
        s.screen === "paused"
          ? "YOUR NEXT ANGLE CAN WAIT."
          : `${s.score.p1} — ${s.score.p2}  /  WELL PLAYED.`,
        C.FIELD_CX,
        325,
        13,
        SUB,
        400,
        "center",
      );
      menus(ctx, s);
      footer(ctx, s, true);
    }
  }
  ctx.restore();
}
