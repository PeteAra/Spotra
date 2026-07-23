"use server";

import { createClient } from "@/lib/supabase/server";
import type { Account, ActionResult, Reservation, WorkspaceMember } from "@/types";

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

export async function getMemberHistory(input: {
  workspaceId: string;
  accountId: string;
}): Promise<ActionResult<Reservation[]>> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  const { data, error } = await admin.supabase
    .from("reservations")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("account_id", input.accountId)
    .order("claimed_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as Reservation[] };
}

export async function removeMember(input: {
  workspaceId: string;
  accountId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  if (admin.user!.id === input.accountId) {
    const { count } = await admin.supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return { ok: false, error: "You cannot remove the last admin." };
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
