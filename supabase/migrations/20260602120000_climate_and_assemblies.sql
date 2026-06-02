-- S-02: climate fields on projects + assembly catalog (FR-004, FR-005)

alter table public.projects
  add column climate_zone text
    check (climate_zone in ('I', 'II', 'III', 'IV', 'V')),
  add column external_design_temp_c numeric(4, 1);

create table public.assemblies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  category text not null
    check (
      category in (
        'external_wall',
        'internal_partition',
        'floor',
        'ceiling',
        'roof',
        'ground_floor',
        'window',
        'door'
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assemblies_project_id_idx on public.assemblies (project_id);

create trigger assemblies_set_updated_at
before update on public.assemblies
for each row
execute function public.set_updated_at();

-- layer_order is 0-based: first layer in the stack is 0
create table public.assembly_layers (
  id uuid primary key default gen_random_uuid(),
  assembly_id uuid not null references public.assemblies (id) on delete cascade,
  layer_order int not null,
  material_name text not null,
  lambda_w_mk numeric(6, 3) not null check (lambda_w_mk > 0),
  thickness_mm numeric(8, 2) not null check (thickness_mm > 0),
  unique (assembly_id, layer_order)
);

create index assembly_layers_assembly_id_idx on public.assembly_layers (assembly_id);

alter table public.assemblies enable row level security;
alter table public.assembly_layers enable row level security;

create policy "assemblies_select_own"
on public.assemblies
for select
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_id = auth.uid()
  )
);

create policy "assemblies_insert_own"
on public.assemblies
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_id = auth.uid()
  )
);

create policy "assemblies_update_own"
on public.assemblies
for update
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_id = auth.uid()
  )
);

create policy "assemblies_delete_own"
on public.assemblies
for delete
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_id = auth.uid()
  )
);

create policy "assembly_layers_select_own"
on public.assembly_layers
for select
to authenticated
using (
  exists (
    select 1
    from public.assemblies a
    join public.projects p on p.id = a.project_id
    where a.id = assembly_id
      and p.owner_id = auth.uid()
  )
);

create policy "assembly_layers_insert_own"
on public.assembly_layers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.assemblies a
    join public.projects p on p.id = a.project_id
    where a.id = assembly_id
      and p.owner_id = auth.uid()
  )
);

create policy "assembly_layers_update_own"
on public.assembly_layers
for update
to authenticated
using (
  exists (
    select 1
    from public.assemblies a
    join public.projects p on p.id = a.project_id
    where a.id = assembly_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assemblies a
    join public.projects p on p.id = a.project_id
    where a.id = assembly_id
      and p.owner_id = auth.uid()
  )
);

create policy "assembly_layers_delete_own"
on public.assembly_layers
for delete
to authenticated
using (
  exists (
    select 1
    from public.assemblies a
    join public.projects p on p.id = a.project_id
    where a.id = assembly_id
      and p.owner_id = auth.uid()
  )
);

grant select, insert, update, delete on public.assemblies to authenticated;
grant select, insert, update, delete on public.assembly_layers to authenticated;
