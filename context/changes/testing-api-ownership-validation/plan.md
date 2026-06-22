# API Ownership and Validation — Implementation Plan

## Overview

Test-plan Phase 3: add Vitest integration tests for risk **#5** — prove
cross-account isolation at the API helper and editor route layers, plus
server-side **editor** validation parity (Zod + foreign `assembly_id`).
No production behavior changes except what tests document (geometry-wipe
guard stays **500** until a follow-up fix).

E2E smoke (`e2e/risk-5-protected-project-access.test.ts`) already covers
unauth dashboard redirect and `GET /api/projects/:id/editor` → 404. This
plan fills the integration gap without duplicating browser tests.

## Current State Analysis

Research (`research.md`, 2026-06-22) confirms:

- Ownership is enforced by **Supabase RLS**; app code maps invisible rows to
  404/redirect via `getProjectById` → `null` (`project-route-helpers.ts`).
- Eight project-scoped API handlers use shared resolvers; `POST /api/projects`
  uses manual auth.
- JSON routes return status codes; form POST routes return redirects — tests
  must assert the correct transport per resolver, not per duplicated route import
  for every redirect handler.
- Editor validation: `editorStateSchema` (Zod) → `assertAssemblyIdsBelongToProject`
  (service) → `replace_editor_state` RPC guard.
- Vitest runs via Astro `getViteConfig()`; no integration tests exist yet
  (§6.2 / §6.3 TBD). Thermal unit tests colocate `*.test.ts` next to modules.

Planning decisions (user confirmed):

| Decision | Choice |
| --- | --- |
| RLS Tier 3 | Defer — mock `getProjectById → null` only |
| Validation scope | Editor only (no `calc-validate.ts` this phase) |
| Route depth | Tier 1 helpers + middleware + editor GET/PUT routes |
| Geometry-wipe RPC | Pin current **500** behavior in tests |

## Desired End State

After this plan:

- `npm test` includes integration tests for ownership resolution and editor
  validation — all green locally.
- `project-route-helpers.test.ts` covers both resolvers (401/404/redirect/success).
- `middleware.test.ts` covers unauth nested `/api/projects/*` → 401 JSON.
- `editor.test.ts` covers `editorStateSchema` server-only rules.
- `editor.test.ts` (route colocated) or `src/pages/api/projects/[id]/editor.test.ts`
  covers GET/PUT foreign project, Zod `issues`, foreign assembly, geometry-wipe → 500.
- `context/foundation/test-plan.md` §6.3 documents the owner-isolation + validation
  pattern; §3 Phase 3 links this change folder.
- E2E risk #5 spec unchanged — integration complements, does not replace.

### Key Discoveries:

- Mock at service boundary: `vi.mock("@/lib/services/projects")` for
  `getProjectById`; fake `APIContext.locals.user` for two-user scenarios
  (`research.md` two-user fixture pattern).
- Redirect routes (climate, assemblies, floor-plan) inherit ownership from
  shared resolvers — resolver matrix proves them without importing every handler.
- Foreign `assembly_id` returns 400 `VALIDATION_ERROR` **without** `issues`
  array — distinct from Zod failures; tests must pin both shapes.
- `astro:env/server` may require `vi.mock("@/lib/supabase")` in helper tests —
  spike in Phase 1 before bulk test authoring.

## What We're NOT Doing

- Real Supabase two-user RLS tests (Tier 3 — deferred).
- Full import matrix for all eight route handlers (redirect routes covered via
  resolver tests only).
- `calc-validate.ts` / `POST /calc` validation parity.
- Production fix for geometry-wipe **500** → **422** (pinned, not changed).
- New E2E specs or Playwright changes.
- CI gate wiring (test-plan Phase 4).
- AGENTS.md update (deferred with CI gate, same as Phase 1 thermal).

## Implementation Approach

Follow test-plan §4: **real Zod + mocked Supabase at service boundary**. Colocate
tests next to the code they exercise (thermal precedent). Shared fake `APIContext`
and user fixtures live under `src/lib/api/__fixtures__/`.

Phase order: bootstrap fixtures/mocks → ownership helpers + middleware → editor
Zod + route wiring → test-plan cookbook backport.

