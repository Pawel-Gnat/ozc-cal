# Per-project Floor-plan PDF Storage Implementation Plan

## Overview

Roadmap foundation **F-02** (`pdf-floor-plan-storage`) adds **private Supabase Storage** for one floor-plan PDF per project, with metadata on the `projects` row, server-mediated upload/delete APIs, and an authenticated GET that returns a signed URL for read. Unlocks **S-03** (`pdf-floor-plan-editor`) without building the canvas in this change.

**PRD refs:** FR-007 (storage prerequisite), NFR (project data privacy) · **Prerequisites:** F-01 done · **Unlocks:** S-03

## Current State Analysis

- `projects` table with owner RLS; climate + assembly child tables (S-02).
- Supabase SSR client (`src/lib/supabase.ts`); project APIs use `resolveProjectRouteContext`, `isSameOriginRequest`, redirect errors.
- `supabase/config.toml`: `[storage] enabled = true`, `file_size_limit = "50MiB"`; **no buckets** configured.
- No `storage` usage in `src/`; no PDF libraries.
- Project detail (`src/pages/projects/[id].astro`) has climate + assemblies; no file upload.

### Key Discoveries:

- Stream A roadmap: `F-01 → S-01 → S-02 → **F-02** → S-03` — storage before editor.
- AGENTS.md: anon key only on Workers; no `service_role` — uploads must use cookie-bound client under RLS.
- S-02 patterns: form POST mutations, `?saved=` / `?error=` banners, English UI, hand-written `src/types.ts`.

## Desired End State

Logged-in project owner on `/projects/[id]`:

1. Uploads one PDF (≤50 MiB, validated as PDF).
2. Sees attached filename / upload time; can delete or replace via re-upload.
3. Opens authenticated GET route to obtain a short-lived signed URL for the file.
4. Other accounts cannot read, upload to, or delete another user's PDF (Storage RLS + API guards).

### Verification

- Automated: `npm run lint`, `npm run build`, migration applies via `npx supabase db reset --no-seed`.
- Manual: two-user upload/read/delete isolation; signed URL works in browser.

## What We're NOT Doing

- PDF editor, pdf.js, Konva/canvas (S-03)
- Multiple PDFs per project; version history
- Geometry, layers on plan, room drawing (S-03+)
- Cloudflare R2 or Worker-native object store
- `service_role` / bypass RLS uploads
- Client direct-to-Storage signed upload (deferred; server POST for F-02)
- DWG/DXF import (PRD non-goal)
- `supabase gen types` — hand-written `src/types.ts` only
- Extending `PROTECTED_ROUTES` (nested `/api/projects/...` already matched)

## Implementation Approach

1. Migration: private bucket `floor-plans`; `storage.objects` RLS tied to `projects.owner_id` via path `{project_id}/floor-plan.pdf`.
2. Extend `projects` with nullable floor-plan metadata columns.
3. Zod + small validation helper for PDF type and 50 MiB cap.
4. Service layer: upload (upsert object + update row), delete (remove object + null columns), signed URL create, `getProjectHasFloorPlan(project)`.
5. API routes under `/api/projects/[id]/floor-plan` — POST upload, POST delete (`_action=delete`), GET signed URL redirect.
6. Minimal UI section on project detail: upload form, status, delete button, query-param banners.

## Critical Implementation Details

**Object path convention:** `{project_id}/floor-plan.pdf` (UUID first segment). Single object per project; `upsert: true` on re-upload. Delete removes object and clears all `floor_plan_*` columns.

**Storage RLS:** Policies on `storage.objects` for `bucket_id = 'floor-plans'` must verify `(storage.foldername(name))[1]::uuid` matches a `projects.id` where `owner_id = auth.uid()`. Apply SELECT/INSERT/UPDATE/DELETE as needed for upload, read (signed URL), upsert, and delete.

