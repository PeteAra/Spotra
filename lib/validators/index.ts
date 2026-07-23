import { z } from "zod";

export const workspaceTitleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
});

export const slotFormSchema = z
  .object({
    date: z.string().min(1),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid start time"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid end time"),
    capacity: z.coerce.number().int().min(1).max(100),
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
