# WT 2021 Calculation Core Implementation Plan

## Overview

Roadmap foundation slice **F-03** (`wt2021-calculation-core`) delivers a **deterministic, UI-free** calculation engine for WT 2021 transmission losses and simplified per-room gravity ventilation. Consumes data persisted by S-02 (climate, assemblies) and S-03 (scale, geometry, rooms, ventilation fields). Unlocks **S-04** (`first-ozc-calculation`), which owns the run button, API route, and on-screen results (FR-009).

**PRD refs:** FR-009 (computation only), NFR (repeatability), Business Logic, WT 2021 Guardrails · **Prerequisites:** F-01 done; S-02/S-03 inputs available · **Parallel with:** was S-02/S-03 during delivery

## Current State Analysis

- **Thermal code:** only `src/lib/thermal/assembly-preview.ts` — simplified R/U with fixed `R_SI_PREVIEW = 0.13`, `R_SE_PREVIEW = 0.04`; explicitly not authoritative (`:2–3`).
- **Assembly wiring:** `src/lib/services/assemblies.ts:32–38` attaches preview to catalog rows; displayed in `AssemblyCatalog.tsx`.
- **Geometry helpers:** `segmentLengthM()` in `src/lib/editor/geometry.ts:126–139` (unused); `roomPolygonPoints()` in `src/lib/editor/room-detection.ts:162–209` (render/hit-test only). **No polygon area helper.**
- **Ventilation:** `plan_rooms.ventilation_*` nullable numerics; UI in `RoomPropertiesPanel.tsx:107–156` with placeholder helper text — units undefined.
- **Climate:** `projects.climate_zone`, `projects.external_design_temp_c`; presets in `src/lib/climate/poland-zones.ts`.
- **Shared walls:** `UNIQUE (segment_id)` on `plan_room_segments` — one segment → one room; S-03 documents duplicate-segment workaround.
- **No** calculation module, result types, calc service, or calc API.

### Key Discoveries:

- S-02 deliberately deferred authoritative U to F-03 — preview must be unified, not duplicated.
- `segmentLengthM` and scale on `projects.plan_scale_meters_per_unit` are ready inputs; floor area requires new shoelace helper on `roomPolygonPoints` output.
- Services pattern: pure logic in `src/lib/thermal/` and `src/lib/editor/`; I/O in `src/lib/services/` with `AppSupabaseClient` first arg.
- No test runner configured (AGENTS.md) — user chose manual verification only for F-03.

## Desired End State

1. **`calculateOzc(input)`** — pure function returning `OzcCalcResult` with per-room `{ transmissionW, ventilationW, totalW }` and building totals.
2. **Authoritative U** from assembly layer stacks using PN-EN ISO 6946 direction-dependent surface resistances mapped from `AssemblyCategory`.
3. **Transmission** via Q = U × A × ΔT for perimeter segments (walls, windows, doors) and horizontal surfaces (floor, ceiling/roof/ground) from room polygon area.
4. **Ventilation** via Q = 0,33 × V × ΔT where V = sum of room's m³/h fields and ΔT = T_room − T_external.
5. **`storey_height_m`** on `projects` (default 2,6) used for wall height and opening area defaults.
6. **Assembly preview** uses the same U module as the engine.
7. **Manual verification checklist** with at least one fully worked reference case (inputs + expected outputs).

### Verification

- Automated: `npm run lint`, `npm run build`, migration applies locally.
- Manual: engineering checklist walkthrough; preview U matches engine U for sample assembly.

## What We're NOT Doing

- Calculation HTTP API, run button, results UI (S-04 / FR-009 presentation)
- Persisting calculation results or run history to DB
- Mechanical or balanced supply-exhaust ventilation systems (PRD Non-Goals)
- Multi-storey, thermal bridges, formal PDF report
- Automated test framework (Vitest) — user decision
- Auto-detecting neighbor room from a single shared segment (S-03 duplicate workaround)
- Separate ground temperature field (MVP: `ground_floor` uses external design temp)
- Per-room height (global storey height only)
- Polish UI strings for new fields (English, matches existing pages)

## Implementation Approach

1. Add `storey_height_m` to `projects` and define calculation input/output types + constants (R_si/R_se map, opening height default, ventilation factor).
2. Add geometry quantification helpers (polygon area, segment wall/opening area).
3. Build authoritative U resolver and transmission engine with category-based ΔT rules and colocated-segment neighbor matching for `internal_partition`.
4. Build ventilation engine (m³/h sum per room).
5. Orchestrate in `calculateOzc`, expose DB loader service, unify assembly preview, document manual verification cases.

