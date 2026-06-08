# PDF Floor Plan Editor Implementation Plan

## Overview

Roadmap slice **S-03** (`pdf-floor-plan-editor`) delivers FR-006 (per-room gravity ventilation inputs), FR-007 (PDF-backed graphic editor with assembly-assigned layers), and FR-008 (orthogonal drawing, connected segments, closed rooms with internal temperature). Builds on S-02 (assemblies, climate) and F-02 (PDF storage). Unlocks **S-04** (first OZC calculation).

**PRD refs:** FR-006, FR-007, FR-008 · **Prerequisites:** S-02, F-02 done · **Unlocks:** S-04

## Current State Analysis

- **PDF storage (F-02):** Private bucket `floor-plans`, metadata on `projects`, upload/delete on project detail, GET → signed URL redirect (`src/pages/api/projects/[id]/floor-plan.ts`, `src/lib/services/project-floor-plan.ts`).
- **Assemblies (S-02):** Eight categories on `assemblies` table; material layers for thermal preview — not geometric layers (`src/types.ts`, `AssemblyCatalog.tsx`).
- **No editor:** No pdf.js/canvas deps in `package.json`; no geometry tables; no `/projects/[id]/editor` route; no JSON API routes.
- **Auth:** `/projects` and `/api/projects` prefix-protected in `src/middleware.ts`; unauthenticated API calls redirect to sign-in (HTML), not JSON 401.

### Key Discoveries:

- F-02 plan flagged S-03 CORS: client-side pdf.js fetch of signed URLs is unreliable on hosted Supabase — use same-origin Worker byte proxy instead (`context/archive/2026-06-03-pdf-floor-plan-storage/plan.md`).
- Infrastructure pre-mortem: canvas/pdf work must stay **client-side**; Workers only proxy bytes (`context/foundation/infrastructure.md`).
- Roadmap open question on ventilation UX order resolved in planning: configure in per-room panel after room creation.
- `assembly_layers` (S-02) = material stack; S-03 **segments** = geometric walls on PDF — distinct domain concepts.

## Desired End State

Logged-in project owner:

1. Opens `/projects/[id]/editor` when climate, at least one assembly, and floor-plan PDF exist.
2. Sees PDF rendered via pdf.js; completes **two-point scale calibration** before drawing is enabled.
3. Draws **orthogonal segments** (H/V lock, snap to nodes/endpoints) each assigned to a project assembly.
4. **Auto-detected closed loops** (with manual fallback) become **rooms** with internal temperature.
5. Configures **gravity ventilation** (supply, exhaust, natural numeric inputs) per room in a properties panel.
6. State **auto-saves** via debounced PUT; reload restores geometry and room data.
7. Other accounts cannot access editor API or data (RLS).

### Verification

- Automated: `npm run lint`, `npm run build`, migration applies via `npx supabase db reset --no-seed`.
- Manual: full editor walkthrough; two-user API isolation; typical PDF usability check (readability, pan/zoom, snap).

## What We're NOT Doing

- Run OZC or display heat-loss results (FR-009, S-04, F-03)
- Implement ventilation calculation model (F-03) — S-03 stores inputs only
- In-editor PDF import/replace (PDF managed on project detail via F-02)
- Undo/redo stack; version history; collaborative editing
- Openings as separate placed objects (windows/doors are segments with window/door assembly category)
- Multi-storey; DWG/DXF; 3D; mobile layout
- Polish UI strings (English matches S-01/S-02)
- Konva or third-party drawing framework (HTML Canvas overlay chosen)
- `supabase gen types` — hand-written `src/types.ts` only
- Extending `PROTECTED_ROUTES` (nested `/projects/...` and `/api/projects/...` already matched)

## Implementation Approach

