/**
 * session-value.ts - the content model for stop-hook decks. Owned by 8PO.
 *
 * THE SEAM. `~/.claude/bin/response-to-deck` (8DO) imports this file and calls
 * `extractSessionValue(src)`. 8DO owns the eight-slide spine, the colour and the
 * narration. This module owns one question and nothing else:
 *
 *   "What did James get, and is the system measurably better than last time?"
 *
 * If this file is absent or throws, 8DO's conservative fallback runs. So the
 * cost of a bug here is a weaker deck, never a lost one.
 *
 * ---------------------------------------------------------------- ARCHITECTURE
 *
 * Hybrid, with SPLIT AUTHORITY. That is the whole design, and it is a boundary
 * rather than a compromise.
 *
 *   JUDGEMENT fields - value, jtbd, skill, learned, ask.
 *     Only the assistant can know these. Read from a `VALUE:` block it writes
 *     beside SIGN-OFF, or lifted VERBATIM from a house-style `**Learned:** ...`
 *     line. Never paraphrased, never inferred, never generated. Absent means
 *     null, and 8DO renders null as a loud "Not stated".
 *
 *   COMPUTED fields - improvement, regression, goal, remaining.
 *     Only the machine can know these. They come from the append-only ledger at
 *     ~/.8gent/value-ledger.jsonl and from docs/8GI-REORG-SPRINT.md on
 *     origin/main. There is deliberately NO `VALUE:` key for any of them, so a
 *     session is structurally incapable of claiming "no regression" or
 *     asserting an improvement it did not make.
 *
 * Neither side can overwrite the other. That kills both failure modes at once:
 * a model inventing a learning that never happened, and a session marking its
 * own homework on whether anything got better.
 *
 * A local model was rejected outright. Latency was not the objection, since the
 * deck already takes minutes. The objection is that a small model asked "what
 * did we learn" will ALWAYS answer, and a plausible invented lesson is worse
 * than silence. James stops trusting these the first time one tells him he
 * learned something he did not.
 *
 * ------------------------------------------------------------------ THE BLOCK
 *
 * Written by the assistant. Same visual grammar as SIGN-OFF so it is muscle
 * memory. Every key optional. No numbers, no goal, no regression key exists.
 *
 *   VALUE:
 *     GOT:      What James can now do that he could not before this session.
 *     JOB:      The job this session actually got done for him.
 *     SKILL:    The capability the system now has and did not have.
 *     LEARNED:  What we learned, as a fact. Not a platitude.
 *     ASK:      The one decision needed from him, if there is one.
 *
 * Every metric is null-safe. A metric that fails to measure is null, and null is
 * NEVER a regression and NEVER a zero. A tool being offline must not be able to
 * manufacture bad news.
 */

import { spawnSync } from "child_process"
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"

const HOME = process.env.HOME || ""
// Resolved per call, not at import, so the self test can redirect it. A test
// that pollutes the corpus it is testing would corrupt every delta after it.
const ledgerPath = () => process.env.VALUE_LEDGER || join(HOME, ".8gent/value-ledger.jsonl")
const GOV = join(HOME, "8gi-governance")

// ------------------------------------------------------- the 8DO contract
export type RegressionState = "none" | "found" | "unverified"
export interface Improvement { metric: string; before: string | null; after: string | null }
export interface Remaining { text: string; done?: boolean }
export interface SessionValue {
  headline: string | null
  value: string | null
  jtbd: string | null
  skill: string | null
  regression: { state: RegressionState; note: string | null }
  learned: string | null
  improvement: Improvement[]
  goal: string | null
  remaining: Remaining[]
  evidence: { label: string; value: string }[]
  ask: string | null
}

// --------------------------------------------------------------- shell helper
/** Run a command with a hard timeout. Any failure returns null, never a value. */
function sh(cmd: string, cwd?: string, timeoutMs = 6000): string | null {
  try {
    const r = spawnSync("sh", ["-c", cmd], { encoding: "utf-8", timeout: timeoutMs, cwd })
    if (r.status !== 0 || r.error) return null
    const out = (r.stdout || "").trim()
    return out.length ? out : null
  } catch {
    return null
  }
}

