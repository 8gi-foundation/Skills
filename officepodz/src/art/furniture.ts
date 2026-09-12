import { Rng } from "../core/rng.js"
import { TILE_SIZE, type Direction } from "../core/types.js"
import { PixelBuffer } from "../pixel/canvas.js"
import { BASE_PALETTE, C } from "../pixel/palette.js"
import type { PixelSprite } from "../pixel/sprite.js"

/**
 * The furniture catalogue.
 *
 * Every item declares a tile footprint, whether it blocks movement, where an
 * avatar can sit, and what interaction it exposes to the host application. The
 * art is drawn with PixelBuffer primitives so a whole office can be re-themed
 * by changing palette indices instead of redrawing sprites.
 */

export type FurnitureKind =
  | "desk"
  | "chair"
  | "meeting-table"
  | "sofa"
  | "armchair"
  | "coffee-table"
  | "plant-small"
  | "plant-tall"
  | "bookshelf"
  | "whiteboard"
  | "server-rack"
  | "water-cooler"
  | "coffee-machine"
  | "fridge"
  | "rug"
  | "floor-lamp"
  | "pet-bed"
  | "pet-bowl"
  | "arcade"
  | "door"
  | "window"

/** What the host is told about when an avatar uses the object. */
export type InteractionKind =
  | "none"
  | "workstation"
  | "meeting"
  | "lounge"
  | "refreshment"
  | "presentation"
  | "infrastructure"
  | "play"
  | "petrest"
  | "passage"

export interface Seat {
  /** Offset from the object origin tile. */
  dx: number
  dy: number
  facing: Direction
}

export interface FurnitureDef {
  kind: FurnitureKind
  label: string
  /** Footprint in tiles. */
  w: number
  h: number
  /** Blocks pathfinding. Rugs and windows do not. */
  solid: boolean
  /** Sprite size in pixels. Taller than the footprint means it rises up the wall. */
  spriteW: number
  spriteH: number
  interaction: InteractionKind
  seats: Seat[]
  draw: (buffer: PixelBuffer, rng: Rng) => void
}

function define(def: FurnitureDef): FurnitureDef {
  return def
}

function tabletop(buffer: PixelBuffer, x: number, y: number, w: number, h: number): void {
  buffer.fillRect(x, y, w, h, C.woodLight)
  buffer.hLine(x, y, w, C.sand)
  buffer.hLine(x, y + h - 1, w, C.woodDark)
  buffer.strokeRect(x, y, w, h, C.woodDark)
}

function legs(buffer: PixelBuffer, x: number, y: number, w: number, height: number): void {
  buffer.fillRect(x + 1, y, 2, height, C.woodDark)
  buffer.fillRect(x + w - 3, y, 2, height, C.woodDark)
}

function monitor(buffer: PixelBuffer, x: number, y: number, on: boolean): void {
  buffer.fillRect(x, y, 10, 7, C.charcoal)
  buffer.fillRect(x + 1, y + 1, 8, 5, on ? C.blueDark : C.greyDark)
  if (on) {
    buffer.hLine(x + 2, y + 2, 6, C.blueLight)
    buffer.hLine(x + 2, y + 4, 4, C.cyan)
  }
  buffer.fillRect(x + 4, y + 7, 2, 2, C.greyDark)
  buffer.hLine(x + 3, y + 9, 4, C.greyDark)
}

function foliage(buffer: PixelBuffer, cx: number, cy: number, radius: number, rng: Rng): void {
  buffer.ellipse(cx, cy, radius, radius - 1, C.leaf)
  for (let i = 0; i < radius * 5; i++) {
    const x = cx + rng.int(-radius, radius)
    const y = cy + rng.int(-radius + 1, radius - 1)
    if (buffer.get(x, y) === C.leaf) buffer.set(x, y, rng.bool(0.5) ? C.leafDark : C.leafLight)
  }
}

function pot(buffer: PixelBuffer, x: number, y: number, w: number, h: number): void {
  buffer.fillRect(x, y, w, h, C.amberDark)
  buffer.hLine(x, y, w, C.amber)
  buffer.strokeRect(x, y, w, h, C.ink)
}

