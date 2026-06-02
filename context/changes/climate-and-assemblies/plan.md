# Climate and Assemblies Implementation Plan

## Overview

Roadmap slice **S-02** (`climate-and-assemblies`) implements **FR-004** (climate zone + external design temperature) and **FR-005** (project-scoped assembly catalog with material layers) on the existing `/projects/[id]` shell. Builds on F-01/S-01 patterns: Supabase RLS, hand-written types, Zod validation, HTML form POST APIs with same-origin checks, thin services.

**PRD refs:** FR-004, FR-005 · **Prerequisites:** S-01 done · **Unlocks:** S-03 layer assignment

## Current State Analysis

- `projects` table only (`supabase/migrations/20260528120000_create_projects.sql`); owner-scoped RLS; no DELETE policy.
- Project detail placeholder at `src/pages/projects/[id].astro:55-59`.
- API: POST `src/pages/api/projects/index.ts` (create only).
- No thermal/calculation code; F-03 (`wt2021-calculation-core`) parallel, not blocking persistence.

### Key Discoveries:

- S-01 contract: detail page is FR-003 destination; **S-02 replaces placeholder**, no new top-level route (`context/archive/2026-05-28-auth-and-project-lifecycle/plan.md`).
- `PROTECTED_ROUTES` already covers `/projects` and `/api/projects` (`src/middleware.ts:4`).
- Polish **winter** climate zones for building heat load: **five** zones I–V per PN-EN 12831-1:2017-08 national annex (successor to PN-82/B-02403), design temps −16, −18, −20, −22, −24 °C. **Confirmed:** product uses all five zones (not a simplified 3- or 4-zone map).

## Desired End State

Logged-in project owner on `/projects/[id]`:

1. Saves **climate zone** (I, II, III, IV, or V) and **external design temperature** (preset from zone, editable).
2. After climate is saved, manages **assemblies**: name, required **category**, ordered **layers** (material name, λ, thickness mm).
3. On assembly save, sees **read-only** R_total and U preview from server module (not official F-03 calc).
4. Data survives reload; other accounts cannot access (RLS).

### Verification

- Automated: `npm run lint`, `npm run build`, migration applies via `npx supabase db reset --no-seed` (local).
- Manual: FR-004/005 walkthrough on two users (isolation).

## What We're NOT Doing

- Gravity ventilation per room (FR-006) — S-03+
- PDF import / floor-plan editor (FR-007, FR-008)
- Run OZC / on-screen results (FR-009, S-04, F-03)
- Global seeded material library or “template assemblies”
- Project or assembly soft-delete; assembly “in use” delete guard (no geometry yet)
- Storing authoritative U on assembly row (preview only, not persisted)
- Polish UI strings (English matches S-01)
- Extending `PROTECTED_ROUTES` (nested `/api/projects/...` already matched)
- `supabase gen types` — hand-written `src/types.ts` only

## Implementation Approach

1. Extend `projects` with nullable climate fields; add `assemblies` and `assembly_layers` with FK cascades.
2. RLS on child tables via `EXISTS` subquery to `projects` where `owner_id = auth.uid()`.
3. Centralize **climate zone presets** in `src/lib/climate/poland-zones.ts` (I–V → default °C, labels).
4. **Thermal preview** in `src/lib/thermal/assembly-preview.ts` — pure function, fixed R_si/R_se for MVP preview (document constants; F-03 may refine).
5. Services + Zod + form POST APIs; redirect back to `/projects/[id]` with `?error=` / `?saved=climate|assembly`.
6. Astro detail page: SSR climate form; React island for assembly list/editor posting to same API style.

## Critical Implementation Details

**Climate zones (Poland, winter, PN-EN 12831 national annex):** Store zone as constrained text `I` | `II` | `III` | `IV` | `V`. Default external design temperatures (°C): I −16, II −18, III −20, IV −22, V −24. UI pre-fills on zone change; user override allowed within Zod bounds (e.g. −30…−10). Document in `poland-zones.ts` comment that values follow PN-EN 12831-1 PL annex for MVP presets.

**Climate gating:** `hasClimate = climate_zone != null && external_design_temp_c != null`. Assembly CRUD UI and APIs **redirect** to `/projects/[id]?error=...` if climate incomplete (same pattern as `api/projects/index.ts` — no JSON 400).

**Thermal preview (non-authoritative):** `R_total = R_si + Σ(thickness_m / lambda) + R_se`, `U = 1 / R_total`. Use documented constant R_si/R_se for preview only; show on assembly detail after save — do not write U to DB.

## Phase 1: Schema & RLS

### Overview

