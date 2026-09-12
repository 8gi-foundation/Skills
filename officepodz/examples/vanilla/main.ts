import {
  BroadcastTransport,
  OfficePodz,
  createMockAdapter,
  generateOffice,
  placeFurniture,
  FURNITURE_KINDS,
  type FurnitureKind,
} from "../../src/index.js"

/**
 * The demo.
 *
 * It stands in for a host application: a roster panel, a chat box, a few
 * buttons that send directives, and a build mode. Everything it does goes
 * through the same public API a real work OS would use.
 */

const canvas = document.querySelector<HTMLCanvasElement>("#stage")
const roster = document.querySelector<HTMLUListElement>("#roster")
const zoneLabel = document.querySelector<HTMLSpanElement>("#zone")
const logList = document.querySelector<HTMLUListElement>("#log")
const chatForm = document.querySelector<HTMLFormElement>("#chat")
const chatInput = document.querySelector<HTMLInputElement>("#chat-input")
const buildSelect = document.querySelector<HTMLSelectElement>("#build-kind")
const buildToggle = document.querySelector<HTMLButtonElement>("#build-toggle")

if (!canvas) throw new Error("demo: #stage canvas missing")

const params = new URLSearchParams(location.search)
const seed = params.get("seed") ?? "officepodz"
const room = params.get("room")

const adapter = createMockAdapter({ viewerName: params.get("name") ?? "You" })
const world = generateOffice({ seed, pods: Number(params.get("pods") ?? 4) })

const engine = new OfficePodz({
  canvas,
  world,
  adapter,
  render: { showNameplates: true, showZoneLabels: true },
  // Open the same link in a second tab to walk around together.
  ...(room
    ? { transport: new BroadcastTransport(room, `guest-${Math.random().toString(36).slice(2, 7)}`) }
    : {}),
})

let building = false

function log(message: string): void {
  if (!logList) return
  const item = document.createElement("li")
  item.textContent = `${new Date().toLocaleTimeString()}  ${message}`
  logList.prepend(item)
  while (logList.children.length > 12) logList.lastChild?.remove()
}

function renderRoster(): void {
  if (!roster) return
  roster.replaceChildren()
  for (const character of engine.characters.values()) {
    const item = document.createElement("li")
    item.className = `roster-item kind-${character.kind}`
    item.innerHTML = `<b>${character.name}</b><span>${character.role || character.kind}</span>`
    item.addEventListener("click", () => {
      engine.focus(character.id)
      if (character.kind === "agent") {
        engine.direct(character.id, { type: "follow", targetId: engine.viewer?.id ?? "viewer" })
        log(`${character.name} is following you`)
      }
    })
    roster.append(item)
  }
}

engine.events.on("ready", () => {
  renderRoster()
  log(`world "${world.name}" ready, ${world.zones.length} zones, ${world.objects.length} objects`)
})

engine.events.on("occupants-changed", renderRoster)

engine.events.on("zone-changed", ({ characterId, zoneId }) => {
  if (characterId !== engine.viewer?.id) return
  const zone = zoneId ? engine.map.zoneById(zoneId) : undefined
  if (zoneLabel) zoneLabel.textContent = zone?.name ?? "Nowhere"
  if (zone) log(`entered ${zone.name}`)
})

engine.events.on("interact", ({ objectId, interaction }) => {
  const object = engine.map.getObject(objectId)
  log(`used ${object?.kind ?? objectId} (${interaction})`)
})

chatForm?.addEventListener("submit", (event) => {
  event.preventDefault()
  const text = chatInput?.value.trim()
  if (!text) return
  engine.say(engine.viewer?.id ?? "viewer", text)
  if (chatInput) chatInput.value = ""
})

document.querySelector("#summon")?.addEventListener("click", () => {
  const meeting = engine.map.zones.find((zone) => zone.kind === "meeting")
  if (!meeting) return
  for (const character of engine.characters.values()) {
    if (character.kind !== "agent") continue
    engine.direct(character.id, { type: "goToZone", zoneId: meeting.id })
    engine.direct(character.id, { type: "status", text: "heading to standup" })
  }
  log("summoned every agent to the boardroom")
})

document.querySelector("#disperse")?.addEventListener("click", () => {
  for (const character of engine.characters.values()) {
    if (character.kind !== "agent") continue
    engine.direct(character.id, { type: "sitAtDesk" })
  }
  log("agents sent back to their desks")
})

if (buildSelect) {
  for (const kind of FURNITURE_KINDS) {
    const option = document.createElement("option")
    option.value = kind
    option.textContent = kind
    buildSelect.append(option)
  }
}

buildToggle?.addEventListener("click", () => {
  building = !building
  buildToggle.textContent = building ? "Build: on" : "Build: off"
  buildToggle.classList.toggle("active", building)
})

// Build mode intercepts clicks before the engine routes the player.
canvas.addEventListener(
  "pointerdown",
  (event) => {
    if (!building) return
    event.stopPropagation()
    const rect = canvas.getBoundingClientRect()
    const world = engine.renderer.camera.screenToWorld(
      (event.clientX - rect.left) * (canvas.width / rect.width),
      (event.clientY - rect.top) * (canvas.height / rect.height),
    )
    const kind = (buildSelect?.value ?? "plant-small") as FurnitureKind
    const result = placeFurniture(engine.map, kind, Math.floor(world.x / 16), Math.floor(world.y / 16))
    log(result.ok ? `placed ${kind}` : `cannot place ${kind}: ${result.reason}`)
  },
  { capture: true },
)

await engine.start()
