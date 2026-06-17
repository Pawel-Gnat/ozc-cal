# Calculation Core + Test Bootstrap Implementation Plan

## Overview

Bootstrap Vitest for this Astro 6 project and lock WT 2021 engine correctness plus repeatability with reference-case unit tests. This is test-plan Phase 1: it covers risks #1 (engineering-wrong OZC numbers) and #6 (non-determinism) via the cheapest layer — pure-function tests with independently derived oracles, not implementation copies.

## Current State Analysis

The calculation engine is implemented and manually verified. `calculateOzc()` in `src/lib/thermal/calculate-ozc.ts` orchestrates transmission (`wt2021-transmission.ts`), ventilation (`wt2021-ventilation.ts`), and U-value resolution (`wt2021-u.ts`). Reference cases Case 1 (~2198 W) and Case 2 (partition ~15.6 W per side) pass via `scripts/ozc-manual-check.mts`, which is **not** part of CI.

There is **no test runner** today: no Vitest config, no `*.test.*` files, no `npm test` script. CI runs lint + build only (`.github/workflows/ci.yml`). The test-plan (`context/foundation/test-plan.md`) designates Vitest as the unit/integration stack and defers the CI gate to Phase 4.

Product decisions from research (2026-06-17) are settled: ±1 W tolerance, ventilation `V = supply + exhaust + natural`, building total = sum of per-room losses (intentional MVP), partition colocation warning deferred to a follow-up slice.

## Desired End State

After this plan:

- `npm test` runs Vitest and passes locally.
- Reference fixtures live in a **shared module** consumed by split unit test files under `src/lib/thermal/`.
- Tests assert Case 1, Case 2, ventilation quick checks, U preview/engine parity, display-layer mapping/rounding, building-total sum semantics, and deterministic repeat — all within ±1 W (or tighter where values are integers).
- `scripts/ozc-manual-check.mts` remains as a standalone dev script (not replaced).
- `context/foundation/test-plan.md` §6.1 documents how to add thermal unit tests.
- Geometry assertions from manual-check (floor area, segment length) are **not** in this phase — deferred to test-plan Phase 2.

### Key Discoveries:

- `scripts/ozc-manual-check.mts` is the primary source for fixture data and expected values — extract, do not re-derive from scratch.
- Astro 6 Vitest setup uses `getViteConfig()` from `astro/config` in `vitest.config.ts`, inheriting path aliases (`@/*`) from the Astro project.
- Display tests belong in Phase 1 per planning decision — `toOzcCalcResultDisplay()` in `calc-display.ts` preserves W values and maps room names; manual-check asserts UI rounding separately.
- AGENTS.md still says "no test runner" — intentionally **not** updated until Phase 4 wires CI.

## What We're NOT Doing

- CI gate for `npm test` (test-plan Phase 4).
- Editor geometry unit tests — floor area, segment length, window height (test-plan Phase 2).
- Partition colocation warning (422/issues list) — follow-up slice after reference tests land.
- Net building envelope loss tests — only per-room + building sum semantics.
- Service layer (`ozc-calculation.ts`), API (`calc.ts`), or Supabase integration tests.
- Replacing or wrapping `scripts/ozc-manual-check.mts` with Vitest.
- Updating AGENTS.md (deferred with CI gate).
- E2E, Playwright, or React component tests.

## Implementation Approach

Use Astro's official Vitest integration (`getViteConfig()`) so `@/*` path aliases and Vite plugins resolve the same as the app. Install Vitest as a dev dependency, add `vitest.config.ts` at repo root, and wire `npm test` → `vitest run`.

Extract Case 1/2 inputs, assemblies, and hand-derived expected values from `scripts/ozc-manual-check.mts` into a shared fixture module. Write **split** test files colocated with the modules they exercise. Use independently computed oracles (hand-calc formulas from `manual-verification.md`) — never assert against a value produced by the function under test in the same test.

Keep `ozc-manual-check.mts` unchanged in behavior; it remains a quick offline runner for engineers without Vitest watch mode.

## Critical Implementation Details

- **Oracle discipline:** Transmission expected values in Case 1/2 must use hand-calc formulas (perimeter × height × U × ΔT, etc.) or values documented in `context/archive/2026-06-09-wt2021-calculation-core/manual-verification.md` — not `calculateOzc()` output captured once and reused.
- **Tolerance helper:** Centralize ±1 W assertion (matching `TOLERANCE_W = 1` in manual-check) in the shared fixture module or a tiny `test-helpers` sibling — use `toBeCloseTo(expected, 0)` for W values; use tighter tolerance (e.g. 0.01) only for non-W comparisons like U-value parity.
- **Pure modules only:** Tests must import from `src/lib/thermal/*` and `src/types.ts` — no `astro:env/server`, no Supabase client, no Cloudflare runtime.

## Phase 1: Vitest Bootstrap

### Overview

