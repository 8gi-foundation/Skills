/**
 * Bake every sprite in the pack into PNG atlases plus JSON manifests.
 *
 *   npm run assets
 *
 * The JSON is the contract: frame names, offsets and the palette. Anything that
 * can read a texture atlas can use these, including engines that are not this
 * one. Run it after changing art and commit the diff.
 */
import { buildTiles, TILE_KINDS } from "../dist/src/art/tiles.js"
import { buildFurnitureSet, FURNITURE, FURNITURE_KINDS } from "../dist/src/art/furniture.js"
import { buildPetSprites, PET_KINDS } from "../dist/src/art/pets.js"
import { buildAvatarSprites, styleFromSeed } from "../dist/src/art/avatar.js"
import { packAtlas, atlasManifest } from "../dist/src/pixel/atlas.js"
import { encodePNG } from "../dist/src/pixel/png.js"
import { validateSprite } from "../dist/src/pixel/sprite.js"
import { deflate, human, writeFile, writeJSON } from "./lib.mjs"

const SAMPLE_CAST = [
  ["donna", "agent"],
  ["winston", "agent"],
  ["john", "agent"],
  ["mary", "agent"],
  ["sage", "agent"],
  ["operator", "human"],
  ["chef", "human"],
  ["buyer", "human"],
]

function emit(name, sprites, maxWidth) {
  for (const sprite of sprites) validateSprite(sprite)
  const atlas = packAtlas(name, sprites, maxWidth)
  const png = encodePNG(atlas.width, atlas.height, atlas.rgba, deflate)
  const pngPath = writeFile(`assets/${name}.png`, png)
  writeJSON(`assets/${name}.json`, atlasManifest(atlas))
  console.log(
    `  ${name.padEnd(10)} ${String(sprites.length).padStart(4)} frames  ${atlas.width}x${atlas.height}  ${human(png.length)}  ${pngPath.split("/").slice(-2).join("/")}`,
  )
  return atlas
}

console.log("OfficePodz asset export")

const tiles = buildTiles("officepodz")
emit("tiles", TILE_KINDS.map((kind) => tiles[kind]), 192)

const furniture = buildFurnitureSet(7)
emit("furniture", FURNITURE_KINDS.map((kind) => furniture[kind]), 256)

const petSprites = []
for (const kind of PET_KINDS) {
  const set = buildPetSprites(kind, kind)
  for (const [key, sprite] of Object.entries(set.frames)) {
    if (key.startsWith("east") || key.startsWith("west")) petSprites.push(sprite)
  }
}
emit("pets", petSprites, 192)

const avatarSprites = []
for (const [seed, kind] of SAMPLE_CAST) {
  const set = buildAvatarSprites(styleFromSeed(seed, kind), seed)
  for (const sprite of Object.values(set.frames)) avatarSprites.push(sprite)
}
emit("avatars", avatarSprites, 272)

console.log("done")