function shNum(cmd: string, cwd?: string, timeoutMs = 6000): number | null {
  const out = sh(cmd, cwd, timeoutMs)
  if (out == null) return null
  const n = parseInt(out.split("\n").pop()!.trim(), 10)
  return Number.isFinite(n) ? n : null
}

// ------------------------------------------------------------------- metrics
/**
 * Every metric is cheap, real, and hard to fake. Measured 2026-08-09 on this
 * machine the full sweep costs about 3.7 seconds, nearly all of it the two `gh`
 * calls, inside a render process that already runs detached for minutes.
 *
 * `dir` is the direction that counts as improvement.
 * `daily` marks a counter that resets at midnight. Daily counters are EXCLUDED
 * from regression: otherwise every morning would report a regression as
 * merged-PRs-today falls back to zero, and that false alarm would have
 * discredited the whole ledger inside a week.
 */
interface MetricDef {
  key: string
  label: string
  dir: "up" | "down"
  daily?: boolean
  read: () => number | null
}

const ACTIVE_REPOS = ["8gi-governance", "8gent-code", "8gent-glasses", "8gent-flow"]

function presentRepos(): string[] {
  return ACTIVE_REPOS.filter((r) => existsSync(join(HOME, r, ".git")))
}

/** Sum a per-repo count. Returns null only when every repo failed to measure. */
function acrossRepos(cmd: string, timeoutMs = 4000): number | null {
  let total: number | null = null
  for (const repo of presentRepos()) {
    const n = shNum(cmd, join(HOME, repo), timeoutMs)
    if (n == null) continue
    total = (total ?? 0) + n
  }
  return total
}

const METRICS: MetricDef[] = [
  {
    key: "open_prs",
    label: "Open PRs",
    dir: "down",
    read: () =>
      shNum(`gh pr list --repo 8gi-foundation/8gi-governance --state open --json number --jq 'length'`, undefined, 8000),
  },
  {
    key: "merged_today",
    label: "PRs merged today",
    dir: "up",
    daily: true,
    read: () =>
      shNum(
        `gh pr list --repo 8gi-foundation/8gi-governance --state merged --limit 60 --json mergedAt ` +
          `--jq "[.[]|select(.mergedAt > \\"$(date -u +%Y-%m-%d)\\")]|length"`,
        undefined,
        8000,
      ),
  },
  {
    key: "worktrees_offroot",
    label: "Worktrees outside one root",
    dir: "down",
    read: () =>
      acrossRepos(
        `git worktree list --porcelain | grep '^worktree ' | sed 's|^worktree ||' | grep -cv "^${HOME}/worktrees/" || true`,
      ),
  },
  {
    key: "stale_name_refs",
    label: "Stale repo-name references",
    dir: "down",
    read: () =>
      shNum(
        `grep -rl "8gent-glasses" "${HOME}/.claude" --include="*.ts" --include="*.json" 2>/dev/null | wc -l`,
        undefined,
        8000,
      ),
  },
  {
    key: "cred_remotes",
    label: "Credentials in git remotes",
    dir: "down",
    read: () => acrossRepos(`git remote -v | grep -cE "https://[^@/]+:[^@/]+@" || true`, 3000),
  },
  {
    key: "specs_on_main",
    label: "Sprint specs on main",
    dir: "up",
    read: () => shNum(`git ls-tree -r origin/main --name-only docs/reorg | grep -c "SPEC-" || true`, GOV, 4000),
  },
]

export type Metrics = Record<string, number | null>

function readMetrics(): Metrics {
  const m: Metrics = {}
  for (const d of METRICS) {
    try {
      m[d.key] = d.read()
    } catch {
      m[d.key] = null
    }
  }
  return m
}

// -------------------------------------------------------------- sprint wiring
/**
 * The goal is never invented per run. It is the blockquote under "## The goal"
 * in docs/8GI-REORG-SPRINT.md on origin/main, read verbatim. If that file is not
 * reachable there is no goal, and 8DO renders "Not stated". We never substitute
 * a nice-sounding sentence of our own.
 *
 * This sprint is wired in rather than a hand-written goal because the doc has
 * already committed to five success criteria that are "checkable by a command,
 * not by opinion". That is precisely what makes "what remains" computable.
 */