## Critical Implementation Details

- **Resolver vs route tests:** Redirect-route ownership is proven when
  `resolveProjectRouteContext` returns `{ ok: false, redirect: NOT_FOUND }` for
  `getProjectById → null`. Do not duplicate with climate/assemblies/floor-plan
  handler imports unless a handler adds logic beyond the resolver.
- **Same-origin on PUT:** Editor route tests must set `Origin` matching `baseURL`
  or expect **403** `FORBIDDEN` — mirror `e2e/helpers/project-setup.ts` pattern.
- **Geometry-wipe test:** Mock `replaceEditorState` to throw the RPC error message
  or use a test double that simulates the guard — assert **500** `INTERNAL_ERROR`,
  documenting current behavior per planning decision.

## Phase 1: Integration Test Bootstrap

### Overview

Add shared test fixtures and confirm Vitest can import API helpers with mocked
Supabase/env. No ownership or validation assertions yet — infrastructure only.

### Changes Required:

#### 1. Shared API context fixtures

**File**: `src/lib/api/__fixtures__/api-context.ts` (new)

**Intent**: Provide reusable fake `APIContext` builders and two-user constants for
integration tests.

**Contract**: Export `userA`, `userB` fixture users (stable UUIDs); export
`createApiContext({ user, projectId, method, url, body?, headers? })` returning
minimal `APIContext` with `locals.user`, `params`, `request`, `cookies` stub.
Export `NOT_FOUND_REDIRECT` constant matching `project-route-helpers.ts:12`.

#### 2. Vitest mock pattern spike

**File**: `src/lib/api/project-route-helpers.test.ts` (new — one smoke test)

**Intent**: Prove `resolveProjectApiContext` is testable: mock `@/lib/supabase`
and/or `@/lib/services/projects`, run one passing case (success path).

**Contract**: Single smoke test: authenticated user + mocked `getProjectById`
returns project → `ok: true`. Documents required `vi.mock` setup for Phase 2.

#### 3. Vitest config (if needed)

**File**: `vitest.config.ts`

**Intent**: Only if Phase 1 spike fails — add test env vars or setup file for
`SUPABASE_URL`/`SUPABASE_KEY` stubs.

**Contract**: Minimal change; prefer module-level `vi.mock` over global setup
unless spike proves otherwise.

### Success Criteria:

#### Automated Verification:

- Integration smoke test passes: `npm test -- src/lib/api/project-route-helpers.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Fixture module is importable from route tests without circular deps
- Mock strategy documented in a one-line comment at top of smoke test file

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Ownership Isolation Tests

### Overview

Exhaust ownership resolution for both JSON and redirect resolvers, plus middleware
401 JSON for nested project API paths.

### Changes Required:

#### 1. Project route helper matrix

**File**: `src/lib/api/project-route-helpers.test.ts` (extend)

**Intent**: Prove risk #5 isolation at the shared helper boundary — the cheapest
signal for all eight project-scoped routes.

**Contract**: `resolveProjectApiContext` cases:
- no `locals.user` → `{ ok: false, status: 401, code: UNAUTHORIZED }`
- invalid UUID → `{ ok: false, status: 404, code: NOT_FOUND }`
- valid UUID + `getProjectById` → `null` (user A, foreign project) → 404 `NOT_FOUND`
- valid UUID + project returned → `{ ok: true, … }`

`resolveProjectRouteContext` parallel cases:
- no user → redirect `/auth/signin`
- invalid UUID → redirect `/dashboard?error=Project%20not%20found`
- `getProjectById` → `null` → same NOT_FOUND redirect
- success → `{ ok: true, … }`

Use `userA`/`userB` fixtures; mock `getProjectById` — no real Supabase.

#### 2. Middleware unauth JSON

**File**: `src/middleware.test.ts` (new)

**Intent**: Prove middleware returns 401 JSON for unauthenticated nested
`/api/projects/:id/…` — gap vs E2E (E2E only tests page redirect).

**Contract**: Call exported middleware `onRequest` with URL
`/api/projects/00000000-0000-4000-8000-000000000001/editor`, no user in
`locals`, mock `createClient` auth → null user. Assert Response status 401 and
body `error.code === "UNAUTHORIZED"`.

### Success Criteria:

#### Automated Verification:

- Helper matrix passes: `npm test -- src/lib/api/project-route-helpers.test.ts`
- Middleware test passes: `npm test -- src/middleware.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- Test count covers all four failure modes per resolver (auth, bad id, foreign, success)
- No duplicate assertions that E2E already covers (page redirect) unless middleware JSON is the point

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Editor Validation Parity Tests

