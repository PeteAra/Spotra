"use client";

import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { removeMember, setMemberRole } from "@/features/members/actions";
import { useMembers } from "@/hooks/use-workspace-data";
import type { Account, WorkspaceMember, WorkspaceRole } from "@/types";

export function MembersTable({
  workspaceId,
  workspaceSlug,
  currentAccountId,
}: {
  workspaceId: string;
  workspaceSlug: string;
  currentAccountId: string;
}) {
  const { data: members = [], isLoading, refetch } = useMembers(workspaceId);

  if (isLoading) {
    return <p className="text-[var(--muted)]">Loading members…</p>;
  }

  const adminCount = members.filter((m) => m.role === "admin").length;

  async function onRemove(member: WorkspaceMember & { account: Account }) {
    const result = await removeMember({
      workspaceId,
      accountId: member.account_id,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Member removed");
    refetch();
  }

  async function onSetRole(
    member: WorkspaceMember & { account: Account },
    role: WorkspaceRole,
  ) {
    const result = await setMemberRole({
      workspaceId,
      accountId: member.account_id,
      role,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      role === "admin" ? "Member is now an admin" : "Member is now a participant",
    );
    refetch();
  }

  function canRemove(member: WorkspaceMember) {
    // Self-removal is via Leave on /workspaces or Delete workspace.
    return member.account_id !== currentAccountId;
  }

  function canPromote(member: WorkspaceMember) {
    return member.role === "participant";
  }

  function canDemote(member: WorkspaceMember) {
    // Allow demoting other admins, and yourself only when another admin exists.
    if (member.role !== "admin") return false;
    if (member.account_id === currentAccountId) return adminCount > 1;
    return true;
  }

  function ActionButtons({
    member,
    stretch,
  }: {
    member: WorkspaceMember & { account: Account };
    stretch?: boolean;
  }) {
    const flex = stretch ? "flex-1" : undefined;
    return (
      <>
        <Button size="sm" variant="secondary" asChild className={flex}>
          <Link
            href={`/workspace/${workspaceSlug}/users/${member.account_id}/history`}
          >
            History
          </Link>
        </Button>
        {canPromote(member) && (
          <Button
            size="sm"
            variant="outline"
            className={flex}
            onClick={() => onSetRole(member, "admin")}
          >
            Make admin
          </Button>
        )}
        {canDemote(member) && (
          <Button
            size="sm"
            variant="outline"
            className={flex}
            onClick={() => onSetRole(member, "participant")}
          >
            Make participant
          </Button>
        )}
        {canRemove(member) && (
          <Button
            size="sm"
            variant="outline"
            className={flex}
            onClick={() => onRemove(member)}
          >
            Remove
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards so actions stay visible */}
      <ul className="space-y-3 md:hidden">
        {members.map((member) => (
          <li
            key={member.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-start gap-3">
              <Avatar>
                <AvatarImage src={member.account.avatar_url ?? undefined} />
                <AvatarFallback>
                  {member.account.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {member.account.display_name}
                  {member.account_id === currentAccountId ? " (you)" : ""}
                </p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {member.account.email}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  <span className="capitalize">{member.role}</span>
                  {" · "}Joined {format(new Date(member.joined_at), "MMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButtons member={member} stretch />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                className="border-t border-[var(--border)] bg-[var(--surface)]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={member.account.avatar_url ?? undefined}
                      />
                      <AvatarFallback>
                        {member.account.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      <span className="block font-medium">
                        {member.account.display_name}
                        {member.account_id === currentAccountId ? " (you)" : ""}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {member.account.email}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">{member.role}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {format(new Date(member.joined_at), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <ActionButtons member={member} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
