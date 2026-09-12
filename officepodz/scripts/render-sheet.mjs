/**
 * Render a contact sheet of the whole art pack.
 *
 *   npm run sheet -- --scale 4
 *
 * One image showing every avatar direction and pose, every pet, and every piece
 * of furniture. Useful in a pull request, and useful when someone asks what is
 * actually in the box.
 */
import { buildAvatarSprites, styleFromSeed } from "../dist/src/art/avatar.js"
import { buildPetSprites, PET_KINDS, PET_POSES } from "../dist/src/art/pets.js"
import { buildFurnitureSprite, FURNITURE_KINDS } from "../dist/src/art/furniture.js"
import { buildTiles, TILE_KINDS } from "../dist/src/art/tiles.js"
import { spriteToRGBA } from "../dist/src/pixel/sprite.js"
import { encodePNG } from "../dist/src/pixel/png.js"
import { RgbaCanvas, deflate, human, writeFile } from "./lib.mjs"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback
}
const scale = Number(flag("scale", "3"))

const CAST = [
  ["donna", "agent"],
  ["winston", "agent"],
  ["operator", "human"],
  ["chef", "human"],
]
const POSE_KEYS = [
  "south:stand",
  "south:stepA",
  "south:stepB",
  "north:stand",
  "east:stand",
  "east:stepA",
  "west:stand",
  "south:sit",
]

const rows = []
for (const [seed, kind] of CAST) {
  const set = buildAvatarSprites(styleFromSeed(seed, kind), seed)
  rows.push(POSE_KEYS.map((key) => set.frames[key]))
}
rows.push(
  PET_KINDS.flatMap((kind) => {
    const set = buildPetSprites(kind, kind)
    return PET_POSES.slice(0, 2).map((pose) => set.frames[`east:${pose}`])
  }).slice(0, 8),
)
const tiles = buildTiles("officepodz")
rows.push(TILE_KINDS.slice(1, 9).map((kind) => tiles[kind]))
for (let i = 0; i < FURNITURE_KINDS.length; i += 8) {
  rows.push(FURNITURE_KINDS.slice(i, i + 8).map((kind) => buildFurnitureSprite(kind, 7)))
}

const columns = 8
const cellW = 52
const cellH = 44
const canvas = new RgbaCanvas(cellW * columns, cellH * rows.length, [60, 68, 61, 255])

rows.forEach((row, rowIndex) => {
  row.forEach((sprite, columnIndex) => {
    if (!sprite) return
    canvas.blit(
      sprite,
      columnIndex * cellW + Math.round((cellW - sprite.width) / 2),
      rowIndex * cellH + cellH - 4 - sprite.height,
      spriteToRGBA,
    )
  })
})

const png = encodePNG(canvas.width * scale, canvas.height * scale, canvas.upscale(scale), deflate)
const path = writeFile(flag("out", "assets/sheet.png"), png)
console.log(`OfficePodz sheet ${canvas.width * scale}x${canvas.height * scale}  ${human(png.length)}`)
console.log(`  ${path}`)
