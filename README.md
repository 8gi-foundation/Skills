# 8GI Skills

Prompt engineering skills for Claude Code — built and maintained by the [8GI Foundation](https://github.com/8gi-foundation).

These are slash-command skills designed to work with [Claude Code](https://claude.ai/code). Drop any `.md` file from this repo into your `~/.claude/skills/` directory to use it.

## Skills

| Skill | File | Description |
|-------|------|-------------|
| `/no-bs` | [no-bs.md](./no-bs.md) | Ruthless validator. Forces crisp problem statements, hard constraints, explicit tradeoffs, and concrete decisions. |

## Usage

```bash
# Install a skill
cp no-bs.md ~/.claude/skills/no-bs/SKILL.md

# Use in Claude Code
/no-bs should we build a knowledge graph?
```

## Contributing

Open a PR. Skills should be self-contained markdown files with a clear name, description, and usage examples.
