# 8GI Skills

**What this is:** six markdown capability files for coding-agent harnesses. Each file is a self-contained set of instructions that changes how an agent behaves for the rest of a session.

**Who it is for:** developers running an agent harness that loads skills from a directory as markdown files with YAML frontmatter.

**How to run it:** copy the file you want into your harness's skills directory as `SKILL.md`, then invoke it by name. Full steps below. There is nothing to install and no dependencies.

Built by the [8GI Foundation](https://github.com/8gi-foundation).

---

## Skills

| File | Invoked as | What it does |
|------|-----------|--------------|
| [`no-bs.md`](./no-bs.md) | `/no-bs` | Forces a crisp problem statement, hard constraints, explicit tradeoffs, and a GO / NO-GO decision |
| [`boardroom.md`](./boardroom.md) | `/boardroom` | Reads your git history and working patterns, then assembles a set of named advisor agents aimed at the gaps it finds |
| [`voice.md`](./voice.md) | `/voice` | Speaks task completions, decisions, and warnings aloud using the operating system's built-in TTS |
| [`github-workflow.md`](./github-workflow.md) | loaded by the agent | Issue-first GitHub loop: issues, branch naming, CI, PR template, browser testing, preview-deploy validation |
| [`voice-signoff.md`](./voice-signoff.md) | loaded by the agent | Structured sign-off block at the end of a task, plus a spoken summary |
| [`context-window.md`](./context-window.md) | loaded by the agent | How to read the context indicator, what consumes token budget, and how to keep a long session usable |

The first three carry `user_invocable: true` in their frontmatter, so a harness that supports slash invocation exposes them directly. The other three carry a `description` only and are meant to be pulled in by the agent when the described situation comes up.

Two longer write-ups sit alongside the skills: [`boardroom-readme.md`](./boardroom-readme.md) and [`voice-readme.md`](./voice-readme.md).

---

## Install

Set `SKILLS_DIR` to the directory your harness loads skills from, then copy in whichever files you want. Most harnesses expect one directory per skill containing a `SKILL.md`.

```bash
git clone https://github.com/8gi-foundation/Skills.git
cd Skills

SKILLS_DIR="$HOME/.agents/skills"   # change this to your harness's skills directory

for skill in no-bs boardroom voice github-workflow voice-signoff context-window; do
  mkdir -p "$SKILLS_DIR/$skill"
  cp "$skill.md" "$SKILLS_DIR/$skill/SKILL.md"
done
```

Then invoke the slash-invocable ones from your session:

```
/no-bs should we rewrite the auth layer?
/boardroom setup
/voice
```

If your harness reads skills straight from a flat directory rather than one folder per skill, copy the `.md` files in as they are.

---

## Why this exists

Out of the box, a coding agent has no opinions. It agrees too readily, it does not push back on a weak plan, and it loses the thread of what you were trying to do. These files are the opinionated layer on top: each one states a hard constraint and a required output shape, so the behaviour is repeatable rather than a matter of how you happened to phrase the prompt.

They came out of building [8gent Jr](https://8gentjr.com), a free AI operating system for neurodivergent children, and [8gent Code](https://github.com/8gi-foundation/8gent-code), an open-source autonomous coding agent.

The 8GI Foundation's position is that AI should be:

- **Free by default.** No paywall to start.
- **Local-first.** Your data stays on your machine.
- **Opinionated.** A tool with a point of view is more useful than one without.

The governance framework for that architecture is the [8gent Constitution](https://8gent.world/constitution).

Questions, or want to talk about building tools for underserved communities: open an issue here, or reach James Spalding at [@podjamz](https://github.com/podjamz) on GitHub or [@james__spalding](https://x.com/james__spalding) on X.

---

## Contributing

Open a PR. A skill is one markdown file with YAML frontmatter carrying at least a `name` and a `description`, followed by the instructions themselves. Keep the instructions concrete and include usage examples.

---

## License

This repository has no LICENSE file, so no open-source licence is granted. All rights reserved by the 8GI Foundation. If you want to reuse or redistribute any of it, open an issue and ask.
