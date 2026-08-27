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

const EDIT_OPTIONS: Array<{
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
      "Change this spot and later spots with the same title and the same start/end times.",
  },
  {
    value: "all",
    label: "All spots",
    description:
      "Change every spot with the same title and the same start/end times.",
  },
];

const DELETE_OPTIONS: Array<{
  value: SlotEditScope;
  label: string;
  description: string;
}> = [
  {
    value: "this",
    label: "This spot",
    description: "Only delete the spot you selected.",
  },
  {
    value: "following",
    label: "This and following spots",
    description:
      "Delete this spot and later spots with the same title and the same start/end times.",
  },
  {
    value: "all",
    label: "All spots",
    description:
      "Delete every spot with the same title and the same start/end times.",
  },
];

export function RecurringSpotsScopeDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  mode = "edit",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: SlotEditScope) => void | Promise<void>;
  loading?: boolean;
  mode?: "edit" | "delete";
}) {
  const [scope, setScope] = useState<SlotEditScope>("this");
  const options = mode === "delete" ? DELETE_OPTIONS : EDIT_OPTIONS;

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
          <DialogTitle>
            {mode === "delete" ? "Delete Recurring Spots" : "Edit Recurring Spots"}
          </DialogTitle>
          <DialogDescription>
            {mode === "delete"
              ? "Other spots share this title and time. Choose which ones to delete. Spots with active claims are skipped."
              : "Other spots share this title and time. Choose which ones should get these changes."}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2" disabled={loading}>
          <legend className="sr-only">
            {mode === "delete" ? "Delete scope" : "Edit scope"}
          </legend>
          {options.map((option) => {
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
                  name={`recurring-scope-${mode}`}
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
            variant={mode === "delete" ? "destructive" : "default"}
            disabled={loading}
            onClick={() => void onConfirm(scope)}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {mode === "delete" ? "Deleting…" : "Saving…"}
              </>
            ) : mode === "delete" ? (
              "Delete"
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use RecurringSpotsScopeDialog */
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
  return (
    <RecurringSpotsScopeDialog
      mode="edit"
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      loading={loading}
    />
  );
}
