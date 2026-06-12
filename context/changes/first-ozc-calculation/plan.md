# First OZC Calculation Implementation Plan

## Overview

Roadmap slice **S-04** (`first-ozc-calculation`) wires the completed F-03 calculation engine to the product UI — closing **FR-009** and **US-01** (Primary Success Criteria). The user runs a calculation from the project detail page and sees per-room and building heat losses plus ventilation on screen (no formal report).

**PRD refs:** FR-009, US-01, NFR (repeatability) · **Prerequisites:** S-03 (editor), F-03 (engine) — both done

## Current State Analysis

- **Engine:** `src/lib/services/ozc-calculation.ts` exports `loadOzcCalcInput` and `calculateProjectOzc`. Pure entry `calculateOzc` in `src/lib/thermal/calculate-ozc.ts` throws `OzcValidationError` on invalid input. Result type `OzcCalcResult` has per-room watts and building sums — no room names.
- **API:** Project routes exist for climate, assemblies, floor plan, editor (`src/pages/api/projects/[id]/`). No calc route. Shared helpers: `resolveProjectApiContext`, `jsonOk`/`jsonError`, `ensureEditorReady` pattern in `editor.ts`.
- **UI:** `src/pages/projects/[id].astro` — sectioned layout; one React island (`AssemblyCatalog`). `editorReady = hasClimate && hasFloorPlan && assemblies.length > 0` (line 22). Last section is "Floor plan editor" with link to `/projects/[id]/editor`.
- **Verification:** `context/archive/2026-06-09-wt2021-calculation-core/manual-verification.md` — Case 1 (~2198 W), Case 2 (partition), building-total labeling rules, in-app steps for S-04.

### Key Discoveries:

- F-03 plan-review **Fix A** locks error contract: `calculateProjectOzc` propagates `OzcValidationError`; S-04 catches and surfaces messages — no Result union.
- F-03 impl-review **F6**: `buildingTotalW` is sum of per-room losses, not net envelope — UI must label **"Sum of room heat losses"**.
- `ApiErrorCode` already includes `VALIDATION_ERROR` and `PRECONDITION_FAILED`; `jsonError` accepts optional `issues[]`.
- `/api/projects` already in `PROTECTED_ROUTES` (`src/middleware.ts`).

## Desired End State

1. **Calculation API** — `POST /api/projects/[id]/calc` returns enriched result with room names or structured 422 validation errors.
2. **Results panel** — React island on project detail with Run button (inline spinner), per-room table (transmission, ventilation, total W), building summary with correct labeling, validation error list.
3. **Gated section** — Calculation section visible when `editorReady`; prerequisite message when not.
4. **Engineering verification** — Case 1 and Case 2 from manual checklist pass in-app (±1 W).

### Verification

- Automated: `npm run lint`, `npm run build`.
- Manual: Case 1 + Case 2 in-app per `manual-verification.md`; validation error paths (no scale, no rooms).

## What We're NOT Doing

- Engine formula or validation changes (F-03 scope)
- Persisting calculation results or run history to DB
- Formal PDF/print report (PRD Non-Goals)
- Run button or results inside the floor plan editor
- Preflight readiness checklist before Run
- Stale-results warning or sessionStorage
- Automated test framework (repo convention + F-03 decision)
- Per-surface breakdown (engine does not expose surface-level results)
- Polish UI strings (English throughout)

## Implementation Approach

1. Add display types and a response formatter that merges `OzcCalcResult` with room names from editor state.
2. Implement `POST` calc API route reusing editor precondition guard and F-03 error contract.
3. Build `OzcCalculationPanel` React component following `useEditorState` / `FloorPlanEditor` fetch/error patterns.
4. Add Calculation section to project detail page after Floor plan editor.
5. Execute manual verification checklist Cases 1 and 2.

## Critical Implementation Details

**Building total labeling:** The building summary must include helper text: totals are the **sum of per-room heat losses**, not net building envelope loss. Internal partitions with duplicate colocated segments contribute on both rooms (F-03 MVP model).

**Room name fallback:** When `EditorRoomState.name` is null, display a short fallback (e.g. `"Room"` + first 8 chars of UUID) so the table is never empty-labeled.

## Phase 1: Calculation API Route

### Overview

