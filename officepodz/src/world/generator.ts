import { FURNITURE, type FurnitureKind } from "../art/furniture.js"
import { TILE_ID, type TileKind } from "../art/tiles.js"
import { Rng } from "../core/rng.js"
import type { Rect } from "../core/types.js"
import { WORLD_FORMAT_VERSION, type PlacedObject, type WorldData, type ZoneData, type ZoneKind } from "./types.js"

/**
 * Procedural office generator.
 *
 * The building is two rows of rooms either side of a central corridor, which is
 * the shape almost every real office converges on and which keeps every room
 * one door away from the circulation route. Rooms share walls, so the plan
 * stays tight and the collision grid stays cheap.
 *
 * Everything is seeded. The same seed and the same room list always produce the
 * same office, so a host only needs to persist the seed plus whatever the team
 * moved by hand.
 */

export interface RoomSpec {
  name: string
  kind: ZoneKind
  binding?: string
  capacity?: number
}

export interface GenerateOptions {
  name?: string
  seed?: string
  /** Number of team pods. Amenity rooms are added on top of this. */
  pods?: number
  /** Room size in tiles, walls included. Odd numbers centre doors neatly. */
  roomWidth?: number
  roomHeight?: number
  corridorHeight?: number
  /** Supply your own room list to mirror a real floor plan. */
  rooms?: RoomSpec[]
}

const AMENITIES: RoomSpec[] = [
  { name: "Boardroom", kind: "meeting", capacity: 6 },
  { name: "Lounge", kind: "lounge", capacity: 8 },
  { name: "Kitchen", kind: "kitchen", capacity: 6 },
  { name: "Focus Room", kind: "focus", capacity: 2 },
  { name: "Server Room", kind: "server", capacity: 2 },
  { name: "Games Room", kind: "play", capacity: 6 },
]

const FLOOR_BY_KIND: Record<ZoneKind, TileKind> = {
  pod: "carpet-green",
  meeting: "carpet-blue",
  lounge: "wood",
  kitchen: "checker",
  focus: "carpet-grey",
  server: "concrete",
  play: "carpet-blue",
  corridor: "concrete",
  atrium: "grass",
}

const ACCENT_BY_KIND: Record<ZoneKind, string> = {
  pod: "#2d6f3d",
  meeting: "#2f6db5",
  lounge: "#d9962a",
  kitchen: "#2bb3c4",
  focus: "#5b655c",
  server: "#c0392b",
  play: "#46a05a",
  corridor: "#8a948b",
  atrium: "#3f8f3a",
}

const POD_NAMES = [
  "Sourcing",
  "Kitchen Ops",
  "Commerce",
  "Compliance",
  "Platform",
  "Design",
  "Growth",
  "Finance",
  "People",
  "Research",
]

class Builder {
  readonly floor: number[]
  readonly walls: number[]
  readonly zones: ZoneData[] = []
  readonly objects: PlacedObject[] = []
  private objectCount = 0

  constructor(
    readonly width: number,
    readonly height: number,
    readonly rng: Rng,
  ) {
    this.floor = new Array(width * height).fill(TILE_ID.void)
    this.walls = new Array(width * height).fill(0)
  }

  private at(x: number, y: number): number {
    return y * this.width + x
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  setFloor(x: number, y: number, tile: TileKind): void {
    if (this.inside(x, y)) this.floor[this.at(x, y)] = TILE_ID[tile]
  }

  setWall(x: number, y: number, tile: TileKind | 0): void {
    if (this.inside(x, y)) this.walls[this.at(x, y)] = tile === 0 ? 0 : TILE_ID[tile]
  }

  wallAt(x: number, y: number): number {
    return this.inside(x, y) ? this.walls[this.at(x, y)] : TILE_ID.void
  }

  fillFloor(rect: Rect, tile: TileKind): void {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) this.setFloor(x, y, tile)
    }
  }

  ring(rect: Rect, tile: TileKind): void {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      this.setWall(x, rect.y, tile)
      this.setWall(x, rect.y + rect.h - 1, tile)
    }
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      this.setWall(rect.x, y, tile)
      this.setWall(rect.x + rect.w - 1, y, tile)
    }
  }

  occupied(x: number, y: number, w: number, h: number): boolean {
    for (const object of this.objects) {
      const def = FURNITURE[object.kind]
      const overlap =
        x < object.x + def.w && x + w > object.x && y < object.y + def.h && y + h > object.y
      if (overlap) return true
    }
    return false
  }

  place(kind: FurnitureKind, x: number, y: number, zoneId?: string, ownerId?: string): PlacedObject | undefined {
    const def = FURNITURE[kind]
    if (!this.inside(x, y) || !this.inside(x + def.w - 1, y + def.h - 1)) return undefined
    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        if (this.wallAt(x + dx, y + dy) !== 0) return undefined
        if (this.floor[this.at(x + dx, y + dy)] === TILE_ID.void) return undefined
      }
    }
    if (this.occupied(x, y, def.w, def.h)) return undefined
    const object: PlacedObject = {
      id: `obj-${++this.objectCount}`,
      kind,
      x,
      y,
      seed: this.rng.int(0, 9999),
    }
    if (zoneId) object.zoneId = zoneId
    if (ownerId) object.ownerId = ownerId
    this.objects.push(object)
    return object
  }
}

