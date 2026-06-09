-- Impl-review F1: atomic full replace for editor geometry

create or replace function public.replace_editor_state(
  p_project_id uuid,
  p_scale jsonb,
  p_nodes jsonb,
  p_segments jsonb,
  p_rooms jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if jsonb_typeof(p_nodes) <> 'array'
    or jsonb_typeof(p_segments) <> 'array'
    or jsonb_typeof(p_rooms) <> 'array'
  then
    raise exception 'p_nodes, p_segments, and p_rooms must be json arrays';
  end if;

  if p_scale is null then
    update public.projects
    set
      plan_scale_point_a_x = null,
      plan_scale_point_a_y = null,
      plan_scale_point_b_x = null,
      plan_scale_point_b_y = null,
      plan_scale_known_length_m = null,
      plan_scale_meters_per_unit = null
    where id = p_project_id;
  else
    update public.projects
    set
      plan_scale_point_a_x = (p_scale->>'point_a_x')::double precision,
      plan_scale_point_a_y = (p_scale->>'point_a_y')::double precision,
      plan_scale_point_b_x = (p_scale->>'point_b_x')::double precision,
      plan_scale_point_b_y = (p_scale->>'point_b_y')::double precision,
      plan_scale_known_length_m = (p_scale->>'known_length_m')::numeric,
      plan_scale_meters_per_unit = (p_scale->>'meters_per_unit')::numeric
    where id = p_project_id;
  end if;

  if not found then
    raise exception 'project not found';
  end if;

  if jsonb_array_length(p_nodes) = 0
    and jsonb_array_length(p_segments) = 0
    and jsonb_array_length(p_rooms) = 0
    and (
      exists (select 1 from public.plan_nodes where project_id = p_project_id)
      or exists (select 1 from public.plan_segments where project_id = p_project_id)
      or exists (select 1 from public.plan_rooms where project_id = p_project_id)
    )
  then
    raise exception 'cannot clear existing editor geometry without providing replacement data';
  end if;

  delete from public.plan_rooms
  where project_id = p_project_id;

  delete from public.plan_segments
  where project_id = p_project_id;

  delete from public.plan_nodes
  where project_id = p_project_id;

  insert into public.plan_nodes (id, project_id, x, y)
  select
    (node->>'id')::uuid,
    p_project_id,
    (node->>'x')::double precision,
    (node->>'y')::double precision
  from jsonb_array_elements(p_nodes) as node;

  insert into public.plan_segments (id, project_id, start_node_id, end_node_id, assembly_id)
  select
    (segment->>'id')::uuid,
    p_project_id,
    (segment->>'start_node_id')::uuid,
    (segment->>'end_node_id')::uuid,
    (segment->>'assembly_id')::uuid
  from jsonb_array_elements(p_segments) as segment;

  insert into public.plan_rooms (
    id,
    project_id,
    name,
    internal_temp_c,
    ventilation_supply,
    ventilation_exhaust,
    ventilation_natural
  )
  select
    (room->>'id')::uuid,
    p_project_id,
    room->>'name',
    (room->>'internal_temp_c')::numeric,
    nullif(room->>'ventilation_supply', '')::numeric,
    nullif(room->>'ventilation_exhaust', '')::numeric,
    nullif(room->>'ventilation_natural', '')::numeric
  from jsonb_array_elements(p_rooms) as room;

  insert into public.plan_room_segments (room_id, segment_id, segment_order)
  select
    (room->>'id')::uuid,
    segment_link.segment_id::uuid,
    (segment_link.segment_order - 1)::smallint
  from jsonb_array_elements(p_rooms) as room
  cross join lateral jsonb_array_elements_text(room->'segment_ids') with ordinality as segment_link(segment_id, segment_order);
end;
$$;

grant execute on function public.replace_editor_state(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
