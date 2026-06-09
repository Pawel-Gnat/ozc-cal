<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: PDF Floor Plan Editor

- **Plan**: context/changes/pdf-floor-plan-editor/plan.md
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-09
- **Verdict**: APPROVED (post-triage fixes applied)
- **Findings**: 1 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Non-transactional full replace can wipe geometry on partial failure

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project-editor.ts:222–311
- **Detail**: `replaceEditorState` deletes all `plan_rooms`, `plan_segments`, and `plan_nodes` in separate Supabase calls, then inserts new rows. If any insert fails (PK conflict, FK violation, network error), the project can be left with empty or partial geometry. The repo's assembly replace uses a single Postgres RPC (`replace_assembly_with_layers`) for atomic multi-table writes; editor state does not follow that pattern.
- **Fix A ⭐ Recommended**: Add a `replace_editor_state` Postgres RPC (migration) that performs delete+insert in one transaction; keep the TypeScript service as a thin caller.
  - Strength: Matches the established assembly pattern; eliminates the wipe-on-partial-failure class.
  - Tradeoff: Requires a new migration and RPC testing; more work than a client-side guard.
  - Confidence: HIGH — identical problem already solved in S-02 assemblies.
  - Blind spot: RPC payload size limits for very large floor plans not yet measured.
- **Fix B**: Defer deletes until inserts validate (two-phase: insert to temp/staging tables, then swap)
  - Strength: Avoids a big-bang delete before validation.
  - Tradeoff: More schema complexity; still needs transaction boundaries.
  - Confidence: MEDIUM — workable but heavier than RPC for MVP follow-up.
- **Decision**: FIXED via Fix A — `replace_editor_state` RPC in `20260609180000_replace_editor_state_rpc.sql`

### F2 — Debounced saves dropped while PUT is in flight

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useEditorState.ts:94–97, 142–148
- **Detail**: `isSavingRef` causes `runSave` to return early when a PUT is already running. A debounced `scheduleSave` that fires during that window is silently discarded with no retry queue. Rapid drawing can leave the last edit unsaved until the next mutation triggers another save.
- **Fix**: Track a `pendingSave` flag and chain another save in the `finally` block instead of bailing out when `isSavingRef` is true.
- **Decision**: FIXED — pending save queue in `useEditorState.ts`

### F3 — No flush of pending edits on navigation/unmount

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useEditorState.ts:151–157
- **Detail**: Cleanup only clears the debounce timer; it does not flush pending edits. `saveNow` is exported but never called from `FloorPlanEditor`. Navigating away within the 800 ms debounce window can lose unsaved work.
- **Fix**: Call `saveNow` (or `navigator.sendBeacon` fallback) on unmount when dirty; optionally warn via `beforeunload` when a save is pending.
- **Decision**: FIXED — unmount flush + `beforeunload` guard in `useEditorState.ts`

### F4 — Duplicate entity IDs pass Zod but fail at insert

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/validation/editor.ts:47–49
- **Detail**: `nodes`, `segments`, and `rooms` arrays have no duplicate-ID checks. Duplicate UUIDs pass Zod validation but fail on Postgres PK insert — after deletes in F1 may have already run, amplifying data-loss risk.
- **Fix**: Add `superRefine` checks that each `id` appears at most once per collection before the replace runs.
- **Decision**: FIXED — `assertUniqueIds` in `editor.ts`

### F5 — No upper bound on editor payload array sizes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/validation/editor.ts:47–49
- **Detail**: No `.max()` on `nodes`, `segments`, or `rooms` arrays (contrast `assembly.ts` which caps layers). A large or crafted payload triggers unbounded deletes/inserts and memory use on client and Worker.
- **Fix**: Add reasonable `.max()` limits tuned to expected floor-plan size (e.g. 500 nodes, 1000 segments, 100 rooms).
- **Decision**: FIXED — `MAX_EDITOR_*` limits in `editor.ts`

### F6 — Scale calibration uses full-replace delete path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/services/project-editor.ts:222–235, src/components/hooks/useEditorState.ts:249–264
- **Detail**: `saveScaleImmediately` PUTs empty `nodes`/`segments`/`rooms` through the full-replace endpoint. This matches the plan's documented contract (scale-only saves use empty arrays) and is safe during first-use calibration when geometry is empty — but the API allows any authenticated client to wipe geometry while updating scale if IDs are replayed after drawing starts.
- **Fix**: Add server-side guard: if existing geometry rows exist and incoming arrays are empty, reject with 422 unless an explicit `scale_only: true` flag is set during initial calibration window — or split scale update to a dedicated endpoint.
- **Decision**: FIXED — RPC rejects empty payload when geometry rows exist

### F7 — Zod scale completeness rule deferred to service layer

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/validation/editor.ts
- **Detail**: Plan specified `superRefine` rule that scale fields must be fully populated or all null. Assembly ownership is validated in `replaceEditorState` rather than Zod. Both work at runtime but split validation across layers.
- **Fix**: Add scale completeness `superRefine` to `editorStateSchema` for parity with plan contract.
- **Decision**: FIXED — enforced by `planScaleSchema.nullable()` (null or complete object; no partial scale shape)

### F8 — pdfjs-dist uses caret range instead of exact pin

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: package.json
- **Detail**: Plan specified pin `"pdfjs-dist": "5.4.296"`; implementation uses `"^5.4.296"`. Lockfile pins the resolved version but npm install could pull a newer patch.
- **Fix**: Remove caret to match plan pin, or document intentional semver flexibility in README.
- **Decision**: FIXED — exact pin in `package.json`
