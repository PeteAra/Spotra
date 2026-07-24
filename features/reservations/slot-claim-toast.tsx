"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { claimSlot } from "@/features/reservations/actions";

export function SlotClaimToast({
  open,
  onOpenChange,
  slotId,
  onClaimed,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotId: string;
  onClaimed: () => void;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" className="w-72">
        <p className="font-medium">Claim this spot?</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your name will appear on the spot for others in this workspace.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            No
          </Button>
          <Button
            size="sm"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              const result = await claimSlot(slotId);
              setLoading(false);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Spot claimed");
              onOpenChange(false);
              onClaimed();
            }}
          >
            Yes
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
