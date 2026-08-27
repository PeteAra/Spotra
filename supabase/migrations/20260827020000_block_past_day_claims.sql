-- Block claiming spots on calendar days before today (client local wall date).

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
  v_day_key text;
  v_today_key text;
  v_offset integer;
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

  v_offset := coalesce(p_time_zone_offset_minutes, 0);
  v_day_key := public.slot_wall_date_key(v_slot.starts_at, v_offset);
  v_today_key := to_char(
    (now() at time zone 'UTC') - make_interval(mins => v_offset),
    'YYYY-MM-DD'
  );

  if v_day_key < v_today_key then
    raise exception 'DAY_IN_PAST';
  end if;

  if public.claims_closed_for_slot(
    v_slot.workspace_id,
    v_slot.starts_at,
    v_offset
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
