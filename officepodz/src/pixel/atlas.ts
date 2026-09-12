import { PixelBuffer } from "./canvas.js"
import { BASE_PALETTE } from "./palette.js"
import { spriteToRGBA, type PixelSprite } from "./sprite.js"

/** Where a named sprite lives inside a packed atlas. */
export interface AtlasFrame {
  name: string
  x: number
  y: number
  w: number
  h: number
  originY: number
}

export interface Atlas {
  name: string
  width: number
  height: number
  frames: Record<string, AtlasFrame>
  rgba: Uint8ClampedArray
}

/**
 * Row based shelf packer.
 *
 * Deliberately simple: sprite counts are in the hundreds, not thousands, and a
 * stable layout means the exported PNG only changes when the art changes.
 */
export function packAtlas(name: string, sprites: readonly PixelSprite[], maxWidth = 256): Atlas {
  const padding = 1
  const frames: Record<string, AtlasFrame> = {}
  let cursorX = padding
  let cursorY = padding
  let rowHeight = 0
  let usedWidth = 0

  for (const sprite of sprites) {
    if (cursorX + sprite.width + padding > maxWidth) {
      cursorX = padding
      cursorY += rowHeight + padding
      rowHeight = 0
    }
    frames[sprite.name] = {
      name: sprite.name,
      x: cursorX,
      y: cursorY,
      w: sprite.width,
      h: sprite.height,
      originY: sprite.originY ?? sprite.height,
    }
    cursorX += sprite.width + padding
    usedWidth = Math.max(usedWidth, cursorX)
    rowHeight = Math.max(rowHeight, sprite.height)
  }

  const width = Math.max(1, usedWidth)
  const height = cursorY + rowHeight + padding
  const buffer = new PixelBuffer(width, height)
  const rgba = new Uint8ClampedArray(width * height * 4)

  for (const sprite of sprites) {
    const frame = frames[sprite.name]
    const source = PixelBuffer.fromSprite(sprite)
    buffer.blit(source, frame.x, frame.y)
    const bytes = spriteToRGBA(sprite)
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        const from = (y * sprite.width + x) * 4
        if (bytes[from + 3] === 0) continue
        const to = ((frame.y + y) * width + frame.x + x) * 4
        rgba[to] = bytes[from]
        rgba[to + 1] = bytes[from + 1]
        rgba[to + 2] = bytes[from + 2]
        rgba[to + 3] = bytes[from + 3]
      }
    }
  }

  return { name, width, height, frames, rgba }
}

/** Atlas metadata without the pixels, for writing a JSON sidecar. */
export function atlasManifest(atlas: Atlas): object {
  return {
    name: atlas.name,
    width: atlas.width,
    height: atlas.height,
    palette: BASE_PALETTE,
    frames: atlas.frames,
  }
}
