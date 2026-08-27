"use server";

import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  calendarDateAtNoonUtc,
  dayBoundsUtc,
  expandRepeatDates,
  mapDateToMonthByWeekdayOccurrence,
  monthBoundsUtc,
  monthKey,
  parseMonthKey,
  previousMonth,
  sameWeekdayDatesInMonth,
  utcToWallParts,
  wallDateTimeToUtc,
} from "@/lib/utils/dates";
import { slotFormSchema } from "@/lib/validators";
import type {
  ActionResult,
  Reservation,
  Slot,
  SlotEditScope,
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
    comments_enabled: slot.comments_enabled ?? false,
    comments_required: slot.comments_required ?? false,
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

type SlotInterval = { starts_at: string; ends_at: string; title?: string | null };

function normalizeSlotTitle(title: string | null | undefined): string {
  return (title ?? "").trim().toLowerCase();
}

function intervalsOverlap(a: SlotInterval, b: SlotInterval): boolean {
  return (
    new Date(a.starts_at).getTime() < new Date(b.ends_at).getTime() &&
    new Date(b.starts_at).getTime() < new Date(a.ends_at).getTime()
  );
}

/** Same title + overlapping time = duplicate; different titles may share a time. */
function isDuplicateTitleSlot(a: SlotInterval, b: SlotInterval): boolean {
  return (
    normalizeSlotTitle(a.title) === normalizeSlotTitle(b.title) &&
    intervalsOverlap(a, b)
  );
}

/** Keep candidates that are not same-title overlaps of existing or earlier kept rows. */
function filterNonDuplicateTitleSlots<T extends SlotInterval>(
  candidates: T[],
  existing: SlotInterval[],
): { kept: T[]; skipped: number } {
  const occupied: SlotInterval[] = [...existing];
  const kept: T[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    if (occupied.some((slot) => isDuplicateTitleSlot(slot, candidate))) {
      skipped += 1;
      continue;
    }
    kept.push(candidate);
    occupied.push(candidate);
  }

  return { kept, skipped };
}

async function getSlotsInTimeRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  excludeSlotId?: string,
): Promise<SlotInterval[]> {
  let query = supabase
    .from("slots")
    .select("id, title, starts_at, ends_at")
    .eq("workspace_id", workspaceId)
    .lt("starts_at", rangeEndIso)
    .gt("ends_at", rangeStartIso);

  if (excludeSlotId) {
    query = query.neq("id", excludeSlotId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    title: row.title,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
  }));
}

