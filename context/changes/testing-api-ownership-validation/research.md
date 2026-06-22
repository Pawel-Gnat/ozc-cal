---
date: 2026-06-22T20:56:05+02:00
researcher: Cursor Agent
git_commit: 34c29e0a5e480da09a0c3dccd846d546f09fcea1
branch: main
repository: ozc-cal
topic: "Test-plan Phase 3 — API ownership isolation and server-side editor validation parity (risk #5)"
tags: [research, integration, test-plan, risk-5, api, rls, validation, editor, vitest]
status: complete
last_updated: 2026-06-22
last_updated_by: Cursor Agent
---

# Research: API ownership and validation (Phase 3)

**Date**: 2026-06-22  
**Researcher**: Cursor Agent  
**Git Commit**: 34c29e0a5e480da09a0c3dccd846d546f09fcea1  
**Branch**: main  
**Repository**: ozc-cal

## Research Question

Ground test-plan Phase 3 (`API ownership & validation`): where do cross-account
isolation and server-side editor validation live, what is already covered by E2E
smoke, and what integration tests should prove for risk #5?

## Summary

**Ownership** is enforced primarily by **Supabase RLS** (`owner_id = auth.uid()`
on `projects` and join-based policies on child tables). Application code does not
compare `owner_id` explicitly — `getProjectById` returns `null` for invisible rows,
and shared helpers map that to **404 JSON** (`resolveProjectApiContext`) or
**redirect to “Project not found”** (`resolveProjectRouteContext`). All eight
project-scoped API handlers use one of these helpers except `POST /api/projects`
(manual auth).

**E2E smoke (Phase 5)** covers unauthenticated dashboard redirect and one foreign
UUID path (`GET /api/projects/:id/editor` → 404). It does **not** replace Phase 3:
no mutation matrix, no two-user fixture with a real foreign-owned project, no
validation parity tests.

**Validation parity** splits across three layers: Zod (`editorStateSchema` in
`src/lib/validation/editor.ts`), service (`assertAssemblyIdsBelongToProject` in
`project-editor.ts`), and RPC (`replace_editor_state` geometry-wipe guard). The
client mirrors geometry/temp/scale rules in React but never runs Zod before PUT.
Integration tests should hit **server-only rules** via raw API payloads.

**Recommended approach:** Vitest integration at the service/API-helper boundary —
real Zod schemas, mocked Supabase/`getProjectById`, synthetic two-user fixtures
on `context.locals.user`. Colocate tests next to helpers and validation modules.
Optional tier-3: local Supabase two-user RLS regression (one file, not default CI).

## Risk response verification

### Risk #5 — IDOR / cross-account access

| Test-plan cell | Research verdict |
| --- | --- |
| Prove | User A cannot GET/PUT project B's editor, floor plan, climate, assemblies, calc | **Not proven** — E2E covers page + GET editor only; integration matrix needed |
| Must challenge | "Middleware redirect" ≠ owner isolation | Middleware + RLS + helpers form defense-in-depth; helpers must be tested per endpoint |
| Cheapest layer | integration (two-user fixture or mocked auth) | **Confirmed** — E2E is supplementary smoke |
| Anti-pattern | Happy-path owner only | Avoid — matrix must include foreign id + mutations |

## Detailed Findings

### API endpoint inventory

| Route | Methods | Resolver | Unauth | Foreign / missing project |
| --- | --- | --- | --- | --- |
| `/api/projects` | POST | manual `locals.user` | 302 signin (middleware) | N/A (creates for self) |
| `/api/projects/[id]/editor` | GET, PUT | `resolveProjectApiContext` | 401 JSON | 404 `NOT_FOUND` |
| `/api/projects/[id]/calc` | POST | `resolveProjectApiContext` | 401 JSON | 404 `NOT_FOUND` |
| `/api/projects/[id]/floor-plan/data` | GET | `resolveProjectApiContext` | 401 JSON | 404 `NOT_FOUND` |
| `/api/projects/[id]/climate` | POST | `resolveProjectRouteContext` | 302 signin | 302 dashboard not-found |
| `/api/projects/[id]/floor-plan` | GET, POST | `resolveProjectRouteContext` | 302 signin | 302 dashboard not-found |
| `/api/projects/[id]/assemblies` | POST | `resolveProjectRouteContext` | 302 signin | 302 dashboard not-found |
| `/api/projects/[id]/assemblies/[assemblyId]` | POST | `resolveProjectRouteContext` + `assembly.project_id` check | 302 signin | 302 not-found |

**Middleware nuance:** nested `/api/projects/{id}/…` returns **401 JSON** when
unauthenticated; exact `/api/projects` (create) returns **302** signin
(`middleware.ts:20-27`).

### Ownership resolution flow

