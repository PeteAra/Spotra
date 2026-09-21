"use server";

import { createClient } from "@/lib/supabase/server";
import { dayBoundsUtc } from "@/lib/utils/dates";
import type {
  Account,
  ActionResult,
  ActivityFilters,
  ActivityItem,
  ActivityKind,
  MemberEvent,
  WorkspaceRole,
} from "@/types";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 2000;

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
      error: "Only admins can view workspace activity.",
      supabase,
      user,
    };
  }

  return { ok: true as const, supabase, user };
}

type ReservationActivityRow = {
  id: string;
  status: "claimed" | "cancelled";
  claimed_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  claim_comment: string | null;
  slot_id: string | null;
  slot_title: string | null;
  slot_starts_at: string | null;
  slot_ends_at: string | null;
  account_id: string;
  account:
    | Pick<Account, "id" | "email" | "display_name" | "avatar_url">
    | Pick<Account, "id" | "email" | "display_name" | "avatar_url">[]
    | null;
  slot:
    | {
        id: string;
        title: string;
        starts_at: string;
        ends_at: string;
      }
    | {
        id: string;
        title: string;
        starts_at: string;
        ends_at: string;
      }[]
    | null;
};

function resolveSlotFields(row: ReservationActivityRow) {
  const live = Array.isArray(row.slot) ? row.slot[0] : row.slot;
  return {
    slot_id: row.slot_id ?? live?.id ?? null,
    slot_title: (live?.title || row.slot_title || undefined) as
      | string
      | undefined,
    slot_starts_at: (live?.starts_at || row.slot_starts_at || undefined) as
      | string
      | undefined,
    slot_ends_at: (live?.ends_at || row.slot_ends_at || undefined) as
      | string
      | undefined,
  };
}

function accountFields(row: ReservationActivityRow) {
  const account = Array.isArray(row.account) ? row.account[0] : row.account;
  return {
    account_id: row.account_id,
    account_display_name: account?.display_name,
    account_email: account?.email,
    account_avatar_url: account?.avatar_url ?? null,
  };
}

function wantsKind(kinds: ActivityKind[] | undefined, kind: ActivityKind) {
  if (!kinds || kinds.length === 0) return true;
  return kinds.includes(kind);
}

