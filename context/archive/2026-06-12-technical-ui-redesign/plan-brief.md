# Technical UI Redesign — Plan Brief

> Full plan: `context/changes/technical-ui-redesign/plan.md`

## What & Why

OZC-cal works end-to-end (S-04 done) but still looks like a cosmic SaaS landing page — purple gradients, glass panels, dark navy shells. For an HVAC/energy-audit calculation tool, the UI should read as a neutral, light engineering workspace: readable forms, calm slate palette, no decorative orbs or gradient hero text.

## Starting Point

~20 files hardcode `bg-cosmic`, `purple-*`, and glass classes (`white/10`, `backdrop-blur-xl`). shadcn tokens exist in `global.css` but `--primary` is neutral gray while every CTA overrides with `bg-purple-600`. `Layout.astro` has no shared shell — each page copy-pastes the cosmic wrapper. Only Button and Dialog shadcn primitives exist; inputs are ad-hoc duplicated strings.

## Desired End State

User navigates auth, dashboard, project setup, editor chrome, and OZC results in a consistent light theme (slate + muted blue accent). Editor toolbar and side panels are light; PDF/canvas area stays on a dark neutral background for plan contrast. No remaining `purple-*`, `bg-cosmic`, gradient headings, or glass orbs in `src/`. Functional flows unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Color mode | Light-only | Matches engineering-tool target; halves visual work vs dual theme | Plan |
| Redesign depth | Tokens + light layout tweaks | Better density without full IA rewrite | Plan |
| Migration strategy | Foundation-first | Tokens + AppShell before surfaces — avoids prolonged half-cosmic state | Plan |
| Editor treatment | Light chrome, dark canvas | CAD-like contrast for floor-plan readability | Plan |
| Design system | Remap CSS tokens; stop purple overrides | Reuses shadcn Button/Dialog without adding Input/Card now | Plan |
| Landing page | Tool entry (simplified Welcome) | Consistent with tool-not-marketing goal | Plan |
| Accent palette | Slate + muted blue | Neutral CAD/HVAC feel; zero purple | Plan |
| Scope cut list | All surfaces required | No deferred pages in v1 of this slice | Plan |

## Scope

**In scope:** `global.css` token remap; shared `AppShell`; auth, Welcome, dashboard, Topbar; project detail + project React islands; editor chrome components; grep cleanup; lint/build.

**Out of scope:** Dark mode / system preference; new shadcn Input/Card/Label; domain/API/calculation logic; editor geometry or canvas interaction; formal design system documentation; accessibility audit beyond contrast sanity check.

## Architecture / Approach

Foundation-first: remap shadcn CSS variables to slate-blue engineering palette, delete `bg-cosmic`, introduce `AppShell.astro` (light bg, no orbs). Add a small shared class map (`src/lib/ui/form-classes.ts`) for input/link patterns used across Astro and React. Migrate surfaces in order: auth/landing → dashboard → project workspace → editor chrome. Editor: wrap canvas in explicit dark container; panels/toolbar use semantic tokens.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Tokens & app shell | Engineering palette, AppShell, shared form classes | Token choices don't cover all edge cases — verify on real forms |
| 2. Auth, landing & dashboard | Tool-entry Welcome, auth pages, Topbar, dashboard | Auth forms regress if input classes miss focus/disabled states |
| 3. Project workspace | `[id].astro` + AssemblyCatalog, OzcCalculationPanel, CreateProjectDialog | Largest inline markup file — easy to miss a purple class |
| 4. Editor chrome | Light panels/toolbar, dark canvas zone | Visual seam between chrome and canvas if container boundaries unclear |
| 5. Sweep & verify | Zero cosmic/purple grep, lint/build, manual pass | Residual hardcoded classes in less-used paths |

**Prerequisites:** S-04 complete (done). No new dependencies.

**Estimated effort:** ~3–4 focused sessions across 5 phases.

## Open Risks & Assumptions

- Light project forms remain readable with dense assembly/calculation data — may need spacing tweaks during manual pass.
- shadcn Button default variants after token remap must be verified on every CTA (no silent gray buttons).
- `FloorPlanEditor` canvas styling is intentionally dark; only chrome changes, not PDF rendering logic.

## Success Criteria (Summary)

- Grep of `src/` finds zero `bg-cosmic`, `purple-`, and gradient hero patterns.
- All major user paths (sign in → dashboard → project → editor → calc results) look like one light engineering tool.
- `npm run lint` and `npm run build` pass with no functional regressions.