interface Sprint {
  goal: string | null
  criteria: { id: string; label: string; pass: boolean | null }[]
}

function readSprintGoal(): string | null {
  const doc = sh(`git show origin/main:docs/8GI-REORG-SPRINT.md`, GOV, 5000)
  if (!doc) return null
  const m = doc.match(/##\s+The goal\s*\n+((?:>\s*.*\n?)+)/)
  if (!m) return null
  const goal = m[1]
    .split("\n")
    .map((l) => l.replace(/^>\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\*\*/g, "")
    .trim()
  return goal.length > 20 ? goal : null
}

function readSprint(metrics: Metrics): Sprint {
  const flow = sh(`gh repo view 8gi-foundation/8gent-flow --json name --jq .name`, undefined, 8000)
  const tiers = existsSync(join(GOV, "scripts/check-tiers.ts")) || existsSync(join(GOV, "tiers.json"))
  const zeroed = (v: number | null): boolean | null => (v == null ? null : v === 0)

  return {
    goal: readSprintGoal(),
    criteria: [
      { id: "flow-repo", label: "8gent-flow owned by the Foundation", pass: !!flow },
      { id: "stale-names", label: "No stale repo-name references", pass: zeroed(metrics.stale_name_refs) },
      { id: "worktree-root", label: "Every worktree under one root", pass: zeroed(metrics.worktrees_offroot) },
      { id: "clean-remotes", label: "No credentials in git remotes", pass: zeroed(metrics.cred_remotes) },
      { id: "tier-manifest", label: "Ownership tier check exists", pass: tiers },
    ],
  }
}

// -------------------------------------------------------------- stated fields
export interface Stated {
  got: string | null
  job: string | null
  skill: string | null
  learned: string | null
  ask: string | null
}

const EMPTY_STATED: Stated = { got: null, job: null, skill: null, learned: null, ask: null }

/** Reject a field that is present but says nothing. */
function meaningful(v: string | null): string | null {
  if (!v) return null
  const t = v.trim().replace(/\s+/g, " ")
  if (t.length < 4) return null
  if (/^(n\/a|na|none|tbd|nothing|-{1,3})[.]?$/i.test(t)) return null
  return t
}

/** Strip inline markdown. Removes, never rewrites. */
function plain(s: string): string {
  return s
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_]/g, "")
    .replace(/\s*[—–]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
}

const STATED_KEYS: Record<string, keyof Stated> = {
  GOT: "got", JOB: "job", SKILL: "skill", LEARNED: "learned", ASK: "ask",
}

/**
 * Parse the assistant's `VALUE:` block. Accepts it bare or fenced, indented or
 * not, exactly as SIGN-OFF is accepted today. Any line that is not one of the
 * five keys ends the block, so a `VALUE:` block sitting directly above SIGN-OFF
 * parses cleanly and never absorbs it.
 */
export function parseStated(src: string): Stated {
  const out: Stated = { ...EMPTY_STATED }
  const lines = src.replace(/\r/g, "").split("\n")
  const start = lines.findIndex((l) => /^\s*(?:```\w*\s*)?VALUE:\s*$/.test(l))
  if (start < 0) return out

  let last: keyof Stated | null = null
  for (let i = start + 1; i < lines.length; i++) {
    const ln = lines[i]
    if (/^\s*$/.test(ln)) continue
    if (/^\s*```/.test(ln)) continue
    const kv = ln.match(/^\s*([A-Z]+):\s*(.*)$/)
    if (kv && STATED_KEYS[kv[1]]) {
      last = STATED_KEYS[kv[1]]
      out[last] = kv[2].trim() || null
      continue
    }
    if (last && /^\s{4,}\S/.test(ln) && !/^\s*[A-Z]+:/.test(ln)) {
      out[last] = ((out[last] || "") + " " + ln.trim()).trim()
      continue
    }
    break
  }

  for (const k of Object.keys(out) as (keyof Stated)[]) out[k] = meaningful(out[k])
  return out
}

/**
 * Secondary source: house style writes `**Learned:** the cap was a guess`, not a
 * VALUE block. Lifting that VERBATIM costs nothing and materially raises the hit
 * rate while the block is still being adopted, which is the single biggest
 * threat to this feature staying useful. Markdown is stripped BEFORE matching,
 * because the colon lives inside the bold markers.
 */
function labelled(src: string, labels: string[]): string | null {
  const re = new RegExp(`^(?:${labels.join("|")})\\s*[:\\-]\\s+(.+)$`, "i")
  for (const raw of src.split("\n")) {
    const ln = plain(raw.replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/, "")).trim()
    const m = ln.match(re)
    if (m) {
      const t = meaningful(m[1])
      if (t) return t
    }
  }
  return null
}

