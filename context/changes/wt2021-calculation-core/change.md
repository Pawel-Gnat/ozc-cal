---
change-id: wt2021-calculation-core
title: WT 2021 calculation engine + gravity ventilation
status: impl_reviewed
updated: 2026-06-10
plan_reviewed: 2026-06-09
roadmap: F-03
---

Roadmap foundation slice **F-03**. Prerequisites done: F-01 (project schema). Unlocks **S-04** (first OZC calculation UI).

Pure calculation engine: WT 2021 transmission losses + simplified per-room gravity ventilation. No calculation API or results UI in this slice — S-04 wires the engine.

## Notes

Planning session 2026-06-09: ventilation model m³/h × ΔT (0,33 × V × ΔT); global storey height on `projects`; manual verification only (no test framework).
