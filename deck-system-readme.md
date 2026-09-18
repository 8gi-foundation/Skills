# deck-system — narrated video decks from Claude Code sessions

> Your agent finishes a serious piece of work and, two minutes later, a narrated 90-second MPV deck lands on your machine. You watch it instead of reading a wall of text.

Built and battle-tested in the 8GI harness; packaged here so anyone on Claude Code can run it.

---

## What you get

- **A Stop hook** that watches every response. Substantive ones (≥1800 chars with real structure) earn a deck; chatter doesn't. Rate-limited to 1 per 25 minutes, 6 per day, one render at a time — twenty sessions ending at once produce one deck, not twenty.
- **A renderer** that maps markdown to slides: headings become titles, bold leads become numbered points, tables and code blocks get their own slides, a `SIGN-OFF:` block becomes the closing manifest. Narration is rewritten for the ear — it never reads `->`, `#551`, or a 90-character path aloud.
- **A video pipeline**: headless Chrome screenshots each slide at 1920×1080, your Mac's TTS narrates it, ffmpeg assembles the MP4 with crossfades and a soft pad underneath.
- **Zero cloud dependencies.** Everything renders locally. No API keys required.

## Requirements

| Dependency | Why | Install |
|---|---|---|
| macOS | narration uses the built-in `say` engine | — |
| [bun](https://bun.sh) | runs the hook + renderer | `curl -fsSL https://bun.sh/install \| bash` |
| python3 | deck2video pipeline | Xcode CLT |
| ffmpeg | video assembly | `brew install ffmpeg` |
| Google Chrome | headless slide screenshots | google.com/chrome |

## Install

```bash
git clone https://github.com/8gi-foundation/Skills.git
bash Skills/deck-system/install.sh
```

The installer checks dependencies, copies four files into `~/.claude/`, registers the Stop hook in `~/.claude/settings.json`, and runs the renderer's self-test. Re-running is safe. It touches nothing else.

## Try it immediately

```bash
# render any markdown file into a deck by hand
bun run ~/.claude/bin/response-to-deck --file some-response.md

# would this response earn a deck? (exit 0 = yes)
bun run ~/.claude/bin/response-to-deck --file some-response.md --gate-only

# see the slide plan without rendering
bun run ~/.claude/bin/response-to-deck --file some-response.md --plan
```

Finished MP4s land in `~/.8gent/creative/` (override with `DECK_OUT_DIR=...`).

## Where's my deck?

Every hook invocation writes one line to `~/.claude/hooks/.response-deck.log` with its verdict — fired, gate-fail (with the char count), rate-limited, or daily cap. If a deck you expected doesn't exist, the log says why. Renders take 2–4 minutes after the turn ends.

## Optional: Telegram delivery

Add to `~/.claude/.env`:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Finished decks are then also sent to that chat as inline videos. Without these, nothing leaves your machine.

## Optional: neural voices

If you install [Supertonic](https://github.com/supertone-inc) or [KittenTTS](https://github.com/KittenML), `deck2video.py --tts neural` uses them for noticeably better narration, with per-slide fallback to `say` when an engine fails. The `say` default needs no setup at all.

## Teach your agent to earn decks

The gate rewards structure. Ending substantive responses with a `SIGN-OFF:` block and a `VALUE:` block (GOT / JOB / SKILL / LEARNED / ASK — honest "Not stated" beats invented filler) gives the renderer a proper closing spine. See `deck-system.md` for the format your agent should follow.
