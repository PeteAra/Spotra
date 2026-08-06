"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";
import { SlotBlock } from "@/features/calendar/slot-block";
import { DuplicateDayMenu } from "@/features/slots/duplicate-day-menu";
import type { SlotWithReservations, WorkspaceRole } from "@/types";

function AddSpotCallout({
  onClick,
  title,
  subtitle,
  compact = false,
}: {
  onClick: () => void;
  title: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--accent)]/45 bg-[var(--accent-soft)]/50 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] ${
        compact ? "px-4 py-6" : "px-4 py-10"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] ${
          compact ? "h-9 w-9" : "h-11 w-11"
        }`}
      >
        <Plus className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={2.5} />
      </span>
      <span>
        <span className="block font-medium text-[var(--foreground)]">{title}</span>
        {subtitle ? (
          <span className="mt-1 block text-sm text-[var(--muted)]">{subtitle}</span>
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
  if (!day) {
    return (
      <aside className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--muted)]">
        Select a day to view or create spots.
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
        {role === "admin" && slots.length > 0 && (
          <DuplicateDayMenu
            workspaceId={workspaceId}
            sourceDate={format(day, "yyyy-MM-dd")}
            weekdayLabel={format(day, "EEEE")}
            onDone={onSlotsChanged}
          />
        )}
      </div>

      <div className="mt-6 space-y-3">
        {slots.length === 0 ? (
          role === "admin" ? (
            <AddSpotCallout
              onClick={onAddSlot}
              title="Add the first spot"
              subtitle="Open availability for this day"
            />
          ) : (
            <p className="rounded-2xl bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              No spots available on this day.
            </p>
          )
        ) : (
          <>
            {slots.map((slot) => (
              <SlotBlock
                key={slot.id}
                slot={slot}
                accountId={accountId}
                role={role}
                onEdit={() => onEditSlot(slot)}
                onChanged={onSlotsChanged}
              />
            ))}
            {role === "admin" && (
              <AddSpotCallout
                onClick={onAddSlot}
                title="Add another spot"
                compact
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
