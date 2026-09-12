import { spriteToCanvas, type PixelSprite } from "../pixel/sprite.js"

/**
 * Lazily bakes pixel sprites into canvases.
 *
 * Every avatar is a palette swap of the same template, so the cache is keyed by
 * the resolved palette rather than by character id. A hundred people wearing
 * eight outfits cost eight bakes, not a hundred.
 */
export class SpriteCache {
  private canvases = new Map<string, HTMLCanvasElement>()

  get(key: string, build: () => PixelSprite): HTMLCanvasElement {
    const existing = this.canvases.get(key)
    if (existing) return existing
    const canvas = spriteToCanvas(build())
    this.canvases.set(key, canvas)
    return canvas
  }

  has(key: string): boolean {
    return this.canvases.has(key)
  }

  clear(): void {
    this.canvases.clear()
  }

  get size(): number {
    return this.canvases.size
  }
}