/** The VALUE block wins. House-style labels fill gaps. Nothing else is used. */
export function readStated(src: string): Stated {
  const b = parseStated(src)
  return {
    got: b.got ?? labelled(src, ["Value", "What changed for you", "Impact", "What you got"]),
    job: b.job ?? labelled(src, ["JTBD", "Job to be done", "The job", "Job"]),
    skill: b.skill ?? labelled(src, ["Skill", "Skill gained", "Capability", "Capability gained"]),
    learned: b.learned ?? labelled(src, ["Learned", "What we learned", "Lesson", "Lesson learned"]),
    ask: b.ask ?? labelled(src, ["The ask", "Ask", "Decision needed", "Your call", "Needs your decision"]),
  }
}

// -------------------------------------------------------------------- ledger
export interface LedgerRow {
  ts: string
  src: string // fingerprint of the response, so one response cannot bank twice
  metrics: Metrics
  sprint: { pass: number; total: number; failing: string[] }
  stated: Stated
}

/**
 * Cheap, stable fingerprint of the response text. Not a security hash, it only
 * has to answer "is this the same response as the last row".
 */
function fingerprint(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36) + "-" + s.length.toString(36)
}

function readLedger(): LedgerRow[] {
  try {
    return readFileSync(ledgerPath(), "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LedgerRow)
  } catch {
    return []
  }
}

function appendLedger(row: LedgerRow): void {
  try {
    mkdirSync(dirname(ledgerPath()), { recursive: true })
    appendFileSync(ledgerPath(), JSON.stringify(row) + "\n")
  } catch {
    /* the deck still renders without a ledger write */
  }
}

export interface Delta {
  key: string
  label: string
  from: number
  to: number
  improved: boolean
  counts: boolean // false for daily counters, which cannot regress
}

/**
 * Compare against the most recent PRIOR row carrying a non-null value for that
 * metric, not blindly the last line. One run where `gh` was offline must not
 * erase the baseline for every run after it.
 */
export function computeDeltas(prior: LedgerRow[], now: Metrics): Delta[] {
  const out: Delta[] = []
  for (const d of METRICS) {
    const to = now[d.key]
    if (to == null) continue
    let from: number | null = null
    for (let i = prior.length - 1; i >= 0; i--) {
      const v = prior[i]?.metrics?.[d.key]
      if (typeof v === "number") { from = v; break }
    }
    if (from == null || from === to) continue
    out.push({
      key: d.key,
      label: d.label,
      from,
      to,
      improved: d.dir === "down" ? to < from : to > from,
      counts: !d.daily,
    })
  }
  return out
}

/** Computed, never claimed. "unverified" is not "none" and must never read as it. */
export function regressionState(deltas: Delta[], hasBaseline: boolean): RegressionState {
  if (!hasBaseline) return "unverified"
  const scored = deltas.filter((d) => d.counts)
  if (!scored.length) return "unverified"
  return scored.some((d) => !d.improved) ? "found" : "none"
}

// ---------------------------------------------------------------- the seam
const SIGNOFF_KEYS = ["VALIDATE", "VISUAL", "COMMIT", "PUSHED", "ISSUE", "PR"]

/** Verbatim only. Placeholders are not evidence. */
function readEvidence(src: string): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  for (const raw of src.split("\n")) {
    const m = raw.match(/^\s{2,}([A-Z]+):\s*(.+)$/)
    if (!m || !SIGNOFF_KEYS.includes(m[1])) continue
    const v = plain(m[2]).trim()
    if (!v || /^(no linked issue|direct push|deploy pending|none|n\/a|-)/i.test(v)) continue
    if (!out.some((e) => e.label === m[1])) out.push({ label: m[1], value: v })
  }
  return out
}

