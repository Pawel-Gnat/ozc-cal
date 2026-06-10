---

## project: OZC-cal

version: 1
status: draft
created: 2026-05-27
updated: 2026-06-10
prd_version: 1
main_goal: market-feedback
top_blocker: skills

# Roadmap: OZC-cal

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Heat-demand (OZC) software is expensive and overloaded with features, which raises the barrier to entry for an HVAC designer or energy auditor who wants to calculate heat demand from a floor-plan drawing — without a full CAD/BIM stack. OZC-cal wins on interface simplicity and price: the user defines assemblies, climate parameters, and gravity ventilation, imports a floor-plan PDF, draws layers to create rooms, and runs calculations with heat losses aligned to WT 2021.

## North star

**S-04: First OZC calculation on a PDF floor plan** — the user runs a calculation and sees heat losses and ventilation deemed engineering-correct; this closes US-01 and the product's Primary Success Criteria.

> North star — the smallest complete end-to-end flow whose successful delivery validates the core product hypothesis (simple UI + floor-plan PDF → sensible OZC). Placed as early as dependencies allow: requires a working editor, building parameters, and calculation engine.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | project-schema-rls | (foundation) persistent project model with owner-scoped RLS | — | Access Control, NFR | done |
| F-02 | pdf-floor-plan-storage | (foundation) store a floor-plan PDF within project scope | F-01 | FR-007, NFR | done |
| F-03 | wt2021-calculation-core | (foundation) deterministic WT 2021 loss engine + gravity ventilation | F-01 | FR-009, NFR, Business Logic | done |
| S-01 | auth-and-project-lifecycle | register, sign in, create a project by name, and return to it | F-01 | FR-001, FR-002, FR-003 | done |
| S-02 | climate-and-assemblies | define climate zone, external temperature, and assemblies with materials | S-01 | FR-004, FR-005 | done |
| S-03 | pdf-floor-plan-editor | import a PDF, draw orthogonal layers, create rooms with temperature and gravity ventilation | S-02, F-02 | FR-006, FR-007, FR-008 | done |
| S-04 | first-ozc-calculation | run a calculation and see heat losses and ventilation matching engineering expectations | S-03, F-03 | FR-009, US-01 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.


| Stream | Theme | Chain | Note |
| ------ | ------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A | Account, parameters, editor | `F-01` → `S-01` → `S-02` → `F-02` → `S-03` | Main must-have path to floor-plan geometry; PDF is the differentiator vs form-based OZC tools. |
| B | Engine and OZC result | `F-03` → `S-04` | Parallel to Stream A after `F-01`; joins Stream A at `S-04` (requires `S-03`); eases the skills blocker. |


## Baseline

What's already in place in the codebase as of `2026-05-28` (auto-researched + user-confirmed; baseline refreshed after F-01 `project-schema-rls`).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands, Tailwind 4, shadcn/ui (minimal); routing in `src/pages/`
- **Backend / API:** partial — auth POST only (`signin`/`signup`/`signout`); no domain or calculation APIs
- **Data:** partial — Supabase client + `projects` migration with RLS (`supabase/migrations/20260528120000_create_projects.sql`); types in `src/types.ts`; no seeds; deployed locally and on remote cloud (`db push`)
- **Auth:** partial — Supabase SSR + middleware; only `/dashboard` protected
- **Deploy / infra:** partial — Cloudflare Workers (`wrangler.jsonc`), CI lint/build; no auto-deploy workflow
- **Observability:** partial — Cloudflare toggle in `wrangler.jsonc`; no Sentry or in-app logging

## Foundations

### F-01: Project model and RLS

- **Outcome:** (foundation) project schema in the database with RLS policy — data visible only to the account owner.
- **Change ID:** project-schema-rls
- **PRD refs:** Access Control, NFR (project data privacy)
- **Unlocks:** S-01, S-02, F-02, F-03
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Without project persistence, FR-003 and the entire US-01 flow are meaningless; sequenced first because baseline reports data as partial.
- **Status:** done

### F-02: Floor-plan PDF storage

- **Outcome:** (foundation) upload and read a floor-plan PDF file within the owner's project scope.
- **Change ID:** pdf-floor-plan-storage
- **PRD refs:** FR-007, NFR (project data privacy)
- **Unlocks:** S-03
- **Prerequisites:** F-01
- **Parallel with:** S-01, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** PDF import is a product differentiator; storage must be ready before the editor starts working on the file.
- **Status:** done

### F-03: WT 2021 calculation engine

- **Outcome:** (foundation) deterministic module for heat losses through assemblies (WT 2021) and simplified per-room gravity ventilation — same input yields the same result.
- **Change ID:** wt2021-calculation-core
- **PRD refs:** FR-009, NFR (result repeatability), Business Logic, WT 2021 Guardrails
- **Unlocks:** S-04
- **Prerequisites:** F-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:**
  - What exact simplified per-room gravity ventilation model (coefficients, air flows)? — Owner: user. Block: no.