Add climate columns to `projects` and assembly tables with owner-scoped RLS.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260602120000_climate_and_assemblies.sql`

**Intent**: Persist FR-004 on project row and FR-005 catalog per project with layer stack.

**Contract**:

- `projects` additions:
  - `climate_zone` — `text` nullable, `CHECK (climate_zone IN ('I','II','III','IV','V'))`
  - `external_design_temp_c` — `numeric(4,1)` nullable
- Table `public.assemblies`:
  - `id` uuid PK default `gen_random_uuid()`
  - `project_id` uuid NOT NULL REFERENCES `projects(id)` ON DELETE CASCADE
  - `name` text NOT NULL
  - `category` text NOT NULL — `CHECK` against fixed set: `external_wall`, `internal_partition`, `floor`, `ceiling`, `roof`, `ground_floor`, `window`, `door`
  - `created_at`, `updated_at` timestamptz NOT NULL default `now()`
  - Index on `project_id`
  - `updated_at` trigger (reuse `set_updated_at()`)
- Table `public.assembly_layers`:
  - `id` uuid PK
  - `assembly_id` uuid NOT NULL REFERENCES `assemblies(id)` ON DELETE CASCADE
  - `layer_order` int NOT NULL — **0-based** (first layer = 0; document in migration comment)
  - `material_name` text NOT NULL
  - `lambda_w_mk` numeric(6,3) NOT NULL CHECK (`lambda_w_mk` > 0)
  - `thickness_mm` numeric(8,2) NOT NULL CHECK (`thickness_mm` > 0)
  - Unique (`assembly_id`, `layer_order`)
- RLS enabled on `assemblies`, `assembly_layers`
- Policies for authenticated:
  - **`assemblies`** — named policies e.g. `assemblies_select_own`, `assemblies_insert_own`, `assemblies_update_own`, `assemblies_delete_own`:
    - SELECT/UPDATE/DELETE **USING:** `exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())`
    - INSERT **WITH CHECK:** same `exists (...)` expression
  - **`assembly_layers`** — named policies e.g. `assembly_layers_select_own`, `assembly_layers_insert_own`, `assembly_layers_update_own`, `assembly_layers_delete_own`; subquery through parent assembly:
    - **USING** (SELECT/UPDATE/DELETE): `exists (select 1 from public.assemblies a join public.projects p on p.id = a.project_id where a.id = assembly_id and p.owner_id = auth.uid())`
    - **WITH CHECK** (INSERT/UPDATE): same `exists (...)` expression — required so layer INSERT is not rejected by RLS
- `GRANT` appropriate privileges to `authenticated` (include DELETE on child tables — hard delete in scope)

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset --no-seed`
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Tables and CHECK constraints visible in Supabase Studio
- RLS enabled on `assemblies` and `assembly_layers`
- Updating another user's `project_id` via SQL editor as authenticated user fails (policy)

**Implementation Note**: Pause for human manual confirmation before Phase 2.

---

## Phase 2: Domain Layer

### Overview

Types, validation, climate presets, thermal preview module.

### Changes Required:

#### 1. Extend Database types

**File**: `src/types.ts`

**Intent**: TypeScript contracts for new columns and tables.

**Contract**: Extend `Project` with optional `climate_zone`, `external_design_temp_c`; add `Assembly`, `AssemblyLayer`, insert/update types; extend `Database.public.Tables`.

#### 2. Climate presets

**File**: `src/lib/climate/poland-zones.ts`

**Intent**: Single source for zone enum, labels (English), default design temperatures, and helper `getDefaultTempForZone(zone)`.

**Contract**: Export `CLIMATE_ZONES` as readonly array of `{ id: 'I'|'II'|...; label: string; defaultTempC: number }` matching Phase 1 CHECK values.

#### 3. Zod schemas

**File**: `src/lib/validation/climate.ts`, `src/lib/validation/assembly.ts`

**Intent**: Server-side validation for all mutation payloads.

**Contract**:

- Climate: zone enum; `external_design_temp_c` number in sane range; refine optional cross-check with preset
- Export **`ASSEMBLY_CATEGORIES`** readonly const (single source for DB CHECK, Zod `z.enum`, and island props) — values: `external_wall`, `internal_partition`, `floor`, `ceiling`, `roof`, `ground_floor`, `window`, `door`
- Assembly: name length; category from `ASSEMBLY_CATEGORIES`
- Layers: non-empty array; each layer material name, λ > 0, thickness_mm > 0; max layer count cap (e.g. 20) to prevent abuse; `layer_order` 0-based matching DB

#### 4. Thermal preview

**File**: `src/lib/thermal/assembly-preview.ts`

**Intent**: Compute read-only R_total (m²K/W) and U (W/m²K) for layer list.

