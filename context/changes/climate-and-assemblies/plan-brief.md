# Climate and assemblies — Plan Brief

> Full plan: `context/changes/climate-and-assemblies/plan.md`
> Research: (none — planning session + PN-EN 12831 zone verification)

## What & Why

Deliver FR-004 and FR-005: on an existing project, the user sets **Polish winter climate zone** and **editable external design temperature**, then builds a **catalog of typed assemblies** (walls, floors, roof, etc.) each with **ordered material layers** (λ + thickness). This unlocks S-03 (layers pick an assembly) and feeds F-03 transmission inputs.

## Starting Point

S-01 provides auth, project CRUD, and `/projects/[id]` with a dashed placeholder (`src/pages/projects/[id].astro:55-59`). Only the `projects` table exists; no climate columns, assemblies, thermal code, or domain APIs.

## Desired End State

A logged-in owner opens a project, saves climate (zone I–V with preset temp, overridable), then manages assemblies (create/edit/delete with layers). Each saved assembly shows a **read-only server-computed** R_total/U preview. Data persists under RLS; `npm run lint` and `npm run build` pass.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Climate storage | Columns on `projects` | 1:1 per MVP project; simplest detail fetch | Plan |
| Climate zones | **Five** zones I–V per PN-EN 12831 PL annex | Normative Polish division (−16…−24°C); user confirmed 5 zones for MVP | Plan + user |
| External temp | Preset from zone, user may override | FR-004 requires both zone and temp; engineers adjust design temp | Plan |
| Climate gating | Required before assembly UI | Matches PRD flow steps 3→4 | Plan |
| Assembly model | `assemblies` + `assembly_layers` | Layer stack for FR-005 and WT transmission | Plan |
| Layer fields | Name, λ (W/m·K), thickness (mm) | Minimum viable resistance stack | Plan |
| Assembly category | Required enum | S-03 filters assemblies by boundary type | Plan |
| U/R in S-02 | Read-only preview on save | Early feedback without making S-02 the calc engine | Plan |
| Preview math | Shared server module in `src/lib/thermal/` | Same inputs F-03 will consume; avoid client drift | Plan |
| Mutations | Form POST + redirect (S-01) | Consistent security and patterns | Plan |
| Assembly UI | React island on detail page | Layer ordering needs interactivity | Plan |
| CRUD | Full create/edit/delete | Real catalog; hard delete OK until S-03 references exist | Plan |
| Starters | Empty catalog | No normative wrong defaults | Plan |
| UI language | English | Matches existing dashboard/detail copy | Plan |

## Scope

**In scope:** Migration (climate columns + assembly tables + RLS); types/Zod; climate presets constant; thermal preview helper; services; API routes; project detail UI (climate form + assembly island); manual FR-004/005 verification.

**Out of scope:** Ventilation (FR-006), PDF/editor (FR-007+), official OZC run (FR-009 / F-03), global material library seeds, project delete, assembly “in use” guards (S-03), map picker for zone, Polish UI strings.

## Architecture / Approach

```mermaid
flowchart LR
  subgraph ui [Project detail]
    CF[Climate form POST]
    AI[Assembly React island]
  end
  subgraph api [API routes]
    AC[/api/projects/id/climate]
    AA[/api/projects/id/assemblies...]
  end
  subgraph lib [lib]
    VAL[Zod validation]
    TH[thermal preview]
    SVC[services]
  end
  subgraph db [Supabase RLS]
    P[projects + climate cols]
    A[assemblies]
    L[assembly_layers]
  end
  CF --> AC --> SVC --> P
  AI --> AA --> SVC --> A --> L
  AA --> TH
```

Climate lives on `projects`. Child tables reference `project_id`; RLS checks ownership via `projects.owner_id = auth.uid()`. Detail page loads project + assemblies; assembly section disabled until `climate_zone` and `external_design_temp_c` are set.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema & RLS | Tables, constraints, policies | Child-table RLS subquery mistakes |
| 2. Domain layer | Types, Zod, zone presets (I–V), thermal preview | Preview formula oversimplified vs full WT |
| 3. Services & API | Mutations + redirects | Form/island field naming drift |
| 4. Project detail UI | Climate + gated assembly island | UX complexity for layer editor |
| 5. Verification | lint/build + manual E2E | Zone preset values must match norm table |

**Prerequisites:** S-01 deployed; local Supabase with migrations applied.

**Estimated effort:** ~3–4 focused sessions across 5 phases.

## Open Risks & Assumptions

- **Preview U-value:** Uses simplified R_si + Σ(d/λ) + R_se constants — labeled preview only until F-03; not a compliance certificate.
- **Category enum:** Must stay stable for S-03; changing values later needs migration.

## Success Criteria (Summary)

- User saves climate zone (I–V) and external temp; values persist on reopen.
- User creates typed assembly with ≥1 layer; edit/delete works; preview U/R visible after save.
- Another user cannot read or mutate the catalog (RLS).
