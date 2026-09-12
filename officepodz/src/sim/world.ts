import { styleFromSeed } from "../art/avatar.js"
import { FURNITURE } from "../art/furniture.js"
import { Loop } from "../core/clock.js"
import { Emitter } from "../core/events.js"
import { Rng } from "../core/rng.js"
import {
  TILE_SIZE,
  type Direction,
  type EntityId,
  type Vec2,
  type ZoneId,
} from "../core/types.js"
import { AgentBrain, PetBrain, type Brain, type BrainContext, type Directive } from "../entities/brain.js"
import { Character } from "../entities/entity.js"
import { Controls } from "../input/controls.js"
import type { ActivitySignal, OccupantRecord, WorkOSAdapter, WorldSignal } from "../integration/adapter.js"
import type { NetMessage, Transport } from "../net/protocol.js"
import { Renderer, type RenderOptions } from "../render/renderer.js"
import { generateOffice } from "../world/generator.js"
import { Tilemap } from "../world/tilemap.js"
import type { WorldData } from "../world/types.js"

/**
 * The façade.
 *
 * One class to construct, one canvas to hand it, one adapter to wire it to the
 * host. Everything underneath stays addressable for teams that want to swap a
 * renderer or drive the simulation from their own loop.
 */

export type OfficePodzEvents = {
  ready: { map: Tilemap }
  "zone-changed": { characterId: EntityId; zoneId: ZoneId | null; previous: ZoneId | null }
  interact: { characterId: EntityId; objectId: string; interaction: string }
  spoke: { characterId: EntityId; text: string }
  "occupants-changed": { count: number }
}

export interface OfficePodzOptions {
  canvas: HTMLCanvasElement
  /** Supply a saved world, or let the generator build one from the seed. */
  world?: WorldData
  seed?: string
  adapter?: WorkOSAdapter
  transport?: Transport
  render?: RenderOptions
  /** Autoplay the simulation loop. Off if you drive update() yourself. */
  autoStart?: boolean
}

export class OfficePodz {
  readonly map: Tilemap
  readonly renderer: Renderer
  readonly events = new Emitter<OfficePodzEvents>()
  readonly characters = new Map<EntityId, Character>()

  private brains = new Map<EntityId, Brain>()
  private zoneOf = new Map<EntityId, ZoneId | null>()
  private controls?: Controls
  private loop: Loop
  private rng: Rng
  private now = 0
  private viewerId: EntityId = "viewer"
  private detachers: (() => void)[] = []
  private steer: Direction | null = null
  private freeDesks: string[] = []

  constructor(private readonly options: OfficePodzOptions) {
    const data = options.world ?? generateOffice({ seed: options.seed ?? "officepodz" })
    this.map = new Tilemap(data)
    this.rng = new Rng(data.seed)
    this.renderer = new Renderer(options.canvas, this.map, options.render ?? {})
    this.renderer.camera.zoom = this.renderer.camera.coverZoom()
    this.renderer.camera.jumpTo({
      x: data.spawn.x * TILE_SIZE,
      y: data.spawn.y * TILE_SIZE,
    })
    this.freeDesks = this.map.data.objects
      .filter((object) => object.kind === "desk" && !object.ownerId)
      .map((object) => object.id)

    this.loop = new Loop({
      update: (dt) => this.update(dt),
      render: (_alpha, elapsed) => this.draw(elapsed),
    })
  }

  /** Connect to the host, spawn everyone, and start the loop. */
  async start(): Promise<void> {
    const adapter = this.options.adapter
    if (adapter) {
      const viewer = await adapter.getViewer()
      this.viewerId = viewer.id
      const occupants = await adapter.listOccupants()
      for (const occupant of occupants) this.addOccupant(occupant)

      this.detachers.push(
        adapter.subscribeOccupants((roster) => this.syncOccupants(roster)),
        adapter.subscribeActivity((signal) => this.applyActivity(signal)),
      )
    } else {
      this.addOccupant({ id: "viewer", name: "You", kind: "human", presence: "online" })
    }

    if (this.options.transport) {
      this.detachers.push(this.options.transport.onMessage((message) => this.applyNet(message)))
      const viewer = this.characters.get(this.viewerId)
      if (viewer) {
        this.options.transport.send({
          t: "join",
          occupant: this.toRecord(viewer),
          tile: viewer.tile,
        })
      }
    }

    this.attachControls()
    this.events.emit("ready", { map: this.map })
    if (this.options.autoStart !== false) this.loop.start()
  }