Expose the F-03 engine over HTTP with auth, precondition checks, enriched response, and structured validation errors.

### Changes Required:

#### 1. Display types and response formatter

**File**: `src/lib/thermal/calc-display.ts` (new)

**Intent**: Define the API/UI response shape that adds human-readable room names to engine output without coupling pure engine types to `project-editor`.

**Contract**: Export `OzcRoomCalcResultDisplay` extending `OzcRoomCalcResult` with `name: string | null`. Export `OzcCalcResultDisplay` with `rooms: OzcRoomCalcResultDisplay[]` and same building total fields. Export `toOzcCalcResultDisplay(result: OzcCalcResult, rooms: EditorRoomState[]): OzcCalcResultDisplay` — import `EditorRoomState` from `@/lib/services/project-editor`; map names by `roomId`, preserve engine sort order. Do **not** add display types to `calc-types.ts`.

#### 2. Calculation API route

**File**: `src/pages/api/projects/[id]/calc.ts` (new)

**Intent**: Protected endpoint the results panel calls to run OZC for the current project.

**Contract**:

- `export const prerender = false`
- `POST` only; other methods → 405 via absence or explicit handler
- `resolveProjectApiContext` for auth + project ownership
- Reuse editor precondition guard via shared `ensureProjectEditorReady` helper (extracted from `editor.ts`) — return 422 `PRECONDITION_FAILED` if not ready
- `isSameOriginRequest` check on POST (match `editor.ts` PUT)
- Call `calculateAndFormatProjectOzc(supabase, projectId)` — single load, calculate, enrich with room names
- Catch `OzcValidationError`: return `jsonError(422, error.message, "VALIDATION_ERROR", error.errors.map(e => ({ path: [e.roomId ?? e.segmentId ?? e.code], message: e.message })))`
- Catch `Error` with message `"Project not found"` → 404
- Other errors → log + 500 `INTERNAL_ERROR`

#### 3. Shared editor-ready guard

**File**: `src/lib/api/project-route-helpers.ts` and `src/pages/api/projects/[id]/editor.ts`

**Intent**: Extract the private `ensureEditorReady` from `editor.ts` into an exported helper so both editor and calc routes share the same precondition check.

**Contract**: Export `ensureProjectEditorReady(supabase, project): Promise<Response | null>` — calls `countProjectAssemblies` + `getProjectEditorReady`; returns `jsonError(422, …, "PRECONDITION_FAILED")` or `null`. Update `editor.ts` to import and use the shared helper (no behavior change).

#### 4. Service orchestration helper

**File**: `src/lib/services/ozc-calculation.ts`

**Intent**: Single-load orchestration for the calc route — avoid fetching editor state twice.

**Contract**: Export `calculateAndFormatProjectOzc(supabase, projectId): Promise<OzcCalcResultDisplay>` — `loadOzcCalcInput` once, `calculateOzc(input)`, `toOzcCalcResultDisplay(result, input.rooms)`. Route catches errors only; no separate `getEditorState` call.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Route file exports `prerender = false` and `POST` handler

#### Manual Verification:

- Unauthenticated POST returns 401
- POST on project missing climate/assemblies/PDF returns 422 `PRECONDITION_FAILED`
- POST on valid incomplete geometry (no scale) returns 422 `VALIDATION_ERROR` with issues
- POST on valid complete project returns 200 with numeric watts and room names

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Results React Island

### Overview

Build the interactive panel: Run button, loading state, results table, building summary, and validation error display.

### Changes Required:

#### 1. OzcCalculationPanel component

**File**: `src/components/projects/OzcCalculationPanel.tsx` (new)

**Intent**: Client-side UI for triggering calculation and displaying results on the project detail page.

**Contract**:

