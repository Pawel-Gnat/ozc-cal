<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Per-project floor-plan PDF storage (F-02)

- **Plan**: context/changes/pdf-floor-plan-storage/plan.md
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: SOUND
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 paths ✓, 4/4 symbols ✓, brief↔plan ✓

## Findings

### F1 — Delete path lacks atomicity guidance

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — `deleteProjectFloorPlan` / Phase 3 — DELETE handler
- **Detail**: Upload rollback on DB failure is specified (delete orphaned Storage object), but delete flow does not define order when Storage removal succeeds and DB column clear fails (or vice versa). Either leaves metadata pointing at a missing object or an orphan file with no project reference.
- **Fix**: Specify delete order in Phase 2 service contract: remove Storage object first; null project columns only on success; on Storage failure keep metadata and surface error redirect. Mirror upload rollback note in Critical Implementation Details.
- **Decision**: FIXED (delete Storage first; clear columns only on success)

### F2 — S-03 pdf.js may need bucket CORS

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / unlocks S-03
- **Detail**: F-02 GET → `createSignedUrl` → 302 redirect works for browser tab open/download (no CORS). S-03 will likely `fetch(signedUrl)` from the app origin for pdf.js — cross-origin GET requires Storage bucket CORS. Plan unlocks S-03 but does not flag this follow-on config.
- **Fix**: Add a one-line note under Critical Implementation Details: F-02 redirect flow needs no CORS; before S-03, verify/configure Supabase Storage CORS for client-side PDF fetch.
- **Decision**: FIXED (S-03 CORS note added to Critical Implementation Details)

### F3 — First storage migration needs explicit SQL template

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Migration
- **Detail**: Repo has zero `storage.*` migrations today (`grep storage supabase/migrations` → no matches). Plan describes bucket + RLS but does not embed the idempotent `insert into storage.buckets (...)` template or `on conflict` guard. Implementer must infer from Supabase docs.
- **Fix**: Add migration snippet to Phase 1: `insert into storage.buckets (...)` with `on conflict (id) do nothing;` plus mirror in `config.toml` `[storage.buckets.floor-plans]`.
- **Decision**: FIXED (idempotent storage.buckets INSERT template in Phase 1)

### F4 — Phase 3 manual curl missing Origin caveat

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Manual Verification (3.3)
- **Detail**: S-02 manual testing showed plain `curl` POST without `Origin` returns 403 from Astro/Vite dev server (`isSameOriginRequest`). Phase 3 manual says "curl with session" but omits the Origin header note; implementer may false-fail upload tests.
- **Fix**: Extend Phase 3 manual step 3.3: for dev `curl` POST, include `-H "Origin: http://localhost:4321"` (or browser form POST on same origin).
- **Decision**: FIXED (Origin header note added to Phase 3 manual verification)

### F5 — Large-file Worker smoke test absent from Phase 5

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 5 — Manual Verification
- **Detail**: Plan and brief acknowledge 50 MiB in-memory multipart risk on Cloudflare Workers; no repo precedent for file uploads. Phase 5 regression covers two-user isolation but not a near-limit upload smoke test.
- **Fix**: Optional Phase 5 manual addendum: upload a ≥10 MiB PDF locally and on deployed Worker; document pass/fail.
- **Decision**: FIXED (Phase 5 manual + Progress 5.5 added)

### F6 — First multipart file route (expected DRIFT)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — `floor-plan.ts`
- **Detail**: All existing API routes use `formData()` for text fields only; no `File` / `arrayBuffer()` pattern yet. Plan correctly follows S-02 auth/redirect shell — this is necessary new surface, not pattern proliferation. No plan change required unless implementer wants an inline code sketch.
- **Fix**: No plan edit required; accept as intentional first file route.
- **Decision**: FIXED (inline multipart File sketch added to Phase 3 contract)
