# /voice — Spoken Voice for Claude Code Sessions

> Give Claude a voice. Task completions, warnings, and key decisions are spoken aloud so you can stay in flow without reading every line.

Works on macOS, Windows, and Linux with zero dependencies — just your OS's built-in TTS.

---

## Quick Start

```
/voice
```

Claude detects your platform, lists available voices, and runs a test line. From that point on, task completions are spoken aloud.

---

## Platform Support

| Platform | Engine | Default Voice |
|----------|--------|--------------|
| macOS | `say` | Samantha |
| Windows | PowerShell SAPI | Microsoft Zira |
| Linux | `espeak` / `espeak-ng` | en+f3 |

---

## What Gets Spoken

### Task Completions

Every significant task includes a `🎯 COMPLETED:` line. Claude formats it for the ear, not the eye — short, witty, and specific:

```
🎯 COMPLETED: Surprisingly, it worked. Fixed the 404 on the image endpoint. Committed and pushed. Tests green. Why did the image break? It had boundary issues.
```

**Format rules (25 words max):**
1. Sarcastic or witty opener — makes it memorable, signals the end of work
2. What was done — one sentence, concrete
3. Where — branch / file / URL
4. Status — committed / pushed / live
5. Joke closer — because life is short

### Warnings

Before destructive or hard-to-reverse actions:

```bash
say -v Samantha "Warning: about to drop the users table. This cannot be undone."
```

### Decisions

When a significant architectural decision is made:

```
🔊 DECISION: Chose SQLite over Postgres for this prototype — simpler, zero config, ships in 10 minutes.
```

---

## Voice Commands

| Command | Effect |
|---------|--------|
| `/voice` | Setup — detect platform, list voices, test |
| `/voice off` | Disable for the rest of the session |
| `/voice [name]` | Switch to a specific voice mid-session |
| `/voice test` | Speak a test line |

---

## Platform Commands

**macOS:**
```bash
say -v Samantha "Build complete."

# List voices
say -v '?'

# Good options
# Samantha — clear American, great default
# Karen — Australian, warm
# Daniel — British, measured
# Moira — Irish, distinct
```

**Windows (PowerShell):**
```powershell
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft Zira Desktop")
$s.Speak("Build complete.")

# List voices
$s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
```

**Linux:**
```bash
# Install
sudo apt install espeak-ng   # Ubuntu/Debian (higher quality)
sudo dnf install espeak       # Fedora

# Speak
espeak-ng -v en-us "Build complete."

# Female voice, slower pace
espeak -v en+f3 -s 150 "Build complete."
```

---

## Persist Your Voice

Set `CLAUDE_VOICE` in your shell profile to avoid re-picking every session:

```bash
# ~/.zshrc or ~/.bashrc
export CLAUDE_VOICE="Karen"        # macOS
export CLAUDE_VOICE="en+f3"        # Linux
```

---

## Hook Integration

To make voice output fully automatic, add a hook at `~/.claude/hooks/voice-completion.sh`:

```bash
#!/bin/bash
PLATFORM=$(uname -s)
VOICE="${CLAUDE_VOICE:-Samantha}"

speak() {
  case "$PLATFORM" in
    Darwin)  say -v "$VOICE" "$1" & ;;
    Linux)   espeak "$1" & ;;
    MINGW*|CYGWIN*|MSYS*)
      powershell -Command "Add-Type -AssemblyName System.Speech; \$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; \$s.Speak('$1')" ;;
  esac
}

while IFS= read -r line; do
  if [[ "$line" == *"🎯 COMPLETED:"* ]]; then
    text="${line#*🎯 COMPLETED: }"
    speak "${text:0:350}"
  fi
done
```

```bash
chmod +x ~/.claude/hooks/voice-completion.sh
```

---

## Install

```bash
mkdir -p ~/.claude/skills/voice
curl -o ~/.claude/skills/voice/SKILL.md \
  https://raw.githubusercontent.com/8gi-foundation/Skills/main/voice.md
```

Then in Claude Code: `/voice`

---

## About

This skill came out of building the AI OS for [8gent Jr](https://8gentjr.com) — a free communication tool for nonverbal children — where voice output isn't optional, it's the whole point.

The 8GI Foundation is building AI that runs locally, learns continuously, and works for people who can't afford the paid tier. If that sounds like a mission worth reading about, the [8gent Code repo](https://github.com/8gi-foundation/8gent-code) has a manifesto.
