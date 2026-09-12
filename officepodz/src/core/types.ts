/**
 * OfficePodz shared types.
 *
 * Coordinate systems used across the engine:
 *  - "tile"  : integer grid units. One tile is TILE_SIZE world pixels.
 *  - "world" : floating point pixels inside the map. Entities live here.
 *  - "screen": device pixels after camera transform and integer zoom.
 */

/** Size of a single tile in world pixels. Everything is authored against this. */
export const TILE_SIZE = 16

/** Sprite footprint of a standing character, in world pixels. */
export const AVATAR_WIDTH = 16
export const AVATAR_HEIGHT = 22

export interface Vec2 {
  x: number
  y: number
}

export type Direction = "north" | "south" | "east" | "west"

export const DIRECTIONS: readonly Direction[] = ["south", "north", "east", "west"]

/** Stable identifier for anything that can appear in the world. */
export type EntityId = string

/** Identifier of a room/zone. Hosts bind these to their own channels or rooms. */
export type ZoneId = string

/** What an occupant fundamentally is. Drives brain selection and nameplate styling. */
export type OccupantKind = "human" | "agent" | "pet"

/** Presence state mirrored from the host work OS. */
export type PresenceState = "online" | "busy" | "away" | "offline" | "thinking"

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Function returned by every subscribe helper. Call it to detach. */
export type Unsubscribe = () => void

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h
}

export function rectCenter(rect: Rect): Vec2 {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

export function tileToWorld(tileX: number, tileY: number): Vec2 {
  return { x: tileX * TILE_SIZE + TILE_SIZE / 2, y: tileY * TILE_SIZE + TILE_SIZE / 2 }
}

export function worldToTile(worldX: number, worldY: number): Vec2 {
  return { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) }
}