- Props: `{ projectId: string }`
- State: `idle | loading | success | error`; `result: OzcCalcResultDisplay | null`; `errorMessage: string | null`; `issues: ApiErrorIssue[] | null`
- **Run calculation** button using shadcn `Button` — disabled while loading; shows spinner + "Calculating…" text during fetch
- `fetch(\`/api/projects/${projectId}/calc\`, { method: "POST" })` — same-origin default sends session cookies (match `useEditorState.ts`; no explicit `credentials` option needed)
- Parse `{ data }` success body and `{ error }` failure body per `json-response.ts` shape
- On 422 `VALIDATION_ERROR`: show error message + bulleted list of `issues[].message`
- On other errors: show generic message from `error.message`
- **Results table** (when success): columns Room, Transmission (W), Ventilation (W), Total (W); integer formatting via `Math.round`
- **Building summary** below table: three values (transmission, ventilation, total) + label **"Sum of room heat losses"** with brief helper text per F-03 manual-verification.md
- Styling: match cosmic theme — `border-white/10`, `bg-white/5`, purple primary button, red error panel, emerald success accents (follow `[id].astro` and `AssemblyCatalog` patterns)
- Use `cn()` for class merging

#### 2. Shared API error type import

**File**: `src/components/projects/OzcCalculationPanel.tsx`

**Intent**: Type-safe parsing of API error responses.

**Contract**: Import `ApiErrorIssue` from `@/lib/api/json-response`; import display types from thermal module.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Run button shows inline spinner while loading
- Successful run displays per-room rows with integer watts
- Building summary shows "Sum of room heat losses" helper text
- Validation failure shows readable error list (e.g. "Scale calibration is required")
- Re-run replaces previous results (no history)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Project Page Integration

### Overview

Mount the calculation panel on the project detail page with the same gate as the editor.

### Changes Required:

#### 1. Project detail page section

**File**: `src/pages/projects/[id].astro`

**Intent**: Add the Calculation section as the final block on the project hub — the natural end of the US-01 flow.

**Contract**:

- Import `OzcCalculationPanel`
- Add `<section>` after "Floor plan editor" (after line ~323) with heading **Calculation**, description mentioning heat losses and ventilation
- When `editorReady`: mount `<OzcCalculationPanel client:load projectId={project.id} />`
- When not ready: mirror Floor plan editor section — amber prerequisite message if PDF uploaded, neutral message if no PDF yet
- No server-side calc on page load — panel is client-triggered only

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Calculation section always visible with heading and description; shows Run panel when `editorReady`, prerequisite messages when not (mirroring Floor plan editor section)
- Section appears with Run button when editor prerequisites met
- Full page layout consistent with existing sections (spacing, borders, typography)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Manual Engineering Verification

### Overview

Validate US-01 engineering guardrail using the F-03 manual checklist in the running app.

### Changes Required:

#### 1. Verification execution (no code changes unless bugs found)

**File**: `context/archive/2026-06-09-wt2021-calculation-core/manual-verification.md` (reference)

**Intent**: Confirm on-screen results match hand-calculated expectations before marking S-04 done.

**Contract**: Execute **Case 1** (single-room 4×5 m box, ΔT=40 K, V=120 m³/h → total ≈ 2198 W) and **Case 2** (two-room internal partition with duplicate colocated segments → partition loss on both sides) following the steps below. Tolerance ±1 W. Document pass/fail in phase notes or commit message.

**Case 1 in-app steps** (from `manual-verification.md`):

1. Set climate + storey height 2,6 m.
2. Create wall / floor / ceiling catalog entries.
3. Draw 4×5 m room, calibrate scale, assign assemblies.
4. Set room temp 20 °C, ventilation supply 120 m³/h.
5. Run calculation — compare to ≈ 2198 W total (transmission ≈ 614 W, ventilation ≈ 1584 W).

**Case 2 in-app steps**:

1. On same or new project with climate T_ext = −20 °C, create `internal_partition` assembly targeting U ≈ 0,5 W/(m²·K).
2. Draw two adjacent rooms sharing one wall line; draw **duplicate colocated segments** on both sides (S-03 workaround).
3. Set Room A temp 20 °C (owns partition segment), Room B temp 16 °C (owns colocated segment).
4. Run calculation — verify partition contributes ≈ 15,6 W per room side (±1 W); building summary shows **"Sum of room heat losses"** label.

#### 2. README update (optional, minimal)

**File**: `README.md`

**Intent**: Point developers to the calc API and UI now that S-04 exists.

**Contract**: Update the "OZC calculation engine (F-03)" section to note S-04 adds `POST /api/projects/[id]/calc` and the Calculation panel on project detail — only if the section still says "no calculation API".

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Fixture runner still passes: `npx tsx scripts/ozc-manual-check.mts`