1. **Schema:** Normalized node-edge geometry + rooms + scale columns; owner RLS via `projects`.
2. **API:** First JSON REST surface — GET/PUT `/api/projects/[id]/editor`; PDF bytes at `/floor-plan/data`; shared JSON error helpers; middleware returns 401 JSON for unauthenticated `/api/projects/*` (not `/api/auth/*`).
3. **Client:** Astro editor page with `FloorPlanEditor` React island (`client:only="react"`); pdf.js for background; HTML Canvas for vectors; debounced auto-save.
4. **UX flow:** Prerequisites gate → scale calibration → draw segments → detect/create rooms → room properties (temp + ventilation).
5. **Integration:** “Open editor” link on project detail when gated prerequisites met.

## Critical Implementation Details

**PDF loading:** Do not fetch Supabase signed URLs from the browser for pdf.js. Add authenticated same-origin `GET /api/projects/[id]/floor-plan/data` that uses server Supabase client `.download()` and streams PDF bytes. Keep existing 302 GET on `/floor-plan` for “open in new tab” on project detail.

**pdf.js bundling:** Import `pdfjs-dist` only from client-only modules. Configure Vite worker via `pdfjs-dist/build/pdf.worker.min.mjs?worker` (or `?url` fallback). Do not add pdf.js to SSR bundle — use `client:only="react"` on the editor island.

**Coordinate space:** Store node `x`/`y` in PDF viewport pixel space (same space as pdf.js `page.getViewport({ scale: 1 })`). Scale calibration stores two clicked points + known real-world distance; derive and persist `scale_meters_per_unit` on the project row. All segment lengths for display derive from pixel distance × scale. **Pan/zoom:** Apply identical CSS transform to background and overlay canvases; convert pointer events from screen space to unscaled PDF coordinates via inverse transform before snap/draw; never persist pan/zoom offsets in the database.

**Segment orthogonality:** Enforce H/V at draw time (client) and validate on PUT (server Zod superRefine): segment endpoints share `x` or share `y`.

**Room detection:** Run cycle detection on the segment graph when segments change; surface “Create room from loop” when a simple closed cycle is found. Manual fallback: user selects a connected segment set and confirms room creation.

**Ventilation fields:** Store nullable numerics per room (`ventilation_supply`, `ventilation_exhaust`, `ventilation_natural`) — units and semantics documented as F-03 inputs; English labels in UI (“Supply”, “Exhaust”, “Natural”).

**Shared internal walls (MVP):** `UNIQUE (segment_id)` on `plan_room_segments` means each segment belongs to at most one room. A partition between two rooms cannot be shared in the junction table — draw two colocated segments (same geometry, same `internal_partition` assembly) or assign to one room only until F-03/S-04 defines shared-boundary semantics. Document this in room-creation UI helper text.

## Phase 1: Schema & Editor API

### Overview

Persist plan geometry, scale, rooms, and ventilation inputs with owner RLS. Expose JSON read/write API and PDF byte proxy.

### Changes Required:

#### 1. Migration — geometry schema

**File**: `supabase/migrations/YYYYMMDDHHmmss_floor_plan_editor.sql`

**Intent**: Store editor state in normalized tables scoped to project owner.

**Contract**:

- Extend `projects` with scale calibration (nullable until set):
  - `plan_scale_point_a_x`, `plan_scale_point_a_y`, `plan_scale_point_b_x`, `plan_scale_point_b_y` — `double precision`
  - `plan_scale_known_length_m` — `numeric` (> 0 when set)
  - `plan_scale_meters_per_unit` — `numeric` (computed meters per PDF pixel unit)
