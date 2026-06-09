# PDF Floor Plan Editor — Plan Brief

> Full plan: `context/changes/pdf-floor-plan-editor/plan.md`

## What & Why

Build roadmap **S-03** (`pdf-floor-plan-editor`): a PDF-backed 2D editor where the user draws orthogonal wall segments assigned to S-02 assemblies, closes them into rooms with internal temperature, and configures per-room gravity ventilation — fulfilling FR-006, FR-007, and FR-008. This is the largest frontend investment and the product differentiator (simple UI + floor-plan PDF → OZC).

## Starting Point

F-01/S-01/S-02/F-02 are done. Projects persist climate, assembly catalog, and one private floor-plan PDF per project (`project-floor-plan.ts`, `/api/projects/[id]/floor-plan`). Project detail has upload/replace/delete UI but **no editor route, no pdf.js, no geometry schema, no canvas**. Assembly categories (`external_wall`, `window`, `door`, etc.) are ready for segment assignment.

## Desired End State

Logged-in owner opens `/projects/[id]/editor` when climate, assemblies, and PDF exist. They calibrate scale (two known points), draw H/V segments with assembly assignment on a pdf.js background + canvas overlay, auto-detected closed loops become rooms with internal temperature, and each room gets gravity ventilation fields (supply/exhaust/natural) in a properties panel. State auto-saves via JSON REST. S-04/F-03 consume the persisted geometry and ventilation inputs.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| S-03 scope | Editor + rooms + ventilation UI + persistence | Delivers FR-006–008 without blocking on F-03 engine | Plan |
| PDF source | F-02 upload on project settings only | Avoid duplicating upload UX; editor consumes stored PDF | Plan |
| Rendering | pdf.js background + HTML Canvas overlay | Lighter than Konva; infra pre-mortem flags canvas CPU on Workers — stays client-side | Plan |
| PDF fetch | Same-origin Worker byte proxy | Supabase Storage CORS unreliable for pdf.js `fetch()` | Plan |
| Scale | Two-point calibration required before drawing | Real-world dimensions needed for eventual OZC (S-04) | Plan |
| Geometry model | Node-edge graph (vertices + segments) | Natural fit for orthogonal snap/connect (FR-008) | Plan |
| Drawable elements | All segment types via assembly category | Walls, windows, doors map to S-02 catalog categories | Plan |
| Orthogonal mode | H/V axis lock + snap to nodes/endpoints | Matches FR-008 and reduces geometry errors | Plan |
| Room creation | Auto-detect closed loops + manual fallback | Balances speed with control when detection fails | Plan |
| Ventilation UX | Per-room properties panel after room exists | FR-006 is per-room; avoids blocking editor entry | Plan |
| Ventilation scope | Store supply/exhaust/natural fields; F-03 computes | Separates UI capture from engineering model (F-03 unknown) | Plan |
| Persistence | JSON REST with debounced auto-save | Form POST unsuitable for high-frequency editor mutations | Plan |
| Editor entry | `/projects/[id]/editor` gated on climate + assemblies + PDF | Ensures prerequisites before geometry work | Plan |
| Calculation | Out of scope | S-04 + F-03 own run/display logic | Plan |

## Scope

**In scope:** Geometry schema + RLS, JSON editor API, PDF bytes proxy, editor page + React island, pdf.js render, pan/zoom, scale calibration, segment drawing tool, assembly picker, auto-save, room detection + manual creation, room temp + ventilation fields, project detail entry link, README notes

**Out of scope:** OZC calculation run (S-04), ventilation engineering model (F-03), in-editor PDF upload, undo/redo history, multi-storey, DWG/DXF, openings as separate object type (use segment + window/door assembly), Polish UI strings, formal PDF report

## Architecture / Approach

```
/projects/[id]/editor (Astro + FloorPlanEditor client:only)
  ├─ fetch GET /api/projects/[id]/floor-plan/data → PDF bytes (Worker proxies Storage)
  ├─ pdf.js → background canvas
  ├─ overlay canvas → draw nodes/segments, snap H/V
  └─ debounced PUT /api/projects/[id]/editor → nodes, segments, rooms, scale, ventilation

Postgres (owner RLS via projects):
  plan_nodes, plan_segments, plan_rooms, plan_room_segments
  + scale columns on projects (or plan_settings)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema & Editor API | Tables, RLS, GET/PUT JSON API, PDF bytes route, validation | Segment/room invariants; JSON auth vs redirect middleware |
| 2. Editor shell & PDF render | Gated page, pdf.js, pan/zoom, scale calibration gate | pdf.js worker bundling on Vite 7; 50 MiB PDF through Worker |
| 3. Drawing & geometry | Overlay canvas, H/V draw, snap, assembly assign, auto-save | Coordinate space consistency between PDF and overlay |
| 4. Rooms & ventilation | Loop detection, room panel, temp + vent fields | Shared internal walls between two rooms (engine edge case → F-03) |
| 5. Integration & verification | Entry link, prerequisite UX, docs, manual checks | Editor usability on typical architectural PDF |

**Prerequisites:** S-02 and F-02 done; local Supabase migrated; `.env` + `.dev.vars`

**Estimated effort:** ~4–6 sessions across 5 phases (greenfield editor subsystem)

## Open Risks & Assumptions

- Ventilation field units/semantics are placeholders until F-03 defines the simplified model — schema uses nullable numerics with documented intent
- Shared internal segments between adjacent rooms may need F-03 rules; S-03 stores geometry only
- Large PDFs (up to 50 MiB) proxied through Worker — monitor memory; acceptable for MVP per F-02
- No automated test runner — manual verification is primary for editor UX
- Debounced auto-save is last-write-wins (no version/conflict check); MVP assumes single editor tab

## Success Criteria (Summary)

- Owner completes scale calibration, draws segments with assemblies, forms rooms with temperature and ventilation, reloads and sees persisted state
- User without prerequisites is redirected with clear messaging; other accounts cannot read/write editor API (RLS)
- `npm run lint` and `npm run build` pass
