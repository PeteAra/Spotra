"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMemberHistory } from "@/hooks/use-workspace-data";
import { cn } from "@/lib/utils/cn";
import type { Account, MemberHistoryItem, WorkspaceMember } from "@/types";

function kindLabel(kind: MemberHistoryItem["kind"]) {
  switch (kind) {
    case "joined":
      return "Joined workspace";
    case "left":
      return "Left workspace";
    case "removed":
      return "Removed from workspace";
    case "claimed":
      return "Claimed a slot";
    case "cancelled":
      return "Cancelled a slot";
  }
}

function formatSlotWindow(item: MemberHistoryItem) {
  if (!item.slot_starts_at) return null;
  const start = new Date(item.slot_starts_at);
  const end = item.slot_ends_at ? new Date(item.slot_ends_at) : null;
  const day = format(start, "MMM d, yyyy");
  const times = end
    ? `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`
    : format(start, "h:mm a");
  const title = item.slot_title?.trim() || "Untitled slot";
  return `${title} · ${day} · ${times}`;
}

function toCsv(items: MemberHistoryItem[]) {
  const header = [
    "timestamp",
    "event",
    "role",
    "slot_title",
    "slot_starts_at",
    "slot_ends_at",
    "cancellation_reason",
  ];

  const escape = (value: string) => {
    if (/[",\n]/.test(value)) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  };

  const rows = items.map((item) =>
    [
      item.occurred_at,
      kindLabel(item.kind),
      item.role ?? "",
      item.slot_title ?? "",
      item.slot_starts_at ?? "",
      item.slot_ends_at ?? "",
      item.cancellation_reason ?? "",
    ]
      .map((cell) => escape(String(cell)))
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

function downloadCsv(account: Account, items: MemberHistoryItem[]) {
  const stamp = format(new Date(), "yyyy-MM-dd");
  const safeName = account.display_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const blob = new Blob([toCsv(items)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `spotra-${safeName || "member"}-history-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

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
  const { data: history = [], isLoading, error } = useMemberHistory(
    workspaceId,
    account.id,
  );

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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={history.length === 0}
            onClick={() => downloadCsv(account, history)}
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/workspace/${workspaceSlug}/users`}>Back to users</Link>
          </Button>
        </div>
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
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Timeline
        </h2>

        {isLoading && (
          <p className="text-sm text-[var(--muted)]">Loading history…</p>
        )}
        {error && (
          <p className="text-sm text-[var(--danger)]">
            Could not load history:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        )}
        {!isLoading && !error && history.length === 0 && (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            No membership or reservation activity yet.
          </p>
        )}

        <ol className="space-y-3">
          {history.map((item) => {
            const slotLine = formatSlotWindow(item);
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{kindLabel(item.kind)}</p>
                  <time
                    dateTime={item.occurred_at}
                    className="text-xs text-[var(--muted)]"
                  >
                    {format(new Date(item.occurred_at), "PPpp")}
                  </time>
                </div>
                {item.role && (
                  <p className="mt-1 text-sm capitalize text-[var(--muted)]">
                    Role: {item.role}
                  </p>
                )}
                {slotLine && (
                  <p className="mt-1 text-sm text-[var(--muted)]">{slotLine}</p>
                )}
                {item.kind === "cancelled" && item.cancellation_reason && (
                  <p
                    className={cn(
                      "mt-3 rounded-xl bg-[var(--surface-muted)] p-3 text-sm",
                    )}
                  >
                    <span className="block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                      Cancellation reason
                    </span>
                    <span className="mt-1 block">
                      {item.cancellation_reason}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
