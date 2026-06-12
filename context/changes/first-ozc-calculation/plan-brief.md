# First OZC Calculation — Plan Brief

> Full plan: `context/changes/first-ozc-calculation/plan.md`

## What & Why

Roadmap **S-04** (`first-ozc-calculation`) is the product's north-star milestone: the user runs a heat-loss calculation on a PDF floor plan and sees transmission and ventilation results on screen that match engineering expectations (FR-009, US-01). F-03 delivered the deterministic WT 2021 engine; this slice wires it to the UI.

## Starting Point

- **Engine (F-03, done):** `calculateProjectOzc` in `src/lib/services/ozc-calculation.ts` loads project climate, assemblies, and editor geometry from Supabase, then calls pure `calculateOzc`. Invalid input throws `OzcValidationError` with structured error codes. Result shape: per-room `{ transmissionW, ventilationW, totalW }` plus building totals.
- **Editor (S-03, done):** Rooms, scale, segments, and ventilation captured in editor state; project detail page at `/projects/[id]` has sectioned layout (climate → assemblies → floor plan → editor gate).
- **Missing:** No calculation API route, no results UI, no way for the user to trigger or view OZC from the app.

## Desired End State

On the project detail page, after climate + assemblies + PDF are configured (`editorReady`), a **Calculation** section appears with a **Run calculation** button. Clicking it POSTs to a protected API, shows per-room and building heat losses in watts (integer-rounded), labels building totals as **"Sum of room heat losses"**, and lists validation errors inline when prerequisites are unmet (missing scale, unclosed rooms, etc.). Manual verification confirms Case 1 (~2198 W) and Case 2 (internal partition) from `manual-verification.md`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| UI placement | Project detail page section | Matches existing sectioned layout; user returns from editor to run calc | Plan |
| Results detail | Per-room table + building totals | Enables engineering spot-checks; honors F-03 building-total labeling requirement | Plan |
| Validation UX | Errors on Run only | Matches F-03 throw contract; avoids duplicating `validateOzcInput` in UI | Plan / Research |
| Loading state | Inline spinner on Run button | Clear feedback without hiding previous results | Plan |
| Number format | Integer watts | Matches ±1 W manual tolerance; clean HVAC display | Plan |
| Re-run behavior | Replace results each Run | Simplest; no persistence scope | Plan |
| Section gate | Same as editor (`editorReady`) | Consistent prerequisite messaging | Plan |
| Verification | Manual Case 1 + Case 2 in-app | Validates US-01 engineering guardrail without new test stack | Plan |
| Error contract | Catch `OzcValidationError` → 422 | Inherited from F-03 plan-review Fix A | Research |
| Building total label | "Sum of room heat losses" | Prevents misreading double-counted partition transfer as net envelope loss | Research |

## Scope

**In scope:**

- `POST /api/projects/[id]/calc` — auth, precondition check, `calculateProjectOzc`, room-name enrichment, `OzcValidationError` → 422
- `OzcCalculationPanel` React island — Run button, spinner, per-room table, building summary, error list
- Calculation section on `src/pages/projects/[id].astro` gated on `editorReady`
- Display types for API response (room names alongside watts)
- Manual engineering verification (Case 1 + Case 2)

**Out of scope:**

- Changes to WT 2021 formulas or validation rules (F-03)
- Persisting calculation results or run history to DB
- Formal PDF/print report
- Calculation inside the floor plan editor
- Preflight readiness checklist UI
- Stale-results warning or sessionStorage persistence
- Automated test framework
- Polish UI strings (English, matches existing pages)

## Architecture / Approach

```
Project detail page (Astro)
  └── OzcCalculationPanel (React, client:load)
        └── POST /api/projects/[id]/calc
              └── calculateProjectOzc(supabase, projectId)
                    └── loadOzcCalcInput → calculateOzc (pure engine)
              └── enrich rooms with names from editor state
              └── jsonOk(displayResult) | jsonError(422, OzcValidationError)
```

Synchronous request-response; no caching. MVP project sizes expect sub-100 ms engine time (F-03 note).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Calculation API route | Protected POST endpoint with error handling and room-name enrichment | Mapping `OzcValidationError` issues to readable UI paths |
| 2. Results React island | Run button, table, building totals, validation error display | Room name fallback when `name` is null |
| 3. Project page integration | Calculation section mounted on project detail | Gate messaging when prerequisites unmet |
| 4. Manual engineering verification | Case 1 (~2198 W) and Case 2 partition verified in-app | Assembly U-values must match checklist targets |

**Prerequisites:** S-03 and F-03 archived (done); Supabase local or remote with migrated schema.

**Estimated effort:** ~1–2 focused sessions across 4 phases.

## Open Risks & Assumptions

- Users may mis-assign horizontal assembly categories to perimeter segments — engine ignores them (F-03 Fix A); no S-04 UI warning.
- Building totals double-count internal partition transfer when duplicate colocated segments exist — intentional MVP model; labeling is the mitigation.
- Room display names depend on editor `name` field; null names fall back to truncated room ID.

## Success Criteria (Summary)

- User with a complete project can click Run and see per-room + building heat losses in watts.
- Validation failures (missing scale, no rooms, etc.) show actionable error messages without a 500.
- Case 1 total ≈ 2198 W and Case 2 partition behavior match `manual-verification.md` (±1 W).
