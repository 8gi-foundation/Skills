import type { Direction, EntityId, PresenceState, Vec2, ZoneId } from "../core/types.js"
import type { PlacedObject } from "../world/types.js"
import type { OccupantRecord } from "../integration/adapter.js"

/**
 * Wire protocol.
 *
 * Deliberately small and self describing. Movement is sent as a target tile
 * rather than a stream of positions, so a peer that drops packets still ends up
 * in the right place and bandwidth stays flat no matter the frame rate.
 */
export const PROTOCOL_VERSION = 1

export type NetMessage =
  | { t: "hello"; version: number; roomId: string }
  | { t: "join"; occupant: OccupantRecord; tile: Vec2 }
  | { t: "leave"; id: EntityId }
  /** Authoritative correction or a teleport. */
  | { t: "place"; id: EntityId; tile: Vec2; dir: Direction }
  /** Intent to walk somewhere. Receivers path locally. */
  | { t: "goto"; id: EntityId; tile: Vec2 }
  | { t: "say"; id: EntityId; text: string }
  | { t: "emote"; id: EntityId; text: string }
  | { t: "presence"; id: EntityId; presence: PresenceState; status?: string }
  | { t: "seat"; id: EntityId; objectId: string | null }
  | { t: "zone"; id: EntityId; zoneId: ZoneId | null }
  | { t: "object-added"; object: PlacedObject }
  | { t: "object-removed"; objectId: string }
  /** Full state for a client that just connected. */
  | { t: "snapshot"; occupants: { occupant: OccupantRecord; tile: Vec2; dir: Direction }[] }

export type NetHandler = (message: NetMessage) => void

export interface Transport {
  readonly id: string
  send(message: NetMessage): void
  onMessage(handler: NetHandler): () => void
  close(): void
}