**Contract**: Export `computeAssemblyPreview(layers: { lambda_w_mk: number; thickness_mm: number }[]): { rTotal: number; uValue: number }`; export documented `R_SI_PREVIEW`, `R_SE_PREVIEW` constants.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Quick node REPL or temporary script: sample wall layers produce plausible U (order-of-magnitude sanity)

**Implementation Note**: Pause for human manual confirmation before Phase 3.

---

## Phase 3: Services & API

### Overview

Supabase data access and form POST mutation routes.

### Changes Required:

#### 1. Climate service

**File**: `src/lib/services/project-climate.ts`

**Intent**: Update project climate fields for owner (RLS-enforced).

**Contract**: `updateProjectClimate(supabase, projectId, { climate_zone, external_design_temp_c })` — updates `projects` row; throws on Supabase error.

#### 2. Assembly services

**File**: `src/lib/services/assemblies.ts`

**Intent**: List/create/update/delete assemblies with layers in transactional pattern acceptable for Supabase (insert assembly + layers; replace layers on update).

**Contract**:

- `listAssembliesWithLayers(supabase, projectId)` — returns assemblies with layers and **server preview** per row: map layers through `computeAssemblyPreview` from `src/lib/thermal/assembly-preview.ts` and attach `preview: { rTotal, uValue }` (not persisted to DB)
- `createAssemblyWithLayers(...)`, `updateAssemblyWithLayers(...)` — return assembly + layers + same `preview` shape for post-redirect display if needed
- `updateAssemblyWithLayers` layer replace **without empty state on failure:** insert new layer rows first, then delete superseded row ids (not delete-all-then-insert); if insert fails, previous layers remain
- `deleteAssembly(supabase, assemblyId)`
- `getProjectHasClimate(project)` helper or inline check

#### 3. Climate API

**File**: `src/pages/api/projects/[id]/climate.ts`

**Intent**: FR-004 save endpoint.

**Contract**: `export const prerender = false`; POST only; auth + `isSameOriginRequest`; validate `id` UUID; parse `formData` with climate Zod; 403/redirect if no user; on success redirect `/projects/[id]?saved=climate`; errors `?error=`.

#### 4. Assembly APIs

**Files**:

- `src/pages/api/projects/[id]/assemblies/index.ts` — POST create
- `src/pages/api/projects/[id]/assemblies/[assemblyId].ts` — POST update, POST delete (e.g. `_action=delete` field or separate route `.../delete.ts`)

**Intent**: FR-005 CRUD with climate gate.

**Contract**: Same security as climate route; reject if project climate incomplete; Zod body from **indexed form fields** only (e.g. `layers[0][material_name]`, `layers[0][lambda_w_mk]`, `layers[0][thickness_mm]`, incrementing index per row — no JSON hidden blob); `AssemblyCatalog` generates these names on submit; redirect with `?saved=assembly` or `?error=`; preview shown after reload via `listAssembliesWithLayers` (no flash query).

#### 5. Detail resolver extension

**File**: `src/lib/projects/resolve-project-detail.ts` (and/or new loader)

**Intent**: Supply detail page with project + assemblies + `hasClimate` flag.

**Contract**: Extend resolved payload or add `loadProjectBuildingParameters(supabase, projectId)` used by `[id].astro` frontmatter.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- `curl`/browser: POST climate without auth redirects to sign-in
- POST assembly without climate saved redirects with error

**Implementation Note**: Pause for human manual confirmation before Phase 4.

---

## Phase 4: Project Detail UI

### Overview

Replace placeholder with climate form and assembly React island.

### Changes Required:

#### 1. Project detail page

**File**: `src/pages/projects/[id].astro`

**Intent**: FR-004/005 UI on existing shell.

**Contract**:

- Load project + assemblies via services
- Remove dashed placeholder (`:55-59`)
- Section 1 — Climate: HTML form `method="POST"` `action="/api/projects/{id}/climate"`; zone `<select>` options I–V with labels from `poland-zones.ts`; temp input with `data-default` per zone for small inline script or island-free `onchange` optional; show current values when set
- Section 2 — Assemblies: render only when `hasClimate`; else disabled message pointing to complete climate first
- **Query-param banners (required):** read `error` and `saved` from `Astro.url.searchParams`; render visible banner (reuse dashboard error/success styling). Allowed `saved`: `climate`, `assembly`. Today `[id].astro` has no param handling — APIs redirect here with messages users must see.
- Pass props into island: `projectId`, `assemblies`, `categories` list

#### 2. Assembly island

**File**: `src/components/projects/AssemblyCatalog.tsx` (and subcomponents as needed)

**Intent**: Interactive list, create/edit form with dynamic layer rows, category select, submit via HTML form POST (hidden fields or form per action) to Phase 3 routes.

