# Technical UI Redesign Implementation Plan

## Overview

Roadmap slice **S-05** (`technical-ui-redesign`) replaces the cosmic/purple/glass SaaS aesthetic with a light, neutral engineering-tool UI across all user-facing surfaces. Visual and layout polish only — no changes to auth logic, API routes, editor geometry, or OZC calculation.

**PRD refs:** Vision (interface simplicity), Guardrails (editor usability on a typical PDF) · **Prerequisites:** S-04 — done

## Current State Analysis

- **Theme split:** shadcn tokens in `src/styles/global.css` (`--primary` neutral gray) vs app layer hardcoding purple/glass on ~20 files.
- **Cosmic shell:** Custom `@utility bg-cosmic` + purple/blue blur orbs duplicated on Welcome, dashboard, auth pages, and `projects/[id].astro`.
- **CTA pattern:** Every `Button` passes `className="bg-purple-600 hover:bg-purple-500"` — default shadcn variants unused.
- **Inputs:** Duplicated magic strings (`border-white/20 bg-white/10 focus:ring-purple-400`) in FormField, AssemblyCatalog, RoomPropertiesPanel, ScaleCalibrationPanel, AssemblyPicker, and `[id].astro`.
- **Layout:** `src/layouts/Layout.astro` is theme-agnostic; no shared app shell.
- **Editor:** `FloorPlanEditor.tsx` uses `bg-slate-950` for workspace; toolbar/panels use purple glass (`EditorToolbar.tsx`, etc.).
- **Dead code:** `src/components/ui/LibBadge.astro` — cosmic colors, zero imports.

### Key Discoveries:

- Worst inline duplication: `src/pages/projects/[id].astro` (~41 theme pattern hits).
- `.dark` tokens defined in `global.css` but never applied — out of scope for this slice.
- Only shadcn primitives: `button.tsx`, `dialog.tsx` — sufficient for token-remap approach.

## Desired End State

1. **Engineering palette** — `:root` tokens map to light slate surfaces, muted blue primary, readable muted text; `bg-cosmic` removed.
2. **Shared shell** — `AppShell.astro` wraps authenticated and public pages with consistent light background (no orbs/gradients).
3. **All surfaces migrated** — auth, Welcome, dashboard, Topbar, project detail, project React islands, editor chrome use semantic tokens or shared form classes.
4. **Editor split** — toolbar and side panels light; canvas/PDF area in explicit dark container unchanged functionally.
5. **Zero cosmic residue** — `rg 'bg-cosmic|purple-|bg-clip-text|white/10' src/` returns no matches (except comments if any).

### Verification

- Automated: `npm run lint`, `npm run build`.
- Manual: visual pass on signin → dashboard → project forms → editor → OZC results panel.

## What We're NOT Doing

- Dark mode or `prefers-color-scheme` support
- Adding shadcn Input, Card, Label, Select via CLI
- Reorganizing information architecture (sidebar nav, new routes)
- Changing calculation, editor geometry, PDF rendering, or API contracts
- Rewriting copy/i18n (keep existing English strings)
- Formal WCAG audit or design documentation site

## Implementation Approach

Foundation-first in five phases: (1) token remap + AppShell + shared form class constants, (2) public/auth/dashboard surfaces, (3) project workspace, (4) editor chrome with light/dark zone split, (5) grep sweep and manual verification. Replace hardcoded classes with `cn()` + semantic tokens (`bg-background`, `bg-primary`, `border-border`, `text-muted-foreground`) or shared constants from `src/lib/ui/form-classes.ts`.

## Phase 1: Design Tokens & App Shell

### Overview

Establish the engineering palette in CSS variables, remove cosmic utility, and introduce a reusable page shell plus shared form/link class strings.

### Changes Required:

#### 1. Remap CSS tokens and remove cosmic utility

**File**: `src/styles/global.css`

**Intent**: Make shadcn semantic tokens match the slate + muted blue engineering palette so components inherit correct colors without purple overrides.

**Contract**: Update `:root` values — `--background` near-white, `--foreground` dark slate, `--primary` muted blue (e.g. oklch blue ~ hue 250), `--primary-foreground` white, `--muted` / `--border` / `--input` light gray variants, `--ring` aligned to primary. Delete `@utility bg-cosmic` block entirely. Leave `.dark { ... }` block unchanged (unused but harmless). Keep `@layer base` body apply.

#### 2. Shared form and surface class constants

**File**: `src/lib/ui/form-classes.ts` (new)