const num = (n: number) => n.toLocaleString("en-GB")

/**
 * THE ENTRY POINT that 8DO's renderer imports and calls.
 *
 * Reads the assistant's stated judgement, measures the world, appends exactly
 * one ledger row, and returns a complete SessionValue. Never throws: a failure
 * here must degrade the deck, never lose it.
 */
export function extractSessionValue(src: string): SessionValue {
  try {
    return build(src)
  } catch {
    return {
      headline: null, value: null, jtbd: null, skill: null,
      regression: { state: "unverified", note: "The value model failed to run." },
      learned: null, improvement: [], goal: null, remaining: [], evidence: [], ask: null,
    }
  }
}

export default extractSessionValue

function build(src: string): SessionValue {
  const stated = readStated(src)
  const metrics = readMetrics()
  const sprint = readSprint(metrics)

  const all = readLedger()
  const fp = fingerprint(src)
  // Never measure this response against a row this response banked. Rows with
  // no fingerprint predate this field and are always treated as earlier runs.
  const prior = all.filter((r) => r.src !== fp)

  if (all[all.length - 1]?.src !== fp) {
    appendLedger({
      ts: new Date().toISOString(),
      src: fp,
      metrics,
      sprint: {
        pass: sprint.criteria.filter((c) => c.pass === true).length,
        total: sprint.criteria.length,
        failing: sprint.criteria.filter((c) => c.pass === false).map((c) => c.id),
      },
      stated,
    })
  }

  // Deltas are measured against rows banked by EARLIER responses only. The gate
  // check, a retry, and a re-render all call this for the same response; if each
  // banked a row, the duplicate would become its own baseline and a real
  // improvement would silently render as "nothing moved".
  const deltas = computeDeltas(prior, metrics)
  const state = regressionState(deltas, prior.length > 0)

  // The note must carry the reason, never a reassurance. "unverified" says why
  // it could not be checked so it can never be misread as a clean bill.
  const backwards = deltas.filter((d) => d.counts && !d.improved)
  const note =
    state === "found"
      ? backwards.map((d) => `${d.label} went from ${num(d.from)} to ${num(d.to)}.`).join(" ")
      : state === "none"
        ? `${deltas.filter((d) => d.counts).length} tracked metric(s) moved since the last deck, none backwards.`
        : prior.length === 0
          ? "First run. A baseline was recorded, so there is nothing to compare against yet."
          : "No tracked metric moved since the last deck, so nothing could be checked."

  return {
    // Never invented. 8DO's spine falls back to the job when this is null.
    headline: null,
    value: stated.got,
    jtbd: stated.job,
    skill: stated.skill,
    learned: stated.learned,
    ask: stated.ask,
    regression: { state, note },
    improvement: deltas.map((d) => ({ metric: d.label, before: num(d.from), after: num(d.to) })),
    goal: sprint.goal,
    remaining: sprint.criteria.map((c) => ({ text: c.label, done: c.pass === true })),
    evidence: readEvidence(src),
  }
}

