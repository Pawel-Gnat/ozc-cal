---
date: 2026-06-17T12:00:00+02:00
researcher: Cursor Agent
git_commit: 29948af6ef90c98bff93c432cfeb64ee482e3f2f
branch: main
repository: ozc-cal
topic: "OZC heat-loss and ventilation numbers are engineering-wrong relative to WT 2021 expectations"
tags: [research, codebase, thermal, wt2021, ozc, ventilation, transmission, testing]
status: complete
last_updated: 2026-06-17
last_updated_by: Cursor Agent
last_updated_note: "Dodano decyzje produktowe użytkownika do otwartych pytań"
---

# Research: OZC heat-loss and ventilation numbers are engineering-wrong relative to WT 2021 expectations

**Date**: 2026-06-17T12:00:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: `29948af6ef90c98bff93c432cfeb64ee482e3f2f`  
**Branch**: main  
**Repository**: ozc-cal

## Research Question

Where does the OZC calculation engine live, what formulas does it use for transmission and ventilation heat loss, and where might outputs be engineering-wrong relative to WT 2021 expectations — as flagged in test-plan risk #1?

## Summary

The calculation engine is **implemented and internally consistent** for its documented MVP contract: ISO 6946 U-values + `Q = U × A × ΔT` transmission and simplified gravity ventilation `Q = 0.33 × V × ΔT`. Manual reference cases (Case 1 ≈ 2198 W, Case 2 partition ≈ 15.6 W per side) pass via `scripts/ozc-manual-check.mts`.

The **engineering risk is real but nuanced**: the engine is not a full WT 2021 / PN-EN 12831 implementation. Several behaviors can produce **wrong numbers for users expecting normative OZC**, even when the code matches its own spec:

1. **Ventilation model is non-normative** — supply + exhaust + natural are summed; balanced systems double-count; no room volume or infiltration model.
2. **Building totals double-count internal partitions** — sum of per-room losses, not net envelope loss (UI warns, but PRD says "strata ciepła budynku").
3. **Internal partitions require duplicate colocated segments** — single segment → ΔT = 0 → zero partition loss (silent under-report).
4. **`ground_floor` uses external design ΔT**, not ground temperature.
5. **Horizontal assemblies come from project catalog**, not drawn segments — floor/ceiling/roof/ground_floor on perimeter segments are ignored.
6. **No automated regression tests in CI** — correctness rests on manual verification and a standalone script.

**Test-plan Phase 1 should anchor on reference fixtures** (Case 1, Case 2, ventilation quick checks) and explicitly document accepted MVP deviations as non-regression boundaries, not as WT 2021 compliance claims.

## Detailed Findings

### Calculation entry point and data flow

Pure engine: `calculateOzc()` in `src/lib/thermal/calculate-ozc.ts`. Validates input, builds transmission context, computes per-room transmission + ventilation, sums building totals.

Service layer: `loadOzcCalcInput()` → `calculateProjectOzc()` in `src/lib/services/ozc-calculation.ts` loads project climate, assemblies, editor geometry, and room ventilation fields from Supabase.

API: `POST /api/projects/[id]/calc` (`src/pages/api/projects/[id]/calc.ts`) calls `calculateOzc()` and returns `toOzcCalcResultDisplay()`.

UI: `OzcCalculationPanel.tsx` triggers the API and displays per-room and building totals with explicit "Sum of room heat losses" labeling for partition double-count semantics.

### Transmission (heat loss through envelope)

**Formula:** `Q [W] = U × A [m²] × ΔT [K]` — implemented identically for perimeter and horizontal surfaces.

**U-value path (PN-EN ISO 6946):**

- Layer resistance: `R_layer = Σ (d_mm / 1000) / λ`
- Category maps to heat-flow direction → R_si / R_se from ISO 6946 Table 1 (still air, high emissivity)
- `internal_partition`: R_si = 0.13 on both sides (§6.1)
- `U = 1 / R_total`

Authoritative module: `src/lib/thermal/wt2021-u.ts`. Preview in assembly catalog delegates to the same function (`src/lib/thermal/assembly-preview.ts`).

**Geometry:**

| Surface | Area | Source |
|---------|------|--------|
| Walls, partitions | segment length × storey height | `segmentWallAreaM()` |
| Windows, doors | segment length × 1.2 m default | `OPENING_DEFAULT_HEIGHT_M` |
| Floor, ceiling | shoelace polygon × scale² | `roomFloorAreaM2()` |

