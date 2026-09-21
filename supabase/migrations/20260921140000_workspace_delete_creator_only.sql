-- Only the workspace creator may delete the workspace.

drop policy if exists workspaces_delete_admin on public.workspaces;

create policy workspaces_delete_creator
  on public.workspaces for delete
  using (created_by = auth.uid());
