import { Rng, hashString } from "../core/rng.js"
import { AVATAR_HEIGHT, AVATAR_WIDTH, DIRECTIONS, type Direction } from "../core/types.js"
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, TROUSER_COLORS } from "../pixel/palette.js"
import type { PixelSprite } from "../pixel/sprite.js"

/**
 * Avatar art.
 *
 * Characters are 16x22 and hand authored, because a procedural face never quite
 * reads at this size. The templates below use twelve palette slots rather than
 * literal colours, so one set of pixels produces every person and agent in the
 * building:
 *
 *   0 transparent   1 outline      2 skin        3 skin shadow
 *   4 hair          5 hair shadow  6 shirt       7 shirt shadow
 *   8 trousers      9 shoes        a eye         b accent
 *
 * Rows 0-16 are the body, rows 17-21 come from a leg frame, which is how the
 * walk cycle and the seated pose are built without redrawing the torso.
 */

const SOUTH_BODY: readonly string[] = [
  "................",
  "....11111111....",
  "...1444444441...",
  "...1444444441...",
  "...1442222441...",
  "...1422222241...",
  "...12a2222a21...",
  "...1222222221...",
  "...1233333321...",
  "....11111111....",
  ".....122221.....",
  "..111111111111..",
  "..166666666661..",
  ".21666666666612.",
  ".21666bb6666612.",
  ".21666666666612.",
  "..177777777771..",
]

const NORTH_BODY: readonly string[] = [
  "................",
  "....11111111....",
  "...1444444441...",
  "...1444444441...",
  "...1444444441...",
  "...1444444441...",
  "...1444444441...",
  "...1444444441...",
  "...1455555541...",
  "....11111111....",
  ".....122221.....",
  "..111111111111..",
  "..166666666661..",
  ".21666666666612.",
  ".21666666666612.",
  ".21666666666612.",
  "..177777777771..",
]

const EAST_BODY: readonly string[] = [
  "................",
  "....11111111....",
  "...1444444441...",
  "...1444444441...",
  "...1442222221...",
  "...1442222221...",
  "...14422a2221...",
  "...1442222221...",
  "...1445233321...",
  "....11111111....",
  ".....122221.....",
  "...1111111111...",
  "...16666666612..",
  "...16666666612..",
  "...1666bb66612..",
  "...16666666612..",
  "...1777777771...",
]

/** Rows 17-21. Swapping these frames is the entire animation system. */
const LEG_FRAMES: Record<string, readonly string[]> = {
  stand: [
    "..188888888881..",
    "..188881188881..",
    "..188881188881..",
    "..199991199991..",
    "...1111..1111...",
  ],
  stepA: [
    "..188888888881..",
    "..188881188881..",
    "..188811888881..",
    "..199911999991..",
    "..1111...1111...",
  ],
  stepB: [
    "..188888888881..",
    "..188881188881..",
    "..188888118881..",
    "..199999119991..",
    "...1111...1111..",
  ],
  sit: [
    "..188888888881..",
    "..188888888881..",
    "..177777777771..",
    "..199999999991..",
    "...1111111111...",
  ],
}

const BODIES: Record<Direction, readonly string[]> = {
  south: SOUTH_BODY,
  north: NORTH_BODY,
  east: EAST_BODY,
  // West is East mirrored at bake time, so there is no fourth template to keep in sync.
  west: EAST_BODY,
}

export type HairStyle = "short" | "long" | "cap" | "bald"

export const HAIR_STYLES: readonly HairStyle[] = ["short", "long", "cap", "bald"]

export interface AvatarStyle {
  skin: number
  hair: number
  hairStyle: HairStyle
  outfit: number
  trousers: number
  /** Hex accent used for the badge, lanyard or cap. Agents get a brighter one. */
  accent: string
  /** Eye colour. Agents use cyan so you can read a synthetic at a glance. */
  eye: string
}