**Intent**: Single source for input, select, panel, and link classes currently copy-pasted across Astro and React files.

**Contract**: Export string constants (or small object) e.g. `inputClass`, `inputWithIconClass` (`cn(inputClass, "pl-10")` or equivalent), `selectClass`, `labelClass`, `iconMutedClass`, `panelClass`, `sectionHeadingClass`, `linkClass` using semantic Tailwind (`border-input bg-background text-foreground ring-ring focus-visible:ring-2`, `text-muted-foreground` for labels/icons, etc.). No purple or white-opacity glass patterns.

#### 3. App shell component

**File**: `src/components/AppShell.astro` (new)

**Intent**: Replace per-page cosmic wrappers (orbs + `bg-cosmic`) with one light engineering page frame.

**Contract**: Props: optional `title` passthrough unused here; `class` slot for width variants. Root: `min-h-screen w-full bg-background text-foreground`. Inner: `relative z-10 p-4 sm:p-8` (match current padding). No blur orbs, no gradients. Accept `<slot />` for page content. **Wiring:** pages keep `Layout.astro` as HTML shell; replace each page's cosmic outer `<div>` with `<AppShell>`. Exception: `src/pages/projects/[id]/editor.astro` — `Layout` → `FloorPlanEditor` only (full-screen, no AppShell).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- `bg-cosmic` absent from `src/styles/global.css`

#### Manual Verification:

- Body background renders light neutral when AppShell used on a test page (temporary wiring OK during Phase 1 smoke)

**Implementation Note**: Pause for human confirmation after Phase 1 manual check before Phase 2.

---

## Phase 2: Auth, Landing & Dashboard

### Overview

Migrate public and authenticated entry surfaces to AppShell and engineering tokens.

### Changes Required:

#### 1. Tool-entry landing

**File**: `src/components/Welcome.astro`, `src/pages/index.astro`

**Intent**: Replace marketing cosmic hero with a concise tool entry — product name, one-line description, sign in / sign up CTAs on light background.

**Contract**: Remove blur orbs, star-field inline styles, gradient `bg-clip-text` headings, glass feature cards. Use AppShell or equivalent light wrapper. Headings: `text-foreground font-semibold` (no gradient). Primary CTA: default shadcn Button or `bg-primary text-primary-foreground`. Secondary: outline variant.

#### 2. Auth pages

**Files**: `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro`

**Intent**: Same light shell; forms readable on white/slate card if used.

**Contract**: Replace `bg-cosmic` wrapper with AppShell. Card panels use `bg-card border border-border rounded-lg shadow-sm` instead of glass. Links use `linkClass` or `text-primary hover:underline`.

#### 3. Auth form components

**Files**: `src/components/auth/FormField.tsx`, `SubmitButton.tsx`, `PasswordToggle.tsx`, `SignUpForm.tsx` (hint text only)

**Intent**: Stop purple input focus rings, purple submit buttons, and dark-theme label/icon/hint colors.

**Contract**: FormField labels import `labelClass`; icon spans import `iconMutedClass`; inputs import `inputWithIconClass` from `form-classes.ts`. PasswordToggle icon button uses `iconMutedClass` with `hover:text-foreground`. SignUpForm password-length hint: `text-muted-foreground` (not `text-blue-100/50`). SubmitButton: remove `bg-purple-600` override — use default Button variant (relies on Phase 1 token remap).

#### 4. Dashboard and top bar

**Files**: `src/pages/dashboard.astro`, `src/components/Topbar.astro`

**Intent**: Project list on light engineering layout; navigation links neutral.

**Contract**: AppShell wrapper. Dashboard heading without gradient text. Empty state and list items: `border border-border bg-card` not glass. Topbar links: `text-muted-foreground hover:text-foreground` or primary — no `text-purple-300`.

#### 5. Create project dialog

**File**: `src/components/projects/CreateProjectDialog.tsx`

**Intent**: Dialog matches light theme — token defaults visible.

**Contract**: Remove `DialogContent` glass override (`border-white/10 bg-white/10 backdrop-blur-xl text-white`). Use default dialog styling or `bg-background text-foreground border-border`. Inputs use `inputClass`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- `/` shows tool entry (no orbs/gradients)
- Sign in and sign up forms readable; submit buttons use blue primary
- Dashboard project list readable on light background
- Create project dialog matches theme

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Project Workspace

### Overview

Refactor the largest themed page and project React islands to light engineering panels with slightly tighter section hierarchy.