**ΔT rules** (`src/lib/thermal/wt2021-boundary.ts`):

- External surfaces (`external_wall`, `window`, `door`, `floor`, `ceiling`, `roof`, `ground_floor`): `T_room − T_external`
- `internal_partition`: `|T_room − T_neighbor|` if colocated neighbor found; **0 if not**

**Horizontal surfaces:** One project-wide floor assembly (`ground_floor` > `floor`) and ceiling assembly (`roof` > `ceiling`) from catalog, applied to every room polygon. Categories `floor`, `ceiling`, `roof`, `ground_floor` on perimeter segments are **skipped** to avoid double-counting with polygon area.

### Ventilation (simplified gravity model)

**Formula:** `Q [W] = 0.33 × V [m³/h] × ΔT [K]`

- `V = (ventilation_supply ?? 0) + (ventilation_exhaust ?? 0) + (ventilation_natural ?? 0)`
- `ΔT = internal_temp_c − external_design_temp_c`
- Null fields → 0 m³/h

Implemented in `src/lib/thermal/wt2021-ventilation.ts`. Constant `VENTILATION_HEAT_FACTOR = 0.33` in `wt2021-constants.ts`.

This is **explicitly not PN-EN 12831**. Documented in F-03 archive as MVP simplified model per FR-006.

### Engineering gaps vs WT 2021 / user expectations

| Gap | Severity | Behavior | User impact |
|-----|----------|----------|-------------|
| Ventilation sum of supply+exhaust+natural | **High** | Balanced 120+120 m³/h → V=240 → ~2× expected vent loss | Over-reporting for mechanical/balanced systems |
| Building total = sum of room losses | **High** | Internal partitions counted on both rooms | Building total ≠ net envelope OZC |
| Partition requires colocated duplicate segment | **High** | No neighbor match → ΔT=0 | Silent under-report of partition loss |
| `ground_floor` uses external ΔT | **Medium** | Same as `floor`, not ground temp | Under/over-report vs normative ground contact |
| Horizontal assemblies from catalog only | **Medium** | Drawn floor/ceiling segments ignored on perimeter | User may think drawn assembly applies |
| Fixed 1.2 m opening height | **Medium** | All windows/doors | Area error for non-standard openings |
| No thermal bridges | **Low (deferred)** | Not modeled | Expected MVP gap |
| No automated CI tests | **High (regression)** | `ozc-manual-check.mts` only | Formula drift undetected |

### What is correct (within MVP contract)

- ISO 6946 surface resistances match Table 1 for still air, high emissivity
- Direction-dependent R_si for ceiling (upward 0.10), floor (downward 0.17), walls (horizontal 0.13)
- Case 1 hand calc: transmission ≈ 614.4 W, ventilation = 1584 W, total ≈ 2198 W (±1 W tolerance)
- Case 2 partition: 15.6 W per side at 3 m × 2.6 m, U=0.5, ΔT=4 K
- Engine is deterministic (repeat calls identical)
- Assembly preview U matches engine U (single code path)
- Validation rejects zero/negative scale, λ, thickness

### Test protection guidance (from test-plan risk response)

**Must challenge:** "Manual checklist passed once" does not imply ongoing correctness; preview U matching catalog is not sufficient without cross-checking engine path.

**Cheapest layer:** Unit tests with reference fixtures — not oracles copied from implementation.

**Ground truth fixtures:**

- Case 1 single-room box (`manual-verification.md` § Case 1)
- Case 2 two-room partition with colocated segments (`manual-verification.md` § Case 2)
- Ventilation: V=120, ΔT=40 → 1584 W; all null → 0 W
- Deterministic repeat on identical input

## Code References

- `src/lib/thermal/calculate-ozc.ts:17-85` — orchestrator: validate → transmission + ventilation → building sums
- `src/lib/thermal/wt2021-transmission.ts:114,158-159` — `Q = U × A × ΔT` per surface
- `src/lib/thermal/wt2021-transmission.ts:147-149` — horizontal categories skipped on perimeter
- `src/lib/thermal/wt2021-transmission.ts:56-70` — `resolveHorizontalAssemblies` (catalog precedence)
- `src/lib/thermal/wt2021-transmission.ts:85-97` — colocated neighbor temp for partitions
- `src/lib/thermal/wt2021-ventilation.ts:17-34` — ventilation volume sum and heat loss
- `src/lib/thermal/wt2021-boundary.ts:10-20` — ΔT resolution by category
- `src/lib/thermal/wt2021-constants.ts:12-26` — ISO 6946 R_si/R_se and ventilation factor
- `src/lib/thermal/wt2021-u.ts:15-29` — authoritative U from layers + category
- `src/lib/services/ozc-calculation.ts:15-64` — DB load → calculate → display
- `src/pages/api/projects/[id]/calc.ts` — HTTP entry point
- `src/components/projects/OzcCalculationPanel.tsx:128-134` — building total disclaimer
- `scripts/ozc-manual-check.mts` — offline fixture runner (not CI)
- `src/lib/editor/geometry.ts:130-198` — segment length, wall area, polygon area

