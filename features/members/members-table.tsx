"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { removeMember } from "@/features/members/actions";
import { useMemberHistory, useMembers } from "@/hooks/use-workspace-data";
import type { Account, WorkspaceMember } from "@/types";

export function MembersTable({ workspaceId }: { workspaceId: string }) {
  const { data: members = [], isLoading, refetch } = useMembers(workspaceId);
  const [selected, setSelected] = useState<
    (WorkspaceMember & { account: Account }) | null
  >(null);

  if (isLoading) {
    return <p className="text-[var(--muted)]">Loading members…</p>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                className="border-t border-[var(--border)] bg-[var(--surface)]"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="flex items-center gap-3 text-left"
                    onClick={() => setSelected(member)}
                  >
                    <Avatar>
                      <AvatarImage src={member.account.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {member.account.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      <span className="block font-medium">
                        {member.account.display_name}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {member.account.email}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3 capitalize">{member.role}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {format(new Date(member.joined_at), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
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
                    }}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MemberDetailDrawer
        workspaceId={workspaceId}
        member={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function MemberDetailDrawer({
  workspaceId,
  member,
  onClose,
}: {
  workspaceId: string;
  member: (WorkspaceMember & { account: Account }) | null;
  onClose: () => void;
}) {
  const { data: history = [] } = useMemberHistory(
    workspaceId,
    member?.account_id,
  );

  return (
    <Dialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {member && (
          <>
            <DialogHeader>
              <DialogTitle>{member.account.display_name}</DialogTitle>
              <DialogDescription>{member.account.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                Role: <span className="capitalize text-[var(--foreground)]">{member.role}</span>
                {" · "}Joined {format(new Date(member.joined_at), "PPpp")}
              </p>
              <h4 className="font-semibold">Reservation history</h4>
              {history.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No reservations yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="capitalize font-medium">{row.status}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {format(new Date(row.claimed_at), "PPp")}
                        </span>
                      </div>
                      {row.status === "cancelled" && (
                        <p className="mt-2 text-[var(--muted)]">
                          {row.cancellation_reason}
                          {row.cancelled_at && (
                            <span className="block text-xs">
                              Cancelled {format(new Date(row.cancelled_at), "PPp")}
                            </span>
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
