/**
 * Zero dependency PNG encoder.
 *
 * OfficePodz keeps sprites as JSON in the repo and bakes PNG atlases at build
 * time. Pulling in an image library for that would add a native dependency to a
 * package whose whole point is to drop into someone else's stack, so the
 * encoder is written out longhand here. Deflate uses stored (uncompressed)
 * blocks: the atlases are a few kilobytes and stay byte identical between runs,
 * which keeps asset diffs reviewable.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function u32(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff])
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

function chunk(type: string, payload: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)))
  const body = concat([typeBytes, payload])
  return concat([u32(payload.length), body, u32(crc32(body))])
}

/** zlib container around deflate stored blocks. */
function zlibStore(raw: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])]
  const maxBlock = 0xffff
  for (let offset = 0; offset < raw.length || offset === 0; offset += maxBlock) {
    const slice = raw.subarray(offset, Math.min(offset + maxBlock, raw.length))
    const final = offset + maxBlock >= raw.length ? 1 : 0
    const len = slice.length
    blocks.push(
      new Uint8Array([final, len & 0xff, (len >>> 8) & 0xff, ~len & 0xff, (~len >>> 8) & 0xff]),
    )
    blocks.push(slice)
    if (final) break
  }
  blocks.push(u32(adler32(raw)))
  return concat(blocks)
}

/**
 * Optional real compressor.
 *
 * Node build scripts pass `zlib.deflateSync` so committed assets are small. The
 * browser path leaves it undefined and falls back to stored blocks, which keeps
 * the runtime free of dependencies.
 */
export type Deflater = (raw: Uint8Array) => Uint8Array

/**
 * Encode straight RGBA bytes into a PNG byte array.
 *
 * Scanlines use filter type 0. Pixel art has flat runs, so a smarter filter
 * would buy almost nothing while making the output harder to verify.
 */
export function encodePNG(
  width: number,
  height: number,
  rgba: Uint8Array | Uint8ClampedArray,
  deflate?: Deflater,
): Uint8Array {
  const stride = width * 4
  const raw = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    raw.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1)
  }
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = concat([
    u32(width),
    u32(height),
    new Uint8Array([8, 6, 0, 0, 0]), // 8 bit, truecolour with alpha
  ])
  return concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflate ? deflate(raw) : zlibStore(raw)),
    chunk("IEND", new Uint8Array(0)),
  ])
}
