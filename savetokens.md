---
name: savetokens
description: Minimize token waste in every operation. Use AST extraction instead of full file reads, targeted searches instead of broad greps, and smart delegation to keep sessions lean. The difference between burning through context in 20 minutes and staying sharp for hours.
---

# Save Tokens

Every tool call costs tokens. Every file read, every grep result, every response eats your context window. This skill teaches techniques to get the same information in 10-50x fewer tokens.

The goal is not to be stingy. The goal is to stay sharp longer.

## When to Use

- Always. These habits should be default.
- Especially when context is above 40%
- When working on large codebases (100+ files)
- When you need to explore unfamiliar code
- When sessions are running long

---

## 1. AST-First Code Exploration

**The single biggest token saver.** Instead of reading entire files, extract the structure first, then fetch only the symbols you need.

### The Problem

Reading a 500-line file costs ~7,500 tokens. You usually need 1 function (20 lines, ~300 tokens). That's a 25x waste.

### The Solution: Outline, Then Extract

If you have AST tools (jcodemunch, tree-sitter MCP, or similar):

```
Step 1: Index the repo (once per session)
  mcp__jcodemunch__index_folder(path="/path/to/repo")

Step 2: Get the file outline (costs ~200 tokens vs ~7,500 for full read)
  mcp__jcodemunch__get_file_outline(repo="name", file_path="src/auth.ts")
  
  Returns:
    - handleLogin (function, line 12-45)
    - validateToken (function, line 47-82)
    - AuthContext (type, line 84-92)
    - useAuth (function, line 94-130)

Step 3: Fetch only the symbol you need (~300 tokens)
  mcp__jcodemunch__get_symbol(repo="name", symbol_id="src/auth.ts::validateToken")

Step 4: Search symbols, not text
  mcp__jcodemunch__search_symbols(repo="name", query="handleAuth")
```

**Token comparison:**

| Approach | Tokens | What You Get |
|----------|--------|-------------|
| Read entire file | ~7,500 | Everything (mostly irrelevant) |
| File outline | ~200 | All exports, functions, types with signatures |
| Single symbol extract | ~300 | Exactly the function you need |
| Symbol search | ~150 | Matching function names across repo |

### Without AST Tools

Even without dedicated AST tools, you can approximate:

```
# Instead of reading the whole file, read just the function
Read file.ts offset=47 limit=35    # Just lines 47-82

# Instead of grepping for content, grep for definitions
Grep "^export function\|^export const\|^export class" --glob "src/**/*.ts"

# Use the LSP for jump-to-definition instead of searching
LSP definition at file.ts:23:15
```

---

## 2. Targeted File Reads

Never read a whole file when you know which part you need.

### Use Offset and Limit

```
BAD:  Read("src/api/routes.ts")                    # 800 lines, ~12,000 tokens
GOOD: Read("src/api/routes.ts", offset=120, limit=30)  # 30 lines, ~450 tokens
```

### When Full Read Is OK

- Config files: `package.json`, `tsconfig.json`, `.env.example` (usually small)
- Documentation: `README.md`, `CHANGELOG.md` (need the full picture)
- Files under 50 lines
- When you genuinely need to understand the whole file structure

### Read the Outline First

If you don't have AST tools, skim the structure before diving in:

```
# Get function/class definitions only
Grep "^export |^function |^class |^const |^interface " path="src/api/routes.ts"

# Then read the specific section you need
Read("src/api/routes.ts", offset=45, limit=20)
```

---

## 3. Search Smart

Grep is powerful but expensive when results are broad. Every matching line is tokens.

### Always Set Limits

```
BAD:  Grep("TODO")                                    # Could return 500 lines
GOOD: Grep("TODO", glob="src/**/*.ts", head_limit=10) # Max 10 results, only .ts files
```

### Use the Right Output Mode

```
# When you need to know WHICH files match (cheapest)
Grep("handleAuth", output_mode="files_with_matches")
# Returns: src/auth.ts, src/middleware.ts  (~50 tokens)

# When you need to know HOW MANY matches (cheap)
Grep("console.log", output_mode="count")
# Returns: src/api.ts:12, src/utils.ts:3  (~30 tokens)

# When you need the actual content (most expensive)
Grep("handleAuth", output_mode="content", head_limit=5)
# Returns: 5 matching lines with context  (~500 tokens)
```

### Narrow Before Widening

```
# Start narrow
Grep("validateEmail", glob="src/lib/*.ts")

# No results? Widen slightly
Grep("validateEmail", glob="src/**/*.ts")

# Still nothing? Then go broad
Grep("validateEmail")
```

### Use Type Filters

```
# Search only TypeScript files
Grep("interface User", type="ts")

# Search only Python files
Grep("def authenticate", type="py")
```

