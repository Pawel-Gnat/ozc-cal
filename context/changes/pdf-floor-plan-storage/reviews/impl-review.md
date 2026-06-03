<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Per-project Floor-plan PDF Storage

- **Plan**: context/changes/pdf-floor-plan-storage/plan.md
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Storage RLS SQL differs from plan text

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260603140000_floor_plan_storage.sql
- **Detail**: Plan specifies `storage.foldername(name)[1]` + `exists (select 1 from projects ...)`. Migrations use `split_part(name, '/', 1)::uuid IN (SELECT id FROM projects WHERE owner_id = auth.uid())`. Intent (owner-only, project-id prefix) matches; SQL shape and a follow-up fix migration (`20260603150000`) reflect an RLS `name` shadow issue not in the original plan text.
- **Fix**: Add a short addendum to the plan Migration Notes documenting the `split_part` policy shape and why `20260603150000` exists for DBs that ran an earlier variant.
- **Decision**: FIXED

### F2 — Vite React pre-bundle not in plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: astro.config.mjs, vite/optimize-server-deps.mjs
- **Detail**: Phase 4 commit added `optimizeServerDeps` plugin and React dedupe/alias to fix Astro 6 + Cloudflare workerd “Invalid hook call” in dev. Valuable for the stack; outside F-02 scope guardrails.
- **Fix A ⭐ Recommended**: Document in README “Development” or plan Phase 4 addendum as infrastructure fix discovered during F-02 UI testing.
  - Strength: Preserves fix; explains why it exists for future agents.
  - Tradeoff: Slightly expands documented scope.
  - Confidence: HIGH — matches how prior changes recorded dev-only fixes.
  - Blind spot: None significant.
- **Fix B**: Move to a separate chore change/PR narrative only in commit history.
  - Strength: Keeps F-02 plan scope pure.
  - Tradeoff: Harder to discover without reading git log.
  - Confidence: MED.
  - Blind spot: New contributors may hit hook errors again.
- **Decision**: FIXED (Fix A — README)

### F3 — Full-file buffer on upload (Worker memory)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project-floor-plan.ts:22–27
- **Detail**: `file.arrayBuffer()` loads up to 50 MiB in the Worker before Storage upload. Plan Performance section flags this; manual 5.5 passed on dev/Worker but risk remains at the cap.
- **Fix**: No code change required for F-02 sign-off; track S-03 direct-to-Storage upload as the mitigation if production hits limits.
- **Decision**: FIXED (document only — plan Performance)

### F4 — Delete ordering can leave stale metadata

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project-floor-plan.ts:64–83
- **Detail**: Storage delete succeeds then DB null fails → UI still shows attached file; GET/signing fails. Plan accepts orphaned object on DB failure after delete; this is the inverse (orphaned metadata). Rare but confusing UX.
- **Fix**: On DB update failure after storage delete, log at error level and redirect with a specific error message; optionally retry the column clear once.
- **Decision**: FIXED (retry + existing error redirect)

### F5 — Shallow PDF content validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/lib/validation/floor-plan.ts:7–33
- **Detail**: Checks extension, MIME (including empty type), and `%PDF-` magic only—no structural PDF validation. Acceptable for trusted-owner MVP; stored files are served via signed URL.
- **Fix A ⭐ Recommended**: Accept for F-02; note in plan/security addendum; revisit before public upload or multi-tenant abuse scenarios.
  - Strength: Matches PRD MVP and plan scope.
  - Tradeoff: Malicious PDFs possible in Storage.
  - Confidence: HIGH — plan never required deep parsing.
  - Blind spot: Antivirus/scan not evaluated.
- **Fix B**: Add server-side PDF header/structure check or size-limited parse before upload.
  - Strength: Stronger assurance.
  - Tradeoff: New dependency/complexity; may reject valid edge-case PDFs.
  - Confidence: LOW for F-02 timeline.
  - Blind spot: Parser choice and Worker CPU.
- **Decision**: FIXED (Fix A — plan note)

### F6 — Signed URL path not asserted against canonical path

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/project-floor-plan.ts:91–96
- **Detail**: `createFloorPlanSignedUrl` uses `project.floor_plan_storage_path` without verifying it equals `storagePathForProject(project.id)`. RLS still scopes Storage; only wrong path under owned prefix is plausible via bad DB data.
- **Fix**: Assert `path === storagePathForProject(project.id)` before `createSignedUrl`.
- **Decision**: FIXED (path assertion)

### F7 — Empty MIME allowed in validation

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/validation/floor-plan.ts
- **Detail**: Zod allows `file.type === ""` for browsers that omit MIME; plan listed `application/pdf` only. Magic bytes still required.
- **Fix**: No change unless you want stricter MIME-only validation and accept broken uploads in some browsers.
- **Decision**: FIXED (stricter MIME)

## Success criteria verification

| Check | Result |
|-------|--------|
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Progress manual items (1.4–5.5) | All `[x]` with SHAs |
| `npx supabase db reset --no-seed` | Recorded PASS at 9bdcd6c (not re-run this review) |
