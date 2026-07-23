"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlotBlock } from "@/features/calendar/slot-block";
import { DuplicateDayMenu } from "@/features/slots/duplicate-day-menu";
import type { SlotWithReservations, WorkspaceRole } from "@/types";

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
  onSlotsChanged: () => void;
}) {
  if (!day) {
    return (
      <aside className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--muted)]">
        Select a day to view or create slots.
      </aside>
    );
  }

  return (
    <aside className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">{format(day, "EEEE")}</p>
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {format(day, "MMMM d, yyyy")}
          </h3>
        </div>
        {role === "admin" && (
          <div className="flex flex-col items-end gap-2">
            <Button size="sm" onClick={onAddSlot}>
              <Plus className="h-4 w-4" />
              Add slot
            </Button>
            {slots.length > 0 && (
              <DuplicateDayMenu
                workspaceId={workspaceId}
                sourceDate={format(day, "yyyy-MM-dd")}
                weekdayLabel={format(day, "EEEE")}
                onDone={onSlotsChanged}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {slots.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            {role === "admin"
              ? "No slots yet. Click Add slot to open availability."
              : "No slots available on this day."}
          </p>
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
    </aside>
  );
}
