import { BASE_PALETTE } from "./palette.js"
import { indexToKey, keyToIndex, type PixelSprite } from "./sprite.js"

/**
 * A tiny software pixel canvas.
 *
 * Furniture, tiles and pets are drawn procedurally with these primitives rather
 * than hand authored as strings. Fewer characters to get wrong, and a themed
 * office can be regenerated from parameters instead of redrawn.
 */
export class PixelBuffer {
  readonly data: Uint8Array

  constructor(
    readonly width: number,
    readonly height: number,
    fill = 0,
  ) {
    this.data = new Uint8Array(width * height).fill(fill)
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  set(x: number, y: number, color: number): this {
    const px = Math.round(x)
    const py = Math.round(y)
    if (this.inside(px, py)) this.data[py * this.width + px] = color
    return this
  }

  get(x: number, y: number): number {
    if (!this.inside(x, y)) return 0
    return this.data[y * this.width + x]
  }

  clear(color = 0): this {
    this.data.fill(color)
    return this
  }

  fillRect(x: number, y: number, w: number, h: number, color: number): this {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) this.set(px, py, color)
    }
    return this
  }

  strokeRect(x: number, y: number, w: number, h: number, color: number): this {
    this.hLine(x, y, w, color)
    this.hLine(x, y + h - 1, w, color)
    this.vLine(x, y, h, color)
    this.vLine(x + w - 1, y, h, color)
    return this
  }

  hLine(x: number, y: number, length: number, color: number): this {
    for (let i = 0; i < length; i++) this.set(x + i, y, color)
    return this
  }

  vLine(x: number, y: number, length: number, color: number): this {
    for (let i = 0; i < length; i++) this.set(x, y + i, color)
    return this
  }

  /** Midpoint ellipse, filled. Used for pet bodies, rugs and plant canopies. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: number): this {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const nx = x / (rx + 0.5)
        const ny = y / (ry + 0.5)
        if (nx * nx + ny * ny <= 1) this.set(cx + x, cy + y, color)
      }
    }
    return this
  }

  /** Rounded panel with a lit top edge and a shaded bottom edge. */
  panel(
    x: number,
    y: number,
    w: number,
    h: number,
    base: number,
    light: number,
    dark: number,
    outline: number,
  ): this {
    this.fillRect(x, y, w, h, base)
    this.hLine(x + 1, y, w - 2, light)
    this.hLine(x + 1, y + h - 1, w - 2, dark)
    this.strokeRect(x, y, w, h, outline)
    // Knock the corners out so panels read as slightly rounded at 16px.
    this.set(x, y, 0)
    this.set(x + w - 1, y, 0)
    this.set(x, y + h - 1, 0)
    this.set(x + w - 1, y + h - 1, 0)
    return this
  }

  /** Checker dither between two colours, for carpet and shadow falloff. */
  dither(x: number, y: number, w: number, h: number, color: number, phase = 0): this {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if ((px + py + phase) % 2 === 0) this.set(px, py, color)
      }
    }
    return this
  }

  /** Soft contact shadow beneath a standing object. */
  contactShadow(cx: number, cy: number, rx: number, color: number): this {
    this.ellipse(cx, cy, rx, Math.max(1, Math.round(rx / 3)), color)
    return this
  }

  blit(source: PixelBuffer, dx: number, dy: number): this {
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        const color = source.get(x, y)
        if (color !== 0) this.set(dx + x, dy + y, color)
      }
    }
    return this
  }

  /** Trace a one pixel outline around every opaque cluster. */
  outline(color: number): this {
    const snapshot = this.data.slice()
    const at = (x: number, y: number) =>
      x < 0 || y < 0 || x >= this.width || y >= this.height ? 0 : snapshot[y * this.width + x]
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (at(x, y) !== 0) continue
        const touching =
          at(x - 1, y) !== 0 || at(x + 1, y) !== 0 || at(x, y - 1) !== 0 || at(x, y + 1) !== 0
        if (touching) this.set(x, y, color)
      }
    }
    return this
  }

  toSprite(name: string, palette: readonly string[] = BASE_PALETTE, originY?: number): PixelSprite {
    const rows: string[] = []
    for (let y = 0; y < this.height; y++) {
      let row = ""
      for (let x = 0; x < this.width; x++) row += indexToKey(this.data[y * this.width + x])
      rows.push(row)
    }
    return originY === undefined
      ? { name, width: this.width, height: this.height, palette, rows }
      : { name, width: this.width, height: this.height, palette, rows, originY }
  }

  static fromSprite(sprite: PixelSprite): PixelBuffer {
    const buffer = new PixelBuffer(sprite.width, sprite.height)
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        buffer.set(x, y, keyToIndex(sprite.rows[y][x]))
      }
    }
    return buffer
  }
}
