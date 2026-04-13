---
name: voice
description: Gives Claude a spoken voice during your session. On macOS uses the `say` command. On Windows uses PowerShell SAPI. On Linux uses espeak. Claude speaks task completions, key decisions, and warnings aloud — so you can work eyes-free.
user_invocable: true
---

# /voice

Give Claude a spoken voice during your Claude Code session.

When active, Claude will speak key moments aloud — task completions, warnings, decisions, errors — so you can stay in flow without reading every line.

---

## Platform Support

| Platform | Engine | Command |
|----------|--------|---------|
| macOS | macOS TTS (`say`) | `say -v [voice] "[text]"` |
| Windows | PowerShell SAPI | `Add-Type -AssemblyName System.Speech` |
| Linux | espeak | `espeak "[text]"` |

---

## Setup: Detect Platform and Pick a Voice

When the user runs `/voice`, Claude should:

1. Detect the platform from the shell environment
2. List available voices for that platform
3. Let the user pick, or default to a recommended voice
4. Confirm voice is working with a test line
5. From that point on, append spoken output to task completions

**Detection command:**

```bash
# macOS
uname -s  # returns "Darwin"
say -v '?' 2>/dev/null | head -20  # list available voices

# Windows (PowerShell)
[System.Environment]::OSVersion.Platform  # Win32NT
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }

# Linux
uname -s  # returns "Linux"
espeak --voices 2>/dev/null | head -20
```

**Recommended defaults by platform:**

| Platform | Default Voice | Notes |
|----------|--------------|-------|
| macOS | `Samantha` | Clear, neutral American English |
| macOS (alt) | `Daniel` | British English, clear |
| Windows | `Microsoft Zira` | Clear female voice |
| Windows (alt) | `Microsoft David` | Male voice |
| Linux | `en+f3` | espeak female voice |

---

## Usage: Speaking During Sessions

Once `/voice` is active, Claude must include spoken output for:

### 1. Task Completions

Every significant task completion must include a `🎯 COMPLETED:` line. The voice hook reads this and speaks it aloud.

```
🎯 COMPLETED: [25 words max — see format below]
```

**Format:**
1. Sarcastic or witty opener (keeps it memorable)
2. What was actually done (one sentence)
3. Where (branch / file / URL if relevant)
4. Current status (committed / pushed / deployed)
5. A brief joke or one-liner to close

**Example:**
```
🎯 COMPLETED: Against all odds, the auth bug is fixed. Patched the JWT expiry check on feature/auth. Committed and pushed. Tests pass. Why did the token expire? Trust issues.
```

### 2. Warnings

When something risky is about to happen:

```bash
# macOS
say -v Samantha "Warning: about to delete 3 files. This cannot be undone."

# Windows
powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('Warning: about to delete 3 files.')"

# Linux
espeak "Warning: about to delete 3 files. This cannot be undone."
```

### 3. Key Decisions

When Claude makes a non-trivial architectural decision:

```
🔊 DECISION: [short spoken summary of what was decided and why]
```

---

## Voice Commands

| Command | What Happens |
|---------|-------------|
| `/voice` | Setup — detect platform, list voices, pick one, run test |
| `/voice off` | Disable spoken output for the rest of the session |
| `/voice [voice name]` | Switch to a specific voice mid-session |
| `/voice test` | Speak a test line to confirm it's working |

---

## Platform-Specific Commands

**macOS:**
```bash
# List all available voices
say -v '?'

# Speak with a specific voice
say -v Samantha "Your build is complete."

# Speak from a variable
MESSAGE="Tests passing. 47 of 47."
say -v Samantha "$MESSAGE"

# Good voices for different moods:
# Samantha — clear, default
# Karen — Australian, warm
# Daniel — British, measured
# Moira — Irish, distinct
# Alex — deep, authoritative
```

**Windows (PowerShell):**
```powershell
# List available voices
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }

# Speak a line
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Zira Desktop")
$synth.Speak("Your build is complete.")

# One-liner for scripts
powershell -Command "Add-Type -AssemblyName System.Speech; `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; `$s.Speak('Build complete.')"
```

**Linux (espeak):**
```bash
# Install if not present
sudo apt install espeak   # Debian/Ubuntu
sudo dnf install espeak   # Fedora

# List voices
espeak --voices

# Speak
espeak -v en+f3 "Your build is complete."

# With speed control (words per minute, default 175)
espeak -v en+f3 -s 150 "Slower and clearer."
```

---

## Hook Integration (Advanced)

To make voice output automatic on session end, create a hook at `~/.claude/hooks/voice-completion.sh`:

```bash
#!/bin/bash
# Reads 🎯 COMPLETED: lines from Claude's output and speaks them

PLATFORM=$(uname -s)
VOICE="${CLAUDE_VOICE:-Samantha}"  # set CLAUDE_VOICE env var to override

speak() {
  local text="$1"
  case "$PLATFORM" in
    Darwin)
      say -v "$VOICE" "$text" &
      ;;
    Linux)
      espeak "$text" &
      ;;
    MINGW*|CYGWIN*|MSYS*)
      powershell -Command "Add-Type -AssemblyName System.Speech; \$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; \$s.Speak('$text')"
      ;;
  esac
}

# Read stdin, extract 🎯 COMPLETED: lines, speak them
while IFS= read -r line; do
  if [[ "$line" == *"🎯 COMPLETED:"* ]]; then
    text="${line#*🎯 COMPLETED: }"
    text="${text:0:350}"  # cap at 350 chars
    speak "$text"
  fi
done
```

Make it executable:
```bash
chmod +x ~/.claude/hooks/voice-completion.sh
```

---

## Tips

- **Keep spoken lines under 25 words** — long sentences are hard to follow while coding.
- **Use the sarcastic opener** — it makes completions memorable and signals the boundary between work and commentary.
- **Set `CLAUDE_VOICE`** in your shell profile to persist your voice preference across sessions:
  ```bash
  export CLAUDE_VOICE="Karen"   # macOS example
  ```
- **Windows users**: install additional voices via Settings → Time & Language → Speech → Add voices for more options.
- **Linux users**: `espeak-ng` is a higher quality fork of espeak with better voices — `sudo apt install espeak-ng`.