### Changes Required:

#### 1. Project detail page

**File**: `src/pages/projects/[id].astro`

**Intent**: Replace ~340 lines of inline cosmic/glass markup with AppShell + card sections.

**Contract**: AppShell wrapper. Page title: plain `text-foreground` (no gradient). Section cards: `rounded-lg border border-border bg-card p-6` with `border-t border-border` dividers (not `white/10`). Native `<input>` / `<select>` elements use `inputClass` / `selectClass`. File inputs styled with `file:bg-primary file:text-primary-foreground` (not purple). Primary actions: default Button styling. Light layout tweak: consistent `max-w-4xl` or existing max width with reduced decorative spacing.

#### 2. Assembly catalog

**File**: `src/components/projects/AssemblyCatalog.tsx`

**Intent**: Forms and lists match project page cards.

**Contract**: Replace module-level glass input constants with imports from `form-classes.ts`. List containers: `border-border bg-muted/30` or card pattern. Buttons: remove purple ghost overrides; use outline/ghost with semantic hover (`hover:bg-accent`).

#### 3. OZC calculation panel

**File**: `src/components/projects/OzcCalculationPanel.tsx`

**Intent**: Results table readable — engineering data density on light background.

**Contract**: Remove purple Run button override. Table: `border-border`, header row `bg-muted`, numeric columns tabular-nums. Error states keep red semantic colors (not cosmic red-on-dark).

#### 4. Embedded dialogs and links

**Files**: Any remaining purple links in project context (grep-driven fixes in this phase)

**Intent**: Ensure islands loaded from `[id].astro` have no purple residue.

**Contract**: Zero `purple-*` in files touched in Phase 3.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- No `purple-` in `src/pages/projects/[id].astro` or `src/components/projects/`

#### Manual Verification:

- Project detail: climate, assemblies, ventilation, floor plan, calculation sections all readable
- Assembly CRUD and OZC Run/results work unchanged functionally
- No glass/orb artifacts on project page

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Editor Chrome

### Overview

Light toolbar and property panels; preserve dark canvas zone for PDF/plan contrast.

### Changes Required:

#### 1. Editor toolbar

**File**: `src/components/editor/EditorToolbar.tsx`

**Intent**: Light header bar with neutral active states.

**Contract**: Header: `border-border bg-background/95 backdrop-blur-sm` (not slate-950 glass). Active mode buttons: `bg-accent text-accent-foreground` (not `purple-500/20`). Links: primary/muted pattern. Icon buttons: `hover:bg-muted`.

#### 2. Side panels

**Files**: `src/components/editor/RoomPropertiesPanel.tsx`, `ScaleCalibrationPanel.tsx`, `RoomCreationPrompt.tsx`, `AssemblyPicker.tsx`

**Intent**: Form panels match project workspace styling.

**Contract**: Panel containers: `bg-card border border-border`. Inputs from `form-classes.ts`. Submit buttons without purple override.

#### 3. Floor plan editor layout

**File**: `src/components/editor/FloorPlanEditor.tsx`

**Intent**: Explicit visual split — light chrome surrounds dark canvas.

**Contract**: Outer layout flex/grid unchanged functionally. In `FloorPlanEditorLoaded`, change the outer root (`flex h-screen flex-col`) from `bg-slate-950 text-white` to `bg-background text-foreground` — toolbar and panel gutters inherit light chrome. Keep the existing `viewportRef` container dark (`bg-slate-900` or `bg-neutral-900`; already present — do not add a redundant wrapper). Migrate loading and error full-screen shells (currently `bg-slate-950`) to light engineering styling (`bg-background text-foreground`; error link uses `linkClass`, not `text-purple-300`). Remove remaining purple link classes. Back/save links use `linkClass`. Do not change canvas rendering, pan/zoom, or editor state logic.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- No `purple-` in `src/components/editor/`

#### Manual Verification:

- Editor toolbar and panels light; PDF area clearly dark
- Drawing, room creation, scale calibration, save — no functional regression
- Active tool/mode states visible on light toolbar

**Implementation Note**: Pause for human confirmation before Phase 5.

---

## Phase 5: Sweep & Verify

### Overview

Remove dead themed code, confirm zero cosmic residue, run automated checks, complete manual regression pass.

### Changes Required:

#### 1. Delete unused cosmic badge

**File**: `src/components/ui/LibBadge.astro`

**Intent**: Remove dead component with hardcoded purple/blue badge colors.