## Critical Implementation Details

**Colocated internal walls:** When an `internal_partition` segment's endpoints match another segment's endpoints (within a small pixel tolerance, reversed direction allowed) belonging to a **different** room, use |T_owner − T_neighbor| as ΔT. If no match, ΔT = 0 for that segment — document in manual checklist that users should draw duplicate colocated segments on both sides of a partition between rooms at different temperatures.

**Floor vs ground_floor:** For horizontal downward losses, prefer `ground_floor` assembly if present in catalog for the floor surface; otherwise use `floor` category assembly. Require at least one assembly with category `floor` or `ground_floor` and one with `ceiling` or `roof` before calculation proceeds.

**Ventilation nulls:** Treat null ventilation fields as 0 m³/h.

**Perimeter vs horizontal surfaces:** Perimeter transmission loop includes only vertical/opening categories (`external_wall`, `internal_partition`, `window`, `door`). Horizontal categories (`floor`, `ceiling`, `roof`, `ground_floor`) on boundary segments are ignored for transmission — floor/ceiling losses come from room polygon area × catalog assembly only.

## Phase 1: Schema & Calculation Contract

### Overview

Add storey height persistence and establish typed calculation contracts and normative constants the engine phases share.

### Changes Required:

#### 1. Database migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_storey_height_and_calc_prep.sql`

**Intent**: Persist global storey height per project for wall/opening area and future volume-based extensions.

**Contract**: Add nullable → NOT NULL with default `storey_height_m numeric(6,3) not null default 2.6 check (storey_height_m > 0)` on `public.projects`. No new RLS policies needed (existing project owner policies cover the column).

#### 2. Hand-written types

**File**: `src/types.ts`

**Intent**: Extend `Project` row/insert/update with `storey_height_m`.

**Contract**: Mirror migration column on `projects` table types.

#### 3. Calculation domain types

**File**: `src/lib/thermal/calc-types.ts` (new)

**Intent**: Define stable input/output shapes decoupled from Supabase row types so the pure engine is testable and S-04-ready.

**Contract**: Export at minimum:
- `OzcCalcInput` — climate (`external_design_temp_c`), `storey_height_m`, assemblies with layers + category, editor-scale, nodes, segments, rooms (incl. ventilation fields)
- `OzcCalcResult` — `rooms: { roomId, transmissionW, ventilationW, totalW }[]`, `buildingTransmissionW`, `buildingVentilationW`, `buildingTotalW`
- `OzcCalcError` / validation error union for missing prerequisites (no scale, no floor assembly, unclosed room, etc.)
- `OzcValidationError` — throwable class carrying `OzcCalcError[]`; thrown by `calculateOzc` on invalid input (S-04 catches and surfaces messages)

#### 4. Normative constants

**File**: `src/lib/thermal/wt2021-constants.ts` (new)

**Intent**: Centralize ISO 6946 surface resistances, opening default height, and ventilation factor so formulas are not scattered.

**Contract**: Export category → heat-flow direction → `{ rsi, rse }` mapping per planning decisions (horizontal: 0,13/0,04; upward/roof: 0,10/0,04; downward/floor: 0,17/0,04). **`internal_partition`**: R_si = 0,13 on both sides (R_total = 0,13 + Σ(d/λ) + 0,13) per ISO 6946 for partitions between conditioned spaces — no R_se. Export `OPENING_DEFAULT_HEIGHT_M = 1.2`, `VENTILATION_HEAT_FACTOR = 0.33`.

#### 5. Minimal UI for storey height

**File**: `src/pages/projects/[id].astro` and climate/settings form area; `src/lib/validation/climate.ts` or new validation module; `src/lib/services/project-climate.ts`

**Intent**: Let the user view/edit storey height alongside climate parameters — F-03 needs the value before S-04 runs calc.

