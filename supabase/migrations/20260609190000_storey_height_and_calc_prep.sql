-- F-03: global storey height per project for OZC geometry (wall area, volume).

alter table public.projects
  add column if not exists storey_height_m numeric(6, 3) not null default 2.6
  check (storey_height_m > 0);

comment on column public.projects.storey_height_m is
  'Global floor-to-ceiling height (m) for single-storey OZC calculations. Default 2.6 m.';
