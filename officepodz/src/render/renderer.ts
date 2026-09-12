import { buildAvatarSprites, type AvatarStyle } from "../art/avatar.js"
import { FURNITURE } from "../art/furniture.js"
import { buildPetSprites } from "../art/pets.js"
import { buildFurnitureSprite } from "../art/furniture.js"
import { TILE_KINDS, buildTiles, type TileKind } from "../art/tiles.js"
import { TILE_SIZE } from "../core/types.js"
import type { Character } from "../entities/entity.js"
import type { PixelSprite } from "../pixel/sprite.js"
import type { Tilemap } from "../world/tilemap.js"
import { Camera } from "./camera.js"
import { SpriteCache } from "./spritecache.js"

export interface RenderOptions {
  /** Draw zone names on the floor. */
  showZoneLabels?: boolean
  /** Draw names under characters. */
  showNameplates?: boolean
  /** Tint the tile under the cursor and outline blocked tiles. */
  debugCollision?: boolean
  /** Dim everything outside the viewer's current room. */
  focusCurrentZone?: boolean
}

interface DrawCall {
  sortY: number
  draw: () => void
}

/**
 * Canvas renderer.
 *
 * One pass builds a list of draw calls keyed by their bottom edge, then the
 * list is sorted so a character standing below a desk covers it and a character
 * standing above it is covered. Walls join the same list, which is what lets
 * someone walk behind a partition without a separate occlusion system.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D
  private cache = new SpriteCache()
  private tileSprites: Record<TileKind, PixelSprite>
  private dpr = 1

  readonly camera = new Camera()

  constructor(
    readonly canvas: HTMLCanvasElement,
    private map: Tilemap,
    private options: RenderOptions = {},
  ) {
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) throw new Error("OfficePodz: 2d canvas context unavailable")
    this.ctx = ctx
    this.tileSprites = buildTiles(map.data.seed)
    this.camera.setBounds(map.pixelWidth, map.pixelHeight)
    this.resize()
  }

  setMap(map: Tilemap): void {
    this.map = map
    this.tileSprites = buildTiles(map.data.seed)
    this.cache.clear()
    this.camera.setBounds(map.pixelWidth, map.pixelHeight)
  }

  setOptions(options: RenderOptions): void {
    this.options = { ...this.options, ...options }
  }

  /** Match the backing store to the css size and the device pixel ratio. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width || this.canvas.width))
    const height = Math.max(1, Math.floor(rect.height || this.canvas.height))
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1)
    this.canvas.width = Math.floor(width * this.dpr)
    this.canvas.height = Math.floor(height * this.dpr)
    this.camera.setViewport(this.canvas.width, this.canvas.height)
    this.camera.clamp()
  }

  private tileCanvas(kind: TileKind): HTMLCanvasElement {
    return this.cache.get(`tile:${kind}`, () => this.tileSprites[kind])
  }

  private furnitureCanvas(kind: keyof typeof FURNITURE, seed: number): HTMLCanvasElement {
    return this.cache.get(`furn:${kind}:${seed}`, () => buildFurnitureSprite(kind, seed))
  }

  private avatarCanvas(character: Character, style: AvatarStyle): HTMLCanvasElement {
    const key = `av:${style.skin}:${style.hair}:${style.hairStyle}:${style.outfit}:${style.trousers}:${style.accent}:${style.eye}:${character.dir}:${character.pose}`
    return this.cache.get(key, () => {
      const set = buildAvatarSprites(style, "avatar")
      return set.frames[`${character.dir}:${character.pose}`]
    })
  }

  private petCanvas(character: Character): HTMLCanvasElement {
    const kind = character.petKind ?? "cat"
    const key = `pet:${kind}:${character.dir}:${character.petPose}`
    return this.cache.get(key, () => {
      const set = buildPetSprites(kind, kind)
      return set.frames[`${character.dir}:${character.petPose}`]
    })
  }

  /** Draw one frame. `characters` may be any iterable, order does not matter. */
  render(characters: Iterable<Character>, viewerId?: string, elapsed = 0): void {
    const { ctx, camera } = this
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = "#10140f"
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    const view = camera.visibleRect()
    const minTileX = Math.max(0, Math.floor(view.x / TILE_SIZE) - 1)
    const minTileY = Math.max(0, Math.floor(view.y / TILE_SIZE) - 1)
    const maxTileX = Math.min(this.map.width - 1, Math.ceil((view.x + view.w) / TILE_SIZE) + 1)
    const maxTileY = Math.min(this.map.height - 1, Math.ceil((view.y + view.h) / TILE_SIZE) + 1)
    const zoom = camera.zoom

    // Floor pass. Flat, no sorting, one draw per visible tile.
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const tile = this.map.floorAt(tx, ty)
        const kind = TILE_KINDS[tile] ?? "void"
        const screen = camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE)
        ctx.drawImage(this.tileCanvas(kind), screen.x, screen.y, TILE_SIZE * zoom, TILE_SIZE * zoom)
      }
    }

    if (this.options.showZoneLabels !== false) this.drawZoneLabels()

    const calls: DrawCall[] = []

    // Walls join the depth list so characters can pass behind them.
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const tile = this.map.wallAt(tx, ty)
        if (!tile) continue
        const kind = TILE_KINDS[tile] ?? "void"
        const screen = camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE)
        calls.push({
          sortY: (ty + 1) * TILE_SIZE - 4,
          draw: () =>
            ctx.drawImage(this.tileCanvas(kind), screen.x, screen.y, TILE_SIZE * zoom, TILE_SIZE * zoom),
        })
      }
    }

    for (const object of this.map.data.objects) {
      const def = FURNITURE[object.kind]
      if (
        object.x > maxTileX + 2 ||
        object.y > maxTileY + 2 ||
        object.x + def.w < minTileX - 2 ||
        object.y + def.h < minTileY - 3
      ) {
        continue
      }
      const sprite = this.furnitureCanvas(object.kind, object.seed ?? 0)
      const bottom = (object.y + def.h) * TILE_SIZE
      const screen = camera.worldToScreen(object.x * TILE_SIZE, bottom - def.spriteH)
      calls.push({
        sortY: def.solid ? bottom : bottom - TILE_SIZE * 2,
        draw: () =>
          ctx.drawImage(sprite, screen.x, screen.y, def.spriteW * zoom, def.spriteH * zoom),
      })
    }

    for (const character of characters) {
      const sprite =
        character.kind === "pet"
          ? this.petCanvas(character)
          : this.avatarCanvas(character, character.style ?? fallbackStyle())
      const width = sprite.width
      const height = sprite.height
      const bob = character.kind === "pet" ? 0 : 0
      const screen = camera.worldToScreen(
        character.pos.x - width / 2,
        character.pos.y - height + TILE_SIZE / 2 + bob,
      )
      calls.push({
        sortY: character.sortY,
        draw: () => {
          this.drawShadow(character)
          ctx.drawImage(sprite, screen.x, screen.y, width * zoom, height * zoom)
          if (this.options.showNameplates !== false && character.kind !== "pet") {
            this.drawNameplate(character, screen.x + (width * zoom) / 2, screen.y)
          }
          if (character.bubble) {
            this.drawBubble(character, screen.x + (width * zoom) / 2, screen.y, elapsed)
          }
          if (character.id === viewerId) this.drawViewerRing(character)
        },
      })
    }

    calls.sort((a, b) => a.sortY - b.sortY)
    for (const call of calls) call.draw()

    if (this.options.debugCollision) this.drawCollision(minTileX, minTileY, maxTileX, maxTileY)
  }

  private drawShadow(character: Character): void {
    const { ctx, camera } = this
    const screen = camera.worldToScreen(character.pos.x, character.pos.y + 2)
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.fillStyle = "#10140f"
    ctx.beginPath()
    ctx.ellipse(screen.x, screen.y, 5 * camera.zoom, 2 * camera.zoom, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawViewerRing(character: Character): void {
    const { ctx, camera } = this
    const screen = camera.worldToScreen(character.pos.x, character.pos.y + 2)
    ctx.save()
    ctx.strokeStyle = "#46a05a"
    ctx.lineWidth = Math.max(1, camera.zoom / 2)
    ctx.beginPath()
    ctx.ellipse(screen.x, screen.y, 6 * camera.zoom, 2.5 * camera.zoom, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  private drawZoneLabels(): void {
    const { ctx, camera } = this
    ctx.save()
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.font = `${Math.max(9, 3 * camera.zoom)}px ui-monospace, monospace`
    for (const zone of this.map.zones) {
      if (zone.kind === "corridor") continue
      const screen = camera.worldToScreen(
        (zone.rect.x + zone.rect.w / 2) * TILE_SIZE,
        (zone.rect.y + 1) * TILE_SIZE,
      )
      ctx.fillStyle = "rgba(16, 20, 15, 0.55)"
      const label = zone.name.toUpperCase()
      const width = ctx.measureText(label).width + 10
      ctx.fillRect(screen.x - width / 2, screen.y - 2, width, 4 * camera.zoom)
      ctx.fillStyle = zone.accent ?? "#eef2ea"
      ctx.fillText(label, screen.x, screen.y)
    }
    ctx.restore()
  }

  private drawNameplate(character: Character, cx: number, top: number): void {
    const { ctx, camera } = this
    const scale = Math.max(9, 3 * camera.zoom)
    ctx.save()
    ctx.font = `${scale}px ui-monospace, monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "bottom"
    const label = character.name
    const width = ctx.measureText(label).width + 8
    const y = top - 4
    ctx.fillStyle = "rgba(16, 20, 15, 0.72)"
    ctx.fillRect(cx - width / 2, y - scale - 2, width, scale + 4)
    ctx.fillStyle = presenceColor(character.presence)
    ctx.fillRect(cx - width / 2, y - scale - 2, 2, scale + 4)
    ctx.fillStyle = character.kind === "agent" ? "#6fa8e6" : "#eef2ea"
    ctx.fillText(label, cx, y)
    ctx.restore()
  }

  private drawBubble(character: Character, cx: number, top: number, elapsed: number): void {
    const bubble = character.bubble
    if (!bubble) return
    const { ctx, camera } = this
    const scale = Math.max(10, 3.2 * camera.zoom)
    ctx.save()
    ctx.font = `${scale}px ui-monospace, monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    const lines = wrapText(ctx, bubble.text, 22)
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width))
    const padding = scale * 0.6
    const boxW = widest + padding * 2
    const boxH = lines.length * (scale + 2) + padding
    // A slow float keeps bubbles alive without stealing attention.
    const float = Math.sin(elapsed * 2 + character.pos.x) * camera.zoom * 0.4
    const boxY = top - boxH - 22 - float
    const boxX = cx - boxW / 2

    ctx.fillStyle = bubble.variant === "status" ? "rgba(29, 36, 27, 0.92)" : "rgba(238, 242, 234, 0.96)"
    ctx.strokeStyle = bubble.variant === "status" ? "#46a05a" : "#10140f"
    ctx.lineWidth = Math.max(1, camera.zoom / 2)
    ctx.beginPath()
    ctx.rect(boxX, boxY, boxW, boxH)
    ctx.fill()
    ctx.stroke()

    if (bubble.variant === "say") {
      ctx.beginPath()
      ctx.moveTo(cx - 4 * camera.zoom * 0.5, boxY + boxH)
      ctx.lineTo(cx, boxY + boxH + 5 * camera.zoom * 0.6)
      ctx.lineTo(cx + 4 * camera.zoom * 0.5, boxY + boxH)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    ctx.fillStyle = bubble.variant === "status" ? "#8fd49c" : "#10140f"
    lines.forEach((line, index) => {
      ctx.fillText(line, cx, boxY + padding / 2 + (index + 0.5) * (scale + 2))
    })
    ctx.restore()
  }

  private drawCollision(minX: number, minY: number, maxX: number, maxY: number): void {
    const { ctx, camera } = this
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = "#c0392b"
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (this.map.walkable(tx, ty)) continue
        const screen = camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE)
        ctx.fillRect(screen.x, screen.y, TILE_SIZE * camera.zoom, TILE_SIZE * camera.zoom)
      }
    }
    ctx.restore()
  }
}

function presenceColor(presence: string): string {
  switch (presence) {
    case "busy":
      return "#c0392b"
    case "away":
      return "#d9962a"
    case "thinking":
      return "#2bb3c4"
    case "offline":
      return "#5b655c"
    default:
      return "#46a05a"
  }
}

function fallbackStyle(): AvatarStyle {
  return {
    skin: 1,
    hair: 1,
    hairStyle: "short",
    outfit: 5,
    trousers: 0,
    accent: "#d9962a",
    eye: "#10140f",
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxChars: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 4)
}
