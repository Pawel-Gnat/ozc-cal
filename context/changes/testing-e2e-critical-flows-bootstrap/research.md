---
date: 2026-06-22T12:00:00+02:00
researcher: Cursor Agent
git_commit: 34c29e0
branch: main
repository: ozc-cal
topic: "Test-plan Phase 5 — E2E bootstrap for risks #2 (partial) and #5"
tags: [research, e2e, playwright, test-plan, risk-2, risk-5, auth, editor]
status: complete
last_updated: 2026-06-22
last_updated_by: Cursor Agent
---

# Research: E2E critical flows bootstrap (Phase 5)

**Date**: 2026-06-22  
**Researcher**: Cursor Agent  
**Git Commit**: 34c29e0  
**Branch**: main  
**Repository**: ozc-cal

## Research Question

Ground test-plan Phase 5 (`E2E critical flows bootstrap`): which risks need
browser-level coverage, where do auth → routing → API → DB boundaries live,
what E2E infrastructure exists on disk, and does the test-plan response
guidance for risks #2 and #5 hold?

## Summary

Playwright Test ^1.61.0 is bootstrapped with a `setup` → `chromium` project
chain, `webServer` against `npm run dev`, and six specs under `e2e/`. Risk **#5**
(isolation) is correctly tested at middleware + API + page redirect layers.
Risk **#2** E2E coverage is **partial**: scale calibration persists after reload
and enables the Segment tool; nodes, segments, and rooms are deferred to
test-plan Phase 2 integration work. The test-plan's "likely cheapest layer"
for #2 remains integration; E2E adds cross-boundary smoke only. No E2E in CI yet
(Phase 4).

## Risk response verification

### Risk #2 — Editor geometry lost after reload

| Test-plan cell | Research verdict |
| --- | --- |
| Prove | Save → reload preserves scale in domain terms | **Partially proven** — `known_length_m` and editor-ready state survive reload; full bit-for-bit geometry not asserted |
| Must challenge | "Auto-save 200" or client state alone | E2E hits GET `/api/projects/:id/editor` after reload — good |
| Cheapest layer | integration | **Confirmed** — E2E is supplementary smoke, not replacement |
| Anti-pattern | React state without persistence | Avoided — API assert + UI enablement |

**Failure path (scale persistence)**

1. Editor prerequisites: climate saved, ≥1 assembly, floor plan uploaded
   (`src/lib/services/project-editor.ts` → `getProjectEditorReady`).
2. Scale written via PUT `/api/projects/:id/editor` (`src/pages/api/projects/[id]/editor.ts`).
3. Reload; Segment button enabled when scale + floor plan present.
4. GET editor returns `scale.known_length_m` matching fixture value.

E2E helper `putEditorScale` in `e2e/helpers/project-setup.ts:55-81` seeds scale
via API (with `Origin` header — required for same-origin checks on mutations).

### Risk #5 — IDOR / cross-account access

| Test-plan cell | Research verdict |
| --- | --- |
| Prove | User A cannot GET/PUT project B | **Proven** for unauthenticated + non-owned UUID |
| Must challenge | "Middleware redirect" ≠ owner isolation | E2E tests foreign UUID at page and API |
| Cheapest layer | integration | E2E justified — crosses HTML redirect + JSON 404 |
| Anti-pattern | Happy-path owner only | Avoided — empty storageState + foreign id |

**Auth boundary** — `src/middleware.ts:4-28`:

- `PROTECTED_ROUTES`: `/dashboard`, `/projects`, `/api/projects`
- Unauthenticated `/api/projects/*` → 401 JSON (`UNAUTHORIZED`)
- Unauthenticated pages → redirect `/auth/signin`

**Owner boundary** — `getProjectById` (`src/lib/services/projects.ts:14-27`)
queries `projects` via Supabase client; RLS enforces owner-only rows. Missing
project → `resolveProjectRouteContext` redirects to
`/dashboard?error=Project%20not%20found` (`src/lib/api/project-route-helpers.ts:12,142-143`);
API routes return 404 `NOT_FOUND` (`project-route-helpers.ts:93-98`).

E2E uses syntactic UUID `00000000-0000-4000-8000-000000000001` — valid format,
almost certainly non-owned → 404/not-found path without needing a second user fixture.

## Detailed Findings

### Playwright infrastructure

| Artifact | Role |
| --- | --- |
| `playwright.config.ts` | `testDir: ./e2e`, `baseURL: localhost:4321`, `webServer` with Supabase env |
| `e2e/auth.setup.ts` | One-time UI sign-in → `playwright/.auth/user.json` |
| `e2e/env.ts` | Loads `.env`; requires `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` |
| `e2e/fixtures.ts` | `projectName`, `editorProject` fixtures (no POM) |
| `e2e/helpers/project-setup.ts` | Dashboard create, climate, assembly API, PDF upload, scale PUT |
| `e2e/spec.test.ts` | Seed exemplar — project survives reload |
| `e2e/risk-2-*.test.ts` | Scale persistence smoke |
| `e2e/risk-5-*.test.ts` | Unauth redirect + foreign project 404 |
| `vitest.config.ts` | Excludes `e2e/**` from unit runner |
| `package.json` | `"test:e2e": "playwright test"`, `@playwright/test` ^1.61.0 |

**Auth setup pitfalls (documented for cookbook):**

- React `client:load` hydration — use `networkidle`, `toHaveValue` after fill,
  `getByLabel(..., { exact: true })` (Password collides with "Show password").
- Assembly POST requires `Origin: baseURL` or server returns 403.

### Test inventory

| Spec | Risk | Assertion |
| --- | --- | --- |
| `auth.setup.ts` | — | Session persisted to storageState |
| `spec.test.ts` | seed | Project heading visible after reload |
| `risk-2-*.test.ts` | #2 partial | Segment enabled; `known_length_m` after reload |
| `risk-5-*.test.ts` | #5 | Sign-in redirect; foreign page alert; API 404 |

### Gaps (explicitly out of scope for Phase 5)

- Full geometry round-trip (nodes, segments, rooms) — Phase 2 integration
- Two-user IDOR with real foreign-owned project — integration + RLS tests (Phase 3)
- E2e in CI — Phase 4
- Deliberate-break VERIFY step skipped per user choice during M3L4

## Code References

- `playwright.config.ts:6-37` — projects, webServer, timeouts
- `e2e/auth.setup.ts:15-39` — authenticate flow
- `e2e/risk-2-editor-geometry-persists-after-reload.test.ts:3-21` — risk #2 smoke
- `e2e/risk-5-protected-project-access.test.ts:5-30` — risk #5 isolation
- `src/middleware.ts:4-28` — protected routes and unauth handling
- `src/lib/api/project-route-helpers.ts:60-99` — API owner/not-found resolution
- `src/lib/services/projects.ts:14-27` — project fetch (RLS-scoped)

## Recommendations for plan

1. Document retroactively in `plan.md` with Progress `[x]` — no re-implementation.
2. Link §3 Phase 5 change folder to `testing-e2e-critical-flows-bootstrap`.
3. Keep §6.6 cookbook; add agent rules file if missing (`.cursor/rules/e2e-testing.mdc`).
4. Do not mark Phase 3 (#5 integration) complete — E2E smoke ≠ full ownership test matrix.
