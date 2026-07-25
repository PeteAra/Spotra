-- Allow admins to change member roles (promote / demote).
-- USING gates who can update (must currently be admin).
-- WITH CHECK only validates the new role so demoting yourself still works.

create policy workspace_members_update_admin
  on public.workspace_members for update
  using (public.is_workspace_admin(workspace_id))
  with check (role in ('admin', 'participant'));

grant update on public.workspace_members to authenticated;
