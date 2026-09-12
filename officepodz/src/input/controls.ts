import type { Direction, Vec2 } from "../core/types.js"
import type { Camera } from "../render/camera.js"

/**
 * Input.
 *
 * Two ways in, because a virtual office gets used on a laptop during a standup
 * and on a phone on a train: hold a key to walk, or tap a tile to route there.
 * Both produce the same intents, so the rest of the engine never branches on
 * input device.
 */

export interface ControlHandlers {
  /** Held direction changed. Null means nothing is held. */
  onSteer?: (direction: Direction | null) => void
  /** A tile was clicked or tapped. */
  onTileTap?: (tile: Vec2) => void
  onInteract?: () => void
  onChat?: () => void
  onZoom?: (delta: number) => void
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "north",
  ArrowDown: "south",
  ArrowLeft: "west",
  ArrowRight: "east",
  w: "north",
  s: "south",
  a: "west",
  d: "east",
  W: "north",
  S: "south",
  A: "west",
  D: "east",
}

export class Controls {
  private held = new Set<Direction>()
  private detachers: (() => void)[] = []

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
    private readonly handlers: ControlHandlers,
  ) {
    this.attach()
  }

  /** The direction the player is currently asking for, newest press wins. */
  get steer(): Direction | null {
    const last = [...this.held].pop()
    return last ?? null
  }

  private attach(): void {
    const onKeyDown = (event: KeyboardEvent) => {
      // Never steal typing from a chat box or any other field.
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }
      const direction = KEY_DIRECTIONS[event.key]
      if (direction) {
        event.preventDefault()
        if (!this.held.has(direction)) {
          this.held.add(direction)
          this.handlers.onSteer?.(this.steer)
        }
        return
      }
      if (event.key === "e" || event.key === "E" || event.key === " ") {
        event.preventDefault()
        this.handlers.onInteract?.()
      }
      if (event.key === "Enter" || event.key === "t") this.handlers.onChat?.()
      if (event.key === "+" || event.key === "=") this.handlers.onZoom?.(1)
      if (event.key === "-" || event.key === "_") this.handlers.onZoom?.(-1)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.key]
      if (!direction) return
      this.held.delete(direction)
      this.handlers.onSteer?.(this.steer)
    }

    const onBlur = () => {
      this.held.clear()
      this.handlers.onSteer?.(null)
    }

    const onPointerDown = (event: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect()
      const scaleX = this.canvas.width / rect.width
      const scaleY = this.canvas.height / rect.height
      const world = this.camera.screenToWorld(
        (event.clientX - rect.left) * scaleX,
        (event.clientY - rect.top) * scaleY,
      )
      this.handlers.onTileTap?.({ x: Math.floor(world.x / 16), y: Math.floor(world.y / 16) })
    }

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && Math.abs(event.deltaY) < 8) return
      event.preventDefault()
      this.handlers.onZoom?.(event.deltaY > 0 ? -1 : 1)
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    this.canvas.addEventListener("pointerdown", onPointerDown)
    this.canvas.addEventListener("wheel", onWheel, { passive: false })

    this.detachers.push(
      () => window.removeEventListener("keydown", onKeyDown),
      () => window.removeEventListener("keyup", onKeyUp),
      () => window.removeEventListener("blur", onBlur),
      () => this.canvas.removeEventListener("pointerdown", onPointerDown),
      () => this.canvas.removeEventListener("wheel", onWheel),
    )
  }

  dispose(): void {
    for (const detach of this.detachers) detach()
    this.detachers = []
    this.held.clear()
  }
}
