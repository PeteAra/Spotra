"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, Trash2 } from "lucide-react";
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
import { DayDetailPanel } from "@/features/calendar/day-detail-panel";
import { DuplicatePreviousMonthPrompt } from "@/features/slots/duplicate-previous-month-prompt";
import { SlotFormDialog } from "@/features/slots/slot-form-dialog";
import {
  deleteSlotsInMonth,
  duplicatePreviousMonth,
} from "@/features/slots/actions";
import { useInvalidateSlots, useSlots } from "@/hooks/use-workspace-data";
import {
  getMonthGrid,
  isInMonth,
  monthKey,
  nextMonth,
  previousMonth,
} from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import type { SlotWithReservations, WorkspaceRole } from "@/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const [duplicatePromptOpen, setDuplicatePromptOpen] = useState(false);
  const [pendingMonth, setPendingMonth] = useState<Date | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const detailRef = useRef<HTMLDivElement>(null);

  const selectDay = useCallback((day: Date) => {
    setSelectedDay(day);
    // On stacked (mobile) layouts the detail card sits below the grid, so
    // bring it into view once the selection has rendered.
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

  const { data: slots = [], isLoading, error: slotsError } = useSlots(
    workspaceId,
    month,
  );
  const invalidate = useInvalidateSlots(workspaceId, month);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, SlotWithReservations[]>();
    for (const slot of slots) {
      const key = format(new Date(slot.starts_at), "yyyy-MM-dd");
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

  function goToMonth(next: Date, offerDuplicate: boolean) {
    if (role === "admin" && offerDuplicate) {
      setPendingMonth(next);
      setDuplicatePromptOpen(true);
      return;
    }
    setMonth(next);
    setSelectedDay(next);
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => goToMonth(previousMonth(month), false)}
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
              onClick={() => goToMonth(nextMonth(month), true)}
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
            {role === "admin" && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPendingMonth(month);
                    setDuplicatePromptOpen(true);
                  }}
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
                  isToday(day) && inMonth && "bg-[var(--accent-soft)]",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="text-sm font-semibold">{format(day, "d")}</span>
                  {daySlots.length > 0 && (
                    <span className="rounded-full bg-[var(--surface-muted)] px-1.5 text-[10px] font-medium">
                      {daySlots.length}
                    </span>
                  )}
                </div>
                {daySlots.length > 0 && (
                  <p className="mt-2 text-[10px] text-[var(--muted)] sm:text-xs">
                    {openSeats > 0 ? `${openSeats} open` : "Full"}
                  </p>
                )}
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

      <div ref={detailRef} className="scroll-mt-4">
        <DayDetailPanel
          day={selectedDay}
          slots={selectedSlots}
          role={role}
          accountId={accountId}
          workspaceId={workspaceId}
          onAddSlot={() => {
            setEditingSlot(null);
            setSlotFormOpen(true);
          }}
          onEditSlot={(slot) => {
            setEditingSlot(slot);
            setSlotFormOpen(true);
          }}
          onSlotsChanged={invalidate}
        />
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
        onOpenChange={(open) => {
          setDuplicatePromptOpen(open);
          if (!open && pendingMonth) {
            setMonth(pendingMonth);
            setSelectedDay(pendingMonth);
            setPendingMonth(null);
          }
        }}
        onConfirm={async () => {
          const target = pendingMonth ?? month;
          const result = await duplicatePreviousMonth({
            workspaceId,
            targetMonthKey: monthKey(target),
          });
          if (!result.ok) {
            toast.error(result.error);
          } else {
            toast.success(
              `Created ${result.data.created} spots` +
                (result.data.skippedDays
                  ? ` (${result.data.skippedDays} days skipped)`
                  : ""),
            );
          }
          setMonth(target);
          setSelectedDay(target);
          setPendingMonth(null);
          setDuplicatePromptOpen(false);
          invalidate();
        }}
        onSkip={() => {
          const target = pendingMonth ?? month;
          setMonth(target);
          setSelectedDay(target);
          setPendingMonth(null);
          setDuplicatePromptOpen(false);
        }}
        targetLabel={format(pendingMonth ?? month, "MMMM yyyy")}
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