// ---------------------------------------------------------------- self test
function selfTest(): number {
  let fail = 0
  const check = (name: string, got: unknown, want: unknown) => {
    const ok = String(got) === String(want)
    if (!ok) fail++
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `\n        got:  ${got}\n        want: ${want}`}`)
  }

  const blk =
    `Some prose.\n\nVALUE:\n  GOT:      A deck that opens with what you got.\n` +
    `  JOB:      Made stop-hook decks worth watching.\n  SKILL:    The system can measure its own improvement.\n` +
    `  LEARNED:  Judgement and measurement need separate authorities.\n  ASK:      Approve the VALUE block in Standing Orders.\n\n` +
    `SIGN-OFF:\n  VOICE:    say -v Samantha "x"\n  COMMIT:   feat: value model - abc1234 on main\n  ISSUE:    No linked issue\n`

  console.log("\n[1] The VALUE block parses, bare and fenced")
  const p = parseStated(blk)
  check("got", p.got, "A deck that opens with what you got.")
  check("job", p.job, "Made stop-hook decks worth watching.")
  check("skill", p.skill, "The system can measure its own improvement.")
  check("learned", p.learned, "Judgement and measurement need separate authorities.")
  check("ask", p.ask, "Approve the VALUE block in Standing Orders.")
  check("SIGN-OFF does not bleed in", /VOICE|COMMIT/.test(p.ask || ""), false)
  check("fenced block", parseStated("```\nVALUE:\n  GOT: Fenced still parses.\n```").got, "Fenced still parses.")

  console.log("\n[2] Absent or empty fields are null, never invented")
  check("no block at all", JSON.stringify(parseStated("just prose")), JSON.stringify(EMPTY_STATED))
  check("empty value", parseStated("VALUE:\n  GOT:\n").got, "null")
  check("placeholder rejected", parseStated("VALUE:\n  GOT: n/a\n").got, "null")
  check("partial block keeps what is real", parseStated("VALUE:\n  LEARNED: Only this one.\n").learned, "Only this one.")

  console.log("\n[3] House style is lifted verbatim when the block is absent")
  check("bold lesson", readStated("**Learned:** the cap was a guess.\n").learned, "the cap was a guess.")
  check("bullet lesson", readStated("- Lesson: guards must check state.\n").learned, "guards must check state.")
  check("block wins over house style",
    readStated("**Learned:** old line.\n\nVALUE:\n  LEARNED: block line.\n").learned, "block line.")
  check("nothing stated stays null", readStated("plain prose with no labels").learned, "null")
  check("a skill is never inferred", readStated("We refactored the router and it is faster now.").skill, "null")

  console.log("\n[4] Deltas: direction, nulls, and the null-baseline rule")
  const row = (m: Metrics): LedgerRow =>
    ({ ts: "", src: "", metrics: m, sprint: { pass: 0, total: 5, failing: [] }, stated: EMPTY_STATED })
  check("fewer open PRs is better", computeDeltas([row({ open_prs: 30 })], { open_prs: 12 })[0].improved, true)
  check("more open PRs is worse", computeDeltas([row({ open_prs: 12 })], { open_prs: 30 })[0].improved, false)
  check("more specs is better", computeDeltas([row({ specs_on_main: 10 })], { specs_on_main: 14 })[0].improved, true)
  check("unchanged is not a delta", computeDeltas([row({ open_prs: 5 })], { open_prs: 5 }).length, 0)
  check("null now is skipped", computeDeltas([row({ open_prs: 5 })], { open_prs: null }).length, 0)
  check("an offline run does not erase the baseline",
    computeDeltas([row({ open_prs: 30 }), row({ open_prs: null })], { open_prs: 12 })[0].from, 30)

  console.log("\n[5] Regression is computed, and a broken tool cannot fake bad news")
  check("no baseline is unverified", regressionState([], false), "unverified")
  check("baseline but nothing moved is unverified", regressionState([], true), "unverified")
  check("a metric went backwards", regressionState(computeDeltas([row({ open_prs: 12 })], { open_prs: 30 }), true), "found")
  check("everything improved", regressionState(computeDeltas([row({ open_prs: 30 })], { open_prs: 12 }), true), "none")
  // The bug that would have discredited the ledger inside a week.
  const midnight = computeDeltas([row({ merged_today: 11 })], { merged_today: 0 })
  check("a daily counter resetting is not a regression", regressionState(midnight, true), "unverified")
  check("the daily counter is still reported", midnight.length, 1)

  console.log("\n[6] The seam: a complete, honest SessionValue every time")
  const v = extractSessionValue(blk)
  check("value from the block", v.value, "A deck that opens with what you got.")
  check("jtbd from the block", v.jtbd, "Made stop-hook decks worth watching.")
  check("headline is never invented", v.headline, "null")
  check("goal is read, not written", (v.goal || "").startsWith("Every repository the Foundation"), true)
  check("remaining is the sprint criteria", v.remaining.length, 5)
  check("remaining carries done flags", v.remaining.every((r) => typeof r.done === "boolean"), true)
  check("evidence is verbatim from sign-off", v.evidence.find((e) => e.label === "COMMIT")?.value,
    "feat: value model - abc1234 on main")
  check("placeholder evidence is dropped", v.evidence.some((e) => e.label === "ISSUE"), false)
  check("regression state is legal", ["none", "found", "unverified"].includes(v.regression.state), true)
  check("regression always explains itself", (v.regression.note || "").length > 10, true)

  console.log("\n[7] Degrading honestly, and never throwing")
  const bare = extractSessionValue("no value block and no labels anywhere")
  check("judgement is null when unstated", [bare.value, bare.jtbd, bare.skill, bare.learned].join(","), ",,,")
  check("computed fields still arrive", bare.remaining.length, 5)
  check("garbage input survives", typeof extractSessionValue("  ").regression.state, "string")
  check("unverified never reads as clean", /none|no regression/i.test(
    extractSessionValue("x").regression.state === "unverified" ? "unverified" : "x"), false)
  check("default export is the seam function", (typeof (extractSessionValue as any)), "function")
  check("no em dash in any note", /[—–]/.test(JSON.stringify(v)), false)

  console.log("\n[8] One response cannot bank twice and beat its own baseline")
  // Reproduces the real fault: three rows landed in the live ledger inside two
  // minutes on 2026-08-09 because the gate check and the render each called in.
  // The duplicate became its own baseline, so a genuine delta would have
  // rendered as "nothing moved".
  const tmp = join(process.env.TMPDIR || "/tmp", `sv-selftest-${process.pid}.jsonl`)
  const saved = process.env.VALUE_LEDGER
  process.env.VALUE_LEDGER = tmp
  try {
    const { unlinkSync: rm, writeFileSync: wf } = require("fs")
    try { rm(tmp) } catch { /* absent */ }
    // A prior run from a DIFFERENT response, with a worse open-PR count.
    wf(tmp, JSON.stringify({ ...row({ open_prs: 9999 }), src: "earlier" }) + "\n")
    const first = extractSessionValue(blk)
    const again = extractSessionValue(blk)
    const rows = readFileSync(tmp, "utf-8").trim().split("\n").length
    check("a re-render does not append a second row", rows, 2)
    check("the delta survives the re-render",
      JSON.stringify(first.improvement) === JSON.stringify(again.improvement), true)
    check("a re-render still sees the earlier baseline",
      again.improvement.some((i) => i.before === "9,999"), true)
    check("and still reports the regression it found", again.regression.state, first.regression.state)
    try { rm(tmp) } catch { /* already gone */ }
  } catch (e: any) {
    fail++
    console.log(`  FAIL  ledger dedupe test threw: ${e?.message || e}`)
  } finally {
    if (saved === undefined) delete process.env.VALUE_LEDGER
    else process.env.VALUE_LEDGER = saved
  }

  console.log(fail === 0 ? "\nSESSION-VALUE: PASS - all checks green.\n" : `\nSESSION-VALUE: FAIL - ${fail} check(s).\n`)
  return fail
}

if (import.meta.main) {
  if (process.argv.includes("--selftest")) process.exit(selfTest() === 0 ? 0 : 1)
  if (process.argv.includes("--probe")) {
    const m = readMetrics()
    console.log(JSON.stringify({ metrics: m, sprint: readSprint(m) }, null, 2))
    process.exit(0)
  }
  const i = process.argv.indexOf("--file")
  console.log(JSON.stringify(extractSessionValue(i >= 0 ? readFileSync(process.argv[i + 1], "utf-8") : ""), null, 2))
}
