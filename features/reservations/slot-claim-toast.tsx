"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { claimSlot } from "@/features/reservations/actions";
import { getClientTimeZoneOffsetMinutes } from "@/lib/utils/dates";

export function SlotClaimToast({
  open,
  onOpenChange,
  slotId,
  commentsEnabled = false,
  commentsRequired = false,
  onClaimed,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string;
  commentsEnabled?: boolean;
  commentsRequired?: boolean;
  onClaimed: () => void;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) {
      setComment("");
    }
  }, [open]);

  async function handleClaim() {
    const trimmed = comment.trim();
    if (commentsEnabled && commentsRequired && trimmed.length < 3) {
      toast.error("Please enter at least 3 characters.");
      return;
    }
    if (trimmed.length > 500) {
      toast.error("Comment must be 500 characters or fewer.");
      return;
    }

    setLoading(true);
    const result = await claimSlot({
      slotId,
      claimComment: commentsEnabled ? trimmed || undefined : undefined,
      timeZoneOffsetMinutes: getClientTimeZoneOffsetMinutes(),
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Spot claimed");
    onOpenChange(false);
    onClaimed();
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        className={commentsEnabled ? "w-80" : "w-72"}
      >
        <p className="font-medium">Claim this spot?</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your name will appear on the spot for others in this workspace.
        </p>

        {commentsEnabled ? (
          <div className="mt-3 space-y-2">
            <Label htmlFor={`claim-comment-${slotId}`}>
              Comment{commentsRequired ? " (required)" : " (optional)"}
            </Label>
            <Textarea
              id={`claim-comment-${slotId}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={
                commentsRequired
                  ? "Share why you're claiming this spot…"
                  : "Add a note for others (optional)…"
              }
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-[var(--muted)]">
              {commentsRequired
                ? "At least 3 characters."
                : "Leave blank if you have nothing to add."}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            No
          </Button>
          <Button size="sm" disabled={loading} onClick={handleClaim}>
            {loading ? "Claiming…" : "Yes"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
