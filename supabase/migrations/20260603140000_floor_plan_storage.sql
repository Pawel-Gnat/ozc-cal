-- F-02: private floor-plan PDF storage (one object per project at {project_id}/floor-plan.pdf)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('floor-plans', 'floor-plans', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

alter table public.projects
  add column floor_plan_storage_path text,
  add column floor_plan_filename text,
  add column floor_plan_size_bytes bigint
    check (floor_plan_size_bytes is null or floor_plan_size_bytes > 0),
  add column floor_plan_uploaded_at timestamptz;

create policy "floor_plans_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'floor-plans'
  and exists (
    select 1
    from public.projects p
    where p.id = ((storage.foldername(name))[1])::uuid
      and p.owner_id = auth.uid()
  )
);

create policy "floor_plans_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'floor-plans'
  and exists (
    select 1
    from public.projects p
    where p.id = ((storage.foldername(name))[1])::uuid
      and p.owner_id = auth.uid()
  )
);

create policy "floor_plans_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'floor-plans'
  and exists (
    select 1
    from public.projects p
    where p.id = ((storage.foldername(name))[1])::uuid
      and p.owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'floor-plans'
  and exists (
    select 1
    from public.projects p
    where p.id = ((storage.foldername(name))[1])::uuid
      and p.owner_id = auth.uid()
  )
);

create policy "floor_plans_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'floor-plans'
  and exists (
    select 1
    from public.projects p
    where p.id = ((storage.foldername(name))[1])::uuid
      and p.owner_id = auth.uid()
  )
);
