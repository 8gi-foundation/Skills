import { clamp, damp } from "../core/math.js"
import type { Vec2 } from "../core/types.js"

/**
 * Pixel perfect camera.
 *
 * Zoom is always an integer so a source pixel maps to a whole number of device
 * pixels. The camera centre is rounded at draw time rather than in the update,
 * so smoothing stays smooth while the output stays crisp.
 */
export class Camera {
  center: Vec2 = { x: 0, y: 0 }
  zoom = 3
  viewportWidth = 0
  viewportHeight = 0
  /** Half width and half height of the box the target can move in before the camera pans. */
  deadzone: Vec2 = { x: 24, y: 16 }

  private bounds = { width: 0, height: 0 }

  setViewport(width: number, height: number): void {
    this.viewportWidth = width
    this.viewportHeight = height
  }

  setBounds(pixelWidth: number, pixelHeight: number): void {
    this.bounds = { width: pixelWidth, height: pixelHeight }
  }

  /** Largest integer zoom that still shows the whole map. May letterbox. */
  fitZoom(minZoom = 1, maxZoom = 6): number {
    if (!this.bounds.width || !this.viewportWidth) return this.zoom
    const zoom = Math.floor(
      Math.min(this.viewportWidth / this.bounds.width, this.viewportHeight / this.bounds.height),
    )
    return clamp(zoom, minZoom, maxZoom)
  }

  /**
   * Smallest integer zoom that fills the viewport in both axes.
   *
   * This is the default, because an office is wider than it is tall and almost
   * every host embeds it in a panel that is not. Fitting would letterbox a
   * short map inside a tall panel; covering never shows the void.
   */
  coverZoom(minZoom = 2, maxZoom = 8): number {
    if (!this.bounds.width || !this.viewportWidth) return this.zoom
    const zoom = Math.ceil(
      Math.max(this.viewportWidth / this.bounds.width, this.viewportHeight / this.bounds.height),
    )
    return clamp(zoom, minZoom, maxZoom)
  }

  follow(target: Vec2, dt: number): void {
    const dx = target.x - this.center.x
    const dy = target.y - this.center.y
    if (Math.abs(dx) > this.deadzone.x) {
      this.center.x = damp(this.center.x, target.x - Math.sign(dx) * this.deadzone.x, 8, dt)
    }
    if (Math.abs(dy) > this.deadzone.y) {
      this.center.y = damp(this.center.y, target.y - Math.sign(dy) * this.deadzone.y, 8, dt)
    }
    this.clamp()
  }

  jumpTo(target: Vec2): void {
    this.center = { ...target }
    this.clamp()
  }

  /** Keep the view inside the map, or centre it when the map is smaller. */
  clamp(): void {
    const halfW = this.viewportWidth / (2 * this.zoom)
    const halfH = this.viewportHeight / (2 * this.zoom)
    this.center.x =
      this.bounds.width <= halfW * 2
        ? this.bounds.width / 2
        : clamp(this.center.x, halfW, this.bounds.width - halfW)
    this.center.y =
      this.bounds.height <= halfH * 2
        ? this.bounds.height / 2
        : clamp(this.center.y, halfH, this.bounds.height - halfH)
  }

  get originX(): number {
    return Math.round(this.center.x * this.zoom - this.viewportWidth / 2)
  }

  get originY(): number {
    return Math.round(this.center.y * this.zoom - this.viewportHeight / 2)
  }

  worldToScreen(x: number, y: number): Vec2 {
    return { x: Math.round(x * this.zoom) - this.originX, y: Math.round(y * this.zoom) - this.originY }
  }

  screenToWorld(x: number, y: number): Vec2 {
    return { x: (x + this.originX) / this.zoom, y: (y + this.originY) / this.zoom }
  }

  /** Visible world rectangle, used to cull tiles and sprites. */
  visibleRect(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.originX / this.zoom,
      y: this.originY / this.zoom,
      w: this.viewportWidth / this.zoom,
      h: this.viewportHeight / this.zoom,
    }
  }
}