Install Vitest, configure it via Astro's `getViteConfig()`, add npm scripts, and prove the runner resolves `@/*` imports with a minimal smoke test.

### Changes Required:

#### 1. Dependencies and scripts

**File**: `package.json`

**Intent**: Add Vitest as a dev dependency and expose `npm test` for local runs. Watch mode is optional but useful for TDD during Phase 2.

**Contract**: New devDependency `vitest` (current stable compatible with Vite 7). Scripts: `"test": "vitest run"`, optionally `"test:watch": "vitest"`.

#### 2. Vitest configuration

**File**: `vitest.config.ts` (new, repo root)

**Intent**: Merge Astro's Vite config so path aliases and plugins match the app; run tests in Node (pure TS modules, no DOM/component rendering in this phase).

**Contract**: Use `getViteConfig({ test: { /* … */ } })` from `astro/config`. Set `test.environment` to `'node'`. Include `/// <reference types="vitest/config" />` triple-slash directive per Astro docs.

#### 3. Smoke test

**File**: `src/lib/thermal/smoke.test.ts` (new — delete or fold into real tests once Phase 2 lands)

**Intent**: Verify Vitest resolves `@/` imports and runs at least one passing assertion before reference tests exist.

**Contract**: Import any existing thermal export (e.g. `VENTILATION_HEAT_FACTOR` from `wt2021-constants.ts`) and assert a known constant value. File can be removed when Phase 2 tests provide equivalent coverage.

### Success Criteria:

#### Automated Verification:

- Dependencies install cleanly: `npm ci`
- Vitest runs: `npm test`
- Smoke test passes (at least 1 test, 0 failures)
- Lint passes: `npm run lint`
- Build passes: `npm run build` (with env vars if required by CI)

#### Manual Verification:

- `npm test` completes in under a few seconds on a clean checkout
- No changes to production runtime behavior (dev/build still work)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Reference Fixtures + Unit Tests

### Overview

Extract shared reference fixtures and add split unit tests covering the thermal engine, ventilation, U-value parity, display layer, determinism, and building-total semantics.

### Changes Required:

#### 1. Shared fixture module

**File**: `src/lib/thermal/__fixtures__/ozc-reference.ts` (new)

**Intent**: Single source of truth for Case 1/2 `ValidatableOzcInput` objects, assembly layer shortcuts, climate constants, and hand-derived expected values used across test files.

**Contract**: Export fixture builders/constants mirroring `scripts/ozc-manual-check.mts` (nodes, segments, rooms, assemblies, scale, expected W totals). Export a `assertHeatLossW(actual, expected, label?)` helper enforcing ±1 W. Do **not** import from the manual-check script — copy data once into this module.

#### 2. Orchestrator reference tests

**File**: `src/lib/thermal/calculate-ozc.test.ts` (new)

**Intent**: Prove end-to-end engine correctness for Case 1 and Case 2, building total sum, and deterministic repeat.

**Contract**: Tests call `calculateOzc()` with shared fixtures. Assert per-room `transmissionW`, `ventilationW`, `totalW` against hand-derived expected values (±1 W). Assert `buildingTotalW` equals sum of room totals (Case 2). Assert `JSON.stringify(calculateOzc(input))` identical on repeat call.

#### 3. Ventilation unit tests

**File**: `src/lib/thermal/wt2021-ventilation.test.ts` (new)

**Intent**: Lock ventilation formula and null-field semantics independent of full orchestrator.

**Contract**: `computeRoomVentilation()` — V=120, ΔT=40 → 1584 W; all null fields → 0 W. Uses ventilation sum model (supply + exhaust + natural).

#### 4. U-value parity tests

**File**: `src/lib/thermal/wt2021-u.test.ts` (new)

**Intent**: Confirm catalog preview and engine share one U path (regression guard for preview/engine drift).

**Contract**: `computeAssemblyPreview(...).uValue` equals `computeAssemblyU(...).uValue` for at least the external_wall layer from fixtures (tight numeric tolerance, e.g. 0.0001).

#### 5. Display layer tests

**File**: `src/lib/thermal/calc-display.test.ts` (new)

**Intent**: Cover S-04 display mapping from manual-check — name preservation, W value passthrough, building total sum, determinism.

**Contract**: `toOzcCalcResultDisplay()` maps room names from fixture room state; `transmissionW`/`totalW` unchanged from engine result; `buildingTotalW` equals sum of displayed room totals (Case 2); rounded UI values match manual-check expectations where asserted (Case 1 total ≈2196–2198 W within ±2 W for rounded display check only). Display repeat call produces identical JSON.

### Success Criteria:

#### Automated Verification:

- Full test suite passes: `npm test`
- At minimum these scenarios covered: Case 1 single-room box, Case 2 two-room partition with colocated segments, ventilation V=120/ΔT=40, ventilation all-null, U preview/engine parity, display name + W passthrough, deterministic repeat (engine + display), building total sum
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Manual-check script still passes unchanged: `npx tsx scripts/ozc-manual-check.mts`

