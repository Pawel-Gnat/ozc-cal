# WT 2021 Calculation Core — Plan Brief

> Full plan: `context/changes/wt2021-calculation-core/plan.md`

## What & Why

Build roadmap **F-03** (`wt2021-calculation-core`): a **deterministic, UI-free** engine that computes building heat losses per WT 2021 (transmission through assemblies) and simplified per-room gravity ventilation from data already captured by S-02 and S-03. This closes the #1 domain blocker and unblocks **S-04** (run calculation + on-screen results).

## Starting Point

S-02 persists climate (zone I–V, external design temp), assembly catalog with layer stacks (λ + thickness), and a **preview-only** U in `src/lib/thermal/assembly-preview.ts` (fixed R_si/R_se). S-03 persists scale, orthogonal segments with assembly assignment, closed rooms with `internal_temp_c`, and three nullable ventilation numerics per room (`ventilation_supply`, `ventilation_exhaust`, `ventilation_natural`) — units undefined until now. `segmentLengthM()` and `roomPolygonPoints()` exist but are not used in any calculation. **No calculation module, API, or result types exist.**

## Desired End State

A pure TypeScript function (plus thin service loader) accepts a project's climate, assemblies, geometry, and ventilation inputs and returns **per-room** transmission [W], ventilation [W], and totals, plus **building sums** — same inputs always yield the same outputs (NFR repeatability). Assembly preview U-values use the same authoritative U module as the engine. A documented manual verification checklist lets an HVAC engineer validate a simple reference case. S-04 can call the engine without reimplementing formulas.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Ventilation formula | Q = 0,33 × V × ΔT [W]; fields in m³/h | Simple, verifiable model for HVAC designers | Plan |
| Combining vent fields | Sum supply + exhaust + natural | Matches three S-03 fields; straightforward semantics | Plan |
| Storey height | `storey_height_m` on `projects`, default 2,6 m | One height per MVP single-storey project; enables wall area and volume | Plan |
| Shared internal walls | Single segment owner; colocated duplicate matching for ΔT | Aligns with S-03 UNIQUE(segment_id) without schema change | Plan |
| U-value method | PN-EN ISO 6946 direction-dependent R_si/R_se per assembly category | Normative upgrade over S-02 preview constants | Plan |
| Boundary ΔT | Rules from assembly category (external → T_ext; internal → neighbor temp) | Standard single-storey boundary treatment | Plan |
| Opening area | Segment length × 1,2 m default opening height | Uses existing window/door segments without new geometry | Plan |
| Floor/ceiling | Room polygon area × required floor + ceiling/ground assembly from catalog | Captures horizontal losses missing from perimeter-only approach | Plan |
| Output contract | Per-room breakdown + building totals | Ready for S-04 results panel | Plan |
| Floor/ceiling assembly source | Require matching catalog entries; validation error if missing | Explicit engineering assumption; no hidden defaults | Plan |
| Verification | Manual engineering checklist only | User preference; no new test framework in repo | Plan |
| Scope boundary | Pure library + service loader; no calc API or UI | F-03 foundation; S-04 owns FR-009 presentation | Plan |

## Scope

**In scope:** Migration for `storey_height_m`; authoritative U module; geometry quantification (polygon area, wall/opening areas); transmission engine; ventilation engine; orchestrator + DB loader service; unify assembly preview with authoritative U; manual verification checklist; minimal project-detail field for storey height.

**Out of scope:** Calculation API route and run button (S-04); on-screen results UI (S-04); persisting calculation results to DB; mechanical/balanced ventilation; multi-storey; thermal bridges; formal PDF report; automated test framework; neighbor-room auto-detection from a single shared segment (S-03 duplicate-segment workaround remains).

## Architecture / Approach

```
Project DB (climate, assemblies, geometry, vent fields, storey_height_m)
        │
        ▼
ozc-calculation service (load + validate)
        │
        ▼
calculateOzc (pure) ──┬── geometry.ts helpers (area, length)
                      ├── wt2021-u.ts (authoritative U from layers + category)
                      ├── wt2021-transmission.ts (Q = U × A × ΔT per surface)
                      └── wt2021-ventilation.ts (Q = 0,33 × Σm³/h × ΔT)
        │
        ▼
OzcCalcResult { rooms[], buildingTotals }
```

S-04 will call the service; F-03 exposes no HTTP endpoint.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema & contract | `storey_height_m`, calc input/output types, constants | Floor/ceiling assembly validation rules must be clear early |
| 2. Geometry quantification | Polygon area, wall/opening areas from editor state | Coordinate space / scale consistency with S-03 |
| 3. WT 2021 transmission | Authoritative U, category ΔT rules, per-surface losses | Colocated internal-wall neighbor matching edge cases |
| 4. Gravity ventilation | Per-room m³/h sum → heat loss | Null vent fields treated as zero |
| 5. Orchestrator & verification | `calculateOzc`, service loader, preview unification, manual checklist | Manual-only verification leaves regression risk |

**Prerequisites:** F-01, S-02, S-03 implemented; local Supabase migrated.

**Estimated effort:** ~3–4 focused sessions across 5 phases.

## Open Risks & Assumptions

- **Simplified ventilation** is not a full PN-EN 12831 airflow model — engineering acceptance depends on manual case validation.
- **Internal partitions** rely on colocated duplicate segments or ΔT = 0 when no duplicate match — documented limitation.
- **Ground temperature** for `ground_floor` uses external design temp in MVP (no separate T_ground field).
- **Manual verification only** — no CI regression guard for calculation drift.

## Success Criteria (Summary)

- Same project inputs produce identical `OzcCalcResult` on repeated calls.
- A documented manual case (single rectangular room, known U, ΔT, ventilation) yields expected transmission and ventilation [W] within documented rounding.
- Assembly catalog preview U matches authoritative U for the same layer stack.
- `npm run lint` and `npm run build` pass.
