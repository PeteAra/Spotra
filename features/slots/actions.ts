"use server";

import { unstable_noStore as noStore } from "next/cache";
import { endOfMonth, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  combineDateAndTime,
  mapDateToMonthByWeekdayOccurrence,
  monthKey,
  parseMonthKey,
  previousMonth,
  sameWeekdayDatesInMonth,
  weekdayDatesInMonth,
} from "@/lib/utils/dates";
import { slotFormSchema } from "@/lib/validators";
import type {
  ActionResult,
  Reservation,
  Slot,
  SlotWithReservations,
} from "@/types";

/** Build a local Date from yyyy-MM-dd + HH:mm without server TZ ambiguity. */
function dateFromParts(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

async function requireAdmin(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Please sign in.", supabase, user: null };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("account_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return {
      ok: false as const,
      error: "Only workspace admins can manage slots.",
      supabase,
      user,
    };
  }

  return { ok: true as const, supabase, user };
}

function toSlotWithReservations(
  slot: Slot,
  reservations: Reservation[],
): SlotWithReservations {
  const claimed = reservations.filter((r) => r.status === "claimed");
  const claimed_count = claimed.length;
  const availability =
    claimed_count >= slot.capacity
      ? "full"
      : claimed_count > 0
        ? "partial"
        : "available";

  return {
    ...slot,
    reservations: claimed,
    claimed_count,
    availability,
  };
}

export async function getSlotsForMonth(input: {
  workspaceId: string;
  monthKey: string;
}): Promise<ActionResult<SlotWithReservations[]>> {
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  const month = parseMonthKey(input.monthKey);
  const rangeStart = startOfMonth(month).toISOString();
  // Use exclusive upper bound at start of next month to avoid end-of-month edge cases
  const rangeEndExclusive = startOfMonth(
    new Date(month.getFullYear(), month.getMonth() + 1, 1),
  ).toISOString();

  const { data: slots, error } = await supabase
    .from("slots")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEndExclusive)
    .order("starts_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const slotIds = (slots ?? []).map((s) => s.id);
  if (slotIds.length === 0) {
    return { ok: true, data: [] };
  }

  const { data: reservations, error: resError } = await supabase
    .from("reservations")
    .select(
      "*, account:accounts!reservations_account_id_fkey(id, email, display_name, avatar_url, created_at, updated_at)",
    )
    .eq("workspace_id", input.workspaceId)
    .in("slot_id", slotIds)
    .eq("status", "claimed");

  if (resError) {
    // Still return slots if roster join fails — better than an empty calendar
    console.error("reservations fetch failed", resError.message);
    return {
      ok: true,
      data: (slots as Slot[]).map((slot) =>
        toSlotWithReservations(slot, []),
      ),
    };
  }

  const bySlot = new Map<string, Reservation[]>();
  for (const row of reservations ?? []) {
    const list = bySlot.get(row.slot_id) ?? [];
    list.push(row as Reservation);
    bySlot.set(row.slot_id, list);
  }

  return {
    ok: true,
    data: (slots as Slot[]).map((slot) =>
      toSlotWithReservations(slot, bySlot.get(slot.id) ?? []),
    ),
  };
}

export async function createSlot(input: {
  workspaceId: string;
  title?: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
}): Promise<ActionResult<Slot>> {
  const parsed = slotFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid slot" };
  }

  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const startsAt = dateFromParts(parsed.data.date, parsed.data.startTime);
  const endsAt = dateFromParts(parsed.data.date, parsed.data.endTime);

  const { data, error } = await admin.supabase
    .from("slots")
    .insert({
      workspace_id: input.workspaceId,
      title: parsed.data.title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      capacity: parsed.data.capacity,
      created_by: admin.user!.id,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as Slot };
}

export async function updateSlot(input: {
  slotId: string;
  workspaceId: string;
  title?: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
}): Promise<ActionResult<Slot>> {
  const parsed = slotFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid slot" };
  }

  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { count } = await admin.supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("slot_id", input.slotId)
    .eq("status", "claimed");

  if ((count ?? 0) > parsed.data.capacity) {
    return {
      ok: false,
      error: `Cannot lower capacity below ${count} active claims.`,
    };
  }

  const startsAt = dateFromParts(parsed.data.date, parsed.data.startTime);
  const endsAt = dateFromParts(parsed.data.date, parsed.data.endTime);

  const { data, error } = await admin.supabase
    .from("slots")
    .update({
      title: parsed.data.title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      capacity: parsed.data.capacity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.slotId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as Slot };
}