### Overview

Lock server-side editor validation: Zod schema rules, editor route handler wiring,
foreign assembly rejection, and geometry-wipe **500** pin.

### Changes Required:

#### 1. Editor Zod schema tests

**File**: `src/lib/validation/editor.test.ts` (new)

**Intent**: Prove server-only validation rules the client never runs before PUT.

**Contract**: Tests use real `editorStateSchema.safeParse`. Minimum cases:
- invalid node UUID → failure with `issues`
- duplicate node id → failure
- non-orthogonal segment → failure
- open room chain (≥3 segments, not closed) → failure
- `internal_temp_c` outside 5–35 → failure
- array over cap (e.g. nodes > 500) → failure
- valid minimal payload → success

Use small inline fixture objects — no Supabase.

#### 2. Editor route handler tests

**File**: `src/pages/api/projects/[id]/editor.test.ts` (new)

**Intent**: Prove PUT/GET wiring: ownership, Zod `issues` shape, foreign assembly,
same-origin, geometry-wipe pin.

**Contract**: Import `GET` and `PUT` from `editor.ts`. Mock
`resolveProjectApiContext` path via `getProjectById`, `ensureProjectEditorReady`,
`getEditorState`, `replaceEditorState` as needed.

Minimum cases:
- **GET** foreign project (`getProjectById → null`) → 404 `NOT_FOUND`
- **PUT** foreign project → 404 `NOT_FOUND`
- **PUT** invalid JSON body → 400, no `issues`
- **PUT** Zod failure (e.g. bad UUID) → 400 `VALIDATION_ERROR` with `issues` array
- **PUT** foreign `assembly_id` (service throws "assemblies do not belong") → 400,
  message contains "assemblies do not belong", **no** `issues`
- **PUT** cross-origin (missing/wrong `Origin`) → 403 `FORBIDDEN`
- **PUT** geometry-wipe scenario (mock `replaceEditorState` to throw RPC guard
  error) → **500** `INTERNAL_ERROR` — pins current behavior

Success path optional if mocks are heavy — ownership cases are higher priority.

### Success Criteria:

#### Automated Verification:

- Zod tests pass: `npm test -- src/lib/validation/editor.test.ts`
- Route tests pass: `npm test -- src/pages/api/projects/[id]/editor.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`
- E2E still green: `npm run test:e2e -- e2e/risk-5-protected-project-access.test.ts`

#### Manual Verification:

- Foreign assembly test documents asymmetry vs Zod `issues` (comment or test name)
- Geometry-wipe test name references "pins 500 until follow-up fix"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Test-Plan Backport

### Overview

Link Phase 3 rollout row to this change folder and document the integration
pattern in test-plan §6.3.

### Changes Required:

#### 1. Test-plan cookbook §6.3

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.3 TBD with owner-isolation + editor validation recipe.

**Contract**: §6.3 must include: file locations (`__fixtures__/api-context.ts`,
`project-route-helpers.test.ts`, `editor.test.ts`, route colocated tests), mock
strategy (real Zod + mock `getProjectById`), two-user fixture pattern, resolver
vs route test guidance, anti-pattern ("do not duplicate E2E smoke"), note that
redirect routes are covered via resolver tests. Update §3 Phase 3 row: status
`complete`, change folder `testing-api-ownership-validation`. Add §6.5 phase note.
Update §8 freshness ledger if needed.

#### 2. Change status

**File**: `context/changes/testing-api-ownership-validation/change.md`

**Intent**: Mark change planned during plan write; implementer sets `implementing`
on Phase 1 start, `implemented` when all Progress rows are `[x]`.

