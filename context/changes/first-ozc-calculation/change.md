---
change-id: first-ozc-calculation
title: First OZC calculation on a PDF floor plan
status: implemented
created: 2026-06-12
updated: 2026-06-12
plan_reviewed: 2026-06-12
roadmap: S-04
---

Roadmap slice **S-04** (north star). Prerequisites done: S-03 (PDF editor), F-03 (WT 2021 engine).

Wire `calculateProjectOzc` to a protected API route and on-screen results on the project detail page — closes FR-009 and US-01.

## Notes

Planning session 2026-06-12: results on project page (not editor); per-room table + building totals with "Sum of room heat losses" label; validation errors on Run only; integer watts; replace-on-rerun; gate on editorReady; manual Case 1 + Case 2 verification.

## Phase 4 verification (2026-06-12)

Fixture runner `npx tsx scripts/ozc-manual-check.mts` — all PASS:

| Check | Result |
| --- | --- |
| Case 1 engine | transmission ≈612 W, ventilation 1584 W, total ≈2196 W |
| Case 1 UI rounding | 612 / 1584 / **2196 W** (hand table ≈2198 W; Δ2 W from layer-derived U) |
| Case 2 partition | 20.8 W per side (fixture uses 4 m partition line; hand example uses 3 m → 15.6 W) |
| Determinism | repeat `calculateOzc` and `toOzcCalcResultDisplay` identical |
| Building total | sums per-room losses; UI label "Sum of room heat losses" in `OzcCalculationPanel` |

In-app UI smoke (Phases 1–3): confirmed by developer before Phase 4 commit.
