import { BASE_PALETTE, parseHex } from "./palette.js"

/**
 * The OfficePodz pixel format.
 *
 * A sprite is plain JSON: a palette plus one string per row, where each
 * character is a base36 index into that palette. It diffs cleanly in git, it
 * can be authored by hand in a text editor, and it can be recoloured at runtime
 * without touching image data.
 */
export interface PixelSprite {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly palette: readonly string[]
  readonly rows: readonly string[]
  /** Pixels from the sprite top to the tile the sprite stands on. */
  readonly originY?: number
}

export const PIXEL_KEYS = "0123456789abcdefghijklmnopqrstuvwxyz"

/**
 * "." is an alias for palette slot 0.
 *
 * Hand authored templates are far easier to read when empty space is a dot
 * rather than a zero, and the avatar templates lean on that heavily.
 */
export const TRANSPARENT_KEYS: ReadonlySet<string> = new Set(["0", "."])

export function keyToIndex(key: string): number {
  if (key === ".") return 0
  const index = PIXEL_KEYS.indexOf(key)
  return index < 0 ? 0 : index
}

export function indexToKey(index: number): string {
  return PIXEL_KEYS[index] ?? "0"
}

export class SpriteError extends Error {}

/** Throw when a sprite is malformed. Cheap enough to run on every load. */
export function validateSprite(sprite: PixelSprite): void {
  if (sprite.rows.length !== sprite.height) {
    throw new SpriteError(
      `${sprite.name}: declared height ${sprite.height} but has ${sprite.rows.length} rows`,
    )
  }
  sprite.rows.forEach((row, y) => {
    if (row.length !== sprite.width) {
      throw new SpriteError(
        `${sprite.name}: row ${y} has ${row.length} chars, expected ${sprite.width}`,
      )
    }
    for (const key of row) {
      if (TRANSPARENT_KEYS.has(key)) continue
      const index = PIXEL_KEYS.indexOf(key)
      if (index < 0) throw new SpriteError(`${sprite.name}: row ${y} uses unknown key "${key}"`)
      if (index >= sprite.palette.length) {
        throw new SpriteError(
          `${sprite.name}: row ${y} references palette slot ${index}, palette has ${sprite.palette.length}`,
        )
      }
    }
  })
}

/** Expand a sprite into straight RGBA bytes, top-left origin, no premultiply. */
export function spriteToRGBA(sprite: PixelSprite): Uint8ClampedArray {
  const out = new Uint8ClampedArray(sprite.width * sprite.height * 4)
  const cache = sprite.palette.map(parseHex)
  for (let y = 0; y < sprite.height; y++) {
    const row = sprite.rows[y]
    for (let x = 0; x < sprite.width; x++) {
      const color = cache[keyToIndex(row[x])] ?? [0, 0, 0, 0]
      const at = (y * sprite.width + x) * 4
      out[at] = color[0]
      out[at + 1] = color[1]
      out[at + 2] = color[2]
      out[at + 3] = color[3]
    }
  }
  return out
}

/**
 * Bake a sprite into a canvas the renderer can blit.
 *
 * Browsers only. Node side tooling uses spriteToRGBA plus the PNG encoder.
 */
export function spriteToCanvas(sprite: PixelSprite): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = sprite.width
  canvas.height = sprite.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new SpriteError(`${sprite.name}: 2d context unavailable`)
  const image = ctx.createImageData(sprite.width, sprite.height)
  image.data.set(spriteToRGBA(sprite))
  ctx.putImageData(image, 0, 0)
  return canvas
}

/** Swap the palette while keeping the pixels. The heart of avatar variety. */
export function recolor(sprite: PixelSprite, palette: readonly string[], name?: string): PixelSprite {
  return { ...sprite, name: name ?? sprite.name, palette }
}

export function flipX(sprite: PixelSprite, name?: string): PixelSprite {
  return {
    ...sprite,
    name: name ?? `${sprite.name}-flipped`,
    rows: sprite.rows.map((row) => [...row].reverse().join("")),
  }
}

/** Draw `top` over `base` at an offset. Transparent pixels pass through. */
export function overlay(
  base: PixelSprite,
  top: PixelSprite,
  offsetX = 0,
  offsetY = 0,
  name?: string,
): PixelSprite {
  if (base.palette !== top.palette && base.palette.join() !== top.palette.join()) {
    throw new SpriteError(`${base.name}: overlay requires a shared palette`)
  }
  const rows = base.rows.map((row, y) => {
    const topY = y - offsetY
    if (topY < 0 || topY >= top.height) return row
    const chars = [...row]
    for (let x = 0; x < top.width; x++) {
      const target = x + offsetX
      if (target < 0 || target >= base.width) continue
      const key = top.rows[topY][x]
      if (!TRANSPARENT_KEYS.has(key)) chars[target] = key
    }
    return chars.join("")
  })
  return { ...base, name: name ?? base.name, rows }
}

/** Crop a sub-rectangle, used to slice authored sheets into frames. */
export function crop(
  sprite: PixelSprite,
  x: number,
  y: number,
  width: number,
  height: number,
  name?: string,
): PixelSprite {
  const rows: string[] = []
  for (let row = 0; row < height; row++) {
    rows.push(sprite.rows[y + row].slice(x, x + width))
  }
  return { name: name ?? `${sprite.name}-crop`, width, height, palette: sprite.palette, rows }
}

export function blankSprite(name: string, width: number, height: number): PixelSprite {
  return {
    name,
    width,
    height,
    palette: BASE_PALETTE,
    rows: Array.from({ length: height }, () => "0".repeat(width)),
  }
}
