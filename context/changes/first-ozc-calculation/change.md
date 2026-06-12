---
change-id: first-ozc-calculation
title: First OZC calculation on a PDF floor plan
status: implementing
created: 2026-06-12
updated: 2026-06-12
plan_reviewed: 2026-06-12
roadmap: S-04
---

Roadmap slice **S-04** (north star). Prerequisites done: S-03 (PDF editor), F-03 (WT 2021 engine).

Wire `calculateProjectOzc` to a protected API route and on-screen results on the project detail page — closes FR-009 and US-01.

## Notes

Planning session 2026-06-12: results on project page (not editor); per-room table + building totals with "Sum of room heat losses" label; validation errors on Run only; integer watts; replace-on-rerun; gate on editorReady; manual Case 1 + Case 2 verification.