**Upload atomicity:** If Storage upload succeeds but `projects` update fails, delete the uploaded object in catch (mirror assembly create rollback). If upload fails, do not mutate columns.

**Delete atomicity:** Remove the Storage object first; null `floor_plan_*` project columns only after Storage delete succeeds. If Storage delete fails, leave metadata unchanged and surface an error redirect (do not clear columns while the object may still exist). If column clear fails after Storage delete, log and throw — orphaned object is acceptable; user can re-upload to upsert the path.

**GET signed URL:** Authenticated GET only; require `floor_plan_storage_path` (or equivalent) non-null; `createSignedUrl(path, 3600)` (or similar TTL); redirect browser to signed URL (302). Return 404-style redirect to project page with error if no file.

**Workers body limit:** 50 MiB matches config; document in plan that very large uploads may need signed-URL path in S-03 if Worker memory/timeouts appear in manual test.

**S-03 CORS note:** F-02 browser open via GET → 302 to signed URL does not require bucket CORS. S-03 (pdf.js client-side fetch of signed URL from app origin) may require Supabase Storage bucket CORS configuration — verify before implementing the editor.

## Phase 1: Schema & Storage RLS

### Overview

Add bucket, storage policies, and project metadata columns.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_floor_plan_storage.sql`

**Intent**: Persist floor-plan metadata on project row; store bytes in private Storage.

**Contract**:

- Insert bucket `floor-plans` via `storage.buckets` (first storage migration in repo — use explicit SQL):

  ```sql
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('floor-plans', 'floor-plans', false, 52428800, array['application/pdf'])
  on conflict (id) do nothing;
  ```

- `projects` additions (all nullable until upload):
  - `floor_plan_storage_path` — `text` (full object path within bucket)
  - `floor_plan_filename` — `text` (original client filename for display)
  - `floor_plan_size_bytes` — `bigint`
  - `floor_plan_uploaded_at` — `timestamptz`
- RLS policies on `storage.objects` for bucket `floor-plans`:
  - Named e.g. `floor_plans_select_own`, `floor_plans_insert_own`, `floor_plans_update_own`, `floor_plans_delete_own`
  - **USING / WITH CHECK:** `bucket_id = 'floor-plans' and exists (select 1 from public.projects p where p.id = ((storage.foldername(name))[1])::uuid and p.owner_id = auth.uid())`
- Document in migration comment: one PDF per project at `{project_id}/floor-plan.pdf`.

#### 2. Local config (optional but recommended)

**File**: `supabase/config.toml`

**Intent**: Mirror bucket limits for local dev parity.

**Contract**: Uncomment/add `[storage.buckets.floor-plans]` with `public = false`, `file_size_limit = "50MiB"`, `allowed_mime_types = ["application/pdf"]`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset --no-seed`
- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Bucket `floor-plans` visible in Supabase Studio (local)
- Storage policies listed on `storage.objects`
- New columns on `projects` visible

**Implementation Note**: Pause for human manual confirmation before Phase 2.

---

## Phase 2: Domain & Services

### Overview

Types, validation, and Storage/DB service helpers.

### Changes Required:

#### 1. Extend Database types

**File**: `src/types.ts`

**Intent**: TypeScript contracts for new project columns.

**Contract**: Extend `projects` Row/Insert/Update in `Database.public.Tables`; export updated `Project` alias.

#### 2. Floor-plan validation

**File**: `src/lib/validation/floor-plan.ts`

**Intent**: Server-side validation for upload payload.

**Contract**:

- Export `FLOOR_PLAN_MAX_BYTES = 52428800` (50 MiB)
- Export `floorPlanFileSchema` (or validate function) for `File`/`Blob` from FormData: max size, MIME `application/pdf`, filename ends with `.pdf` (case-insensitive), magic bytes `%PDF-` at start (read first 5 bytes from array buffer slice)

#### 3. Floor-plan service

**File**: `src/lib/services/project-floor-plan.ts`

