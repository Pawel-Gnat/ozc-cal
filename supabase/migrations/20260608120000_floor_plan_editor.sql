-- S-03: floor plan editor geometry (FR-006, FR-007, FR-008)

alter table public.projects
  add column plan_scale_point_a_x double precision,
  add column plan_scale_point_a_y double precision,
  add column plan_scale_point_b_x double precision,
  add column plan_scale_point_b_y double precision,
  add column plan_scale_known_length_m numeric(12, 4)
    check (plan_scale_known_length_m is null or plan_scale_known_length_m > 0),
  add column plan_scale_meters_per_unit numeric(16, 10)
    check (plan_scale_meters_per_unit is null or plan_scale_meters_per_unit > 0);

create table public.plan_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  x double precision not null,
  y double precision not null,
  created_at timestamptz not null default now()
);

create index plan_nodes_project_id_idx on public.plan_nodes (project_id);

create table public.plan_segments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  start_node_id uuid not null references public.plan_nodes (id) on delete restrict,
  end_node_id uuid not null references public.plan_nodes (id) on delete restrict,
  assembly_id uuid not null references public.assemblies (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (start_node_id <> end_node_id)
);

create index plan_segments_project_id_idx on public.plan_segments (project_id);
create index plan_segments_start_node_id_idx on public.plan_segments (start_node_id);
create index plan_segments_end_node_id_idx on public.plan_segments (end_node_id);

create table public.plan_rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text,
  internal_temp_c numeric(4, 1) not null,
  ventilation_supply numeric(12, 4),
  ventilation_exhaust numeric(12, 4),
  ventilation_natural numeric(12, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plan_rooms_project_id_idx on public.plan_rooms (project_id);

create trigger plan_rooms_set_updated_at
before update on public.plan_rooms
for each row
execute function public.set_updated_at();

-- MVP: each segment belongs to at most one room (shared walls drawn as duplicate segments)
create table public.plan_room_segments (
  room_id uuid not null references public.plan_rooms (id) on delete cascade,
  segment_id uuid not null references public.plan_segments (id) on delete cascade,
  segment_order smallint not null,
  primary key (room_id, segment_id),
  unique (segment_id)
);

create index plan_room_segments_room_id_idx on public.plan_room_segments (room_id);

alter table public.plan_nodes enable row level security;
alter table public.plan_segments enable row level security;
alter table public.plan_rooms enable row level security;
alter table public.plan_room_segments enable row level security;

create policy "plan_nodes_select_own"
on public.plan_nodes
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

create policy "plan_nodes_insert_own"
on public.plan_nodes
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

create policy "plan_nodes_update_own"
on public.plan_nodes
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

create policy "plan_nodes_delete_own"
on public.plan_nodes
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

create policy "plan_segments_select_own"
on public.plan_segments
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

create policy "plan_segments_insert_own"
on public.plan_segments
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

create policy "plan_segments_update_own"
on public.plan_segments
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

create policy "plan_segments_delete_own"
on public.plan_segments
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

create policy "plan_rooms_select_own"
on public.plan_rooms
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

create policy "plan_rooms_insert_own"
on public.plan_rooms
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

create policy "plan_rooms_update_own"
on public.plan_rooms
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

create policy "plan_rooms_delete_own"
on public.plan_rooms
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

create policy "plan_room_segments_select_own"
on public.plan_room_segments
for select
to authenticated
using (
  exists (
    select 1
    from public.plan_rooms r
    join public.projects p on p.id = r.project_id
    where r.id = room_id
      and p.owner_id = auth.uid()
  )
);

create policy "plan_room_segments_insert_own"
on public.plan_room_segments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.plan_rooms r
    join public.projects p on p.id = r.project_id
    where r.id = room_id
      and p.owner_id = auth.uid()
  )
);

create policy "plan_room_segments_update_own"
on public.plan_room_segments
for update
to authenticated
using (
  exists (
    select 1
    from public.plan_rooms r
    join public.projects p on p.id = r.project_id
    where r.id = room_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.plan_rooms r
    join public.projects p on p.id = r.project_id
    where r.id = room_id
      and p.owner_id = auth.uid()
  )
);

create policy "plan_room_segments_delete_own"
on public.plan_room_segments
for delete
to authenticated
using (
  exists (
    select 1
    from public.plan_rooms r
    join public.projects p on p.id = r.project_id
    where r.id = room_id
      and p.owner_id = auth.uid()
  )
);

grant select, insert, update, delete on public.plan_nodes to authenticated;
grant select, insert, update, delete on public.plan_segments to authenticated;
grant select, insert, update, delete on public.plan_rooms to authenticated;
grant select, insert, update, delete on public.plan_room_segments to authenticated;