#### Manual Verification:

- Spot-check one Case 1 expected value against `manual-verification.md` hand-calc table (614.4 + 1584 ≈ 2198 W) — confirms oracle is independent
- Confirm no geometry assertions were added (deferred to Phase 2)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Cookbook Documentation

### Overview

Document the reference-case unit test pattern in test-plan §6.1 so future contributors know how to add thermal tests consistently.

### Changes Required:

#### 1. Test-plan cookbook section

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.1 "TBD" with a concrete recipe: where fixtures live, tolerance rule, oracle discipline, which modules to test, and the `npm test` command.

**Contract**: §6.1 must include: file locations (`__fixtures__/ozc-reference.ts`, colocated `*.test.ts`), ±1 W tolerance, link to `manual-verification.md` as oracle source, anti-pattern ("do not copy implementation output as expected value"), and note that geometry tests belong in Phase 2. Update §4 Stack Vitest row version from "TBD" to installed version. Update §8 freshness ledger date for stack verification.

#### 2. Change status

**File**: `context/changes/testing-calculation-core-test-bootstrap/change.md`

**Intent**: Mark change as planned and record update date.

**Contract**: Frontmatter `status: planned`, `updated: 2026-06-17` (or implementation completion date).

### Success Criteria:

#### Automated Verification:

- Full test suite still passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- §6.1 is actionable — a developer can add a new reference case by following the documented steps without reading this plan
- §4 Vitest version matches `package.json`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Case 1: single-room 4×5 m box — transmission components, ventilation 1584 W, room total ≈2198 W (±1 W)
- Case 2: two-room partition with colocated duplicate segments — partition loss ~15.6 W per side, per-room envelope + partition, building sum
- Ventilation: V=120 ΔT=40 → 1584 W; all null → 0 W
- U-value: preview matches engine for external_wall fixture layer
- Display: name mapping, W passthrough, building total sum, rounded display spot-check, determinism
- Repeatability: identical JSON on second `calculateOzc()` and `toOzcCalcResultDisplay()` calls

### Integration Tests:

- None in this phase (deferred to test-plan Phases 2–3)

### Manual Testing Steps:

1. Run `npm test` on a clean checkout after `npm ci`
2. Run `npx tsx scripts/ozc-manual-check.mts` — all PASS lines, exit 0
3. Read §6.1 and confirm it matches actual file paths and commands

## Performance Considerations

Vitest suite should complete in seconds — pure functions, no I/O. No performance budget concerns for Phase 1.

## Migration Notes

No data migration. This is additive tooling only. Phase 4 will add `npm test` to CI — until then, tests are local-only and optional in PR workflow.

## References

- Related research: `context/changes/testing-calculation-core-test-bootstrap/research.md`
- Test plan: `context/foundation/test-plan.md`
- Manual oracles: `context/archive/2026-06-09-wt2021-calculation-core/manual-verification.md`
- Existing fixture runner: `scripts/ozc-manual-check.mts`
- Engine entry: `src/lib/thermal/calculate-ozc.ts`
- Astro Vitest setup: https://docs.astro.build/en/guides/testing/ (via `getViteConfig()`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest Bootstrap

#### Automated

- [x] 1.1 Dependencies install cleanly: `npm ci` — 698a86d
- [x] 1.2 Vitest runs: `npm test` — 698a86d
- [x] 1.3 Smoke test passes (at least 1 test, 0 failures) — 698a86d
- [x] 1.4 Lint passes: `npm run lint` — 698a86d
- [x] 1.5 Build passes: `npm run build` — 698a86d

#### Manual

- [x] 1.6 `npm test` completes quickly on clean checkout; dev/build unchanged — 698a86d

### Phase 2: Reference Fixtures + Unit Tests

#### Automated

- [x] 2.1 Full test suite passes: `npm test` — 8889304
- [x] 2.2 Reference scenarios covered (Case 1, Case 2, ventilation, U parity, display, determinism, building sum) — 8889304
- [x] 2.3 Lint passes: `npm run lint` — 8889304
- [x] 2.4 Build passes: `npm run build` — 8889304
- [x] 2.5 Manual-check script still passes: `npx tsx scripts/ozc-manual-check.mts` — 8889304

#### Manual

- [x] 2.6 Case 1 oracle spot-checked against manual-verification.md hand-calc table — 8889304
- [x] 2.7 No geometry assertions added (deferred to Phase 2 rollout) — 8889304

### Phase 3: Cookbook Documentation

#### Automated

- [x] 3.1 Full test suite still passes: `npm test` — 4ed5575
- [x] 3.2 Lint passes: `npm run lint` — 4ed5575

#### Manual

- [x] 3.3 §6.1 is actionable for adding new reference cases — 4ed5575
- [x] 3.4 §4 Vitest version matches package.json — 4ed5575