**Contract**: Number input `storey_height_m`, range e.g. 2.0–4.0 m, default 2.6; persisted via existing climate POST pattern or extended project update service.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset --no-seed` (local)
- Linting passes: `npm run lint`
- Type checking / build passes: `npm run build`

#### Manual Verification:

- Project detail shows storey height field; saving persists value; reload shows saved value
- New projects get default 2.6 m

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Geometry Quantification

### Overview

Convert editor geometry + scale into metric areas and lengths the transmission engine consumes.

### Changes Required:

#### 1. Polygon area helper

**File**: `src/lib/editor/geometry.ts`

**Intent**: Compute room floor area in m² from editor polygon points and scale.

**Contract**: Export `polygonAreaM2(points: Point[], metersPerUnit: number): number` using shoelace on PDF-space vertices × scale². Export `roomFloorAreaM2(room, segments, nodes, metersPerUnit)` composing `roomPolygonPoints` + shoelace.

#### 2. Segment area helpers

**File**: `src/lib/editor/geometry.ts`

**Intent**: Derive wall and opening areas from segment length and storey/opening height.

**Contract**: Export `segmentWallAreaM(segment, nodes, metersPerUnit, storeyHeightM, assemblyCategory)` — for `window` and `door` use `OPENING_DEFAULT_HEIGHT_M` instead of full storey height; for vertical categories use `storeyHeightM`; return `null` if nodes missing.

#### 3. Colocated segment matcher

**File**: `src/lib/editor/geometry.ts` or `src/lib/thermal/boundary-match.ts` (new)

**Intent**: Support internal partition ΔT via S-03 duplicate-segment workaround.

**Contract**: Export `findColocatedSegment(segmentId, segments, nodes, tolerancePx): string | null` matching another segment with same endpoints (either direction) excluding same id. Export `findRoomForSegment(segmentId, rooms): string | null` returning the owning room id from `rooms[].segment_ids`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- For a known rectangle room in dev editor state, computed floor area matches hand calculation from scale
- Wall segment area = length × storey height; window segment area = length × 1.2 m

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: WT 2021 Transmission Engine

### Overview

Replace preview-only U constants with authoritative category-aware U values and compute per-room transmission losses.

### Changes Required:

#### 1. Authoritative U computation

**File**: `src/lib/thermal/wt2021-u.ts` (new)

**Intent**: Single source of truth for U from layer stacks, used by both engine and assembly preview.

**Contract**: Export `computeAssemblyU(layers, category): { rTotal, uValue }` applying direction-appropriate R_si/R_se from `wt2021-constants.ts` plus Σ(d/λ). Refactor `assembly-preview.ts` to delegate here and extend signature to accept `category` (update `assemblies.ts:37` caller). Remove "not authoritative" comment.

#### 2. Boundary temperature resolver

**File**: `src/lib/thermal/wt2021-boundary.ts` (new)

**Intent**: Map assembly category + room context to ΔT [K] for each surface.

**Contract**: Rules:
- `external_wall`, `window`, `door`, `roof`, `ground_floor` → ΔT = T_room − T_external
- `internal_partition` → |T_room − T_neighbor| when colocated segment found in another room; else 0
- Horizontal `floor` / `ceiling` / `roof` on polygon surfaces → ΔT = T_room − T_external (MVP; ground uses external temp)

Export `resolveDeltaT(category, roomTemp, externalTemp, neighborTemp | null): number`.

#### 3. Transmission calculator

**File**: `src/lib/thermal/wt2021-transmission.ts` (new)

**Intent**: Sum Q = U × A × ΔT across all surfaces contributing to a room's transmission loss.

**Contract**: For each room:
- Perimeter segments assigned to room: wall/opening area × U(assembly) × ΔT(category, …) — **exclude** segments whose assembly category is `floor`, `ceiling`, `roof`, or `ground_floor` (horizontal losses come from polygon only; prevents double-count if user assigned horizontal categories to boundary segments)
- Floor surface: polygon area × U(floor or ground_floor assembly) × ΔT
- Ceiling surface: polygon area × U(ceiling or roof assembly) × ΔT
- Skip segments/assemblies with missing data; collect warnings if needed (or hard-fail validation in orchestrator)

Export `computeRoomTransmission(room, context): { transmissionW, surfaces[] }` and building aggregation helper. Transmission context must include a prebuilt `segmentId → roomId` map and, for each `internal_partition` segment, resolve neighbor temp: colocated segment id → `findRoomForSegment` → neighbor room `internal_temp_c` (or null → ΔT = 0).

#### 4. Catalog assembly resolution

**File**: `src/lib/thermal/wt2021-transmission.ts` or `calc-validate.ts` (new)

**Intent**: Resolve which catalog assembly applies to horizontal surfaces.

**Contract**: Validation requires ≥1 assembly with category in (`floor`, `ground_floor`) and ≥1 in (`ceiling`, `roof`). Prefer `ground_floor` over `floor` and `roof` over `ceiling` when both exist; document precedence in code comment.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Assembly catalog preview U/R matches previous preview for a sample wall assembly (or documents intentional delta from ISO 6946 direction change)
- Manual reference case: single 4×5 m room (20 m² floor/ceiling), wall U=0.2, floor/ceiling U=0.15, ΔT=40 K — hand-calc includes perimeter walls **and** polygon floor + ceiling losses; engine output matches within rounding
- Internal partition with duplicate colocated segments between 20 °C and 16 °C rooms shows non-zero loss on both sides

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Gravity Ventilation Engine

### Overview

Compute per-room ventilation heat loss from the three stored m³/h fields.

### Changes Required:

#### 1. Ventilation calculator

**File**: `src/lib/thermal/wt2021-ventilation.ts` (new)

**Intent**: Apply agreed simplified gravity ventilation model per room.

**Contract**: For each room:
- `V = (ventilation_supply ?? 0) + (ventilation_exhaust ?? 0) + (ventilation_natural ?? 0)` in m³/h
- `ΔT = internal_temp_c − external_design_temp_c`
- `ventilationW = VENTILATION_HEAT_FACTOR × V × ΔT` (0,33 × V × ΔT)
- If V = 0, ventilationW = 0

Export `computeRoomVentilation(room, externalTempC): { ventilationW, volumeM3h }`.

#### 2. Document field semantics

**File**: `context/changes/wt2021-calculation-core/manual-verification.md` (new, started here)

**Intent**: Record unit assumptions for S-04 UI labeling.

**Contract**: State that all three ventilation fields are m³/h; null = 0; combined by sum.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Room with V=120 m³/h, ΔT=40 K → ventilation loss = 0,33 × 120 × 40 = 1584 W
- Room with all null ventilation fields → ventilationW = 0

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Orchestrator, Service & Manual Verification

### Overview

Wire transmission + ventilation into `calculateOzc`, load project data from Supabase, unify preview, and complete manual verification documentation.

### Changes Required:

#### 1. Pure orchestrator

**File**: `src/lib/thermal/calculate-ozc.ts` (new)

**Intent**: Single entry point for S-04 and manual scripts.

**Contract**: Export `calculateOzc(input: OzcCalcInput): OzcCalcResult` — call `validateOzcInput` first; on any errors throw `OzcValidationError` with the error list (do not return partial results). On success, run transmission + ventilation per room, sum building totals. Deterministic: no timestamps, no randomness, stable room ordering.

#### 2. Validation module

**File**: `src/lib/thermal/calc-validate.ts` (new)

**Intent**: Centralize input validation errors with user-meaningful messages for S-04 to surface.

**Contract**: Export `validateOzcInput(input): OzcCalcError[]` covering missing scale, missing climate, no rooms, missing floor/ceiling catalog assembly, unclosed room chain, missing assembly on segment.

#### 3. DB loader service

**File**: `src/lib/services/ozc-calculation.ts` (new)

**Intent**: Load all inputs for a project id and invoke pure engine — mirrors `project-editor.ts` + `assemblies.ts` composition.

**Contract**: Export `loadOzcCalcInput(supabase, projectId): Promise<OzcCalcInput>` and `calculateProjectOzc(supabase, projectId): Promise<OzcCalcResult>`. `calculateProjectOzc` loads input then calls `calculateOzc` — propagates `OzcValidationError` to caller (S-04). RLS enforced via existing project ownership queries.

#### 4. Assembly preview verification

**File**: `src/lib/thermal/assembly-preview.ts`, `src/lib/services/assemblies.ts`

**Intent**: Confirm Phase 3 preview delegation is complete; update module comment and note any U shifts in manual-verification.md.

**Contract**: Verify `computeAssemblyPreview(layers, category)` delegates to `computeAssemblyU` (done in Phase 3). Remove "not authoritative" wording from `assembly-preview.ts`. Phase 5 does **not** re-implement the refactor.

#### 5. Manual verification document

**File**: `context/changes/wt2021-calculation-core/manual-verification.md`

**Intent**: Give implementer and HVAC reviewer repeatable manual cases since no automated test runner.

**Contract**: At least two cases:
1. **Single-room box** — dimensions, U-values, temps, ventilation; hand-calculated expected W; steps to construct in app after S-04 (or direct `calculateOzc` call with fixture JSON during F-03 dev)
2. **Two-room internal wall** — duplicate colocated partition, different temps

Include rounding tolerance (e.g. ±1 W).

#### 6. README note

**File**: `README.md`

**Intent**: Point contributors to calculation module location and manual verification doc.

**Contract**: Short subsection under development notes: `src/lib/thermal/`, manual verification path, F-03 scope vs S-04.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `calculateProjectOzc` on a seeded dev project returns deterministic result on two consecutive calls
- Manual verification cases executed and results within documented tolerance
- Assembly preview U unchanged or intentionally updated with ISO 6946 values documented in manual-verification.md

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Not in scope for F-03 (user decision — manual verification only)

### Integration Tests:

- Not in scope — no test runner configured

### Manual Testing Steps:

1. Apply migration; set climate + storey height on a test project
2. Ensure catalog has external wall, floor/ground_floor, ceiling/roof, window assemblies
3. In editor, draw rectangular room with scale; assign assemblies; set ventilation m³/h
4. Invoke `calculateProjectOzc` via temporary dev script or REPL (document in manual-verification.md)
5. Compare output to hand calculations in manual-verification.md
6. Repeat call — identical result
7. Two-room partition case with duplicate internal segments

## Performance Considerations

Calculation is pure CPU on small project graphs (typical: <50 rooms, <500 segments). No caching required for MVP. Run synchronously in API when S-04 adds it — expected sub-100 ms for MVP data volumes.

## Migration Notes

- `storey_height_m` backfills existing projects to 2.6 m via column default
- No changes to ventilation column semantics — document m³/h in manual-verification.md; S-04 may add UI unit labels later
- Assembly preview U values may shift slightly when ISO 6946 direction-specific R_si/R_se apply — note in manual verification doc

## References

- Roadmap F-03: `context/foundation/roadmap.md`
- PRD FR-009, Business Logic: `context/foundation/prd.md`
- S-02 assembly handoff: `context/archive/2026-06-02-climate-and-assemblies/plan-brief.md`
- S-03 geometry/ventilation inputs: `context/archive/2026-06-08-pdf-floor-plan-editor/plan-brief.md`
- Preview module: `src/lib/thermal/assembly-preview.ts`
- Geometry: `src/lib/editor/geometry.ts`, `src/lib/editor/room-detection.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema & Calculation Contract

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset --no-seed` (local) — 7a6d0a6
- [x] 1.2 Linting passes: `npm run lint` — 7a6d0a6
- [x] 1.3 Type checking / build passes: `npm run build` — 7a6d0a6

#### Manual

- [x] 1.4 Project detail shows storey height field; saving persists value; reload shows saved value — 7a6d0a6
- [x] 1.5 New projects get default 2.6 m — 7a6d0a6

### Phase 2: Geometry Quantification

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`

