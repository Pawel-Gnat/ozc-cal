<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: WT 2021 Calculation Core

- **Plan**: context/changes/wt2021-calculation-core/plan.md
- **Scope**: Phases 1–5 (all automated steps complete; manual QA pending)
- **Date**: 2026-06-10
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Empty OzcValidationError on post-validation guards

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/thermal/calculate-ozc.ts:19–28
- **Detail**: After `validateOzcInput` succeeds, null checks for `scale` and horizontal assemblies throw `OzcValidationError(errors)` where `errors` is still `[]`. Dead code today, but if hit callers get an empty error list with no user-facing messages.
- **Fix**: Remove the redundant guards and narrow input to `OzcCalcInput` after validation (or use non-null assertions on fields already validated).
- **Decision**: FIXED — removed dead guards; narrow via `OzcCalcInput` after validation

### F2 — Layer physics not validated at calc boundary

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/thermal/calc-validate.ts:32–38, src/lib/thermal/wt2021-u.ts:16–18
- **Detail**: `validateOzcInput` checks `layers.length > 0` but not `lambda_w_mk > 0` or `thickness_mm > 0`. Assembly writes are Zod-guarded, but the pure calc path accepts any DB snapshot — zero/negative λ yields `Infinity`/`NaN` in `computeAssemblyU` and propagates into heat-loss totals.
- **Fix**: Add positive-number checks in `validateOzcInput` (mirror assembly layer Zod schema) or guard in `computeAssemblyU` and surface as validation error.
  - Strength: Matches assembly write validation; prevents silent wrong totals on corrupt data.
  - Tradeoff: Slightly more validation code before S-04.
  - Confidence: HIGH — same constraints exist on assembly API.
  - Blind spot: None significant.
- **Decision**: FIXED — positive λ and thickness checks in validateOzcInput

### F3 — Scale meters_per_unit not validated on calc load

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/thermal/calc-validate.ts:8–13
- **Detail**: Checks `scale !== null` but not `scale.meters_per_unit > 0`. Editor save validates this; calc load does not. Corrupt/zero scale yields zero areas and zero transmission without error.
- **Fix**: When scale is present, require `meters_per_unit > 0`; add error code e.g. `invalid_scale`.
- **Decision**: FIXED — invalid_scale when meters_per_unit <= 0

### F4 — Manual verification checklist pending

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/wt2021-calculation-core/plan.md (Progress 2.3–5.5)
- **Detail**: Phases 2–5 manual verification items remain unchecked (geometry hand-calc, transmission reference case, ventilation case, deterministic `calculateProjectOzc`, documented tolerance runs). `manual-verification.md` documents cases but execution is not recorded in plan Progress.
- **Fix**: Run checklist from `manual-verification.md`; mark Progress items `[x]` when within ±1 W tolerance.
- **Decision**: FIXED — ran `scripts/ozc-manual-check.mts`; updated plan Progress 2.3–5.5

### F5 — ValidatableOzcInput vs OzcCalcInput naming drift

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/thermal/calc-types.ts, src/lib/thermal/calculate-ozc.ts, src/lib/services/ozc-calculation.ts
- **Detail**: Plan specifies `calculateOzc(input: OzcCalcInput)` and loader returning `OzcCalcInput`. Implementation uses `ValidatableOzcInput` at boundaries; `OzcCalcInput` is defined as validated intersection but unused as a parameter type. Intent preserved via validate-then-calc.
- **Fix**: Type `calculateOzc` as `(input: OzcCalcInput)` with loader returning `ValidatableOzcInput` and `calculateProjectOzc` calling validate internally, or document the split in `calc-types.ts` comments only.
- **Decision**: FIXED — documented ValidatableOzcInput vs OzcCalcInput split in calc-types.ts

### F6 — Building totals include both sides of internal partitions

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architecture
- **Location**: src/lib/thermal/calculate-ozc.ts:58–65
- **Detail**: `buildingTransmissionW` sums per-room losses; colocated duplicate internal partitions count loss on both rooms (documented in manual-verification case 2). Building total ≠ net envelope loss — intentional MVP model per plan.
- **Fix A ⭐ Recommended**: When S-04 displays building totals, label semantics clearly (sum of room losses, not net envelope).
  - Strength: Preserves current engine; matches manual verification doc.
  - Tradeoff: Users may misread total until UI explains it.
  - Confidence: HIGH — documented in manual-verification.md.
  - Blind spot: HVAC reviewer expectations not verified in UI yet.
- **Fix B**: Net inter-zone losses in building aggregation
  - Strength: Engineering-friendly single building number.
  - Tradeoff: Requires new aggregation logic; diverges from per-room sum model.
  - Confidence: LOW — not specified in PRD/plan.
  - Blind spot: Whether WT 2021 reporting expects net vs gross.
- **Decision**: FIXED via Fix A — building-total semantics note added to manual-verification.md for S-04 UI labeling
