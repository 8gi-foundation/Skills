import type { FurnitureKind } from "../art/furniture.js"
import type { Rect, ZoneId } from "../core/types.js"

/**
 * The persisted world format.
 *
 * WorldData is plain JSON on purpose. A host stores it in whatever database it
 * already runs, diffs it, versions it, or throws it away and regenerates from
 * the seed. Nothing in here references a class or a canvas.
 */
export const WORLD_FORMAT_VERSION = 1

export type ZoneKind =
  | "pod"
  | "meeting"
  | "lounge"
  | "kitchen"
  | "focus"
  | "server"
  | "play"
  | "corridor"
  | "atrium"

export interface ZoneData {
  id: ZoneId
  name: string
  kind: ZoneKind
  /** Rect in tiles, walls included. */
  rect: Rect
  /**
   * Host binding. Entering the zone is reported with this value so the host can
   * map it onto a channel, a room, a meeting, or nothing at all.
   */
  binding?: string
  capacity?: number
  /** Hex accent used for the zone label and floor tint. */
  accent?: string
}

export interface PlacedObject {
  id: string
  kind: FurnitureKind
  /** Origin tile, top left of the footprint. */
  x: number
  y: number
  zoneId?: ZoneId
  /** Desk ownership. The host sets this to a user or agent id. */
  ownerId?: string
  /** Per instance art seed, so two desks are not pixel identical. */
  seed?: number
}

export interface WorldData {
  version: number
  name: string
  seed: string
  /** Size in tiles. */
  width: number
  height: number
  /** Row major tile ids, length width * height. */
  floor: number[]
  walls: number[]
  zones: ZoneData[]
  objects: PlacedObject[]
  spawn: { x: number; y: number }
}