- **Risk:** Highest domain risk (#1 blocker: skills); separated from UI to verify engineering correctness in parallel with the editor.
- **Status:** done

## Slices

### S-01: Account and project lifecycle

- **Outcome:** user can register, sign in, create a project by name, and return to a saved project to continue work.
- **Change ID:** auth-and-project-lifecycle
- **PRD refs:** FR-001, FR-002, FR-003
- **Prerequisites:** F-01
- **Parallel with:** F-02, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Auth baseline is partial (only `/dashboard` protected); slice extends protection to project routes without re-scaffolding Supabase auth.
- **Status:** done

### S-02: Climate and assemblies

- **Outcome:** user can define climate zone, building external temperature, and a catalog of building assemblies with materials for the project.
- **Change ID:** climate-and-assemblies
- **PRD refs:** FR-004, FR-005
- **Prerequisites:** S-01
- **Parallel with:** F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Entry point for transmission losses — without assemblies the editor has nothing to assign to layers.
- **Status:** done

### S-03: PDF floor-plan editor

- **Outcome:** user can import a floor-plan PDF, draw orthogonal layers with a defined assembly, connect them into closed rooms with internal temperature and per-room gravity ventilation.
- **Change ID:** pdf-floor-plan-editor
- **PRD refs:** FR-006, FR-007, FR-008
- **Prerequisites:** S-02, F-02
- **Parallel with:** F-03
- **Blockers:** —
- **Unknowns:**
  - Is per-room gravity ventilation configured only after drawing zones, even though Primary Success Criteria lists it before the editor step? — Owner: user. Block: no.
- **Risk:** Largest frontend investment (#1 blocker: skills); editor usability guardrail on a typical PDF determines product value.
- **Status:** done

### S-04: First OZC calculation on a PDF floor plan

- **Outcome:** user can run a calculation and see on-screen heat losses and ventilation matching engineering expectations (no formal report).
- **Change ID:** first-ozc-calculation
- **PRD refs:** FR-009, US-01
- **Prerequisites:** S-03, F-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Product validation milestone — connects editor geometry with the WT 2021 engine; without this US-01 remains unmet.
- **Status:** proposed

## Backlog Handoff


| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
| ---------- | -------------------------- | ------------------------------------------------- | --------------------- | --------------------------------------------- |
| F-01 | project-schema-rls | Supabase project schema with owner RLS | yes | Unblocks S-01 and parallel F-02 / F-03 |
| F-02 | pdf-floor-plan-storage | Per-project floor-plan PDF storage | no | Requires F-01 |
| F-03 | wt2021-calculation-core | WT 2021 calculation engine + gravity ventilation | no | Requires F-01; can plan in parallel with S-02 |
| S-01 | auth-and-project-lifecycle | Registration, login, and project CRUD | no | Requires F-01 |
| S-02 | climate-and-assemblies | Climate zone and assembly catalog | no | Requires S-01 |
| S-03 | pdf-floor-plan-editor | PDF editor: layers, rooms, ventilation | no | Requires S-02, F-02 |
| S-04 | first-ozc-calculation | Run OZC and display on-screen results | no | North star; requires S-03, F-03 |


## Open Roadmap Questions

1. **What exact simplified per-room gravity ventilation model?** — Owner: user. Block: F-03 (engine planning; Block: no on slice — research in `/10x-plan`).
2. **UX order: ventilation before or while drawing rooms?** — Owner: user. Block: S-03 (Block: no — UX decision in editor plan).

(PRD questions resolved 2026-05-19 — no open items to copy.)

## Parked

- **Cross-account project sharing** — Why parked: PRD §Non-Goals; MVP single-tenant per user.
- **Import .dwg / .dxf** — Why parked: PRD §Non-Goals; v1 PDF only.
- **Integrations with external OZC platforms** — Why parked: PRD §Non-Goals.
- **Multi-storey calculations** — Why parked: PRD §Non-Goals; one storey per project in MVP.
- **Mechanical / supply-exhaust ventilation** — Why parked: PRD §Non-Goals; gravity per room only.
- **Building energy certificate** — Why parked: PRD §Non-Goals.
- **3D model from 2D layers** — Why parked: PRD §Non-Goals.
- **Mobile app** — Why parked: PRD §Non-Goals; web desktop in MVP.
- **Formal PDF/print report** — Why parked: PRD §Non-Goals; on-screen results in v1.

## Done

- **F-01: (foundation) project schema in the database with RLS policy — data visible only to the account owner.** — Archived 2026-06-02 → `context/archive/2026-05-28-project-schema-rls/`. Lesson: —.
- **S-01: user can register, sign in, create a project by name, and return to a saved project to continue work.** — Archived 2026-06-02 → `context/archive/2026-05-28-auth-and-project-lifecycle/`. Lesson: —.
- **S-02: user can define climate zone, building external temperature, and a catalog of building assemblies with materials for the project.** — Archived 2026-06-03 → `context/archive/2026-06-02-climate-and-assemblies/`. Lesson: —.
- **F-02: (foundation) upload and read a floor-plan PDF file within the owner's project scope.** — Archived 2026-06-03 → `context/archive/2026-06-03-pdf-floor-plan-storage/`. Lesson: —.
- **S-03: user can import a floor-plan PDF, draw orthogonal layers with a defined assembly, connect them into closed rooms with internal temperature and per-room gravity ventilation.** — Archived 2026-06-09 → `context/archive/2026-06-08-pdf-floor-plan-editor/`. Lesson: —.
- **F-03: (foundation) deterministic module for heat losses through assemblies (WT 2021) and simplified per-room gravity ventilation — same input yields the same result.** — Archived 2026-06-10 → `context/archive/2026-06-09-wt2021-calculation-core/`. Lesson: —.