**Contract**: Delete file if grep confirms zero imports; otherwise restyle to tokens (unlikely needed).

#### 2. Repository-wide theme grep

**Files**: Any remaining hits in `src/`

**Intent**: Catch stragglers missed in Phases 2–4.

**Contract**: Search patterns: `bg-cosmic`, `purple-`, `from-blue-200`, `from-purple`, `bg-clip-text`, `white/10`, `white/20`, `backdrop-blur-xl` (review each hit — some blur may remain on light modals if subtle). Fix or document exceptions. Target: zero cosmic/SaaS patterns.

#### 3. Button/Dialog default sanity

**Files**: `src/components/ui/button.tsx`, `dialog.tsx` (read-only unless variant tweaks needed)

**Intent**: Confirm default variants look correct with new tokens — no follow-up purple overrides added back.

**Contract**: Spot-check all Button usages — prefer no `className` color overrides except layout/spacing.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Grep: no `bg-cosmic`, `purple-`, `bg-clip-text`, `white/10`, `white/20`, or `backdrop-blur-xl` under `src/` (review any `backdrop-blur-sm` on light chrome — document exceptions)

#### Manual Verification:

- Full path: sign in → create/open project → edit assemblies/climate → open editor → draw/save → run OZC → view results
- Compare before/after screenshots optional; focus on readability and consistency
- Confirm no half-migrated pages (auth light but project still cosmic)

---

## Testing Strategy

### Unit Tests:

- Not in repo scope — no test runner configured.

### Integration Tests:

- N/A — visual-only change.

### Manual Testing Steps:

1. Open `/` — tool entry, light theme, no gradients.
2. Sign in — form fields and button on light card.
3. Dashboard — list/create project dialog themed.
4. Project detail — all sections (climate, assemblies, ventilation, PDF, calc) on light cards.
5. Editor — light toolbar/panels, dark canvas; complete one edit action.
6. Run OZC — results table readable.
7. Grep verification matches plan.

## Performance Considerations

Removing `backdrop-blur-xl` and blur orbs may slightly improve paint performance — no action required. No new assets or JS.

## Migration Notes

No data migration. Deploy is a single frontend release. Rollback = revert commit. Users see new theme immediately; no feature flags needed.

## References

- Roadmap: `context/foundation/roadmap.md` (S-05)
- Token definitions: `src/styles/global.css`
- Prior cosmic patterns: subagent audit 2026-06-12 (projects/[id].astro, Welcome.astro, EditorToolbar.tsx)
- shadcn config: `components.json`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Design Tokens & App Shell

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — 10f89b5
- [x] 1.2 Production build passes: `npm run build` — 10f89b5
- [x] 1.3 `bg-cosmic` absent from `src/styles/global.css` — 10f89b5

#### Manual

- [x] 1.4 Body background renders light neutral when AppShell used — 10f89b5

### Phase 2: Auth, Landing & Dashboard

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — 9928fc4
- [x] 2.2 Production build passes: `npm run build` — 9928fc4

#### Manual

- [x] 2.3 Tool entry page — no orbs/gradients — 9928fc4
- [x] 2.4 Auth forms readable; primary buttons use blue accent — 9928fc4
- [x] 2.5 Dashboard and create-project dialog match light theme — 9928fc4

### Phase 3: Project Workspace

#### Automated

- [x] 3.1 Linting passes: `npm run lint` — ea6682c
- [x] 3.2 Production build passes: `npm run build` — ea6682c
- [x] 3.3 No `purple-` in project page and projects components — ea6682c

#### Manual

- [x] 3.4 Project detail sections readable; assembly and OZC flows work — ea6682c

### Phase 4: Editor Chrome

#### Automated

- [x] 4.1 Linting passes: `npm run lint` — 0b1e858
- [x] 4.2 Production build passes: `npm run build` — 0b1e858
- [x] 4.3 No `purple-` in editor components — 0b1e858

#### Manual

- [x] 4.4 Light chrome + dark canvas; editor actions work without regression — 0b1e858

### Phase 5: Sweep & Verify

#### Automated

- [x] 5.1 Linting passes: `npm run lint`
- [x] 5.2 Production build passes: `npm run build`
- [x] 5.3 Grep: no cosmic/glass patterns (`bg-cosmic`, `purple-`, `bg-clip-text`, `white/10`, `white/20`, `backdrop-blur-xl`) under `src/`

#### Manual

- [ ] 5.4 Full user-path manual regression pass complete
