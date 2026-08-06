"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SlotClaimToast } from "@/features/reservations/slot-claim-toast";
import { SlotCancelToast } from "@/features/reservations/slot-cancel-toast";
import { deleteSlot } from "@/features/slots/actions";
import { formatTimeRange } from "@/lib/utils/dates";
import { slotColorFromTitle } from "@/lib/utils/slot-color";
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
  const isFull = slot.availability === "full";
  const isBlocked = slot.availability === "blocked";
  const isClosed = isFull || isBlocked;
  const canClaim = !ownReservation && !isClosed;
  const palette = slotColorFromTitle(slot.title);
  const title = slot.title?.trim();

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        isClosed && "border-dashed",
      )}
      style={{
        backgroundColor: isClosed
          ? "color-mix(in srgb, var(--surface-muted) 55%, " + palette.bg + ")"
          : palette.bg,
        borderColor: isFull
          ? "var(--danger)"
          : isBlocked
            ? "var(--muted)"
            : palette.border,
      }}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          disabled={!ownReservation && !canClaim}
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
          <div className="flex flex-wrap items-center gap-1.5">
            {title ? (
              <p
                className="text-sm font-semibold leading-tight"
                style={{ color: palette.text }}
              >
                {title}
              </p>
            ) : null}
            {isFull && (
              <span className="rounded bg-[var(--danger)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
                Full
              </span>
            )}
            {isBlocked && (
              <span className="rounded bg-[var(--foreground)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[var(--surface)]">
                Blocked
              </span>
            )}
          </div>
          <p
            className={cn(
              "text-sm font-semibold leading-tight",
              title || isClosed ? "mt-0.5 text-xs font-medium" : "text-sm",
            )}
            style={{ color: title ? palette.text : undefined }}
          >
            {formatTimeRange(slot.starts_at, slot.ends_at)}
            <span
              className={cn(
                "ml-1.5 font-normal",
                isFull
                  ? "text-[var(--danger)]"
                  : isBlocked
                    ? "text-[var(--muted)]"
                    : "text-[var(--muted)]",
              )}
            >
              {isBlocked
                ? "· Not open for claims"
                : isFull
                  ? `· All ${slot.capacity} claimed`
                  : `· ${slot.claimed_count}/${slot.capacity}${
                      slot.availability === "available" ? " available" : ""
                    }`}
            </span>
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {canClaim && (
            <SlotClaimToast
              open={claimOpen}
              onOpenChange={setClaimOpen}
              slotId={slot.id}
              onClaimed={onChanged}
            >
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2.5 text-xs"
                onClick={() => setClaimOpen(true)}
              >
                Claim
              </Button>
            </SlotClaimToast>
          )}
          {role === "admin" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={async () => {
                  const result = await deleteSlot({
                    slotId: slot.id,
                    workspaceId: slot.workspace_id,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Time slot deleted");
                  onChanged();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {slot.reservations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {slot.reservations.map((reservation) => {
            const isOwn = reservation.account_id === accountId;
            const name = reservation.account?.display_name ?? "Participant";
            return (
              <button
                key={reservation.id}
                type="button"
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  isOwn
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "bg-[var(--surface)]/80 text-[var(--foreground)]",
                )}
                onClick={() => {
                  if (!isOwn && role !== "admin") return;
                  setActiveReservation(reservation);
                  setCancelOpen(true);
                }}
                title={isOwn || role === "admin" ? "Cancel this spot" : name}
              >
                {name}
                {isOwn ? " (you)" : ""}
              </button>
            );
          })}
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
