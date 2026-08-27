"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelReasonSchema } from "@/lib/validators";
import { sendClaimConfirmationEmail } from "@/lib/notifications";
import type { ActionResult, MyClaimedSpot, Reservation } from "@/types";

function mapClaimError(message: string): string {
  if (message.includes("SLOT_FULL")) return "Spot is full.";
  if (message.includes("ALREADY_CLAIMED")) return "You already claimed this spot.";
  if (message.includes("SLOT_NOT_FOUND")) return "Spot not found.";
  if (message.includes("NOT_A_MEMBER")) return "Join this workspace first.";
  if (message.includes("NOT_AUTHENTICATED")) return "Please sign in.";
  if (message.includes("COMMENT_REQUIRED")) {
    return "Please enter at least 3 characters.";
  }
  if (message.includes("COMMENT_TOO_LONG")) {
    return "Comment must be 500 characters or fewer.";
  }
  if (message.includes("CLAIMS_DISABLED")) {
    return "Claims are paused for this day.";
  }
  return message;
}

function mapCancelError(message: string): string {
  if (message.includes("REASON_TOO_SHORT")) {
    return "Please enter at least 10 characters.";
  }
  if (message.includes("FORBIDDEN")) {
    return "You can only cancel your own claim.";
  }
  if (message.includes("NOT_CLAIMED")) return "This claim is not active.";
  if (message.includes("RESERVATION_NOT_FOUND")) return "Claim not found.";
  return message;
}

export async function claimSlot(input: {
  slotId: string;
  claimComment?: string;
  timeZoneOffsetMinutes: number;
}): Promise<ActionResult<Reservation>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Please sign in." };
  }

  const { data, error } = await supabase.rpc("claim_slot", {
    p_slot_id: input.slotId,
    p_claim_comment: input.claimComment ?? null,
    p_time_zone_offset_minutes: input.timeZoneOffsetMinutes,
  });

  if (error) {
    return { ok: false, error: mapClaimError(error.message) };
  }

  const reservation = data as Reservation;

  // Confirmation email should never block a successful claim.
  after(async () => {
    try {
      const [{ data: account }, { data: slot }] = await Promise.all([
        supabase
          .from("accounts")
          .select("email, display_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("slots")
          .select(
            "title, starts_at, ends_at, workspace:workspaces(title, slug)",
          )
          .eq("id", input.slotId)
          .maybeSingle(),
      ]);

      if (!account?.email || !slot) return;

      const workspace = Array.isArray(slot.workspace)
        ? slot.workspace[0]
        : slot.workspace;
      if (!workspace?.slug || !workspace?.title) return;

      await sendClaimConfirmationEmail({
        to: account.email,
        displayName: account.display_name ?? "",
        workspaceTitle: workspace.title,
        workspaceSlug: workspace.slug,
        slotTitle: slot.title ?? "",
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        timeZoneOffsetMinutes: input.timeZoneOffsetMinutes,
      });
    } catch (e) {
      console.error("[email] Claim confirmation error:", e);
    }
  });

  return { ok: true, data: reservation };
}

export async function cancelReservation(input: {
  reservationId: string;
  reason: string;
}): Promise<ActionResult<Reservation>> {
  const parsed = cancelReasonSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid reason",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Please sign in." };
  }

  const { data, error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: input.reservationId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { ok: false, error: mapCancelError(error.message) };
  }

  return { ok: true, data: data as Reservation };
}

export async function getMyClaimedSlots(
  workspaceId: string,
): Promise<ActionResult<MyClaimedSpot[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Please sign in." };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("account_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { ok: false, error: "Join this workspace first." };
  }

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, claimed_at, slot:slots!inner(id, workspace_id, title, color_key, starts_at, ends_at, capacity)",
    )
    .eq("workspace_id", workspaceId)
    .eq("account_id", user.id)
    .eq("status", "claimed")
    .order("claimed_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  type Row = {
    id: string;
    claimed_at: string;
    slot: MyClaimedSpot["slot"] | MyClaimedSpot["slot"][] | null;
  };

  const spots: MyClaimedSpot[] = [];
  for (const row of (data ?? []) as Row[]) {
    const slot = Array.isArray(row.slot) ? row.slot[0] : row.slot;
    if (!slot) continue;
    spots.push({
      reservation_id: row.id,
      claimed_at: row.claimed_at,
      slot,
    });
  }

  spots.sort(
    (a, b) =>
      new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime(),
  );

  return { ok: true, data: spots };
}