```
middleware → locals.user
     ↓
resolveProjectApiContext / resolveProjectRouteContext
     ↓
createClient(cookies) → Supabase with user JWT
     ↓
getProjectById(id) → null if RLS hides row
     ↓
404 JSON or redirect NOT_FOUND
```

Key files:

- `src/lib/api/project-route-helpers.ts:60-116` — JSON resolver
- `src/lib/api/project-route-helpers.ts:118-161` — redirect resolver
- `src/lib/services/projects.ts:14-27` — no explicit owner filter
- `src/middleware.ts:4-28` — `PROTECTED_ROUTES`, unauth split

### RLS policy summary

| Table | Pattern |
| --- | --- |
| `projects` | `owner_id = auth.uid()` — SELECT/INSERT/UPDATE only (no DELETE) |
| `assemblies`, `assembly_layers` | join to `projects.owner_id` |
| `plan_nodes`, `plan_segments`, `plan_rooms`, `plan_room_segments` | join to `projects.owner_id` |
| `storage.objects` (bucket `floor-plans`) | path prefix UUID ∈ owned project ids |

RPCs `replace_assembly_with_layers` and `replace_editor_state` are
`security invoker` — RLS applies to the caller.

**Historical note:** `20260603150000_fix_floor_plan_storage_rls_name_shadow.sql`
fixed storage policies that shadowed `storage.objects.name` with `projects.name`.
Worth a regression test that User A cannot read `{B_project_id}/…` objects.

### Server-side editor validation

**Zod** (`src/lib/validation/editor.ts`):

- UUID ids; scale `known_length_m` / `meters_per_unit` > 0
- Room temp 5–35°C; name ≤ 120 chars; ≥ 3 segments per room
- Caps: 500 nodes, 1000 segments, 100 rooms
- `superRefine`: unique ids, node refs, orthogonal segments, closed chains,
  one-room-per-segment

**Service** (`src/lib/services/project-editor.ts:179-213`):

- `assertAssemblyIdsBelongToProject` — foreign `assembly_id` → 400
  `"assemblies do not belong"` (no `issues` array)

**RPC** (`20260609180000_replace_editor_state_rpc.sql:49-58`):

- Blocks empty geometry PUT when DB already has rows (currently surfaces as **500**
  if RPC error not mapped in `editor.ts:78-90`)

**Client:** mirrors geometry/temp/scale in React; does **not** run
`editorStateSchema` before PUT (`useEditorState.ts:111-122`).

Archive F7 (`context/archive/2026-06-08-pdf-floor-plan-editor/reviews/impl-review.md:91-99`):
planned Zod `superRefine` for assembly ownership; implemented in service layer
instead — intentional split.

### Error shapes (JSON routes)

| Condition | Status | Code | `issues` |
| --- | --- | --- | --- |
| No session | 401 | `UNAUTHORIZED` | — |
| Bad UUID / not owner | 404 | `NOT_FOUND` | — |
| Wrong origin (PUT) | 403 | `FORBIDDEN` | — |
| Editor not ready | 422 | `PRECONDITION_FAILED` | — |
| Zod failure | 400 | `VALIDATION_ERROR` | Yes |
| Foreign assembly_id | 400 | `VALIDATION_ERROR` | No |
| RPC / DB failure | 500 | `INTERNAL_ERROR` | — |

### Existing test coverage

| Layer | Coverage |
| --- | --- |
| E2E (`e2e/risk-5-protected-project-access.test.ts`) | Unauth dashboard; foreign page alert; GET editor 404 |
| Vitest integration | **None** — §6.2 / §6.3 TBD |
| Vitest unit | Thermal only (`src/lib/thermal/*.test.ts`) |

E2E uses synthetic UUID `00000000-0000-4000-8000-000000000001` — valid format,
non-owned — same 404 path as real foreign project but not a two-user proof.

### Recommended integration test tiers

**Tier 1 — highest signal, start here**

1. `src/lib/api/project-route-helpers.test.ts` — matrix for both resolvers:
   no user → 401/redirect signin; bad UUID → 404/NOT_FOUND redirect;
   `getProjectById` returns null → 404/NOT_FOUND; success path.
2. `src/lib/validation/editor.test.ts` — real `editorStateSchema`: bad UUID,
   duplicate ids, non-orthogonal segment, open room chain, array caps, temp range.
3. Middleware unit test — unauth nested `/api/projects/x` → 401 JSON
   (`middleware.ts:20-24`).

**Tier 2 — route handler wiring**

Import `GET`/`PUT` from `editor.ts`, `POST` from `calc.ts`; fake `APIContext`
with `Origin` header; mock `getEditorState` / `replaceEditorState`. Assert
status/body for foreign project + invalid payloads.

