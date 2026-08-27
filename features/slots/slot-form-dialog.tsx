"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditRecurringSpotsDialog } from "@/features/slots/edit-recurring-spots-dialog";
import {
  countSameTitleSlots,
  createSlot,
  updateSlot,
} from "@/features/slots/actions";
import {
  addOneHour,
  snapToTimeStep,
  TimeSelect,
} from "@/features/slots/time-select";
import {
  isSlotColorKey,
  resolveSlotColor,
  SLOT_COLOR_OPTIONS,
  type SlotColorKey,
} from "@/lib/utils/slot-color";
import {
  expandRepeatDates,
  getClientTimeZoneOffsetMinutes,
} from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import {
  slotFormSchema,
  slotRepeatRules,
  type SlotFormInput,
} from "@/lib/validators";
import type { SlotEditScope, SlotWithReservations } from "@/types";

const selectClassName =
  "flex h-10 w-full cursor-pointer appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 pr-9 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_color-mix(in_srgb,white_55%,transparent)] transition hover:border-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export function SlotFormDialog({
  open,
  onOpenChange,
  workspaceId,
  day,
  slot,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  day: Date;
  slot: SlotWithReservations | null;
  onSaved: () => void | Promise<void>;
}) {
  const [scopeOpen, setScopeOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<SlotFormInput | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<SlotFormInput>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      title: "",
      date: format(day, "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "09:30",
      capacity: 1,
      commentsEnabled: false,
      commentsRequired: false,
      colorKey: null,
      repeat: "none",
    },
  });

  const watchedTitle = form.watch("title");
  const watchedColorKey = form.watch("colorKey");
  const watchedRepeat = form.watch("repeat");
  const watchedCommentsEnabled = form.watch("commentsEnabled");
  const previewColor = resolveSlotColor(watchedTitle, watchedColorKey ?? null);
  const isAutoColor = !watchedColorKey;
  const weekdayLabel = format(day, "EEEE");
  const monthLabel = format(day, "MMMM");

  const repeatOptions = useMemo(
    () => [
      { value: "none" as const, label: "Does not repeat" },
      { value: "daily" as const, label: "Daily" },
      { value: "weekly" as const, label: `Weekly on ${weekdayLabel}` },
      { value: "weekdays" as const, label: "Every weekday (Monday–Friday)" },
      { value: "weekends" as const, label: "Every weekend day (Saturday–Sunday)" },
    ],
    [weekdayLabel],
  );

  const repeatCount = useMemo(() => {
    if (!watchedRepeat || watchedRepeat === "none") return 1;
    return expandRepeatDates(format(day, "yyyy-MM-dd"), watchedRepeat).length;
  }, [day, watchedRepeat]);

  useEffect(() => {
    if (!open) return;
    if (slot) {
      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at);
      form.reset({
        title: slot.title ?? "",
        date: format(start, "yyyy-MM-dd"),
        startTime: snapToTimeStep(format(start, "HH:mm")),
        endTime: snapToTimeStep(format(end, "HH:mm")),
        capacity: slot.capacity,
        commentsEnabled: slot.comments_enabled ?? false,
        commentsRequired: slot.comments_required ?? false,
        colorKey: isSlotColorKey(slot.color_key) ? slot.color_key : null,
        repeat: "none",
      });
    } else {
      form.reset({
        title: "",
        date: format(day, "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "09:30",
        capacity: 1,
        commentsEnabled: false,
        commentsRequired: false,
        colorKey: null,
        repeat: "none",
      });
    }
  }, [open, slot, day, form]);

  function setColor(key: SlotColorKey | null) {
    form.setValue("colorKey", key, { shouldDirty: true, shouldValidate: true });
  }

  function toastUpdateResult(result: {
    createdAdditional: number;
    skipped: number;
    updatedCount: number;
  }) {
    if (result.createdAdditional > 0) {
      toast.success(
        `Updated ${result.updatedCount} spot${result.updatedCount === 1 ? "" : "s"} and created ${result.createdAdditional} more` +
          (result.skipped
            ? ` (${result.skipped} skipped — same title at overlapping times)`
            : ""),
      );
    } else if (result.updatedCount > 1) {
      toast.success(
        `Updated ${result.updatedCount} spots` +
          (result.skipped
            ? ` (${result.skipped} same-title overlaps skipped)`
            : ""),
      );
    } else if (result.skipped > 0) {
      toast.success(
        `Time slot updated (${result.skipped} same-title overlaps skipped)`,
      );
    } else {
      toast.success("Time slot updated");
    }
  }

  async function saveEdit(values: SlotFormInput, editScope: SlotEditScope) {
    if (!slot) return;
    setSaving(true);
    const result = await updateSlot({
      slotId: slot.id,
      workspaceId,
      timeZoneOffsetMinutes: getClientTimeZoneOffsetMinutes(),
      editScope,
      ...values,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toastUpdateResult(result.data);
    setScopeOpen(false);
    setPendingValues(null);
    onOpenChange(false);
    await onSaved();
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setScopeOpen(false);
          setPendingValues(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{slot ? "Edit time slot" : "Create time slot"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            if (slot) {
              const related = await countSameTitleSlots({
                workspaceId,
                title: slot.title ?? "",
              });
              if (!related.ok) {
                toast.error(related.error);
                return;
              }
              if (related.data > 1) {
                setPendingValues(values);
                setScopeOpen(true);
                return;
              }
              await saveEdit(values, "this");
              return;
            }

            const result = await createSlot({
              workspaceId,
              timeZoneOffsetMinutes: getClientTimeZoneOffsetMinutes(),
              ...values,
            });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(
              result.data.created > 1
                ? `Created ${result.data.created} time slots` +
                    (result.data.skipped
                      ? ` (${result.data.skipped} skipped — same title at overlapping times)`
                      : "")
                : result.data.skipped
                  ? "Time slot created (some same-title overlaps were skipped)"
                  : "Time slot created",
            );
            onOpenChange(false);
            await onSaved();
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Lab practice, Office hours"
              maxLength={80}
              {...form.register("title")}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition",
                  isAutoColor
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)] ring-2 ring-[var(--accent)]/30"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]/50",
                )}
                title="Assign color from the title"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border"
                  style={{
                    backgroundColor: resolveSlotColor(watchedTitle, null).bg,
                    borderColor: resolveSlotColor(watchedTitle, null).border,
                  }}
                  aria-hidden
                />
                Auto
              </button>
              {SLOT_COLOR_OPTIONS.map((color) => {
                const selected = watchedColorKey === color.key;
                return (
                  <button
                    key={color.key}
                    type="button"
                    aria-label={color.label}
                    title={color.label}
                    onClick={() => setColor(color.key)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition",
                      selected
                        ? "scale-110 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]"
                        : "hover:scale-105",
                    )}
                    style={{
                      backgroundColor: color.bg,
                      borderColor: color.border,
                    }}
                  />
                );
              })}
            </div>
            <p className="text-xs text-[var(--muted)]">
              {isAutoColor
                ? "Auto picks a color from the title. Tap a swatch to lock one in for every time slot with this title."
                : `Using ${SLOT_COLOR_OPTIONS.find((c) => c.key === watchedColorKey)?.label ?? "custom"} for all time slots with this title — tap Auto to unlock.`}
            </p>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span
                className="inline-block h-3 w-3 rounded-full border"
                style={{
                  backgroundColor: previewColor.bg,
                  borderColor: previewColor.border,
                }}
                aria-hidden
              />
              Preview
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start</Label>
              <TimeSelect
                id="startTime"
                value={form.watch("startTime")}
                onChange={(value) => {
                  form.setValue("startTime", value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  form.setValue("endTime", addOneHour(value), {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End</Label>
              <TimeSelect
                id="endTime"
                value={form.watch("endTime")}
                onChange={(value) =>
                  form.setValue("endTime", value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
            </div>
          </div>
          {form.formState.errors.endTime && (
            <p className="text-sm text-[var(--danger)]">
              {form.formState.errors.endTime.message}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="repeat">Repeat</Label>
            <div className="relative">
              <select
                id="repeat"
                className={selectClassName}
                value={watchedRepeat ?? "none"}
                onChange={(e) =>
                  form.setValue(
                    "repeat",
                    e.target.value as (typeof slotRepeatRules)[number],
                    { shouldDirty: true, shouldValidate: true },
                  )
                }
              >
                {repeatOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
                aria-hidden
              />
            </div>
            <p className="text-xs text-[var(--muted)]">
              {watchedRepeat && watchedRepeat !== "none"
                ? slot
                  ? `Updates this slot and creates ${repeatCount - 1} more through the end of ${monthLabel}. Same title at overlapping times is skipped.`
                  : `Creates ${repeatCount} time slot${repeatCount === 1 ? "" : "s"} through the end of ${monthLabel}.`
                : slot
                  ? "Only updates this one time slot."
                  : "Only creates this one time slot."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (participants)</Label>
            <Input
              id="capacity"
              type="number"
              min={0}
              max={100}
              {...form.register("capacity")}
            />
            <p className="text-xs text-[var(--muted)]">
              Default is 1. Use 0 to block this time (no one can claim). Set
              higher when multiple people can share the spot.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                checked={watchedCommentsEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  form.setValue("commentsEnabled", enabled, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  if (!enabled) {
                    form.setValue("commentsRequired", false, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }
                }}
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">
                  Allow comments when claiming
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  Participants can leave a short note when they claim this spot.
                </span>
              </span>
            </label>

            {watchedCommentsEnabled ? (
              <label className="flex cursor-pointer items-start gap-3 pl-7">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={form.watch("commentsRequired")}
                  onChange={(event) =>
                    form.setValue("commentsRequired", event.target.checked, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    Require a comment
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    When on, claimers must enter at least 3 characters.
                  </span>
                </span>
              </label>
            ) : null}
          </div>
          <input type="hidden" {...form.register("date")} />
          <DialogFooter>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || saving}
            >
              {form.formState.isSubmitting || saving ? "Saving…" : "Save time slot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <EditRecurringSpotsDialog
      open={scopeOpen}
      loading={saving}
      onOpenChange={(next) => {
        setScopeOpen(next);
        if (!next) setPendingValues(null);
      }}
      onConfirm={async (scope) => {
        if (!pendingValues) return;
        await saveEdit(pendingValues, scope);
      }}
    />
    </>
  );
}
