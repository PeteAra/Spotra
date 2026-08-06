"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
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
import { createSlot, updateSlot } from "@/features/slots/actions";
import {
  addOneHour,
  snapToTimeStep,
  TimeSelect,
} from "@/features/slots/time-select";
import { slotColorFromTitle } from "@/lib/utils/slot-color";
import { getClientTimeZoneOffsetMinutes } from "@/lib/utils/dates";
import { slotFormSchema, type SlotFormInput } from "@/lib/validators";
import type { SlotWithReservations } from "@/types";

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
  const form = useForm<SlotFormInput>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      title: "",
      date: format(day, "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "09:30",
      capacity: 1,
    },
  });

  const watchedTitle = form.watch("title");
  const previewColor = slotColorFromTitle(watchedTitle);

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
      });
    } else {
      form.reset({
        title: "",
        date: format(day, "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "09:30",
        capacity: 1,
      });
    }
  }, [open, slot, day, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{slot ? "Edit time slot" : "Create time slot"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const result = slot
              ? await updateSlot({
                  slotId: slot.id,
                  workspaceId,
                  timeZoneOffsetMinutes: getClientTimeZoneOffsetMinutes(),
                  ...values,
                })
              : await createSlot({
                  workspaceId,
                  timeZoneOffsetMinutes: getClientTimeZoneOffsetMinutes(),
                  ...values,
                });

            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(slot ? "Time slot updated" : "Time slot created");
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
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span
                className="inline-block h-3 w-3 rounded-full border"
                style={{
                  backgroundColor: previewColor.bg,
                  borderColor: previewColor.border,
                }}
                aria-hidden
              />
              Color is assigned from the title — same name always gets the same
              color.
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
          <input type="hidden" {...form.register("date")} />
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save time slot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
