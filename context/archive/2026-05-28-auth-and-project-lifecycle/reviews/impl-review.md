<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth & Project Lifecycle (S-01)

- **Plan**: context/changes/auth-and-project-lifecycle/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-06-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS ✅ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | WARNING ⚠️ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ |

## Findings

### F1 — Silent listProjects failure on dashboard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:26-28
- **Detail**: `listProjects` errors are caught and replaced with `projects = []`, so DB/network failures look identical to an empty project list. User gets no actionable feedback.
- **Fix**: Show a distinct error banner (e.g. "Could not load projects") when the catch block fires; keep empty state only for successful zero-row responses.
  - Strength: Clear UX separation between "no data" and "load failed".
  - Tradeoff: Small UI addition; need to track a `listError` flag alongside `projects`.
  - Confidence: HIGH — straightforward conditional in existing error banner pattern.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — Transient errors masked as "Project not found"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/projects/resolve-project-detail.ts:33-35
- **Detail**: The `catch` block maps all `getProjectById` failures (network, Supabase outage) to the same "Project not found" redirect as missing/unowned projects.
- **Fix A ⭐ Recommended**: Log server-side; redirect with a distinct message for infra failures (e.g. "Could not load project — try again").
  - Strength: Users can distinguish retryable failures from authorization/not-found cases.
  - Tradeoff: Slightly more error surface; plan intentionally unified not-found messaging for IDOR safety.
  - Confidence: MED — need to avoid leaking existence of other users' projects.
  - Blind spot: Exact Supabase error taxonomy not verified.
- **Fix B**: Keep unified message; add server-side logging only
  - Strength: Preserves IDOR-safe single message; minimal code change.
  - Tradeoff: Users still can't tell transient from permanent failure.
  - Confidence: HIGH — logging-only is safe and quick.
  - Blind spot: Ops must monitor logs to detect outages.
- **Decision**: FIXED via Fix A

### F3 — Raw Supabase errors reflected in redirect URL

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/projects/index.ts:35-37
- **Detail**: `error.message` from Supabase/Postgres is URL-encoded into `?error=` and rendered on the dashboard. Can leak constraint or policy details to the browser.
- **Fix**: Map caught errors to stable user messages (e.g. "Failed to create project"); log raw error server-side only.
- **Decision**: FIXED

### F4 — No CSRF protection on POST /api/projects

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/projects/index.ts:10-38
- **Detail**: Cookie-based session auth with plain HTML form POST and no CSRF token. Same pattern as existing auth routes; plan explicitly mirrors auth form pattern. Risk is real but consistent with current architecture.
- **Fix**: Added Origin/Referer same-origin check on POST /api/projects via `src/lib/is-same-origin-request.ts`.
- **Decision**: FIXED

### F5 — Unplanned helper and ESLint override

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/projects/resolve-project-detail.ts, eslint.config.js
- **Detail**: Two files not listed in plan. Helper extracts detail resolution (cleaner `[id].astro`); ESLint disables `@typescript-eslint/no-misused-promises` for Astro redirect parser crash. Both support plan intent without feature scope creep.
- **Fix**: Replaced single-rule override with `tseslint.configs.disableTypeChecked` for `**/*.astro` — astro-eslint-parser cannot support type-checked rules (including `no-misused-promises`, which crashes on `return Astro.redirect()`). Type-checked rules remain active on `.ts`/`.tsx`.
- **Decision**: FIXED
