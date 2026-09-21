"use client";

import { useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityPanel } from "@/features/activity/activity-panel";
import { MembersTable } from "@/features/members/members-table";
import { SignOutButton } from "@/features/auth/sign-out-button";

export function WorkspaceUsersPageClient({
  workspaceId,
  workspaceSlug,
  workspaceTitle,
  currentAccountId,
  createdByAccountId,
}: {
  workspaceId: string;
  workspaceSlug: string;
  workspaceTitle: string;
  currentAccountId: string;
  createdByAccountId: string;
}) {
  const [activityOpen, setActivityOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            {workspaceTitle}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">
            Workspace users
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => setActivityOpen(true)}
          >
            <History className="h-3.5 w-3.5" />
            Activity
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/workspace/${workspaceSlug}`}>Back to calendar</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      <MembersTable
        workspaceId={workspaceId}
        currentAccountId={currentAccountId}
        createdByAccountId={createdByAccountId}
      />

      <ActivityPanel
        open={activityOpen}
        onOpenChange={setActivityOpen}
        workspaceId={workspaceId}
        initial={null}
      />
    </div>
  );
}
