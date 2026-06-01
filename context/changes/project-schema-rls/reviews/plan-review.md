<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Project Schema & RLS

- **Plan**: context/changes/project-schema-rls/plan.md
- **Mode**: Deep
- **Date**: 2026-05-28
- **Verdict**: REVISE → SOUND (after triage fixes)
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 5/5 paths ✓, 4/4 symbols ✓, brief↔plan ✓

## Findings

### F1 — Studio SQL cannot prove RLS isolation

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Desired End State; Phase 4
- **Detail**: Default Studio SQL runs as `postgres` and bypasses RLS; end state overpromised Studio verification.
- **Fix A ⭐ Recommended**: Require psql JWT impersonation steps in Phase 4.
- **Decision**: FIXED (Fix A applied to plan.md)

### F2 — Missing seed.sql on db reset

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 verification
- **Detail**: `config.toml` enables seed but `supabase/seed.sql` absent.
- **Fix**: Use `npx supabase db reset --no-seed` in Phase 1 and manual testing steps.
- **Decision**: FIXED

### F3 — README still instructs supabase init

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3
- **Detail**: `supabase/config.toml` already exists; init step is misleading.
- **Fix**: Phase 3 contract includes skip-init wording.
- **Decision**: FIXED

### F4 — Doc drift outside README

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Out of plan scope
- **Detail**: `roadmap.md` and `deploy-plan.md` still say no migrations.
- **Fix**: Follow-up note in Phase 3 for archive-time baseline update.
- **Decision**: FIXED
