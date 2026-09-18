---
name: deck-system
description: Turns substantive Claude Code responses into narrated MP4 video decks automatically via a Stop hook. Installs a gate + rate-limited hook, a markdown-to-slides renderer, and a deck-to-video pipeline. USE WHEN the user asks to install the deck system, set up video decks for session summaries, or asks why a response did or didn't render a deck.
user_invocable: true
---

# /deck-system

Long session summaries don't get read - a 90-second narrated video does. This skill installs a pipeline that turns any substantive Claude Code response into a narrated MP4 deck, automatically, in the background.

## How it works

```
response ends
   └─ Stop hook (ResponseDeck.hook.ts)
        gate:  >=1800 chars AND real structure (headings / numbered points / SIGN-OFF)
        rate:  max 1 deck per 25 min, 6 per day, one render at a time
   └─ renderer (response-to-deck)  - detached, the turn never waits
        markdown -> 8-slide deck HTML (titles, bullets, tables, code, sign-off manifest)
        narration is written for the ear: no "->", "#551", or file paths read aloud
   └─ deck2video.py
        headless Chrome screenshots each slide, TTS narrates it, ffmpeg assembles
   └─ MP4 lands in ~/.8gent/creative/ (DECK_OUT_DIR to override)
        opens locally; optionally also sent to Telegram if credentials exist
```

## Install

Run the installer and follow what it says:

```bash
bash deck-system/install.sh
```

It checks dependencies (bun, python3, ffmpeg, Chrome), copies four files into `~/.claude/`, and registers the Stop hook in `~/.claude/settings.json`. Re-running is safe.

## When the user asks "where's my deck?"

1. Read `~/.claude/hooks/.response-deck.log` - every invocation writes ONE line with its verdict (fired, gate-fail with char count, rate-limited, daily cap). Silence is never a valid outcome.
2. A deck takes 2-4 minutes to render after the turn ends - it arrives late by design.
3. Test the gate by hand: `bun run ~/.claude/bin/response-to-deck --file resp.md --gate-only` (exit 0 = earns a deck); `--plan` prints the slide plan without rendering.

## Making responses deck-worthy

The gate rewards structure, not length padding: headings, numbered points with bold leads, tables, and a closing `SIGN-OFF:` block. A `VALUE:` block (GOT / JOB / SKILL / LEARNED / ASK) renders as a dedicated 8-slide narrative spine - never invent a field to fill a slide; an honest "Not stated" is the designed value.

## Voices

Narration uses macOS `say` voices out of the box (zero setup). A `data-voice` name per slide maps to a distinct installed voice. If Supertonic or KittenTTS neural engines are installed, `deck2video.py --tts neural` uses them and falls back to `say` per-slide when they fail.

## Optional delivery

Put `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `~/.claude/.env` and finished decks are also sent there as inline videos. Without credentials the pipeline just opens the MP4 locally - nothing is sent anywhere.
