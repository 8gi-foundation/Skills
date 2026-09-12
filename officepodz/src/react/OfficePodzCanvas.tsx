import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react"
import type { Directive } from "../entities/brain.js"
import type { OccupantRecord, WorkOSAdapter } from "../integration/adapter.js"
import type { Transport } from "../net/protocol.js"
import type { RenderOptions } from "../render/renderer.js"
import { OfficePodz } from "../sim/world.js"
import type { WorldData } from "../world/types.js"

/**
 * React binding.
 *
 * The engine is framework free; this is a thin mount that owns the canvas
 * lifecycle and nothing else. Keep the adapter stable across renders (useMemo
 * or a module singleton), otherwise the office tears down and rebuilds on every
 * parent render.
 */

export interface OfficePodzHandle {
  engine: OfficePodz | null
  direct: (occupantId: string, directive: Directive) => void
  say: (occupantId: string, text: string) => void
  focus: (occupantId: string) => void
}

export interface OfficePodzCanvasProps {
  adapter?: WorkOSAdapter
  transport?: Transport
  world?: WorldData
  seed?: string
  render?: RenderOptions
  className?: string
  style?: React.CSSProperties
  onReady?: (engine: OfficePodz) => void
  onZoneChanged?: (payload: { characterId: string; zoneId: string | null; previous: string | null }) => void
  onInteract?: (payload: { characterId: string; objectId: string; interaction: string }) => void
  onOccupantsChanged?: (count: number) => void
}

export const OfficePodzCanvas = forwardRef<OfficePodzHandle, OfficePodzCanvasProps>(
  function OfficePodzCanvas(props, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const engineRef = useRef<OfficePodz | null>(null)
    const [error, setError] = useState<string | null>(null)

    useImperativeHandle(ref, () => ({
      get engine() {
        return engineRef.current
      },
      direct: (occupantId, directive) => engineRef.current?.direct(occupantId, directive),
      say: (occupantId, text) => engineRef.current?.say(occupantId, text),
      focus: (occupantId) => engineRef.current?.focus(occupantId),
    }))

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      let disposed = false

      const engine = new OfficePodz({
        canvas,
        ...(props.adapter ? { adapter: props.adapter } : {}),
        ...(props.transport ? { transport: props.transport } : {}),
        ...(props.world ? { world: props.world } : {}),
        ...(props.seed ? { seed: props.seed } : {}),
        ...(props.render ? { render: props.render } : {}),
      })
      engineRef.current = engine

      const offZone = engine.events.on("zone-changed", (payload) => props.onZoneChanged?.(payload))
      const offInteract = engine.events.on("interact", (payload) => props.onInteract?.(payload))
      const offOccupants = engine.events.on("occupants-changed", ({ count }) =>
        props.onOccupantsChanged?.(count),
      )

      engine
        .start()
        .then(() => {
          if (disposed) return
          props.onReady?.(engine)
        })
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))

      const onResize = () => engine.resize()
      window.addEventListener("resize", onResize)

      return () => {
        disposed = true
        window.removeEventListener("resize", onResize)
        offZone()
        offInteract()
        offOccupants()
        engine.dispose()
        engineRef.current = null
      }
      // The engine owns a canvas and a loop, so it is rebuilt only when the
      // things it is constructed from actually change.
    }, [props.adapter, props.transport, props.world, props.seed])

    return (
      <div className={props.className} style={{ position: "relative", ...props.style }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
        />
        {error ? (
          <div
            role="alert"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(16,20,15,0.85)",
              color: "#e2705f",
              font: "12px ui-monospace, monospace",
            }}
          >
            OfficePodz failed to start: {error}
          </div>
        ) : null}
      </div>
    )
  },
)

/** Convenience hook for hosts that keep their roster in React state. */
export function useOccupantSync(engine: OfficePodz | null, occupants: OccupantRecord[]): void {
  useEffect(() => {
    if (!engine) return
    for (const occupant of occupants) engine.addOccupant(occupant)
  }, [engine, occupants])
}
