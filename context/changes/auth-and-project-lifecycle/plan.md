# Auth & Project Lifecycle (S-01) Implementation Plan

## Overview

Deliver roadmap slice S-01: authenticated users can register/login (FR-001, largely existing), create a project by name (FR-002), and return to a saved project to continue work (FR-003). Builds on F-01 (`projects` table + owner-scoped RLS + `src/types.ts`) without new migrations.

## Current State Analysis

F-01 shipped the persistence layer. The application layer has no project queries yet.

- **Auth:** Supabase SSR client (`src/lib/supabase.ts`), middleware resolves `context.locals.user`, signin/signup/signout API routes and pages exist. Only `/dashboard` is in `PROTECTED_ROUTES` (`src/middleware.ts:4`).
- **Post-login UX:** Sign-in redirects to `/` (`src/pages/api/auth/signin.ts:19`), not the project hub.
- **Dashboard:** Placeholder welcome page — no project list or create UI (`src/pages/dashboard.astro`).
- **Projects schema:** `id`, `name`, `owner_id`, `created_at`, `updated_at` with SELECT/INSERT/UPDATE RLS (`supabase/migrations/20260528120000_create_projects.sql`). No DELETE policy.
- **Types:** `Project`, `ProjectInsert`, `ProjectUpdate` in `src/types.ts`.
- **Conventions gap:** No `zod` dependency; no shadcn Dialog; no `export const prerender = false` on routes yet (AGENTS.md requires it on all SSR routes).

## Desired End State

A logged-in user lands on `/dashboard` after sign-in, sees their projects (or an empty-state CTA), opens a modal to create a project by name, and is redirected to `/projects/[id]` — a placeholder shell showing the project name and a “continue work” section ready for S-02. Opening another user's project ID (or a non-existent ID) redirects to `/dashboard` with an error message. RLS remains the authorization boundary; middleware protects `/dashboard`, `/projects`, and `/api/projects`.

### Key Discoveries:

- INSERT contract: pass `{ name, owner_id: user.id }` — RLS rejects mismatched `owner_id` (`supabase/migrations/20260528120000_create_projects.sql:1-2`).
- Auth UI pattern: React island + HTML `form method="POST"` + API redirect (`src/components/auth/SignInForm.tsx:42-43`).
- F-01 explicitly deferred CRUD, UI, and `PROTECTED_ROUTES` extension to S-01 (`context/changes/project-schema-rls/plan-brief.md`).

## What We're NOT Doing

- Project rename (UPDATE) — deferred; F-01 UPDATE policy exists for a future slice
- Project delete — no DELETE RLS policy; PRD does not require it in MVP
- Return URL (`?redirect=`) after auth — post-login always goes to `/dashboard`
- Password reset or email verification flows — out of MVP scope per PRD Access Control
- Climate/assemblies/editor content on project detail — S-02+ slices
- New database migrations or schema changes
- Refactoring existing auth routes to Zod (only new project API uses Zod)
- Adding a test runner

## Implementation Approach

Extend existing auth patterns rather than introducing new architecture. Add a thin `src/lib/services/projects.ts` for Supabase queries, Zod validation on the create API only, shadcn Dialog for the create modal, and SSR data fetching in Astro frontmatter for the dashboard list and project detail. Middleware prefix-matching protects page and API routes under `/dashboard`, `/projects`, and `/api/projects`.

## Critical Implementation Details

Middleware `startsWith` matching on `/api/projects` redirects unauthenticated POST requests to `/auth/signin` before the handler runs — consistent with page protection. API handlers must still verify `context.locals.user` as defense-in-depth when Supabase is configured but session is invalid mid-request.

The create modal uses a standard HTML form POST to `/api/projects` (same pattern as auth forms). Successful create redirects to `/projects/[id]`; the browser navigation closes the modal naturally — no client-side fetch required.

## Phase 1: Foundation & Route Protection

### Overview