---

## 4. Glob Before Read

When looking for files, use Glob (cheap) before Read (expensive).

```
# Find the file first (~50 tokens)
Glob("**/auth*.ts")
# Returns: src/lib/auth.ts, src/middleware/auth-check.ts

# Then read only the relevant one
Read("src/lib/auth.ts", offset=0, limit=50)
```

Don't guess file paths and read them one by one. That's 3 failed reads (wasted tokens) before finding the right file.

---

## 5. Delegate Expensive Research

When you need to explore a large area of the codebase, spawn a subagent. The subagent burns its own context window, then returns a short summary to yours.

```
Main session:   [==        ] 20%  (stays lean)
Research agent: [========  ] 80%  (does the heavy lifting)
Result:         +200 tokens       (summary only)
```

### When to Delegate

- "How does the auth system work?" (requires reading 5+ files)
- "Find all API endpoints" (broad search)
- "What dependencies does this module have?" (transitive exploration)
- Any research that would take more than 3 tool calls

### When NOT to Delegate

- You know the exact file and line
- Single grep that will return < 10 results
- Reading a config file
- Quick git commands

---

## 6. Ask for Concise Responses

The AI's own responses cost tokens too. Long explanations eat context fast.

```
# Costs ~1,500 tokens in response
"Explain how the auth middleware works"

# Costs ~200 tokens in response
"Explain how the auth middleware works in under 50 words"

# Costs ~100 tokens in response
"What does authMiddleware in src/middleware.ts return? One sentence."
```

When you need detail, ask for detail. When you need a yes/no, ask for a yes/no.

---

## 7. Batch Independent Operations

If you need multiple pieces of information that don't depend on each other, request them in parallel. This doesn't save tokens per se, but it saves round trips (each round trip adds overhead tokens from system context).

```
# One message, multiple parallel tool calls
"Read package.json, check git status, and grep for TODO in src/"

# Instead of three separate messages
"Read package.json"
[response]
"Check git status"
[response]
"Grep for TODO in src/"
```

---

## 8. Avoid Re-Reading

If you just read a file, don't read it again. If you just ran a command, don't run it again to "verify." The information is in your context.

Common wastes:
- Reading a file after editing it (the edit tool confirms success)
- Running `git status` after `git commit` (the commit output confirms what happened)
- Re-reading a file you read 3 messages ago (it's still in context)

---

## 9. Git Log Over Git Diff

When you need to understand recent changes:

```
# Cheap: see what changed (~200 tokens)
git log --oneline -10

# Medium: see which files changed (~500 tokens)
git diff --stat HEAD~3

# Expensive: see all the code that changed (~5,000+ tokens)
git diff HEAD~3

# Smart: targeted diff on one file (~500 tokens)
git diff HEAD~3 -- src/auth.ts
```

Start with `--stat` or `--oneline` to identify what matters, then drill into specific files.

---

## 10. Cache-Friendly Patterns

Anthropic's prompt cache has a 5-minute TTL. Structure your work to stay in cache:

- **Work in bursts under 5 minutes** between messages (cache stays warm)
- **Front-load important context** in your first message (cached longest)
- **Don't switch tasks mid-session** (cache is built around your current topic)
- **If you've been idle 10+ minutes**, expect a slower response (cache miss, not a bug)

---

## Token Cost Cheat Sheet

| Operation | Typical Cost | How to Reduce |
|-----------|-------------|---------------|
| Full file read (500 lines) | ~7,500 tokens | AST outline (~200) + symbol extract (~300) |
| Broad grep (100 matches) | ~5,000 tokens | Add head_limit=10, use glob filter (~500) |
| Git diff (many files) | ~5,000 tokens | Use --stat first, then targeted diff (~500) |
| Long AI response | ~1,500 tokens | Ask for concise answer (~200) |
| Failed file read (wrong path) | ~200 tokens wasted | Glob first to find the right path |
| Re-reading a file | ~7,500 tokens wasted | It's already in context, just reference it |
| Undirected exploration | ~10,000+ tokens | Spawn a subagent (~200 tokens back) |

---

## The 80/20 Rule

These three habits alone will cut your token usage by 60-80%:

1. **Outline before read.** Get the file structure, then extract what you need.
2. **Limit your searches.** Always set `head_limit`, always filter by file type.
3. **Delegate research.** If it takes more than 3 tool calls to answer, spawn an agent.

Everything else is refinement.

---

## Red Flags

- Reading files over 200 lines without using offset/limit
- Grep returning more than 20 results
- Reading the same file twice in one session
- Running `git diff` without `--stat` first
- No subagents spawned in sessions that explore multiple areas
- Context above 60% within the first 30 minutes
- AI responses consistently over 500 words when a sentence would do
