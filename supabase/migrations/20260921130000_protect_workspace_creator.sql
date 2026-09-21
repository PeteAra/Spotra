-- Protect the workspace creator (owner) from being removed or demoted by others.
-- Allow cascade deletes when the workspace itself is deleted (pg_trigger_depth > 1).

create or replace function public.protect_workspace_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  -- Cascaded deletes from workspaces ON DELETE CASCADE run at depth > 1.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  select created_by into v_created_by
  from public.workspaces
  where id = coalesce(old.workspace_id, new.workspace_id);

  if v_created_by is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.account_id = v_created_by then
      raise exception 'CREATOR_PROTECTED';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.account_id = v_created_by
       and old.role = 'admin'
       and new.role is distinct from 'admin' then
      raise exception 'CREATOR_PROTECTED';
    end if;
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists protect_workspace_creator_trg on public.workspace_members;
create trigger protect_workspace_creator_trg
  before update of role or delete
  on public.workspace_members
  for each row
  execute function public.protect_workspace_creator();

create or replace function public.leave_workspace(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_workspace public.workspaces;
  v_membership public.workspace_members;
  v_admin_count integer;
  v_claim record;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_workspace
  from public.workspaces
  where id = p_workspace_id;

  if not found then
    raise exception 'WORKSPACE_NOT_FOUND';
  end if;

  select * into v_membership
  from public.workspace_members
  where workspace_id = p_workspace_id
    and account_id = v_uid;

  if not found then
    raise exception 'NOT_A_MEMBER';
  end if;

  if v_workspace.created_by = v_uid then
    raise exception 'CREATOR_MUST_DELETE_WORKSPACE';
  end if;

  select count(*)::integer into v_admin_count
  from public.workspace_members
  where workspace_id = p_workspace_id
    and role = 'admin';

  if v_membership.role = 'admin' and v_admin_count <= 1 then
    raise exception 'LAST_ADMIN';
  end if;

  for v_claim in
    select id
    from public.reservations
    where workspace_id = p_workspace_id
      and account_id = v_uid
      and status = 'claimed'
  loop
    perform public.cancel_reservation(v_claim.id, 'Left the workspace.');
  end loop;

  delete from public.workspace_members
  where workspace_id = p_workspace_id
    and account_id = v_uid;

  return jsonb_build_object('deleted', false);
end;
$$;
