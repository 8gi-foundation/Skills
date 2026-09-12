/**
 * Generate an office and write it out as JSON.
 *
 *   npm run world -- --seed acme-hq --pods 6
 *
 * Hosts that want a hand edited floor plan start here: generate once, commit
 * the JSON, then edit it like any other data file.
 */
import { generateOffice } from "../dist/src/world/generator.js"
import { writeJSON } from "./lib.mjs"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback
}

const seed = flag("seed", "officepodz")
const pods = Number(flag("pods", "4"))
const out = flag("out", `assets/world-${seed}.json`)

const world = generateOffice({ seed, pods, name: flag("name", "OfficePodz HQ") })
const path = writeJSON(out, world)

const solid = world.walls.filter(Boolean).length
console.log(`OfficePodz world "${world.name}"`)
console.log(`  seed      ${world.seed}`)
console.log(`  size      ${world.width} x ${world.height} tiles (${world.width * 16} x ${world.height * 16} px)`)
console.log(`  zones     ${world.zones.length}`)
console.log(`  objects   ${world.objects.length}`)
console.log(`  walls     ${solid} tiles`)
console.log(`  written   ${path}`)
