/**
 * Palette guard.
 *
 * The host brand guide bans purple and violet outright. Colours creep in via
 * copy paste, so this runs in CI: any colour in the 265-335 hue band with real
 * saturation fails the build, wherever it lives.
 */
import {
  BASE_PALETTE,
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
  TROUSER_COLORS,
  hueOf,
  isPurple,
  saturationOf,
} from "../dist/src/pixel/palette.js"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { relative, resolve } from "node:path"
import { ROOT } from "./lib.mjs"

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".html", ".css"]

function* walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry)
    if (statSync(path).isDirectory()) {
      yield* walk(path)
    } else if (SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension))) {
      yield path
    }
  }
}

const groups = [
  ["base", BASE_PALETTE],
  ["skin", SKIN_TONES.flat()],
  ["hair", HAIR_COLORS.flat()],
  ["outfit", OUTFIT_COLORS.flat()],
  ["trousers", TROUSER_COLORS],
]

let failures = 0
let checked = 0

for (const [name, colors] of groups) {
  for (const color of colors) {
    checked++
    if (!isPurple(color)) continue
    failures++
    console.error(
      `  BANNED  ${name}: ${color} hue ${hueOf(color).toFixed(0)} saturation ${saturationOf(color).toFixed(2)}`,
    )
  }
}

// Colours also get hard coded in the renderer, the demo and the docs. Sweep the
// source too, otherwise the guard only protects the file that already obeys it.
const sourceRoots = ["src", "examples", "scripts"]
for (const root of sourceRoots) {
  for (const file of walk(resolve(ROOT, root))) {
    const text = readFileSync(file, "utf8")
    for (const match of text.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      checked++
      if (!isPurple(match[0])) continue
      failures++
      console.error(`  BANNED  ${relative(ROOT, file)}: ${match[0]} hue ${hueOf(match[0]).toFixed(0)}`)
    }
  }
}

console.log(`OfficePodz palette check: ${checked} colours, ${failures} violations`)
if (failures > 0) {
  console.error("Purple and violet are not part of this palette. Replace the colours above.")
  process.exit(1)
}
