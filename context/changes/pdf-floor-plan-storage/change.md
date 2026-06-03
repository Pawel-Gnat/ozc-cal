---
title: Per-project floor-plan PDF storage
status: impl_reviewed
created: 2026-06-03
updated: 2026-06-03
roadmap: F-02
prd: FR-007, NFR
---

## Notes

Roadmap foundation **F-02**. Private Supabase Storage for one floor-plan PDF per project; unlocks S-03 editor. Prerequisites: F-01 done; S-01/S-02 patterns available.

Planning decisions locked 2026-06-03: Supabase Storage bucket, metadata on `projects`, server-mediated upload, 50 MiB max, signed-URL GET, explicit delete, minimal UI on project detail.
