<!-- PLAN-REVIEW-REPORT -->
# Plan Review: PDF Floor Plan Editor

- **Plan**: context/changes/pdf-floor-plan-editor/plan.md
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: SOUND (after triage fixes)
- **Findings**: 2 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL → PASS (after F1, F2, F6 fixes) |
| Plan Completeness | WARNING → PASS (after F4, F5 fixes) |

## Grounding

Grounding: 8/8 paths ✓, 4/4 symbols ✓, brief↔plan ✓

## Findings

### F1 — replaceEditorState delete order omits junction table

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Editor service + migration
- **Detail**: Plan specified delete order `rooms → segments → nodes` but `plan_room_segments` FKs use default NO ACTION; deletes fail while junction rows exist.
- **Fix A ⭐ Recommended**: Add `ON DELETE CASCADE` on `plan_room_segments.room_id` and `plan_room_segments.segment_id`; document cascade behavior in delete order.
- **Decision**: FIXED via Fix A

### F2 — Blanket `/api/*` JSON 401 breaks auth forms

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Middleware JSON 401
- **Detail**: Blanket `/api/*` 401 would block `/api/auth/signin` and `/api/auth/signup` before handlers run; auth forms POST to those paths.
- **Fix A ⭐ Recommended**: Scope JSON 401 to `/api/projects/` only; leave `/api/auth/*` unauthenticated.
- **Decision**: FIXED via Fix A

### F3 — UNIQUE on segment_id blocks shared internal walls

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 1 — Migration schema
- **Detail**: `UNIQUE (segment_id)` prevents one drawn segment from bordering two rooms; real internal partitions are shared.
- **Fix A ⭐ Recommended**: Document MVP rule — draw colocated duplicate segments or assign to one room until F-03.
- **Decision**: FIXED via Fix A

### F4 — Full-state PUT wipes geometry on partial saves

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — replaceEditorState; Phase 2 — scale calibration
- **Detail**: Full replace deletes all geometry; scale-only PUT without empty arrays would wipe data.
- **Fix**: Document complete-document PUT contract; scale saves use empty arrays.
- **Decision**: FIXED

### F5 — Assembly picker workflow left ambiguous

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Drawing interaction
- **Detail**: Plan offered two workflows without choosing one.
- **Fix**: Select assembly first in toolbar, then draw segment.
- **Decision**: FIXED

### F6 — Pan/zoom pointer coordinates not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — FloorPlanEditor; Phase 3 — Drawing interaction
- **Detail**: Pan/zoom transforms require inverse mapping for pointer → stored coordinates.
- **Fix**: Add inverse-transform rule to Critical Implementation Details.
- **Decision**: FIXED

### F7 — No optimistic concurrency on debounced auto-save

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Editor API; Phase 3 — useEditorState
- **Detail**: Last-write-wins on debounced PUT; two tabs could overwrite.
- **Fix**: Document MVP single-tab assumption in Performance Considerations.
- **Decision**: FIXED