- Table `plan_nodes`: `id uuid PK`, `project_id FK → projects ON DELETE CASCADE`, `x`, `y` (`double precision`), `created_at`
- Table `plan_segments`: `id uuid PK`, `project_id FK`, `start_node_id FK → plan_nodes`, `end_node_id FK → plan_nodes`, `assembly_id FK → assemblies`, `created_at`; CHECK `start_node_id <> end_node_id`
- Table `plan_rooms`: `id uuid PK`, `project_id FK`, `name text` (optional), `internal_temp_c numeric`, `ventilation_supply numeric`, `ventilation_exhaust numeric`, `ventilation_natural numeric` (all ventilation nullable), `created_at`, `updated_at`
- Table `plan_room_segments`: `room_id FK → plan_rooms ON DELETE CASCADE`, `segment_id FK → plan_segments ON DELETE CASCADE`, `segment_order smallint`; PK `(room_id, segment_id)`; UNIQUE on `segment_id` (each segment belongs to at most one room in MVP)
- RLS on all new tables: `EXISTS (SELECT 1 FROM projects p WHERE p.id = <table>.project_id AND p.owner_id = auth.uid())` — mirror `assemblies` pattern
- Indexes on `project_id` for all child tables

#### 2. TypeScript types

**File**: `src/types.ts`

**Intent**: Extend hand-written `Database` type with new tables and project scale columns.

**Contract**: Row/Insert/Update types for `plan_nodes`, `plan_segments`, `plan_rooms`, `plan_room_segments`; exported aliases `PlanNode`, `PlanSegment`, `PlanRoom`, etc.

#### 3. Validation schemas

**File**: `src/lib/validation/editor.ts`

**Intent**: Zod schemas for PUT body and nested geometry invariants.

**Contract**:

- `planNodeSchema`, `planSegmentSchema`, `planRoomSchema`, `planScaleSchema`
- `editorStateSchema` — full document: scale fields, nodes[], segments[], rooms[] (each room includes ordered segment ids)
- `superRefine` rules: orthogonal segments; segment node ids reference existing nodes; room segment ids reference project segments; assembly ids belong to project; internal temp bounds (e.g. 5–35°C); scale complete or all scale fields null

#### 4. JSON API helpers

**File**: `src/lib/api/json-response.ts`

**Intent**: Consistent JSON success/error bodies for first REST API.

**Contract**: `jsonOk(data, meta?)`, `jsonError(status, message, code, issues?)` — error shape `{ error: { message, code, issues? } }`

**File**: `src/lib/api/project-route-helpers.ts` (extend)

**Intent**: JSON-aware project resolution parallel to redirect helper.

**Contract**: `resolveProjectApiContext(context, rawProjectId)` → `{ ok: true, supabase, project, projectId } | { ok: false, status, body }` — map no user → 401, bad UUID / not found → 404, DB error → 500

#### 5. Editor service

**File**: `src/lib/services/project-editor.ts`

**Intent**: Load and replace full editor state atomically.

**Contract**:

- `getEditorState(supabase, projectId)` → nodes, segments, rooms, scale fields, `updated_at` meta
- `replaceEditorState(supabase, projectId, input: EditorStateInput)` — transaction-like sequence: validate assembly ownership; delete/replace child rows for project in order `plan_rooms` → `plan_segments` → `plan_nodes` (junction rows cascade via `ON DELETE CASCADE` on `plan_room_segments`); insert in reverse order; update project scale columns. **Every PUT is a full document replace** — client must send complete `nodes`, `segments`, and `rooms` arrays on every save (scale-only saves use empty arrays).
- `getProjectEditorReady(project, assembliesCount)` — boolean: `hasClimate && hasFloorPlan && assembliesCount > 0`

#### 6. Floor plan byte download

**File**: `src/lib/services/project-floor-plan.ts` (extend)

**Intent**: Server-side PDF bytes for pdf.js proxy.

**Contract**: `downloadProjectFloorPlan(supabase, project): Promise<{ data: ArrayBuffer; filename: string } | null>` — uses `.download(path)` after path assertion (mirror signed URL guard)

#### 7. API routes

**File**: `src/pages/api/projects/[id]/editor.ts`

**Intent**: JSON CRUD for editor auto-save.

**Contract**:

- `GET` → resolve → check editor prerequisites → `getEditorState` → `200 { data, meta }`
- `PUT` → resolve → `isSameOriginRequest` → `request.json()` → `editorStateSchema.safeParse` → `replaceEditorState` → `200 { data, meta }`
- Prerequisite failure → `422` with `code: PRECONDITION_FAILED`