export async function deleteSlot(input: {
  slotId: string;
  workspaceId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { count } = await admin.supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("slot_id", input.slotId);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "This slot has reservation history and cannot be deleted. Cancel claims first.",
    };
  }

  const { error } = await admin.supabase
    .from("slots")
    .delete()
    .eq("id", input.slotId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

async function copySlotsToDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sourceSlots: Slot[],
  targetDates: Date[],
): Promise<number> {
  if (sourceSlots.length === 0 || targetDates.length === 0) return 0;

  const rows = targetDates.flatMap((targetDate) =>
    sourceSlots.map((slot) => {
      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at);
      const startsAt = combineDateAndTime(
        targetDate,
        `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      );
      const endsAt = combineDateAndTime(
        targetDate,
        `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      );

      return {
        workspace_id: slot.workspace_id,
        title: slot.title ?? "",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity: slot.capacity,
        created_by: userId,
      };
    }),
  );

  const { error, data } = await supabase.from("slots").insert(rows).select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function getSlotsForDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  day: Date,
): Promise<Slot[]> {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("slots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("starts_at", dayStart.toISOString())
    .lte("starts_at", dayEnd.toISOString())
    .order("starts_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as Slot[];
}

export async function duplicateSameWeekdayInMonth(input: {
  workspaceId: string;
  sourceDate: string;
}): Promise<ActionResult<{ created: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  try {
    const source = new Date(`${input.sourceDate}T12:00:00`);
    const slots = await getSlotsForDay(admin.supabase, input.workspaceId, source);
    if (slots.length === 0) {
      return { ok: false, error: "No slots on this day to duplicate." };
    }

    const targets = sameWeekdayDatesInMonth(source, source);
    const created = await copySlotsToDates(
      admin.supabase,
      admin.user!.id,
      slots,
      targets,
    );
    return { ok: true, data: { created } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Duplicate failed" };
  }
}

export async function duplicateWeekdaysInMonth(input: {
  workspaceId: string;
  sourceDate: string;
}): Promise<ActionResult<{ created: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  try {
    const source = new Date(`${input.sourceDate}T12:00:00`);
    const slots = await getSlotsForDay(admin.supabase, input.workspaceId, source);
    if (slots.length === 0) {
      return { ok: false, error: "No slots on this day to duplicate." };
    }

    const targets = weekdayDatesInMonth(source, source);
    const created = await copySlotsToDates(
      admin.supabase,
      admin.user!.id,
      slots,
      targets,
    );
    return { ok: true, data: { created } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Duplicate failed" };
  }
}

export async function duplicatePreviousMonth(input: {
  workspaceId: string;
  targetMonthKey: string;
}): Promise<ActionResult<{ created: number; skippedDays: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  try {
    const targetMonth = parseMonthKey(input.targetMonthKey);
    const sourceMonth = previousMonth(targetMonth);

    const sourceStart = startOfMonth(sourceMonth).toISOString();
    const sourceEnd = endOfMonth(sourceMonth).toISOString();

    const { data: sourceSlots, error } = await admin.supabase
      .from("slots")
      .select("*")
      .eq("workspace_id", input.workspaceId)
      .gte("starts_at", sourceStart)
      .lte("starts_at", sourceEnd);

    if (error) return { ok: false, error: error.message };
    if (!sourceSlots?.length) {
      return { ok: false, error: "Previous month has no slots to copy." };
    }

    const targetStart = startOfMonth(targetMonth).toISOString();
    const targetEnd = endOfMonth(targetMonth).toISOString();
    const { data: existing } = await admin.supabase
      .from("slots")
      .select("starts_at")
      .eq("workspace_id", input.workspaceId)
      .gte("starts_at", targetStart)
      .lte("starts_at", targetEnd);

    const occupiedDays = new Set(
      (existing ?? []).map((s) => monthKey(new Date(s.starts_at)) + "-" + new Date(s.starts_at).getDate()),
    );

    const rows: Array<{
      workspace_id: string;
      title: string;
      starts_at: string;
      ends_at: string;
      capacity: number;
      created_by: string;
    }> = [];
    let skippedDays = 0;

    for (const slot of sourceSlots as Slot[]) {
      const sourceDate = new Date(slot.starts_at);
      const mapped = mapDateToMonthByWeekdayOccurrence(sourceDate, targetMonth);
      if (!mapped) {
        skippedDays += 1;
        continue;
      }

      const dayKey = monthKey(mapped) + "-" + mapped.getDate();
      if (occupiedDays.has(dayKey)) {
        skippedDays += 1;
        continue;
      }

      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at);
      const startsAt = combineDateAndTime(
        mapped,
        `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      );
      const endsAt = combineDateAndTime(
        mapped,
        `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      );

      rows.push({
        workspace_id: input.workspaceId,
        title: slot.title ?? "",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity: slot.capacity,
        created_by: admin.user!.id,
      });
    }

    if (rows.length === 0) {
      return { ok: true, data: { created: 0, skippedDays } };
    }

    const { data, error: insertError } = await admin.supabase
      .from("slots")
      .insert(rows)
      .select("id");

    if (insertError) return { ok: false, error: insertError.message };
    return { ok: true, data: { created: data?.length ?? 0, skippedDays } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Duplicate previous month failed",
    };
  }
}

export async function deleteSlotsInMonth(input: {
  workspaceId: string;
  monthKey: string;
}): Promise<ActionResult<{ deleted: number; skipped: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const month = parseMonthKey(input.monthKey);
  const rangeStart = startOfMonth(month).toISOString();
  const rangeEnd = endOfMonth(month).toISOString();

  const { data: slots, error } = await admin.supabase
    .from("slots")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd);

  if (error) return { ok: false, error: error.message };

  let deleted = 0;
  let skipped = 0;

  for (const slot of slots ?? []) {
    const { count } = await admin.supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("slot_id", slot.id);

    if ((count ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    const { error: delError } = await admin.supabase
      .from("slots")
      .delete()
      .eq("id", slot.id);

    if (delError) {
      skipped += 1;
    } else {
      deleted += 1;
    }
  }

  return { ok: true, data: { deleted, skipped } };
}
