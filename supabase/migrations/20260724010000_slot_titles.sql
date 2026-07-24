-- Slot labels: admin-chosen title; color is derived in the app from the title.

alter table public.slots
  add column if not exists title text not null default '';

alter table public.slots
  drop constraint if exists slots_title_length;

alter table public.slots
  add constraint slots_title_length check (char_length(title) <= 80);
