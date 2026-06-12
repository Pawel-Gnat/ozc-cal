<!-- PLAN-REVIEW-REPORT -->
# Plan Review: First OZC Calculation

- **Plan**: `context/changes/first-ozc-calculation/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-12
- **Verdict**: SOUND (after triage fixes applied 2026-06-12)
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓, 6/6 symbols ✓, brief↔plan ✓

## Findings

### F1 — Route contract double-loads editor state

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Calculation API route (`plan.md:90–91`, `plan.md:282`)
- **Detail**: Phase 1 route contract calls `calculateProjectOzc` then separately loads editor rooms via `getEditorState`. But `calculateProjectOzc` already calls `loadOzcCalcInput`, which fetches full editor state including `rooms` (`ozc-calculation.ts:14–17, 33`). Performance section claims a single Supabase round-trip — contradicts the route contract. Optional `calculateAndFormatProjectOzc` (line 102) solves this but is marked optional while the main contract uses the double-fetch path.
- **Fix A ⭐ Recommended**: Make `calculateAndFormatProjectOzc` the required orchestrator — single `loadOzcCalcInput`, `calculateOzc(input)`, `toOzcCalcResultDisplay(result, input.rooms)`. Route calls only that helper.
  - Strength: One load path; matches Performance section; rooms already on `ValidatableOzcInput`.
  - Tradeoff: Slightly more service code than bare `calculateProjectOzc` in route.
  - Confidence: HIGH — `input.rooms` is already typed on `ValidatableOzcInput`.
  - Blind spot: None significant.
- **Fix B**: Refactor `calculateProjectOzc` to return `{ result, rooms }` tuple.
  - Strength: Single public entry point.
  - Tradeoff: Changes F-03 service signature; README/script references may need update.
  - Confidence: MEDIUM — small blast radius but touches archived contract.
  - Blind spot: `scripts/ozc-manual-check.mts` uses pure engine only — unaffected.
- **Decision**: FIXED via Fix A — `calculateAndFormatProjectOzc` required; single `loadOzcCalcInput` path

### F2 — `ensureEditorReady` is not importable

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Calculation API route (`plan.md:88`)
- **Detail**: Plan says "Reuse `ensureEditorReady` pattern from `editor.ts`" but `ensureEditorReady` is a module-private function in `editor.ts:16–30` — not exported. Calc route cannot import it without extraction or duplication.
- **Fix**: Extract shared helper (e.g. `ensureProjectEditorReady` in `project-route-helpers.ts`) returning `Response | null`; use from both `editor.ts` and `calc.ts`. Underlying primitives `getProjectEditorReady` and `countProjectAssemblies` are already exported.
- **Decision**: FIXED — extract `ensureProjectEditorReady` to `project-route-helpers.ts`

### F3 — Phase 3 gate success criterion contradicts contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Success Criteria (`plan.md:196–197` vs `plan.md:209`, Progress `3.3`)
- **Detail**: Phase 3 contract matches the Floor plan editor section pattern — section always visible, panel when `editorReady`, amber/neutral messages when not (`[id].astro:293–322`). But manual success criterion 3.3 says "Calculation section **hidden** until prerequisites met" — contradicts contract and Desired End State line 27. Progress step 3.3 copies the wrong wording.
- **Fix**: Rewrite criterion 3.3 and Progress 3.3 to: "Calculation section always visible; shows Run panel when `editorReady`, prerequisite messages when not (mirroring Floor plan editor section)."
- **Decision**: FIXED — rewrite 3.3 and Progress 3.3; mirror editor 3-state gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 4 — Manual Engineering Verification (`plan.md:231`)
- **Detail**: Phase 4 requires Case 2 in-app verification, but `manual-verification.md` only has numbered "In-app (after S-04)" steps for Case 1 (lines 92–98). Case 2 has hand-calc tables and building-total labeling rules but no step-by-step in-app setup. Implementer must invent the two-room partition workflow during Phase 4.
- **Fix A ⭐ Recommended**: Add Case 2 in-app steps to Phase 4 contract (draw two adjacent rooms, duplicate colocated partition segments, set temps 20/16 °C, verify ~15.6 W partition per side + building label).
  - Strength: Phase 4 becomes self-contained; matches Case 1 pattern.
  - Tradeoff: Slightly longer plan.
  - Confidence: HIGH — hand-calc targets already documented.
  - Blind spot: Exact assembly U for partition depends on catalog setup — note "use U ≈ 0.5 target assembly".
- **Fix B**: Defer Case 2 to "verify building label + partition nonzero on any two-room project" — weaker US-01 guardrail.
  - Strength: Faster acceptance.
  - Tradeoff: Does not validate ±1 W partition math in-app.
  - Confidence: LOW — undermines Phase 4 intent.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — Case 2 in-app steps added to Phase 4 contract

### F5 — Display formatter file choice affects dependency direction

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — Display types (`plan.md:71`)
- **Detail**: Plan allows placing `toOzcCalcResultDisplay(result, rooms: EditorRoomState[])` in `calc-types.ts`. `EditorRoomState` lives in `project-editor.ts:16–24`. Putting the formatter in `calc-types.ts` would create `thermal → project-editor` dependency — wrong direction for a pure engine types module. Plan already mentions `calc-display.ts` as alternative.
- **Fix**: Specify `src/lib/thermal/calc-display.ts` (not `calc-types.ts`) for display types and formatter; keep engine types unchanged.
- **Decision**: FIXED — use `calc-display.ts` for display layer

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Implementation Approach (`plan.md:51`), Phase 2
- **Detail**: Plan says "following `AssemblyCatalog` fetch/error patterns" but `AssemblyCatalog` uses HTML form POST, not `fetch`. Existing fetch pattern is `useEditorState.ts:118–122` and `FloorPlanEditor.tsx:918` — no explicit `credentials` option (same-origin default suffices).
- **Fix**: Update reference to `useEditorState` / `FloorPlanEditor` for fetch; note same-origin cookie auth is implicit.
- **Decision**: FIXED — fetch pattern reference updated
