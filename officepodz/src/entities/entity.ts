import { WALK_CYCLE, type AvatarPose, type AvatarStyle } from "../art/avatar.js"
import type { PetKind, PetPose } from "../art/pets.js"
import { directionFromVector } from "../core/math.js"
import {
  TILE_SIZE,
  tileToWorld,
  worldToTile,
  type Direction,
  type EntityId,
  type OccupantKind,
  type PresenceState,
  type Vec2,
} from "../core/types.js"
import { findPath } from "../nav/astar.js"
import type { Tilemap } from "../world/tilemap.js"

/** Speech and status bubbles float above a character for a few seconds. */
export interface Bubble {
  text: string
  /** "say" renders a tail, "status" renders a flat chip, "emote" renders large. */
  variant: "say" | "status" | "emote"
  expiresAt: number
}

export interface CharacterInit {
  id: EntityId
  name: string
  kind: OccupantKind
  /** Job title or agent role, shown under the name. */
  role?: string
  tile: Vec2
  style?: AvatarStyle
  petKind?: PetKind
  ownerId?: EntityId
  presence?: PresenceState
  speed?: number
}

/**
 * A character in the world: a person, an agent, or a pet.
 *
 * Position is stored in world pixels at the character's feet. Pathing is in
 * tiles, movement is continuous, and facing is derived from the movement
 * vector rather than stored by the caller, which keeps network updates to a
 * position and a target.
 */
export class Character {
  readonly id: EntityId
  name: string
  readonly kind: OccupantKind
  role: string
  presence: PresenceState
  style?: AvatarStyle
  petKind?: PetKind
  ownerId?: EntityId

  /** Feet position in world pixels. */
  pos: Vec2
  dir: Direction = "south"
  speed: number
  /** Set while the character is on a chair, which swaps the pose and stops pathing. */
  seatedAt?: string
  bubble?: Bubble

  /** Remaining tile path, first element is the next step. */
  path: Vec2[] = []
  private travelled = 0
  private idleTimer = 0

  constructor(init: CharacterInit) {
    this.id = init.id
    this.name = init.name
    this.kind = init.kind
    this.role = init.role ?? (init.kind === "agent" ? "Agent" : "")
    this.presence = init.presence ?? "online"
    if (init.style) this.style = init.style
    if (init.petKind) this.petKind = init.petKind
    if (init.ownerId) this.ownerId = init.ownerId
    this.pos = tileToWorld(init.tile.x, init.tile.y)
    this.speed = init.speed ?? (init.kind === "pet" ? 56 : 46)
  }

  get tile(): Vec2 {
    return worldToTile(this.pos.x, this.pos.y)
  }

  get moving(): boolean {
    return this.path.length > 0
  }

  /** Current avatar pose, derived from motion and seating. */
  get pose(): AvatarPose {
    if (this.seatedAt) return "sit"
    if (!this.moving) return "stand"
    return WALK_CYCLE[Math.floor(this.travelled / 7) % WALK_CYCLE.length]
  }

  /** Current pet pose. Pets have a shorter vocabulary than people. */
  get petPose(): PetPose {
    if (this.seatedAt) return "sleep"
    if (!this.moving) return this.idleTimer > 6 ? "sleep" : "stand"
    return Math.floor(this.travelled / 6) % 2 === 0 ? "stand" : "step"
  }

  teleport(tile: Vec2): void {
    this.pos = tileToWorld(tile.x, tile.y)
    this.path = []
  }

  face(direction: Direction): void {
    this.dir = direction
  }

  faceTowards(target: Vec2): void {
    this.dir = directionFromVector(target.x - this.pos.x, target.y - this.pos.y, this.dir)
  }

  say(text: string, now: number, variant: Bubble["variant"] = "say", seconds = 6): void {
    this.bubble = { text, variant, expiresAt: now + seconds }
  }

  /** Walk to a tile. Returns false when no route exists. */
  walkTo(map: Tilemap, target: Vec2, options: { adjacent?: boolean; occupied?: ReadonlySet<number> } = {}): boolean {
    const path = findPath(map, this.tile, target, options)
    if (path.length === 0) {
      const sameTile = this.tile.x === target.x && this.tile.y === target.y
      return sameTile || (options.adjacent === true && Math.abs(this.tile.x - target.x) + Math.abs(this.tile.y - target.y) <= 1)
    }
    this.seatedAt = undefined
    this.path = path
    return true
  }

  stop(): void {
    this.path = []
  }

  /** Advance movement and animation. Call once per simulation step. */
  update(dt: number, now: number): void {
    if (this.bubble && this.bubble.expiresAt <= now) this.bubble = undefined

    if (this.path.length === 0) {
      this.idleTimer += dt
      return
    }
    this.idleTimer = 0

    let budget = this.speed * dt
    while (budget > 0 && this.path.length > 0) {
      const next = this.path[0]
      const target = tileToWorld(next.x, next.y)
      const dx = target.x - this.pos.x
      const dy = target.y - this.pos.y
      const distance = Math.hypot(dx, dy)

      if (distance <= budget) {
        this.pos = target
        this.travelled += distance
        budget -= distance
        this.path.shift()
        if (this.path.length > 0) this.faceTowards(tileToWorld(this.path[0].x, this.path[0].y))
      } else {
        const step = budget / distance
        this.pos = { x: this.pos.x + dx * step, y: this.pos.y + dy * step }
        this.travelled += budget
        this.dir = directionFromVector(dx, dy, this.dir)
        budget = 0
      }
    }
  }

  /** Depth sort key. Characters draw in feet order so overlaps look right. */
  get sortY(): number {
    return this.pos.y
  }

  /** Distance in tiles, used by brains and proximity audio. */
  tileDistanceTo(other: Character): number {
    return Math.hypot(this.pos.x - other.pos.x, this.pos.y - other.pos.y) / TILE_SIZE
  }
}