export const FURNITURE: Record<FurnitureKind, FurnitureDef> = {
  desk: define({
    kind: "desk",
    label: "Desk",
    w: 2,
    h: 1,
    solid: true,
    spriteW: 32,
    spriteH: 26,
    interaction: "workstation",
    seats: [{ dx: 0, dy: 1, facing: "north" }],
    draw: (buffer, rng) => {
      monitor(buffer, 4, 0, true)
      // Laptop, mug and a small stack of paper give every desk a used feel.
      buffer.fillRect(18, 6, 9, 4, C.silver)
      buffer.hLine(18, 6, 9, C.white)
      buffer.fillRect(19, 10, 7, 1, C.greyDark)
      tabletop(buffer, 0, 11, 32, 6)
      buffer.fillRect(26, 8, 3, 3, rng.bool() ? C.red : C.green)
      legs(buffer, 0, 17, 32, 9)
      buffer.contactShadow(16, 25, 13, C.shadow)
    },
  }),
  chair: define({
    kind: "chair",
    label: "Task chair",
    w: 1,
    h: 1,
    solid: false,
    spriteW: 16,
    spriteH: 20,
    interaction: "workstation",
    seats: [{ dx: 0, dy: 0, facing: "north" }],
    draw: (buffer) => {
      buffer.panel(4, 0, 8, 9, C.charcoal, C.greyDark, C.ink, C.ink)
      buffer.fillRect(3, 9, 10, 4, C.greyDark)
      buffer.hLine(3, 9, 10, C.grey)
      buffer.vLine(7, 13, 4, C.ink)
      buffer.vLine(8, 13, 4, C.ink)
      buffer.hLine(3, 17, 10, C.ink)
      buffer.set(3, 18, C.ink)
      buffer.set(12, 18, C.ink)
      buffer.contactShadow(8, 19, 6, C.shadow)
    },
  }),
  "meeting-table": define({
    kind: "meeting-table",
    label: "Meeting table",
    w: 3,
    h: 2,
    solid: true,
    spriteW: 48,
    spriteH: 38,
    interaction: "meeting",
    seats: [
      { dx: 0, dy: -1, facing: "south" },
      { dx: 1, dy: -1, facing: "south" },
      { dx: 2, dy: -1, facing: "south" },
      { dx: 0, dy: 2, facing: "north" },
      { dx: 1, dy: 2, facing: "north" },
      { dx: 2, dy: 2, facing: "north" },
    ],
    draw: (buffer) => {
      tabletop(buffer, 2, 6, 44, 20)
      buffer.ellipse(24, 16, 18, 7, C.wood)
      buffer.ellipse(24, 15, 17, 6, C.woodLight)
      buffer.strokeRect(2, 6, 44, 20, 0)
      legs(buffer, 6, 26, 12, 10)
      legs(buffer, 30, 26, 12, 10)
      // Speaker puck in the middle, the universal sign of a booked room.
      buffer.ellipse(24, 15, 3, 2, C.charcoal)
      buffer.set(24, 14, C.cyan)
      buffer.contactShadow(24, 37, 20, C.shadow)
    },
  }),
  sofa: define({
    kind: "sofa",
    label: "Sofa",
    w: 2,
    h: 1,
    solid: true,
    spriteW: 32,
    spriteH: 22,
    interaction: "lounge",
    seats: [
      { dx: 0, dy: 1, facing: "north" },
      { dx: 1, dy: 1, facing: "north" },
    ],
    draw: (buffer) => {
      buffer.panel(0, 2, 32, 10, C.green, C.greenLight, C.greenDark, C.ink)
      buffer.panel(0, 9, 7, 10, C.green, C.greenLight, C.greenDark, C.ink)
      buffer.panel(25, 9, 7, 10, C.green, C.greenLight, C.greenDark, C.ink)
      buffer.fillRect(7, 11, 18, 7, C.greenDark)
      buffer.hLine(7, 11, 18, C.greenLight)
      buffer.vLine(16, 12, 6, C.ink)
      buffer.contactShadow(16, 21, 14, C.shadow)
    },
  }),
  armchair: define({
    kind: "armchair",
    label: "Armchair",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 20,
    interaction: "lounge",
    seats: [{ dx: 0, dy: 1, facing: "north" }],
    draw: (buffer) => {
      buffer.panel(1, 1, 14, 9, C.amber, C.amberLight, C.amberDark, C.ink)
      buffer.panel(0, 8, 5, 9, C.amber, C.amberLight, C.amberDark, C.ink)
      buffer.panel(11, 8, 5, 9, C.amber, C.amberLight, C.amberDark, C.ink)
      buffer.fillRect(5, 10, 6, 6, C.amberDark)
      buffer.contactShadow(8, 19, 7, C.shadow)
    },
  }),
  "coffee-table": define({
    kind: "coffee-table",
    label: "Coffee table",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 16,
    interaction: "lounge",
    seats: [],
    draw: (buffer, rng) => {
      tabletop(buffer, 1, 4, 14, 5)
      legs(buffer, 1, 9, 14, 5)
      buffer.fillRect(4, 2, 5, 2, rng.bool() ? C.blue : C.red)
      buffer.contactShadow(8, 15, 6, C.shadow)
    },
  }),
  "plant-small": define({
    kind: "plant-small",
    label: "Desk plant",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 18,
    interaction: "none",
    seats: [],
    draw: (buffer, rng) => {
      foliage(buffer, 8, 6, 5, rng)
      pot(buffer, 5, 11, 6, 6)
      buffer.contactShadow(8, 17, 5, C.shadow)
    },
  }),
  "plant-tall": define({
    kind: "plant-tall",
    label: "Ficus",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 30,
    interaction: "none",
    seats: [],
    draw: (buffer, rng) => {
      foliage(buffer, 8, 8, 7, rng)
      foliage(buffer, 4, 14, 4, rng)
      foliage(buffer, 12, 15, 4, rng)
      buffer.vLine(8, 14, 9, C.woodDark)
      pot(buffer, 4, 22, 8, 7)
      buffer.contactShadow(8, 29, 6, C.shadow)
    },
  }),
  bookshelf: define({
    kind: "bookshelf",
    label: "Bookshelf",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 32,
    interaction: "none",
    seats: [],
    draw: (buffer, rng) => {
      buffer.fillRect(0, 0, 16, 31, C.woodDark)
      buffer.strokeRect(0, 0, 16, 31, C.ink)
      const spines = [C.red, C.blue, C.green, C.amber, C.teal, C.cyan, C.silver]
      for (const shelfY of [2, 11, 20]) {
        buffer.fillRect(2, shelfY, 12, 7, C.wood)
        let x = 2
        while (x < 13) {
          const width = rng.int(1, 2)
          const height = rng.int(4, 6)
          buffer.fillRect(x, shelfY + 7 - height, width, height, rng.pick(spines))
          x += width + (rng.bool(0.25) ? 1 : 0)
        }
        buffer.hLine(2, shelfY + 7, 12, C.ink)
      }
      buffer.contactShadow(8, 31, 7, C.shadow)
    },
  }),
  whiteboard: define({
    kind: "whiteboard",
    label: "Whiteboard",
    w: 2,
    h: 1,
    solid: true,
    spriteW: 32,
    spriteH: 28,
    interaction: "presentation",
    seats: [],
    draw: (buffer, rng) => {
      buffer.fillRect(0, 0, 32, 20, C.white)
      buffer.strokeRect(0, 0, 32, 20, C.greyDark)
      // Scribbles: boxes and arrows, the native language of an office wall.
      for (let i = 0; i < 4; i++) {
        const x = rng.int(3, 20)
        const y = rng.int(3, 13)
        buffer.strokeRect(x, y, rng.int(4, 8), rng.int(3, 5), rng.pick([C.blue, C.red, C.green]))
      }
      buffer.hLine(6, 16, 14, C.charcoal)
      buffer.fillRect(2, 20, 28, 2, C.silver)
      buffer.vLine(6, 22, 6, C.greyDark)
      buffer.vLine(25, 22, 6, C.greyDark)
      buffer.contactShadow(16, 27, 12, C.shadow)
    },
  }),
  "server-rack": define({
    kind: "server-rack",
    label: "Server rack",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 30,
    interaction: "infrastructure",
    seats: [],
    draw: (buffer, rng) => {
      buffer.fillRect(0, 0, 16, 29, C.charcoal)
      buffer.strokeRect(0, 0, 16, 29, C.ink)
      for (let y = 2; y < 27; y += 4) {
        buffer.fillRect(2, y, 12, 3, C.greyDark)
        buffer.set(3, y + 1, rng.bool(0.7) ? C.green : C.amber)
        buffer.set(5, y + 1, rng.bool(0.5) ? C.cyan : C.greyDark)
        buffer.hLine(8, y + 1, 5, C.grey)
      }
      buffer.contactShadow(8, 29, 7, C.shadow)
    },
  }),
  "water-cooler": define({
    kind: "water-cooler",
    label: "Water cooler",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 24,
    interaction: "refreshment",
    seats: [],
    draw: (buffer) => {
      buffer.ellipse(8, 6, 5, 6, C.blueLight)
      buffer.ellipse(8, 5, 4, 5, C.cyan)
      buffer.strokeRect(3, 1, 11, 11, 0)
      buffer.fillRect(4, 11, 8, 12, C.silver)
      buffer.strokeRect(4, 11, 8, 12, C.greyDark)
      buffer.fillRect(6, 15, 4, 2, C.blue)
      buffer.contactShadow(8, 23, 6, C.shadow)
    },
  }),
  "coffee-machine": define({
    kind: "coffee-machine",
    label: "Coffee machine",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 22,
    interaction: "refreshment",
    seats: [],
    draw: (buffer) => {
      buffer.fillRect(2, 2, 12, 16, C.charcoal)
      buffer.strokeRect(2, 2, 12, 16, C.ink)
      buffer.fillRect(4, 4, 8, 4, C.greyDark)
      buffer.hLine(5, 5, 3, C.amberLight)
      buffer.fillRect(6, 11, 4, 4, C.white)
      buffer.set(6, 10, C.woodDark)
      buffer.fillRect(2, 18, 12, 3, C.greyDark)
      buffer.contactShadow(8, 21, 6, C.shadow)
    },
  }),
  fridge: define({
    kind: "fridge",
    label: "Fridge",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 28,
    interaction: "refreshment",
    seats: [],
    draw: (buffer) => {
      buffer.fillRect(0, 0, 16, 27, C.silver)
      buffer.strokeRect(0, 0, 16, 27, C.greyDark)
      buffer.hLine(1, 10, 14, C.greyDark)
      buffer.vLine(12, 4, 5, C.greyDark)
      buffer.vLine(12, 14, 8, C.greyDark)
      buffer.fillRect(3, 3, 5, 4, C.green)
      buffer.contactShadow(8, 27, 7, C.shadow)
    },
  }),
  rug: define({
    kind: "rug",
    label: "Rug",
    w: 2,
    h: 2,
    solid: false,
    spriteW: 32,
    spriteH: 32,
    interaction: "none",
    seats: [],
    draw: (buffer) => {
      buffer.fillRect(0, 0, 32, 32, C.teal)
      buffer.strokeRect(1, 1, 30, 30, C.cyan)
      buffer.strokeRect(4, 4, 24, 24, C.mint)
      buffer.dither(8, 8, 16, 16, C.cyan)
      for (let x = 0; x < 32; x += 3) {
        buffer.set(x, 0, C.mint)
        buffer.set(x, 31, C.mint)
      }
    },
  }),
  "floor-lamp": define({
    kind: "floor-lamp",
    label: "Floor lamp",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 30,
    interaction: "none",
    seats: [],
    draw: (buffer) => {
      buffer.fillRect(3, 1, 10, 7, C.amberLight)
      buffer.hLine(3, 1, 10, C.sand)
      buffer.strokeRect(3, 1, 10, 7, C.amberDark)
      buffer.vLine(8, 8, 18, C.grey)
      buffer.vLine(9, 8, 18, C.greyDark)
      buffer.ellipse(8, 27, 5, 2, C.charcoal)
      buffer.contactShadow(8, 29, 6, C.shadow)
    },
  }),
  "pet-bed": define({
    kind: "pet-bed",
    label: "Pet bed",
    w: 1,
    h: 1,
    solid: false,
    spriteW: 16,
    spriteH: 12,
    interaction: "petrest",
    seats: [],
    draw: (buffer) => {
      buffer.ellipse(8, 7, 7, 4, C.redDark)
      buffer.ellipse(8, 7, 5, 3, C.red)
      buffer.ellipse(8, 7, 4, 2, C.sand)
      buffer.hLine(5, 5, 6, C.amberLight)
    },
  }),
  "pet-bowl": define({
    kind: "pet-bowl",
    label: "Pet bowl",
    w: 1,
    h: 1,
    solid: false,
    spriteW: 16,
    spriteH: 10,
    interaction: "petrest",
    seats: [],
    draw: (buffer) => {
      buffer.ellipse(8, 6, 4, 3, C.blue)
      buffer.ellipse(8, 5, 3, 2, C.blueDark)
      buffer.ellipse(8, 5, 2, 1, C.amber)
    },
  }),
  arcade: define({
    kind: "arcade",
    label: "Arcade cabinet",
    w: 1,
    h: 1,
    solid: true,
    spriteW: 16,
    spriteH: 30,
    interaction: "play",
    seats: [],
    draw: (buffer, rng) => {
      buffer.fillRect(1, 0, 14, 28, C.redDark)
      buffer.strokeRect(1, 0, 14, 28, C.ink)
      buffer.fillRect(3, 3, 10, 9, C.charcoal)
      buffer.fillRect(4, 4, 8, 7, C.blueDark)
      for (let i = 0; i < 8; i++) {
        buffer.set(rng.int(4, 11), rng.int(4, 10), rng.pick([C.cyan, C.mint, C.amberLight]))
      }
      buffer.fillRect(3, 14, 10, 4, C.greyDark)
      buffer.set(5, 15, C.red)
      buffer.set(8, 15, C.amber)
      buffer.set(10, 15, C.green)
      buffer.fillRect(2, 19, 12, 8, C.red)
      buffer.contactShadow(8, 29, 7, C.shadow)
    },
  }),
  door: define({
    kind: "door",
    label: "Door",
    w: 1,
    h: 1,
    solid: false,
    spriteW: 16,
    spriteH: 16,
    interaction: "passage",
    seats: [],
    draw: (buffer) => {
      buffer.fillRect(0, 0, 16, 16, C.woodDark)
      buffer.fillRect(2, 2, 12, 14, C.wood)
      buffer.strokeRect(2, 2, 12, 14, C.ink)
      buffer.set(11, 9, C.amberLight)
      buffer.set(11, 10, C.amber)
    },
  }),
  window: define({
    kind: "window",
    label: "Window",
    w: 1,
    h: 1,
    solid: false,
    spriteW: 16,
    spriteH: 16,
    interaction: "none",
    seats: [],
    draw: (buffer) => {
      buffer.fillRect(1, 2, 14, 12, C.blueLight)
      buffer.strokeRect(1, 2, 14, 12, C.silver)
      buffer.vLine(8, 3, 10, C.silver)
      buffer.hLine(2, 8, 12, C.silver)
      for (let i = 0; i < 5; i++) buffer.set(3 + i, 11 - i, C.white)
    },
  }),
}

export const FURNITURE_KINDS = Object.keys(FURNITURE) as FurnitureKind[]

/** Bake one furniture sprite. Pass a seed to vary the scatter details. */
export function buildFurnitureSprite(kind: FurnitureKind, seed: string | number = 0): PixelSprite {
  const def = FURNITURE[kind]
  const buffer = new PixelBuffer(def.spriteW, def.spriteH)
  def.draw(buffer, new Rng(`${kind}:${seed}`))
  // The sprite bottom aligns with the bottom edge of the footprint.
  return buffer.toSprite(`furniture-${kind}`, BASE_PALETTE, def.spriteH - def.h * TILE_SIZE)
}

export function buildFurnitureSet(seed: string | number = 0): Record<FurnitureKind, PixelSprite> {
  const out = {} as Record<FurnitureKind, PixelSprite>
  for (const kind of FURNITURE_KINDS) out[kind] = buildFurnitureSprite(kind, seed)
  return out
}
