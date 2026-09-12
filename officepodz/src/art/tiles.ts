import { Rng } from "../core/rng.js"
import { TILE_SIZE } from "../core/types.js"
import { PixelBuffer } from "../pixel/canvas.js"
import { BASE_PALETTE, C } from "../pixel/palette.js"
import type { PixelSprite } from "../pixel/sprite.js"

/**
 * Floor and wall tiles.
 *
 * Tiles are drawn rather than authored so a theme is a handful of colour
 * arguments. Grain and speckle come from the seeded RNG, which means the same
 * office seed always produces the same carpet, and a tile never tiles visibly
 * against itself because the noise is baked per variant rather than per draw.
 */

export type TileKind =
  | "void"
  | "carpet-green"
  | "carpet-blue"
  | "carpet-grey"
  | "wood"
  | "concrete"
  | "checker"
  | "grass"
  | "wall"
  | "wall-glass"
  | "wall-brick"

export const TILE_KINDS: readonly TileKind[] = [
  "void",
  "carpet-green",
  "carpet-blue",
  "carpet-grey",
  "wood",
  "concrete",
  "checker",
  "grass",
  "wall",
  "wall-glass",
  "wall-brick",
]

/** Numeric ids used inside the tilemap arrays. Index matches TILE_KINDS. */
export const TILE_ID: Record<TileKind, number> = TILE_KINDS.reduce(
  (acc, kind, index) => {
    acc[kind] = index
    return acc
  },
  {} as Record<TileKind, number>,
)

export const SOLID_TILES: ReadonlySet<number> = new Set([
  TILE_ID.wall,
  TILE_ID["wall-glass"],
  TILE_ID["wall-brick"],
  TILE_ID.void,
])

function carpet(buffer: PixelBuffer, rng: Rng, base: number, dark: number, light: number): void {
  buffer.fillRect(0, 0, TILE_SIZE, TILE_SIZE, base)
  for (let i = 0; i < 26; i++) {
    buffer.set(rng.int(0, 15), rng.int(0, 15), rng.bool(0.55) ? dark : light)
  }
  // A faint seam every fourth pixel suggests carpet tiles without drawing a grid.
  for (let x = 0; x < TILE_SIZE; x += 4) buffer.set(x, 15, dark)
}

function planks(buffer: PixelBuffer, rng: Rng): void {
  buffer.fillRect(0, 0, TILE_SIZE, TILE_SIZE, C.wood)
  for (let y = 0; y < TILE_SIZE; y += 4) {
    buffer.hLine(0, y, TILE_SIZE, C.woodDark)
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rng.bool(0.18)) buffer.set(x, y + 1 + rng.int(0, 2), C.woodLight)
    }
  }
  buffer.vLine(rng.int(2, 13), 0, TILE_SIZE, C.woodDark)
}

function concrete(buffer: PixelBuffer, rng: Rng): void {
  buffer.fillRect(0, 0, TILE_SIZE, TILE_SIZE, C.greyLight)
  for (let i = 0; i < 34; i++) {
    buffer.set(rng.int(0, 15), rng.int(0, 15), rng.bool(0.5) ? C.grey : C.silver)
  }
  buffer.hLine(0, 0, TILE_SIZE, C.grey)
  buffer.vLine(0, 0, TILE_SIZE, C.grey)
}

function checker(buffer: PixelBuffer): void {
  buffer.fillRect(0, 0, TILE_SIZE, TILE_SIZE, C.white)
  buffer.fillRect(0, 0, 8, 8, C.silver)
  buffer.fillRect(8, 8, 8, 8, C.silver)
  buffer.hLine(0, 15, TILE_SIZE, C.greyLight)
}

function grass(buffer: PixelBuffer, rng: Rng): void {
  buffer.fillRect(0, 0, TILE_SIZE, TILE_SIZE, C.leafDark)
  for (let i = 0; i < 40; i++) {
    const x = rng.int(0, 15)
    const y = rng.int(0, 15)
    buffer.set(x, y, rng.bool(0.6) ? C.leaf : C.leafLight)
  }
}

function wall(buffer: PixelBuffer, top: number, body: number, shadow: number): void {
  buffer.fillRect(0, 0, TILE_SIZE, TILE_SIZE, body)
  buffer.fillRect(0, 0, TILE_SIZE, 3, top)
  buffer.hLine(0, 3, TILE_SIZE, shadow)
  buffer.hLine(0, TILE_SIZE - 1, TILE_SIZE, shadow)
}

function glassWall(buffer: PixelBuffer): void {
  wall(buffer, C.silver, C.greyLight, C.greyDark)
  buffer.fillRect(2, 5, 12, 9, C.blueLight)
  buffer.strokeRect(2, 5, 12, 9, C.greyDark)
  // Two diagonal glints so glass reads as glass at a glance.
  for (let i = 0; i < 6; i++) {
    buffer.set(4 + i, 12 - i, C.white)
    buffer.set(8 + i, 12 - i, C.white)
  }
}

function brickWall(buffer: PixelBuffer): void {
  wall(buffer, C.redLight, C.red, C.redDark)
  for (let y = 5; y < TILE_SIZE; y += 4) {
    buffer.hLine(0, y, TILE_SIZE, C.redDark)
    const offset = ((y / 4) | 0) % 2 === 0 ? 0 : 8
    buffer.vLine(offset, y, 4, C.redDark)
    buffer.vLine(offset + 8, y, 4, C.redDark)
  }
}

/** Build the full tile set for one office theme. */
export function buildTiles(seed: string | number = "officepodz"): Record<TileKind, PixelSprite> {
  const out = {} as Record<TileKind, PixelSprite>
  for (const kind of TILE_KINDS) {
    const rng = new Rng(`${seed}:${kind}`)
    const buffer = new PixelBuffer(TILE_SIZE, TILE_SIZE)
    switch (kind) {
      case "void":
        buffer.fillRect(0, 0, TILE_SIZE, TILE_SIZE, C.ink)
        break
      case "carpet-green":
        carpet(buffer, rng, C.greenDark, C.ink, C.green)
        break
      case "carpet-blue":
        carpet(buffer, rng, C.blueDark, C.ink, C.blue)
        break
      case "carpet-grey":
        carpet(buffer, rng, C.greyDark, C.charcoal, C.grey)
        break
      case "wood":
        planks(buffer, rng)
        break
      case "concrete":
        concrete(buffer, rng)
        break
      case "checker":
        checker(buffer)
        break
      case "grass":
        grass(buffer, rng)
        break
      case "wall":
        wall(buffer, C.silver, C.greyLight, C.greyDark)
        break
      case "wall-glass":
        glassWall(buffer)
        break
      case "wall-brick":
        brickWall(buffer)
        break
    }
    out[kind] = buffer.toSprite(`tile-${kind}`, BASE_PALETTE, TILE_SIZE)
  }
  return out
}
