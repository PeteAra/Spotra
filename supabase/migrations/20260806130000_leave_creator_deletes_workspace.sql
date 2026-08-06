-- When the workspace creator leaves (or the last admin leaves), delete the
-- workspace instead of leaving it with no owner / only participants.

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
  v_should_delete boolean := false;
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

  select count(*)::integer into v_admin_count
  from public.workspace_members
  where workspace_id = p_workspace_id
    and role = 'admin';

  -- Creator leaving, or last admin leaving → remove the whole workspace.
  if v_workspace.created_by = v_uid then
    v_should_delete := true;
  elsif v_membership.role = 'admin' and v_admin_count <= 1 then
    v_should_delete := true;
  end if;

  if v_should_delete then
    delete from public.reservations where workspace_id = p_workspace_id;
    delete from public.slots where workspace_id = p_workspace_id;
    delete from public.workspace_members where workspace_id = p_workspace_id;
    delete from public.workspaces where id = p_workspace_id;
    return jsonb_build_object('deleted', true);
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

grant execute on function public.leave_workspace(uuid) to authenticated;
