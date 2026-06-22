# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-22

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
  risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
  team is worried about X, and the failure would surface somewhere in
   " carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
  could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).


| #   | Risk (failure scenario)                                                                                          | Impact | Likelihood | Source (evidence — not anchor)                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | OZC heat-loss and ventilation numbers are engineering-wrong relative to WT 2021 expectations                     | High   | High       | PRD guardrails (WT 2021); interview Q1; archive F-03 (manual verification only); hot-spot dir `src/lib/thermal/` (15 touches/30d) |
| 2   | Editor geometry (walls, scale calibration, rooms) is lost or corrupted after reload or auto-save                 | High   | High       | interview Q1; hot-spot dir `src/components/editor/` (20 touches/30d); hot-spot dir `src/lib/services/` (16 touches/30d)           |
| 3   | Room area is wrong because closed-loop detection fails or drawn zones do not form valid closed rooms             | High   | High       | interview Q2, Q3; hot-spot dir `src/components/editor/`; archive S-03 (room-detection scope)                                      |
| 4   | Coordinate transform errors (pan/zoom ↔ PDF space ↔ persisted nodes) produce wrong segment lengths or room areas | High   | Medium     | interview Q3; archive S-03 (coordinate-space and scale-calibration notes)                                                         |
| 5   | A logged-in user reads or mutates another user's project data (IDOR or RLS gap)                                  | High   | Medium     | PRD Access Control + NFR (owner-only data); hot-spot dir `src/lib/services/`; hot-spot dir `src/pages/api/`                       |
| 6   | The same project inputs yield different OZC results on re-run (non-determinism)                                  | Medium | Medium     | PRD NFR (repeatability); archive F-03 (deterministic engine goal)                                                                 |


### Risk Response Guidance


| Risk | What would prove protection                                                                                                                   | Must challenge                                                                                                                                  | Context `/10x-research` must ground                                                                                                           | Likely cheapest layer                                     | Anti-pattern to avoid                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| #1   | Reference-case inputs produce heat-loss and ventilation totals within an agreed engineering tolerance of independently worked expected values | "Manual checklist passed once" implies ongoing correctness; preview U matching catalog display is sufficient without cross-checking engine path | Calculation entry point; assembly U-value resolution; transmission and ventilation formulas; reference fixtures from F-03 manual verification | unit (pure function tests with fixture inputs)            | Oracle copied from implementation under test; happy-path-only single room          |
| #2   | Save → reload round-trip preserves nodes, segments, scale, and room assignments bit-for-bit in domain terms                                   | "Auto-save returned 200" implies persistence; client state alone proves nothing                                                                 | Editor PUT/GET contract; debounced save path; DB schema for geometry; scale field persistence                                                 | integration (API + in-memory or test DB)                  | Testing React render state without hitting persistence layer                       |
| #3   | Known segment graphs produce correct closed loops and room polygons with expected area                                                        | "User can click create room" implies detection works for all valid drawings                                                                     | Cycle-detection algorithm inputs/outputs; manual vs auto room creation paths; polygon area helper                                             | unit (graph fixtures) + integration (full editor payload) | Fixtures that only cover perfect rectangles; ignoring colocated-segment workaround |
| #4   | Pointer events in transformed canvas space map to the same persisted coordinates after pan/zoom and scale calibration                         | Visual inspection on one PDF proves all coordinate paths                                                                                        | Pan/zoom transform application; inverse transform for pointer events; scale derivation from calibration points                                | unit (transform math)                                     | E2e with real PDF rendering when pure math tests suffice                           |
| #5   | Authenticated user A cannot GET/PUT project B's editor, floor plan, climate, assemblies, or calc endpoints                                    | "Middleware redirects unauthenticated users" implies owner isolation is complete                                                                | Protected route list; RLS policies; API ownership checks; JSON 401 vs HTML redirect behavior                                                  | integration (two-user fixture or mocked auth contexts)    | Testing only the happy-path owner access                                           |
| #6   | Identical calculation input object produces byte-identical or numerically identical result on repeated calls                                  | Floating-point "close enough" without defined tolerance masks drift                                                                             | Pure calculation function boundary; whether any randomness or time dependency exists                                                          | unit                                                      | Asserting only that a number is positive                                           |


## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.


| #   | Phase name                        | Goal (one line)                                                                            | Risks covered | Test types          | Status        | Change folder                           |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------ | ------------- | ------------------- | ------------- | --------------------------------------- |
| 1   | Calculation core + test bootstrap | Bootstrap Vitest and prove WT 2021 engine correctness + repeatability with reference cases | #1, #6        | unit + runner setup | complete      | testing-calculation-core-test-bootstrap |
| 2   | Editor geometry & persistence     | Prove room detection, coordinate transforms, and save/reload preserve geometry             | #2, #3, #4    | unit + integration  | change opened | testing-editor-geometry-persistence     |
| 3   | API ownership & validation        | Prove cross-account isolation and server-side editor validation parity                     | #5            | integration         | complete      | testing-api-ownership-validation        |
| 4   | Quality gates wiring              | Lock `npm test` as a required CI gate                                                      | cross-cutting | CI gate             | not started   | —                                       |
| 5   | E2E critical flows bootstrap      | Playwright smoke for editor scale persistence and protected-route isolation                | #2, #5        | e2e                 | complete      | testing-e2e-critical-flows-bootstrap    |


## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session.


| Layer                | Tool   | Version | Notes                                                                              |
| -------------------- | ------ | ------- | ---------------------------------------------------------------------------------- |
| unit + integration   | Vitest | ^3.2.6  | `vitest.config.ts` via Astro `getViteConfig()`; `npm test` / `npm test:watch`; CI gate deferred to §3 Phase 4 |
| API mocking          | Vitest `vi.mock` | —       | mock `@/lib/supabase` + `@/lib/services/projects` at service boundary; real Zod schemas; see §6.3 |
| e2e                  | Playwright Test | ^1.61.0 | `playwright.config.ts`; `npm run test:e2e`; auth via `e2e/auth.setup.ts` + `storageState`; seed in `e2e/spec.test.ts`; rules in `.cursor/rules/e2e-testing.mdc`. CI gate deferred to §3 Phase 4 |
| accessibility        | —      | —       | none yet                                                                           |
| (optional) AI-native | —      | n/a     | not included in rollout — deterministic tests cover domain risks                   |


**Stack grounding tools (current session):**

- Docs: Context7 (`/withastro/docs`, `/vitest-dev/vitest`) — Astro 6 Vitest setup via `getViteConfig()`; checked: 2026-06-17
- Search: web search MCP — not used this session; checked: 2026-06-15
- Runtime/browser: Playwright Test ^1.61.0 — local `npm run test:e2e` against `astro dev` (webServer); checked: 2026-06-18
- Provider/platform: not available in current session (no Supabase/GitHub MCP) — CI gate wiring deferred to Phase 4; checked: 2026-06-15

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.


