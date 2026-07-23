-- Spotra MVP schema, RLS, helpers, RPCs, and auth trigger

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  created_by uuid not null references public.accounts (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_title_length check (char_length(title) between 1 and 120),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index workspaces_created_by_idx on public.workspaces (created_by);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  role text not null,
  joined_at timestamptz not null default now(),
  constraint workspace_members_role_check check (role in ('admin', 'participant')),
  constraint workspace_members_unique unique (workspace_id, account_id)
);

create index workspace_members_workspace_idx on public.workspace_members (workspace_id);
create index workspace_members_account_idx on public.workspace_members (account_id);
create index workspace_members_workspace_role_idx on public.workspace_members (workspace_id, role);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1,
  created_by uuid not null references public.accounts (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slots_time_order check (ends_at > starts_at),
  constraint slots_capacity_range check (capacity between 1 and 100)
);

create index slots_workspace_starts_idx on public.slots (workspace_id, starts_at);
create index slots_workspace_range_idx on public.slots (workspace_id, starts_at, ends_at);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  slot_id uuid not null references public.slots (id) on delete restrict,
  account_id uuid not null references public.accounts (id),
  status text not null,
  claimed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references public.accounts (id),
  constraint reservations_status_check check (status in ('claimed', 'cancelled')),
  constraint reservations_cancel_fields check (
    status <> 'cancelled'
    or (
      cancellation_reason is not null
      and char_length(cancellation_reason) >= 10
      and cancelled_at is not null
    )
  )
);

create unique index reservations_one_active_claim_per_account
  on public.reservations (slot_id, account_id)
  where status = 'claimed';

create index reservations_workspace_account_idx on public.reservations (workspace_id, account_id);
create index reservations_slot_claimed_idx on public.reservations (slot_id) where status = 'claimed';
create index reservations_account_claimed_at_idx on public.reservations (account_id, claimed_at desc);
create index reservations_workspace_status_idx on public.reservations (workspace_id, status);

-- ---------------------------------------------------------------------------
-- Auth → accounts trigger
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws_id
      and m.account_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws_id
      and m.account_id = auth.uid()
      and m.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs: claim / cancel / join
-- ---------------------------------------------------------------------------

create or replace function public.claim_slot(p_slot_id uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.slots;
  v_claimed_count integer;
  v_reservation public.reservations;
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

  insert into public.reservations (workspace_id, slot_id, account_id, status)
  values (v_slot.workspace_id, p_slot_id, auth.uid(), 'claimed')
  returning * into v_reservation;

  return v_reservation;
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid, p_reason text)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_reason is null or char_length(trim(p_reason)) < 10 then
    raise exception 'REASON_TOO_SHORT';
  end if;

  if char_length(p_reason) > 500 then
    raise exception 'REASON_TOO_LONG';
  end if;

  select * into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status <> 'claimed' then
    raise exception 'NOT_CLAIMED';
  end if;

  if v_reservation.account_id <> auth.uid()
     and not public.is_workspace_admin(v_reservation.workspace_id) then
    raise exception 'FORBIDDEN';
  end if;

  update public.reservations
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = trim(p_reason),
    cancelled_by = auth.uid()
  where id = p_reservation_id
  returning * into v_reservation;

  return v_reservation;
end;
$$;

create or replace function public.join_workspace(p_slug text)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces;
  v_member public.workspace_members;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_workspace
  from public.workspaces
  where slug = p_slug;

  if not found then
    raise exception 'WORKSPACE_NOT_FOUND';
  end if;

  select * into v_member
  from public.workspace_members
  where workspace_id = v_workspace.id
    and account_id = auth.uid();

  if found then
    return v_member;
  end if;

  insert into public.workspace_members (workspace_id, account_id, role)
  values (v_workspace.id, auth.uid(), 'participant')
  returning * into v_member;

  return v_member;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.slots enable row level security;
alter table public.reservations enable row level security;

-- accounts
create policy accounts_select_self_or_fellow_member
  on public.accounts for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs
        on mine.workspace_id = theirs.workspace_id
      where mine.account_id = auth.uid()
        and theirs.account_id = accounts.id
    )
  );

create policy accounts_insert_self
  on public.accounts for insert
  with check (id = auth.uid());

create policy accounts_update_self
  on public.accounts for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- workspaces: anon can read title/slug for gate (all columns limited by app query)
create policy workspaces_select_anon_or_member
  on public.workspaces for select
  using (
    true
  );

create policy workspaces_insert_authenticated
  on public.workspaces for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy workspaces_update_admin
  on public.workspaces for update
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

create policy workspaces_delete_admin
  on public.workspaces for delete
  using (public.is_workspace_admin(id));

-- workspace_members
create policy workspace_members_select_member
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

create policy workspace_members_insert_admin_or_self_join
  on public.workspace_members for insert
  with check (
    public.is_workspace_admin(workspace_id)
    or (
      account_id = auth.uid()
      and role = 'admin'
      and exists (
        select 1
        from public.workspaces w
        where w.id = workspace_id
          and w.created_by = auth.uid()
      )
    )
    or (account_id = auth.uid() and role = 'participant')
  );

create policy workspace_members_delete_admin
  on public.workspace_members for delete
  using (public.is_workspace_admin(workspace_id));

-- slots: members only
create policy slots_select_member
  on public.slots for select
  using (public.is_workspace_member(workspace_id));

create policy slots_insert_admin
  on public.slots for insert
  with check (public.is_workspace_admin(workspace_id) and created_by = auth.uid());

create policy slots_update_admin
  on public.slots for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy slots_delete_admin
  on public.slots for delete
  using (public.is_workspace_admin(workspace_id));

-- reservations: members can read (roster); mutations via RPC (security definer)
create policy reservations_select_member
  on public.reservations for select
  using (public.is_workspace_member(workspace_id));

-- Grant execute on RPCs
grant usage on schema public to anon, authenticated;
grant select on public.workspaces to anon, authenticated;
grant select, insert, update on public.accounts to authenticated;
grant select, insert, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.slots to authenticated;
grant select on public.reservations to authenticated;
grant execute on function public.claim_slot(uuid) to authenticated;
grant execute on function public.cancel_reservation(uuid, text) to authenticated;
grant execute on function public.join_workspace(text) to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
