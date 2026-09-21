"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ActivityPanel } from "@/features/activity/activity-panel";
import type { Account, WorkspaceMember } from "@/types";

export function MemberHistoryPageClient({
  workspaceId,
  workspaceSlug,
  workspaceTitle,
  account,
  member,
}: {
  workspaceId: string;
  workspaceSlug: string;
  workspaceTitle: string;
  account: Account;
  member: WorkspaceMember | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [account.id]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            {workspaceTitle}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">
            Member history
          </h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/workspace/${workspaceSlug}/users`}>Back to users</Link>
        </Button>
      </div>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={account.avatar_url ?? undefined} />
            <AvatarFallback>
              {account.display_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              {account.display_name}
            </p>
            <p className="truncate text-sm text-[var(--muted)]">{account.email}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {member ? (
                <>
                  Current role:{" "}
                  <span className="capitalize text-[var(--foreground)]">
                    {member.role}
                  </span>
                  {" · "}Joined{" "}
                  {format(new Date(member.joined_at), "MMM d, yyyy")}
                </>
              ) : (
                "No longer a member of this workspace"
              )}
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              onClick={() => setOpen(true)}
            >
              Open activity
            </Button>
          </div>
        </div>
      </section>

      <ActivityPanel
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            router.push(`/workspace/${workspaceSlug}/users`);
          }
        }}
        workspaceId={workspaceId}
        initial={{
          accountId: account.id,
          personLabel: account.display_name || account.email,
        }}
      />
    </div>
  );
}