function interiorOf(rect: Rect): Rect {
  return { x: rect.x + 1, y: rect.y + 1, w: rect.w - 2, h: rect.h - 2 }
}

function furnishPod(builder: Builder, zone: ZoneData): void {
  const room = interiorOf(zone.rect)
  // Desks in rows of two with a walking lane behind each row.
  for (let row = 0; row + 2 <= room.h; row += 3) {
    for (let col = 0; col + 2 <= room.w; col += 3) {
      const x = room.x + col
      const y = room.y + row
      const desk = builder.place("desk", x, y, zone.id)
      if (desk) builder.place("chair", x, y + 1, zone.id)
    }
  }
  builder.place("plant-tall", room.x + room.w - 1, room.y, zone.id)
  builder.place("bookshelf", room.x, room.y + room.h - 1, zone.id)
  if (builder.rng.bool(0.4)) builder.place("plant-small", room.x + room.w - 1, room.y + room.h - 1, zone.id)
}

function furnishMeeting(builder: Builder, zone: ZoneData): void {
  const room = interiorOf(zone.rect)
  const tx = room.x + Math.max(0, Math.floor((room.w - 3) / 2))
  const ty = room.y + Math.max(1, Math.floor((room.h - 2) / 2))
  builder.place("meeting-table", tx, ty, zone.id)
  builder.place("whiteboard", room.x + 1, room.y, zone.id)
  builder.place("plant-small", room.x, room.y + room.h - 1, zone.id)
}

function furnishLounge(builder: Builder, zone: ZoneData): void {
  const room = interiorOf(zone.rect)
  builder.place("rug", room.x + 1, room.y + 1, zone.id)
  builder.place("sofa", room.x + 1, room.y, zone.id)
  builder.place("armchair", room.x, room.y + 2, zone.id)
  builder.place("armchair", room.x + 3, room.y + 2, zone.id)
  builder.place("coffee-table", room.x + 2, room.y + 2, zone.id)
  builder.place("plant-tall", room.x + room.w - 1, room.y, zone.id)
  builder.place("floor-lamp", room.x + room.w - 1, room.y + room.h - 1, zone.id)
  builder.place("pet-bed", room.x, room.y + room.h - 1, zone.id)
}

function furnishKitchen(builder: Builder, zone: ZoneData): void {
  const room = interiorOf(zone.rect)
  builder.place("fridge", room.x, room.y, zone.id)
  builder.place("coffee-machine", room.x + 1, room.y, zone.id)
  builder.place("water-cooler", room.x + 2, room.y, zone.id)
  builder.place("meeting-table", room.x + 1, room.y + 2, zone.id)
  builder.place("pet-bowl", room.x + room.w - 1, room.y + room.h - 1, zone.id)
}

function furnishFocus(builder: Builder, zone: ZoneData): void {
  const room = interiorOf(zone.rect)
  builder.place("desk", room.x, room.y, zone.id)
  builder.place("chair", room.x, room.y + 1, zone.id)
  builder.place("bookshelf", room.x + room.w - 1, room.y, zone.id)
  builder.place("plant-small", room.x + room.w - 1, room.y + room.h - 1, zone.id)
}

function furnishServer(builder: Builder, zone: ZoneData): void {
  const room = interiorOf(zone.rect)
  for (let x = room.x; x < room.x + room.w; x += 2) builder.place("server-rack", x, room.y, zone.id)
  builder.place("desk", room.x, room.y + room.h - 2, zone.id)
  builder.place("chair", room.x, room.y + room.h - 1, zone.id)
}

