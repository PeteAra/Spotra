"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, isToday } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ListChecks,
  Pause,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { setClaimsEnabled } from "@/features/calendar/closures-actions";
import { DayDetailPanel } from "@/features/calendar/day-detail-panel";
import { MySpotsPanel } from "@/features/calendar/my-spots-panel";
import { DuplicatePreviousMonthPrompt } from "@/features/slots/duplicate-previous-month-prompt";
import { SlotFormDialog } from "@/features/slots/slot-form-dialog";
import {
  deleteSlotsInMonth,
  duplicatePreviousMonth,
} from "@/features/slots/actions";
import {
  useClosures,
  useInvalidateClosures,
  useInvalidateSlots,
  useSlots,
} from "@/hooks/use-workspace-data";
import {
  getMonthGrid,
  getClientTimeZoneOffsetMinutes,
  isInMonth,
  monthKey,
  nextMonth,
  previousMonth,
} from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import type { SlotWithReservations, WorkspaceRole } from "@/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isStackedLayout() {
  return typeof window !== "undefined" && window.innerWidth < 1024;
}

function scrollCardIntoView(node: HTMLElement | null) {
  if (!node || !isStackedLayout()) return;
  // Wait until the card has painted/laid out (especially after opening).
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      node.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });
}

export function CalendarMonthView({
  workspaceId,
  role,
  accountId,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  accountId: string;
}) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SlotWithReservations | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicatePromptOpen, setDuplicatePromptOpen] = useState(false);
  const [mySpotsOpen, setMySpotsOpen] = useState(false);
  const [togglingMonthClaims, setTogglingMonthClaims] = useState(false);

  const detailRef = useRef<HTMLDivElement>(null);
  const mySpotsRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();
  const [dayColumnHeight, setDayColumnHeight] = useState<number | null>(null);

  const selectDay = useCallback((day: Date) => {
    setSelectedDay(day);
    setMonth(day);
    scrollCardIntoView(detailRef.current);
  }, []);

  useEffect(() => {
    if (!mySpotsOpen) return;
    scrollCardIntoView(mySpotsRef.current);
  }, [mySpotsOpen]);

  const { data: slots = [], isLoading, error: slotsError } = useSlots(
    workspaceId,
    month,
  );
  const { data: closures = [] } = useClosures(workspaceId, month);
  const invalidateSlots = useInvalidateSlots(workspaceId, month);
  const invalidateClosures = useInvalidateClosures(workspaceId, month);

  const currentMonthKey = monthKey(month);
  const monthClaimsDisabled = closures.some(
    (c) => c.scope === "month" && c.period_key === currentMonthKey,
  );
  const disabledDayKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const closure of closures) {
      if (closure.scope === "day") keys.add(closure.period_key);
    }
    return keys;
  }, [closures]);

  useEffect(() => {
    const calendar = calendarRef.current;
    if (!calendar || mySpotsOpen) {
      setDayColumnHeight(null);
      return;
    }

    const syncHeight = () => {
      if (!isStackedLayout()) {
        setDayColumnHeight(calendar.getBoundingClientRect().height);
      } else {
        setDayColumnHeight(null);
      }
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(calendar);
    window.addEventListener("resize", syncHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, [mySpotsOpen, month, isLoading]);

  const invalidate = useCallback(async () => {
    await Promise.all([
      invalidateSlots(),
      invalidateClosures(),
      queryClient.invalidateQueries({
        queryKey: ["my-claimed-slots", workspaceId],
      }),
    ]);
  }, [invalidateClosures, invalidateSlots, queryClient, workspaceId]);

  async function toggleMonthClaims(enabled: boolean) {
    setTogglingMonthClaims(true);
    try {
      const result = await setClaimsEnabled({
        workspaceId,
        scope: "month",
        periodKey: currentMonthKey,
        enabled,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        enabled
          ? `${format(month, "MMMM")} is live for claims`
          : `${format(month, "MMMM")} is paused for claims`,
      );
      await invalidateClosures();
    } finally {
      setTogglingMonthClaims(false);
    }
  }

  const slotsByDay = useMemo(() => {
    const map = new Map<string, SlotWithReservations[]>();
    for (const slot of slots) {
      const starts = new Date(slot.starts_at);
      if (Number.isNaN(starts.getTime())) continue;
      const key = format(starts, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return map;
  }, [slots]);

  const grid = getMonthGrid(month);
  const selectedKey = selectedDay
    ? format(selectedDay, "yyyy-MM-dd")
    : null;
  const selectedSlots = selectedKey ? (slotsByDay.get(selectedKey) ?? []) : [];

  function goToMonth(next: Date) {
    setMonth(next);
    setSelectedDay(next);
  }

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section
        ref={calendarRef}
        className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-6 lg:sticky lg:top-4"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => goToMonth(previousMonth(month))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-[10rem] text-center font-[family-name:var(--font-display)] text-2xl font-semibold">
              {format(month, "MMMM yyyy")}
            </h2>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => goToMonth(nextMonth(month))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = new Date();
                setMonth(today);
                setSelectedDay(today);
              }}
            >
              Today
            </Button>
            <Button
              variant={mySpotsOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setMySpotsOpen((open) => !open)}
            >
              <ListChecks className="h-3.5 w-3.5" />
              My Spots
            </Button>
            {role === "admin" && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDuplicatePromptOpen(true)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate previous month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear month
                </Button>
              </>
            )}
          </div>
        </div>

        {role === "admin" ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {monthClaimsDisabled ? "Month paused" : "Month live"}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {monthClaimsDisabled
                  ? "Participants can see spots but cannot claim any day this month."
                  : "Participants can claim open spots this month."}
              </p>
            </div>
            <Switch
              checked={!monthClaimsDisabled}
              disabled={togglingMonthClaims}
              aria-label={
                monthClaimsDisabled
                  ? "Resume claims for this month"
                  : "Pause claims for this month"
              }
              onCheckedChange={(checked) => void toggleMonthClaims(checked)}
            />
          </div>
        ) : monthClaimsDisabled ? (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2.5 text-sm text-[var(--muted)]">
            <Pause className="h-4 w-4 shrink-0" />
            Claims are paused this month.
          </div>
        ) : null}

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="pb-2 text-center text-xs font-medium uppercase tracking-wide text-[var(--muted)]"
            >
              {d}
            </div>
          ))}
          {grid.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const daySlots = slotsByDay.get(key) ?? [];
            const inMonth = isInMonth(day, month);
            const selected = selectedDay ? isSameDay(day, selectedDay) : false;
            const openSeats = daySlots.reduce(
              (sum, s) => sum + Math.max(s.capacity - s.claimed_count, 0),
              0,
            );
            const allBlocked =
              daySlots.length > 0 && daySlots.every((s) => s.capacity === 0);
            const dayFull = daySlots.length > 0 && openSeats === 0 && !allBlocked;
            const claimsDisabled =
              inMonth && (monthClaimsDisabled || disabledDayKeys.has(key));
            const dayClosed = dayFull || allBlocked || claimsDisabled;

            return (
              <button
                key={key}
                type="button"
                disabled={!inMonth}
                onClick={() => selectDay(day)}
                className={cn(
                  "min-h-[4.5rem] rounded-2xl border p-2 text-left transition sm:min-h-[5.5rem]",
                  inMonth
                    ? "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--accent)]"
                    : "border-transparent opacity-30",
                  selected && "border-[var(--accent)] ring-2 ring-[var(--accent)]/30",
                  isToday(day) && inMonth && !dayClosed && "bg-[var(--accent-soft)]",
                  dayFull &&
                    inMonth &&
                    !claimsDisabled &&
                    "border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_6%,var(--surface-elevated))]",
                  (allBlocked || claimsDisabled) &&
                    inMonth &&
                    "border-[var(--border)] bg-[var(--surface-muted)]/70",
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold">{format(day, "d")}</span>
                  <span className="flex items-center gap-1">
                    {claimsDisabled ? (
                      <Pause
                        className="h-3.5 w-3.5 text-[var(--muted)]"
                        aria-label="Claims paused"
                      />
                    ) : null}
                    {daySlots.length > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-[10px] font-medium",
                          dayFull && !claimsDisabled
                            ? "bg-[var(--danger)] text-white"
                            : allBlocked || claimsDisabled
                              ? "bg-[var(--foreground)] text-[var(--surface)]"
                              : "bg-[var(--surface-muted)]",
                        )}
                      >
                        {daySlots.length}
                      </span>
                    )}
                  </span>
                </div>
                {daySlots.length > 0 && (
                  <p
                    className={cn(
                      "mt-2 text-[10px] sm:text-xs",
                      dayFull && !claimsDisabled
                        ? "font-semibold text-[var(--danger)]"
                        : allBlocked || claimsDisabled
                          ? "font-semibold text-[var(--muted)]"
                          : "text-[var(--muted)]",
                    )}
                  >
                    {claimsDisabled
                      ? "Paused"
                      : allBlocked
                        ? "Blocked"
                        : dayFull
                          ? "Full"
                          : `${openSeats} open`}
                  </p>
                )}
                {claimsDisabled && daySlots.length === 0 ? (
                  <p className="mt-2 text-[10px] font-semibold text-[var(--muted)] sm:text-xs">
                    Paused
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
        {isLoading && (
          <p className="mt-4 text-sm text-[var(--muted)]">Loading spots…</p>
        )}
        {slotsError && (
          <p className="mt-4 text-sm text-[var(--danger)]">
            Could not load spots:{" "}
            {slotsError instanceof Error ? slotsError.message : "Unknown error"}
          </p>
        )}
      </section>

      <div
        className="flex flex-col gap-6"
        style={
          dayColumnHeight != null
            ? { height: dayColumnHeight }
            : undefined
        }
      >
        {mySpotsOpen ? (
          <div ref={mySpotsRef} className="scroll-mt-4 shrink-0">
            <MySpotsPanel
              workspaceId={workspaceId}
              open={mySpotsOpen}
              onClose={() => setMySpotsOpen(false)}
              onSelectDay={selectDay}
              onChanged={invalidate}
            />
          </div>
        ) : null}
        <div
          ref={detailRef}
          className={cn(
            "scroll-mt-4",
            dayColumnHeight != null && "flex min-h-0 flex-1 flex-col",
          )}
        >
          <DayDetailPanel
            day={selectedDay}
            slots={selectedSlots}
            role={role}
            accountId={accountId}
            workspaceId={workspaceId}
            monthClaimsDisabled={monthClaimsDisabled}
            dayClaimsDisabled={
              selectedKey ? disabledDayKeys.has(selectedKey) : false
            }
            fillHeight={dayColumnHeight != null}
            onAddSlot={() => {
              setEditingSlot(null);
              setSlotFormOpen(true);
            }}
            onEditSlot={(slot) => {
              setEditingSlot(slot);
              setSlotFormOpen(true);
            }}
            onSlotsChanged={invalidate}
            onClosuresChanged={invalidateClosures}
          />
        </div>
      </div>

      {selectedDay && (
        <SlotFormDialog
          open={slotFormOpen}
          onOpenChange={setSlotFormOpen}
          workspaceId={workspaceId}
          day={selectedDay}
          slot={editingSlot}
          onSaved={invalidate}
        />
      )}

      <DuplicatePreviousMonthPrompt
        open={duplicatePromptOpen}
        onOpenChange={setDuplicatePromptOpen}
        onConfirm={async () => {
          const result = await duplicatePreviousMonth({
            workspaceId,
            targetMonthKey: monthKey(month),
            timeZoneOffsetMinutes: getClientTimeZoneOffsetMinutes(),
          });
          if (!result.ok) {
            toast.error(result.error);
          } else {
            toast.success(
              `Created ${result.data.created} spots` +
                (result.data.skipped
                  ? ` (${result.data.skipped} skipped — same title at overlapping times)`
                  : ""),
            );
          }
          setDuplicatePromptOpen(false);
          invalidate();
        }}
        onSkip={() => setDuplicatePromptOpen(false)}
        targetLabel={format(month, "MMMM yyyy")}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear spots for {format(month, "MMMM yyyy")}?</DialogTitle>
            <DialogDescription>
              Spots with claim history will be kept. Empty spots will be
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const result = await deleteSlotsInMonth({
                  workspaceId,
                  monthKey: monthKey(month),
                  timeZoneOffsetMinutes: getClientTimeZoneOffsetMinutes(),
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(
                  `Deleted ${result.data.deleted}` +
                    (result.data.skipped
                      ? `, skipped ${result.data.skipped}`
                      : ""),
                );
                setDeleteOpen(false);
                invalidate();
              }}
            >
              Clear month
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