Add dependencies, shared project service, validation schema, and extend middleware/route conventions so later phases have a stable base.

### Changes Required:

#### 1. Zod dependency

**File**: `package.json`

**Intent**: Add `zod` for server-side validation on the project create API per AGENTS.md convention.

**Contract**: New runtime dependency `zod` (latest compatible semver); lockfile updated via `npm install`.

#### 2. shadcn Dialog component

**File**: `src/components/ui/dialog.tsx` (via CLI)

**Intent**: Provide accessible modal primitives for the create-project dialog.

**Contract**: Run `npx shadcn@latest add dialog` per `components.json`; component importable as `@/components/ui/dialog`.

#### 3. Project name validation schema

**File**: `src/lib/validation/project.ts`

**Intent**: Centralize create-project input rules shared by the API route.

**Contract**: Export a Zod schema for `{ name: string }` — trimmed, min length 1, max length 120 (reasonable UI/DB limit for `text` column). Export `projectIdSchema` as `z.string().uuid()` for route param validation in Phase 3.

#### 4. Projects service

**File**: `src/lib/services/projects.ts`

**Intent**: Extract Supabase `.from('projects')` queries so pages and API routes stay thin.

**Contract**: Functions accepting a Supabase server client + user id:
- `listProjects(supabase)` — `select('*').order('updated_at', { ascending: false })`
- `getProjectById(supabase, id)` — `select('*').eq('id', id).maybeSingle()` (RLS filters by owner)
- `createProject(supabase, { name, owner_id })` — `insert(...).select().single()`

Return typed `Project` / `Project[]` using `src/types.ts`.

#### 5. Middleware route protection

**File**: `src/middleware.ts`

**Intent**: Protect project pages and API from unauthenticated access without page-level auth bypass.

**Contract**: `PROTECTED_ROUTES` includes `"/dashboard"`, `"/projects"`, `"/api/projects"`. Existing `startsWith` matching applies.

#### 6. SSR prerender exports

**Files**: All new pages and API routes created in this change **and** all existing SSR routes

**Intent**: Comply with AGENTS.md SSR requirement project-wide, not only on new files.

**Contract**: Each `src/pages/**` and `src/pages/api/**` file exports `export const prerender = false`. Retrofit existing routes: `index.astro`, `dashboard.astro`, `auth/signin.astro`, `auth/signup.astro`, `auth/confirm-email.astro`, `api/auth/signin.ts`, `api/auth/signup.ts`, `api/auth/signout.ts`, plus any new routes added in later phases.

### Success Criteria:

#### Automated Verification:

- Dependencies install cleanly: `npm install`
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Unauthenticated request to a protected path redirects to `/auth/signin`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Create Project Flow

### Overview

Implement Zod-validated project creation API and a dashboard modal form. Successful create redirects to the new project's detail page.

### Changes Required:

#### 1. Create project API route

**File**: `src/pages/api/projects/index.ts`

**Intent**: Handle POST create-by-name; enforce auth, validate input, insert with correct `owner_id`, redirect on success/error.

**Contract**:
- `export const prerender = false`
- `POST` handler: require `context.locals.user` and configured Supabase client; otherwise redirect to `/auth/signin` or `/dashboard?error=...`
- Parse `formData`, validate with Zod schema from `src/lib/validation/project.ts`
- On validation failure: redirect `/dashboard?error=<message>`
- On insert success: redirect `/projects/<id>`
- On Supabase error: redirect `/dashboard?error=<message>`
- Call `createProject` with `{ name, owner_id: user.id }`

#### 2. Create project dialog component

**File**: `src/components/projects/CreateProjectDialog.tsx`

**Intent**: Modal UI for FR-002 — user enters project name and submits.