  stop(): void {
    this.loop.stop()
  }

  dispose(): void {
    this.loop.stop()
    this.controls?.dispose()
    for (const detach of this.detachers) detach()
    this.detachers = []
    this.options.transport?.close()
    this.events.clear()
    this.characters.clear()
    this.brains.clear()
  }

  get viewer(): Character | undefined {
    return this.characters.get(this.viewerId)
  }

  // ---------------------------------------------------------------- occupants

  /** Add or update someone in the world. Safe to call repeatedly. */
  addOccupant(record: OccupantRecord): Character {
    const existing = this.characters.get(record.id)
    if (existing) {
      existing.name = record.name
      existing.presence = record.presence
      if (record.role) existing.role = record.role
      return existing
    }

    const spawn = this.spawnTileFor(record)
    const character = new Character({
      id: record.id,
      name: record.name,
      kind: record.kind,
      role: record.role ?? "",
      tile: spawn,
      presence: record.presence,
      style: record.style ?? (record.kind === "pet" ? undefined : styleFromSeed(record.id, record.kind === "agent" ? "agent" : "human")),
      petKind: record.petKind,
      ownerId: record.ownerId,
      speed: record.kind === "pet" ? 60 : 52,
    })
    this.characters.set(record.id, character)

    if (record.kind === "agent") {
      const deskId = record.deskId ?? this.claimDesk(record.id)
      this.brains.set(record.id, new AgentBrain(deskId, record.zoneId))
    } else if (record.kind === "pet") {
      this.brains.set(record.id, new PetBrain(record.ownerId))
    }

    this.zoneOf.set(record.id, this.map.zoneAt(spawn.x, spawn.y)?.id ?? null)
    this.events.emit("occupants-changed", { count: this.characters.size })
    return character
  }

  removeOccupant(id: EntityId): void {
    this.characters.delete(id)
    this.brains.delete(id)
    this.zoneOf.delete(id)
    this.events.emit("occupants-changed", { count: this.characters.size })
  }

  private syncOccupants(roster: OccupantRecord[]): void {
    const seen = new Set<EntityId>()
    for (const record of roster) {
      seen.add(record.id)
      this.addOccupant(record)
    }
    for (const id of [...this.characters.keys()]) {
      if (!seen.has(id) && id !== this.viewerId) this.removeOccupant(id)
    }
  }

  private claimDesk(ownerId: string): string | undefined {
    const deskId = this.freeDesks.shift()
    if (!deskId) return undefined
    const desk = this.map.getObject(deskId)
    if (desk) desk.ownerId = ownerId
    return deskId
  }

  private spawnTileFor(record: OccupantRecord): Vec2 {
    if (record.zoneId) {
      const zone = this.map.zoneById(record.zoneId)
      if (zone) {
        const tile = this.map.nearestWalkable(
          zone.rect.x + Math.floor(zone.rect.w / 2),
          zone.rect.y + Math.floor(zone.rect.h / 2),
        )
        if (tile) return tile
      }
    }
    const spawn = this.map.data.spawn
    const jitterX = spawn.x + this.rng.int(-3, 3)
    const jitterY = spawn.y + this.rng.int(-1, 1)
    return this.map.nearestWalkable(jitterX, jitterY) ?? spawn
  }

  private toRecord(character: Character): OccupantRecord {
    const record: OccupantRecord = {
      id: character.id,
      name: character.name,
      kind: character.kind,
      presence: character.presence,
    }
    if (character.role) record.role = character.role
    if (character.style) record.style = character.style
    if (character.petKind) record.petKind = character.petKind
    if (character.ownerId) record.ownerId = character.ownerId
    return record
  }

