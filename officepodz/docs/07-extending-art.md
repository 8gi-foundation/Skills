# Extending the art

Adding furniture, pets, tiles and themes.

---

## Add a piece of furniture

One entry in the catalogue at `src/art/furniture.ts`. The `draw` function receives a `PixelBuffer`
sized to `spriteW` by `spriteH` and a seeded RNG.

```ts
"standing-desk": define({
  kind: "standing-desk",
  label: "Standing desk",
  w: 2,              // footprint in tiles
  h: 1,
  solid: true,       // blocks pathfinding
  spriteW: 32,       // 2 tiles wide
  spriteH: 34,       // rises 18px above the footprint
  interaction: "workstation",
  seats: [],         // nobody sits at a standing desk
  draw: (buffer, rng) => {
    monitorLike(buffer, 8, 0)
    buffer.fillRect(0, 16, 32, 5, C.woodLight)
    buffer.hLine(0, 16, 32, C.sand)
    buffer.strokeRect(0, 16, 32, 5, C.woodDark)
    buffer.fillRect(14, 21, 4, 11, C.greyDark)
    buffer.fillRect(8, 32, 16, 2, C.charcoal)
    buffer.contactShadow(16, 33, 12, C.shadow)
  },
}),
```

Then add the kind to the `FurnitureKind` union. TypeScript will point at the two or three places that
need it, which is the point of the union being explicit.

Rules that keep new furniture consistent with the pack:

1. **The sprite bottom aligns with the bottom of the footprint.** Height above that rises up the wall.
2. **Always add a contact shadow.** Without it an object floats.
3. **Light from the top.** Lit top edge, shaded bottom edge. `panel()` does both.
4. **Seats are offsets from the origin tile**, with a facing. A chair seats on its own tile
   (`0,0`); a desk seats on the tile below it (`0,1`, facing north).
5. **Use `C.*` names, never raw indices.** That is what makes re-theming possible.

Run `npm run check:art` afterwards. It verifies the sprite matches the declared size and that seats
are adjacent to the footprint.

---

## Add a pet

Two edits in `src/art/pets.ts`: a colour set and a drawer.

```ts
const PET_COLORS = {
  // ...
  fish: [{ body: C.amber, shade: C.amberDark, belly: C.amberLight, detail: C.cyan, eye: C.ink }],
}

function drawFish(buffer: PixelBuffer, p: PetPalette, pose: PetPose): void {
  const bob = pose === "step" ? 1 : 0
  buffer.ellipse(8, 9 + bob, 5, 3, p.body)
  buffer.ellipse(8, 10 + bob, 4, 2, p.belly)
  buffer.set(11, 8 + bob, p.eye)
  // The tail is the pose difference, so it reads as swimming.
  if (pose === "step") buffer.ellipse(3, 8 + bob, 2, 3, p.shade)
  else buffer.ellipse(3, 10 + bob, 2, 2, p.shade)
}
```

Register it in `DRAWERS` and `PET_KINDS`. Draw in profile facing east; mirroring handles west and
north. Give `sleep` a visibly different silhouette, because a napping pet is what sells the room.

---

## Add a tile

```ts
case "carpet-amber":
  carpet(buffer, rng, C.amberDark, C.woodDark, C.amber)
  break
```

Add the kind to `TILE_KINDS`. Ids are positional, so **append, never insert**: an existing saved
world stores tile ids, and inserting in the middle repaints every floor in every stored map.

If a tile should block movement, add it to `SOLID_TILES`.

---

## Re-theme the office

Three places, in increasing order of impact:

| Change | File | Effect |
|--------|------|--------|
| Palette hexes | `src/pixel/palette.ts` | Every sprite, everywhere, at once |
| `FLOOR_BY_KIND` and `ACCENT_BY_KIND` | `src/world/generator.ts` | Room floors and label colours |
| Furnishers | `src/world/generator.ts` | What each kind of room contains |

Because furniture is drawn from palette names rather than literal colours, changing `C.wood` from oak
to walnut re-themes every desk, table and bookshelf in the building with no art work at all.

```ts
// A darker, cooler office
BASE_PALETTE[C.wood] = "#4a4038"
BASE_PALETTE[C.woodLight] = "#6d6055"
BASE_PALETTE[C.greenDark] = "#1b3a2a"
```

Remember the palette guard: nothing in the 265 to 335 hue band.

---

## Add a room kind

1. Add it to `ZoneKind` in `src/world/types.ts`.
2. Give it a floor in `FLOOR_BY_KIND` and an accent in `ACCENT_BY_KIND`.
3. Write a furnisher and register it in `FURNISHERS`.

```ts
function furnishStudio(builder: Builder, zone: ZoneData): void {
  const room = interiorOf(zone.rect)
  builder.place("whiteboard", room.x + 1, room.y, zone.id)
  builder.place("rug", room.x + 1, room.y + 2, zone.id)
  for (let x = room.x; x < room.x + room.w; x += 3) {
    builder.place("desk", x, room.y + room.h - 2, zone.id)
    builder.place("chair", x, room.y + room.h - 1, zone.id)
  }
}
```

`builder.place` returns `undefined` when the footprint does not fit, overlaps something, or lands on
a wall. Furnishers can be written optimistically and let the placement checks sort it out, which is
why they stay short.

---

## Scale beyond 16 pixels

`TILE_SIZE` is a constant, but changing it means redrawing everything. The supported way to get a
bigger office is integer zoom on the camera, which is what `coverZoom()` and `fitZoom()` are for.

```ts
engine.renderer.camera.zoom = 4          // chunky and readable
engine.renderer.camera.zoom = engine.renderer.camera.fitZoom()   // whole floor in view
```

Never use a fractional zoom on pixel art. The shimmer it produces cannot be smoothed away.
