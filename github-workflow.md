---
name: github-workflow
description: End-to-end GitHub development process. Use when starting any new work to ensure proper issue tracking, branch management, CI/CD, PR templates, testing, and deployment validation. The orchestrator that ties everything together into one disciplined loop.
---

# GitHub Workflow

The complete development loop on GitHub: from opening an issue to merging a validated PR. This skill connects issue tracking, branching, CI/CD, pull request discipline, local browser testing, and preview deployment validation into a single repeatable process.

## When to Use

- Starting any new feature, fix, or chore
- Setting up a new repository
- Onboarding to a project
- When work is happening without issues, PRs, or CI

## The Full Loop

```
Issue Created
    |
    v
Branch Created (named from issue)
    |
    v
Work Done (commits reference issue)
    |
    v
Local Testing (browser + unit tests)
    |
    v
PR Opened (template filled, issue linked)
    |
    v
CI Passes (lint, test, build, security)
    |
    v
Preview Deploy (Vercel/Netlify deploys branch)
    |
    v
Visual Validation (browser check on preview URL)
    |
    v
Review + Merge
    |
    v
Production Deploy (auto on merge to main)
    |
    v
Post-Deploy Validation + Sign-Off
```

Every step is mandatory. Skipping steps creates gaps where bugs hide.

---

## Phase 1: Issues

Every piece of work starts with a GitHub issue. No exceptions.

```bash
gh issue create \
  --title "Add email validation to registration" \
  --body "## Problem
Invalid emails reach the database.

## Acceptance Criteria
- [ ] Registration endpoint rejects malformed emails
- [ ] Error message is clear
- [ ] Validated on preview deployment

## Not Doing
- Not changing the email verification flow" \
  --label "feat"
```

**Rules:**
- Title starts with a verb. "Add email validation" not "Email stuff".
- Body has: Problem, Acceptance Criteria, Not Doing.
- Labels: `feat`, `fix`, `chore`, `docs`, `P0`, `P1`, `P2`.

### Issue Templates

Create `.github/ISSUE_TEMPLATE/feature.yml`:

```yaml
name: Feature Request
description: Propose a new feature
labels: ["feat"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What problem does this solve?
    validations:
      required: true
  - type: textarea
    id: criteria
    attributes:
      label: Acceptance Criteria
      value: |
        - [ ] Criteria 1
        - [ ] Validated on preview deployment
    validations:
      required: true
  - type: textarea
    id: not-doing
    attributes:
      label: Not Doing
      description: What is explicitly out of scope?
```

Create `.github/ISSUE_TEMPLATE/bug.yml`:

```yaml
name: Bug Report
description: Report a bug
labels: ["fix"]
body:
  - type: textarea
    id: description
    attributes:
      label: What happened?
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      value: |
        1.
        2.
        3.
    validations:
      required: true
  - type: input
    id: url
    attributes:
      label: URL where bug occurs
```

---

## Phase 2: Branches

```bash
# Read the issue
gh issue view 42

# Create branch from main
git checkout main && git pull
git checkout -b feat/42-email-validation
```

**Naming:** `type/issue-number-description`
```
feat/42-email-validation
fix/87-duplicate-submissions
chore/103-update-deps
```

**Lifecycle:** 1-3 days max. If longer, break into smaller issues. Delete after merge.

---

## Phase 3: CI/CD with GitHub Actions

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Quality Gates
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Lint
        run: npm run lint
      - name: Type Check
        run: npx tsc --noEmit
      - name: Unit Tests
        run: npm test
      - name: Build
        run: npm run build
```

For **Bun** projects, swap the setup:
```yaml
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run lint && bun run typecheck && bun test && bun run build
```

### Branch Protection

Set on `main` (Settings > Branches > Branch protection rules):
- [x] Require PR before merging
- [x] Require status checks to pass
- [x] Require branches to be up to date

---

## Phase 4: Pull Requests

### PR Template

Create `.github/pull_request_template.md`:

```markdown
## Summary
-

## Closes
Closes #

## Changes
-

## Not Changed
-

