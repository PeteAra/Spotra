-- Optional admin-chosen color for a time slot (null = derive from title).

alter table public.slots
  add column if not exists color_key text;

alter table public.slots
  drop constraint if exists slots_color_key_check;

alter table public.slots
  add constraint slots_color_key_check check (
    color_key is null
    or color_key in (
      'teal',
      'blue',
      'violet',
      'magenta',
      'red',
      'orange',
      'yellow',
      'green',
      'cyan',
      'navy'
    )
  );
