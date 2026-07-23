"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DuplicatePreviousMonthPrompt({
  open,
  onOpenChange,
  onConfirm,
  onSkip,
  targetLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  onSkip: () => void;
  targetLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate previous month?</DialogTitle>
          <DialogDescription>
            Copy last month&apos;s slot pattern into {targetLabel}. Days that
            already have slots will be skipped.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onSkip}>
            No, just open month
          </Button>
          <Button onClick={() => void onConfirm()}>Yes, duplicate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
