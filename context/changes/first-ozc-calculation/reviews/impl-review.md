<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First OZC Calculation

- **Plan**: context/changes/first-ozc-calculation/plan.md
- **Scope**: Phases 1–4 of 4 (all completed)
- **Date**: 2026-06-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Redundant DB round-trips on calc POST

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/ozc-calculation.ts:10, src/lib/api/project-route-helpers.ts:44–45
- **Detail**: `resolveProjectApiContext` already loads and authorizes the project, but `loadOzcCalcInput` calls `getProjectById` again. `ensureProjectEditorReady` runs `countProjectAssemblies`, then `loadOzcCalcInput` calls `listAssembliesWithLayers` — two assembly queries per calc request. Acceptable for MVP sizes but avoidable duplication.
- **Fix A ⭐ Recommended**: Pass the already-loaded `project` from `calc.ts` into `calculateAndFormatProjectOzc` / `loadOzcCalcInput` and derive editor readiness from the assemblies list returned by `listAssembliesWithLayers`.
  - Strength: Removes 1–2 Supabase round-trips per Run; aligns loader with route context.
  - Tradeoff: Slightly wider function signatures; precondition guard may need to accept assemblies count from loader.
  - Confidence: HIGH — project object is already in scope at line 16 of calc.ts.
  - Blind spot: Haven't measured actual latency impact on Cloudflare Workers.
- **Fix B**: Leave as-is for MVP; optimize when calc latency becomes measurable
  - Strength: Zero code churn; sub-100 ms target still met for typical projects.
  - Tradeoff: Redundant work on every Run persists.
  - Confidence: MED — F-03 plan cites acceptable latency for v1.
  - Blind spot: Large projects with many assemblies untested.
- **Decision**: FIXED via Fix A — pass project to loader; derive readiness from assemblies list

### F2 — Panel silent on malformed error responses

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/projects/OzcCalculationPanel.tsx:37–46
- **Detail**: On non-OK responses, `errorBody.error.message` is used without fallback. If JSON parse fails or body lacks `error`, `errorMessage` stays null and the UI shows nothing (`status === "error" && errorMessage` guard). `useEditorState` uses `?.message ?? "Could not save…"` and `response.json().catch(() => null)`.
- **Fix**: Align with `useEditorState`: wrap `response.json()` in `.catch(() => null)`, use `errorBody?.error?.message ?? "Could not run calculation. Please try again."`, always set `setStatus("error")`.
- **Decision**: FIXED

### F3 — OzcCalculationPanel omits cn()

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/projects/OzcCalculationPanel.tsx
- **Detail**: Plan Phase 2 and AGENTS.md require `cn()` from `@/lib/utils` for class merging. Component uses static class strings only — no behavioral impact, but deviates from repo convention and plan contract.
- **Fix**: Import `cn()` and use where conditional classes may appear; or accept static-only classes as intentional if no merging needed.
- **Decision**: FIXED

### F4 — Error panel missing role="alert"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/projects/OzcCalculationPanel.tsx:87
- **Detail**: Error block has no `role="alert"`. `FloorPlanEditor` and `[id].astro` prerequisite banners use `role="alert"` for screen-reader announcement.
- **Fix**: Add `role="alert"` to the error container div.
- **Decision**: FIXED (applied with F3 error panel edit)

## Automated Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS | 0 errors; 14 no-console warnings in `scripts/ozc-manual-check.mts` (expected for CLI script) |
| `npm run build` | PASS | Production SSR build completed |
| `npx tsx scripts/ozc-manual-check.mts` | PASS | All Case 1, Case 2, S-04 display/rounding checks PASS |

## Manual Verification (Progress section)

All Phase 1–4 manual items marked `[x]` with commit SHAs `5f0d8b4` / `6e555c3`. Phase 4 notes document Case 1 Δ2 W from layer-derived U (2196 vs 2198 hand table) — acceptable per change.md. In-app smoke confirmed by developer per change.md notes.
