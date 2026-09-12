import { FURNITURE } from "../art/furniture.js"
import { SOLID_TILES, TILE_ID } from "../art/tiles.js"
import { TILE_SIZE, rectContains, type Vec2, type ZoneId } from "../core/types.js"
import type { PlacedObject, WorldData, ZoneData } from "./types.js"

/**
 * Runtime view over WorldData.
 *
 * Owns the collision grid, the zone lookup and the object index. Rebuild
 * collision after any edit; it is a single pass over the map and costs nothing
 * at these sizes.
 */
export class Tilemap {
  readonly width: number
  readonly height: number
  readonly floor: Int16Array
  readonly walls: Int16Array
  private collision: Uint8Array
  private objectsById = new Map<string, PlacedObject>()

  constructor(readonly data: WorldData) {
    this.width = data.width
    this.height = data.height
    this.floor = Int16Array.from(data.floor)
    this.walls = Int16Array.from(data.walls)
    this.collision = new Uint8Array(this.width * this.height)
    this.rebuild()
  }

  private index(x: number, y: number): number {
    return y * this.width + x
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  floorAt(x: number, y: number): number {
    return this.inBounds(x, y) ? this.floor[this.index(x, y)] : TILE_ID.void
  }

  wallAt(x: number, y: number): number {
    return this.inBounds(x, y) ? this.walls[this.index(x, y)] : TILE_ID.void
  }

  setFloor(x: number, y: number, tile: number): void {
    if (this.inBounds(x, y)) this.floor[this.index(x, y)] = tile
  }

  setWall(x: number, y: number, tile: number): void {
    if (this.inBounds(x, y)) this.walls[this.index(x, y)] = tile
  }

  /** True when an avatar or pet can stand on this tile. */
  walkable(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false
    return this.collision[this.index(x, y)] === 0
  }

  /** Recompute blocked tiles from walls plus solid furniture footprints. */
  rebuild(): void {
    this.collision.fill(0)
    this.objectsById.clear()

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = this.index(x, y)
        const blocked = SOLID_TILES.has(this.walls[i]) || this.floor[i] === TILE_ID.void
        this.collision[i] = blocked ? 1 : 0
      }
    }

    for (const object of this.data.objects) {
      this.objectsById.set(object.id, object)
      const def = FURNITURE[object.kind]
      if (!def.solid) continue
      for (let dy = 0; dy < def.h; dy++) {
        for (let dx = 0; dx < def.w; dx++) {
          const x = object.x + dx
          const y = object.y + dy
          if (this.inBounds(x, y)) this.collision[this.index(x, y)] = 1
        }
      }
    }
  }

  addObject(object: PlacedObject): void {
    this.data.objects.push(object)
    this.rebuild()
  }

  removeObject(id: string): boolean {
    const at = this.data.objects.findIndex((object) => object.id === id)
    if (at < 0) return false
    this.data.objects.splice(at, 1)
    this.rebuild()
    return true
  }

  getObject(id: string): PlacedObject | undefined {
    return this.objectsById.get(id)
  }

  /** Topmost object whose footprint covers the tile. */
  objectAt(x: number, y: number): PlacedObject | undefined {
    for (let i = this.data.objects.length - 1; i >= 0; i--) {
      const object = this.data.objects[i]
      const def = FURNITURE[object.kind]
      if (x >= object.x && y >= object.y && x < object.x + def.w && y < object.y + def.h) {
        return object
      }
    }
    return undefined
  }

  get zones(): ZoneData[] {
    return this.data.zones
  }

  zoneAt(x: number, y: number): ZoneData | undefined {
    // Reverse order so a room placed on top of a corridor wins.
    for (let i = this.data.zones.length - 1; i >= 0; i--) {
      if (rectContains(this.data.zones[i].rect, x, y)) return this.data.zones[i]
    }
    return undefined
  }

  zoneById(id: ZoneId): ZoneData | undefined {
    return this.data.zones.find((zone) => zone.id === id)
  }

  /** Nearest walkable tile to a target, breadth first. Used for spawn repair. */
  nearestWalkable(x: number, y: number, maxRadius = 12): Vec2 | undefined {
    if (this.walkable(x, y)) return { x, y }
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
          if (this.walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy }
        }
      }
    }
    return undefined
  }

  get pixelWidth(): number {
    return this.width * TILE_SIZE
  }

  get pixelHeight(): number {
    return this.height * TILE_SIZE
  }

  toJSON(): WorldData {
    return {
      ...this.data,
      floor: Array.from(this.floor),
      walls: Array.from(this.walls),
    }
  }
}