function furnishPlay(builder: Builder, zone: ZoneData): void {
  const room = interiorOf(zone.rect)
  builder.place("arcade", room.x, room.y, zone.id)
  builder.place("arcade", room.x + 1, room.y, zone.id)
  builder.place("rug", room.x + 1, room.y + 2, zone.id)
  builder.place("sofa", room.x + room.w - 2, room.y + 1, zone.id)
  builder.place("pet-bed", room.x + room.w - 1, room.y + room.h - 1, zone.id)
}

const FURNISHERS: Record<ZoneKind, (builder: Builder, zone: ZoneData) => void> = {
  pod: furnishPod,
  meeting: furnishMeeting,
  lounge: furnishLounge,
  kitchen: furnishKitchen,
  focus: furnishFocus,
  server: furnishServer,
  play: furnishPlay,
  corridor: () => {},
  atrium: () => {},
}

/** Build a complete, walkable, furnished office. */
export function generateOffice(options: GenerateOptions = {}): WorldData {
  const seed = options.seed ?? "officepodz"
  const rng = new Rng(seed)
  const roomWidth = options.roomWidth ?? 11
  const roomHeight = options.roomHeight ?? 8
  const corridorHeight = options.corridorHeight ?? 3

  const rooms: RoomSpec[] =
    options.rooms ??
    [
      ...Array.from<unknown, RoomSpec>({ length: options.pods ?? 4 }, (_, i) => ({
        name: POD_NAMES[i % POD_NAMES.length],
        kind: "pod",
        capacity: 6,
      })),
      ...AMENITIES,
    ]

  const columns = Math.ceil(rooms.length / 2)
  const width = (columns - 1) * (roomWidth - 1) + roomWidth
  const height = roomHeight * 2 + corridorHeight
  const builder = new Builder(width, height, rng)

  // Corridor first, so room walls can punch doors into it.
  const corridor: Rect = { x: 0, y: roomHeight, w: width, h: corridorHeight }
  builder.fillFloor(corridor, FLOOR_BY_KIND.corridor)
  builder.ring({ x: 0, y: roomHeight - 1, w: width, h: corridorHeight + 2 }, "wall")
  for (let y = corridor.y; y < corridor.y + corridor.h; y++) {
    builder.setWall(0, y, "wall")
    builder.setWall(width - 1, y, "wall")
  }
  builder.zones.push({
    id: "zone-corridor",
    name: "Main Corridor",
    kind: "corridor",
    rect: corridor,
    accent: ACCENT_BY_KIND.corridor,
  })

  rooms.forEach((spec, index) => {
    const column = index % columns
    const bottomRow = index >= columns
    const rect: Rect = {
      x: column * (roomWidth - 1),
      y: bottomRow ? roomHeight + corridorHeight : 0,
      w: roomWidth,
      h: roomHeight,
    }

    builder.fillFloor(interiorOf(rect), FLOOR_BY_KIND[spec.kind])
    builder.ring(rect, spec.kind === "meeting" || spec.kind === "focus" ? "wall-glass" : "wall")

    const zone: ZoneData = {
      id: `zone-${index}-${spec.kind}`,
      name: spec.name,
      kind: spec.kind,
      rect,
      accent: ACCENT_BY_KIND[spec.kind],
    }
    if (spec.binding) zone.binding = spec.binding
    if (spec.capacity) zone.capacity = spec.capacity
    builder.zones.push(zone)

    // One door per room, centred on the corridor facing wall.
    const doorX = rect.x + Math.floor(rect.w / 2)
    const doorY = bottomRow ? rect.y : rect.y + rect.h - 1
    builder.setWall(doorX, doorY, 0)
    builder.setFloor(doorX, doorY, FLOOR_BY_KIND.corridor)

    FURNISHERS[spec.kind](builder, zone)
    builder.place("door", doorX, doorY, zone.id)
  })

  // Dress the corridor once rooms are in, so plants never block a doorway.
  for (let x = 2; x < width - 2; x += 6) {
    const y = corridor.y + (rng.bool() ? 0 : corridor.h - 1)
    if (builder.objects.every((object) => object.x !== x || object.y !== y)) {
      builder.place(rng.bool(0.6) ? "plant-tall" : "water-cooler", x, y, "zone-corridor")
    }
  }

  const spawn = {
    x: Math.floor(width / 2),
    y: corridor.y + Math.floor(corridor.h / 2),
  }

  return {
    version: WORLD_FORMAT_VERSION,
    name: options.name ?? "OfficePodz HQ",
    seed,
    width,
    height,
    floor: builder.floor,
    walls: builder.walls,
    zones: builder.zones,
    objects: builder.objects,
    spawn,
  }
}