**Intent**: Encapsulate Storage + projects row updates.

**Contract**:

- `storagePathForProject(projectId: string): string` → `{projectId}/floor-plan.pdf`
- `getProjectHasFloorPlan(project: Project): boolean` — true when `floor_plan_storage_path != null` (and optionally filename)
- `uploadProjectFloorPlan(supabase, projectId, file: File, originalFilename: string): Promise<Project>` — upsert to Storage, update projects columns, rollback Storage on DB error
- `deleteProjectFloorPlan(supabase, project: Project): Promise<void>` — if path set, delete Storage object first; on success null all `floor_plan_*` columns; on Storage failure throw without mutating columns
- `createFloorPlanSignedUrl(supabase, project: Project, expiresInSeconds?: number): Promise<string>` — throws if no path

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Quick sanity: path helper returns expected `{uuid}/floor-plan.pdf` shape

**Implementation Note**: Pause for human manual confirmation before Phase 3.

---

## Phase 3: API Routes

### Overview

Upload, delete, and signed-URL read endpoints.

### Changes Required:

#### 1. Floor-plan API

**File**: `src/pages/api/projects/[id]/floor-plan.ts`

**Intent**: FR-007 storage backend (upload/read/delete).

**Contract**:

- `export const prerender = false`
- **POST:** `resolveProjectRouteContext` → `isSameOriginRequest` → if `_action=delete` then `deleteProjectFloorPlan` → redirect `?saved=floor-plan-removed` or error; else parse `formData` file field (e.g. `floor_plan_file`) → validate → `uploadProjectFloorPlan` → redirect `?saved=floor-plan`
  - First file-upload route in repo — sketch: `const file = form.get("floor_plan_file"); if (!(file instanceof File)) { redirect error }`; validate via `floorPlanFileSchema`; pass `File` to service (service reads `arrayBuffer()` for magic bytes + Storage upload)
- **GET:** auth + project context → if no floor plan redirect with error → `createFloorPlanSignedUrl` → `302` redirect to signed URL (or return redirect to project with error on failure)
- Errors via `projectMutationErrorRedirect` / consistent messages
- No JSON 400 — redirect pattern matches S-02

#### 2. Detail resolver extension

**File**: `src/lib/projects/resolve-project-detail.ts`

**Intent**: Expose `hasFloorPlan` (and optional filename/size for UI) on detail payload.

**Contract**: Extend `ResolveProjectDetailResult` ok branch with `hasFloorPlan: boolean` (and display fields from `project` row as needed).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- POST upload without auth → redirect sign-in
- POST upload without Origin (curl) → blocked by dev CSRF or app same-origin check
- GET without auth → sign-in
- POST delete and re-upload cycle via curl/browser with session (dev `curl` POST: include `-H "Origin: http://localhost:4321"` with session cookie, or use browser form POST on same origin)

**Implementation Note**: Pause for human manual confirmation before Phase 4.

---

## Phase 4: Project Detail UI

### Overview

Minimal upload/delete/status on existing project detail shell.

### Changes Required:

#### 1. Project detail page

**File**: `src/pages/projects/[id].astro`

**Intent**: User-visible F-02 affordances without editor.

**Contract**:

- New section **Floor plan** (after assemblies or before — consistent ordering)
- When no PDF: `multipart/form-data` POST form to `/api/projects/{id}/floor-plan` with file input `name="floor_plan_file"` accept `.pdf,application/pdf`
- When PDF attached: show `floor_plan_filename`, uploaded date, link/button to open GET route (new tab), delete form POST with `_action=delete` + confirm optional (`window.confirm` acceptable)
- Extend `saved` banner map: `floor-plan` → "Floor plan uploaded.", `floor-plan-removed` → "Floor plan removed."
- Reuse dashboard error/success banner styling for `?error=`

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Upload PDF from UI → success banner → reload shows metadata
- Open/download via GET link returns PDF in browser
- Delete removes file and UI returns to upload state
- English labels

