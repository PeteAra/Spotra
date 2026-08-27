"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult, CalendarClosure, CalendarClosureScope } from "@/types";

async function requireMember(workspaceId: string) {
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

  if (!membership) {
    return {
      ok: false as const,
      error: "Join this workspace first.",
      supabase,
      user,
    };
  }

  return { ok: true as const, supabase, user, role: membership.role };
}

async function requireAdmin(workspaceId: string) {
  const member = await requireMember(workspaceId);
  if (!member.ok) return member;
  if (member.role !== "admin") {
    return {
      ok: false as const,
      error: "Only workspace admins can change claim availability.",
      supabase: member.supabase,
      user: member.user,
    };
  }
  return { ok: true as const, supabase: member.supabase, user: member.user };
}

function isValidPeriodKey(scope: CalendarClosureScope, periodKey: string) {
  if (scope === "day") return /^\d{4}-\d{2}-\d{2}$/.test(periodKey);
  return /^\d{4}-\d{2}$/.test(periodKey);
}

export async function getClosuresForMonth(input: {
  workspaceId: string;
  monthKey: string;
}): Promise<ActionResult<CalendarClosure[]>> {
  if (!/^\d{4}-\d{2}$/.test(input.monthKey)) {
    return { ok: false, error: "Invalid month." };
  }

  const member = await requireMember(input.workspaceId);
  if (!member.ok) return { ok: false, error: member.error };

  const [{ data: monthRows, error: monthError }, { data: dayRows, error: dayError }] =
    await Promise.all([
      member.supabase
        .from("calendar_closures")
        .select("id, workspace_id, scope, period_key, created_by, created_at")
        .eq("workspace_id", input.workspaceId)
        .eq("scope", "month")
        .eq("period_key", input.monthKey),
      member.supabase
        .from("calendar_closures")
        .select("id, workspace_id, scope, period_key, created_by, created_at")
        .eq("workspace_id", input.workspaceId)
        .eq("scope", "day")
        .gte("period_key", `${input.monthKey}-01`)
        .lte("period_key", `${input.monthKey}-31`),
    ]);

  if (monthError) return { ok: false, error: monthError.message };
  if (dayError) return { ok: false, error: dayError.message };

  return {
    ok: true,
    data: [...(monthRows ?? []), ...(dayRows ?? [])] as CalendarClosure[],
  };
}

export async function setClaimsEnabled(input: {
  workspaceId: string;
  scope: CalendarClosureScope;
  periodKey: string;
  enabled: boolean;
}): Promise<ActionResult<{ enabled: boolean }>> {
  if (!isValidPeriodKey(input.scope, input.periodKey)) {
    return { ok: false, error: "Invalid date." };
  }

  const admin = await requireAdmin(input.workspaceId);
  if (!admin.ok) return { ok: false, error: admin.error };

  if (input.enabled) {
    const { error } = await admin.supabase
      .from("calendar_closures")
      .delete()
      .eq("workspace_id", input.workspaceId)
      .eq("scope", input.scope)
      .eq("period_key", input.periodKey);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data: { enabled: true } };
  }

  const { error } = await admin.supabase.from("calendar_closures").insert({
    workspace_id: input.workspaceId,
    scope: input.scope,
    period_key: input.periodKey,
    created_by: admin.user!.id,
  });

  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { enabled: false } };
}
