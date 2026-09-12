import { FURNITURE } from "../art/furniture.js"
import { Rng } from "../core/rng.js"
import { rectCenter, type Vec2, type ZoneId } from "../core/types.js"
import type { Tilemap } from "../world/tilemap.js"
import type { Character } from "./entity.js"

/**
 * Autonomy for agents and pets.
 *
 * The rule this file follows: a brain never invents facts about the business.
 * It decides where a body should stand and when to idle. What an agent says and
 * what it is working on comes from the host through directives, so OfficePodz
 * stays a presentation layer and never becomes a second source of truth.
 */

export interface BrainContext {
  map: Tilemap
  now: number
  rng: Rng
  /** Everyone currently in the world, including the local player. */
  characters: ReadonlyMap<string, Character>
  /** Tiles occupied by standing characters, as `y * width + x`. */
  occupied: ReadonlySet<number>
  emit: (event: BrainEvent) => void
}

export type BrainEvent =
  | { type: "arrived"; characterId: string; tile: Vec2 }
  | { type: "seated"; characterId: string; objectId: string }
  | { type: "left-seat"; characterId: string; objectId: string }

/** A command from the host. Directives always beat idle behaviour. */
export type Directive =
  | { type: "goToZone"; zoneId: ZoneId }
  | { type: "goToTile"; tile: Vec2 }
  | { type: "sitAtDesk"; objectId?: string }
  | { type: "follow"; targetId: string }
  | { type: "say"; text: string; seconds?: number }
  | { type: "status"; text: string; seconds?: number }
  | { type: "emote"; text: string; seconds?: number }
  | { type: "wander" }
  | { type: "stand" }

export interface Brain {
  push(directive: Directive): void
  update(character: Character, ctx: BrainContext, dt: number): void
}

function seatTileFor(map: Tilemap, objectId: string): { tile: Vec2; facing: Vec2 } | undefined {
  const object = map.getObject(objectId)
  if (!object) return undefined
  const def = FURNITURE[object.kind]
  const seat = def.seats[0]
  if (!seat) return undefined
  return {
    tile: { x: object.x + seat.dx, y: object.y + seat.dy },
    facing: { x: object.x + def.w / 2, y: object.y },
  }
}

function randomWalkableIn(map: Tilemap, rect: { x: number; y: number; w: number; h: number }, rng: Rng): Vec2 | undefined {
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = rng.int(rect.x + 1, rect.x + rect.w - 2)
    const y = rng.int(rect.y + 1, rect.y + rect.h - 2)
    if (map.walkable(x, y)) return { x, y }
  }
  return undefined
}

/**
 * Agent brain.
 *
 * States, in priority order: directive, working at a desk, drifting around the
 * home zone, standing still. An agent that has been given a desk returns to it
 * when it runs out of other things to do, which is what makes an office full of
 * agents read as populated rather than as a screensaver.
 */
export class AgentBrain implements Brain {
  private queue: Directive[] = []
  private cooldown = 0
  private followTarget?: string

  constructor(
    /** Object id of this agent's desk, if the host assigned one. */
    public deskObjectId?: string,
    /** Zone the agent drifts around when idle. */
    public homeZoneId?: ZoneId,
  ) {}

  push(directive: Directive): void {
    this.queue.push(directive)
  }

  update(character: Character, ctx: BrainContext, dt: number): void {
    this.cooldown -= dt

    const directive = this.queue.shift()
    if (directive) this.apply(character, ctx, directive)

    if (this.followTarget) {
      const target = ctx.characters.get(this.followTarget)
      if (target && character.tileDistanceTo(target) > 2.5 && !character.moving) {
        character.walkTo(ctx.map, target.tile, { adjacent: true, occupied: ctx.occupied })
      }
      return
    }

    if (character.moving || character.seatedAt) return

    if (this.cooldown > 0) return
    this.cooldown = ctx.rng.int(3, 11)

    // Idle behaviour: most of the time head back to the desk, sometimes wander.
    if (this.deskObjectId && ctx.rng.bool(0.65)) {
      this.sitAtDesk(character, ctx, this.deskObjectId)
      return
    }
    this.wander(character, ctx)
  }

