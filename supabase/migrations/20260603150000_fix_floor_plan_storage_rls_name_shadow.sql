-- Fix storage RLS: unqualified `name` inside `exists (... projects p ...)`
-- resolved to projects.name (title), not storage.objects.name (object path).

drop policy if exists "floor_plans_select_own" on storage.objects;
drop policy if exists "floor_plans_insert_own" on storage.objects;
drop policy if exists "floor_plans_update_own" on storage.objects;
drop policy if exists "floor_plans_delete_own" on storage.objects;

create policy "floor_plans_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'floor-plans'
  and (split_part(name, '/', 1))::uuid in (
    select id from public.projects where owner_id = auth.uid()
  )
);

create policy "floor_plans_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'floor-plans'
  and (split_part(name, '/', 1))::uuid in (
    select id from public.projects where owner_id = auth.uid()
  )
);

create policy "floor_plans_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'floor-plans'
  and (split_part(name, '/', 1))::uuid in (
    select id from public.projects where owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'floor-plans'
  and (split_part(name, '/', 1))::uuid in (
    select id from public.projects where owner_id = auth.uid()
  )
);

create policy "floor_plans_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'floor-plans'
  and (split_part(name, '/', 1))::uuid in (
    select id from public.projects where owner_id = auth.uid()
  )
);
