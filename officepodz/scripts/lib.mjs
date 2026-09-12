// Shared helpers for the OfficePodz build scripts.
// Scripts run against the compiled output in dist/, so they never need a
// TypeScript loader and behave identically in CI and on a laptop.
import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const ASSETS = resolve(ROOT, "assets")

export const deflate = (raw) => new Uint8Array(deflateSync(Buffer.from(raw), { level: 9 }))

export function writeFile(relativePath, bytes) {
  const target = resolve(ROOT, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes))
  return target
}

export function writeJSON(relativePath, value) {
  return writeFile(relativePath, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"))
}

export function human(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`
}

/**
 * Minimal RGBA compositor for headless rendering.
 *
 * Sprites carry their own palettes (every avatar is a palette swap of one
 * template), so compositing has to happen in colour space, not in palette index
 * space. The browser renderer gets this for free because each sprite is baked
 * to its own canvas first.
 */
export class RgbaCanvas {
  constructor(width, height, background = [16, 20, 15, 255]) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = background[0]
      this.data[i + 1] = background[1]
      this.data[i + 2] = background[2]
      this.data[i + 3] = background[3]
    }
  }

  blit(sprite, dx, dy, spriteToRGBA) {
    const bytes = spriteToRGBA(sprite)
    const left = Math.round(dx)
    const top = Math.round(dy)
    for (let y = 0; y < sprite.height; y++) {
      const py = top + y
      if (py < 0 || py >= this.height) continue
      for (let x = 0; x < sprite.width; x++) {
        const px = left + x
        if (px < 0 || px >= this.width) continue
        const from = (y * sprite.width + x) * 4
        if (bytes[from + 3] === 0) continue
        const to = (py * this.width + px) * 4
        this.data[to] = bytes[from]
        this.data[to + 1] = bytes[from + 1]
        this.data[to + 2] = bytes[from + 2]
        this.data[to + 3] = 255
      }
    }
  }

  upscale(factor) {
    if (factor === 1) return this.data
    const out = new Uint8ClampedArray(this.width * factor * this.height * factor * 4)
    const rowWidth = this.width * factor
    for (let y = 0; y < this.height * factor; y++) {
      for (let x = 0; x < rowWidth; x++) {
        const from = (Math.floor(y / factor) * this.width + Math.floor(x / factor)) * 4
        const to = (y * rowWidth + x) * 4
        out[to] = this.data[from]
        out[to + 1] = this.data[from + 1]
        out[to + 2] = this.data[from + 2]
        out[to + 3] = this.data[from + 3]
      }
    }
    return out
  }
}
