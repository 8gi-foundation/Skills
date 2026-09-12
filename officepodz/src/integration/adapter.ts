import type { PetKind } from "../art/pets.js"
import type { AvatarStyle } from "../art/avatar.js"
import type { EntityId, OccupantKind, PresenceState, Unsubscribe, ZoneId } from "../core/types.js"

/**
 * The seam between OfficePodz and the host work operating system.
 *
 * This is the whole integration surface. OfficePodz never queries a database,
 * never owns identity, and never decides what an agent is doing. The host feeds
 * occupants and activity in; OfficePodz reports where bodies went and what they
 * bumped into. Implement this interface against whatever you already run and
 * the office lights up.
 */

export interface OccupantRecord {
  id: EntityId
  name: string
  kind: OccupantKind
  /** Title for a person, specialism for an agent. Shown on the nameplate. */
  role?: string
  presence: PresenceState
  /** Free text shown in a status chip, for example "reviewing PR 214". */
  status?: string
  /** Home room. Idle agents drift around it. */
  zoneId?: ZoneId
  /** Desk object id, if the host assigns seats. */
  deskId?: string
  /** Override the generated look. Leave unset to derive it from the id. */
  style?: AvatarStyle
  /** Pets only. */
  petKind?: PetKind
  ownerId?: EntityId
}

/** Something the host wants shown in the world right now. */
export type ActivitySignal =
  | { kind: "say"; occupantId: EntityId; text: string }
  | { kind: "status"; occupantId: EntityId; text: string }
  | { kind: "emote"; occupantId: EntityId; text: string }
  | { kind: "presence"; occupantId: EntityId; presence: PresenceState }
  | { kind: "summon"; occupantId: EntityId; zoneId: ZoneId }
  | { kind: "sit"; occupantId: EntityId; deskId?: string }
  | { kind: "roam"; occupantId: EntityId }

/** Something that happened in the world that the host may care about. */
export type WorldSignal =
  | { kind: "entered-zone"; occupantId: EntityId; zoneId: ZoneId; binding?: string }
  | { kind: "left-zone"; occupantId: EntityId; zoneId: ZoneId; binding?: string }
  | { kind: "nearby"; occupantId: EntityId; otherIds: EntityId[] }
  | { kind: "interacted"; occupantId: EntityId; objectId: string; interaction: string }
  | { kind: "spoke"; occupantId: EntityId; text: string; zoneId?: ZoneId }
  | { kind: "moved-object"; objectId: string; x: number; y: number }

export interface WorkOSAdapter {
  /** Who is driving this client. */
  getViewer(): Promise<OccupantRecord>
  /** Everyone who should appear right now. */
  listOccupants(): Promise<OccupantRecord[]>
  /** Live roster updates. Return a detach function. */
  subscribeOccupants(handler: (occupants: OccupantRecord[]) => void): Unsubscribe
  /** Live activity: what agents are saying and doing. */
  subscribeActivity(handler: (signal: ActivitySignal) => void): Unsubscribe
  /** OfficePodz reports back through here. Fire and forget. */
  report(signal: WorldSignal): void
  /** Optional: persist furniture moves so the office stays how the team left it. */
  saveLayout?(objects: unknown): Promise<void>
}

/**
 * An adapter that invents a plausible office.
 *
 * Useful for the demo, for storybook, and as the reference implementation to
 * read before writing a real one. It never touches the network.
 */
export function createMockAdapter(options: {
  viewerName?: string
  agents?: { id: string; name: string; role: string }[]
  pets?: { id: string; name: string; kind: PetKind; ownerId?: string }[]
} = {}): WorkOSAdapter {
  const viewer: OccupantRecord = {
    id: "viewer",
    name: options.viewerName ?? "You",
    kind: "human",
    role: "Operator",
    presence: "online",
  }

  const agents: OccupantRecord[] = (
    options.agents ?? [
      { id: "agent-donna", name: "Donna", role: "Orchestrator" },
      { id: "agent-winston", name: "Winston", role: "Inventory" },
      { id: "agent-john", name: "John", role: "Finance" },
      { id: "agent-mary", name: "Mary", role: "Operations" },
      { id: "agent-connor", name: "Connor", role: "Compliance" },
      { id: "agent-sage", name: "Sage", role: "Design" },
    ]
  ).map((agent) => ({ ...agent, kind: "agent" as OccupantKind, presence: "online" as PresenceState }))

  const pets: OccupantRecord[] = (
    options.pets ?? [
      { id: "pet-mochi", name: "Mochi", kind: "cat" as PetKind, ownerId: "agent-donna" },
      { id: "pet-rusty", name: "Rusty", kind: "dog" as PetKind, ownerId: "viewer" },
      { id: "pet-bit", name: "Bit", kind: "robot" as PetKind, ownerId: "agent-winston" },
    ]
  ).map((pet) => ({
    id: pet.id,
    name: pet.name,
    kind: "pet" as OccupantKind,
    presence: "online" as PresenceState,
    petKind: pet.kind,
    ...(pet.ownerId ? { ownerId: pet.ownerId } : {}),
  }))

  const roster = [viewer, ...agents, ...pets]
  const chatter = [
    "Par levels look thin on ribeye.",
    "Cost variance is inside tolerance this week.",
    "HACCP log signed off for the morning shift.",
    "Two supplier invoices need a second pair of eyes.",
    "Pulling the waste report before standup.",
    "Cold chain held overnight, no excursions.",
  ]

  let activityHandler: ((signal: ActivitySignal) => void) | undefined
  let timer: ReturnType<typeof setInterval> | undefined

  return {
    async getViewer() {
      return viewer
    },
    async listOccupants() {
      return roster
    },
    subscribeOccupants(handler) {
      handler(roster)
      return () => {}
    },
    subscribeActivity(handler) {
      activityHandler = handler
      timer = setInterval(() => {
        const agent = agents[Math.floor(Math.random() * agents.length)]
        const text = chatter[Math.floor(Math.random() * chatter.length)]
        activityHandler?.({ kind: "say", occupantId: agent.id, text })
      }, 7000)
      return () => {
        if (timer) clearInterval(timer)
        activityHandler = undefined
      }
    },
    report() {
      // The mock host is not listening. A real one would fan this out.
    },
  }
}
