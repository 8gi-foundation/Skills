import type { NetHandler, NetMessage, Transport } from "./protocol.js"

/**
 * Loopback transport.
 *
 * Everything sent comes straight back on the next microtask. Single player,
 * storybook and test runs use this so the rest of the engine never needs a
 * "there is no network" branch.
 */
export class LoopbackTransport implements Transport {
  readonly id: string
  private handlers = new Set<NetHandler>()
  private closed = false

  constructor(id = "local") {
    this.id = id
  }

  send(message: NetMessage): void {
    if (this.closed) return
    queueMicrotask(() => {
      for (const handler of [...this.handlers]) handler(message)
    })
  }

  onMessage(handler: NetHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  close(): void {
    this.closed = true
    this.handlers.clear()
  }
}

/**
 * Cross tab transport built on BroadcastChannel.
 *
 * Two browser tabs on the same origin become two people in the same office with
 * no server at all. It is the fastest way to demo multiplayer, and it is a real
 * transport for teams who only need presence inside one browser profile.
 */
export class BroadcastTransport implements Transport {
  readonly id: string
  private channel: BroadcastChannel
  private handlers = new Set<NetHandler>()

  constructor(roomId: string, id: string) {
    this.id = id
    this.channel = new BroadcastChannel(`officepodz:${roomId}`)
    this.channel.onmessage = (event: MessageEvent<NetMessage>) => {
      for (const handler of [...this.handlers]) handler(event.data)
    }
  }

  send(message: NetMessage): void {
    this.channel.postMessage(message)
  }

  onMessage(handler: NetHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  close(): void {
    this.handlers.clear()
    this.channel.close()
  }
}

/**
 * Adapter for a host that already has a realtime layer.
 *
 * Most work operating systems already run a socket, a Convex subscription, a
 * Firebase channel or a Liveblocks room. Wrap it here instead of adding a
 * second connection.
 */
export class BridgeTransport implements Transport {
  private handlers = new Set<NetHandler>()
  private detach?: () => void

  constructor(
    readonly id: string,
    private readonly publish: (message: NetMessage) => void,
    subscribe: (handler: NetHandler) => () => void,
  ) {
    this.detach = subscribe((message) => {
      for (const handler of [...this.handlers]) handler(message)
    })
  }

  send(message: NetMessage): void {
    this.publish(message)
  }

  onMessage(handler: NetHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  close(): void {
    this.handlers.clear()
    this.detach?.()
  }
}
