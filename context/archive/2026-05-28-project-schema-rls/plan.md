# Project Schema & RLS Implementation Plan

## Overview

Add the first application table (`projects`) to Supabase with owner-scoped Row Level Security. This foundation (roadmap F-01) enables project persistence required by FR-002/FR-003 and unlocks S-01 (`auth-and-project-lifecycle`), F-02, and F-03. Scope is migration + TypeScript types + docs only — no CRUD API or UI.

## Current State Analysis

- Supabase Auth works via `@supabase/ssr` (`src/lib/supabase.ts`) and middleware resolves `context.locals.user` (`src/middleware.ts`).
- `supabase/config.toml` exists with migrations enabled, but **`supabase/migrations/` is empty** — no app tables.
- README still states auth-only (`auth.users`); no `.from()` database queries in `src/`.
- No `src/types.ts` yet; user typing lives in `src/env.d.ts`.

## Desired End State

A `projects` table exists in Postgres with RLS enforcing that authenticated users can only SELECT, INSERT, and UPDATE their own rows. Manual verification via **psql with JWT impersonation** (`authenticated` role + `request.jwt.claim.sub`) confirms cross-user isolation — not the default Studio SQL editor (runs as `postgres` and bypasses RLS). A hand-written `Project` type in `src/types.ts` matches the schema for downstream slices.

### Key Discoveries:

- Migration convention: `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`; RLS required on every new table (`AGENTS.md`).
- `owner_id` enforced via RLS `WITH CHECK (owner_id = auth.uid())` on INSERT — no trigger.
- F-01 deliberately excludes DELETE, seed data, generated types, and application CRUD.

## What We're NOT Doing

- Project CRUD API routes or UI (S-01: `auth-and-project-lifecycle`)
- Climate, assemblies, ventilation, geometry, or calculation tables (S-02+)
- `seed.sql` or fixture data
- `supabase gen types` / generated database types
- DELETE policy or soft-delete column
- UNIQUE constraint on `(owner_id, name)`
- Extending `PROTECTED_ROUTES` or middleware changes

## Implementation Approach

Single forward migration creates `projects` with UUID primary key, foreign key to `auth.users`, and timestamp columns. RLS enabled with three policies (SELECT, INSERT, UPDATE) scoped to `owner_id = auth.uid()`. Manual types added to `src/types.ts`. README updated to document migration workflow. RLS verified manually with two test users in local Supabase Studio.

## Critical Implementation Details

**RLS INSERT contract:** Application code in S-01 must pass `owner_id: user.id` on insert; RLS rejects mismatched values. Document this in the migration comment or README so S-01 implementer does not omit the field.

**No DELETE policy:** Postgres default denies DELETE for authenticated role when no policy exists — intentional for F-01.

## Phase 1: Supabase migration

### Overview

Create `projects` table and owner-scoped RLS policies.

### Changes Required:

#### 1. Initial migration

**File**: `supabase/migrations/<timestamp>_create_projects.sql`

**Intent**: Define the persistent project shell required by FR-002/003 with owner-only access per PRD Access Control and NFR privacy.

**Contract**:

- Table `public.projects`:
  - `id` — `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `name` — `text NOT NULL` (no uniqueness constraint)
  - `owner_id` — `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `created_at` — `timestamptz NOT NULL DEFAULT now()`
  - `updated_at` — `timestamptz NOT NULL DEFAULT now()`
- Index on `owner_id` for list-by-owner queries in S-01
- Trigger function to set `updated_at = now()` on UPDATE (standard pattern)
- `ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY`
- Policies (all `TO authenticated`, `USING` / `WITH CHECK` as noted):
  - **SELECT:** `owner_id = auth.uid()`
  - **INSERT:** `WITH CHECK (owner_id = auth.uid())`
  - **UPDATE:** `USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())`
- No DELETE policy
- `GRANT SELECT, INSERT, UPDATE ON public.projects TO authenticated` (if not already implied by Supabase defaults for public schema)

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset --no-seed` (local Supabase running; `seed.sql` is configured in `config.toml` but absent — avoid seed WARN)
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Table `projects` visible in Supabase Studio after reset
- RLS enabled on `projects`
- Three policies present (SELECT, INSERT, UPDATE); no DELETE policy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: TypeScript types

### Overview

Add a hand-written `Project` type matching the migration schema for downstream slices.

### Changes Required:

#### 1. Shared types file

**File**: `src/types.ts`

**Intent**: Provide a stable TypeScript contract for S-01 and later slices without generated Supabase types.

**Contract**:

- Export `Project` interface with fields: `id`, `name`, `owner_id`, `created_at`, `updated_at` (string ISO timestamps or `Date` — match how Supabase client returns them; prefer `string` for JSON serialization consistency)
- Export `ProjectInsert` type: `Pick<Project, 'name' | 'owner_id'>` or `{ name: string; owner_id: string }`
- Export `ProjectUpdate` type: `Pick<Project, 'name'>` partial optional for future rename in S-01

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npm run build` (via `@astrojs/check` in build pipeline)

#### Manual Verification:

- Field names and types match migration column names exactly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Documentation

### Overview

Update README so contributors know app tables exist and how to apply migrations locally.

