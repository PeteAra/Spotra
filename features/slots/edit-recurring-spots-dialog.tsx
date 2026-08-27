"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { SlotEditScope } from "@/types";

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
      "Update this spot and later spots with the same title (settings always; times only if they matched this spot’s clock).",
  },
  {
    value: "all",
    label: "All spots",
    description:
      "Update every spot with the same title (settings always; times only if they matched this spot’s clock).",
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
            Other spots share this title. Choose which ones should get these
            settings (comments, capacity, title, color). Times only change on
            spots that already matched this spot&apos;s start and end time.
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
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
