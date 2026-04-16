---
name: voice-signoff
description: Audible completion announcements with structured sign-off. Use when finishing any task to provide a chain of custody (what was done, where the proof is) and a spoken TTS summary. Works on macOS, Windows, and Linux.
---

# Voice Sign-Off

Every completed task gets a structured sign-off and an audible announcement via your system's text-to-speech engine. You hear the result without looking at the screen.

## When to Use

- After finishing any task (commit, deploy, fix, research)
- When you want audible confirmation that work landed
- When building accountability chains across multiple agents or sessions

## The Sign-Off Template

```
SIGN-OFF:
  VOICE:    say -v <voice> "<summary>"
  VALIDATE: <production or preview URL>
  VISUAL:   <screenshot confirmation or "Deploy pending">
  COMMIT:   <message> - <hash> on <branch>
  PUSHED:   <org>/<repo> <branch>
  ISSUE:    <GH issue URL> (<open|closed>) or "No linked issue"
  PR:       <PR URL> or "Direct push to <branch>"
```

Each field is a receipt. If any field says "N/A", that's fine. If every field says "N/A", you didn't ship anything.

---

## Voice Commands by Platform

### macOS

```bash
# Speak a completion summary
say -v Ava "PR merged. Email validation shipped to production. Issue 42 closed."

# List all available voices
say -l

# Common voices
say -v Ava "Ava - default female, clear"
say -v Samantha "Samantha - classic macOS"
say -v Daniel "Daniel - British male"
say -v Moira "Moira - Irish female"
say -v Karen "Karen - Australian female"
say -v Alex "Alex - classic male"

# Adjust rate (words per minute, default ~175)
say -v Ava -r 200 "Faster speech"
say -v Ava -r 140 "Slower, more deliberate"
```

### Windows (PowerShell)

```powershell
# Quick one-liner
(New-Object -ComObject SAPI.SpVoice).Speak("PR merged. Email validation shipped.")

# With more control
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 1  # -10 to 10
$synth.Speak("PR merged. Email validation shipped to production.")

# List available voices
$synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
```

### Linux

```bash
# espeak (most common, usually pre-installed)
espeak "PR merged. Email validation shipped to production."

# festival
echo "PR merged. Email validation shipped." | festival --tts

# spd-say (speech-dispatcher)
spd-say "PR merged. Email validation shipped to production."

# piper (neural TTS, much better quality)
echo "PR merged." | piper --model en_US-lessac-medium --output-raw | aplay -r 22050 -f S16_LE
```

---

## Voice Message Format

Keep it under 25 words. Structure:

1. **What happened** - "PR merged", "Deployed", "Issue closed"
2. **What changed** - the feature or fix in plain language
3. **Where** - branch, URL, or issue number

```bash
# Feature shipped
say -v Ava "PR merged. Email validation added to registration. Issue 42 closed. Live on production."

# Bug fixed
say -v Ava "Fix deployed. Duplicate submission bug resolved. Issue 87 closed."

# Research done
say -v Ava "Research complete. API docs summarized. No code changed. Notes in the PR."

# CI set up
say -v Ava "CI pipeline configured. Lint, tests, build on every PR. Branch protection on."
```

---

## Automating with Git Hooks

### Post-Merge Hook

```bash
# .git/hooks/post-merge (chmod +x)
#!/bin/bash
LAST_MSG=$(git log -1 --pretty=%s)

if command -v say &> /dev/null; then
  say -v Ava "Merged. ${LAST_MSG}"
elif command -v espeak &> /dev/null; then
  espeak "Merged. ${LAST_MSG}"
elif command -v powershell.exe &> /dev/null; then
  powershell.exe -Command "(New-Object -ComObject SAPI.SpVoice).Speak('Merged. ${LAST_MSG}')"
fi
```

### Post-Commit Hook

```bash
# .git/hooks/post-commit (chmod +x)
#!/bin/bash
MSG=$(git log -1 --pretty=%s)
BRANCH=$(git branch --show-current)

if command -v say &> /dev/null; then
  say -v Ava "Committed on ${BRANCH}. ${MSG}" &
fi
```