**Implementation Note**: Pause for human manual confirmation before Phase 5.

---

## Phase 5: Verification & Documentation

### Overview

End-to-end manual verification and README touch-up.

### Changes Required:

#### 1. README migration note

**File**: `README.md`

**Intent**: Document Storage bucket and floor-plan workflow.

**Contract**: Under Supabase section: F-02 adds `floor-plans` bucket + project columns; note cloud bucket/policy apply via `db push`; mention 50 MiB PDF limit.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- User A uploads PDF → GET opens file → delete works
- User B same project URL / API tampering → not found or redirect error
- User B cannot access Storage object path directly (unsigned)
- Dashboard / climate / assemblies unchanged (no regression)
- Large PDF smoke test: upload a ≥10 MiB PDF locally and on deployed Worker; note pass/fail (Worker memory/timeout risk)

**Implementation Note**: Final sign-off for F-02 foundation complete.

---

## Testing Strategy

### Unit Tests:

- Not in repo scope per AGENTS.md unless requested.

### Integration Tests:

- None configured; rely on two-user manual Storage + API check.

### Manual Testing Steps:

1. `nvm use && npm run dev` with local Supabase migrated.
2. Create/open project → upload sample PDF → verify metadata on detail page.
3. Click view/download → PDF opens via signed URL.
4. Delete floor plan → upload state restored.
5. Second user: same project id + storage path → denied.

## Performance Considerations

- Single PDF per project; no list pagination needed.
- Signed URL avoids proxying multi-MB bodies through Worker on read.
- Upload holds full file in Worker memory once — monitor at 50 MiB.

## Migration Notes

- Apply locally: `npx supabase db reset --no-seed`
- Apply cloud: `npx supabase db push`; verify bucket exists in dashboard
- Existing projects: all floor-plan columns null until upload

## References

- Roadmap F-02: `context/foundation/roadmap.md:79-90`
- PRD FR-007 / privacy: `context/foundation/prd.md`
- S-02 API patterns: `src/pages/api/projects/[id]/climate.ts`, `src/lib/api/project-route-helpers.ts`
- Archived S-02 plan: `context/archive/2026-06-02-climate-and-assemblies/plan.md`
- Supabase Storage RLS: Supabase docs — storage access control

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema & Storage RLS

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset --no-seed` — 9bdcd6c
- [x] 1.2 Linting passes: `npm run lint` — 9bdcd6c
- [x] 1.3 Production build passes: `npm run build` — 9bdcd6c

#### Manual

- [x] 1.4 Bucket, storage policies, and project columns verified in Supabase Studio — 9bdcd6c
- [x] 1.5 Storage RLS path tied to project owner spot-checked — 9bdcd6c

### Phase 2: Domain & Services

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — 399f546
- [x] 2.2 Production build passes: `npm run build` — 399f546

#### Manual

- [x] 2.3 Path helper and validation sanity check on sample PDF bytes — 399f546

### Phase 3: API Routes

#### Automated

- [x] 3.1 Linting passes: `npm run lint`
- [x] 3.2 Production build passes: `npm run build`

#### Manual

- [x] 3.3 Upload, GET signed URL, and delete verified via browser or curl with session

### Phase 4: Project Detail UI

#### Automated

- [ ] 4.1 Linting passes: `npm run lint`
- [ ] 4.2 Production build passes: `npm run build`

#### Manual

- [ ] 4.3 Floor plan upload, view, and delete UX verified on project detail

### Phase 5: Verification & Documentation

#### Automated

- [ ] 5.1 Linting passes: `npm run lint`
- [ ] 5.2 Production build passes: `npm run build`

#### Manual

- [ ] 5.3 Two-user Storage and API isolation regression complete
- [ ] 5.4 No regression on dashboard, climate, and assemblies flows
- [ ] 5.5 Large PDF upload smoke test (≥10 MiB) on dev and Worker
