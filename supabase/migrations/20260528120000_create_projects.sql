-- F-01: projects table with owner-scoped RLS (roadmap project-schema-rls)
-- S-01 must pass owner_id = auth.uid() on INSERT; RLS rejects mismatched values.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "projects_select_own"
on public.projects
for select
to authenticated
using (owner_id = auth.uid());

create policy "projects_insert_own"
on public.projects
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "projects_update_own"
on public.projects
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

grant select, insert, update on public.projects to authenticated;
