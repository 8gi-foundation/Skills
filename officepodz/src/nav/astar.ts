import { manhattan } from "../core/math.js"
import type { Vec2 } from "../core/types.js"
import type { Tilemap } from "../world/tilemap.js"

/**
 * Grid A* with four way movement.
 *
 * Diagonals are deliberately off: characters are 16 pixels wide and cutting a
 * corner diagonally clips furniture that the collision grid says is solid. Four
 * way movement also makes the walk cycle read correctly, since every step maps
 * to exactly one facing.
 */

interface Node {
  x: number
  y: number
  g: number
  f: number
  parent: Node | null
}

const NEIGHBOURS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

export interface PathOptions {
  /** Stop as soon as a tile adjacent to the goal is reached. */
  adjacent?: boolean
  /** Safety valve for pathological maps. */
  maxNodes?: number
  /** Tiles other characters are standing on, treated as soft obstacles. */
  occupied?: ReadonlySet<number>
}

/**
 * Find a tile path. Returns an empty array when no route exists.
 *
 * The open set is a plain array with a linear scan for the best node. For maps
 * of a few thousand tiles that beats the allocation cost of a binary heap, and
 * it keeps this file readable.
 */
export function findPath(
  map: Tilemap,
  start: Vec2,
  goal: Vec2,
  options: PathOptions = {},
): Vec2[] {
  const maxNodes = options.maxNodes ?? 6000
  const occupied = options.occupied
  const goalReached = (x: number, y: number) =>
    options.adjacent
      ? manhattan(x, y, goal.x, goal.y) <= 1
      : x === goal.x && y === goal.y

  if (!map.inBounds(start.x, start.y)) return []
  if (goalReached(start.x, start.y)) return []

  const key = (x: number, y: number) => y * map.width + x
  const open: Node[] = [
    { x: start.x, y: start.y, g: 0, f: manhattan(start.x, start.y, goal.x, goal.y), parent: null },
  ]
  const seen = new Map<number, number>([[key(start.x, start.y), 0]])
  let expanded = 0

  while (open.length > 0 && expanded < maxNodes) {
    let bestAt = 0
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bestAt].f) bestAt = i
    const current = open.splice(bestAt, 1)[0]
    expanded++

    if (goalReached(current.x, current.y)) {
      const path: Vec2[] = []
      let node: Node | null = current
      while (node && node.parent) {
        path.push({ x: node.x, y: node.y })
        node = node.parent
      }
      return path.reverse()
    }

    for (const [dx, dy] of NEIGHBOURS) {
      const nx = current.x + dx
      const ny = current.y + dy
      if (!map.walkable(nx, ny)) continue
      const nKey = key(nx, ny)
      // Standing characters cost extra rather than blocking, so crowds flow.
      const step = occupied?.has(nKey) ? 4 : 1
      const g = current.g + step
      const previous = seen.get(nKey)
      if (previous !== undefined && previous <= g) continue
      seen.set(nKey, g)
      open.push({ x: nx, y: ny, g, f: g + manhattan(nx, ny, goal.x, goal.y), parent: current })
    }
  }

  return []
}