  // ----------------------------------------------------------------- commands

  /** Send a behaviour directive to an agent or pet. */
  direct(id: EntityId, directive: Directive): void {
    this.brains.get(id)?.push(directive)
  }

  say(id: EntityId, text: string): void {
    const character = this.characters.get(id)
    if (!character) return
    character.say(text, this.now, "say")
    this.events.emit("spoke", { characterId: id, text })
    this.report({
      kind: "spoke",
      occupantId: id,
      text,
      ...(this.zoneOf.get(id) ? { zoneId: this.zoneOf.get(id) as ZoneId } : {}),
    })
    this.options.transport?.send({ t: "say", id, text })
  }

  walkTo(id: EntityId, tile: Vec2): void {
    const character = this.characters.get(id)
    if (!character) return
    character.walkTo(this.map, tile, { occupied: this.occupiedTiles(id) })
    if (id === this.viewerId) this.options.transport?.send({ t: "goto", id, tile })
  }

  /** Centre the camera on someone and keep it there. */
  focus(id: EntityId): void {
    const character = this.characters.get(id)
    if (character) this.renderer.camera.jumpTo(character.pos)
  }

  resize(): void {
    this.renderer.resize()
    this.renderer.camera.zoom = this.renderer.camera.coverZoom()
    this.renderer.camera.clamp()
  }

  private applyActivity(signal: ActivitySignal): void {
    const character = this.characters.get(signal.occupantId)
    if (!character) return
    switch (signal.kind) {
      case "say":
        character.say(signal.text, this.now, "say")
        break
      case "status":
        character.say(signal.text, this.now, "status", 12)
        break
      case "emote":
        character.say(signal.text, this.now, "emote", 3)
        break
      case "presence":
        character.presence = signal.presence
        break
      case "summon":
        this.direct(signal.occupantId, { type: "goToZone", zoneId: signal.zoneId })
        break
      case "sit":
        this.direct(signal.occupantId, {
          type: "sitAtDesk",
          ...(signal.deskId ? { objectId: signal.deskId } : {}),
        })
        break
      case "roam":
        this.direct(signal.occupantId, { type: "wander" })
        break
    }
  }

  private applyNet(message: NetMessage): void {
    switch (message.t) {
      case "join":
        if (message.occupant.id !== this.viewerId) {
          const character = this.addOccupant(message.occupant)
          character.teleport(message.tile)
        }
        break
      case "leave":
        if (message.id !== this.viewerId) this.removeOccupant(message.id)
        break
      case "goto":
        if (message.id !== this.viewerId) this.walkTo(message.id, message.tile)
        break
      case "place": {
        const character = this.characters.get(message.id)
        if (character && message.id !== this.viewerId) {
          character.teleport(message.tile)
          character.face(message.dir)
        }
        break
      }
      case "say": {
        const character = this.characters.get(message.id)
        if (character && message.id !== this.viewerId) character.say(message.text, this.now, "say")
        break
      }
      case "presence": {
        const character = this.characters.get(message.id)
        if (character) character.presence = message.presence
        break
      }
      case "object-added":
        this.map.addObject(message.object)
        break
      case "object-removed":
        this.map.removeObject(message.objectId)
        break
      default:
        break
    }
  }

  private report(signal: WorldSignal): void {
    this.options.adapter?.report(signal)
  }

  // -------------------------------------------------------------------- loop

  private attachControls(): void {
    this.controls = new Controls(this.options.canvas, this.renderer.camera, {
      onSteer: (direction) => {
        this.steer = direction
      },
      onTileTap: (tile) => {
        if (!this.map.walkable(tile.x, tile.y)) {
          const object = this.map.objectAt(tile.x, tile.y)
          if (object) this.tryInteract(object.id)
          return
        }
        this.walkTo(this.viewerId, tile)
      },
      onInteract: () => this.interactNearby(),
      onZoom: (delta) => {
        const camera = this.renderer.camera
        camera.zoom = Math.max(1, Math.min(8, camera.zoom + delta))
        camera.clamp()
      },
    })
  }

