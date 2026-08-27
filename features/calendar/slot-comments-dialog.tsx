"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import type { Reservation } from "@/types";

function slotComments(reservations: Reservation[]): Reservation[] {
  return reservations
    .filter((reservation) => reservation.claim_comment?.trim())
    .sort(
      (a, b) =>
        new Date(a.claimed_at).getTime() - new Date(b.claimed_at).getTime(),
    );
}

export function SlotCommentsDialog({
  open,
  onOpenChange,
  slotTitle,
  reservations,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotTitle: string | null;
  reservations: Reservation[];
  accountId: string;
}) {
  const comments = slotComments(reservations);
  const title = slotTitle?.trim() || "Spot comments";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Notes left when participants claimed this spot.
          </DialogDescription>
        </DialogHeader>

        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            No comments yet.
          </p>
        ) : (
          <ul className="max-h-[min(60vh,24rem)] space-y-3 overflow-y-auto pr-1">
            {comments.map((reservation) => {
              const isOwn = reservation.account_id === accountId;
              const name = reservation.account?.display_name ?? "Participant";
              const body = reservation.claim_comment?.trim() ?? "";
              const when = format(
                new Date(reservation.claimed_at),
                "MMM d · h:mm a",
              );

              return (
                <li
                  key={reservation.id}
                  className={cn("flex", isOwn ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2",
                      isOwn
                        ? "rounded-br-md bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "rounded-bl-md border border-[var(--border)] bg-[var(--surface-muted)]",
                    )}
                  >
                    <div
                      className={cn(
                        "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs",
                        isOwn
                          ? "text-[var(--accent-foreground)]/80"
                          : "text-[var(--muted)]",
                      )}
                    >
                      <span className="font-semibold">{name}</span>
                      <span>{when}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">
                      {body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function countSlotComments(reservations: Reservation[]): number {
  return slotComments(reservations).length;
}
