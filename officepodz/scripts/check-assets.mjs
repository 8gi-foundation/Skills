/**
 * Art checksum guard.
 *
 *   node scripts/check-assets.mjs           compare against assets/checksums.txt
 *   node scripts/check-assets.mjs --write   regenerate it after an intended change
 *
 * This hashes DECODED pixels, not encoded PNG bytes, and that distinction is the
 * whole point. The exporter compresses with zlib.deflateSync, so committed PNG
 * bytes depend on the zlib build behind the running Node. Diffing those bytes in
 * CI turns a Node or zlib upgrade into a red build on a repo where no art
 * changed. Sprite RGBA has no such dependency: it changes when, and only when,
 * a pixel changes.
 */
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildAvatarSprites, styleFromSeed } from "../dist/src/art/avatar.js"
import { buildFurnitureSet, FURNITURE_KINDS } from "../dist/src/art/furniture.js"
import { buildPetSprites, PET_KINDS } from "../dist/src/art/pets.js"
import { buildTiles, TILE_KINDS } from "../dist/src/art/tiles.js"
import { spriteToRGBA } from "../dist/src/pixel/sprite.js"
import { ROOT, writeFile } from "./lib.mjs"

/** Must match SAMPLE_CAST in export-sprites.mjs, or the manifest drifts. */
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

const MANIFEST = "assets/checksums.txt"

function hash(sprite) {
  return createHash("sha256").update(Buffer.from(spriteToRGBA(sprite))).digest("hex").slice(0, 16)
}

function collect() {
  const lines = []
  const tiles = buildTiles("officepodz")
  for (const kind of TILE_KINDS) lines.push([tiles[kind].name, hash(tiles[kind])])

  const furniture = buildFurnitureSet(7)
  for (const kind of FURNITURE_KINDS) lines.push([furniture[kind].name, hash(furniture[kind])])

  for (const kind of PET_KINDS) {
    const set = buildPetSprites(kind, kind)
    for (const sprite of Object.values(set.frames)) lines.push([sprite.name, hash(sprite)])
  }

  for (const [seed, kind] of SAMPLE_CAST) {
    const set = buildAvatarSprites(styleFromSeed(seed, kind), seed)
    for (const sprite of Object.values(set.frames)) lines.push([sprite.name, hash(sprite)])
  }

  // Sort by name so the file is stable regardless of iteration order.
  lines.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return lines.map(([name, digest]) => `${digest}  ${name}`).join("\n") + "\n"
}

const current = collect()
const count = current.trimEnd().split("\n").length

if (process.argv.includes("--write")) {
  writeFile(MANIFEST, Buffer.from(current, "utf8"))
  console.log(`OfficePodz asset checksums: wrote ${count} sprites to ${MANIFEST}`)
  process.exit(0)
}

let previous
try {
  previous = readFileSync(resolve(ROOT, MANIFEST), "utf8")
} catch {
  console.error(`OfficePodz asset checksums: ${MANIFEST} is missing. Run with --write to create it.`)
  process.exit(1)
}

if (previous === current) {
  console.log(`OfficePodz asset checksums: ${count} sprites, all match`)
  process.exit(0)
}

const before = new Map(previous.trimEnd().split("\n").map((line) => line.split("  ")).map(([h, n]) => [n, h]))
const after = new Map(current.trimEnd().split("\n").map((line) => line.split("  ")).map(([h, n]) => [n, h]))
const changed = [...after].filter(([name, digest]) => before.has(name) && before.get(name) !== digest)
const added = [...after.keys()].filter((name) => !before.has(name))
const removed = [...before.keys()].filter((name) => !after.has(name))

console.error(`OfficePodz asset checksums: ${changed.length} changed, ${added.length} added, ${removed.length} removed`)
for (const [name] of changed) console.error(`  changed  ${name}`)
for (const name of added) console.error(`  added    ${name}`)
for (const name of removed) console.error(`  removed  ${name}`)
console.error("If the change was intended, run: node scripts/check-assets.mjs --write")
process.exit(1)
