/**
 * Render a whole office to a PNG, with no browser involved.
 *
 *   npm run preview
 *
 * This is the same painter's algorithm the canvas renderer uses: floor, then
 * everything else sorted by its bottom edge. Running it headless means art
 * regressions show up in a code review as an image diff rather than as a bug
 * report from whoever opened the app next.
 */
import { buildTiles, TILE_KINDS } from "../dist/src/art/tiles.js"
import { buildFurnitureSprite, FURNITURE } from "../dist/src/art/furniture.js"
import { buildAvatarSprites, styleFromSeed } from "../dist/src/art/avatar.js"
import { buildPetSprites } from "../dist/src/art/pets.js"
import { spriteToRGBA } from "../dist/src/pixel/sprite.js"
import { encodePNG } from "../dist/src/pixel/png.js"
import { generateOffice } from "../dist/src/world/generator.js"
import { Tilemap } from "../dist/src/world/tilemap.js"
import { RgbaCanvas, deflate, human, writeFile } from "./lib.mjs"

const TILE = 16
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback
}

const seed = flag("seed", "officepodz")
const scale = Number(flag("scale", "2"))
const world = generateOffice({ seed, pods: Number(flag("pods", "4")) })
const map = new Tilemap(world)

const tiles = buildTiles(seed)
const canvas = new RgbaCanvas(world.width * TILE, world.height * TILE)
const paint = (sprite, x, y) => canvas.blit(sprite, x, y, spriteToRGBA)

// Floor pass.
for (let ty = 0; ty < world.height; ty++) {
  for (let tx = 0; tx < world.width; tx++) {
    const kind = TILE_KINDS[map.floorAt(tx, ty)] ?? "void"
    paint(tiles[kind], tx * TILE, ty * TILE)
  }
}

const calls = []

for (let ty = 0; ty < world.height; ty++) {
  for (let tx = 0; tx < world.width; tx++) {
    const wall = map.wallAt(tx, ty)
    if (!wall) continue
    const kind = TILE_KINDS[wall] ?? "void"
    calls.push({ sortY: (ty + 1) * TILE - 4, draw: () => paint(tiles[kind], tx * TILE, ty * TILE) })
  }
}

for (const object of world.objects) {
  const def = FURNITURE[object.kind]
  const sprite = buildFurnitureSprite(object.kind, object.seed ?? 0)
  const bottom = (object.y + def.h) * TILE
  calls.push({
    sortY: def.solid ? bottom : bottom - TILE * 2,
    draw: () => paint(sprite, object.x * TILE, bottom - def.spriteH),
  })
}

// A cast of people, agents and pets so the preview shows the world populated.
const cast = [
  { seed: "donna", kind: "agent", dir: "south", pose: "stand" },
  { seed: "winston", kind: "agent", dir: "east", pose: "stepA" },
  { seed: "john", kind: "agent", dir: "north", pose: "sit" },
  { seed: "mary", kind: "agent", dir: "west", pose: "stepB" },
  { seed: "operator", kind: "human", dir: "south", pose: "stand" },
  { seed: "chef", kind: "human", dir: "east", pose: "stand" },
  { seed: "buyer", kind: "human", dir: "north", pose: "sit" },
  { seed: "sage", kind: "agent", dir: "south", pose: "stepA" },
]

const seats = world.objects.filter((object) => object.kind === "chair")
const corridor = world.zones.find((zone) => zone.kind === "corridor")

cast.forEach((member, index) => {
  const sprites = buildAvatarSprites(styleFromSeed(member.seed, member.kind), member.seed)
  const sprite = sprites.frames[`${member.dir}:${member.pose}`]
  let tx
  let ty
  if (member.pose === "sit" && seats[index]) {
    tx = seats[index].x
    ty = seats[index].y
  } else {
    tx = 3 + index * 6
    ty = corridor.rect.y + (index % 2)
  }
  const footX = tx * TILE + TILE / 2
  const footY = ty * TILE + TILE / 2
  calls.push({
    sortY: footY,
    draw: () => paint(sprite, footX - sprite.width / 2, footY - sprite.height + TILE / 2),
  })
})

const pets = [
  { kind: "cat", tile: [6, corridor.rect.y + 1] },
  { kind: "dog", tile: [20, corridor.rect.y + 2] },
  { kind: "robot", tile: [34, corridor.rect.y] },
  { kind: "bird", tile: [44, corridor.rect.y + 1] },
]
for (const pet of pets) {
  const sprite = buildPetSprites(pet.kind, pet.kind).frames["east:stand"]
  const footX = pet.tile[0] * TILE + TILE / 2
  const footY = pet.tile[1] * TILE + TILE / 2
  calls.push({
    sortY: footY,
    draw: () => paint(sprite, footX - sprite.width / 2, footY - sprite.height + TILE / 2),
  })
}

calls.sort((a, b) => a.sortY - b.sortY)
for (const call of calls) call.draw()

const scaled = canvas.upscale(scale)
const png = encodePNG(canvas.width * scale, canvas.height * scale, scaled, deflate)
const path = writeFile(flag("out", "assets/preview.png"), png)
console.log(`OfficePodz preview ${canvas.width * scale}x${canvas.height * scale}  ${human(png.length)}`)
console.log(`  ${path}`)
