-- Allow admins to permanently delete reservation rows when removing a workspace.
-- Day-to-day cancels still keep history via status='cancelled' updates.

create policy reservations_delete_admin
  on public.reservations for delete
  using (public.is_workspace_admin(workspace_id));

grant delete on public.reservations to authenticated;
