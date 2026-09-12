/**
 * OfficePodz
 *
 * A pixel art office world you can drop into an existing work operating system.
 * Sprites, tiles, furniture, pets, avatars, pathfinding, presence and a host
 * adapter. No engine, no build step, no runtime dependencies.
 *
 * Quick start:
 *
 *   import { OfficePodz, createMockAdapter } from "@officepodz/core"
 *
 *   const engine = new OfficePodz({
 *     canvas: document.querySelector("canvas")!,
 *     adapter: createMockAdapter(),
 *     seed: "acme-hq",
 *   })
 *   await engine.start()
 */

export * from "./core/types.js"
export * from "./core/math.js"
export * from "./core/rng.js"
export * from "./core/events.js"
export * from "./core/clock.js"

export * from "./pixel/index.js"
export * from "./art/index.js"
export * from "./world/index.js"
export * from "./nav/index.js"
export * from "./entities/index.js"
export * from "./render/index.js"
export * from "./net/index.js"
export * from "./integration/index.js"
export * from "./input/index.js"
export * from "./editor/index.js"
export * from "./sim/index.js"

export const OFFICEPODZ_VERSION = "0.1.0"
