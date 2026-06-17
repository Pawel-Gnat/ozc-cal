# Calculation Core + Test Bootstrap — Plan Brief

> Full plan: `context/changes/testing-calculation-core-test-bootstrap/plan.md`
> Research: `context/changes/testing-calculation-core-test-bootstrap/research.md`

## What & Why

Test-plan Phase 1: bootstrap Vitest and prove the WT 2021 calculation engine produces correct, repeatable heat-loss numbers using reference cases — protecting against engineering-wrong OZC outputs (risk #1) and non-determinism (risk #6). Today correctness rests on a manual script with no CI regression guard.

## Starting Point

The engine is implemented and passes `scripts/ozc-manual-check.mts` (Case 1 ≈2198 W, Case 2 partition, ventilation checks). There is no test runner, no `*.test.*` files, and CI runs lint + build only. Research documented MVP deviations (ventilation sum model, building double-count) as accepted non-regression boundaries.

## Desired End State

Developers run `npm test` locally and get passing reference-case unit tests for `calculateOzc()`, ventilation, U-value parity, and display formatting — with fixtures in a shared module and ±1 W tolerance. The manual-check script stays as a dev tool. Test-plan §6.1 documents how to add new thermal unit tests.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Fixture location | Shared module (`__fixtures__/ozc-reference.ts`) | Single oracle source for split test files; avoids script import coupling | Plan |
| Test file layout | Split by module | Focused failures; matches thermal module boundaries | Plan |
| Display layer tests | Include in Phase 1 | Manual-check already covers S-04 rounding/name mapping | Plan |
| Manual-check script | Keep alongside Vitest | Offline quick runner for engineers; no migration risk | Plan |
| Geometry tests | Defer to test-plan Phase 2 | Editor geometry is a separate risk cluster (#2–#4) | Plan |
| Doc updates | test-plan §6.1 only | AGENTS.md waits for Phase 4 CI gate | Plan |
| Reference tolerance | ±1 W | Matches manual-verification.md and manual-check | Research |
| Ventilation model | Sum supply + exhaust + natural | Conscious MVP simplification; fixture V=120 → 1584 W | Research |
| Building total | Sum of per-room losses | Intentional MVP; UI label sufficient | Research |
| Partition warning | Out of scope | Follow-up slice after reference tests land | Research |

## Scope

**In scope:** Vitest install + config via `getViteConfig()`; `npm test` script; shared reference fixtures; split unit tests (orchestrator, ventilation, U, display); determinism; cookbook §6.1; test-plan §4 Vitest version update.

**Out of scope:** CI gate (Phase 4); geometry tests (Phase 2); partition colocation warning; API/Supabase/service tests; AGENTS.md update; replacing manual-check script; net envelope loss tests.

## Architecture / Approach

```
manual-verification.md (oracle)
        ↓
__fixtures__/ozc-reference.ts  ←── extracted from ozc-manual-check.mts
        ↓
┌───────────────────────────────────────────────────┐
│  calculate-ozc.test.ts   (Case 1/2, determinism)  │
│  wt2021-ventilation.test.ts  (V=120, null fields) │
│  wt2021-u.test.ts        (preview ≡ engine U)     │
│  calc-display.test.ts    (names, W passthrough)   │
└───────────────────────────────────────────────────┘
        ↓
   npm test (Vitest + Astro Vite config)
```

Pure `src/lib/thermal/*` imports only — no DB, no API, no Cloudflare runtime.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Vitest bootstrap | Runner config, smoke test, npm scripts | `getViteConfig()` + Vite 7 alias resolution |
| 2. Reference fixtures + unit tests | Shared fixtures, split test files, full coverage | Oracle copied from implementation instead of hand-calc |
| 3. Cookbook documentation | test-plan §6.1 filled, stack version updated | Docs drift from actual file paths |

**Prerequisites:** Node 22 (per CI), existing thermal engine on main.
**Estimated effort:** ~2–3 focused sessions across 3 phases.

## Open Risks & Assumptions

- Vitest + Astro 6 + Vite 7 combo may need minor config tweaks for Cloudflare-specific Vite plugins — smoke test in Phase 1 catches this early.
- Layer-derived U values produce ~2196 W rounded display vs ~2198 W hand-calc — both within ±1 W tolerance; tests must use documented oracles, not pick one arbitrarily.
- AGENTS.md still says "no test runner" until Phase 4 — contributors may not know tests exist until §6.1 is read.

## Success Criteria (Summary)

- `npm test` passes with reference cases covering transmission, ventilation, U parity, display, and determinism.
- Expected values trace to `manual-verification.md` hand-calcs, not implementation output.
- `scripts/ozc-manual-check.mts` still passes unchanged.
- test-plan §6.1 tells future contributors how to add a new reference case.
