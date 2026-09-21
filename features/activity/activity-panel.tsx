"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { ChevronDown, Download } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getWorkspaceActivity } from "@/features/activity/actions";
import { useMembers } from "@/hooks/use-workspace-data";
import { getClientTimeZoneOffsetMinutes } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import type { ActivityItem, ActivityKind, WorkspaceMember } from "@/types";

function memberLabel(member: WorkspaceMember) {
  return member.account?.display_name?.trim() || member.account_id;
}

function memberInitials(member: WorkspaceMember) {
  return memberLabel(member).slice(0, 2).toUpperCase();
}

const ALL_KINDS: ActivityKind[] = [
  "claimed",
  "cancelled",
  "joined",
  "left",
  "removed",
];

export type ActivityOpenState = {
  accountId?: string;
  slotId?: string;
  slotDate?: string;
  slotLabel?: string;
  personLabel?: string;
};

function kindLabel(kind: ActivityKind) {
  switch (kind) {
    case "joined":
      return "Joined workspace";
    case "left":
      return "Left workspace";
    case "removed":
      return "Removed from workspace";
    case "claimed":
      return "Claimed a spot";
    case "cancelled":
      return "Cancelled a spot";
  }
}

function formatSlotWindow(item: ActivityItem) {
  if (!item.slot_starts_at) return null;
  const start = new Date(item.slot_starts_at);
  const end = item.slot_ends_at ? new Date(item.slot_ends_at) : null;
  const day = format(start, "MMM d, yyyy");
  const times = end
    ? `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`
    : format(start, "h:mm a");
  const title = item.slot_title?.trim() || "Untitled spot";
  return `${title} · ${day} · ${times}`;
}

