<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Auth & Project Lifecycle (S-01)

- **Plan**: `context/changes/auth-and-project-lifecycle/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-01
- **Verdict**: SOUND
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 7/7 existing paths ✓, 5/5 new paths correctly absent ✓, symbols ✓, brief↔plan ✓

## Findings

### F1 — Phase 1 Dialog manual criterion missing from Progress

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criteria / Progress §Phase 1
- **Detail**: Phase 1 Manual Verification lists "shadcn Dialog component renders in isolation (import smoke check during Phase 2 wiring)" but Progress only tracks item 1.4 (unauthenticated redirect). No matching `- [ ] 1.5` entry. Parenthetical defers the check to Phase 2, making the Phase 1 bullet unverifiable and breaking the Progress↔Phase contract `/10x-implement` relies on.
- **Fix**: Remove the Dialog bullet from Phase 1 Manual Verification (Dialog acceptance belongs in Phase 2 manual criteria, which already covers modal create flow).
- **Decision**: FIXED

### F2 — Malformed project ID returns Supabase error, not empty row

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Project detail placeholder page
- **Detail**: Plan treats "invalid UUID, wrong owner, deleted user cascade" as a single `data === null` path. PostgREST returns `{ error: { code: "22P02" } }` for malformed UUIDs (e.g. `/projects/foo`), not a silent empty row. Implementer following the plan literally may throw or show a generic error instead of redirecting to dashboard.
- **Fix A ⭐ Recommended**: Validate `Astro.params.id` with Zod `z.string().uuid()` in `[id].astro` frontmatter before querying; invalid → redirect `/dashboard?error=Project not found`
  - Strength: Fail-fast without hitting DB; same user-facing outcome for all bad IDs.
  - Tradeoff: Duplicates UUID format knowledge (minor).
  - Confidence: HIGH — standard PostgREST behavior for uuid columns.
  - Blind spot: None significant.
- **Fix B**: Extend `getProjectById` to treat any Supabase `error` as not-found and redirect
  - Strength: Centralized in service layer.
  - Tradeoff: Masks genuine DB/network errors as "not found".
  - Confidence: MEDIUM — need to distinguish 22P02 from transient failures.
  - Blind spot: Real outage handling not specified.
- **Decision**: FIXED (Fix A — Zod uuid validation in frontmatter)

### F3 — `prerender = false` only on new routes, not existing eight

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §6 — SSR prerender exports
- **Detail**: AGENTS.md requires `export const prerender = false` on all pages and API routes. Plan acknowledges zero exports exist today (Current State) but Phase 1 only adds the export to new files. Leaves 8 existing routes non-compliant; future `/10x-impl-review` may flag this.
- **Fix A ⭐ Recommended**: Add explicit bullet to Phase 1: retrofit `prerender = false` on all existing pages and API routes touched or listed in AGENTS.md (8 files)
  - Strength: Full AGENTS.md compliance in one pass; no lingering debt.
  - Tradeoff: Slightly wider Phase 1 diff (~8 one-line additions).
  - Confidence: HIGH — mechanical change, no behavior impact under `output: "server"`.
  - Blind spot: None significant.
- **Fix B**: Add to "What We're NOT Doing": prerender retrofit on existing routes (defer to separate chore)
  - Strength: Keeps S-01 scope minimal.
  - Tradeoff: Documented non-compliance with AGENTS.md until follow-up.
  - Confidence: HIGH — explicit scope boundary.
  - Blind spot: Follow-up may never happen.
- **Decision**: FIXED (Fix A — retrofit all existing routes in Phase 1)

### F4 — README auth routes table not updated

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 or Documentation (missing)
- **Detail**: `README.md` auth routes table still documents only `/dashboard` as protected. After S-01, `/projects`, `/projects/[id]`, and `/api/projects` should be documented alongside middleware guidance.
- **Fix**: Add README update to Phase 4 (or Phase 1 alongside middleware change): extend auth routes table and protected-routes note.
- **Decision**: FIXED

### F5 — Dashboard hub lacks Topbar present on public home

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 3 — Dashboard project hub
- **Detail**: `Welcome.astro` renders `Topbar` with Dashboard link and sign-out; `dashboard.astro` uses bare `Layout` without Topbar. Post-login hub will feel disconnected from the rest of the app unless dashboard adds Topbar or equivalent nav.
- **Fix**: Add Topbar to `dashboard.astro` (and optionally `[id].astro`) in Phase 3, passing `user` from `Astro.locals`.
- **Decision**: FIXED
