"use client";

import { useWorkspace } from "@/hooks/use-workspace-data";
import { WorkspaceAuthGate } from "@/features/workspace/workspace-auth-gate";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { CalendarMonthView } from "@/features/calendar/calendar-month-view";
import type { WorkspaceGate } from "@/types";

export function WorkspacePageClient({
  slug,
  isAuthenticated,
  gate,
}: {
  slug: string;
  isAuthenticated: boolean;
  gate: WorkspaceGate | null;
}) {
  const { data, isLoading, error } = useWorkspace(slug, isAuthenticated);

  if (!isAuthenticated) {
    return <WorkspaceAuthGate gate={gate} slug={slug} />;
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-10 text-[var(--muted)]">
        Loading workspace…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-[var(--danger)]/30 bg-[var(--surface)] p-10">
        <h2 className="text-xl font-semibold">Unable to open workspace</h2>
        <p className="mt-2 text-[var(--muted)]">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <WorkspaceHeader workspace={data.workspace} role={data.role} />
      <CalendarMonthView
        workspaceId={data.workspace.id}
        role={data.role}
        accountId={data.accountId}
      />
      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        Times shown in your local timezone (
        {Intl.DateTimeFormat().resolvedOptions().timeZone})
      </p>
    </div>
  );
}
