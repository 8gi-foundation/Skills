---
name: context-window
description: Understand and optimize your Claude Code context window. Use when your sessions feel slow, outputs get worse, or you see the context bar filling up. Teaches you to read the status line, manage token budgets, and keep sessions sharp.
---

# Context Window Management

Your context window is a fixed-size budget. Everything in your conversation (system prompts, tool results, file reads, your messages, Claude's responses) competes for the same space. When it fills up, older messages get compressed or dropped. Output quality degrades. Sessions slow down.

This skill teaches you to read the status line, understand what's eating your context, and keep sessions productive.

## When to Use

- Context bar is past 50%
- Claude's responses feel less precise or start repeating itself
- Sessions are running long with many tool calls
- You're reading large files or getting big tool outputs
- Starting a new session and want to be efficient from the start

## Reading the Status Line

Claude Code shows a status bar at the bottom of your terminal:

```
8gi-governance Opus 4.6  ctx [====----] 59%  5h  [=-] 3%  7d  [=---] 16%
```

Here's what each segment means:

| Segment | What It Shows |
|---------|--------------|
| `8gi-governance` | Current project/repo name |
| `Opus 4.6` | Model being used (Opus, Sonnet, Haiku) |
| `ctx [====----]` | **Context usage bar** - how full your conversation window is |
| `59%` | **Context percentage** - proportion of total window used |
| `5h` | Session duration |
| `[=-] 3%` | **Prompt cache (5-minute)** - recent content cached for speed |
| `7d` | Account usage period |
| `[=---] 16%` | **Account usage** - how much of your plan quota you've used |

### The Context Bar

```
[          ]  0%   - Fresh session. Maximum precision.
[===       ] 30%   - Healthy. Full context available.
[======    ] 59%   - Watch zone. Be deliberate about what you add.
[========  ] 80%   - Danger zone. Compression starting. Quality dropping.
[==========] 95%+  - Critical. Start a new session.
```

**Colors matter:**
- Green/amber bar = normal usage
- The bar fills from left to right as your conversation grows
- Each tool call, file read, and response adds to it

### The Cache Bar

```
[=-] 3%   - Low cache hit rate. Most content read fresh each turn.
[===] 40%  - Good. Anthropic's prompt cache is reusing prior context.
[====] 80% - Excellent. Fast responses, lower cost.
```

The cache has a **5-minute TTL**. If you pause for more than 5 minutes between messages, the cache expires and your next message is slower (full context re-read). This is normal but good to know.

---

## What Eats Context

Not all actions cost the same. Here's what's expensive:

| Action | Token Cost | Frequency |
|--------|-----------|-----------|
| Reading a large file (1000+ lines) | 2000-8000 tokens | Avoid. Read specific ranges. |
| Full `git diff` on many files | 1000-5000 tokens | Use `--stat` first, then targeted diffs |
| Tool results with verbose output | 500-3000 tokens | Limit output size, use `head` |
| Long assistant responses | 500-2000 tokens | Ask for concise answers |
| System prompts + CLAUDE.md | 500-2000 tokens | Fixed cost, loaded once |
| Your messages | 50-500 tokens | Longer prompts = more context used |
| Grep with many matches | 500-5000 tokens | Use `head_limit`, narrow your search |

### The Biggest Context Killers

1. **Reading entire files when you need 10 lines.** Use `offset` and `limit` on Read, or use AST tools to extract specific symbols.
2. **Grep without filters.** Always set `head_limit`, use `glob` to narrow file types, use `files_with_matches` mode first.
3. **Letting the agent explore freely.** Undirected "look at the codebase" burns context fast. Be specific.
4. **Not starting new sessions.** A session at 80% context is working with compressed history. A fresh session at 0% has full precision.

---

## Optimization Strategies

### 1. Read Smart, Not Everything

```
BAD:  "Read src/app/api/route.ts"           (whole file, 2000 tokens)
GOOD: "Read src/app/api/route.ts lines 45-60" (specific range, 200 tokens)

BAD:  "Search the codebase for handleAuth"   (open-ended grep, many results)
GOOD: "Grep handleAuth in src/lib/ --glob '*.ts' --head_limit 5" (targeted)
```

If your project has AST tools (like jcodemunch), use outlines and symbol extraction instead of reading full files. A function signature is 50 tokens. The whole file is 2000.

### 2. Scope Your Requests

```
BAD:  "What does this codebase do?"          (agent reads everything)
GOOD: "What does src/lib/auth.ts export?"    (one file, one question)

BAD:  "Fix the bug"                          (agent explores broadly)
GOOD: "The login form on /auth/login returns 401 when the email has a + character. Fix the validation in src/lib/validate.ts" (pinpointed)
```

### 3. Use Subagents for Exploration

When you need broad codebase exploration, spawn a subagent. The subagent has its own context window. It explores, summarizes, and returns a short result to your main session.

```
Your main session:     [==        ] 20% (stays lean)
Subagent exploring:    [========  ] 80% (does the heavy lifting, then dies)
Result comes back:     +200 tokens to your main session (summary only)
```

This is why the Agent tool exists. Use it for research that would burn your main context.

### 4. Start Fresh When Needed

There's no shame in `/clear` or starting a new session. A fresh session with a clear prompt is better than a 90% context session where Claude is working from compressed fragments.

**When to start fresh:**
- Context above 80%
- Claude starts repeating itself or losing track
- You're switching to a completely different task
- You've been in the same session for 4+ hours

### 5. Front-Load Context

Put the most important information in your first message. System prompts and early messages are more reliably retained during compression than messages from 2 hours ago.

```
First message: "I'm working on src/lib/auth.ts. The bug is on line 47 where
emails with + characters fail validation. Here's the relevant code: [paste 10 lines].
Fix the regex."

NOT: [20 messages of exploration later] "ok so now fix it"
```

### 6. Cache-Friendly Pacing

The prompt cache has a 5-minute TTL. If you're actively working:
- Respond within 5 minutes to stay in cache (faster, cheaper)
- If you step away for 10+ minutes, the next response will be slower (cache miss)
- This isn't a problem, just awareness. Don't rush because of cache.

---

## Context Budget Planning

For a typical 200K token window:

| Budget Slice | Tokens | What Goes Here |
|-------------|--------|----------------|
| System prompt + CLAUDE.md | ~3,000 | Fixed. Loaded at start. |
| Skills/hooks context | ~2,000 | Fixed. Auto-loaded. |
| Your messages | ~10,000 | Your prompts over the session |
| File reads | ~30,000 | Code you ask to read |
| Tool results | ~40,000 | Grep, git, bash outputs |
| Claude's responses | ~50,000 | Everything Claude writes |
| **Available for work** | **~65,000** | What's left for actual task content |
| Compression buffer | ~30,000 | Space for the system to compress older turns |

The numbers vary, but the principle holds: tool results and file reads are the biggest consumers. Be surgical.

---

## Monitoring Your Usage

### In the Terminal

Watch the status bar. When context crosses 60%, start being intentional:
- Stop open-ended exploration
- Use targeted reads instead of full files
- Ask for shorter responses ("answer in under 50 words")
- Consider spawning subagents for remaining research

### Signs of Context Pressure

| Symptom | What's Happening |
|---------|-----------------|
| Claude repeats itself | Earlier context compressed, it's rediscovering things |
| Responses feel generic | Less specific context available to reference |
| "I don't have access to that file" | File read was compressed out of context |
| Slower responses | More tokens to process each turn |
| Tool calls that don't make sense | Working from compressed/partial understanding |

---

## Quick Reference Card

```
CONTEXT WINDOW HEALTH CHECK:

  0-30%   Fresh. Go wild. Explore freely.
  30-60%  Healthy. Normal work. Be somewhat deliberate.
  60-80%  Watch it. Targeted reads only. Spawn subagents for research.
  80-90%  Danger. Wrap up current task. Plan a new session.
  90%+    Critical. Finish what you're doing and start fresh.

TOKEN COST CHEAT SHEET:

  1 line of code         ~15 tokens
  10 lines of code       ~150 tokens
  100 lines of code      ~1,500 tokens
  1000 lines of code     ~15,000 tokens
  Short message from you ~100 tokens
  Long message from you  ~500 tokens
  Typical Claude response ~500-1,500 tokens

CACHE TTL: 5 minutes. Stay in cache for fast responses.
```

---

## Red Flags

- Reading entire files when you need specific functions
- Grep returning 200+ matches with no filter
- Session over 80% context with hours of work left
- Agent doing open-ended exploration in your main session
- Not using subagents for research tasks
- Staying in a degraded session instead of starting fresh
