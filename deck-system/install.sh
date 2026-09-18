#!/usr/bin/env bash
# deck-system installer - copies the deck pipeline into ~/.claude and registers
# the Stop hook. Safe to re-run; it overwrites its own files and nothing else.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"

echo "deck-system installer"
echo "  target: $CLAUDE_DIR"
echo

# ---------------------------------------------------------------- checks
missing=0
need() {
  if command -v "$1" >/dev/null 2>&1; then echo "  ok   $1"; else echo "  MISS $1 - $2"; missing=1; fi
}
echo "Dependencies:"
need bun     "install: curl -fsSL https://bun.sh/install | bash"
need python3 "install via Xcode CLT or python.org"
need ffmpeg  "install: brew install ffmpeg"
if [ -d "/Applications/Google Chrome.app" ] || command -v chromium >/dev/null 2>&1; then
  echo "  ok   headless Chrome (slide screenshots)"
else
  echo "  MISS Google Chrome - needed for slide rendering"; missing=1
fi
if [ "$(uname)" != "Darwin" ]; then
  echo "  WARN not macOS - narration uses the macOS 'say' engine; on Linux you must provide your own TTS"
fi
if [ "$missing" = "1" ]; then
  echo
  echo "Install the missing dependencies above, then re-run. Nothing was changed."
  exit 1
fi

# ---------------------------------------------------------------- files
mkdir -p "$CLAUDE_DIR/hooks" "$CLAUDE_DIR/bin/lib"
cp "$HERE/hooks/ResponseDeck.hook.ts" "$CLAUDE_DIR/hooks/"
cp "$HERE/bin/response-to-deck"       "$CLAUDE_DIR/bin/"
cp "$HERE/bin/deck2video.py"          "$CLAUDE_DIR/bin/"
cp "$HERE/bin/lib/session-value.ts"   "$CLAUDE_DIR/bin/lib/"
chmod +x "$CLAUDE_DIR/bin/response-to-deck" "$CLAUDE_DIR/bin/deck2video.py" "$CLAUDE_DIR/hooks/ResponseDeck.hook.ts"
echo
echo "Files installed:"
echo "  $CLAUDE_DIR/hooks/ResponseDeck.hook.ts   (the Stop hook: gate + rate limit)"
echo "  $CLAUDE_DIR/bin/response-to-deck         (markdown -> slide deck renderer)"
echo "  $CLAUDE_DIR/bin/deck2video.py            (deck html -> narrated MP4)"
echo "  $CLAUDE_DIR/bin/lib/session-value.ts     (VALUE block parser, optional)"

# ---------------------------------------------------------------- hook registration
python3 - "$CLAUDE_DIR" <<'PYEOF'
import json, os, sys
claude_dir = sys.argv[1]
settings_path = os.path.join(claude_dir, "settings.json")
settings = {}
if os.path.exists(settings_path):
    with open(settings_path) as f:
        settings = json.load(f)
hooks = settings.setdefault("hooks", {})
stop = hooks.setdefault("Stop", [])
cmd = f"bun run {claude_dir}/hooks/ResponseDeck.hook.ts"
already = any(
    h.get("command") == cmd
    for entry in stop
    for h in entry.get("hooks", [])
)
if already:
    print("\nStop hook already registered - nothing to do.")
else:
    if stop and "hooks" in stop[0]:
        stop[0]["hooks"].append({"type": "command", "command": cmd})
    else:
        stop.append({"hooks": [{"type": "command", "command": cmd}]})
    with open(settings_path, "w") as f:
        json.dump(settings, f, indent=2)
    print(f"\nStop hook registered in {settings_path}")
PYEOF

# ---------------------------------------------------------------- smoke test
echo
echo "Self-test:"
bun run "$CLAUDE_DIR/bin/response-to-deck" --self-test >/dev/null 2>&1 \
  && echo "  ok   renderer self-test passed" \
  || echo "  WARN renderer self-test reported failures - run manually: bun run $CLAUDE_DIR/bin/response-to-deck --self-test"

cat <<'DONE'

Done. From your next Claude Code session, any substantive response
(>=1800 chars with real structure) renders into a narrated MPV deck
in the background, capped at 1 per 25 minutes / 6 per day.

Where decks land:   ~/.8gent/creative/   (override: export DECK_OUT_DIR=...)
Optional Telegram:  put TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in
                    ~/.claude/.env and finished decks are also sent there.
Try it by hand:     bun run ~/.claude/bin/response-to-deck --file some-response.md
Gate check only:    ... --gate-only   (exit 0 = would earn a deck)
Log:                ~/.claude/hooks/.response-deck.log
DONE
