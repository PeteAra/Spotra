-- Day/month claim closures: admins can disable claiming for a calendar day or whole month.

create table if not exists public.calendar_closures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  scope text not null check (scope in ('day', 'month')),
  period_key text not null,
  created_by uuid not null references public.accounts (id),
  created_at timestamptz not null default now(),
  constraint calendar_closures_period_key_format check (
    (scope = 'day' and period_key ~ '^\d{4}-\d{2}-\d{2}$')
    or (scope = 'month' and period_key ~ '^\d{4}-\d{2}$')
  ),
  constraint calendar_closures_workspace_scope_period_unique
    unique (workspace_id, scope, period_key)
);

create index if not exists calendar_closures_workspace_period_idx
  on public.calendar_closures (workspace_id, scope, period_key);

alter table public.calendar_closures enable row level security;

create policy calendar_closures_select_member
  on public.calendar_closures for select
  using (public.is_workspace_member(workspace_id));

create policy calendar_closures_insert_admin
  on public.calendar_closures for insert
  with check (
    public.is_workspace_admin(workspace_id)
    and created_by = auth.uid()
  );

create policy calendar_closures_delete_admin
  on public.calendar_closures for delete
  using (public.is_workspace_admin(workspace_id));

grant select, insert, delete on public.calendar_closures to authenticated;

create or replace function public.slot_wall_date_key(
  p_starts_at timestamptz,
  p_time_zone_offset_minutes integer
)
returns text
language sql
immutable
as $$
  select to_char(
    (p_starts_at at time zone 'UTC')
      - make_interval(mins => coalesce(p_time_zone_offset_minutes, 0)),
    'YYYY-MM-DD'
  );
$$;

create or replace function public.claims_closed_for_slot(
  p_workspace_id uuid,
  p_starts_at timestamptz,
  p_time_zone_offset_minutes integer default 0
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with wall as (
    select public.slot_wall_date_key(p_starts_at, p_time_zone_offset_minutes) as day_key
  )
  select exists (
    select 1
    from public.calendar_closures c, wall
    where c.workspace_id = p_workspace_id
      and (
        (c.scope = 'day' and c.period_key = wall.day_key)
        or (c.scope = 'month' and c.period_key = left(wall.day_key, 7))
      )
  );
$$;

grant execute on function public.slot_wall_date_key(timestamptz, integer) to authenticated;
grant execute on function public.claims_closed_for_slot(uuid, timestamptz, integer) to authenticated;

drop function if exists public.claim_slot(uuid, text);

create or replace function public.claim_slot(
  p_slot_id uuid,
  p_claim_comment text default null,
  p_time_zone_offset_minutes integer default 0
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.slots;
  v_claimed_count integer;
  v_reservation public.reservations;
  v_comment text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_slot
  from public.slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if not public.is_workspace_member(v_slot.workspace_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  if public.claims_closed_for_slot(
    v_slot.workspace_id,
    v_slot.starts_at,
    coalesce(p_time_zone_offset_minutes, 0)
  ) then
    raise exception 'CLAIMS_DISABLED';
  end if;

  if exists (
    select 1
    from public.reservations r
    where r.slot_id = p_slot_id
      and r.account_id = auth.uid()
      and r.status = 'claimed'
  ) then
    raise exception 'ALREADY_CLAIMED';
  end if;

  select count(*) into v_claimed_count
  from public.reservations r
  where r.slot_id = p_slot_id
    and r.status = 'claimed';

  if v_claimed_count >= v_slot.capacity then
    raise exception 'SLOT_FULL';
  end if;

  v_comment := null;
  if v_slot.comments_enabled then
    v_comment := nullif(trim(p_claim_comment), '');

    if v_slot.comments_required then
      if v_comment is null or char_length(v_comment) < 3 then
        raise exception 'COMMENT_REQUIRED';
      end if;
    end if;

    if v_comment is not null and char_length(v_comment) > 500 then
      raise exception 'COMMENT_TOO_LONG';
    end if;
  end if;

  insert into public.reservations (
    workspace_id,
    slot_id,
    account_id,
    status,
    claim_comment
  )
  values (
    v_slot.workspace_id,
    p_slot_id,
    auth.uid(),
    'claimed',
    v_comment
  )
  returning * into v_reservation;

  return v_reservation;
end;
$$;

grant execute on function public.claim_slot(uuid, text, integer) to authenticated;
