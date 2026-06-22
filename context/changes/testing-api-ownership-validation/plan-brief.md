# API Ownership and Validation — Plan Brief

> Full plan: `context/changes/testing-api-ownership-validation/plan.md`
> Research: `context/changes/testing-api-ownership-validation/research.md`

## What & Why

Test-plan Phase 3 adds Vitest integration tests for risk **#5**: prove a logged-in
user cannot read or mutate another user's project data via API helpers and editor
routes, and prove server-side **editor** validation (Zod + foreign `assembly_id`)
is enforced independently of the React client.

## Starting Point

Vitest is bootstrapped (Phase 1 thermal) with 13+ unit tests under
`src/lib/thermal/`. No integration tests exist. E2E smoke covers unauth redirect
and one foreign `GET editor` → 404. Ownership lives in RLS + shared resolvers
(`project-route-helpers.ts`); validation splits across Zod, service, and RPC.

## Desired End State

`npm test` includes resolver ownership matrix, middleware 401 JSON, editor Zod
rules, and editor GET/PUT route tests (foreign project, Zod `issues`, foreign
assembly, geometry-wipe **500** pin). Test-plan §6.3 documents the pattern.
E2E unchanged — integration fills gaps E2E cannot cover cheaply.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| RLS proof depth | Mock `getProjectById → null` only | Cheapest signal per test-plan §4 | Research / Plan |
| Validation scope | Editor only | Matches phase title; calc deferred | Plan |
| Route test depth | Helpers + middleware + editor routes | Redirect routes covered via resolver matrix | Research / Plan |
| Geometry-wipe RPC | Pin **500** in tests | No prod change this phase | Plan |
| Real Supabase two-user | Deferred (Tier 3) | Setup cost; E2E + mocks sufficient for MVP | Research / Plan |

## Scope

**In scope:** Shared API test fixtures; `project-route-helpers` matrix;
middleware 401 JSON; `editorStateSchema` tests; editor GET/PUT route tests;
test-plan §6.3 cookbook; §3 Phase 3 link.

**Out of scope:** Tier 3 RLS tests; full eight-route import matrix; calc validation;
geometry-wipe **422** fix; new E2E; CI gate (Phase 4); production code changes.

## Architecture / Approach

```
Vitest (mock getProjectById + fake locals.user)
    → project-route-helpers.test.ts   (ownership matrix)
    → middleware.test.ts              (401 JSON)
    → editor.test.ts                  (Zod schema)
    → editor route test               (PUT/GET wiring + foreign assembly)
E2E smoke (unchanged)                 (real auth + one cross-boundary path)
```

Real Zod schemas; mocked Supabase at service boundary. Two-user scenarios via
fixture UUIDs, not live Supabase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bootstrap | Fixtures + resolver smoke test | `astro:env/server` mock friction |
| 2. Ownership | Helper matrix + middleware 401 | Over-mocking hides real wiring bugs |
| 3. Editor validation | Zod + route tests + 500 pin | Route test mock complexity |
| 4. Backport | §6.3 cookbook + test-plan link | Doc drift from file paths |

**Prerequisites:** Vitest bootstrapped; research complete; E2E risk #5 green locally.  
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Vitest may need `vi.mock("@/lib/supabase")` — Phase 1 spike validates this.
- Geometry-wipe **500** is intentional debt documented by tests; follow-up fix is separate.
- Redirect-route ownership is inferred from resolver tests — acceptable per research.

## Success Criteria (Summary)

- User A cannot access User B's project at helper and editor route layers (mocked RLS).
- Invalid editor payloads fail with correct status/code/`issues` shapes server-side.
- §6.3 lets a contributor add the next API ownership test without reading the full plan.