  private interactNearby(): void {
    const viewer = this.viewer
    if (!viewer) return
    const tile = viewer.tile
    const candidates: Vec2[] = [
      tile,
      { x: tile.x, y: tile.y - 1 },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x + 1, y: tile.y },
    ]
    for (const candidate of candidates) {
      const object = this.map.objectAt(candidate.x, candidate.y)
      if (object && FURNITURE[object.kind].interaction !== "none") {
        this.tryInteract(object.id)
        return
      }
    }
  }

  private tryInteract(objectId: string): void {
    const viewer = this.viewer
    const object = this.map.getObject(objectId)
    if (!viewer || !object) return
    const def = FURNITURE[object.kind]
    if (def.interaction === "none") return

    // Sitting toggles: tap your chair to sit, tap again to stand.
    if (def.seats.length > 0) {
      if (viewer.seatedAt === objectId) {
        viewer.seatedAt = undefined
      } else {
        const seat = def.seats[0]
        const target = { x: object.x + seat.dx, y: object.y + seat.dy }
        if (viewer.tile.x === target.x && viewer.tile.y === target.y) {
          viewer.seatedAt = objectId
          viewer.face(seat.facing)
        } else {
          viewer.walkTo(this.map, target, { occupied: this.occupiedTiles(viewer.id) })
        }
      }
    }

    this.events.emit("interact", { characterId: viewer.id, objectId, interaction: def.interaction })
    this.report({ kind: "interacted", occupantId: viewer.id, objectId, interaction: def.interaction })
  }

  private occupiedTiles(exceptId?: EntityId): Set<number> {
    const set = new Set<number>()
    for (const character of this.characters.values()) {
      if (character.id === exceptId || character.moving) continue
      const tile = character.tile
      set.add(tile.y * this.map.width + tile.x)
    }
    return set
  }

  /** Advance the simulation. Public so hosts can drive their own loop. */
  update(dt: number): void {
    this.now += dt
    const occupied = this.occupiedTiles()
    const context: BrainContext = {
      map: this.map,
      now: this.now,
      rng: this.rng,
      characters: this.characters,
      occupied,
      emit: () => {},
    }

    const viewer = this.viewer
    if (viewer && this.steer && !viewer.moving) {
      const tile = viewer.tile
      const delta =
        this.steer === "north"
          ? { x: 0, y: -1 }
          : this.steer === "south"
            ? { x: 0, y: 1 }
            : this.steer === "east"
              ? { x: 1, y: 0 }
              : { x: -1, y: 0 }
      const target = { x: tile.x + delta.x, y: tile.y + delta.y }
      viewer.face(this.steer)
      if (this.map.walkable(target.x, target.y)) {
        viewer.seatedAt = undefined
        viewer.walkTo(this.map, target)
      }
    }

    for (const character of this.characters.values()) {
      this.brains.get(character.id)?.update(character, context, dt)
      character.update(dt, this.now)
      this.trackZone(character)
    }

    if (viewer) this.renderer.camera.follow(viewer.pos, dt)
  }

  private trackZone(character: Character): void {
    const tile = character.tile
    const zone = this.map.zoneAt(tile.x, tile.y)
    const next = zone?.id ?? null
    const previous = this.zoneOf.get(character.id) ?? null
    if (next === previous) return
    this.zoneOf.set(character.id, next)

    if (previous) {
      const previousZone = this.map.zoneById(previous)
      this.report({
        kind: "left-zone",
        occupantId: character.id,
        zoneId: previous,
        ...(previousZone?.binding ? { binding: previousZone.binding } : {}),
      })
    }
    if (next && zone) {
      this.report({
        kind: "entered-zone",
        occupantId: character.id,
        zoneId: next,
        ...(zone.binding ? { binding: zone.binding } : {}),
      })
    }
    this.events.emit("zone-changed", { characterId: character.id, zoneId: next, previous })
  }

  private draw(elapsed: number): void {
    this.renderer.render(this.characters.values(), this.viewerId, elapsed)
  }
}