| Gate                            | Where                | Required?                 | Catches                                    |
| ------------------------------- | -------------------- | ------------------------- | ------------------------------------------ |
| lint + typecheck                | local + CI           | required                  | syntactic / type drift                     |
| build                           | local + CI           | required                  | SSR / bundling regressions                 |
| unit + integration (`npm test`) | local + CI           | required after §3 Phase 4 | logic regressions in engine, editor, API   |
| e2e on critical flows           | local (+ CI on PR)   | required locally          | cross-boundary regressions (#2 partial, #5); CI wiring deferred to §3 Phase 4 |
| post-edit hook                  | local (agent loop)   | required                  | lint + typecheck after agent `Write` (`.cursor/hooks.json`) |
| pre-prod smoke                  | between merge + prod | planned                   | environment-specific failures              |


## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test (thermal / pure logic)

Reference-case unit tests for the WT 2021 calculation engine. Covers risks #1
and #6 (see §2).

**Run tests**

```bash
npm test          # single run
npm test:watch    # watch mode
```

**Where files live**

| Role | Path |
| --- | --- |
| Shared fixtures + tolerance helper | `src/lib/thermal/__fixtures__/ozc-reference.ts` |
| Orchestrator (Case 1/2, determinism) | `src/lib/thermal/calculate-ozc.test.ts` |
| Ventilation formula | `src/lib/thermal/wt2021-ventilation.test.ts` |
| U preview ≡ engine parity | `src/lib/thermal/wt2021-u.test.ts` |
| Display layer mapping | `src/lib/thermal/calc-display.test.ts` |

Colocate new `*.test.ts` files next to the module under test in
`src/lib/thermal/`.

**Oracle source (required)**

Expected heat-loss values must come from independent engineering oracles — not
from output of the function under test. Primary reference:

`context/archive/2026-06-09-wt2021-calculation-core/manual-verification.md`

Hand-calc tables (e.g. Case 1: 614.4 W transmission + 1584 W ventilation ≈
2198 W room total) or formula-derived expectations using documented U-values /
geometry. Layer stacks in fixtures may yield ~2196 W vs hand-calc 2198 W;
allow ±2 W when comparing rounded totals to the hand-calc table.

**Tolerance**

- Heat-loss assertions: **±1 W** — use `assertHeatLossW()` from
  `ozc-reference.ts` or `expect(...).toBeCloseTo(..., 0)`.
- U-value parity: tighter tolerance (e.g. `toBeCloseTo(..., 4)`).
- Determinism: `JSON.stringify(result)` identical on repeat call.

**Adding a new reference case**

1. Add fixture input (`ValidatableOzcInput`) and hand-derived expected values
   to `src/lib/thermal/__fixtures__/ozc-reference.ts`. Copy geometry from
   `scripts/ozc-manual-check.mts` if needed — do not import the script.
2. Add or extend assertions in the relevant colocated `*.test.ts` file.
3. Optionally extend `scripts/ozc-manual-check.mts` for offline dev checks
   (script is not CI — Vitest is the regression guard).
4. Run `npm test` and `npx tsx scripts/ozc-manual-check.mts`.

**Anti-patterns**

- Do **not** copy `calculateOzc()` output as the expected value in the same
  test (oracle copied from implementation under test).
- Do **not** import Supabase, API routes, or `astro:env/server` — thermal unit
  tests are pure functions only.
- Do **not** add editor geometry tests here — floor area, segment length, and
  coordinate transforms belong in §6.4 (test-plan §3 Phase 2 rollout).

**Offline manual runner (dev only)**

```bash
npx tsx scripts/ozc-manual-check.mts
```

### 6.2 Adding an integration test (API / persistence)

- TBD — see §3 Phase 2 for editor save/reload round-trip pattern.

### 6.3 Adding a test for a new API endpoint

Integration tests for API ownership (risk **#5**) and server-side editor validation.
Complements E2E smoke in §6.6 — do not duplicate browser-level coverage here.

**Run tests**

```bash
npm test                                              # full suite
npm test -- src/lib/api/project-route-helpers.test.ts # ownership resolvers
npm test -- src/lib/validation/editor.test.ts         # Zod schema rules
npm test -- src/pages/api/projects/[id]/editor.test.ts # editor route wiring
npm test -- src/middleware.test.ts                    # unauth 401 JSON
```

**Where files live**

| Role | Path |
| --- | --- |
| Shared API context fixtures | `src/lib/api/__fixtures__/api-context.ts` |
| Ownership resolver matrix | `src/lib/api/project-route-helpers.test.ts` |
| Middleware 401 JSON | `src/middleware.test.ts` |
| Editor Zod validation | `src/lib/validation/editor.test.ts` |
| Editor route handler | `src/pages/api/projects/[id]/editor.test.ts` |
| E2E smoke (risk #5 — keep separate) | `e2e/risk-5-protected-project-access.test.ts` |

Colocate new `*.test.ts` files next to the module or route under test.

**Mock strategy (required)**

- **Real:** Zod schemas (`editorStateSchema`, etc.) — never mock validation under test.
- **Mock:** `@/lib/supabase` (`createClient` → stub client; avoids `astro:env/server` in tests).
- **Mock:** `@/lib/services/projects` (`getProjectById` → `null` simulates RLS hiding foreign rows).
- **Partial mock:** `@/lib/services/project-editor` via `importOriginal` — override
  `countProjectAssemblies`, `replaceEditorState`; keep `getProjectEditorReady` real.
- **Fake auth:** `createApiContext({ user: userA | userB | null })` — no real Supabase sessions.

**Two-user fixture pattern**

```typescript
// userA authenticated, project owned by B → mock getProjectById → null
mockedGetProjectById.mockResolvedValue(null);
const context = createApiContext({ user: userA, projectId: foreignProjectId });
// expect 404 NOT_FOUND (JSON) or NOT_FOUND redirect per resolver
```

Stable fixture users: `userA`, `userB` in `api-context.ts`. Use `createProjectFor(owner)` for owned rows.

**Resolver vs route tests**

| Layer | What it proves | When to add |
| --- | --- | --- |
| `resolveProjectApiContext` / `resolveProjectRouteContext` | Ownership for **all** project-scoped routes (JSON 404 vs redirect) | Every new route using shared helpers |
| Route handler import (`editor.ts`, etc.) | Wiring: same-origin, Zod `issues`, service-layer errors | JSON routes with non-trivial PUT/GET logic |
| `editorStateSchema` unit tests | Server-only validation rules | New Zod rules or `superRefine` branches |

Redirect routes (climate, assemblies, floor-plan form POSTs) inherit ownership from
`resolveProjectRouteContext` — extend the resolver matrix; do not import every handler
unless it adds logic beyond the shared helper.

**Error shapes to assert**

| Condition | JSON routes | Redirect routes |
| --- | --- | --- |
| Unauthenticated | 401 `UNAUTHORIZED` | redirect `/auth/signin` |
| Bad UUID / foreign project | 404 `NOT_FOUND` | redirect `/dashboard?error=Project%20not%20found` |
| Zod failure | 400 `VALIDATION_ERROR` + `issues` | — |
| Foreign `assembly_id` | 400 `VALIDATION_ERROR`, **no** `issues` | — |
| Cross-origin mutation | 403 `FORBIDDEN` | — |

**Adding ownership coverage for a new endpoint**

1. Confirm the route uses `resolveProjectApiContext` or `resolveProjectRouteContext`.
2. If it uses a shared resolver, extend `project-route-helpers.test.ts` only when
   the helper contract changes — the existing matrix already covers foreign-id cases.
3. For JSON routes with request-body validation, add colocated route tests mocking
   `getProjectById` + editor/climate services as needed.
4. Run `npm test` and confirm E2E smoke still passes (`e2e/risk-5-*.test.ts`).

**Anti-patterns**

- Do **not** duplicate E2E smoke (unauth dashboard redirect, foreign GET editor) — integration
  fills the endpoint matrix cheaply; E2E proves one real cross-boundary path.
- Do **not** use real Supabase in default `npm test` — Tier 3 RLS proof is optional/local-only.
- Do **not** mock `editorStateSchema` in route tests — assert real Zod output shape.
- Do **not** import every redirect handler to assert 404 — resolver tests are sufficient.

### 6.4 Adding a test for editor geometry

- TBD — see §3 Phase 2 for room-loop detection and coordinate-transform pattern.

### 6.5 Per-rollout-phase notes

- **Phase 1 (2026-06-17):** Vitest ^3.2.6 bootstrapped; Case 1/2 reference
  fixtures; 13 unit tests under `src/lib/thermal/`. CI gate still planned
  (§3 Phase 4).
- **Phase 3 (2026-06-22):** Integration tests for risk **#5**; change folder
  `testing-api-ownership-validation`; 23 Vitest tests (resolver matrix, middleware
  401 JSON, editor Zod + route wiring); `npm test` total 36 tests. Redirect-route
  ownership covered via resolver tests; E2E smoke unchanged. CI gate still planned
  (§3 Phase 4).
- **Phase 5 (2026-06-22):** Playwright Test ^1.61.0 bootstrapped;
  change folder `testing-e2e-critical-flows-bootstrap`; 6 specs
  (setup + seed + risks #2 partial, #5); local `npm run test:e2e` green.
  E2E not yet in CI (§3 Phase 4). Risk #2 E2E covers scale persistence only —
  full nodes/segments/rooms remain for integration layer (§3 Phase 2).

### 6.6 Adding an E2E test (Playwright)

Browser-level smoke for risks that cross auth → routing → API → DB. Current
coverage: risk **#2** (editor scale survives reload — partial; segments/rooms
deferred) and risk **#5** (unauthenticated redirect + foreign project isolation).

**Prerequisites**

- `.env` with `SUPABASE_URL`, `SUPABASE_KEY`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
  (see `.env.example`)
- One-time: `npx playwright install chromium`

**Run tests**

```bash
npm run test:e2e                              # full suite (setup + specs)
npm run test:e2e -- e2e/spec.test.ts          # single file
npm run test:e2e -- --headed                  # visible browser
```

**Where files live**

| Role | Path |
| --- | --- |
| Config + webServer | `playwright.config.ts` |
| Auth setup (once per run) | `e2e/auth.setup.ts` → `playwright/.auth/user.json` |
| Seed exemplar | `e2e/spec.test.ts` |
| Shared fixtures | `e2e/fixtures.ts`, `e2e/helpers/project-setup.ts` |
| Risk-tied specs | `e2e/risk-2-*.test.ts`, `e2e/risk-5-*.test.ts` |
| Agent rules | `.cursor/rules/e2e-testing.mdc` |

**Conventions (required)**

- Extend `e2e/fixtures.ts` with `base.extend` — no page-object models.
- `getByRole` / `getByLabel` with `{ exact: true }` when substring collisions occur.
- Unique data via `Date.now()` suffix; setup/teardown inside fixtures.
- Never `page.waitForTimeout()` — use `toBeVisible()`, `waitForURL()`, `waitForResponse()`.
- Auth only in `auth.setup.ts`; tests assume `storageState` (except unauthenticated cases).
- Name tests after the risk scenario, not generic labels.

**Adding a new E2E test**

1. Pick a risk from §2 that genuinely needs browser-level proof (see `/10x-e2e` gate).
2. Copy patterns from `e2e/spec.test.ts` and an existing `e2e/risk-*.test.ts`.
3. Add or extend a fixture in `e2e/fixtures.ts` for setup/teardown.
4. Run `npm run test:e2e` twice in a row to confirm isolation.
5. Prefer `/10x-e2e` (standalone or plan-driven) for generate → review → verify loop.

**Anti-patterns**

- CSS/XPath selectors; shared state between tests; asserting page title instead of business outcome.
- Logging in through UI in every test (use `storageState`).
- Promoting to E2E when a unit or integration test would suffice (§1 cost × signal).

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **UI styles and visual theme tokens** — cosmetic; low blast radius on
engineering correctness. Re-evaluate if theme changes affect editor
canvas readability. (Source: Phase 2 interview Q5.)
- **shadcn/ui and Radix primitives** — third-party component library;
upstream owns correctness. (Source: Phase 2 interview Q5.)
- **Other third-party dependency internals** — test at integration
boundaries only when domain logic depends on them; never unit-test
vendor code. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-22
- Stack versions last verified: 2026-06-22
- AI-native tool references last verified: 2026-06-15

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.

