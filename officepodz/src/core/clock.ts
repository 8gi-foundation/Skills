/**
 * Fixed timestep loop.
 *
 * Simulation runs at a constant 30 Hz so agent behaviour and network replay are
 * reproducible, while rendering runs as fast as the browser allows.
 */
export const SIM_HZ = 30
export const SIM_STEP = 1 / SIM_HZ

export interface LoopHandlers {
  update: (dt: number) => void
  render: (alpha: number, elapsed: number) => void
}

export class Loop {
  private raf = 0
  private lastTime = 0
  private accumulator = 0
  private elapsed = 0
  private running = false

  constructor(private readonly handlers: LoopHandlers) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    const tick = (now: number) => {
      if (!this.running) return
      // Cap the delta so a backgrounded tab does not spiral on resume.
      const frame = Math.min((now - this.lastTime) / 1000, 0.25)
      this.lastTime = now
      this.accumulator += frame
      this.elapsed += frame
      while (this.accumulator >= SIM_STEP) {
        this.handlers.update(SIM_STEP)
        this.accumulator -= SIM_STEP
      }
      this.handlers.render(this.accumulator / SIM_STEP, this.elapsed)
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  get isRunning(): boolean {
    return this.running
  }
}
