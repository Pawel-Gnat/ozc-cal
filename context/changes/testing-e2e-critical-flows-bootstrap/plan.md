# E2E Critical Flows Bootstrap — Implementation Plan

## Overview

Retroactive plan for test-plan **Phase 5**: bootstrap Playwright Test and add
browser-level smoke for risks **#2** (editor scale persistence after reload —
partial) and **#5** (unauthenticated redirect + foreign project isolation).
Work already landed on disk via M3L4 lesson path; this plan records intent,
success criteria, and Progress for the 10x workflow.

## Current State Analysis

Before Phase 5, the project had Vitest (Phase 1) but no Playwright config, no
`e2e/` directory, and no `npm run test:e2e`. Test-plan §4 listed e2e as absent;
§5 marked `e2e on critical flows` as planned.

Research (`research.md`, 2026-06-22) confirms:

- Auth crosses middleware → Supabase session → protected routes
- Owner isolation relies on RLS + `getProjectById` returning null for foreign rows
- Editor scale persistence is the smallest browser-level slice of risk #2
- Integration remains the cheapest layer for full geometry round-trip

## Desired End State

After this plan (already achieved):

- `npm run test:e2e` runs Playwright against `astro dev` via `webServer`
- Auth setup writes `playwright/.auth/user.json`; chromium project reuses it
- Seed exemplar (`e2e/spec.test.ts`) models fixture + reload pattern
- Risk #2 smoke: scale survives reload (API + Segment tool enabled)
- Risk #5 smoke: unauth redirect; foreign UUID → page alert + API 404
- `context/foundation/test-plan.md` §3 Phase 5 links this change folder;
  §4 Stack and §6.6 cookbook describe E2E
- Vitest excludes `e2e/**`

## What We're NOT Doing

- Full editor geometry E2E (nodes, segments, rooms) — test-plan Phase 2
- Two-user IDOR matrix — test-plan Phase 3 integration
- E2E in CI — test-plan Phase 4
- Deliberate-break VERIFY (skipped per user during M3L4)
- Page-object models or CSS/XPath selectors

## Implementation Approach

Follow `/10x-e2e` quality levers: seed test + E2E rules, `getByRole` locators,
`storageState` auth, unique data per run, fixture-based setup/teardown. Use API
helpers where UI setup is slow (assembly create, scale PUT) but keep auth and
isolation paths browser-real.

## Phase 1: Playwright bootstrap

### Overview

Install Playwright, add config with setup/chromium projects and webServer, wire
`npm run test:e2e`, load env for Supabase + E2E credentials, exclude e2e from Vitest.

### Success Criteria

- `@playwright/test` in devDependencies; `npm run test:e2e` script present
- `playwright.config.ts` starts dev server with Supabase env vars
- `vitest.config.ts` excludes `e2e/**`
- `.env.example` documents `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
- `.gitignore` ignores `playwright/.auth/`

## Phase 2: Auth, seed, fixtures, and rules

### Overview

One-time auth setup, seed exemplar, shared fixtures, project-setup helpers,
agent E2E rules file.

### Success Criteria

- `e2e/auth.setup.ts` signs in and writes storageState
- `e2e/env.ts` loads `.env` and validates credentials
- `e2e/spec.test.ts` — project persists after reload (seed pattern)
- `e2e/fixtures.ts` — `projectName`, `editorProject` with teardown
- `e2e/helpers/project-setup.ts` — dashboard create, climate, assembly, PDF, scale
- `.cursor/rules/e2e-testing.mdc` — agent rules for generated tests

## Phase 3: Risk #2 — editor scale persistence smoke

### Overview

Prove scale calibration survives reload at API + editor-ready UI boundary.

### Success Criteria

- `e2e/risk-2-editor-geometry-persists-after-reload.test.ts` passes
- Asserts `known_length_m` via GET editor after reload
- Segment button enabled with `{ exact: true }` (avoids "Select segments manually")
- Documents partial scope — full geometry deferred to Phase 2 integration

## Phase 4: Risk #5 — protected route isolation smoke

### Overview

Prove unauthenticated users cannot reach dashboard; authenticated user cannot
access foreign project by UUID at page and API layers.

### Success Criteria

- `e2e/risk-5-protected-project-access.test.ts` passes
- Empty storageState → redirect to sign-in
- Foreign UUID → dashboard error alert + editor API 404 `NOT_FOUND`

## Phase 5: Test-plan backport

### Overview

Link Phase 5 rollout row to this change folder; ensure §4 Stack, §5 gates,
§6.6 cookbook reflect shipped E2E (local required, CI deferred).

### Success Criteria

- `context/foundation/test-plan.md` §3 Phase 5 status `complete`, change folder set
- §6.5 phase note references this change
- Freshness ledger updated

## References

- `context/foundation/test-plan.md` — Phase 5, risks #2, #5, §6.6
- `context/changes/testing-e2e-critical-flows-bootstrap/research.md`
- `.cursor/skills/10x-e2e/references/e2e-quality-rules.md`
- `src/middleware.ts`, `src/lib/api/project-route-helpers.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Retroactive documentation — all
> steps verified against on-disk implementation at commit 34c29e0.

### Phase 1: Playwright bootstrap

#### Automated

- [x] 1.1 `@playwright/test` installed; `npm run test:e2e` script present — 34c29e0
- [x] 1.2 `playwright.config.ts` with setup/chromium projects and webServer — 34c29e0
- [x] 1.3 Vitest excludes `e2e/**` — 34c29e0
- [x] 1.4 `.env.example` documents E2E credentials — 34c29e0

#### Manual

- [x] 1.5 `npx playwright install chromium` documented in §6.6 — 34c29e0

### Phase 2: Auth, seed, fixtures, and rules

#### Automated

- [x] 2.1 Auth setup writes `playwright/.auth/user.json` — 34c29e0
- [x] 2.2 Seed spec + fixtures + project-setup helper — 34c29e0
- [x] 2.3 E2E agent rules file present — 34c29e0

#### Manual

- [x] 2.4 Sign-in hydration patterns documented (exact labels, networkidle) — 34c29e0

### Phase 3: Risk #2 smoke

#### Automated

- [x] 3.1 Risk #2 spec passes: `npm run test:e2e -- e2e/risk-2-editor-geometry-persists-after-reload.test.ts` — 34c29e0

#### Manual

- [x] 3.2 Scope note: partial (#2 scale only); geometry deferred — 34c29e0

### Phase 4: Risk #5 smoke

#### Automated

- [x] 4.1 Risk #5 spec passes: `npm run test:e2e -- e2e/risk-5-protected-project-access.test.ts` — 34c29e0

#### Manual

- [x] 4.2 Foreign UUID strategy documented (valid format, non-owned) — 34c29e0

### Phase 5: Test-plan backport

#### Automated

- [x] 5.1 §3 Phase 5 change folder linked to `testing-e2e-critical-flows-bootstrap` — 34c29e0
- [x] 5.2 §4 Stack and §6.6 cookbook reflect Playwright bootstrap — 34c29e0

#### Manual

- [x] 5.3 Full suite verified green (prior M3L4 session; re-run before merge) — 34c29e0
