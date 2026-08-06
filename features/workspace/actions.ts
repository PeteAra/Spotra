"use server";

import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { workspaceTitleSchema } from "@/lib/validators";
import { slugify, withSlugSuffix } from "@/lib/utils/slugify";
import type { ActionResult, Workspace, WorkspaceGate } from "@/types";

async function ensureAccount() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, accountId: null as string | null };

  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("accounts").upsert({
      id: user.id,
      email: user.email ?? "",
      display_name:
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split("@")[0] ||
        "User",
      avatar_url:
        (user.user_metadata?.avatar_url as string | undefined) ||
        (user.user_metadata?.picture as string | undefined) ||
        null,
    });
  }

  return { supabase, user, accountId: user.id };
}

export async function createWorkspace(input: {
  title: string;
}): Promise<ActionResult<Workspace>> {
  const parsed = workspaceTitleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid title" };
  }

  const { supabase, user, accountId } = await ensureAccount();
  if (!user || !accountId) {
    return { ok: false, error: "Please sign in to create a workspace." };
  }

  let slug = slugify(parsed.data.title);
  let workspace: Workspace | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? slug : withSlugSuffix(slug);
    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        title: parsed.data.title,
        slug: candidate,
        created_by: accountId,
      })
      .select("*")
      .single();

    if (!error && data) {
      workspace = data as Workspace;
      slug = candidate;
      break;
    }

    if (error?.code !== "23505") {
      return { ok: false, error: error?.message ?? "Failed to create workspace" };
    }
  }

  if (!workspace) {
    return { ok: false, error: "Could not generate a unique workspace URL." };
  }

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    account_id: accountId,
    role: "admin",
  });

  if (memberError) {
    return { ok: false, error: memberError.message };
  }

  return { ok: true, data: workspace };
}

export async function getWorkspaceGate(
  slug: string,
): Promise<ActionResult<WorkspaceGate>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, title, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Workspace not found." };
  }

  return { ok: true, data: data as WorkspaceGate };
}

export async function joinWorkspace(
  slug: string,
): Promise<ActionResult<{ role: string }>> {
  const { supabase, user } = await ensureAccount();
  if (!user) {
    return { ok: false, error: "Please sign in." };
  }

  const { data, error } = await supabase.rpc("join_workspace", {
    p_slug: slug,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  return { ok: true, data: { role: (data as { role: string }).role } };
}

export async function getWorkspaceBySlug(slug: string): Promise<
  ActionResult<{
    workspace: Workspace;
    role: "admin" | "participant";
    accountId: string;
  }>
> {
  const { supabase, user, accountId } = await ensureAccount();
  if (!user || !accountId) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  const joinResult = await joinWorkspace(slug);
  if (!joinResult.ok) {
    return { ok: false, error: joinResult.error };
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !workspace) {
    return { ok: false, error: "Workspace not found." };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("account_id", accountId)
    .single();

  if (!membership) {
    return { ok: false, error: "Not a member of this workspace." };
  }

  return {
    ok: true,
    data: {
      workspace: workspace as Workspace,
      role: membership.role as "admin" | "participant",
      accountId,
    },
  };
}

export async function listMyWorkspaces(): Promise<
  ActionResult<
    Array<{
      workspace: Workspace;
      role: "admin" | "participant";
      joined_at: string;
    }>
  >
> {
  noStore();
  const { supabase, user, accountId } = await ensureAccount();
  if (!user || !accountId) {
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, joined_at, workspace:workspaces(*)")
    .eq("account_id", accountId)
    .order("joined_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  const items = (data ?? [])
    .map((row) => {
      const workspace = row.workspace as Workspace | Workspace[] | null;
      const ws = Array.isArray(workspace) ? workspace[0] : workspace;
      if (!ws) return null;
      return {
        workspace: ws,
        role: row.role as "admin" | "participant",
        joined_at: row.joined_at as string,
      };
    })
    .filter(Boolean) as Array<{
    workspace: Workspace;
    role: "admin" | "participant";
    joined_at: string;
  }>;

  return { ok: true, data: items };
}

export async function deleteWorkspace(
  workspaceId: string,
): Promise<ActionResult> {
  const { supabase, user, accountId } = await ensureAccount();
  if (!user || !accountId) {
    return { ok: false, error: "Please sign in." };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return { ok: false, error: "Only admins can delete a workspace." };
  }

  // Delete in order to satisfy slot ← reservation RESTRICT
  const { error: resError } = await supabase
    .from("reservations")
    .delete()
    .eq("workspace_id", workspaceId);
  if (resError) return { ok: false, error: resError.message };

  const { error: slotsError } = await supabase
    .from("slots")
    .delete()
    .eq("workspace_id", workspaceId);
  if (slotsError) return { ok: false, error: slotsError.message };

  const { error: membersError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId);
  if (membersError) return { ok: false, error: membersError.message };

  const { error: wsError } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);
  if (wsError) return { ok: false, error: wsError.message };

  return { ok: true, data: undefined };
}

export async function leaveWorkspace(
  workspaceId: string,
): Promise<ActionResult> {
  const { supabase, user, accountId } = await ensureAccount();
  if (!user || !accountId) {
    return { ok: false, error: "Please sign in." };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (!membership) {
    return { ok: false, error: "You are not a member of this workspace." };
  }

  if (membership.role === "admin") {
    const { count } = await supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        error: "You're the only admin. Delete the workspace instead, or add another admin first.",
      };
    }
  }

  // Cancel active claims so seats open back up for others.
  const { data: activeClaims } = await supabase
    .from("reservations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .eq("status", "claimed");

  for (const claim of activeClaims ?? []) {
    const { error: cancelError } = await supabase.rpc("cancel_reservation", {
      p_reservation_id: claim.id,
      p_reason: "Left the workspace.",
    });
    if (cancelError) {
      return { ok: false, error: cancelError.message };
    }
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

function mapRpcError(message: string): string {
  if (message.includes("WORKSPACE_NOT_FOUND")) return "Workspace not found.";
  if (message.includes("NOT_AUTHENTICATED")) return "Please sign in.";
  return message;
}
