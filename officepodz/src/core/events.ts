import type { Unsubscribe } from "./types.js"

/** Minimal typed event bus. No dependencies, no leaks on repeated mounts. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<(payload: never) => void>>()

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): Unsubscribe {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as (payload: never) => void)
    return () => {
      set?.delete(handler as (payload: never) => void)
    }
  }

  once<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): Unsubscribe {
    const off = this.on(event, (payload) => {
      off()
      handler(payload)
    })
    return off
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of [...set]) {
      ;(handler as (value: Events[K]) => void)(payload)
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}