## Architecture Insights

- **Single U path:** Catalog preview and engine share `computeAssemblyU()` — preview/engine drift is unlikely; test one path covers both.
- **Room-centric model:** All losses computed per room then summed. Building total is arithmetic sum, not thermodynamic net — intentional MVP (F-03 impl-review F6).
- **Geometry/editor coupling:** Transmission depends on editor scale, closed segment chains, colocated partition workaround (S-03). Calc correctness is not isolated from editor data quality.
- **Validation boundary:** `calc-validate.ts` guards structural preconditions (scale, closed chains, assemblies) but does not validate ventilation semantics or partition colocation.

## Historical Context (from prior changes)

- `context/archive/2026-06-09-wt2021-calculation-core/plan.md` — F-03 scoped transmission (ISO 6946) + simplified ventilation; deferred thermal bridges, multi-storey, mechanical vent, CI tests
- `context/archive/2026-06-09-wt2021-calculation-core/manual-verification.md` — Case 1/2 expected numbers, ventilation semantics, partition double-count note
- `context/archive/2026-06-09-wt2021-calculation-core/reviews/plan-review.md` — Fixed horizontal double-count (F1), partition R_si (F4), hand-calc alignment (F3)
- `context/archive/2026-06-09-wt2021-calculation-core/reviews/impl-review.md` — F6: building double-count intentional; UI label mitigation; no CI regression guard
- `context/archive/2026-06-12-first-ozc-calculation/plan.md` — S-04 wired API/UI; no engine formula changes
- `context/foundation/test-plan.md:42` — Risk #1 source: PRD guardrails, F-03 manual verification only, hot-spot `src/lib/thermal/`
- `context/foundation/prd.md:53` — Guardrail: results must be engineering-correct vs WT 2021 + simplified gravity vent per MVP

## Related Research

- `context/archive/2026-06-09-wt2021-calculation-core/manual-verification.md` — engineering checklist and reference cases (primary oracle for Phase 1 tests)
- `context/changes/testing-calculation-core-test-bootstrap/change.md` — Phase 1 change identity (this rollout)

## Open Questions

~~Zamknięte decyzją użytkownika 2026-06-17 — patrz sekcja Follow-up Research poniżej.~~

## Follow-up Research 2026-06-17

Decyzje produktowe użytkownika (odpowiedzi na otwarte pytania):

| # | Pytanie | Decyzja |
|---|---------|---------|
| 1 | **Wentylacja — nawiew + wywiew** | **Sumuj wszystko** (obecne MVP): `V = supply + exhaust + natural`. Przy zbilansowanym 120+120 m³/h wychodzi podwojony przepływ — świadoma akceptacja uproszczonego modelu. |
| 2 | **Tolerancja testów referencyjnych** | **±1 W** (jak w `manual-verification.md`). Case 1 z warstw (~2196 vs ~2198 W) mieści się w tolerancji. |
| 3 | **Walidacja partition bez colocated segmentu** | **Ostrzeżenie przed/po obliczeniu** (422 lub lista issues) — nie blokada, nie ciche 0 W bez informacji. Wymaga implementacji w osobnym slice; poza zakresem Phase 1 test bootstrap. |
| 4 | **Suma budynku** | **Na stałe „suma strat pomieszczeń”** — double-count partition intentional; etykieta w UI wystarczy. Brak planu net envelope loss w roadmapie MVP. |

### Implikacje dla Phase 1 (test bootstrap)

- Fixture wentylacyjne: utrzymać model sumy (Case 1: V=120 → 1584 W).
- Aserty testowe: `expect(value).toBeCloseTo(expected, 0)` z tolerancją ±1 W (lub dokładna równość gdzie liczby całkowite).
- Ostrzeżenie partition: **nie** w Phase 1 — zapisać jako follow-up po testach referencyjnych.
- Brak testów „net building envelope” — tylko suma per-room + building sum.
