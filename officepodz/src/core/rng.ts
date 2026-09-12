/**
 * Deterministic pseudo random number generator (mulberry32).
 *
 * Every generated world, avatar and furniture scatter is seeded, so the same
 * seed always produces the same office. That matters because the host work OS
 * persists only the seed plus a diff of manual edits.
 */
export class Rng {
  private state: number

  constructor(seed: number | string) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashString(seed)
    if (this.state === 0) this.state = 0x9e3779b9
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      const tmp = items[i]
      items[i] = items[j]
      items[j] = tmp
    }
    return items
  }
}

export function hashString(value: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
