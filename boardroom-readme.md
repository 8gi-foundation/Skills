# /boardroom — Custom AI Advisory Board

> Build a boardroom of AI agents around *your* leadership weaknesses — not generic personas, but advisors assembled from your actual patterns.

Most developers have the same 2–3 blind spots. They avoid the thing they're weakest at, rush past it, and build up debt there instead. `/boardroom setup` finds yours by reading your git history, code patterns, and conversation behaviour. Then it creates named advisors designed specifically to challenge you where you're actually weak.

---

## Quick Start

```
/boardroom setup
```

Claude will analyse your patterns and assemble your board. Then:

```
/boardroom should we add a caching layer to this API?
```

Your board convenes, each advisor speaks from their angle, and they vote GO / NO-GO.

---

## How the Setup Works

Claude reads signals from your environment:

- **Git history** — commit frequency, message quality, whether tests and docs appear
- **File structure** — presence of CI config, error handling, test coverage
- **Recent conversation** — what you rush past, what you avoid asking about
- **Code patterns** — hardcoded values, TODO density, missing validation

From those signals it identifies your top failure modes:

| Failure Mode | What It Looks Like |
|---|---|
| Vision drift | Starts strong, scope creeps, ships something different |
| Speed trap | Fast velocity, but rework debt accumulates |
| Complexity bias | Abstracts before proving the concept |
| Security blindspot | Ships without thinking about attack surface |
| Product disconnect | Builds features, skips user validation |
| Documentation debt | Knowledge lives only in the builder's head |
| Testing avoidance | Relies on manual QA, no test coverage |
| Deployment blindness | Works locally, ignores prod behaviour |

An advisor is assigned to each of your top 4–6 patterns, with a name, mandate, signature challenge question, and speaking style.

---

## Board Session Format

```
BOARDROOM SESSION
=================
Topic: [your question]

ADVISOR NAME (Role):
[Perspective. Challenge. Signature question if relevant.]

ADVISOR NAME (Role):
[Agrees or disagrees with previous advisor. Raises a concrete risk.]

[All advisors speak in sequence]

─────────────────────────────────────────
BOARD VOTE

[Name]: GO / NO-GO — reason
[Name]: GO / NO-GO — reason

RESULT: GO / NO-GO / CONDITIONAL GO
Condition: [what must be true before proceeding]
```

---

## Hard Rules for the Board

- Advisors must disagree with each other sometimes — unanimous boards are useless
- Every advisor must raise a concrete concern, not generic validation
- The board exists to surface what you'd otherwise ignore — they are not there to be liked
- Setup is based on observed evidence, not assumptions

---

## Install

```bash
mkdir -p ~/.claude/skills/boardroom
curl -o ~/.claude/skills/boardroom/SKILL.md \
  https://raw.githubusercontent.com/8gi-foundation/Skills/main/boardroom.md
```

Then in Claude Code: `/boardroom setup`

---

## About

This skill came out of building [8gent Code](https://github.com/8gi-foundation/8gent-code) — an open-source autonomous coding agent by the 8GI Foundation. The boardroom pattern emerged from running multi-agent sessions where different agents with different mandates produced sharper decisions than any single agent alone.

If you're interested in local-first AI agents, autonomous coding tools, or building AI for communities that can't pay for it — [the 8gent Code repo](https://github.com/8gi-foundation/8gent-code) has a manifesto worth reading.
