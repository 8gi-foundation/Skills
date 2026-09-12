import { Rng } from "../core/rng.js"
import { DIRECTIONS, type Direction } from "../core/types.js"
import { PixelBuffer } from "../pixel/canvas.js"
import { BASE_PALETTE, C } from "../pixel/palette.js"
import type { PixelSprite } from "../pixel/sprite.js"

/**
 * Office pets.
 *
 * Pets are 16x16 and drawn in profile, because at this resolution a profile
 * silhouette reads instantly while a front facing animal turns into a blob.
 * North and south reuse the profile with the head tucked, which is the same
 * trick every 16 bit game used.
 */

export type PetKind = "cat" | "dog" | "bird" | "robot" | "plantpal"

export const PET_KINDS: readonly PetKind[] = ["cat", "dog", "bird", "robot", "plantpal"]

export type PetPose = "stand" | "step" | "sleep"

export const PET_POSES: readonly PetPose[] = ["stand", "step", "sleep"]

interface PetPalette {
  body: number
  shade: number
  belly: number
  detail: number
  eye: number
}

const PET_COLORS: Record<PetKind, PetPalette[]> = {
  cat: [
    { body: C.charcoal, shade: C.ink, belly: C.grey, detail: C.white, eye: C.leafLight },
    { body: C.amber, shade: C.amberDark, belly: C.sand, detail: C.woodDark, eye: C.green },
    { body: C.silver, shade: C.grey, belly: C.white, detail: C.greyDark, eye: C.amber },
  ],
  dog: [
    { body: C.wood, shade: C.woodDark, belly: C.sand, detail: C.ink, eye: C.ink },
    { body: C.greyDark, shade: C.ink, belly: C.grey, detail: C.white, eye: C.ink },
    { body: C.sand, shade: C.woodLight, belly: C.white, detail: C.woodDark, eye: C.ink },
  ],
  bird: [
    { body: C.blue, shade: C.blueDark, belly: C.blueLight, detail: C.amber, eye: C.ink },
    { body: C.green, shade: C.greenDark, belly: C.mint, detail: C.amberLight, eye: C.ink },
  ],
  robot: [
    { body: C.silver, shade: C.grey, belly: C.white, detail: C.cyan, eye: C.cyan },
    { body: C.greyDark, shade: C.charcoal, belly: C.grey, detail: C.green, eye: C.greenLight },
  ],
  plantpal: [{ body: C.leaf, shade: C.leafDark, belly: C.leafLight, detail: C.amberDark, eye: C.ink }],
}

function drawCat(buffer: PixelBuffer, p: PetPalette, pose: PetPose): void {
  if (pose === "sleep") {
    buffer.ellipse(8, 11, 6, 3, p.body)
    buffer.ellipse(6, 10, 3, 2, p.body)
    buffer.hLine(3, 13, 10, p.shade)
    buffer.set(5, 10, p.detail)
    buffer.hLine(11, 9, 3, p.shade)
    return
  }
  const bob = pose === "step" ? 1 : 0
  buffer.ellipse(7, 9 + bob, 5, 3, p.body)
  buffer.ellipse(7, 10 + bob, 4, 2, p.belly)
  buffer.ellipse(7, 9 + bob, 5, 3, p.body)
  buffer.ellipse(12, 7 + bob, 3, 3, p.body)
  buffer.set(10, 4 + bob, p.body)
  buffer.set(11, 3 + bob, p.body)
  buffer.set(13, 4 + bob, p.body)
  buffer.set(14, 3 + bob, p.body)
  buffer.set(13, 7 + bob, p.eye)
  buffer.set(11, 7 + bob, p.eye)
  buffer.set(14, 8 + bob, p.detail)
  // Tail flicks between the two walk poses.
  if (pose === "step") {
    buffer.vLine(2, 5 + bob, 4, p.body)
    buffer.set(3, 5 + bob, p.body)
  } else {
    buffer.hLine(1, 8, 3, p.body)
    buffer.set(1, 7, p.body)
  }
  buffer.fillRect(4, 12 + bob, 2, 3, p.shade)
  buffer.fillRect(9, 12 + bob, 2, 3, p.shade)
}

function drawDog(buffer: PixelBuffer, p: PetPalette, pose: PetPose): void {
  if (pose === "sleep") {
    buffer.ellipse(8, 11, 6, 3, p.body)
    buffer.ellipse(12, 11, 3, 2, p.body)
    buffer.set(13, 11, p.detail)
    buffer.hLine(2, 13, 12, p.shade)
    return
  }
  const bob = pose === "step" ? 1 : 0
  buffer.ellipse(7, 9 + bob, 5, 3, p.body)
  buffer.ellipse(7, 10 + bob, 4, 2, p.belly)
  buffer.ellipse(12, 7 + bob, 3, 3, p.body)
  buffer.fillRect(14, 8 + bob, 2, 2, p.belly)
  buffer.set(15, 8 + bob, p.detail)
  buffer.fillRect(10, 3 + bob, 2, 4, p.shade)
  buffer.set(13, 7 + bob, p.eye)
  buffer.vLine(2, 5 + bob, pose === "step" ? 4 : 3, p.body)
  buffer.fillRect(4, 12 + bob, 2, 3, p.shade)
  buffer.fillRect(9, 12 + bob, 2, 3, p.shade)
}

