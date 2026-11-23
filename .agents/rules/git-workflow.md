# Git Workflow

## Approval Rules

- **NO commits** without the user validating the code first — show the diff
- **NO branches** unless explicitly requested
- **NO push** unless instructed — `main` is branch-protected (changes are expected to come through PRs; direct pushes warn or bypass only for admins)
- Before touching code: show plan (files to touch + proposed commits)
- After applying: show commands run and results (lint/test/build/wasm:check)

## Commit Convention

Conventional Commits with optional scope:

```
feat: <brief description>
fix(ui): <brief description>
fix(tests): <brief description>
refactor: <brief description>
test: <brief description>
chore: <brief description>
docs: <brief description>
```

Rules:

- One commit per logical change
- Short imperative messages, no trailing period
- No "Co-Authored-By" or AI attribution unless the user asks
- English for commit messages

Real examples from `git log`: `fix(tests): serve wasm directly from disk in test setup to prevent ECONNREFUSED in CI`, `fix(ui): restore terminal chrome, layout flexbox, status bar and chart resizing`, `docs: align repo with Rust/WASM + Leptos architecture`.

## Pre-Commit Verification

```bash
npm run lint && npm run type-check && npm test && npm run build
npm run wasm:check   # when rust/ changed
```

Plus: regenerate + stage `src/wasm/**` bundles when `rust/`/`ui/` source changed. If any step fails, do not commit — fix and retry.

## Branches

Default base: `main`.

Format:

```
feat/<slug>
fix/<slug>
docs/<slug>
```

## Pull Requests

- Use `.github/PULL_REQUEST_TEMPLATE.md` — fill Summary, What changed, Validation checklist, Risk and rollout
- Validation checklist requires: `npm run lint`, `npm run type-check`, `npm test`, `npm run build`; UI changes need screenshots or a short recording
- Disclose AI assistance in the PR description
- `dependabot.yml` handles dep bumps — don't hand-roll dependency PRs