## Test Plan
- [ ] Unit tests pass
- [ ] Tested locally in browser
- [ ] Validated on preview deployment
- [ ] No console errors
- [ ] Responsive on mobile viewport

## Preview
**Preview URL:**
**Screenshot:**
```

### Opening a PR

```bash
git push -u origin feat/42-email-validation

gh pr create \
  --title "Add email validation to registration" \
  --body "## Summary
- Add Zod validation to POST /api/register

## Closes
Closes #42

## Test Plan
- [x] Unit tests pass
- [ ] Validated on preview deployment"
```

**Rules:** One issue per PR. Under 300 lines. Fill every template field. Link with `Closes #N`.

---

## Phase 5: Local Testing

Before pushing, test in a real browser:

1. Start dev server (`npm run dev` / `bun dev`)
2. Navigate to the feature
3. Test happy path + edge cases
4. Check DevTools console for errors
5. Resize to mobile viewport (375px)
6. Tab through interactive elements (keyboard nav)

If using Chrome browser automation (claude-in-chrome or DevTools MCP):
1. Navigate to localhost
2. Read the page, verify rendering
3. Interact with the feature
4. Check console for errors
5. Screenshot the result

---

## Phase 6: Preview Deployments

Every PR should deploy to a preview URL before merge. This catches environment-specific issues that local testing misses.

### Vercel (Recommended)

Connect your GitHub repo to Vercel. Every PR gets a preview URL automatically. Zero config for Next.js, Nuxt, SvelteKit, Astro.

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
```

### Alternatives

| Platform | Preview Support |
|----------|----------------|
| **Vercel** | Automatic per PR |
| **Netlify** | Automatic (Deploy Previews) |
| **Render** | PR Previews (enable in settings) |
| **Railway** | PR environments |
| **Cloudflare Pages** | Automatic per branch |
| **AWS Amplify** | Branch deployments |

If you're not using any of these, Vercel is the shortest path from branch to URL.

### Validating Previews

1. Open the preview URL
2. Verify the feature works
3. Check API calls succeed (env vars correct)
4. Test on mobile viewport
5. Check console for errors
6. Screenshot and paste in the PR

---

## Phase 7: Review, Merge, Validate

### Before Requesting Review
- [ ] CI green
- [ ] Preview URL working
- [ ] PR template complete
- [ ] Self-reviewed the diff
- [ ] Issue linked with `Closes #N`

### Merge

```bash
gh pr merge --squash --delete-branch
```

### After Merge

1. Verify on production URL
2. Issue auto-closes (if using `Closes #N`)
3. Branch auto-deletes (if enabled in repo settings)

---

## Phase 8: Sign-Off

Every completed piece of work ends with a structured sign-off. See the `/voice-signoff` skill for the full system including TTS.

```
SIGN-OFF:
  VOICE:    say -v Ava "<summary>"
  VALIDATE: <production URL>
  VISUAL:   <screenshot or "Deploy pending">
  COMMIT:   <message> - <hash> on <branch>
  PUSHED:   <org>/<repo> <branch>
  ISSUE:    <GH issue URL> or "No linked issue"
  PR:       <PR URL> or "Direct push"
```

---

## Repo Setup Checklist

```bash
echo "=== GitHub Workflow Setup Check ==="
echo "Issue templates:"
ls .github/ISSUE_TEMPLATE/ 2>/dev/null || echo "  MISSING"
echo "PR template:"
ls .github/pull_request_template.md 2>/dev/null || echo "  MISSING"
echo "CI workflow:"
ls .github/workflows/ci.yml 2>/dev/null || echo "  MISSING"
echo "Gitignore:"
ls .gitignore 2>/dev/null || echo "  MISSING"
echo "Branch protection:"
gh api repos/{owner}/{repo}/branches/main/protection 2>/dev/null \
  && echo "  Configured" || echo "  WARNING: None"
```

---

## Red Flags

- Work on `main` without PRs
- Issues created after the code ships (or not at all)
- PRs with empty descriptions
- No CI on PRs
- No preview URLs in PRs
- Branches older than a week
- "It works on my machine" without browser proof
