# Roadmap

What is built, what is deliberately not, and what would come next.

---

## Built

| Area | State |
|------|-------|
| Pixel format, palette, PNG encoder, atlas packer | Complete |
| Avatars: 4 directions, 4 poses, 4 hair styles, derived looks | Complete |
| Pets: 5 kinds, 3 poses, owner following, napping | Complete |
| Furniture: 21 kinds with footprints, seats and interactions | Complete |
| Tiles: 8 floors, 3 walls | Complete |
| Procedural office generator with rooms, doors, zones and furnishing | Complete |
| Tilemap, collision, zone lookup, object index | Complete |
| A* pathfinding with soft crowd avoidance | Complete |
| Canvas renderer, depth sorting, camera, nameplates, bubbles | Complete |
| Agent and pet brains, directive queue | Complete |
| Keyboard, click to walk, wheel zoom, touch | Complete |
| Wire protocol, loopback, cross tab and bridge transports | Complete |
| Host adapter, world signals, activity signals | Complete |
| Furniture placement, layout diffing | Complete |
| Headless preview and contact sheet rendering | Complete |
| Art and palette CI guards | Complete |
| React binding | Complete |

---

## Deliberately not built

Each of these is a real feature that was left out for a reason worth stating.

**Voice and video.** Proximity audio is the obvious next thing to want, and it is also the thing most
likely to already exist in the host. OfficePodz emits `nearby` and `entered-zone`; wire those into
the WebRTC or LiveKit setup you already run. Bundling a media stack would double the package and
halve the number of stacks it drops into.

**An avatar customiser.** Looks are derived from an id hash, which is stable, free and good enough
that nobody asks for a customiser until they have already enjoyed the room. When they do ask, the
`AvatarStyle` type is the whole surface: six fields.

**A level editor.** `placeFurniture`, `moveFurniture` and `diffLayout` are the primitives. A visual
editor is a host concern, because it needs the host's own panels, permissions and undo stack.

**Isometric projection.** It doubles the art cost and turns tile maths into a translation layer. Top
down reads instantly at 16 pixels.

**A physics engine.** Characters walk a grid. Nothing in an office needs momentum.

**Server authority.** The protocol sends intents, not positions, and clients path locally. Adding
authority means adding a server, and most hosts want this embedded, not hosted.

---

## What would come next

Roughly in order of value per unit of work.

1. **Proximity audio hooks.** Emit `nearby` continuously with a radius, not just on zone crossing,
   so hosts can fade audio by distance rather than snap it by room.
2. **Sitting on sofas and armchairs.** The seat data already exists on every lounge item; the brains
   just do not use it yet. Agents lounging would visibly change how the lounge reads.
3. **Interaction affordances.** A small key prompt over the nearest usable object. Right now you have
   to know that `E` does something.
4. **Minimap.** A 1px per tile render of the floor plan with occupant dots, cheap to produce from
   `WorldData` and useful the moment a building has more than ten rooms.
5. **Day and night tint.** One multiply pass over the floor layer driven by the host clock. Almost
   free, and it makes an always open office feel like it has a rhythm.
6. **Multi floor buildings.** Lifts as zone transitions between two `WorldData` maps. Mostly a
   routing and camera problem, not an art problem.
7. **Emote wheel.** Six reactions, rendered large and briefly. The `emote` bubble variant is already
   there.
8. **Accessibility pass.** A non visual room list with keyboard navigation between rooms, so the
   office is navigable without reading pixels. This should arguably move up the list.
9. **Binary heap for A\*.** Only matters past roughly 200x200 tiles. Noted so nobody has to rediscover
   why the open set is an array.

---

## Known limits

| Limit | Detail |
|-------|--------|
| Map size | Comfortable to roughly 200x200 tiles. The linear scan open set is the first bottleneck. |
| Occupants | Tested with tens. Hundreds would want spatial partitioning for the `occupied` set and culling by zone. |
| Sprite cache | Keyed by resolved appearance. A cast with hundreds of unique outfits bakes hundreds of canvases. |
| Text rendering | Canvas `fillText`, not a pixel font. It is crisp enough at integer zoom but it is not pixel art. |
| Mobile | Works, tap to walk. There is no on screen joystick. |
| Walls and occlusion | One depth sorted list. Tall multi tile wall art would need a proper occlusion layer. |