**Contract**: `status: planned` at plan approval; `updated: 2026-06-22`.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- §6.3 is actionable — developer can add a new API ownership test without reading this plan
- §3 Phase 3 row links this change folder

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit / integration tests (Vitest):

- Resolver matrix: auth, bad UUID, foreign project, success — JSON and redirect
- Middleware: unauth nested API → 401 JSON
- `editorStateSchema`: server-only Zod rules (UUID, geometry, caps, temp)
- Editor routes: foreign GET/PUT, Zod issues, foreign assembly, same-origin, geometry-wipe 500

### E2E (unchanged):

- `e2e/risk-5-protected-project-access.test.ts` — re-run after Phase 3 to confirm no regression

### Manual Testing Steps:

1. Run `npm test` twice in a row — confirm isolation (no order dependency)
2. Skim §6.3 against actual file paths
3. Confirm E2E risk #5 still passes locally

## Performance Considerations

Integration tests are mocked I/O — suite should stay sub-second per file. No
performance budget concerns.

## Migration Notes

No data or production code migration. Additive test files only. Geometry-wipe **500**
is documented by tests, not changed.

## References

- Related research: `context/changes/testing-api-ownership-validation/research.md`
- E2E research: `context/changes/testing-e2e-critical-flows-bootstrap/research.md`
- Test plan: `context/foundation/test-plan.md` — Phase 3, risk #5, §6.3
- Ownership helpers: `src/lib/api/project-route-helpers.ts`
- Editor route: `src/pages/api/projects/[id]/editor.ts`
- Editor Zod: `src/lib/validation/editor.ts`
- Archive F7: `context/archive/2026-06-08-pdf-floor-plan-editor/reviews/impl-review.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Integration Test Bootstrap

#### Automated

- [x] 1.1 Shared fixtures in `src/lib/api/__fixtures__/api-context.ts` — b8adf6e
- [x] 1.2 Resolver smoke test passes: `npm test -- src/lib/api/project-route-helpers.test.ts` — b8adf6e
- [x] 1.3 Full suite passes: `npm test` — b8adf6e
- [x] 1.4 Lint passes: `npm run lint` — b8adf6e
- [x] 1.5 Build passes: `npm run build` — b8adf6e

#### Manual

- [x] 1.6 Fixture module importable; mock strategy noted in smoke test — b8adf6e

### Phase 2: Ownership Isolation Tests

#### Automated

- [x] 2.1 Resolver matrix passes: `npm test -- src/lib/api/project-route-helpers.test.ts` — b8adf6e
- [x] 2.2 Middleware 401 JSON test passes: `npm test -- src/middleware.test.ts` — b8adf6e
- [x] 2.3 Full suite passes: `npm test` — b8adf6e
- [x] 2.4 Lint passes: `npm run lint` — b8adf6e

#### Manual

- [x] 2.5 All four failure modes covered per resolver; no redundant E2E duplication — b8adf6e

### Phase 3: Editor Validation Parity Tests

#### Automated

- [x] 3.1 Zod tests pass: `npm test -- src/lib/validation/editor.test.ts` — b8adf6e
- [x] 3.2 Editor route tests pass: `npm test -- src/pages/api/projects/[id]/editor.test.ts` — b8adf6e
- [x] 3.3 Full suite passes: `npm test` — b8adf6e
- [x] 3.4 Lint passes: `npm run lint` — b8adf6e
- [x] 3.5 E2E risk #5 still green: `npm run test:e2e -- e2e/risk-5-protected-project-access.test.ts` — b8adf6e

#### Manual

- [x] 3.6 Foreign assembly vs Zod `issues` asymmetry documented in test naming — b8adf6e
- [x] 3.7 Geometry-wipe test pins 500 behavior — b8adf6e

### Phase 4: Test-Plan Backport

#### Automated

- [x] 4.1 Full suite passes: `npm test` — b8adf6e
- [x] 4.2 Lint passes: `npm run lint` — b8adf6e

#### Manual

- [x] 4.3 §6.3 actionable without reading this plan — b8adf6e
- [x] 4.4 §3 Phase 3 row links this change folder — b8adf6e
