# 8GI Skills

> **Prompt engineering skills for Claude Code** — built by the [8GI Foundation](https://github.com/8gi-foundation).

These are slash-command skills that plug directly into [Claude Code](https://claude.ai/code). Each one is a single markdown file you drop into `~/.claude/skills/` and call from your terminal.

No installs. No dependencies. Just better AI sessions.

---

## Skills

| Skill | Install | What It Does |
|-------|---------|-------------|
| [`/no-bs`](./no-bs.md) | `no-bs.md` | Forces crisp problem statements, hard constraints, explicit tradeoffs, and GO / NO-GO decisions |
| [`/boardroom`](./boardroom.md) | `boardroom.md` | Analyzes your patterns and builds a custom advisory board of AI agents around your leadership weaknesses |
| [`/voice`](./voice.md) | `voice.md` | Gives Claude a spoken voice during sessions — macOS, Windows, and Linux supported |

---

## Install Any Skill

```bash
# Clone the repo
git clone https://github.com/8gi-foundation/Skills.git
cd Skills

# Install a skill (macOS/Linux)
mkdir -p ~/.claude/skills/no-bs
cp no-bs.md ~/.claude/skills/no-bs/SKILL.md

mkdir -p ~/.claude/skills/boardroom
cp boardroom.md ~/.claude/skills/boardroom/SKILL.md

mkdir -p ~/.claude/skills/voice
cp voice.md ~/.claude/skills/voice/SKILL.md
```

Then in Claude Code:

```
/no-bs should we rewrite the auth layer?
/boardroom setup
/voice
```

---

## Why This Exists

Claude Code is the most powerful coding tool most engineers have ever touched. But out of the box, it has no opinions. It agrees too easily. It doesn't push back. It forgets what you were trying to do. It speaks in text when it could speak in voice.

These skills are the opinionated layer on top.

They came out of building [8gent Jr](https://8gentjr.com) — a free AI operating system for neurodivergent children — and [8gent Code](https://github.com/8gi-foundation/8gent-code), an open-source autonomous coding agent.

The 8GI Foundation believes AI should be:
- **Free by default** — no paywalls to start
- **Local-first** — your data stays on your machine
- **Opinionated** — tools that have a point of view are more useful than tools that don't

If that thesis resonates with you, [read the 8gent Code manifesto](https://github.com/8gi-foundation/8gent-code) — it's the kernel of an AI architecture that runs locally, learns continuously, and doesn't need an API key to work.

If you want to talk about any of it — the skills, the mission, building AI tools for underserved communities — reach out to James Spalding [@jamesspalding](https://github.com/jamesspalding) or open an issue here.

---

## Contributing

Open a PR. A skill is just a markdown file with a clear name, description, and concrete usage examples. If it makes Claude sharper in your sessions, it'll make Claude sharper in everyone's.

---

## License

MIT. Use it, fork it, improve it.
