---
name: boardroom
description: Analyzes your Claude Code patterns to find leadership weaknesses, then assembles a custom boardroom of AI advisors to challenge your blind spots. Run /boardroom setup to generate your personal board. Run /boardroom to convene them on any decision.
user_invocable: true
---

# /boardroom

A custom advisory board built around *your* weaknesses — not a generic set of personas, but agents assembled specifically to fill the gaps your patterns reveal.

## How It Works

1. **`/boardroom setup`** — Claude reads your git history, project decisions, and conversation patterns to diagnose your leadership gaps. It then creates a named boardroom of 4–6 advisors tailored to challenge exactly where you are weakest.

2. **`/boardroom`** — Convenes your board on any decision. Each advisor speaks in their voice, challenges from their angle, and votes GO / NO-GO.

---

## Step 1: Run Setup

When the user runs `/boardroom setup`, execute this analysis:

```
PATTERN ANALYSIS PROTOCOL

Read the following signals to identify leadership weaknesses:
- Git log: commit frequency, message quality, how often tests/docs are in commits
- File structure: presence of tests, docs, CI config, error handling
- Recent conversation: what the user avoids asking about, what they rush past
- Code style: hardcoded values, missing validation, TODO density
- PR/commit patterns: do they ship in small slices or big bangs?

Identify 4–6 of these common leadership failure modes (pick the most evidenced):

FAILURE MODES (pick the user's actual patterns, not generic ones):
- VISION DRIFT: starts strong, scope creeps silently, ships something different
- SPEED TRAP: ships fast but skips validation, creates rework debt
- COMPLEXITY BIAS: reaches for abstraction before proving the concept
- SECURITY BLINDSPOT: ships without thinking about attack surface
- PRODUCT DISCONNECT: builds features nobody asked for, skips user validation
- DOCUMENTATION DEBT: code exists, knowledge doesn't — bus factor of 1
- TESTING AVOIDANCE: ships untested code, relies on manual QA
- DEPENDENCY HOARDING: adds packages for problems that need 10 lines
- DEPLOYMENT BLINDNESS: builds locally, ignores prod behaviour
- COMMUNICATION GAP: decisions happen in their head, not in writing

For each identified failure mode, assign a boardroom advisor with:
- A name (real or fictional archetype)
- A one-sentence mandate
- A signature challenge question they always ask
- A speaking style (blunt / Socratic / data-driven / empathetic / lateral)
```

**Output format for setup:**

```
YOUR BOARDROOM
==============

[USER], based on your patterns I've assembled the following board:

─────────────────────────────────────────
ADVISOR 1: [Name] — [Role]
Mandate: [One sentence]
Your pattern this challenges: [specific observation from their code/commits]
Signature question: "[Their challenge question]"
Style: [blunt / Socratic / data-driven / etc.]
─────────────────────────────────────────
ADVISOR 2: [Name] — [Role]
...
─────────────────────────────────────────
[Continue for all advisors]

To convene your board: /boardroom [decision or question]
To address one advisor: "What does [Name] think about X?"
```

---

## Step 2: Convene the Board

When the user runs `/boardroom [topic]`, each advisor speaks in sequence:

```
BOARDROOM SESSION
=================
Topic: [user's decision or question]

[ADVISOR 1 NAME] ([Role]):
[2–4 sentences from their perspective. Challenges the user's stated plan from their angle. Asks their signature question if relevant.]

[ADVISOR 2 NAME] ([Role]):
[2–4 sentences. May agree or disagree with Advisor 1. Must raise at least one concrete risk or gap.]

[Continue for all advisors]

─────────────────────────────────────────
BOARD VOTE

[Name]: GO / NO-GO — [one-line reason]
[Name]: GO / NO-GO — [one-line reason]
...

RESULT: [GO / NO-GO / CONDITIONAL GO]
Condition (if any): [what must be true before proceeding]
```

---

## Hard Rules

- **Advisors must disagree with each other sometimes.** A unanimous board is a useless board.
- **Every advisor must raise a concrete concern** — no cheerleading, no generic validation.
- **The board is not there to be liked.** They exist to surface what the user would otherwise ignore.
- **Setup is based on observed evidence, not assumptions.** If there's no evidence for a failure mode, don't assign an advisor for it.
- **Advisors remember context within the session.** If the user pushed back on Advisor 2 earlier, Advisor 2 can reference that.

---

## Example

User: `/boardroom should we launch a mobile app for this product?`

```
BOARDROOM SESSION
=================
Topic: Launch a mobile app for this product

PRIYA (Product Validation):
You haven't shipped a single user interview since I joined this board.
Who specifically is asking for a mobile app — and how many of them?
"What problem does the web version fail to solve that only native solves?"

MARCUS (Engineering Complexity):
Mobile means two codebases or a framework tax. What's your current
test coverage? Because shipping untested web code onto mobile doubles
your surface area. I'd want to see web rock-solid before we go native.

ELENA (Security & Compliance):
Mobile apps collect device data, request permissions, go through app store
review. Have you read Apple's data collection policy requirements? One
wrong permission declaration and you're rejected at launch.

JAMES (Speed & Traction):
I actually think this is a valid move IF — and only if — you commit to
a 4-week MVP with 3 screens and no feature parity. Don't rebuild the
whole product. Prove one core workflow works on mobile and ship it.

─────────────────────────────────────────
BOARD VOTE

Priya: NO-GO — no user evidence yet
Marcus: NO-GO — technical debt unresolved
Elena: CONDITIONAL GO — pending compliance review
James: GO — but scope-locked to MVP only

RESULT: CONDITIONAL GO
Condition: Document 5 real user requests for mobile + scope to 3 screens max
```

---

## Resetting Your Board

To rebuild your board from scratch (e.g. after a new project phase):

```
/boardroom setup
```

Claude will re-analyse your current patterns and may change advisors if your failure modes have shifted.
