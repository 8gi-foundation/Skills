#!/usr/bin/env bun
// ResponseDeck.hook.ts
// Stop hook: turn a substantive response into a narrated deck.
//
// James's standing instruction: long text does not get read. A deck does.
// This hook decides whether a response earns one, then hands the work to
// ~/.claude/bin/response-to-deck in a DETACHED background process and returns
// immediately. A deck takes two to four minutes to render; the turn must not
// wait for it. The turn ends now, the video lands in Telegram later.
//
// This hook is deliberately separate from SessionCompleteVoice.hook.ts. The
// Voice Contract is load-bearing and already tested; nothing here touches it.
//
// Policy lives here. Content quality lives in the renderer.
//   gate (renderer):  >=2500 chars AND strong structure AND >=6 content slides
//   rate  (here):     1 deck per 25 minutes, 6 per day, one at a time
//   quiet hours:      renderer still delivers, silently. Never a voice note.

import { spawn } from "child_process"
import { readFileSync, writeFileSync, existsSync, mkdtempSync, openSync, closeSync, unlinkSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

const HOME = process.env.HOME || ""
const RENDERER = process.env.DECK_RENDERER || join(HOME, ".claude/bin/response-to-deck")
const STATE = join(HOME, ".claude/hooks/.response-deck-state.json")
const LOCK = join(HOME, ".claude/hooks/.response-deck.lock")

const MIN_INTERVAL_MS = 25 * 60 * 1000
const MAX_PER_DAY = 6

// Mirrors the renderer's gate cheaply, so the common case costs no subprocess.
// The renderer re-runs the real gate (it also counts slides) before rendering.
// MUST track the renderer's MIN_CHARS. On 2026-08-09 the renderer moved to
// 1800 and this mirror stayed at 2500, so milestone responses died here and
// never reached the renderer - two decks James expected simply did not exist.
const MIN_CHARS = 1800

// Every invocation writes ONE line here with its verdict. Six silent exit
// paths made a gate-fail indistinguishable from a non-fire, which cost an
// afternoon of "wtf, where is my deck". Silence is never a valid outcome.
const LOG = join(HOME, ".claude/hooks/.response-deck.log")
function logLine(msg: string): void {
  try {
    const line = `${new Date().toISOString()} hook ${msg}\n`
    writeFileSync(LOG, line, { flag: "a" })
  } catch { /* logging must never break the hook */ }
}

interface StopPayload {
  stop_hook_active?: boolean
  transcript_path?: string
  response?: string
  last_assistant_message?: string
}

function getLastAssistantResponse(transcriptPath: string): string | null {
  try {
    if (!existsSync(transcriptPath)) return null
    const lines = readFileSync(transcriptPath, "utf-8").trim().split("\n").reverse()
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.type === "assistant" && entry.message?.content) {
          const content = entry.message.content
          if (typeof content === "string") return content
          if (Array.isArray(content)) {
            const text = content.filter((b: any) => b.type === "text")
            if (text.length) return text.map((b: any) => b.text).join("\n")
          }
        }
      } catch { continue }
    }
  } catch { return null }
  return null
}

