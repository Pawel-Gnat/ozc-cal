# Project Schema & RLS — Plan Brief

> Full plan: `context/changes/project-schema-rls/plan.md`

## What & Why

Add the first Supabase application table (`projects`) with Row Level Security so each user can only access their own projects. This is roadmap F-01 — the persistence foundation required before S-01 can implement register/login/create/reopen project flows (FR-002, FR-003) under PRD privacy guardrails.

## Starting Point

Auth works (Supabase SSR + middleware), but the database has no app schema — only `auth.users`. `supabase/migrations/` is empty and README still documents an auth-only setup.

## Desired End State

After this change, `projects` exists with columns `id`, `name`, `owner_id`, `created_at`, `updated_at`. RLS allows authenticated users to SELECT, INSERT, and UPDATE only rows where `owner_id = auth.uid()`. A hand-written `Project` type lives in `src/types.ts`. Manual verification confirms User B cannot see User A's projects.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| F-01 scope | Migration + types + docs only | Keeps foundation separate from S-01 CRUD/UI | Plan |
| Schema shape | Minimal `projects` table | FR-002/003 need name + owner + timestamps; domain fields come in later slices | Plan |
| Delete strategy | No DELETE in F-01 | FR-003 does not require deletion; avoids extra policy work | Plan |
| RLS policies | SELECT / INSERT / UPDATE owner-only | Matches PRD flat owner model without delete | Plan |
| owner_id enforcement | `WITH CHECK` on INSERT | Standard Supabase pattern; S-01 passes `user.id` | Plan |
| TypeScript types | Manual `src/types.ts` | One table does not justify gen-types tooling yet | Plan |
| Primary key | UUID `gen_random_uuid()` | Aligns with Supabase/PostgREST conventions | Plan |
| Name constraints | NOT NULL, not unique | FR-002 does not require unique names | Plan |
| Seed & verify | No seed; manual Studio tests | Minimal F-01; RLS proven with two users | Plan |

## Scope

**In scope:** SQL migration, RLS policies, `updated_at` trigger, index on `owner_id`, `Project` types, README migration docs, manual RLS checklist

**Out of scope:** CRUD API/UI (S-01), climate/assemblies/geometry tables, seed.sql, generated types, DELETE, unique project names

## Architecture / Approach

```
auth.users (existing)
    ↑ FK owner_id
projects (new) — RLS: auth.uid() = owner_id
    ↑ queried later by S-01 via cookie-bound Supabase client
```

Migration is the single source of truth. Application code in this change only adds types — no runtime queries yet.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Supabase migration | `projects` table + RLS policies | Policy typo leaks cross-user data |
| 2. TypeScript types | `Project` / insert / update types in `src/types.ts` | Type drift from schema |
| 3. Documentation | README reflects migrations workflow | Docs still say "auth only" |
| 4. RLS manual verification | Two-user isolation checklist | Skipped verification blocks S-01 confidence |

**Prerequisites:** Local Supabase CLI (`npx supabase start`), `.env` with `SUPABASE_URL` / `SUPABASE_KEY`
**Estimated effort:** ~1 session across 4 phases (migration-heavy, no UI)

## Open Risks & Assumptions

- S-01 implementer must pass `owner_id` on INSERT — RLS will reject inserts without matching `auth.uid()`
- Remote/production migration apply is manual (Supabase dashboard/CLI) — not automated in CI for this change
- No automated RLS regression tests until a test stack is requested

## Success Criteria (Summary)

- `npx supabase db reset` applies migration without errors
- RLS manual checklist passes with two users
- `npm run lint` and `npm run build` pass after types added
- README documents migration workflow instead of auth-only baseline
