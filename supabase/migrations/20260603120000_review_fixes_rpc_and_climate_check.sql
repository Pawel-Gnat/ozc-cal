-- Review follow-ups: atomic assembly layer replace + climate temp DB bounds

alter table public.projects
  add constraint projects_external_design_temp_c_range_check
  check (
    external_design_temp_c is null
    or (external_design_temp_c >= -30 and external_design_temp_c <= -10)
  );

create or replace function public.replace_assembly_with_layers(
  p_assembly_id uuid,
  p_name text,
  p_category text,
  p_layers jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if jsonb_typeof(p_layers) <> 'array' then
    raise exception 'p_layers must be a json array';
  end if;

  update public.assemblies
  set
    name = p_name,
    category = p_category
  where id = p_assembly_id;

  if not found then
    raise exception 'assembly not found';
  end if;

  delete from public.assembly_layers
  where assembly_id = p_assembly_id;

  insert into public.assembly_layers (
    assembly_id,
    layer_order,
    material_name,
    lambda_w_mk,
    thickness_mm
  )
  select
    p_assembly_id,
    (layer->>'layer_order')::int,
    layer->>'material_name',
    (layer->>'lambda_w_mk')::numeric,
    (layer->>'thickness_mm')::numeric
  from jsonb_array_elements(p_layers) as layer;
end;
$$;

grant execute on function public.replace_assembly_with_layers(uuid, text, text, jsonb) to authenticated;