**Contract**:
- React island using shadcn Dialog + existing auth patterns (`FormField`, `SubmitButton`, `ServerError` where applicable)
- Trigger button (e.g. “New project”) opens dialog
- Form: `method="POST"` `action="/api/projects"` with client-side validation (non-empty trimmed name) before submit
- `noValidate` + `onSubmit` guard matching `SignInForm.tsx` pattern
- Cosmic theme styling consistent with dashboard/auth (`cn()`, purple accents)

#### 3. Dashboard wiring (partial)

**File**: `src/pages/dashboard.astro`

**Intent**: Mount the create dialog on the hub page.

**Contract**: Import and render `CreateProjectDialog` with `client:load`. Full project list added in Phase 3 — this phase only ensures the modal trigger is visible on dashboard.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Logged-in user opens modal, submits valid name → lands on `/projects/[id]`
- Empty name blocked client-side; server rejects whitespace-only name with dashboard error
- Unauthenticated POST to `/api/projects` redirects to sign-in (via middleware)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Hub & Project Detail

### Overview

Turn dashboard into the project hub with a list of saved projects. Add `/projects/[id]` placeholder shell for FR-003 reopen. Handle missing/forbidden projects.

### Changes Required:

#### 1. Dashboard project hub

**File**: `src/pages/dashboard.astro`

**Intent**: FR-002/003 hub — list owner projects, empty state, link each row to detail, show server errors from query param.

**Contract**:
- `export const prerender = false`
- Frontmatter: `createClient` + `listProjects`; handle Supabase-unconfigured gracefully (reuse config banner pattern from `Layout.astro` / `config-status.ts`)
- Display `?error=` from URL as dismissible or visible error banner
- Project list: name, relative or formatted `updated_at`, link to `/projects/[id]`
- Empty state: prompt + “New project” emphasis (dialog trigger)
- Keep sign-out control; show user email
- Render `Topbar` with `user` from `Astro.locals` for consistent nav with public pages
- Optional: extract list UI to `src/components/projects/ProjectList.tsx` if interactivity needed; SSR-only list is acceptable

#### 2. Project detail placeholder page

**File**: `src/pages/projects/[id].astro`

**Intent**: FR-003 destination — user reopens a saved project and sees a shell ready for S-02 content.

**Contract**:
- `export const prerender = false`
- Frontmatter: validate `Astro.params.id` with `projectIdSchema` from `src/lib/validation/project.ts`; on parse failure redirect `/dashboard?error=Project not found` without querying Supabase
- Fetch via `getProjectById` only after UUID validation passes
- If no row returned (wrong owner, deleted user cascade): redirect `/dashboard?error=Project not found`
- Render: project name as heading, `created_at` / `updated_at`, placeholder section (e.g. “Building parameters — coming in next step”) with link back to dashboard
- Render `Topbar` with `user` from `Astro.locals`
- Breadcrumb or back link to `/dashboard`

#### 3. Topbar navigation

**File**: `src/components/Topbar.astro`

**Intent**: Ensure logged-in navigation is consistent across hub and detail pages.

**Contract**: Import `Topbar` on `dashboard.astro` and `projects/[id].astro` with `user={Astro.locals.user}`. Existing `/dashboard` link in Topbar remains the hub entry point.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Dashboard lists multiple projects newest-first after creating several
- Empty dashboard shows empty-state CTA
- Clicking a project opens detail placeholder with correct name
- Navigating to `/projects/<malformed-id>` redirects to dashboard with error
- Navigating to `/projects/<valid-uuid-not-owned>` redirects to dashboard with error
- User B cannot view User A's project URL (RLS + redirect behavior)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Auth UX Polish & E2E Verification

### Overview

Redirect successful sign-in to the project hub and run end-to-end manual verification of FR-001 through FR-003.

### Changes Required:

#### 1. Post-login redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: After successful sign-in, send users directly to the project hub.

**Contract**: Change success redirect from `/` to `/dashboard` (line ~19).

#### 2. Optional signup success path review

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Confirm signup flow still makes sense (redirects to confirm-email per PRD no-verification MVP). No change required unless signup should also land on dashboard after first login — out of scope unless broken.

