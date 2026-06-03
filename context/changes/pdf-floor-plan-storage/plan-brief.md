# Per-project Floor-plan PDF Storage — Plan Brief

> Full plan: `context/changes/pdf-floor-plan-storage/plan.md`

## What & Why

Add private, owner-scoped storage for one floor-plan PDF per project so S-03 can import and render a plan in the editor (FR-007). This is roadmap **F-02** — the persistence layer for the product differentiator (PDF-backed workflow), under PRD project-data privacy guardrails.

## Starting Point

Projects, climate, and assemblies persist in Postgres with owner RLS (F-01, S-01, S-02). Supabase Storage is enabled locally (`supabase/config.toml`, 50 MiB limit) but **no buckets, policies, or upload code** exist. Project detail has climate + assemblies UI; no file handling.

## Desired End State

Logged-in project owner can upload a PDF (≤50 MiB), see that a floor plan is attached on `/projects/[id]`, download it via an authenticated signed-URL route, and delete it. Storage and metadata are invisible to other accounts (RLS + storage policies). S-03 inherits a stable path convention and read API.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Storage backend | Supabase Storage private bucket | Same stack as auth/DB; no R2 or service_role on Workers | Plan |
| PDFs per project | One active file; re-upload replaces | Matches single-storey MVP and simple path `{project_id}/floor-plan.pdf` | Plan |
| Metadata | Columns on `projects` | Fast `hasFloorPlan` on detail load; mirrors climate columns pattern | Plan |
| Upload flow | Server-mediated multipart POST | Matches S-02 form POST + same-origin + cookie auth | Plan |
| Max size | 50 MiB | Aligns with local `config.toml`; user headroom for scans | Plan |
| Read path | Authenticated GET → signed URL | Efficient for future pdf.js; avoids proxying bytes through Worker | Plan |
| Delete | POST `_action=delete` | Symmetric with assemblies; clears storage + columns | Plan |
| Validation | MIME + extension + `%PDF-` magic bytes | Blocks obvious non-PDF uploads before Storage write | Plan |
| F-02 UI | Minimal upload/delete on project detail | End-to-end verifiable before S-03 editor | Plan |

## Scope

**In scope:** Storage bucket migration + RLS, project metadata columns, validation, services, upload/delete/read API routes, minimal project detail UI, README note, two-user isolation check

**Out of scope:** PDF editor/canvas (S-03), pdf.js rendering, geometry, multiple PDFs per project, version history, Cloudflare R2, `service_role` key, DWG/DXF

## Architecture / Approach

```
Browser (multipart POST) → Astro API /api/projects/[id]/floor-plan
    → cookie Supabase client → storage.from('floor-plans').upload({project_id}/floor-plan.pdf)
    → update projects.floor_plan_* columns

Browser (GET) → same route → createSignedUrl → redirect to Storage CDN URL

storage.objects RLS + projects.owner_id = auth.uid() (path first segment = project_id)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema & Storage RLS | Bucket, storage policies, project columns | Storage policy path parsing leaks cross-user files |
| 2. Domain & Services | Types, Zod, storage helpers | Type drift; upload rollback if DB update fails |
| 3. API Routes | POST upload/delete, GET signed URL | Workers memory on 50 MiB upload |
| 4. Project Detail UI | Upload form, status, delete, banners | Multipart form + Astro patterns |
| 5. Verification & Docs | README, manual RLS checklist | Cloud bucket must be created on remote Supabase |

**Prerequisites:** F-01/S-01/S-02 done; local Supabase migrated; `.env` + `.dev.vars`
**Estimated effort:** ~2 sessions across 5 phases (new Storage surface)

## Open Risks & Assumptions

- **Cloudflare Workers** may struggle with 50 MiB in-memory multipart parsing — monitor; signed-URL upload is the escape hatch for S-03 if needed
- Remote Supabase project needs bucket + storage policies applied (`db push` + dashboard verify)
- CI does not apply migrations; cloud apply remains manual per README
- F-02 does not implement pdf.js — S-03 consumes GET signed URL only

## Success Criteria (Summary)

- Owner uploads PDF → metadata + object persist → reload shows attached state
- Authenticated GET returns working signed URL; delete clears storage and columns
- User B cannot upload/read/delete User A's PDF (API tampering + Storage policy)
- `npm run lint` and `npm run build` pass
