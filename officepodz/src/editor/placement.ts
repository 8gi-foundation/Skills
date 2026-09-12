import { FURNITURE, type FurnitureKind } from "../art/furniture.js"
import type { Vec2 } from "../core/types.js"
import type { Tilemap } from "../world/tilemap.js"
import type { PlacedObject, WorldData } from "../world/types.js"

/**
 * Furniture placement.
 *
 * Teams rearrange their office. This is the smallest thing that makes that
 * possible without shipping a level editor: validate a footprint, drop an
 * object, pick it back up, and hand the host a diff it can persist.
 */

export interface PlacementResult {
  ok: boolean
  reason?: string
  object?: PlacedObject
}

let counter = 0

function nextId(): string {
  counter += 1
  return `obj-${Date.now().toString(36)}-${counter}`
}

/** Can this footprint go here? Checks bounds, walls, floor and overlap. */
export function canPlace(map: Tilemap, kind: FurnitureKind, x: number, y: number): PlacementResult {
  const def = FURNITURE[kind]
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const tx = x + dx
      const ty = y + dy
      if (!map.inBounds(tx, ty)) return { ok: false, reason: "outside the building" }
      if (map.wallAt(tx, ty) !== 0) return { ok: false, reason: "that is a wall" }
      const existing = map.objectAt(tx, ty)
      if (existing) return { ok: false, reason: `${FURNITURE[existing.kind].label} is already there` }
    }
  }
  return { ok: true }
}

export function placeFurniture(
  map: Tilemap,
  kind: FurnitureKind,
  x: number,
  y: number,
  extra: Partial<Pick<PlacedObject, "ownerId" | "zoneId" | "seed">> = {},
): PlacementResult {
  const check = canPlace(map, kind, x, y)
  if (!check.ok) return check

  const object: PlacedObject = {
    id: nextId(),
    kind,
    x,
    y,
    seed: extra.seed ?? Math.floor(Math.random() * 10000),
    ...(extra.ownerId ? { ownerId: extra.ownerId } : {}),
    zoneId: extra.zoneId ?? map.zoneAt(x, y)?.id,
  }
  map.addObject(object)
  return { ok: true, object }
}

export function removeFurniture(map: Tilemap, objectId: string): boolean {
  return map.removeObject(objectId)
}

export function moveFurniture(map: Tilemap, objectId: string, to: Vec2): PlacementResult {
  const object = map.getObject(objectId)
  if (!object) return { ok: false, reason: "no such object" }
  const original = { x: object.x, y: object.y }
  map.removeObject(objectId)
  const check = canPlace(map, object.kind, to.x, to.y)
  if (!check.ok) {
    map.addObject({ ...object, ...original })
    return check
  }
  const moved: PlacedObject = { ...object, x: to.x, y: to.y, zoneId: map.zoneAt(to.x, to.y)?.id }
  map.addObject(moved)
  return { ok: true, object: moved }
}

/**
 * Diff two worlds down to what actually changed.
 *
 * Hosts persist this instead of the whole map, so a rearranged sofa is a few
 * bytes rather than a full floor plan.
 */
export interface LayoutDiff {
  added: PlacedObject[]
  removed: string[]
  moved: PlacedObject[]
}

export function diffLayout(base: WorldData, current: WorldData): LayoutDiff {
  const baseById = new Map(base.objects.map((object) => [object.id, object]))
  const currentById = new Map(current.objects.map((object) => [object.id, object]))

  const added: PlacedObject[] = []
  const moved: PlacedObject[] = []
  for (const [id, object] of currentById) {
    const before = baseById.get(id)
    if (!before) added.push(object)
    else if (before.x !== object.x || before.y !== object.y || before.ownerId !== object.ownerId) {
      moved.push(object)
    }
  }
  const removed = [...baseById.keys()].filter((id) => !currentById.has(id))
  return { added, removed, moved }
}

/** Apply a stored diff on top of a freshly generated world. */
export function applyLayoutDiff(world: WorldData, diff: LayoutDiff): WorldData {
  const objects = world.objects
    .filter((object) => !diff.removed.includes(object.id))
    .map((object) => diff.moved.find((candidate) => candidate.id === object.id) ?? object)
  return { ...world, objects: [...objects, ...diff.added] }
}