function inOccurredRange(
  occurredAt: string,
  from?: string,
  to?: string,
): boolean {
  const t = new Date(occurredAt).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

export async function getWorkspaceActivity(
  input: ActivityFilters,
): Promise<ActionResult<{ items: ActivityItem[]; hasMore: boolean }>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const limit = Math.min(
    Math.max(input.limit ?? DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(input.offset ?? 0, 0);
  const kinds = input.kinds;

  const includeClaims = wantsKind(kinds, "claimed");
  const includeCancels = wantsKind(kinds, "cancelled");
  const includeMembership =
    wantsKind(kinds, "joined") ||
    wantsKind(kinds, "left") ||
    wantsKind(kinds, "removed");

  // Spot-scoped views skip membership events.
  const loadMembership = includeMembership && !input.slotId;

  let slotDayStart: string | undefined;
  let slotDayEnd: string | undefined;
  if (input.slotDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.slotDate)) {
      return { ok: false, error: "Invalid day." };
    }
    const bounds = dayBoundsUtc(
      input.slotDate,
      input.timeZoneOffsetMinutes ?? 0,
    );
    slotDayStart = bounds.start;
    slotDayEnd = bounds.end;
  }

  const items: ActivityItem[] = [];

  if (includeClaims || includeCancels) {
    const pageSize = 1000;
    const rows: ReservationActivityRow[] = [];

    for (let from = 0; ; from += pageSize) {
      let query = admin.supabase
        .from("reservations")
        .select(
          "id, status, claimed_at, cancelled_at, cancellation_reason, claim_comment, slot_id, slot_title, slot_starts_at, slot_ends_at, account_id, account:accounts!reservations_account_id_fkey(id, email, display_name, avatar_url), slot:slots(id, title, starts_at, ends_at)",
        )
        .eq("workspace_id", input.workspaceId)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (input.accountId) {
        query = query.eq("account_id", input.accountId);
      }
      if (input.slotId) {
        query = query.eq("slot_id", input.slotId);
      }
      if (slotDayStart && slotDayEnd) {
        query = query
          .gte("slot_starts_at", slotDayStart)
          .lte("slot_starts_at", slotDayEnd);
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: error.message };

      const batch = (data ?? []) as ReservationActivityRow[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
    }

    for (const row of rows) {
      const slot = resolveSlotFields(row);
      const person = accountFields(row);

      if (includeClaims) {
        // Day lens uses slot schedule; otherwise filter claim time.
        const claimInRange = slotDayStart
          ? true
          : inOccurredRange(row.claimed_at, input.from, input.to);
        if (claimInRange) {
          items.push({
            id: `claim-${row.id}`,
            kind: "claimed",
            occurred_at: row.claimed_at,
            ...person,
            ...slot,
            claim_comment: row.claim_comment,
          });
        }
      }

      if (includeCancels && row.status === "cancelled" && row.cancelled_at) {
        const cancelInRange = slotDayStart
          ? true
          : inOccurredRange(row.cancelled_at, input.from, input.to);
        if (cancelInRange) {
          items.push({
            id: `cancel-${row.id}`,
            kind: "cancelled",
            occurred_at: row.cancelled_at,
            ...person,
            ...slot,
            claim_comment: row.claim_comment,
            cancellation_reason: row.cancellation_reason,
          });
        }
      }
    }
  }

  if (loadMembership) {
    let eventsQuery = admin.supabase
      .from("member_events")
      .select(
        "id, event_type, role, occurred_at, account_id, account:accounts!member_events_account_id_fkey(id, email, display_name, avatar_url)",
      )
      .eq("workspace_id", input.workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(MAX_LIMIT);

    if (input.accountId) {
      eventsQuery = eventsQuery.eq("account_id", input.accountId);
    }

    const membershipFrom = input.from ?? slotDayStart;
    const membershipTo = input.to ?? slotDayEnd;
    if (membershipFrom) {
      eventsQuery = eventsQuery.gte("occurred_at", membershipFrom);
    }
    if (membershipTo) {
      eventsQuery = eventsQuery.lte("occurred_at", membershipTo);
    }

    const { data: events, error: eventsError } = await eventsQuery;
    if (eventsError) return { ok: false, error: eventsError.message };

    type EventRow = MemberEvent & {
      account:
        | Pick<Account, "id" | "email" | "display_name" | "avatar_url">
        | Pick<Account, "id" | "email" | "display_name" | "avatar_url">[]
        | null;
    };

    for (const event of (events ?? []) as EventRow[]) {
      if (!wantsKind(kinds, event.event_type)) continue;
      const account = Array.isArray(event.account)
        ? event.account[0]
        : event.account;
      items.push({
        id: `event-${event.id}`,
        kind: event.event_type,
        occurred_at: event.occurred_at,
        account_id: event.account_id,
        account_display_name: account?.display_name,
        account_email: account?.email,
        account_avatar_url: account?.avatar_url ?? null,
        role: event.role as WorkspaceRole,
      });
    }
  }

  items.sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  const page = items.slice(offset, offset + limit);
  return {
    ok: true,
    data: {
      items: page,
      hasMore: offset + limit < items.length,
    },
  };
}

/** Person history as ActivityItems (snapshots + live slot fallback). */
export async function getMemberHistoryAsActivity(input: {
  workspaceId: string;
  accountId: string;
}): Promise<ActionResult<ActivityItem[]>> {
  const result = await getWorkspaceActivity({
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    limit: MAX_LIMIT,
    offset: 0,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data.items };
}