### Changes Required:

#### 1. README Supabase section

**File**: `README.md`

**Intent**: Replace the "auth only / no migrations required" statement with accurate F-01 guidance.

**Contract**:

- Update the Supabase Configuration section (~line 114) to state that `projects` table migration exists under `supabase/migrations/`
- Replace the `npx supabase init` step (~line 87–90): `supabase/config.toml` already exists — document skip-init workflow (`npx supabase start` only for first-time local DB)
- Document local workflow: `npx supabase start`, `npx supabase db reset --no-seed` after pulling new migrations
- Note that remote/production migrations are applied via Supabase dashboard or CLI (`supabase db push`) — no CI migration step in this change
- Mention RLS owner-only model in one sentence
- Add a one-line follow-up note: after F-01 ships, update stale baseline lines in `context/foundation/roadmap.md` (~line 56) and `context/deployment/deploy-plan.md` (~215, 341) — out of scope for code in this change, do at archive or immediately after manual Phase 4 passes

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`

#### Manual Verification:

- README accurately describes current schema state (not auth-only)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: RLS manual verification

### Overview

Confirm cross-user isolation before marking F-01 complete. No automated RLS tests in this change.

### Changes Required:

#### 1. Manual test procedure (document in plan only — no new files required)

**Intent**: Verify RLS policies behave as designed before S-01 builds CRUD on top.

**Contract** — execute in **local `psql`** (not the default Studio SQL editor — it runs as `postgres` and bypasses RLS). Obtain User A and User B UUIDs from `auth.users` in Studio Table Editor after signup.

Before each block of SQL below, start a transaction and impersonate the user:

```sql
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '<user_uuid>';
-- ... statements ...
ROLLBACK; -- or COMMIT only for intentional persistence during dev
```

1. Create User A and User B via app signup (`/auth/signup`) or Studio Auth
2. As User A: `INSERT INTO public.projects (name, owner_id) VALUES ('Test A', '<user_a_uuid>');` — succeeds
3. As User A: `SELECT * FROM public.projects;` — returns the row
4. As User B: `SELECT * FROM public.projects;` — zero rows for User A's project
5. As User B: `INSERT INTO public.projects (name, owner_id) VALUES ('Hijack', '<user_a_uuid>');` — fails (RLS violation)
6. As User A: `UPDATE public.projects SET name = 'Renamed' WHERE id = '<project_id>';` — succeeds; `UPDATE ... SET owner_id = '<user_b_uuid>'` — fails
7. As User A: `DELETE FROM public.projects WHERE id = '<project_id>';` — fails (no DELETE policy)

**psql connection (local):** `npx supabase status` prints `DB URL`; or `postgresql://postgres:postgres@127.0.0.1:54322/postgres` per default local stack.

### Success Criteria:

#### Automated Verification:

- (none — manual-only phase)

#### Manual Verification:

- All seven steps above pass
- Second user cannot read or hijack first user's project

**Implementation Note**: This phase is the definition of done for F-01. Archive after `/10x-implement` completes all prior phases and this checklist passes.

---

## Testing Strategy

### Unit Tests:

- Not in scope — no test runner configured per AGENTS.md

### Integration Tests:

- Not in scope — RLS verified manually in Phase 4

### Manual Testing Steps:

1. `npx supabase start` (if not running)
2. `npx supabase db reset --no-seed`
3. Run Phase 4 RLS checklist with two users
4. `npm run lint && npm run build`

## Performance Considerations

- Index on `owner_id` supports list queries in S-01; expected volume is small (PRD: small data volume)
- No additional optimization needed for F-01

## Migration Notes

- First migration in repo — all environments need `supabase db reset` (local) or equivalent push (remote) before S-01 development
- `ON DELETE CASCADE` on `owner_id` removes projects if auth user deleted — acceptable for MVP single-tenant model
- Do not add `seed.sql` in this change (config references it but file absent — leave unchanged or add empty comment in README only)

## References

- Roadmap F-01: `context/foundation/roadmap.md`
- PRD Access Control, FR-002, FR-003, NFR privacy: `context/foundation/prd.md`
- Supabase client: `src/lib/supabase.ts`
- Migration convention: `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Supabase migration

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset --no-seed` — e6c4788
- [x] 1.2 Linting passes: `npm run lint` — e6c4788
- [x] 1.3 Production build passes: `npm run build` — e6c4788

#### Manual

- [x] 1.4 Table `projects` visible in Supabase Studio after reset — e6c4788
- [x] 1.5 RLS enabled on `projects` — e6c4788
- [x] 1.6 Three policies present (SELECT, INSERT, UPDATE); no DELETE policy — e6c4788

### Phase 2: TypeScript types

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — c467d4b
- [x] 2.2 Type checking passes: `npm run build` — c467d4b

#### Manual

- [x] 2.3 Field names and types match migration column names exactly — c467d4b

### Phase 3: Documentation

#### Automated

- [x] 3.1 Linting passes: `npm run lint` — 22bcc4f

#### Manual

- [x] 3.2 README accurately describes current schema state — 22bcc4f

### Phase 4: RLS manual verification

#### Manual

- [x] 4.1 RLS isolation checklist (7 steps) passes with two test users — 078d663
