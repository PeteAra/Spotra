-- Allow capacity 0 for blocked / private calendar holds (no claims).

alter table public.slots
  drop constraint slots_capacity_range;

alter table public.slots
  add constraint slots_capacity_range check (capacity between 0 and 100);