#### Manual

- [ ] 2.3 Known rectangle room floor area matches hand calculation from scale
- [ ] 2.4 Wall segment area = length × storey height; window segment area = length × 1.2 m

### Phase 3: WT 2021 Transmission Engine

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 Assembly catalog preview U/R aligns with authoritative module for sample assembly
- [ ] 3.4 Single-room reference case (walls + floor + ceiling) transmission matches hand calc within rounding
- [ ] 3.5 Internal partition duplicate segments show non-zero loss on both sides

### Phase 4: Gravity Ventilation Engine

#### Automated

- [ ] 4.1 Linting passes: `npm run lint`
- [ ] 4.2 Build passes: `npm run build`

#### Manual

- [ ] 4.3 Room with V=120 m³/h, ΔT=40 K → ventilation loss = 1584 W
- [ ] 4.4 Room with all null ventilation fields → ventilationW = 0

### Phase 5: Orchestrator, Service & Manual Verification

#### Automated

- [ ] 5.1 Linting passes: `npm run lint`
- [ ] 5.2 Build passes: `npm run build`

#### Manual

- [ ] 5.3 `calculateProjectOzc` returns deterministic result on two consecutive calls
- [ ] 5.4 Manual verification cases executed within documented tolerance
- [ ] 5.5 Assembly preview changes documented in manual-verification.md if applicable
