"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancelReservation } from "@/features/reservations/actions";

const MIN_REASON = 10;

export function SlotCancelToast({
  open,
  onOpenChange,
  reservationId,
  onCancelled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const canSubmit = reason.trim().length >= MIN_REASON;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure you want to cancel?</DialogTitle>
          <DialogDescription>
            Please give a reason for the cancellation. Your name will be removed
            from the spot.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Cancellation reason</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="At least 10 characters…"
            maxLength={500}
          />
          <p className="text-xs text-[var(--muted)]">
            {reason.trim().length}/{MIN_REASON} minimum characters
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            No
          </Button>
          <Button
            disabled={!canSubmit || loading}
            onClick={async () => {
              setLoading(true);
              const result = await cancelReservation({
                reservationId,
                reason,
              });
              setLoading(false);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Spot cancelled");
              setReason("");
              onOpenChange(false);
              onCancelled();
            }}
          >
            Yes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