export async function countMatchingSeriesSlots(input: {
  workspaceId: string;
  slotId: string;
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<number>> {
  noStore();
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { data: current, error } = await admin.supabase
    .from("slots")
    .select("id, title, starts_at, ends_at")
    .eq("id", input.slotId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!current) return { ok: false, error: "Spot not found." };

  try {
    const targets = await findMatchingSeriesSlots(
      admin.supabase,
      input.workspaceId,
      current as Slot,
      "all",
      input.timeZoneOffsetMinutes,
    );
    return { ok: true, data: targets.length };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not check related spots.",
    };
  }
}

/** Spots that share the same title and wall-clock start/end times. */
async function findMatchingSeriesSlots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  current: Pick<Slot, "id" | "title" | "starts_at" | "ends_at">,
  scope: SlotEditScope,
  timeZoneOffsetMinutes: number,
): Promise<Slot[]> {
  if (scope === "this") {
    const { data, error } = await supabase
      .from("slots")
      .select("*")
      .eq("id", current.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? ([data] as Slot[]) : [];
  }

  const titleKey = normalizeSlotTitle(current.title);
  const currentStart = utcToWallParts(current.starts_at, timeZoneOffsetMinutes);
  const currentEnd = utcToWallParts(current.ends_at, timeZoneOffsetMinutes);

  const { data: siblings, error } = await supabase
    .from("slots")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  let matches = ((siblings ?? []) as Slot[]).filter((slot) => {
    if (normalizeSlotTitle(slot.title) !== titleKey) return false;
    const start = utcToWallParts(slot.starts_at, timeZoneOffsetMinutes);
    const end = utcToWallParts(slot.ends_at, timeZoneOffsetMinutes);
    return start.time === currentStart.time && end.time === currentEnd.time;
  });

  if (scope === "following") {
    matches = matches.filter((slot) => slot.starts_at >= current.starts_at);
  }

  return matches;
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
  repeat?: "none" | "daily" | "weekly" | "weekdays" | "weekends";
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<{ created: number; skipped: number; slot: Slot }>> {
  const parsed = slotFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid spot" };
  }

  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const dates = expandRepeatDates(
    parsed.data.date,
    parsed.data.repeat ?? "none",
  );

  const candidates = dates.map((date) => {
    const startsAt = wallDateTimeToUtc(
      date,
      parsed.data.startTime,
      input.timeZoneOffsetMinutes,
    );
    const endsAt = wallDateTimeToUtc(
      date,
      parsed.data.endTime,
      input.timeZoneOffsetMinutes,
    );
    return {
      workspace_id: input.workspaceId,
      title: parsed.data.title,
      color_key: parsed.data.colorKey ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      capacity: parsed.data.capacity,
      comments_enabled: parsed.data.commentsEnabled,
      comments_required:
        parsed.data.commentsEnabled && parsed.data.commentsRequired,
      created_by: admin.user!.id,
    };
  });

  const rangeStart = candidates.reduce(
    (min, row) => (row.starts_at < min ? row.starts_at : min),
    candidates[0]!.starts_at,
  );
  const rangeEnd = candidates.reduce(
    (max, row) => (row.ends_at > max ? row.ends_at : max),
    candidates[0]!.ends_at,
  );

  let existing: SlotInterval[];
  try {
    existing = await getSlotsInTimeRange(
      admin.supabase,
      input.workspaceId,
      rangeStart,
      rangeEnd,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not check existing spots.",
    };
  }

  const { kept: rows, skipped } = filterNonDuplicateTitleSlots(candidates, existing);

  if (rows.length === 0) {
    return {
      ok: false,
      error:
        skipped > 1
          ? "All of those already exist with the same title and overlapping times."
          : "A time slot with this title already exists at that time.",
    };
  }

  const { data, error } = await admin.supabase
    .from("slots")
    .insert(rows)
    .select("*");

  if (error) return { ok: false, error: slotWriteErrorMessage(error.message) };

  const createdSlots = (data ?? []) as Slot[];
  const first = createdSlots[0];
  if (!first) {
    return { ok: false, error: "Could not create time slot." };
  }

  const title = parsed.data.title;
  const colorKey = parsed.data.colorKey ?? null;

  try {
    if (colorKey !== null) {
      await syncColorForTitle(admin.supabase, input.workspaceId, title, colorKey);
    } else if (title.trim()) {
      const { data: siblings } = await admin.supabase
        .from("slots")
        .select("id, title, color_key")
        .eq("workspace_id", input.workspaceId);

      const normalized = title.trim().toLowerCase();
      const createdIds = new Set(createdSlots.map((s) => s.id));
      const locked = (siblings ?? []).find(
        (s) =>
          !createdIds.has(s.id) &&
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
          .in("id", [...createdIds]);
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
    .eq("id", first.id)
    .single();

  return {
    ok: true,
    data: {
      created: createdSlots.length,
      skipped,
      slot: (fresh ?? first) as Slot,
    },
  };
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
  repeat?: "none" | "daily" | "weekly" | "weekdays" | "weekends";
  editScope?: SlotEditScope;
  timeZoneOffsetMinutes: number;
}): Promise<
  ActionResult<{
    slot: Slot;
    createdAdditional: number;
    skipped: number;
    updatedCount: number;
  }>
> {
  const parsed = slotFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid spot" };
  }

  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { data: currentSlot, error: currentError } = await admin.supabase
    .from("slots")
    .select("*")
    .eq("id", input.slotId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (currentError) return { ok: false, error: currentError.message };
  if (!currentSlot) return { ok: false, error: "Spot not found." };

  const editScope: SlotEditScope = input.editScope ?? "this";

  let targets: Slot[];
  try {
    targets = await findMatchingSeriesSlots(
      admin.supabase,
      input.workspaceId,
      currentSlot as Slot,
      editScope,
      input.timeZoneOffsetMinutes,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not find related spots.",
    };
  }

  if (targets.length === 0) {
    return { ok: false, error: "Spot not found." };
  }

  const targetIds = new Set(targets.map((slot) => slot.id));

  const { data: claimRows, error: claimError } = await admin.supabase
    .from("reservations")
    .select("slot_id")
    .in("slot_id", [...targetIds])
    .eq("status", "claimed");

  if (claimError) return { ok: false, error: claimError.message };

  const claimCounts = new Map<string, number>();
  for (const row of claimRows ?? []) {
    claimCounts.set(row.slot_id, (claimCounts.get(row.slot_id) ?? 0) + 1);
  }

  for (const target of targets) {
    const claims = claimCounts.get(target.id) ?? 0;
    if (claims > parsed.data.capacity) {
      return {
        ok: false,
        error: `Cannot lower capacity below ${claims} active claims on one of the selected spots.`,
      };
    }
  }

  type PlannedUpdate = {
    id: string;
    starts_at: string;
    ends_at: string;
  };

  // Targets already share title + original clock times. Apply the new
  // wall-clock times to each occurrence's own date.
  const planned: PlannedUpdate[] = targets.map((target) => {
    if (target.id === input.slotId) {
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
      return {
        id: target.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      };
    }

    const wall = utcToWallParts(target.starts_at, input.timeZoneOffsetMinutes);
    const startsAt = wallDateTimeToUtc(
      wall.date,
      parsed.data.startTime,
      input.timeZoneOffsetMinutes,
    );
    const endsAt = wallDateTimeToUtc(
      wall.date,
      parsed.data.endTime,
      input.timeZoneOffsetMinutes,
    );
    return {
      id: target.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    };
  });

  const plannedById = new Map(planned.map((row) => [row.id, row]));

  const rangeStart = planned.reduce(
    (min, row) => (row.starts_at < min ? row.starts_at : min),
    planned[0]!.starts_at,
  );
  const rangeEnd = planned.reduce(
    (max, row) => (row.ends_at > max ? row.ends_at : max),
    planned[0]!.ends_at,
  );

  let existingWithIds: Array<SlotInterval & { id: string }>;
  try {
    const { data, error } = await admin.supabase
      .from("slots")
      .select("id, title, starts_at, ends_at")
      .eq("workspace_id", input.workspaceId)
      .lt("starts_at", rangeEnd)
      .gt("ends_at", rangeStart);

    if (error) throw new Error(error.message);
    existingWithIds = (data ?? []) as Array<SlotInterval & { id: string }>;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not check existing spots.",
    };
  }

  for (const plan of planned) {
    const colliding = existingWithIds.some((slot) => {
      if (targetIds.has(slot.id)) return false;
      return isDuplicateTitleSlot(slot, {
        title: parsed.data.title,
        starts_at: plan.starts_at,
        ends_at: plan.ends_at,
      });
    });
    if (colliding) {
      return {
        ok: false,
        error: "A time slot with this title already exists at that time.",
      };
    }

    for (const other of planned) {
      if (other.id === plan.id) continue;
      if (
        isDuplicateTitleSlot(
          {
            title: parsed.data.title,
            starts_at: other.starts_at,
            ends_at: other.ends_at,
          },
          {
            title: parsed.data.title,
            starts_at: plan.starts_at,
            ends_at: plan.ends_at,
          },
        )
      ) {
        return {
          ok: false,
          error:
            "Those times would overlap another selected spot with the same title.",
        };
      }
    }
  }

  const sharedFields = {
    title: parsed.data.title,
    color_key: parsed.data.colorKey ?? null,
    capacity: parsed.data.capacity,
    comments_enabled: parsed.data.commentsEnabled,
    comments_required:
      parsed.data.commentsEnabled && parsed.data.commentsRequired,
    updated_at: new Date().toISOString(),
  };

  for (const target of targets) {
    const plan = plannedById.get(target.id)!;
    const { error } = await admin.supabase
      .from("slots")
      .update({
        ...sharedFields,
        starts_at: plan.starts_at,
        ends_at: plan.ends_at,
      })
      .eq("id", target.id);

    if (error) return { ok: false, error: slotWriteErrorMessage(error.message) };
  }

  // Keep title-wide color sync when editing a single spot (existing behavior).
  // Multi-spot scopes already wrote color_key on each selected spot.
  if (editScope === "this") {
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
  }

  let createdAdditional = 0;
  let skipped = 0;
  const repeat = parsed.data.repeat ?? "none";

  if (repeat !== "none") {
    const extraDates = expandRepeatDates(parsed.data.date, repeat).filter(
      (date) => date !== parsed.data.date,
    );

    if (extraDates.length > 0) {
      const candidates = extraDates.map((date) => {
        const extraStart = wallDateTimeToUtc(
          date,
          parsed.data.startTime,
          input.timeZoneOffsetMinutes,
        );
        const extraEnd = wallDateTimeToUtc(
          date,
          parsed.data.endTime,
          input.timeZoneOffsetMinutes,
        );
        return {
          workspace_id: input.workspaceId,
          title: parsed.data.title,
          color_key: parsed.data.colorKey ?? null,
          starts_at: extraStart.toISOString(),
          ends_at: extraEnd.toISOString(),
          capacity: parsed.data.capacity,
          comments_enabled: parsed.data.commentsEnabled,
          comments_required:
            parsed.data.commentsEnabled && parsed.data.commentsRequired,
          created_by: admin.user!.id,
        };
      });

      const extraRangeStart = candidates.reduce(
        (min, row) => (row.starts_at < min ? row.starts_at : min),
        candidates[0]!.starts_at,
      );
      const extraRangeEnd = candidates.reduce(
        (max, row) => (row.ends_at > max ? row.ends_at : max),
        candidates[0]!.ends_at,
      );

      try {
        const existingExtras = await getSlotsInTimeRange(
          admin.supabase,
          input.workspaceId,
          extraRangeStart,
          extraRangeEnd,
        );
        const { kept: rows, skipped: skippedExtras } = filterNonDuplicateTitleSlots(
          candidates,
          existingExtras,
        );
        skipped = skippedExtras;

        if (rows.length > 0) {
          const { data: inserted, error: insertError } = await admin.supabase
            .from("slots")
            .insert(rows)
            .select("id");

          if (insertError) {
            return { ok: false, error: slotWriteErrorMessage(insertError.message) };
          }
          createdAdditional = inserted?.length ?? 0;
        }
      } catch (e) {
        return {
          ok: false,
          error:
            e instanceof Error ? e.message : "Could not create repeated slots.",
        };
      }
    }
  }

  const { data: fresh } = await admin.supabase
    .from("slots")
    .select("*")
    .eq("id", input.slotId)
    .single();

  return {
    ok: true,
    data: {
      slot: (fresh ?? (currentSlot as Slot)) as Slot,
      createdAdditional,
      skipped,
      updatedCount: targets.length,
    },
  };
}

export async function deleteSlot(input: {
  slotId: string;
  workspaceId: string;
  deleteScope?: SlotEditScope;
  timeZoneOffsetMinutes?: number;
}): Promise<ActionResult<{ deleted: number; skipped: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const deleteScope: SlotEditScope = input.deleteScope ?? "this";
  const timeZoneOffsetMinutes =
    input.timeZoneOffsetMinutes ?? 0;

  const { data: currentSlot, error: currentError } = await admin.supabase
    .from("slots")
    .select("*")
    .eq("id", input.slotId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (currentError) return { ok: false, error: currentError.message };
  if (!currentSlot) return { ok: false, error: "Spot not found." };

  let targets: Slot[];
  try {
    targets = await findMatchingSeriesSlots(
      admin.supabase,
      input.workspaceId,
      currentSlot as Slot,
      deleteScope,
      timeZoneOffsetMinutes,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not find related spots.",
    };
  }

  if (targets.length === 0) {
    return { ok: false, error: "Spot not found." };
  }

  const targetIds = targets.map((slot) => slot.id);

  const { data: claimRows, error: claimError } = await admin.supabase
    .from("reservations")
    .select("slot_id")
    .in("slot_id", targetIds)
    .eq("status", "claimed");

  if (claimError) return { ok: false, error: claimError.message };

  const claimedIds = new Set((claimRows ?? []).map((row) => row.slot_id));

  if (deleteScope === "this" && claimedIds.has(input.slotId)) {
    return {
      ok: false,
      error:
        "This time slot still has active claims. Cancel or remove them first, then delete.",
    };
  }

  const deletable = targets.filter((slot) => !claimedIds.has(slot.id));
  const skipped = targets.length - deletable.length;

  for (const target of deletable) {
    // Cancelled claim rows keep a FK to the slot (ON DELETE RESTRICT), so clear
    // history for this slot before deleting the container.
    const { error: historyError } = await admin.supabase
      .from("reservations")
      .delete()
      .eq("slot_id", target.id);

    if (historyError) return { ok: false, error: historyError.message };

    const { error } = await admin.supabase
      .from("slots")
      .delete()
      .eq("id", target.id);

    if (error) return { ok: false, error: error.message };
  }

  if (deletable.length === 0) {
    return {
      ok: false,
      error:
        "None of those spots could be deleted because they still have active claims.",
    };
  }

  return {
    ok: true,
    data: { deleted: deletable.length, skipped },
  };
}

async function copySlotsToDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sourceSlots: Slot[],
  targetDateStrs: string[],
  timeZoneOffsetMinutes: number,
): Promise<{ created: number; skipped: number }> {
  if (sourceSlots.length === 0 || targetDateStrs.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const workspaceId = sourceSlots[0]!.workspace_id;
  const candidates = targetDateStrs.flatMap((targetDate) =>
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
        comments_enabled: slot.comments_enabled,
        comments_required: slot.comments_required,
        created_by: userId,
      };
    }),
  );

  const rangeStart = candidates.reduce(
    (min, row) => (row.starts_at < min ? row.starts_at : min),
    candidates[0]!.starts_at,
  );
  const rangeEnd = candidates.reduce(
    (max, row) => (row.ends_at > max ? row.ends_at : max),
    candidates[0]!.ends_at,
  );

  const existing = await getSlotsInTimeRange(
    supabase,
    workspaceId,
    rangeStart,
    rangeEnd,
  );
  const { kept: rows, skipped } = filterNonDuplicateTitleSlots(candidates, existing);

  if (rows.length === 0) {
    return { created: 0, skipped };
  }

  const { error, data } = await supabase.from("slots").insert(rows).select("id");
  if (error) throw new Error(error.message);
  return { created: data?.length ?? 0, skipped };
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
}): Promise<ActionResult<{ created: number; skipped: number }>> {
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
    const result = await copySlotsToDates(
      admin.supabase,
      admin.user!.id,
      slots,
      targets,
      input.timeZoneOffsetMinutes,
    );
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Duplicate failed" };
  }
}

