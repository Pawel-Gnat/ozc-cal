# Auth & Project Lifecycle (S-01) — Plan Brief

> Full plan: `context/changes/auth-and-project-lifecycle/plan.md`

## What & Why

Deliver roadmap slice S-01: users register/login, create a project by name, and return to a saved project to continue work (FR-001, FR-002, FR-003). This is the first user-visible persistence flow after F-01 laid down the `projects` table with owner-scoped RLS.

## Starting Point

Auth works (Supabase SSR, signin/signup/signout, middleware) but only `/dashboard` is protected and it's a placeholder. F-01 shipped `projects` schema + RLS + TypeScript types; zero application queries exist. Sign-in redirects to `/` instead of a project hub.

## Desired End State

After sign-in, users land on `/dashboard` with their project list (or empty-state CTA). A modal creates a project by name and redirects to `/projects/[id]` — a placeholder shell for FR-003 until S-02 adds building parameters. Invalid project URLs redirect back to the dashboard with an error. Middleware protects `/dashboard`, `/projects`, and `/api/projects`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Project hub | Dashboard as hub | Reuses existing protected route; minimal new routing | Plan |
| Post-login redirect | `/dashboard` | Logged-in users see their work immediately | Plan |
| Create UX | Modal on dashboard | User preference; shadcn Dialog + form POST pattern | Plan |
| Project reopen (FR-003) | `/projects/[id]` placeholder shell | Real bookmarkable URL; S-02 replaces placeholder content | Plan |
| Rename projects | Out of scope | Roadmap outcome is create + list + reopen only | Plan |
| Route protection | `/dashboard` + `/projects` + `/api/projects` | Belt-and-suspenders per user choice; matches AGENTS.md | Plan |
| API validation | Zod on create API | AGENTS.md convention; first validated API route | Plan |
| Not-found project | Redirect to dashboard with error | Consistent with auth error redirect pattern | Plan |
| Return URL after auth | Not in scope | Post-login always goes to dashboard | Plan |

## Scope

**In scope:** Zod dependency, shadcn Dialog, projects service, create API, dashboard list + modal, project detail placeholder, middleware extension, sign-in redirect to dashboard, manual FR-001–003 verification

**Out of scope:** Rename/delete, return URL, password reset, email verification, climate/assemblies/editor (S-02+), new migrations, auth route Zod refactor, automated tests

## Architecture / Approach

```
Sign-in → /dashboard (hub: list + create modal)
              ↓ POST /api/projects (Zod + owner_id)
         /projects/[id] (placeholder shell, FR-003)
              ↑ RLS enforces owner-only access
         projects table (F-01)
```

SSR Astro pages fetch via cookie-bound Supabase client in frontmatter. Mutations use HTML form POST → API redirect (same as auth). React islands only where interactivity is needed (modal, client validation).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Foundation & route protection | zod, Dialog, projects service, PROTECTED_ROUTES | Forgetting `prerender = false` on new routes |
| 2. Create project flow | POST API + create modal + redirect to detail | Modal + form POST redirect timing |
| 3. Hub & project detail | Dashboard list, detail placeholder, not-found handling | RLS edge cases surfacing as generic "not found" |
| 4. Auth UX polish | Sign-in → dashboard, E2E manual checklist | Regression in existing auth flows |

**Prerequisites:** F-01 applied (local + remote Supabase), `.env` with `SUPABASE_URL` / `SUPABASE_KEY`, local Supabase running for dev
**Estimated effort:** ~2–3 sessions across 4 phases

## Open Risks & Assumptions

- Create API must pass `owner_id: user.id` — RLS rejects owner hijacking attempts
- `/api/projects` middleware redirect on unauthenticated POST is acceptable for form-based clients
- UI remains English like existing auth pages (Polish product, English dev starter strings)
- No pagination until project counts grow beyond MVP expectations

## Success Criteria (Summary)

- User can register, sign in, and land on dashboard with project list
- User can create a project by name via modal and reopen it from the list
- Another user's project is inaccessible (RLS + redirect)
- `npm run lint` and `npm run build` pass
