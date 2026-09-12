import type { Direction, Vec2 } from "./types.js"

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Frame-rate independent exponential smoothing. */
export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt))
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

/** Pick the cardinal facing that best matches a movement vector. */
export function directionFromVector(dx: number, dy: number, fallback: Direction): Direction {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return fallback
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "east" : "west"
  return dy > 0 ? "south" : "north"
}

/** Snap a float to the device pixel grid so sprites never sit on half pixels. */
export function snap(value: number): number {
  return Math.round(value)
}
