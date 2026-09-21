-- Preserve claim/cancel history when spots are deleted via slot snapshots.

alter table public.reservations
  add column if not exists slot_title text,
  add column if not exists slot_starts_at timestamptz,
  add column if not exists slot_ends_at timestamptz;

-- Backfill snapshots from live slots before allowing detach.
update public.reservations r
set
  slot_title = coalesce(r.slot_title, s.title),
  slot_starts_at = coalesce(r.slot_starts_at, s.starts_at),
  slot_ends_at = coalesce(r.slot_ends_at, s.ends_at)
from public.slots s
where s.id = r.slot_id
  and (
    r.slot_title is null
    or r.slot_starts_at is null
    or r.slot_ends_at is null
  );

alter table public.reservations
  alter column slot_id drop not null;

create or replace function public.reservations_snapshot_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  if new.slot_id is null then
    return new;
  end if;

  select s.title, s.starts_at, s.ends_at
    into v_title, v_starts, v_ends
  from public.slots s
  where s.id = new.slot_id;

  if found then
    new.slot_title := coalesce(new.slot_title, v_title);
    new.slot_starts_at := coalesce(new.slot_starts_at, v_starts);
    new.slot_ends_at := coalesce(new.slot_ends_at, v_ends);
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_snapshot_slot_trg on public.reservations;
create trigger reservations_snapshot_slot_trg
  before insert or update of slot_id
  on public.reservations
  for each row
  execute function public.reservations_snapshot_slot();

-- Detach history (keep rows + snapshots) instead of blocking/cascade-deleting.
create or replace function public.detach_reservations_before_slot_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reservations
  set
    slot_title = coalesce(slot_title, old.title),
    slot_starts_at = coalesce(slot_starts_at, old.starts_at),
    slot_ends_at = coalesce(slot_ends_at, old.ends_at),
    slot_id = null
  where slot_id = old.id;

  return old;
end;
$$;

drop trigger if exists detach_reservations_before_slot_delete_trg on public.slots;
create trigger detach_reservations_before_slot_delete_trg
  before delete on public.slots
  for each row
  execute function public.detach_reservations_before_slot_delete();

create index if not exists reservations_workspace_claimed_at_idx
  on public.reservations (workspace_id, claimed_at desc);

create index if not exists reservations_workspace_cancelled_at_idx
  on public.reservations (workspace_id, cancelled_at desc)
  where cancelled_at is not null;

create index if not exists reservations_workspace_slot_claimed_at_idx
  on public.reservations (workspace_id, slot_id, claimed_at desc);

create index if not exists reservations_workspace_slot_starts_at_idx
  on public.reservations (workspace_id, slot_starts_at);