#### Manual Verification:

- Case 1: room total ≈ 2198 W (transmission ≈ 614 W, ventilation ≈ 1584 W)
- Case 2: partition contributes ~15.6 W per room side; building total label clearly states sum-of-rooms semantics
- Repeat Run on same project returns identical results (determinism)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the change complete.

---

## Testing Strategy

### Unit Tests:

- Not in scope — no test runner configured (AGENTS.md). Regression guard is `scripts/ozc-manual-check.mts` (engine only).

### Integration Tests:

- Manual API smoke via browser devtools or curl with auth session
- End-to-end US-01 flow: register → project → climate → assemblies → PDF → editor (draw room) → Run calc → verify numbers

### Manual Testing Steps:

1. Create project, set climate (T_ext = −20 °C), storey height 2.6 m, create wall/floor/ceiling assemblies per Case 1 targets.
2. Upload PDF, open editor, calibrate scale, draw 4×5 m room, assign assemblies, set temp 20 °C and supply 120 m³/h.
3. Return to project page, Run calculation — verify ≈ 2198 W total.
4. Draw Case 2 two-room setup with duplicate partition segments — verify partition losses and building label.
5. Remove scale in editor, save, Run calc — verify validation error about scale.
6. Re-run after fix — verify results replace previous display.

## Performance Considerations

- Synchronous POST; F-03 expects sub-100 ms for MVP project sizes. No caching needed.
- Single Supabase round-trip for loader (`loadOzcCalcInput` parallelizes editor + assemblies). Acceptable for v1.

## Migration Notes

- No database migrations required. F-03 already added `storey_height_m`.

## References

- Roadmap S-04: `context/foundation/roadmap.md`
- F-03 engine plan (archived): `context/archive/2026-06-09-wt2021-calculation-core/plan.md`
- Manual verification checklist: `context/archive/2026-06-09-wt2021-calculation-core/manual-verification.md`
- F-03 S-04 error contract: `context/archive/2026-06-09-wt2021-calculation-core/reviews/plan-review.md` (F-04 Fix A)
- Building total labeling: `context/archive/2026-06-09-wt2021-calculation-core/reviews/impl-review.md` (F6)
- API pattern: `src/pages/api/projects/[id]/editor.ts`
- Engine service: `src/lib/services/ozc-calculation.ts`
- Pure engine: `src/lib/thermal/calculate-ozc.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Calculation API Route

#### Automated

- [x] 1.1 Linting passes: `npm run lint`
- [x] 1.2 Production build passes: `npm run build`
- [x] 1.3 Route file exports `prerender = false` and `POST` handler

#### Manual

- [x] 1.4 Unauthenticated POST returns 401
- [x] 1.5 POST on project missing climate/assemblies/PDF returns 422 `PRECONDITION_FAILED`
- [x] 1.6 POST on valid incomplete geometry returns 422 `VALIDATION_ERROR` with issues
- [x] 1.7 POST on valid complete project returns 200 with numeric watts and room names

### Phase 2: Results React Island

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Production build passes: `npm run build`

#### Manual

- [x] 2.3 Run button shows inline spinner while loading
- [x] 2.4 Successful run displays per-room rows with integer watts
- [x] 2.5 Building summary shows "Sum of room heat losses" helper text
- [x] 2.6 Validation failure shows readable error list
- [x] 2.7 Re-run replaces previous results

### Phase 3: Project Page Integration

#### Automated

- [x] 3.1 Linting passes: `npm run lint`
- [x] 3.2 Production build passes: `npm run build`

#### Manual

- [x] 3.3 Calculation section always visible; Run panel when editorReady, prerequisite messages when not
- [x] 3.4 Section appears with Run button when editorReady
- [x] 3.5 Full page layout consistent with existing sections

### Phase 4: Manual Engineering Verification

#### Automated

- [ ] 4.1 Linting passes: `npm run lint`
- [ ] 4.2 Production build passes: `npm run build`
- [ ] 4.3 Fixture runner passes: `npx tsx scripts/ozc-manual-check.mts`

#### Manual

- [ ] 4.4 Case 1: room total ≈ 2198 W
- [ ] 4.5 Case 2: partition losses and building label verified
- [ ] 4.6 Repeat Run returns identical results
