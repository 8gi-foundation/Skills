/**
 * OfficePodz base palette.
 *
 * Rules baked into this file:
 *  1. 32 slots maximum, index 0 is always fully transparent.
 *  2. No purple, violet or magenta. Hues in the 265-335 band are banned by the
 *     host brand guide, and scripts/check-palette.ts fails the build if one
 *     sneaks in.
 *  3. Every family has dark / base / light so procedural art can shade without
 *     inventing colours at runtime.
 */

export const TRANSPARENT = 0

/** Named indices into BASE_PALETTE. Art code should never use raw numbers. */
export const C = {
  none: 0,
  ink: 1,
  shadow: 2,
  outline: 3,
  greyDark: 4,
  grey: 5,
  greyLight: 6,
  silver: 7,
  white: 8,
  greenDark: 9,
  green: 10,
  greenLight: 11,
  mint: 12,
  blueDark: 13,
  blue: 14,
  blueLight: 15,
  cyan: 16,
  teal: 17,
  amberDark: 18,
  amber: 19,
  amberLight: 20,
  redDark: 21,
  red: 22,
  redLight: 23,
  woodDark: 24,
  wood: 25,
  woodLight: 26,
  sand: 27,
  leafDark: 28,
  leaf: 29,
  leafLight: 30,
  charcoal: 31,
} as const

export type ColorIndex = (typeof C)[keyof typeof C]

/** Index 0 carries an alpha of zero, everything else is fully opaque. */
export const BASE_PALETTE: readonly string[] = [
  "#00000000", // 0  transparent
  "#10140f", // 1  ink
  "#1d241b", // 2  shadow
  "#2b332a", // 3  outline
  "#3c443d", // 4  grey dark
  "#5b655c", // 5  grey
  "#8a948b", // 6  grey light
  "#b9c1b8", // 7  silver
  "#eef2ea", // 8  white
  "#1f4f2b", // 9  brand green dark
  "#2d6f3d", // 10 brand green
  "#46a05a", // 11 green light
  "#8fd49c", // 12 mint
  "#1c3d6b", // 13 blue dark
  "#2f6db5", // 14 blue
  "#6fa8e6", // 15 blue light
  "#2bb3c4", // 16 cyan
  "#1f7f78", // 17 teal
  "#8a5a12", // 18 amber dark
  "#d9962a", // 19 amber
  "#f2c96b", // 20 amber light
  "#7a2420", // 21 red dark
  "#c0392b", // 22 red
  "#e2705f", // 23 red light
  "#4a3221", // 24 wood dark
  "#7a5433", // 25 wood
  "#a8794c", // 26 wood light
  "#d9c39a", // 27 sand
  "#1c5a2a", // 28 leaf dark
  "#3f8f3a", // 29 leaf
  "#6fc45a", // 30 leaf light
  "#24282a", // 31 charcoal
]

/** Skin ramps used by the avatar generator. Each entry is [base, shadow]. */
export const SKIN_TONES: readonly (readonly [string, string])[] = [
  ["#f4d4b0", "#d9ae86"],
  ["#e8bd92", "#c4926a"],
  ["#d09a66", "#a87348"],
  ["#b07a4e", "#8a5a36"],
  ["#8d5a34", "#6b4126"],
  ["#5f3a22", "#452818"],
]

/** Hair ramps. Greens and blues are allowed for agents, purple is not. */
export const HAIR_COLORS: readonly (readonly [string, string])[] = [
  ["#221a12", "#100c08"],
  ["#4a3221", "#2f1f14"],
  ["#7a5433", "#4f3520"],
  ["#b98a4a", "#8a6432"],
  ["#d9c39a", "#ad9a75"],
  ["#8a948b", "#5b655c"],
  ["#eef2ea", "#b9c1b8"],
  ["#c0392b", "#7a2420"],
  ["#2bb3c4", "#1f7f78"],
  ["#46a05a", "#1f4f2b"],
]

/** Outfit ramps. Index maps to a department accent in the default theme. */
export const OUTFIT_COLORS: readonly (readonly [string, string])[] = [
  ["#2d6f3d", "#1f4f2b"], // operations green
  ["#2f6db5", "#1c3d6b"], // engineering blue
  ["#d9962a", "#8a5a12"], // commerce amber
  ["#c0392b", "#7a2420"], // incident red
  ["#1f7f78", "#12514d"], // design teal
  ["#5b655c", "#3c443d"], // neutral grey
  ["#24282a", "#10140f"], // charcoal
  ["#b9c1b8", "#8a948b"], // silver
]

export const TROUSER_COLORS: readonly string[] = [
  "#24282a",
  "#1c3d6b",
  "#3c443d",
  "#4a3221",
  "#1f4f2b",
  "#5b655c",
]

/** Parse "#rrggbb" or "#rrggbbaa" into an [r,g,b,a] tuple. */
export function parseHex(hex: string): [number, number, number, number] {
  const raw = hex.replace("#", "")
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  const a = raw.length >= 8 ? parseInt(raw.slice(6, 8), 16) : 255
  return [r, g, b, a]
}

/** Hue in degrees, used by the purple guard. */
export function hueOf(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) return 0
  let hue: number
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue *= 60
  return hue < 0 ? hue + 360 : hue
}

export function saturationOf(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === 0) return 0
  return (max - min) / max
}

/** True when a colour lands in the banned violet band with enough saturation. */
export function isPurple(hex: string): boolean {
  if (parseHex(hex)[3] === 0) return false
  const hue = hueOf(hex)
  return saturationOf(hex) > 0.15 && hue >= 265 && hue <= 335
}
