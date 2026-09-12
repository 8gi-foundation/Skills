/**
 * Art guard.
 *
 * Hand authored pixel templates are strings, and a string can be one character
 * short without anyone noticing until a sprite renders with a seam. This
 * validates every sprite the pack can produce: row counts, row widths, and
 * palette references.
 */
import { avatarTemplateRows, buildAvatarSprites, styleFromSeed } from "../dist/src/art/avatar.js"
import { buildFurnitureSet, FURNITURE, FURNITURE_KINDS } from "../dist/src/art/furniture.js"
import { buildPetSprites, PET_KINDS } from "../dist/src/art/pets.js"
import { buildTiles, TILE_KINDS } from "../dist/src/art/tiles.js"
import { validateSprite } from "../dist/src/pixel/sprite.js"
import { TILE_SIZE } from "../dist/src/core/types.js"

let checked = 0
const problems = []

function check(sprite) {
  checked++
  try {
    validateSprite(sprite)
  } catch (error) {
    problems.push(error.message)
  }
}

for (const template of avatarTemplateRows()) {
  template.rows.forEach((row, index) => {
    if (row.length !== 16) {
      problems.push(`${template.name}: row ${index} is ${row.length} chars, expected 16`)
    }
  })
}

for (const seed of ["donna", "winston", "operator", "chef", "sage", "buyer"]) {
  const set = buildAvatarSprites(styleFromSeed(seed, "agent"), seed)
  for (const sprite of Object.values(set.frames)) check(sprite)
  if (Object.keys(set.frames).length !== 16) {
    problems.push(`${seed}: expected 16 frames, got ${Object.keys(set.frames).length}`)
  }
}

const tiles = buildTiles("check")
for (const kind of TILE_KINDS) {
  const sprite = tiles[kind]
  check(sprite)
  if (sprite.width !== TILE_SIZE || sprite.height !== TILE_SIZE) {
    problems.push(`tile ${kind}: ${sprite.width}x${sprite.height}, expected ${TILE_SIZE} square`)
  }
}

const furniture = buildFurnitureSet(3)
for (const kind of FURNITURE_KINDS) {
  const sprite = furniture[kind]
  check(sprite)
  const def = FURNITURE[kind]
  if (sprite.width !== def.spriteW || sprite.height !== def.spriteH) {
    problems.push(
      `furniture ${kind}: sprite is ${sprite.width}x${sprite.height}, catalogue says ${def.spriteW}x${def.spriteH}`,
    )
  }
  if (def.spriteW < def.w * TILE_SIZE) {
    problems.push(`furniture ${kind}: sprite narrower than its ${def.w} tile footprint`)
  }
  for (const seat of def.seats) {
    if (Math.abs(seat.dx) > def.w + 1 || Math.abs(seat.dy) > def.h + 1) {
      problems.push(`furniture ${kind}: seat offset ${seat.dx},${seat.dy} is not adjacent to the footprint`)
    }
  }
}

for (const kind of PET_KINDS) {
  const set = buildPetSprites(kind, kind)
  for (const sprite of Object.values(set.frames)) check(sprite)
  if (Object.keys(set.frames).length !== 12) {
    problems.push(`pet ${kind}: expected 12 frames, got ${Object.keys(set.frames).length}`)
  }
}

console.log(`OfficePodz art check: ${checked} sprites, ${problems.length} problems`)
for (const problem of problems) console.error(`  ${problem}`)
if (problems.length > 0) process.exit(1)
