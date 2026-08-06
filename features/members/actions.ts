"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  ActionResult,
  MemberEvent,
  MemberHistoryItem,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types";

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
      error: "Only admins can manage members.",
      supabase,
      user,
    };
  }

  return { ok: true as const, supabase, user };
}

export async function listMembers(
  workspaceId: string,
): Promise<ActionResult<(WorkspaceMember & { account: Account })[]>> {
  const admin = await requireAdmin(workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { data, error } = await admin.supabase
    .from("workspace_members")
    .select(
      "*, account:accounts(id, email, display_name, avatar_url, created_at, updated_at)",
    )
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: (data ?? []) as (WorkspaceMember & { account: Account })[],
  };
}

export async function getMemberProfile(input: {
  workspaceId: string;
  accountId: string;
}): Promise<
  ActionResult<{
    account: Account;
    member: WorkspaceMember | null;
  }>
> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { data: account, error: accountError } = await admin.supabase
    .from("accounts")
    .select("id, email, display_name, avatar_url, created_at, updated_at")
    .eq("id", input.accountId)
    .maybeSingle();

  if (accountError) return { ok: false, error: accountError.message };
  if (!account) return { ok: false, error: "User not found." };

  const { data: member } = await admin.supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("account_id", input.accountId)
    .maybeSingle();

  return {
    ok: true,
    data: {
      account: account as Account,
      member: (member as WorkspaceMember | null) ?? null,
    },
  };
}

export async function getMemberHistory(input: {
  workspaceId: string;
  accountId: string;
}): Promise<ActionResult<MemberHistoryItem[]>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const [eventsResult, reservationsResult] = await Promise.all([
    admin.supabase
      .from("member_events")
      .select("*")
      .eq("workspace_id", input.workspaceId)
      .eq("account_id", input.accountId)
      .order("occurred_at", { ascending: false }),
    admin.supabase
      .from("reservations")
      .select(
        "id, status, claimed_at, cancelled_at, cancellation_reason, slot_id, slot:slots(id, title, starts_at, ends_at)",
      )
      .eq("workspace_id", input.workspaceId)
      .eq("account_id", input.accountId)
      .order("claimed_at", { ascending: false }),
  ]);

  if (eventsResult.error) {
    return { ok: false, error: eventsResult.error.message };
  }
  if (reservationsResult.error) {
    return { ok: false, error: reservationsResult.error.message };
  }

  const items: MemberHistoryItem[] = [];

  for (const event of (eventsResult.data ?? []) as MemberEvent[]) {
    items.push({
      id: `event-${event.id}`,
      kind: event.event_type,
      occurred_at: event.occurred_at,
      role: event.role,
    });
  }

  type ReservationRow = {
    id: string;
    status: "claimed" | "cancelled";
    claimed_at: string;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    slot_id: string;
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

  for (const row of (reservationsResult.data ?? []) as ReservationRow[]) {
    const slot = Array.isArray(row.slot) ? row.slot[0] : row.slot;

    items.push({
      id: `claim-${row.id}`,
      kind: "claimed",
      occurred_at: row.claimed_at,
      slot_id: row.slot_id,
      slot_title: slot?.title || undefined,
      slot_starts_at: slot?.starts_at,
      slot_ends_at: slot?.ends_at,
    });

    if (row.status === "cancelled" && row.cancelled_at) {
      items.push({
        id: `cancel-${row.id}`,
        kind: "cancelled",
        occurred_at: row.cancelled_at,
        slot_id: row.slot_id,
        slot_title: slot?.title || undefined,
        slot_starts_at: slot?.starts_at,
        slot_ends_at: slot?.ends_at,
        cancellation_reason: row.cancellation_reason,
      });
    }
  }

  items.sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  return { ok: true, data: items };
}

export async function setMemberRole(input: {
  workspaceId: string;
  accountId: string;
  role: WorkspaceRole;
}): Promise<ActionResult> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  if (input.role !== "admin" && input.role !== "participant") {
    return { ok: false, error: "Invalid role." };
  }

  const { data: target, error: targetError } = await admin.supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", input.workspaceId)
    .eq("account_id", input.accountId)
    .maybeSingle();

  if (targetError) return { ok: false, error: targetError.message };
  if (!target) return { ok: false, error: "Member not found." };

  if (target.role === input.role) {
    return { ok: true, data: undefined };
  }

  // Don't demote the last admin (including demoting yourself).
  if (target.role === "admin" && input.role === "participant") {
    const { count } = await admin.supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        error:
          "You can't demote the last admin. Promote someone else first, or delete the workspace.",
      };
    }
  }

  const { error } = await admin.supabase
    .from("workspace_members")
    .update({ role: input.role })
    .eq("workspace_id", input.workspaceId)
    .eq("account_id", input.accountId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function removeMember(input: {
  workspaceId: string;
  accountId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  if (admin.user!.id === input.accountId) {
    return {
      ok: false,
      error:
        "You can't remove yourself here. Leave from Workspaces, or delete the workspace.",
    };
  }

  // Free any active claims so the calendar isn't left with ghost seats.
  const { data: activeClaims } = await admin.supabase
    .from("reservations")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("account_id", input.accountId)
    .eq("status", "claimed");

  for (const claim of activeClaims ?? []) {
    const { error: cancelError } = await admin.supabase.rpc(
      "cancel_reservation",
      {
        p_reservation_id: claim.id,
        p_reason: "Removed from workspace by an admin.",
      },
    );
    if (cancelError) {
      return { ok: false, error: cancelError.message };
    }
  }

  const { error } = await admin.supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("account_id", input.accountId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
