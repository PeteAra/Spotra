"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { SlotEditScope } from "@/features/slots/actions";

const OPTIONS: Array<{
  value: SlotEditScope;
  label: string;
  description: string;
}> = [
  {
    value: "this",
    label: "This spot",
    description: "Only change the spot you are editing.",
  },
  {
    value: "following",
    label: "This and following spots",
    description:
      "Change this spot and later spots that share the same title.",
  },
  {
    value: "all",
    label: "All spots",
    description: "Change every spot in this workspace with the same title.",
  },
];

export function EditRecurringSpotsDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: SlotEditScope) => void | Promise<void>;
  loading?: boolean;
}) {
  const [scope, setScope] = useState<SlotEditScope>("this");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setScope("this");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Recurring Spots</DialogTitle>
          <DialogDescription>
            Other spots share this title. Choose which ones to update. Only one
            option can be selected.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2" disabled={loading}>
          <legend className="sr-only">Edit scope</legend>
          {OPTIONS.map((option) => {
            const selected = scope === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition",
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40",
                )}
              >
                <input
                  type="radio"
                  name="edit-recurring-scope"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={selected}
                  onChange={() => setScope(option.value)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={loading}
            onClick={() => void onConfirm(scope)}
          >
            {loading ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
