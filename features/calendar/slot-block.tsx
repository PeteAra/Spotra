"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SlotClaimToast } from "@/features/reservations/slot-claim-toast";
import { SlotCancelToast } from "@/features/reservations/slot-cancel-toast";
import { deleteSlot } from "@/features/slots/actions";
import { formatTimeRange } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import type { Reservation, SlotWithReservations, WorkspaceRole } from "@/types";

export function SlotBlock({
  slot,
  accountId,
  role,
  onEdit,
  onChanged,
}: {
  slot: SlotWithReservations;
  accountId: string;
  role: WorkspaceRole;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [claimOpen, setClaimOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(
    null,
  );

  const ownReservation = slot.reservations.find(
    (r) => r.account_id === accountId,
  );
  const canClaim = !ownReservation && slot.availability !== "full";

  const color =
    slot.availability === "full"
      ? "border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))]"
      : slot.availability === "partial"
        ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]"
        : "border-[var(--success)]/40 bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))]";

  return (
    <div className={cn("rounded-2xl border p-4", color)}>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            if (ownReservation) {
              setActiveReservation(ownReservation);
              setCancelOpen(true);
              return;
            }
            if (canClaim) {
              setClaimOpen(true);
            }
          }}
        >
          <p className="font-semibold">
            {formatTimeRange(slot.starts_at, slot.ends_at)}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {slot.claimed_count}/{slot.capacity} claimed
            {slot.availability === "available" && " · Available"}
            {slot.availability === "full" && " · Full"}
          </p>
        </button>
        {role === "admin" && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                const result = await deleteSlot({
                  slotId: slot.id,
                  workspaceId: slot.workspace_id,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Slot deleted");
                onChanged();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {slot.reservations.map((reservation) => {
          const isOwn = reservation.account_id === accountId;
          const name = reservation.account?.display_name ?? "Participant";
          return (
            <button
              key={reservation.id}
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                isOwn
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--surface-muted)] text-[var(--foreground)]",
              )}
              onClick={() => {
                if (!isOwn && role !== "admin") return;
                setActiveReservation(reservation);
                setCancelOpen(true);
              }}
              title={isOwn || role === "admin" ? "Cancel reservation" : name}
            >
              {name}
              {isOwn ? " (you)" : ""}
            </button>
          );
        })}
      </div>

      {canClaim && (
        <div className="mt-4">
          <SlotClaimToast
            open={claimOpen}
            onOpenChange={setClaimOpen}
            slotId={slot.id}
            onClaimed={onChanged}
          >
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setClaimOpen(true)}
            >
              Claim this slot
            </Button>
          </SlotClaimToast>
        </div>
      )}

      {activeReservation && (
        <SlotCancelToast
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          reservationId={activeReservation.id}
          onCancelled={onChanged}
        />
      )}
    </div>
  );
}