  private apply(character: Character, ctx: BrainContext, directive: Directive): void {
    switch (directive.type) {
      case "goToZone": {
        const zone = ctx.map.zoneById(directive.zoneId)
        if (!zone) return
        const target = randomWalkableIn(ctx.map, zone.rect, ctx.rng) ?? rectCenter(zone.rect)
        this.followTarget = undefined
        character.walkTo(ctx.map, { x: Math.round(target.x), y: Math.round(target.y) }, { occupied: ctx.occupied })
        break
      }
      case "goToTile":
        this.followTarget = undefined
        character.walkTo(ctx.map, directive.tile, { occupied: ctx.occupied })
        break
      case "sitAtDesk":
        this.sitAtDesk(character, ctx, directive.objectId ?? this.deskObjectId)
        break
      case "follow":
        this.followTarget = directive.targetId
        break
      case "say":
        character.say(directive.text, ctx.now, "say", directive.seconds ?? 6)
        break
      case "status":
        character.say(directive.text, ctx.now, "status", directive.seconds ?? 10)
        break
      case "emote":
        character.say(directive.text, ctx.now, "emote", directive.seconds ?? 3)
        break
      case "wander":
        this.followTarget = undefined
        this.wander(character, ctx)
        break
      case "stand":
        if (character.seatedAt) {
          ctx.emit({ type: "left-seat", characterId: character.id, objectId: character.seatedAt })
          character.seatedAt = undefined
        }
        this.followTarget = undefined
        character.stop()
        break
    }
  }

  private sitAtDesk(character: Character, ctx: BrainContext, objectId?: string): void {
    if (!objectId) return
    const seat = seatTileFor(ctx.map, objectId)
    if (!seat) return
    if (character.tile.x === seat.tile.x && character.tile.y === seat.tile.y) {
      character.seatedAt = objectId
      character.faceTowards({ x: seat.facing.x * 16, y: seat.facing.y * 16 })
      character.face("north")
      ctx.emit({ type: "seated", characterId: character.id, objectId })
      return
    }
    const routed = character.walkTo(ctx.map, seat.tile, { occupied: ctx.occupied })
    if (routed) this.queue.push({ type: "sitAtDesk", objectId })
  }

  private wander(character: Character, ctx: BrainContext): void {
    const zone = this.homeZoneId ? ctx.map.zoneById(this.homeZoneId) : undefined
    const rect = zone?.rect ?? { x: 0, y: 0, w: ctx.map.width, h: ctx.map.height }
    const target = randomWalkableIn(ctx.map, rect, ctx.rng)
    if (target) character.walkTo(ctx.map, target, { occupied: ctx.occupied })
  }
}

/**
 * Pet brain.
 *
 * Pets orbit their owner, nap on the nearest pet bed, and otherwise mill about.
 * They are pure decoration and never report anything to the host, which is the
 * point: they add life without adding meaning that has to be kept accurate.
 */
export class PetBrain implements Brain {
  private cooldown = 0
  private queue: Directive[] = []

  constructor(public ownerId?: string) {}

  push(directive: Directive): void {
    this.queue.push(directive)
  }

  update(character: Character, ctx: BrainContext, dt: number): void {
    this.cooldown -= dt

    const directive = this.queue.shift()
    if (directive?.type === "goToTile") character.walkTo(ctx.map, directive.tile, { occupied: ctx.occupied })
    if (directive?.type === "emote") character.say(directive.text, ctx.now, "emote", directive.seconds ?? 2)

    if (character.moving) return

    const owner = this.ownerId ? ctx.characters.get(this.ownerId) : undefined
    if (owner) {
      const distance = character.tileDistanceTo(owner)
      if (distance > 4) {
        character.seatedAt = undefined
        character.walkTo(ctx.map, owner.tile, { adjacent: true, occupied: ctx.occupied })
        return
      }
      if (distance > 2 && ctx.rng.bool(0.3)) {
        character.walkTo(ctx.map, owner.tile, { adjacent: true, occupied: ctx.occupied })
        return
      }
    }

    if (this.cooldown > 0) return
    this.cooldown = ctx.rng.int(2, 8)

    // Nap on a bed when one is nearby, otherwise pick a spot and trot to it.
    if (ctx.rng.bool(0.25)) {
      const bed = ctx.map.data.objects.find(
        (object) => object.kind === "pet-bed" || object.kind === "pet-bowl",
      )
      if (bed) {
        const arrived = character.tile.x === bed.x && character.tile.y === bed.y
        if (arrived) {
          character.seatedAt = bed.id
          return
        }
        character.walkTo(ctx.map, { x: bed.x, y: bed.y }, { occupied: ctx.occupied })
        return
      }
    }

    character.seatedAt = undefined
    const target = randomWalkableIn(
      ctx.map,
      { x: character.tile.x - 5, y: character.tile.y - 5, w: 11, h: 11 },
      ctx.rng,
    )
    if (target) character.walkTo(ctx.map, target, { occupied: ctx.occupied })
  }
}
