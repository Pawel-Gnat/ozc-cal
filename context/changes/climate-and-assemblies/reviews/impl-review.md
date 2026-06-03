<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Climate and Assemblies (S-02)

- **Plan**: context/changes/climate-and-assemblies/plan.md
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING ⚠️ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | WARNING ⚠️ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ |

## Automated checks (re-run)

| Command | Result |
|---------|--------|
| `npm run lint` | PASS |
| `npm run build` | PASS |

Manual Progress items (5.3, 5.4, etc.) are marked `[x]` with SHAs; spot-checks during implementation confirmed auth redirect, climate-gate, and UI flows.

## Findings

### F1 — Non-atomic assembly layer replace

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/assemblies.ts:159–226
- **Detail**: `updateAssemblyWithLayers` runs header update → temp insert → delete old → per-row reorder across multiple Supabase calls with no transaction. A failure after insert but before delete/reorder can leave duplicate or mis-ordered layers while the API redirects with a generic error. Plan required insert-before-delete to avoid empty stacks on insert failure; implementation satisfies that but adds temp-order + N updates without rollback.
- **Fix A ⭐ Recommended**: Add a Postgres RPC (single transaction: update header, delete old layers, insert final rows with correct `layer_order`).
  - Strength: Eliminates partial-state class; matches Supabase best practice for multi-row writes.
  - Tradeoff: New migration + RPC maintenance.
  - Confidence: HIGH — standard pattern for layer-stack replace.
  - Blind spot: RPC error messages need mapping to user-facing redirects.
- **Fix B**: Keep client-side flow but wrap in explicit compensating delete of temp rows on any failure after insert.
  - Strength: No migration.
  - Tradeoff: Still not truly atomic; race window remains under concurrent edits.
  - Confidence: MED — improves recovery, not correctness under all failures.
  - Blind spot: Concurrent double-submit not tested.
- **Decision**: FIXED via Fix A — `replace_assembly_with_layers` RPC in `20260603120000_review_fixes_rpc_and_climate_check.sql`

### F2 — Create rollback does not verify assembly delete

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/assemblies.ts:151–153
- **Detail**: When layer insert fails after assembly insert, code calls `delete` on the assembly but ignores delete errors, which can orphan a name-only assembly row.
- **Fix**: Check the delete result; throw/log if rollback fails so operators can detect orphans.
- **Decision**: FIXED — rollback delete error checked and thrown

### F3 — Zod does not enforce unique layer_order

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/validation/assembly.ts:22–30
- **Detail**: `assemblyCreateSchema` / `assemblyUpdateSchema` allow duplicate `layer_order` values. Tampered POSTs hit the DB unique constraint mid-update, worsening partial-update risk in F1.
- **Fix**: Add `.superRefine()` requiring distinct `layer_order` values (and optionally contiguous 0…n−1).
- **Decision**: FIXED — `refineUniqueLayerOrder` superRefine on create/update schemas

### F4 — Duplicate project fetch on detail page

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Performance)
- **Location**: src/lib/projects/resolve-project-detail.ts:51–56
- **Detail**: `resolveProjectDetail` loads the project, then `loadProjectBuildingParameters` calls `getProjectById` again for the same id.
- **Fix**: Pass the already-loaded `project` into `loadProjectBuildingParameters` instead of re-fetching.
- **Decision**: FIXED — `loadProjectBuildingParameters(supabase, project)`

### F5 — Assemblies loaded when climate not saved

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Performance)
- **Location**: src/lib/projects/resolve-project-detail.ts:56
- **Detail**: Detail page always runs `listAssembliesWithLayers` even when `hasClimate` is false and the UI shows only the gate message.
- **Fix**: Skip assembly query until `getProjectHasClimate(project)` is true.
- **Decision**: FIXED — returns `[]` when climate not saved

### F6 — No DB CHECK on external_design_temp_c range

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Data safety)
- **Location**: supabase/migrations/20260602120000_climate_and_assemblies.sql:3–6
- **Detail**: Temperature bounds (−30…−10 °C) enforced only in Zod, not in SQL. Direct DB writes could store out-of-range values.
- **Fix**: Optional migration addendum: `check (external_design_temp_c between -30 and -10)` when not null.
- **Decision**: FIXED — `projects_external_design_temp_c_range_check` in review migration

### F7 — ASSEMBLY_CATEGORIES source location drift

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/types.ts, src/lib/validation/assembly.ts
- **Detail**: Plan listed `ASSEMBLY_CATEGORIES` in `validation/assembly.ts` as single source; implementation centralizes in `types.ts` with re-export. SQL CHECK unchanged; behavior correct.
- **Fix**: Document in plan addendum or leave as-is (types.ts as canonical is reasonable for hand-written Database types).
- **Decision**: FIXED — documented in plan Implementation addendum