**Tier 3 — optional RLS proof**

Local Supabase, User A / User B seeded; direct SELECT/INSERT on foreign rows
blocked; `replace_editor_state(B_id, …)` fails. Keep out of default CI until
Phase 4 gate unless explicitly desired.

### Two-user fixture pattern

```typescript
const userA = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "a@test.local" };
const userB = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "b@test.local" };

// User A + project owned by B → mock getProjectById → null (RLS simulation)
// expect resolveProjectApiContext → 404 NOT_FOUND
```

Mock strategy per test-plan §4: `vi.mock("@/lib/supabase")` or
`vi.mock("@/lib/services/projects")`; real Zod; fake `locals.user`.

### Endpoint matrix for Phase 3 plan

| Endpoint | Method | Integration must assert |
| --- | --- | --- |
| `…/editor` | GET, PUT | 404 foreign; PUT validation + foreign assembly |
| `…/calc` | POST | 404 foreign; 401 unauth |
| `…/floor-plan/data` | GET | 404 foreign |
| `…/climate` | POST | redirect NOT_FOUND |
| `…/assemblies` | POST | redirect NOT_FOUND |
| `…/assemblies/:id` | POST | redirect NOT_FOUND |
| `…/floor-plan` | GET, POST | redirect NOT_FOUND |
| Middleware | — | 401 JSON on nested `/api/projects/*` |

## Code References

- `src/lib/api/project-route-helpers.ts:60-161` — ownership resolution
- `src/lib/services/projects.ts:14-27` — `getProjectById` (RLS-scoped)
- `src/middleware.ts:4-28` — protected routes, unauth JSON vs redirect
- `src/pages/api/projects/[id]/editor.ts:15-91` — GET/PUT + Zod + service validation
- `src/lib/validation/editor.ts:28-142` — `editorStateSchema`
- `src/lib/services/project-editor.ts:179-213` — assembly ownership assert
- `supabase/migrations/20260528120000_create_projects.sql:31-48` — projects RLS
- `supabase/migrations/20260608120000_floor_plan_editor.sql:67-315` — editor table RLS
- `e2e/risk-5-protected-project-access.test.ts:5-30` — existing E2E smoke
- `vitest.config.ts:1-9` — Vitest via Astro `getViteConfig`, excludes `e2e/**`

## Architecture Insights

1. **RLS is the real gate; app code is UX.** Integration tests mock
   `getProjectById → null` to simulate RLS without Supabase. Optional RLS tier
   proves the DB contract.
2. **Two resolver transports.** JSON APIs use status codes; form POSTs use
   redirects — tests must assert the correct shape per route.
3. **Validation is layered.** Zod → service ownership → RPC guard. Tests should
   pin each layer's error shape (especially foreign `assembly_id` with no
   `issues` array vs Zod failures with `issues`).
4. **E2E and integration are complementary.** E2E proves one real cross-boundary
   path; integration exhausts the matrix cheaply.

## Historical Context

- `context/changes/testing-e2e-critical-flows-bootstrap/research.md` — Phase 5
  E2E smoke; explicitly defers two-user IDOR matrix to Phase 3.
- `context/archive/2026-06-08-pdf-floor-plan-editor/reviews/impl-review.md:91-99`
  — validation split across Zod, service, RPC (F7).
- `context/foundation/test-plan.md:60,75` — risk #5 proof criteria and Phase 3 goal.

## Related Research

- `context/changes/testing-e2e-critical-flows-bootstrap/research.md` — risk #5
  E2E partial coverage and gaps list.

## Open Questions

1. **RPC geometry-wipe guard:** should failed guard return **422** instead of
   **500**? Integration test should pin current behavior; plan may include fix.
2. **Tier 3 RLS tests:** include in Phase 3 scope or defer to optional local-only?
3. **Calc validation parity:** include `calc-validate.ts` cases in Phase 3 or
   scope editor-only per phase title emphasis on "editor validation parity"?
4. **Vitest env:** confirm `astro:env/server` resolves in test run or add
   `vi.mock("@/lib/supabase")` in setup — verify during `/10x-plan` spike.

## Recommendations for plan

1. **Two workstreams in one phase:** (A) ownership endpoint matrix via
   `project-route-helpers` + thin route tests; (B) `editorStateSchema` +
   editor PUT validation including foreign `assembly_id`.
2. **Do not duplicate E2E** — reference existing smoke; integration fills gaps.
3. **Colocate tests** — `project-route-helpers.test.ts`, `editor.test.ts`,
   optional `__fixtures__/api-context.ts`.
4. **Update test-plan §6.3** when Phase 3 ships with cookbook pattern from this
   research.
5. **Link change folder** in test-plan §3 Phase 3 row when plan is approved.