**Contract**:

- List assemblies with category label and preview U/R (from server data after save — page reload after redirect is acceptable for MVP)
- Create/edit: add/remove layer rows; client-side validation mirroring Zod messages
- Delete: form POST with confirm (`window.confirm` acceptable)
- Use `cn()`, shadcn inputs/buttons consistent with `CreateProjectDialog.tsx`
- No `"use client"` directive per AGENTS.md (Astro island default)

#### 3. Optional small climate UX script

**File**: inline in `[id].astro` or `src/components/projects/climate-zone-presets.ts`

**Intent**: When user changes zone, pre-fill temp input with default unless user has manually overridden (simple flag).

**Contract**: Keep minimal; do not block SSR if JS disabled — server presets still apply on save.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Climate save persists; zone V shows default −24
- Assembly section hidden until climate saved
- Create assembly with 2 layers, see preview after reload
- Edit and delete assembly work
- English labels visible

**Implementation Note**: Pause for human manual confirmation before Phase 5.

---

## Phase 5: Verification & Documentation

### Overview

End-to-end manual verification and README touch-up if migrations changed workflow.

### Changes Required:

#### 1. README migration note

**File**: `README.md`

**Intent**: Mention new tables only if setup section lists schema; optional one line under Supabase section.

**Contract**: Brief note: S-02 adds climate + assemblies migrations.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- **FR-004:** User A sets zone III, overrides temp, reloads — values persist
- **FR-005:** User A creates typed external wall with ≥1 layer; edits layer thickness; deletes assembly
- **RLS:** User B cannot load User A assembly via API tampering (wrong id → not found/redirect)
- **Gating:** Cannot create assembly until climate saved
- No regression: dashboard list/create still works

**Implementation Note**: Final sign-off for S-02 slice complete.

---

## Testing Strategy

### Unit Tests:

- Not in repo scope per AGENTS.md unless requested; manual sanity for `computeAssemblyPreview` optional in Phase 2.

### Integration Tests:

- None configured; rely on RLS manual two-user check.

### Manual Testing Steps:

1. `nvm use && npm run dev` with local Supabase migrated.
2. Create project → open detail → save climate zone IV (−22 default) → adjust to −21 → save.
3. Add assembly `External wall 24cm` category `external_wall` with 2 layers → verify preview U/R shown.
4. Sign in as second user; attempt same project URL → redirect/not found.
5. Delete assembly; confirm gone from list.

## Performance Considerations

- List assemblies + layers per project: expected small cardinality (tens); single query with embed or two queries acceptable.
- No N+1 on dashboard.

## Migration Notes

- Apply migration locally: `npx supabase db reset --no-seed` or `db push` to remote.
- Existing projects: climate columns null until user saves; assembly section gated.

## References

- Roadmap S-02: `context/foundation/roadmap.md:120-129`
- PRD FR-004/005: `context/foundation/prd.md:76-81`
- S-01 placeholder contract: `context/archive/2026-05-28-auth-and-project-lifecycle/plan.md:211-224`
- F-01 deferral: `context/archive/2026-05-28-project-schema-rls/plan.md:27`
- Detail placeholder: `src/pages/projects/[id].astro:55-59`
- PN-EN 12831 winter zones (I–V, −16…−24°C): national annex cited in `plan-brief.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema & RLS

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset --no-seed` — 880b7b2
- [x] 1.2 Linting passes: `npm run lint` — 880b7b2
- [x] 1.3 Production build passes: `npm run build` — 880b7b2

#### Manual

- [x] 1.4 Tables, CHECK constraints, and RLS policies verified in Supabase Studio — 880b7b2
- [x] 1.5 Cross-user RLS isolation spot-checked — 880b7b2

### Phase 2: Domain Layer

#### Automated

- [ ] 2.1 Linting passes: `npm run lint`
- [ ] 2.2 Production build passes: `npm run build`

#### Manual

- [ ] 2.3 Thermal preview sanity check on sample layers

### Phase 3: Services & API

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Production build passes: `npm run build`

#### Manual

- [ ] 3.3 Climate and assembly POST auth and climate-gate behavior verified

### Phase 4: Project Detail UI

#### Automated

- [ ] 4.1 Linting passes: `npm run lint`
- [ ] 4.2 Production build passes: `npm run build`

#### Manual

- [ ] 4.3 Climate form and assembly island UX verified

### Phase 5: Verification & Documentation

#### Automated

- [ ] 5.1 Linting passes: `npm run lint`
- [ ] 5.2 Production build passes: `npm run build`

#### Manual

- [ ] 5.3 FR-004 and FR-005 end-to-end walkthrough complete
- [ ] 5.4 Two-user RLS regression check complete