**Contract**: Document in manual test checklist only; code change not expected.

#### 3. README documentation update

**File**: `README.md`

**Intent**: Keep auth/protected-routes documentation accurate after S-01 extends middleware coverage.

**Contract**: Update auth routes table to include `/projects`, `/projects/[id]`, and `POST /api/projects`; note that `PROTECTED_ROUTES` in `src/middleware.ts` covers `/dashboard`, `/projects`, and `/api/projects`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- FR-001: Register new account, sign in, sign out — all work
- FR-001: Sign-in success lands on `/dashboard`
- FR-002: Create project by name via modal from dashboard
- FR-003: Sign out, sign back in, dashboard shows project; click through to detail placeholder
- Protected routes: logged-out access to `/dashboard`, `/projects/*`, POST `/api/projects` → sign-in redirect
- Two-user isolation: User B sees empty list / cannot open User A's project

**Implementation Note**: This phase completes S-01. All manual checks constitute acceptance of the slice.

---

## Testing Strategy

### Unit Tests:

- Not in scope — no test runner configured per AGENTS.md

### Integration Tests:

- Not in scope for this slice

### Manual Testing Steps:

1. Start local Supabase (`npx supabase start`) and dev server (`npm run dev`) with `.env` configured
2. Register User A, create project “Dom Jednorodzinny”, verify redirect to detail page
3. Return to dashboard — project appears in list
4. Register User B in separate browser/incognito — dashboard empty; User A's project URL redirects with error
5. Submit create form with empty/whitespace name — blocked or rejected with error
6. Sign out, hit `/dashboard` — redirected to sign-in; sign in — lands on dashboard with projects intact

## Performance Considerations

Project list query is a single indexed SELECT on `owner_id` (F-01 index). Expected volume is small (MVP single-user projects). No pagination needed in S-01.

## Migration Notes

No new migrations. Assumes F-01 migration applied locally and on remote Supabase. If `projects` table missing, run `npx supabase db reset` locally or `npx supabase db push` for remote before testing.

## References

- Roadmap S-01: `context/foundation/roadmap.md`
- PRD FR-001–003, Access Control: `context/foundation/prd.md`
- F-01 plan brief: `context/changes/project-schema-rls/plan-brief.md`
- Projects migration: `supabase/migrations/20260528120000_create_projects.sql`
- Auth form pattern: `src/components/auth/SignInForm.tsx`
- Middleware: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Foundation & Route Protection

#### Automated

- [x] 1.1 Dependencies install cleanly: `npm install` — 3917da4
- [x] 1.2 Linting passes: `npm run lint` — 3917da4
- [x] 1.3 Production build passes: `npm run build` — 3917da4

#### Manual

- [x] 1.4 Unauthenticated request to a protected path redirects to `/auth/signin` — 3917da4

### Phase 2: Create Project Flow

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — a315032
- [x] 2.2 Production build passes: `npm run build` — a315032

#### Manual

- [x] 2.3 Logged-in user creates project via modal and lands on `/projects/[id]` — a315032
- [x] 2.4 Empty or whitespace-only name rejected; unauthenticated POST redirects to sign-in — a315032

### Phase 3: Hub & Project Detail

#### Automated

- [x] 3.1 Linting passes: `npm run lint`
- [x] 3.2 Production build passes: `npm run build`

#### Manual

- [x] 3.3 Dashboard lists projects and shows empty state
- [x] 3.4 Project detail placeholder renders; invalid/forbidden ID redirects with error
- [x] 3.5 Two-user RLS isolation verified manually

### Phase 4: Auth UX Polish & E2E Verification

#### Automated

- [ ] 4.1 Linting passes: `npm run lint`
- [ ] 4.2 Production build passes: `npm run build`

#### Manual

- [ ] 4.3 FR-001 through FR-003 end-to-end manual checklist passes