The `&` runs it in the background so it doesn't block your workflow.

---

## Claude Code Stop Hook

For Claude Code users, you can wire voice into the session stop event so every completed session speaks its summary.

Create `~/.claude/hooks/voice-signoff.ts`:

```typescript
#!/usr/bin/env bun

import { execSync } from "child_process"

interface StopPayload {
  stop_hook_active: boolean
  transcript_path?: string
  last_assistant_message?: string
  session_id?: string
}

function extractCompletedLine(text: string): string | null {
  // Look for the COMPLETED marker
  const match = text.match(/COMPLETED[:\s]*(.+?)(?:\n\n|\n(?=[A-Z])|\n?$)/is)
  if (match) return match[1].trim().slice(0, 350)

  // Fallback: SUMMARY marker
  const summary = text.match(/SUMMARY[:\s]*(.+?)(?:\n|$)/i)
  if (summary) return summary[1].trim().slice(0, 200)

  return null
}

async function main() {
  try {
    const data = await Bun.stdin.text()
    if (!data.trim()) process.exit(0)

    const payload: StopPayload = JSON.parse(data)
    const response = payload.last_assistant_message
    if (!response) process.exit(0)

    const line = extractCompletedLine(response)
    if (!line) process.exit(0)

    // Sanitize for shell
    const sanitized = line
      .replace(/['"\\`$]/g, "")
      .replace(/[^\w\s.,!?;:\-()]/g, "")
      .trim()

    if (sanitized.length === 0) process.exit(0)

    // Cross-platform TTS
    const platform = process.platform
    if (platform === "darwin") {
      execSync(`say -v Ava "${sanitized}"`)
    } else if (platform === "win32") {
      execSync(`powershell -Command "(New-Object -ComObject SAPI.SpVoice).Speak('${sanitized}')"`)
    } else {
      // Linux
      try {
        execSync(`espeak "${sanitized}"`)
      } catch {
        execSync(`spd-say "${sanitized}"`)
      }
    }
  } catch {
    // Voice should never block the session
  }
  process.exit(0)
}

main()
```

Register it in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "bun run ~/.claude/hooks/voice-signoff.ts"
      }
    ]
  }
}
```

---

## GitHub Actions Notification

Announce merges from CI:

```yaml
# .github/workflows/notify.yml
name: Merge Notification

on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  notify:
    if: github.event.pull_request.merged == true
    runs-on: macos-latest
    steps:
      - name: Announce
        run: |
          TITLE="${{ github.event.pull_request.title }}"
          PR="${{ github.event.pull_request.number }}"
          say -v Ava "PR ${PR} merged. ${TITLE}."
```

Note: this only works on macOS runners. For cross-platform CI announcements, use Slack/Discord webhooks instead of TTS.

---

## Examples

**Code task:**
```
SIGN-OFF:
  VOICE:    say -v Ava "Auth bug fixed on feature/login-fix. PR open. Tested on dev."
  VALIDATE: https://preview-login-fix.vercel.app
  VISUAL:   Screenshot attached to PR
  COMMIT:   fix: resolve token expiry race condition - a1b2c3d on fix/42-auth-race
  PUSHED:   myorg/myapp fix/42-auth-race
  ISSUE:    https://github.com/myorg/myapp/issues/42 (open)
  PR:       https://github.com/myorg/myapp/pull/43
```

**Non-code task:**
```
SIGN-OFF:
  VOICE:    say -v Ava "API docs reviewed. Key endpoints documented. No code changed."
  VALIDATE: N/A
  VISUAL:   N/A
  COMMIT:   N/A
  PUSHED:   N/A
  ISSUE:    No linked issue
  PR:       N/A
```

---

## Red Flags

- Finishing work with no sign-off (no chain of custody)
- Sign-off with all N/A fields (you didn't ship)
- Voice says "undefined" (your hook is reading the wrong payload field)
- Voice never fires (check hook registration in settings.json)
