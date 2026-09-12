import { useCallback, useMemo, useRef, useState } from "react"
import { OfficePodzCanvas, type OfficePodzHandle } from "../../src/react/index.js"
import { createMockAdapter } from "../../src/integration/adapter.js"

/**
 * A host panel.
 *
 * This is what embedding OfficePodz in an existing work OS actually looks like:
 * the office on one side, your own UI on the other, and the two talking through
 * zone changes and directives.
 *
 * The one thing to get right is the adapter identity. A new object on every
 * render tears the office down and rebuilds it, which looks like a flicker and
 * costs every agent its position.
 */
export function OfficePodzPanel({ userId }: { userId: string }) {
  const officeRef = useRef<OfficePodzHandle>(null)
  const [room, setRoom] = useState("Main Corridor")
  const [occupants, setOccupants] = useState(0)

  const adapter = useMemo(() => createMockAdapter({ viewerName: userId }), [userId])

  const handleZone = useCallback(
    ({ zoneId }: { zoneId: string | null }) => {
      const engine = officeRef.current?.engine
      const zone = zoneId ? engine?.map.zoneById(zoneId) : undefined
      setRoom(zone?.name ?? "Nowhere")
      // Walking into a room is how you join its channel.
      if (zone?.binding?.startsWith("channel:")) {
        void joinChannel(zone.binding.slice("channel:".length))
      }
    },
    [],
  )

  const handleInteract = useCallback(({ interaction }: { interaction: string }) => {
    if (interaction === "presentation") openWhiteboard()
    if (interaction === "meeting") startHuddle()
  }, [])

  return (
    <section style={{ display: "grid", gridTemplateColumns: "1fr 240px", height: "70vh" }}>
      <OfficePodzCanvas
        ref={officeRef}
        adapter={adapter}
        seed="acme-hq"
        render={{ showNameplates: true, showZoneLabels: true }}
        style={{ height: "100%" }}
        onZoneChanged={handleZone}
        onInteract={handleInteract}
        onOccupantsChanged={setOccupants}
      />
      <aside style={{ padding: 12, font: "12px ui-monospace, monospace" }}>
        <p>
          Room: <b>{room}</b>
        </p>
        <p>{occupants} in the building</p>
        <button
          type="button"
          onClick={() => officeRef.current?.direct("agent-donna", { type: "follow", targetId: userId })}
        >
          Ask Donna to come over
        </button>
        <button
          type="button"
          onClick={() => officeRef.current?.say(userId, "Standup in five")}
        >
          Say something
        </button>
      </aside>
    </section>
  )
}

declare function joinChannel(id: string): Promise<void>
declare function openWhiteboard(): void
declare function startHuddle(): void
