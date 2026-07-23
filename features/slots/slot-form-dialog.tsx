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
  onSaved: () => void;
}) {
  const form = useForm<SlotFormInput>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      date: format(day, "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "09:30",
      capacity: 1,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (slot) {
      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at);
      form.reset({
        date: format(start, "yyyy-MM-dd"),
        startTime: format(start, "HH:mm"),
        endTime: format(end, "HH:mm"),
        capacity: slot.capacity,
      });
    } else {
      form.reset({
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
          <DialogTitle>{slot ? "Edit slot" : "Create slot"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const result = slot
              ? await updateSlot({
                  slotId: slot.id,
                  workspaceId,
                  ...values,
                })
              : await createSlot({ workspaceId, ...values });

            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(slot ? "Slot updated" : "Slot created");
            onOpenChange(false);
            onSaved();
          })}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start</Label>
              <Input id="startTime" type="time" {...form.register("startTime")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End</Label>
              <Input id="endTime" type="time" {...form.register("endTime")} />
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
              min={1}
              max={100}
              {...form.register("capacity")}
            />
            <p className="text-xs text-[var(--muted)]">
              Default is 1. Set to 8 (or more) when multiple people can share this
              slot.
            </p>
          </div>
          <input type="hidden" {...form.register("date")} />
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save slot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
