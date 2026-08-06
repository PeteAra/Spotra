"use server";

import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  calendarDateAtNoonUtc,
  dayBoundsUtc,
  mapDateToMonthByWeekdayOccurrence,
  monthBoundsUtc,
  monthKey,
  parseMonthKey,
  previousMonth,
  sameWeekdayDatesInMonth,
  utcToWallParts,
  wallDateTimeToUtc,
  weekdayDatesInMonth,
} from "@/lib/utils/dates";
import { slotFormSchema } from "@/lib/validators";
import type {
  ActionResult,
  Reservation,
  Slot,
  SlotWithReservations,
} from "@/types";

function ymd(date: Date): string {
  // Prefer UTC getters so noon-UTC calendar dates stay stable on any server TZ.
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
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
      error: "Only workspace admins can manage spots.",
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
    slot.capacity === 0
      ? "blocked"
      : claimed_count >= slot.capacity
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
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<SlotWithReservations[]>> {
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  const { start: rangeStart, endExclusive: rangeEndExclusive } = monthBoundsUtc(
    input.monthKey,
    input.timeZoneOffsetMinutes,
  );

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

function slotWriteErrorMessage(message: string): string {
  if (message.includes("slots_capacity_range")) {
    return "Blocked time (capacity 0) isn’t enabled on the database yet. Run the latest Supabase migration, then try again.";
  }
  if (message.includes("slots_time_order")) {
    return "End time must be after start time.";
  }
  if (message.includes("slots_title_length")) {
    return "Title must be 80 characters or fewer.";
  }
  return message;
}

/** Apply a color choice to every time slot in the workspace with the same title. */
async function syncColorForTitle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  title: string,
  colorKey: string | null,
) {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return;

  const { data: siblings, error: listError } = await supabase
    .from("slots")
    .select("id, title")
    .eq("workspace_id", workspaceId);

  if (listError) throw new Error(listError.message);

  const ids = (siblings ?? [])
    .filter((s) => (s.title ?? "").trim().toLowerCase() === normalized)
    .map((s) => s.id);

  if (ids.length === 0) return;

  const { error } = await supabase
    .from("slots")
    .update({
      color_key: colorKey,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (error) throw new Error(error.message);
}

export async function createSlot(input: {
  workspaceId: string;
  title?: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  colorKey?: string | null;
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<Slot>> {
  const parsed = slotFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid spot" };
  }

  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const startsAt = wallDateTimeToUtc(
    parsed.data.date,
    parsed.data.startTime,
    input.timeZoneOffsetMinutes,
  );
  const endsAt = wallDateTimeToUtc(
    parsed.data.date,
    parsed.data.endTime,
    input.timeZoneOffsetMinutes,
  );

  const { data, error } = await admin.supabase
    .from("slots")
    .insert({
      workspace_id: input.workspaceId,
      title: parsed.data.title,
      color_key: parsed.data.colorKey ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      capacity: parsed.data.capacity,
      created_by: admin.user!.id,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: slotWriteErrorMessage(error.message) };

  const title = parsed.data.title;
  const colorKey = parsed.data.colorKey ?? null;

  try {
    if (colorKey !== null) {
      // Lock this color onto every same-titled time slot.
      await syncColorForTitle(admin.supabase, input.workspaceId, title, colorKey);
    } else if (title.trim()) {
      // Auto: inherit a locked color from an existing same-title slot, if any.
      const { data: siblings } = await admin.supabase
        .from("slots")
        .select("id, title, color_key")
        .eq("workspace_id", input.workspaceId);

      const normalized = title.trim().toLowerCase();
      const locked = (siblings ?? []).find(
        (s) =>
          s.id !== data.id &&
          (s.title ?? "").trim().toLowerCase() === normalized &&
          s.color_key,
      );

      if (locked?.color_key) {
        await admin.supabase
          .from("slots")
          .update({
            color_key: locked.color_key,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not sync title colors.",
    };
  }

  const { data: fresh } = await admin.supabase
    .from("slots")
    .select("*")
    .eq("id", data.id)
    .single();

  return { ok: true, data: (fresh ?? data) as Slot };
}

export async function updateSlot(input: {
  slotId: string;
  workspaceId: string;
  title?: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  colorKey?: string | null;
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<Slot>> {
  const parsed = slotFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid spot" };
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

  const startsAt = wallDateTimeToUtc(
    parsed.data.date,
    parsed.data.startTime,
    input.timeZoneOffsetMinutes,
  );
  const endsAt = wallDateTimeToUtc(
    parsed.data.date,
    parsed.data.endTime,
    input.timeZoneOffsetMinutes,
  );

  const { data, error } = await admin.supabase
    .from("slots")
    .update({
      title: parsed.data.title,
      color_key: parsed.data.colorKey ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      capacity: parsed.data.capacity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.slotId)
    .select("*")
    .single();

  if (error) return { ok: false, error: slotWriteErrorMessage(error.message) };

  try {
    await syncColorForTitle(
      admin.supabase,
      input.workspaceId,
      parsed.data.title,
      parsed.data.colorKey ?? null,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not sync title colors.",
    };
  }

  const { data: fresh } = await admin.supabase
    .from("slots")
    .select("*")
    .eq("id", input.slotId)
    .single();

  return { ok: true, data: (fresh ?? data) as Slot };
}

export async function deleteSlot(input: {
  slotId: string;
  workspaceId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { count: activeClaims, error: countError } = await admin.supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("slot_id", input.slotId)
    .eq("status", "claimed");

  if (countError) return { ok: false, error: countError.message };

  if ((activeClaims ?? 0) > 0) {
    return {
      ok: false,
      error:
        "This time slot still has active claims. Cancel or remove them first, then delete.",
    };
  }

  // Cancelled claim rows keep a FK to the slot (ON DELETE RESTRICT), so clear
  // history for this slot before deleting the container.
  const { error: historyError } = await admin.supabase
    .from("reservations")
    .delete()
    .eq("slot_id", input.slotId);

  if (historyError) return { ok: false, error: historyError.message };

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
  targetDateStrs: string[],
  timeZoneOffsetMinutes: number,
): Promise<number> {
  if (sourceSlots.length === 0 || targetDateStrs.length === 0) return 0;

  const rows = targetDateStrs.flatMap((targetDate) =>
    sourceSlots.map((slot) => {
      const startWall = utcToWallParts(slot.starts_at, timeZoneOffsetMinutes);
      const endWall = utcToWallParts(slot.ends_at, timeZoneOffsetMinutes);
      const startsAt = wallDateTimeToUtc(
        targetDate,
        startWall.time,
        timeZoneOffsetMinutes,
      );
      const endsAt = wallDateTimeToUtc(
        targetDate,
        endWall.time,
        timeZoneOffsetMinutes,
      );

      return {
        workspace_id: slot.workspace_id,
        title: slot.title ?? "",
        color_key: slot.color_key ?? null,
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
  date: string,
  timeZoneOffsetMinutes: number,
): Promise<Slot[]> {
  const { start, end } = dayBoundsUtc(date, timeZoneOffsetMinutes);

  const { data, error } = await supabase
    .from("slots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("starts_at", start)
    .lte("starts_at", end)
    .order("starts_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as Slot[];
}

export async function duplicateSameWeekdayInMonth(input: {
  workspaceId: string;
  sourceDate: string;
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<{ created: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  try {
    const source = calendarDateAtNoonUtc(input.sourceDate);
    const slots = await getSlotsForDay(
      admin.supabase,
      input.workspaceId,
      input.sourceDate,
      input.timeZoneOffsetMinutes,
    );
    if (slots.length === 0) {
      return { ok: false, error: "No spots on this day to duplicate." };
    }

    const targets = sameWeekdayDatesInMonth(source, source).map(ymd);
    const created = await copySlotsToDates(
      admin.supabase,
      admin.user!.id,
      slots,
      targets,
      input.timeZoneOffsetMinutes,
    );
    return { ok: true, data: { created } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Duplicate failed" };
  }
}

export async function duplicateWeekdaysInMonth(input: {
  workspaceId: string;
  sourceDate: string;
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<{ created: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  try {
    const source = calendarDateAtNoonUtc(input.sourceDate);
    const slots = await getSlotsForDay(
      admin.supabase,
      input.workspaceId,
      input.sourceDate,
      input.timeZoneOffsetMinutes,
    );
    if (slots.length === 0) {
      return { ok: false, error: "No spots on this day to duplicate." };
    }

    const targets = weekdayDatesInMonth(source, source).map(ymd);
    const created = await copySlotsToDates(
      admin.supabase,
      admin.user!.id,
      slots,
      targets,
      input.timeZoneOffsetMinutes,
    );
    return { ok: true, data: { created } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Duplicate failed" };
  }
}

export async function duplicatePreviousMonth(input: {
  workspaceId: string;
  targetMonthKey: string;
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<{ created: number; skippedDays: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  try {
    const targetMonth = parseMonthKey(input.targetMonthKey);
    const sourceMonth = previousMonth(targetMonth);
    const sourceMonthKey = monthKey(sourceMonth);

    const sourceBounds = monthBoundsUtc(
      sourceMonthKey,
      input.timeZoneOffsetMinutes,
    );
    const targetBounds = monthBoundsUtc(
      input.targetMonthKey,
      input.timeZoneOffsetMinutes,
    );

    const { data: sourceSlots, error } = await admin.supabase
      .from("slots")
      .select("*")
      .eq("workspace_id", input.workspaceId)
      .gte("starts_at", sourceBounds.start)
      .lt("starts_at", sourceBounds.endExclusive);

    if (error) return { ok: false, error: error.message };
    if (!sourceSlots?.length) {
      return { ok: false, error: "Previous month has no spots to copy." };
    }

    const { data: existing } = await admin.supabase
      .from("slots")
      .select("starts_at")
      .eq("workspace_id", input.workspaceId)
      .gte("starts_at", targetBounds.start)
      .lt("starts_at", targetBounds.endExclusive);

    const occupiedDays = new Set(
      (existing ?? []).map((s) => {
        const wall = utcToWallParts(s.starts_at, input.timeZoneOffsetMinutes);
        return wall.date;
      }),
    );

    // Anchor target month as noon-UTC on the 1st for weekday mapping math.
    const [ty, tm] = input.targetMonthKey.split("-").map(Number);
    const targetMonthNoon = new Date(Date.UTC(ty, tm - 1, 1, 12, 0, 0, 0));

    const rows: Array<{
      workspace_id: string;
      title: string;
      color_key: string | null;
      starts_at: string;
      ends_at: string;
      capacity: number;
      created_by: string;
    }> = [];
    let skippedDays = 0;

    for (const slot of sourceSlots as Slot[]) {
      const sourceWall = utcToWallParts(slot.starts_at, input.timeZoneOffsetMinutes);
      const endWall = utcToWallParts(slot.ends_at, input.timeZoneOffsetMinutes);
      const sourceDate = calendarDateAtNoonUtc(sourceWall.date);
      const mapped = mapDateToMonthByWeekdayOccurrence(sourceDate, targetMonthNoon);
      if (!mapped) {
        skippedDays += 1;
        continue;
      }

      const mappedDate = ymd(mapped);
      if (occupiedDays.has(mappedDate)) {
        skippedDays += 1;
        continue;
      }

      const startsAt = wallDateTimeToUtc(
        mappedDate,
        sourceWall.time,
        input.timeZoneOffsetMinutes,
      );
      const endsAt = wallDateTimeToUtc(
        mappedDate,
        endWall.time,
        input.timeZoneOffsetMinutes,
      );

      rows.push({
        workspace_id: input.workspaceId,
        title: slot.title ?? "",
        color_key: slot.color_key ?? null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity: slot.capacity,
        created_by: admin.user!.id,
      });
      occupiedDays.add(mappedDate);
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
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<{ deleted: number; skipped: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { start: rangeStart, endExclusive } = monthBoundsUtc(
    input.monthKey,
    input.timeZoneOffsetMinutes,
  );

  const { data: slots, error } = await admin.supabase
    .from("slots")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .gte("starts_at", rangeStart)
    .lt("starts_at", endExclusive);

  if (error) return { ok: false, error: error.message };

  let deleted = 0;
  let skipped = 0;

  for (const slot of slots ?? []) {
    const { count: activeClaims, error: countError } = await admin.supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("slot_id", slot.id)
      .eq("status", "claimed");

    if (countError || (activeClaims ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    const { error: historyError } = await admin.supabase
      .from("reservations")
      .delete()
      .eq("slot_id", slot.id);

    if (historyError) {
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
