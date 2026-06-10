<!-- PLAN-REVIEW-REPORT -->
# Plan Review: WT 2021 Calculation Core

- **Plan**: `context/changes/wt2021-calculation-core/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-09
- **Verdict**: REVISE → **SOUND** (after triage fixes applied 2026-06-09)
- **Findings**: 1 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓, 5/5 symbols ✓, brief↔plan ✓

## Findings

### F1 — Horizontal surfaces double-counted (perimeter + polygon)

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Transmission calculator (`plan.md:220–223`, `plan.md:159`)
- **Detail**: Engine sums all room perimeter segments via `segmentWallAreaM` and separately adds full polygon floor/ceiling losses. Editor allows any `AssemblyCategory` on perimeter segments (`AssemblyPicker.tsx:42–55`). A user can assign `floor`/`ceiling`/`ground_floor`/`roof` to boundary segments — those surfaces would be counted twice (segment area + polygon area).
- **Fix A ⭐ Recommended**: Exclude horizontal categories (`floor`, `ceiling`, `roof`, `ground_floor`) from the perimeter transmission loop; polygon surfaces only for horizontal losses.
  - Strength: Engine-side guard; works regardless of editor data quirks; matches plan intent (polygon = horizontal, perimeter = vertical/openings).
  - Tradeoff: Perimeter segments with horizontal categories become inert for transmission (document in manual-verification.md).
  - Confidence: HIGH — matches S-03 model where floor/ceiling come from catalog, not drawn segments.
  - Blind spot: None significant.
- **Fix B**: Add editor validation blocking horizontal categories on room boundary segments.
  - Strength: Prevents bad data at source.
  - Tradeoff: S-03 scope creep; existing projects with horizontal perimeter segments would need migration/cleanup.
  - Confidence: MEDIUM — UX change not planned in F-03.
  - Blind spot: Existing saved editor states not surveyed.
- **Decision**: FIXED via Fix A — exclude horizontal categories from perimeter loop; polygon only for horizontal losses

### F2 — Colocated segment → neighbor room temp not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2–3 — `findColocatedSegment` + `resolveDeltaT` (`plan.md:167`, `plan.md:209–212`)
- **Detail**: `findColocatedSegment` returns a segment id only. `resolveDeltaT` for `internal_partition` needs neighbor room temperature, but no contract defines segment→room reverse lookup or how transmission context builds `neighborTemp` from colocated match.
- **Fix**: Add Phase 2/3 contract: `findRoomForSegment(segmentId, rooms)` and document transmission context builder: colocated segment id → owning room → `internal_temp_c`.
  - Strength: Closes implementer guesswork; small pure helpers.
  - Tradeoff: None significant.
  - Confidence: HIGH — data model already has `rooms[].segment_ids`.
  - Blind spot: None significant.
- **Decision**: FIXED — added `findRoomForSegment` + transmission context neighbor-temp resolution

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Manual Verification (`plan.md:246`, Progress 3.4)
- **Detail**: Reference case says "perimeter-only" hand calc, but `computeRoomTransmission` always adds polygon floor and ceiling losses (`plan.md:222–223`). Hand calc and engine output cannot match without explicit exclusion or stated floor/ceiling U values.
- **Fix**: Rewrite Phase 3 manual criterion and Progress 3.4 to include floor/ceiling terms with stated U values and areas, or explicitly scope the case to vertical surfaces only with a feature flag / test input mode.
- **Decision**: FIXED — Phase 3 / Progress 3.4 rewritten to include floor/ceiling in hand calc

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 (`plan.md:199`) vs Phase 5 (`plan.md:331–337`)
- **Detail**: Both phases instruct refactoring `assembly-preview.ts` to delegate to `computeAssemblyU`. Blast radius is small (2 files: `assembly-preview.ts`, `assemblies.ts:37`). Phase 5 should only verify + update comments/docs.
- **Fix**: Move preview delegation entirely to Phase 3; narrow Phase 5 item 4 to "verify preview matches engine + update comment in manual-verification.md".
- **Decision**: FIXED — preview delegation owned by Phase 3; Phase 5 narrowed to verify + docs

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 5 — Orchestrator + service (`plan.md:313`, `plan.md:329`)
- **Detail**: `calculateOzc` validates prerequisites; `validateOzcInput` is a separate export; `calculateProjectOzc` returns `Promise<OzcCalcResult>` only. S-04 needs to know whether invalid input throws, returns errors alongside result, or requires a separate validate call — not specified.
- **Fix A ⭐ Recommended**: `calculateOzc` throws typed `OzcValidationError` with `OzcCalcError[]`; `calculateProjectOzc` propagates. S-04 catches and surfaces messages.
  - Strength: Simple async API; matches existing service throw pattern (`project-climate.ts`, `assemblies.ts`).
  - Tradeoff: S-04 must catch; no Result union typing.
  - Confidence: HIGH — consistent with codebase services.
  - Blind spot: None significant.
- **Fix B**: `calculateProjectOzc` returns `{ result?: OzcCalcResult; errors?: OzcCalcError[] }`.
  - Strength: Explicit error channel without exceptions.
  - Tradeoff: S-04 must branch on shape; differs from other services.
  - Confidence: MEDIUM.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — `calculateOzc` throws `OzcValidationError`; service propagates

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 constants + Phase 3 U computation (`plan.md:110`, `plan.md:199`)
- **Detail**: ISO 6946 uses R_si on both sides for partitions between conditioned spaces (0,13 + layers + 0,13), not R_si + layers + R_se (external boundary). Plan maps category → heat-flow direction but does not specify `internal_partition` surface resistance treatment — implementer may apply horizontal external pattern (0,13/0,04), understating U.
- **Fix A ⭐ Recommended**: Add `internal_partition` mapping: R_si_internal = 0,13 both sides (R_se not used); document in `wt2021-constants.ts`.
  - Strength: Normatively correct for inter-room partitions.
  - Tradeoff: U differs from preview (which uses 0,13/0,04) — note in manual-verification.md.
  - Confidence: HIGH — ISO 6946 §6.1 pattern.
  - Blind spot: Edge case partitions to unheated spaces not modeled in MVP.
- **Fix B**: Keep horizontal external pattern (0,13/0,04) for all non-roof/floor categories including internal_partition.
  - Strength: Simpler single rule.
  - Tradeoff: Overstates transmission through internal walls vs normative calc.
  - Confidence: MEDIUM.
  - Blind spot: Engineering review may reject results.
- **Decision**: FIXED via Fix A — `internal_partition` uses R_si both sides (0,13 + layers + 0,13)