/** Derive a stable look from any string id. Same person, same desk, every load. */
export function styleFromSeed(seed: string, kind: "human" | "agent" = "human"): AvatarStyle {
  const rng = new Rng(hashString(seed))
  const agent = kind === "agent"
  return {
    skin: agent ? rng.int(0, SKIN_TONES.length - 1) : rng.int(0, SKIN_TONES.length - 1),
    hair: rng.int(0, HAIR_COLORS.length - 1),
    hairStyle: rng.pick(HAIR_STYLES),
    outfit: rng.int(0, OUTFIT_COLORS.length - 1),
    trousers: rng.int(0, TROUSER_COLORS.length - 1),
    accent: agent ? "#2bb3c4" : "#d9962a",
    eye: agent ? "#6fa8e6" : "#10140f",
  }
}

/** Resolve the twelve template slots into real colours. */
export function avatarPalette(style: AvatarStyle): string[] {
  const skin = SKIN_TONES[style.skin % SKIN_TONES.length]
  const hair = HAIR_COLORS[style.hair % HAIR_COLORS.length]
  const outfit = OUTFIT_COLORS[style.outfit % OUTFIT_COLORS.length]
  const trousers = TROUSER_COLORS[style.trousers % TROUSER_COLORS.length]
  return [
    "#00000000",
    "#10140f",
    skin[0],
    skin[1],
    hair[0],
    hair[1],
    outfit[0],
    outfit[1],
    trousers,
    "#24282a",
    style.eye,
    style.accent,
  ]
}

function remapRows(rows: string[], indexes: number[], from: string, to: string): void {
  for (const index of indexes) {
    if (index < 0 || index >= rows.length) continue
    rows[index] = rows[index].split(from).join(to)
  }
}

function applyHairStyle(rows: string[], style: HairStyle): void {
  switch (style) {
    case "cap":
      remapRows(rows, [1, 2, 3], "4", "b")
      remapRows(rows, [1, 2, 3], "5", "b")
      break
    case "bald":
      remapRows(rows, [2, 3, 4, 5], "4", "2")
      remapRows(rows, [2, 3, 4, 5], "5", "3")
      break
    case "long":
      // Let the hair fall past the jaw on both sides of the neck.
      for (const y of [9, 10]) {
        const chars = [...rows[y]]
        chars[3] = "4"
        chars[12] = "4"
        rows[y] = chars.join("")
      }
      break
    case "short":
    default:
      break
  }
}

export type AvatarPose = "stand" | "stepA" | "stepB" | "sit"

export const WALK_CYCLE: readonly AvatarPose[] = ["stand", "stepA", "stand", "stepB"]

export interface AvatarSpriteSet {
  /** Keyed `${direction}:${pose}`. */
  frames: Record<string, PixelSprite>
  palette: string[]
}

function mirror(rows: string[]): string[] {
  return rows.map((row) => [...row].reverse().join(""))
}

/**
 * Bake one character into 16 sprites: four directions times four poses.
 *
 * The result is pure data, so it can be cached, packed into an atlas, or
 * shipped to a worker.
 */
export function buildAvatarSprites(style: AvatarStyle, name: string): AvatarSpriteSet {
  const palette = avatarPalette(style)
  const frames: Record<string, PixelSprite> = {}

  for (const direction of DIRECTIONS) {
    const body = [...BODIES[direction]]
    applyHairStyle(body, style.hairStyle)
    for (const pose of ["stand", "stepA", "stepB", "sit"] as const) {
      let rows = [...body, ...LEG_FRAMES[pose]]
      if (direction === "west") rows = mirror(rows)
      frames[`${direction}:${pose}`] = {
        name: `${name}-${direction}-${pose}`,
        width: AVATAR_WIDTH,
        height: AVATAR_HEIGHT,
        palette,
        rows,
        originY: AVATAR_HEIGHT,
      }
    }
  }

  return { frames, palette }
}

/** Every template row, for the art validator. */
export function avatarTemplateRows(): { name: string; rows: readonly string[] }[] {
  return [
    { name: "body:south", rows: SOUTH_BODY },
    { name: "body:north", rows: NORTH_BODY },
    { name: "body:east", rows: EAST_BODY },
    ...Object.entries(LEG_FRAMES).map(([key, rows]) => ({ name: `legs:${key}`, rows })),
  ]
}
