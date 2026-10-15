import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import { MATCHOVER_ITEMS, PAUSE_ITEMS, TITLE_ITEMS } from "./constants";

export interface MenuRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export function menuItems(screen: CaromState["screen"]): readonly string[] {
  switch (screen) {
    case "title":
      return TITLE_ITEMS;
    case "paused":
      return PAUSE_ITEMS;
    case "matchover":
      return MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(
  s: DeepReadonly<CaromState>,
  index: number,
): MenuRect | null {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= menuItems(s.screen).length
  )
    return null;
  if (s.screen === "title")
    return { x: 100, y: 358 + index * 70, w: 370, h: 58 };
  if (s.screen === "howto") return { x: 100, y: 586, w: 370, h: 58 };
  return { x: 440, y: 362 + index * 70, w: 400, h: 58 };
}
export function itemAt(
  s: DeepReadonly<CaromState>,
  x: number,
  y: number,
): number {
  return menuItems(s.screen).findIndex((_, i) => {
    const r = menuItemRect(s, i);
    return (
      r !== null && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    );
  });
}