function toCsv(items: ActivityItem[]) {
  const header = [
    "timestamp",
    "event",
    "person",
    "email",
    "role",
    "spot_title",
    "spot_starts_at",
    "spot_ends_at",
    "claim_comment",
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
      item.account_display_name ?? "",
      item.account_email ?? "",
      item.role ?? "",
      item.slot_title ?? "",
      item.slot_starts_at ?? "",
      item.slot_ends_at ?? "",
      item.claim_comment ?? "",
      item.cancellation_reason ?? "",
    ]
      .map((cell) => escape(String(cell)))
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

function downloadCsv(items: ActivityItem[], label: string) {
  const stamp = format(new Date(), "yyyy-MM-dd");
  const safe = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const blob = new Blob([toCsv(items)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `spotra-activity-${safe || "export"}-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function dayKey(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd");
}

export function ActivityPanel({
  open,
  onOpenChange,
  workspaceId,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  initial: ActivityOpenState | null;
}) {
  const [accountId, setAccountId] = useState<string>("");
  const [slotQuery, setSlotQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [slotDate, setSlotDate] = useState<string | undefined>();
  const [slotId, setSlotId] = useState<string | undefined>();
  const [kinds, setKinds] = useState<ActivityKind[]>([...ALL_KINDS]);
  const [personOpen, setPersonOpen] = useState(false);

  const { data: members = [] } = useMembers(workspaceId, open);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) =>
      memberLabel(a).localeCompare(memberLabel(b), undefined, {
        sensitivity: "base",
      }),
    );
  }, [members]);

  const selectedMember = useMemo(
    () => sortedMembers.find((m) => m.account_id === accountId) ?? null,
    [sortedMembers, accountId],
  );

  useEffect(() => {
    if (!open) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const monthAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const seed = initial ?? {};

    setAccountId(seed.accountId ?? "");
    setSlotId(seed.slotId);
    setSlotDate(seed.slotDate);
    setSlotQuery(seed.slotLabel ?? "");

    if (seed.slotDate) {
      setFromDate(seed.slotDate);
      setToDate(seed.slotDate);
    } else {
      setFromDate(monthAgo);
      setToDate(today);
    }

    setKinds(
      seed.slotId
        ? (["claimed", "cancelled"] as ActivityKind[])
        : [...ALL_KINDS],
    );
  }, [open, initial]);

  const title = initial?.personLabel
    ? `Activity · ${initial.personLabel}`
    : initial?.slotLabel
      ? `Activity · ${initial.slotLabel}`
      : initial?.slotDate
        ? `Activity · ${format(new Date(`${initial.slotDate}T12:00:00`), "MMM d, yyyy")}`
        : "Activity";

  const timeZoneOffsetMinutes = getClientTimeZoneOffsetMinutes();

  const fromIso = fromDate
    ? new Date(`${fromDate}T00:00:00`).toISOString()
    : undefined;
  const toIso = toDate
    ? new Date(`${toDate}T23:59:59.999`).toISOString()
    : undefined;

  const queryKey = [
    "activity",
    workspaceId,
    accountId || null,
    slotId || null,
    slotDate || null,
    fromIso || null,
    toIso || null,
    kinds.slice().sort().join(","),
    timeZoneOffsetMinutes,
  ];

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    enabled: open && Boolean(workspaceId),
    queryFn: async () => {
      const result = await getWorkspaceActivity({
        workspaceId,
        accountId: accountId || undefined,
        slotId: slotId || undefined,
        slotDate: slotDate || undefined,
        timeZoneOffsetMinutes,
        from: slotDate ? undefined : fromIso,
        to: slotDate ? undefined : toIso,
        kinds,
        limit: 2000,
        offset: 0,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const items = useMemo(() => {
    const list = data?.items ?? [];
    const q = slotQuery.trim().toLowerCase();
    if (!q || slotId) return list;
    return list.filter((item) => {
      const hay = [
        item.slot_title,
        item.slot_starts_at
          ? format(new Date(item.slot_starts_at), "h:mm a")
          : "",
        item.slot_ends_at
          ? format(new Date(item.slot_ends_at), "h:mm a")
          : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, slotQuery, slotId]);

  const hasMore = Boolean(data?.hasMore);

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of items) {
      const key = dayKey(item.occurred_at);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  function toggleKind(kind: ActivityKind) {
    setKinds((prev) => {
      if (prev.includes(kind)) {
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== kind);
      }
      return [...prev, kind];
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Claims, cancellations, and membership changes for this workspace.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
          <div className="shrink-0 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="activity-from" className="text-xs">
                  From
                </Label>
                <Input
                  id="activity-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setSlotDate(undefined);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="activity-to" className="text-xs">
                  To
                </Label>
                <Input
                  id="activity-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setSlotDate(undefined);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="activity-person" className="text-xs">
                Person
              </Label>
              <Popover modal open={personOpen} onOpenChange={setPersonOpen}>
                <PopoverTrigger asChild>
                  <button
                    id="activity-person"
                    type="button"
                    className="flex h-10 w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-left text-sm transition hover:border-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {selectedMember ? (
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={
                            selectedMember.account?.avatar_url ?? undefined
                          }
                        />
                        <AvatarFallback className="text-[10px]">
                          {memberInitials(selectedMember)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[10px] font-medium text-[var(--muted)]">
                        All
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {selectedMember
                        ? memberLabel(selectedMember)
                        : "Everyone"}
                    </span>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-[var(--muted)]"
                      aria-hidden
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  collisionPadding={16}
                  className="z-[60] w-[var(--radix-popover-trigger-width)] p-1.5"
                >
                  <div className="max-h-64 overflow-y-auto overscroll-contain">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountId("");
                        setPersonOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[var(--surface-muted)]",
                        !accountId && "bg-[var(--surface-muted)]",
                      )}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface)] text-[10px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
                        All
                      </span>
                      <span>Everyone</span>
                    </button>
                    {sortedMembers.map((m) => {
                      const name = memberLabel(m);
                      const selected = m.account_id === accountId;
                      return (
                        <button
                          key={m.account_id}
                          type="button"
                          onClick={() => {
                            setAccountId(m.account_id);
                            setPersonOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[var(--surface-muted)]",
                            selected && "bg-[var(--surface-muted)]",
                          )}
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarImage
                              src={m.account?.avatar_url ?? undefined}
                            />
                            <AvatarFallback className="text-[10px]">
                              {memberInitials(m)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 truncate">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label htmlFor="activity-spot" className="text-xs">
                Spot search
              </Label>
              <Input
                id="activity-spot"
                value={slotQuery}
                placeholder="Title or time…"
                onChange={(e) => setSlotQuery(e.target.value)}
                disabled={Boolean(slotId)}
              />
              {slotId ? (
                <button
                  type="button"
                  className="text-xs text-[var(--accent)] underline"
                  onClick={() => {
                    setSlotId(undefined);
                    setSlotQuery("");
                  }}
                >
                  Clear spot filter
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {ALL_KINDS.map((kind) => {
                const active = kinds.includes(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => toggleKind(kind)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                      active
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)]",
                    )}
                  >
                    {kindLabel(kind).replace(" workspace", "").replace(" a spot", "")}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2">
            <p className="text-xs text-[var(--muted)]">
              {isLoading || isFetching
                ? "Loading…"
                : `${items.length} event${items.length === 1 ? "" : "s"}${
                    hasMore ? " (showing latest 2000)" : ""
                  }`}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={items.length === 0}
                onClick={() => downloadCsv(items, title)}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {error && (
              <p className="text-sm text-[var(--danger)]">
                {error instanceof Error ? error.message : "Could not load activity."}
              </p>
            )}
            {!isLoading && !error && items.length === 0 && (
              <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-sm text-[var(--muted)]">
                No activity matches these filters.
              </p>
            )}

            <div className="space-y-5">
              {grouped.map(([day, dayItems]) => (
                <section key={day}>
                  <h3 className="sticky top-0 z-10 mb-2 bg-[var(--surface)] py-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {format(new Date(`${day}T12:00:00`), "EEEE, MMM d, yyyy")}
                  </h3>
                  <ol className="space-y-2">
                    {dayItems.map((item) => {
                      const slotLine = formatSlotWindow(item);
                      const name = item.account_display_name ?? "Someone";
                      return (
                        <li
                          key={item.id}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
                        >
                          <div className="flex items-start gap-2.5">
                            <Avatar className="mt-0.5 h-8 w-8">
                              <AvatarImage
                                src={item.account_avatar_url ?? undefined}
                              />
                              <AvatarFallback>
                                {name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-sm font-medium">
                                  <span className="text-[var(--foreground)]">
                                    {name}
                                  </span>{" "}
                                  <span className="font-normal text-[var(--muted)]">
                                    · {kindLabel(item.kind).toLowerCase()}
                                  </span>
                                </p>
                                <time
                                  dateTime={item.occurred_at}
                                  className="text-[11px] text-[var(--muted)]"
                                >
                                  {format(new Date(item.occurred_at), "h:mm a")}
                                </time>
                              </div>
                              {item.role && (
                                <p className="mt-0.5 text-xs capitalize text-[var(--muted)]">
                                  Role: {item.role}
                                </p>
                              )}
                              {slotLine && (
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {slotLine}
                                </p>
                              )}
                              {item.claim_comment ? (
                                <p className="mt-2 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2 text-xs">
                                  <span className="block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                                    Comment
                                  </span>
                                  {item.claim_comment}
                                </p>
                              ) : null}
                              {item.kind === "cancelled" &&
                              item.cancellation_reason ? (
                                <p className="mt-2 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2 text-xs">
                                  <span className="block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                                    Cancellation reason
                                  </span>
                                  {item.cancellation_reason}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
