# Sprite specification

The pixel format, and how to author a sprite by hand.

---

## The format

```ts
interface PixelSprite {
  name: string
  width: number
  height: number
  palette: readonly string[]   // hex, slot 0 is transparent
  rows: readonly string[]      // one string per row, one character per pixel
  originY?: number             // pixels from the sprite top to the tile it stands on
}
```

Each character in a row is a base36 index into `palette`. `.` is an alias for slot 0, because
templates are far easier to read when empty space is a dot rather than a zero.

```
PIXEL_KEYS = "0123456789abcdefghijklmnopqrstuvwxyz"
```

That caps a sprite at 36 colours, which is about 30 more than pixel art at this size should want.

### Why JSON and not PNG

Sprites live in source as data, and PNGs are a build artefact. The payoff shows up in code review:

```diff
- "...1442222441..."
+ "...1442332441..."
```

That diff is legible. A changed PNG is a binary blob and a shrug.

---

## Palette slots for avatars

Avatar templates never reference a colour. They reference a role:

| Key | Slot | Key | Slot |
|-----|------|-----|------|
| `0` / `.` | transparent | `6` | shirt |
| `1` | outline | `7` | shirt shadow |
| `2` | skin | `8` | trousers |
| `3` | skin shadow | `9` | shoes |
| `4` | hair | `a` | eye |
| `5` | hair shadow | `b` | accent (badge, cap, lanyard) |

`avatarPalette(style)` resolves the twelve slots into hex. That is the whole variety system: one set
of pixels, an unlimited cast.

```ts
const style = styleFromSeed("agent-winston", "agent")
const sprites = buildAvatarSprites(style, "winston")
sprites.frames["south:stand"]   // a PixelSprite
```

---

## Anatomy of the avatar template

16 wide, 22 tall. The character stands with its feet on the bottom row.

```
row  0        blank, headroom for the outline
rows 1-9      head: hair cap, face, eyes, jaw
row  10       neck
rows 11-16    torso: shoulders, shirt, arms, belt
rows 17-21    LEG FRAME  <- swapped per pose
```

Splitting the legs out at row 17 is the entire animation system:

```
stand              stepA              stepB              sit
..188888888881..   ..188888888881..   ..188888888881..   ..188888888881..
..188881188881..   ..188881188881..   ..188881188881..   ..188888888881..
..188881188881..   ..188811888881..   ..188888118881..   ..177777777771..
..199991199991..   ..199911999991..   ..199999119991..   ..199999999991..
...1111..1111...   ..1111...1111...   ...1111...1111..   ...1111111111...
```

Four directions come from three templates. West is East mirrored at bake time, so there is no fourth
template to keep in sync.

### Hair styles without more art

Four styles, zero extra templates, all done by remapping keys on specific rows:

| Style | Operation |
|-------|-----------|
| `short` | the template as authored |
| `cap` | rows 1-3, hair keys become the accent key |
| `bald` | rows 2-5, hair keys become skin keys |
| `long` | rows 9-10, set the two outer columns to hair |

This is worth internalising before adding art: at 16 pixels, a key remap usually reads as a new
character, and a new template usually reads as the same one drawn slightly worse.

---

## Authoring a sprite by hand

1. Pick the size. Tiles are 16x16. Furniture is a multiple of 16 wide plus whatever height it needs
   to rise up the wall behind it.
2. Write the rows. Every row must be exactly `width` characters. Use `.` for transparency.
3. Set `originY` to the distance from the sprite top to the tile the object stands on. The renderer
   aligns the sprite bottom to the bottom of the footprint.
4. Run `npm run check:art`. It validates row counts, row widths and palette references for every
   sprite the pack can produce.

```ts
export const POSTER: PixelSprite = {
  name: "poster",
  width: 16,
  height: 16,
  palette: BASE_PALETTE,
  rows: [
    "................",
    "..1111111111....",
    "..1888888881....",
    "..18aa8888881...",
    // ... 16 rows, 16 characters each
  ],
}
```

---

## Drawing a sprite in code

For anything that is not a face, use `PixelBuffer`. It is less error prone than counting characters
and it makes re-theming possible.

```ts
const buffer = new PixelBuffer(16, 24)
buffer.fillRect(2, 2, 12, 16, C.charcoal)
buffer.strokeRect(2, 2, 12, 16, C.ink)
buffer.hLine(4, 5, 8, C.amberLight)
buffer.contactShadow(8, 23, 6, C.shadow)
const sprite = buffer.toSprite("my-thing", BASE_PALETTE, 24)
```

| Method | Use |
|--------|-----|
| `fillRect`, `strokeRect`, `hLine`, `vLine`, `set` | the basics |
| `ellipse` | pet bodies, rugs, plant canopies, table tops |
| `panel` | a lit top edge, a shaded bottom edge, knocked out corners: reads as rounded at 16px |
| `dither` | checker blend between two colours, for carpet and shadow falloff |
| `contactShadow` | the ellipse under a standing object that makes it sit on the floor |
| `outline` | one pixel dark edge around every opaque cluster |
| `blit` | compose sprites, skipping transparent pixels |

---

## The palette

32 slots, named in `src/pixel/palette.ts`, referenced as `C.green`, `C.woodDark` and so on. Never use
raw indices in art code.

Every family has dark, base and light so procedural art can shade without inventing colours at
runtime. Purple and violet are banned: any colour in the 265 to 335 hue band with real saturation
fails `npm run check:palette`, which runs in CI.

---

## A rule that will save you an afternoon

**Sprites carry their own palettes.** Two sprites with different palettes cannot be composited by
copying palette indices from one into the other: the indices mean different colours.

The browser renderer never hits this, because it bakes each sprite to its own canvas before drawing.
Anything headless has to composite in RGBA. That is what `RgbaCanvas` in `scripts/lib.mjs` exists
for, and skipping it is exactly how the first version of the preview renderer produced a room full
of grey people with no faces.
