"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
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
import { SlotBlock } from "@/features/calendar/slot-block";
import { DuplicateDayMenu } from "@/features/slots/duplicate-day-menu";
import { deleteSlotsInDay } from "@/features/slots/actions";
import { getClientTimeZoneOffsetMinutes } from "@/lib/utils/dates";
import type { SlotWithReservations, WorkspaceRole } from "@/types";

function AddSpotCallout({
  onClick,
  title,
  subtitle,
}: {
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-[var(--accent)]/45 bg-[var(--accent-soft)]/50 px-3 py-2.5 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight text-[var(--foreground)]">
          {title}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-xs leading-tight text-[var(--muted)]">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function DayDetailPanel({
  day,
  slots,
  role,
  accountId,
  workspaceId,
  onAddSlot,
  onEditSlot,
  onSlotsChanged,
}: {
  day: Date | null;
  slots: SlotWithReservations[];
  role: WorkspaceRole;
  accountId: string;
  workspaceId: string;
  onAddSlot: () => void;
  onEditSlot: (slot: SlotWithReservations) => void;
  onSlotsChanged: () => void | Promise<void>;
}) {
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  if (!day) {
    return (
      <aside className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--muted)]">
        Select a day to view or create time slots.
      </aside>
    );
  }

  const dayLabel = format(day, "MMMM d, yyyy");
  const dateKey = format(day, "yyyy-MM-dd");

  return (
    <aside className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">{format(day, "EEEE")}</p>
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {dayLabel}
          </h3>
        </div>
        {role === "admin" && slots.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            <DuplicateDayMenu
              workspaceId={workspaceId}
              sourceDate={dateKey}
              weekdayLabel={format(day, "EEEE")}
              onDone={onSlotsChanged}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear day
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {role === "admin" && (
          <AddSpotCallout
            onClick={onAddSlot}
            title={
              slots.length === 0
                ? "Add the first time slot"
                : "Add another time slot"
            }
            subtitle={
              slots.length === 0
                ? "People can claim spots in it once it’s open"
                : undefined
            }
          />
        )}
        {slots.length === 0 ? (
          role !== "admin" ? (
            <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-center text-sm text-[var(--muted)]">
              No spots available on this day.
            </p>
          ) : null
        ) : (
          slots.map((slot) => (
            <SlotBlock
              key={slot.id}
              slot={slot}
              accountId={accountId}
              role={role}
              onEdit={() => onEditSlot(slot)}
              onChanged={onSlotsChanged}
            />
          ))
        )}
      </div>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear time slots for {dayLabel}?</DialogTitle>
            <DialogDescription>
              Deletes every time slot on this day that has no active claims.
              Slots with active claims are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={clearing}
              onClick={async () => {
                setClearing(true);
                try {
                  const result = await deleteSlotsInDay({
                    workspaceId,
                    date: dateKey,
                    timeZoneOffsetMinutes: getClientTimeZoneOffsetMinutes(),
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(
                    `Deleted ${result.data.deleted}` +
                      (result.data.skipped
                        ? `, skipped ${result.data.skipped} with active claims`
                        : ""),
                  );
                  setClearOpen(false);
                  await onSlotsChanged();
                } finally {
                  setClearing(false);
                }
              }}
            >
              {clearing ? "Clearing…" : "Clear day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
