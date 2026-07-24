-- Membership join/leave audit trail + allow participants to leave themselves

create table public.member_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  event_type text not null,
  role text not null,
  actor_id uuid references public.accounts (id),
  occurred_at timestamptz not null default now(),
  constraint member_events_type_check check (
    event_type in ('joined', 'left', 'removed')
  ),
  constraint member_events_role_check check (role in ('admin', 'participant'))
);

create index member_events_workspace_account_idx
  on public.member_events (workspace_id, account_id, occurred_at desc);

create index member_events_workspace_occurred_idx
  on public.member_events (workspace_id, occurred_at desc);

-- Backfill current members as joined events
insert into public.member_events (
  workspace_id,
  account_id,
  event_type,
  role,
  actor_id,
  occurred_at
)
select
  workspace_id,
  account_id,
  'joined',
  role,
  account_id,
  joined_at
from public.workspace_members;

create or replace function public.log_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_events (
    workspace_id,
    account_id,
    event_type,
    role,
    actor_id,
    occurred_at
  )
  values (
    new.workspace_id,
    new.account_id,
    'joined',
    new.role,
    auth.uid(),
    coalesce(new.joined_at, now())
  );
  return new;
end;
$$;

create or replace function public.log_member_left()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_events (
    workspace_id,
    account_id,
    event_type,
    role,
    actor_id,
    occurred_at
  )
  values (
    old.workspace_id,
    old.account_id,
    case
      when auth.uid() is not null and auth.uid() = old.account_id then 'left'
      else 'removed'
    end,
    old.role,
    auth.uid(),
    now()
  );
  return old;
end;
$$;

create trigger workspace_members_log_joined
  after insert on public.workspace_members
  for each row
  execute function public.log_member_joined();

create trigger workspace_members_log_left
  after delete on public.workspace_members
  for each row
  execute function public.log_member_left();

alter table public.member_events enable row level security;

create policy member_events_select_admin
  on public.member_events for select
  using (public.is_workspace_admin(workspace_id));

grant select on public.member_events to authenticated;

-- Participants need to be able to leave a workspace themselves
create policy workspace_members_delete_self
  on public.workspace_members for delete
  using (account_id = auth.uid());