function drawBird(buffer: PixelBuffer, p: PetPalette, pose: PetPose): void {
  const bob = pose === "step" ? 1 : 0
  if (pose === "sleep") {
    buffer.ellipse(8, 10, 4, 3, p.body)
    buffer.ellipse(8, 11, 3, 2, p.belly)
    buffer.hLine(6, 13, 5, p.shade)
    return
  }
  buffer.ellipse(7, 9 + bob, 4, 4, p.body)
  buffer.ellipse(7, 10 + bob, 3, 2, p.belly)
  buffer.ellipse(11, 6 + bob, 2, 2, p.body)
  buffer.set(13, 6 + bob, p.detail)
  buffer.set(12, 6 + bob, p.eye)
  // Wing lifts on the step frame so the bird looks like it is hopping.
  if (pose === "step") buffer.ellipse(6, 7, 3, 1, p.shade)
  else buffer.ellipse(6, 9, 3, 2, p.shade)
  buffer.vLine(6, 13 + bob, 2, p.detail)
  buffer.vLine(9, 13 + bob, 2, p.detail)
}

function drawRobot(buffer: PixelBuffer, p: PetPalette, pose: PetPose): void {
  const bob = pose === "step" ? 1 : 0
  if (pose === "sleep") {
    buffer.fillRect(3, 9, 10, 5, p.shade)
    buffer.strokeRect(3, 9, 10, 5, C.ink)
    buffer.hLine(5, 11, 6, p.detail)
    return
  }
  buffer.fillRect(3, 6 + bob, 10, 6, p.body)
  buffer.strokeRect(3, 6 + bob, 10, 6, C.ink)
  buffer.fillRect(5, 8 + bob, 6, 2, C.charcoal)
  buffer.set(6, 9 + bob, p.eye)
  buffer.set(9, 9 + bob, p.eye)
  buffer.vLine(8, 2 + bob, 4, p.shade)
  buffer.set(8, 1 + bob, p.detail)
  // Hover thruster instead of legs, so it never has a walk cycle to get wrong.
  buffer.hLine(4, 13, pose === "step" ? 8 : 6, p.detail)
  buffer.hLine(6, 14, pose === "step" ? 4 : 2, C.cyan)
}

function drawPlantPal(buffer: PixelBuffer, p: PetPalette, pose: PetPose): void {
  const bob = pose === "step" ? 1 : 0
  buffer.fillRect(5, 10 + bob, 6, 5, C.amberDark)
  buffer.hLine(5, 10 + bob, 6, C.amber)
  buffer.strokeRect(5, 10 + bob, 6, 5, C.ink)
  if (pose === "sleep") {
    buffer.ellipse(8, 9, 4, 2, p.shade)
    return
  }
  buffer.ellipse(8, 6 + bob, 4, 3, p.body)
  buffer.ellipse(6, 4 + bob, 2, 2, p.belly)
  buffer.ellipse(10, 5 + bob, 2, 2, p.shade)
  buffer.set(7, 7 + bob, p.eye)
  buffer.set(10, 7 + bob, p.eye)
}

const DRAWERS: Record<PetKind, (b: PixelBuffer, p: PetPalette, pose: PetPose) => void> = {
  cat: drawCat,
  dog: drawDog,
  bird: drawBird,
  robot: drawRobot,
  plantpal: drawPlantPal,
}

export interface PetSpriteSet {
  kind: PetKind
  /** Keyed `${direction}:${pose}`. */
  frames: Record<string, PixelSprite>
}

/** Bake one pet into twelve sprites: four directions times three poses. */
export function buildPetSprites(kind: PetKind, seed: string | number = 0): PetSpriteSet {
  const rng = new Rng(`pet:${kind}:${seed}`)
  const palette = rng.pick(PET_COLORS[kind])
  const frames: Record<string, PixelSprite> = {}

  for (const pose of PET_POSES) {
    const buffer = new PixelBuffer(16, 16)
    DRAWERS[kind](buffer, palette, pose)
    buffer.outline(C.ink)
    const east = buffer.toSprite(`pet-${kind}-east-${pose}`, BASE_PALETTE, 16)
    for (const direction of DIRECTIONS) {
      const mirrored = direction === "west" || direction === "north"
      frames[`${direction}:${pose}`] = mirrored
        ? {
            ...east,
            name: `pet-${kind}-${direction}-${pose}`,
            rows: east.rows.map((row) => [...row].reverse().join("")),
          }
        : { ...east, name: `pet-${kind}-${direction}-${pose}` }
    }
  }

  return { kind, frames }
}

export function petSpriteKey(direction: Direction, pose: PetPose): string {
  return `${direction}:${pose}`
}
