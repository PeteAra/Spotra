import { z } from "zod";
import { SLOT_COLOR_OPTIONS } from "@/lib/utils/slot-color";

const slotColorKeys = SLOT_COLOR_OPTIONS.map((c) => c.key) as [
  (typeof SLOT_COLOR_OPTIONS)[number]["key"],
  ...(typeof SLOT_COLOR_OPTIONS)[number]["key"][],
];

export const workspaceTitleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
});

export const slotFormSchema = z
  .object({
    title: z.string().trim().max(80, "Title must be 80 characters or fewer"),
    date: z.string().min(1),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid start time")
      .transform((t) => t.slice(0, 5)),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid end time")
      .transform((t) => t.slice(0, 5)),
    capacity: z.coerce.number().int().min(0).max(100),
    colorKey: z.enum(slotColorKeys).nullable().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const cancelReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Please enter at least 10 characters")
    .max(500),
});

export type WorkspaceTitleInput = z.infer<typeof workspaceTitleSchema>;
export type SlotFormInput = z.infer<typeof slotFormSchema>;
export type CancelReasonInput = z.infer<typeof cancelReasonSchema>;