export async function duplicatePreviousMonth(input: {
  workspaceId: string;
  targetMonthKey: string;
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<{ created: number; skipped: number }>> {
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

    // Anchor target month as noon-UTC on the 1st for weekday mapping math.
    const [ty, tm] = input.targetMonthKey.split("-").map(Number);
    const targetMonthNoon = new Date(Date.UTC(ty, tm - 1, 1, 12, 0, 0, 0));

    const candidates: Array<{
      workspace_id: string;
      title: string;
      color_key: string | null;
      starts_at: string;
      ends_at: string;
      capacity: number;
      comments_enabled: boolean;
      comments_required: boolean;
      created_by: string;
    }> = [];
    let unmapped = 0;

    for (const slot of sourceSlots as Slot[]) {
      const sourceWall = utcToWallParts(slot.starts_at, input.timeZoneOffsetMinutes);
      const endWall = utcToWallParts(slot.ends_at, input.timeZoneOffsetMinutes);
      const sourceDate = calendarDateAtNoonUtc(sourceWall.date);
      const mapped = mapDateToMonthByWeekdayOccurrence(sourceDate, targetMonthNoon);
      if (!mapped) {
        unmapped += 1;
        continue;
      }

      const mappedDate = ymd(mapped);
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

      candidates.push({
        workspace_id: input.workspaceId,
        title: slot.title ?? "",
        color_key: slot.color_key ?? null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        capacity: slot.capacity,
        comments_enabled: slot.comments_enabled,
        comments_required: slot.comments_required,
        created_by: admin.user!.id,
      });
    }

    if (candidates.length === 0) {
      return { ok: true, data: { created: 0, skipped: unmapped } };
    }

    const rangeStart = candidates.reduce(
      (min, row) => (row.starts_at < min ? row.starts_at : min),
      candidates[0]!.starts_at,
    );
    const rangeEnd = candidates.reduce(
      (max, row) => (row.ends_at > max ? row.ends_at : max),
      candidates[0]!.ends_at,
    );

    const existing = await getSlotsInTimeRange(
      admin.supabase,
      input.workspaceId,
      rangeStart,
      rangeEnd,
    );
    const { kept: rows, skipped: skippedOverlaps } = filterNonDuplicateTitleSlots(
      candidates,
      existing,
    );
    const skipped = unmapped + skippedOverlaps;

    if (rows.length === 0) {
      return { ok: true, data: { created: 0, skipped } };
    }

    const { data, error: insertError } = await admin.supabase
      .from("slots")
      .insert(rows)
      .select("id");

    if (insertError) return { ok: false, error: insertError.message };
    return { ok: true, data: { created: data?.length ?? 0, skipped } };
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

export async function deleteSlotsInDay(input: {
  workspaceId: string;
  date: string;
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<{ deleted: number; skipped: number }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { start, end } = dayBoundsUtc(input.date, input.timeZoneOffsetMinutes);

  const { data: slots, error } = await admin.supabase
    .from("slots")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .gte("starts_at", start)
    .lte("starts_at", end);

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