**File**: `src/pages/api/projects/[id]/floor-plan/data.ts`

**Intent**: Same-origin PDF bytes for pdf.js.

**Contract**: Authenticated GET → resolve project → `downloadProjectFloorPlan` → `Response` with `Content-Type: application/pdf`, `Content-Disposition: inline; filename="..."`; 404 JSON if no floor plan

#### 8. Middleware JSON 401

**File**: `src/middleware.ts`

**Intent**: Allow `fetch()` to detect unauthenticated API calls.

**Contract**: When path starts with `/api/projects/` and no user, return `401` JSON `{ error: { message, code: "UNAUTHORIZED" } }` instead of redirect. Leave `/api/auth/*` unauthenticated (sign-in/sign-up forms). Non-API paths and HTML form POST behavior unchanged.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset --no-seed`
- Linting passes: `npm run lint`
- Type checking / build passes: `npm run build`

#### Manual Verification:

- PUT then GET editor API returns identical geometry for owner (curl or DevTools with session cookie)
- User B cannot GET/PUT User A's editor state
- `/floor-plan/data` returns PDF bytes for owner; 404/401 for missing or unauthorized

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Editor Shell & PDF Render

### Overview

Gated editor page, pdf.js background rendering, pan/zoom, and two-point scale calibration UI that blocks drawing until complete.

### Changes Required:

#### 1. Dependency

**File**: `package.json`

**Intent**: Add PDF rendering library.

**Contract**: `"pdfjs-dist": "5.4.296"` (pin; verify worker bundles after `npm run build`)

#### 2. pdf.js client setup

**File**: `src/lib/pdf/setup-pdfjs.ts`

**Intent**: One-time worker initialization for client imports.

**Contract**: Export configured `pdfjs` namespace; worker via Vite `?worker` import; module must only be imported from client components

#### 3. PDF page renderer

**File**: `src/lib/pdf/render-page-to-canvas.ts`

**Intent**: Render first PDF page to background canvas with devicePixelRatio scaling.

**Contract**: `(pdfDocument, canvas, scale?) => Promise<{ width, height }>` using pdf.js viewport dimensions

#### 4. Editor page route

**File**: `src/pages/projects/[id]/editor.astro`

**Intent**: SSR shell for full-screen editor with prerequisite gate.

**Contract**:

- `export const prerender = false`
- Resolve project via `resolveProjectDetail` pattern; redirect if not found
- If `!hasClimate || !hasFloorPlan || assemblies.length === 0` → redirect `/projects/[id]?error=...` with specific message
- Pass `projectId`, `assemblies` (id, name, category), initial scale fields to React island
- Mount `FloorPlanEditor` with `client:only="react"`

#### 5. Editor resolver helper

**File**: `src/lib/projects/resolve-project-editor.ts`

**Intent**: Shared gate logic for editor page and future links.

**Contract**: Returns project + assemblies + flags or redirect location; reuses `loadProjectBuildingParameters`

#### 6. FloorPlanEditor shell component

**File**: `src/components/editor/FloorPlanEditor.tsx`

**Intent**: Client root: load PDF, render background, host overlay canvas container, toolbar slot.

**Contract**:

- Fetch `/api/projects/${id}/floor-plan/data` → arrayBuffer → pdf.js document
- Background `<canvas>` sized to viewport; pan (drag) and zoom (wheel/buttons) transform both canvases identically
- Load initial editor state via GET `/api/projects/${id}/editor`
- Scale calibration mode when `plan_scale_meters_per_unit` is null: user clicks two points, enters known length (m), computes scale, PUT saves full document (scale fields + empty `nodes`/`segments`/`rooms` arrays) before enabling draw tools
- Save status indicator (idle / saving / saved / error)

#### 7. Editor layout components

**File**: `src/components/editor/EditorToolbar.tsx`

**Intent**: Zoom controls, mode indicator (calibrate / draw / select), save status.

**Contract**: Props for zoom level, active mode, onZoom, disabled states when calibrating

**File**: `src/components/editor/ScaleCalibrationPanel.tsx`

**Intent**: Instructions + known-length input for two-point calibration.

**Contract**: Activates before draw; calls parent with two points + length; validates length > 0

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes with pdf.js worker asset: `npm run build`

#### Manual Verification:

- Editor page loads PDF for project with floor plan; pan/zoom works smoothly
- Prerequisites redirect with clear error when climate, assemblies, or PDF missing
- Scale calibration completes and persists across reload; draw tools remain disabled until scale set

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Drawing & Geometry

### Overview

Overlay canvas drawing tools: orthogonal segment creation with endpoint snap, assembly assignment, and debounced auto-save.

### Changes Required:

#### 1. Geometry utilities

**File**: `src/lib/editor/geometry.ts`

**Intent**: Pure functions for snap, orthogonality, hit testing.

**Contract**:

- `snapToNodes(point, nodes, thresholdPx)` → snapped point + optional node id
- `constrainOrthogonal(start, cursor)` → H or V endpoint from axis lock
- `distancePx(a, b)`, `segmentLengthM(segment, nodes, scaleMetersPerUnit)`
- `findNearestSegment(point, segments, nodes, threshold)` for selection

#### 2. Editor state hook

**File**: `src/components/hooks/useEditorState.ts`

**Intent**: Client state for nodes, segments, debounced persistence.

**Contract**:

- Holds nodes[], segments[], rooms[], scale fields, dirty flag
- `scheduleSave()` debounced PUT (e.g. 800ms) to `/api/projects/[id]/editor` with **complete document** on every save (merge local state before PUT; never send partial body)
- Merge server response meta on success; surface validation errors

#### 3. Overlay canvas renderer

**File**: `src/components/editor/PlanOverlayCanvas.tsx`

**Intent**: Draw segments, nodes, preview line, snap indicators on HTML canvas.

**Contract**: Props for nodes, segments, assemblies (colors by category optional), active tool state, transform (pan/zoom); redraw on state/transform change

#### 4. Drawing interaction

**File**: `src/components/editor/FloorPlanEditor.tsx` (extend)

**Intent**: Wire pointer events for segment tool.

**Contract**:

- Tool: **Segment** — user selects assembly in toolbar first (segment tool disabled until assembly chosen); click start (create node or snap), move with H/V lock, click end (create node or snap), commit segment with pre-selected assembly
- Prevent duplicate nodes at same coordinates (merge on snap)
- Reject zero-length segments
- Only enabled when scale is set

#### 5. Assembly picker

**File**: `src/components/editor/AssemblyPicker.tsx`

**Intent**: Choose assembly for new segment from project catalog.

**Contract**: Lists assemblies grouped or filtered by category; returns `assembly_id`; shadcn Select or Dialog pattern matching existing UI

#### 6. Segment selection & delete

**File**: `src/components/editor/FloorPlanEditor.tsx` (extend)

**Intent**: Minimal edit affordances for MVP.

**Contract**: Select tool clicks segment → highlight; Delete key or toolbar button removes segment (and orphan nodes if no longer referenced); auto-save after mutation

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Draw H/V segments that snap to existing endpoints; diagonal segments rejected
- Each segment requires assembly assignment; reload restores segments with correct assemblies
- Auto-save debounces rapid draws; save indicator reflects state
- Delete segment updates persistence

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Rooms & Ventilation

### Overview

Detect closed segment loops, create rooms with internal temperature, and per-room gravity ventilation fields in a properties panel.

### Changes Required:

#### 1. Loop detection

**File**: `src/lib/editor/room-detection.ts`

**Intent**: Find simple cycles in segment graph for room creation suggestions.

**Contract**:

- `findClosedLoops(segments, nodes): segmentId[][]` — return minimal cycles (cap count for performance, e.g. first 10)
- Used client-side after segment changes; manual selection fallback when auto-detect ambiguous

#### 2. Room creation UI

**File**: `src/components/editor/RoomCreationPrompt.tsx`

**Intent**: Confirm auto-detected loop or manual segment selection as room.

**Contract**: Shows loop preview on overlay; “Create room” adds `plan_rooms` row + `plan_room_segments`; optional default name (“Room 1”, increment)

#### 3. Room properties panel

**File**: `src/components/editor/RoomPropertiesPanel.tsx`

**Intent**: Edit room name, internal temperature, ventilation fields (FR-006).

**Contract**:

- Fields: name (optional), `internal_temp_c` (required for room), `ventilation_supply`, `ventilation_exhaust`, `ventilation_natural` (nullable numerics)
- English labels; helper text that values feed OZC calculation (F-03)
- Updates local state + debounced PUT with full editor document

#### 4. Room visualization

**File**: `src/components/editor/PlanOverlayCanvas.tsx` (extend)

**Intent**: Visual feedback for rooms.

**Contract**: Light fill inside closed room polygon (computed from segment loop); click room fill opens properties panel; show room label + temp when set

#### 5. Manual room fallback

**File**: `src/components/editor/FloorPlanEditor.tsx` (extend)

**Intent**: When auto-detect fails, user selects consecutive segments and confirms room.

**Contract**: Multi-select mode on segments; validate selection forms closed chain before create

#### 6. Validation updates

**File**: `src/lib/validation/editor.ts` (extend)

**Intent**: Server-side room invariants.

**Contract**: Room must have ≥3 segments; ordered segments form closed chain; `internal_temp_c` required when room present; ventilation fields optional numeric

### Success Criteria:

#### Automated Verification:

- Migration still applies: `npx supabase db reset --no-seed`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Auto-detected rectangular room creates room with temp; ventilation saved per room
- Manual room creation works when auto-detect not offered
- Reload restores rooms, temperatures, and ventilation fields
- Room without internal temp rejected by validation (UI + API)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Integration & Verification

### Overview

Connect project detail to editor, polish prerequisite messaging, document architecture, and run full manual verification.

### Changes Required:

#### 1. Project detail entry link

**File**: `src/pages/projects/[id].astro`

**Intent**: Primary navigation into editor when ready.

**Contract**:

- When `hasClimate && hasFloorPlan && assemblies.length > 0`: show prominent “Open floor plan editor” link to `/projects/[id]/editor`
- When floor plan present but other prerequisites missing: show disabled state + hint (e.g. “Save climate and add assemblies first”)
- Back link from editor to project detail

#### 2. Editor top bar

**File**: `src/components/editor/EditorToolbar.tsx` (extend)

**Intent**: Project context and navigation.

**Contract**: Project name, link back to `/projects/[id]`, optional link to open raw PDF in new tab via existing `/floor-plan` GET

#### 3. README

**File**: `README.md`

**Intent**: Document editor route, API endpoints, PDF proxy rationale.

**Contract**: Short section under project features: editor prerequisites, `/api/projects/[id]/editor`, `/floor-plan/data`, local dev notes for pdf.js worker

#### 4. Change status

**File**: `context/changes/pdf-floor-plan-editor/change.md`

**Intent**: Mark plan complete for implement handoff.

**Contract**: `status: planned`, `updated: 2026-06-08`

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- End-to-end FR-006–008 walkthrough on a typical single-storey PDF: scale → draw walls/windows → create rooms → set temp + ventilation → reload
- Second user isolation on editor page and APIs
- Editor remains readable/usabled at reasonable zoom on a typical architectural PDF (guardrail from PRD)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Not configured in repo — defer unless user requests test stack
- Pure functions in `geometry.ts` and `room-detection.ts` are the best candidates if tests are added later

### Integration Tests:

- Manual API checks: GET/PUT editor round-trip; floor-plan data auth
- Two-browser-session RLS isolation

### Manual Testing Steps:

1. Create project → climate → assembly → upload PDF → open editor
2. Calibrate scale with known dimension on plan
3. Draw perimeter walls (external_wall), window/door segments, internal partition
4. Create two rooms with different internal temperatures
5. Set ventilation values per room; reload and verify persistence
6. Attempt editor access without PDF — expect redirect with error
7. Second account attempts API tampering with project UUID — expect 404/403

## Performance Considerations

- pdf.js and canvas run client-only — no Worker CPU for rendering
- PDF byte proxy may transfer up to 50 MiB once per editor session — acceptable MVP; consider streaming response body
- Debounced auto-save (800ms) limits PUT frequency
- MVP assumes single editor tab per project; PUT is last-write-wins with no version/conflict detection — revisit if multi-tab data loss is reported
- Room loop detection capped on large graphs to avoid UI jank
- Pan/zoom redraws: requestAnimationFrame batching on overlay canvas

## Migration Notes

- New tables are empty for existing projects — no backfill required
- Scale columns nullable — editor forces calibration on first use
- Deploy order: apply Supabase migration (`db push`) before Worker deploy that expects new columns/API

## References

- PRD FR-006–008: `context/foundation/prd.md`
- Roadmap S-03: `context/foundation/roadmap.md`
- F-02 storage (PDF proxy note): `context/archive/2026-06-03-pdf-floor-plan-storage/plan.md`
- S-02 assembly patterns: `context/archive/2026-06-02-climate-and-assemblies/plan.md`
- Infrastructure Workers/canvas: `context/foundation/infrastructure.md`
- Floor plan service: `src/lib/services/project-floor-plan.ts`
- Assembly validation pattern: `src/lib/validation/assembly.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema & Editor API

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset --no-seed` — 085a4fd
- [x] 1.2 Linting passes: `npm run lint` — 085a4fd
- [x] 1.3 Type checking / build passes: `npm run build` — 085a4fd

#### Manual

- [x] 1.4 PUT then GET editor API returns identical geometry for owner — 085a4fd
- [x] 1.5 User B cannot GET/PUT User A's editor state — 085a4fd
- [x] 1.6 `/floor-plan/data` returns PDF bytes for owner; 404/401 for missing or unauthorized — 085a4fd

### Phase 2: Editor Shell & PDF Render

#### Automated

- [ ] 2.1 Linting passes: `npm run lint`
- [ ] 2.2 Build passes with pdf.js worker asset: `npm run build`

#### Manual

- [ ] 2.3 Editor page loads PDF; pan/zoom works smoothly
- [ ] 2.4 Prerequisites redirect with clear error when climate, assemblies, or PDF missing
- [ ] 2.5 Scale calibration completes and persists across reload; draw tools disabled until scale set

### Phase 3: Drawing & Geometry

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Build passes: `npm run build`

#### Manual

- [ ] 3.3 Draw H/V segments with endpoint snap; diagonals rejected
- [ ] 3.4 Segments require assembly assignment; reload restores correctly
- [ ] 3.5 Auto-save debounces rapid draws; delete segment persists

### Phase 4: Rooms & Ventilation

#### Automated

- [ ] 4.1 Migration still applies: `npx supabase db reset --no-seed`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build passes: `npm run build`

#### Manual

- [ ] 4.4 Auto-detected room with temp and ventilation saves and reloads
- [ ] 4.5 Manual room creation works when auto-detect not offered
- [ ] 4.6 Room without internal temp rejected by validation

### Phase 5: Integration & Verification

#### Automated

- [ ] 5.1 Linting passes: `npm run lint`
- [ ] 5.2 Build passes: `npm run build`

#### Manual

- [ ] 5.3 End-to-end FR-006–008 walkthrough on typical PDF
- [ ] 5.4 Second user isolation on editor page and APIs
- [ ] 5.5 Editor readable/usable at reasonable zoom on typical architectural PDF