/** Cheap pre-gate. Identical thresholds to the renderer, minus the slide count. */
// Kept in lockstep with the renderer's gate() in bin/response-to-deck. This
// mirror drifted twice on 2026-08-09 (floor 2500 vs 1800, then structure
// blind to bold leads and tables) and each drift silently ate decks James
// was waiting for. If you touch one gate, touch both.
function looksDeckWorthy(src: string): boolean {
  if (src.trim().length < MIN_CHARS) return false
  const signoff = /^\s*SIGN-OFF:/m.test(src) || /^\s{2,}VOICE:\s*say/m.test(src) || /^\s*VALUE:/m.test(src)
  const numbered = (src.match(/^\s*(?:\d+[.)]|\*\*\d+[.)])\s+\S/gm) || []).length
  const heads = (src.match(/^#{1,3}\s+\S/gm) || []).length
  const boldLeads = (src.match(/^\*\*[^*\n]{3,90}\*\*/gm) || []).length
  const tables = (src.match(/^\|.+\|$/gm) || []).length >= 3 ? 1 : 0
  const structure = heads + boldLeads + tables
  return structure >= 3 || numbered >= 5 || (signoff && structure >= 2)
}

interface State { last: number; day: string; count: number }

function readState(): State {
  try { return JSON.parse(readFileSync(STATE, "utf-8")) } catch { return { last: 0, day: "", count: 0 } }
}

/**
 * Claim a render slot, atomically enough that twenty concurrent officer
 * sessions ending at once produce one deck rather than twenty. O_EXCL on the
 * lock file is the mutex; a stale lock older than 15 minutes is reclaimed.
 */
function claimSlot(): { ok: boolean; why: string } {
  let fd: number
  try {
    fd = openSync(LOCK, "wx")
  } catch {
    try {
      const age = Date.now() - Number(readFileSync(LOCK, "utf-8").trim() || 0)
      if (age > 15 * 60 * 1000) { unlinkSync(LOCK); fd = openSync(LOCK, "wx") }
      else return { ok: false, why: "another session is claiming a slot" }
    } catch { return { ok: false, why: "lock contention" } }
  }
  try {
    writeFileSync(LOCK, String(Date.now()))
    const s = readState()
    const today = new Date().toISOString().slice(0, 10)
    if (s.day !== today) { s.day = today; s.count = 0 }
    if (s.count >= MAX_PER_DAY) return { ok: false, why: `daily cap reached (${MAX_PER_DAY})` }
    const since = Date.now() - (s.last || 0)
    if (since < MIN_INTERVAL_MS) {
      return { ok: false, why: `rate limited (${Math.round((MIN_INTERVAL_MS - since) / 60000)} min to go)` }
    }
    s.last = Date.now()
    s.count += 1
    writeFileSync(STATE, JSON.stringify(s))
    return { ok: true, why: `slot ${s.count}/${MAX_PER_DAY} today` }
  } finally {
    try { closeSync(fd!) } catch { /* already closed */ }
    try { unlinkSync(LOCK) } catch { /* already gone */ }
  }
}

async function main() {
  try {
    const stdinData = await Bun.stdin.text()
    if (!stdinData.trim()) process.exit(0)
    const payload: StopPayload = JSON.parse(stdinData)

    let responseText = payload.last_assistant_message || payload.response
    if (!responseText && payload.transcript_path) {
      responseText = getLastAssistantResponse(payload.transcript_path) || undefined
    }
    if (!responseText) { logLine("skip: no response text in payload or transcript"); process.exit(0) }
    if (!looksDeckWorthy(responseText)) {
      logLine(`skip: pre-gate (${responseText.trim().length} chars, floor ${MIN_CHARS})`)
      process.exit(0)
    }

    const slot = claimSlot()
    if (!slot.ok) { logLine(`skip: ${slot.why}`); process.exit(0) }
    logLine(`fire: ${slot.why} (${responseText.trim().length} chars)`)

    // Hand off and get out of the way. The renderer runs the full gate, builds
    // the deck, calls deck2video, and delivers. Nothing here waits on it.
    //
    // PATH is set explicitly: the hook runs in a minimal environment where
    // pyenv shims (supertonic), Homebrew (ffmpeg) and python3 are absent, so
    // a bare spawn renders nothing and - before this line existed - said
    // nothing either. The renderer's output now lands in the shared log.
    const dir = mkdtempSync(join(tmpdir(), "response-deck-"))
    const src = join(dir, "response.md")
    writeFileSync(src, responseText)

    const fullPath = [
      `${HOME}/.pyenv/shims`, "/opt/homebrew/bin", "/opt/homebrew/sbin",
      `${HOME}/.bun/bin`, 
      "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin",
    ].join(":")
    const child = spawn(
      "sh",
      ["-c", `export PATH="${fullPath}"; "${RENDERER}" --file "${src}" >> "${LOG}" 2>&1; rm -rf "${dir}"`],
      { detached: true, stdio: "ignore" },
    )
    child.unref()
  } catch (error) {
    logLine(`error: ${String(error).slice(0, 300)}`)
    console.error("Response deck hook error:", error)
  }
  process.exit(0)
}

main()
