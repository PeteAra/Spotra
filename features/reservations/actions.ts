"use server";

import { createClient } from "@/lib/supabase/server";
import { cancelReasonSchema } from "@/lib/validators";
import type { ActionResult, Reservation } from "@/types";

function mapClaimError(message: string): string {
  if (message.includes("SLOT_FULL")) return "Slot is full.";
  if (message.includes("ALREADY_CLAIMED")) return "You already claimed this slot.";
  if (message.includes("SLOT_NOT_FOUND")) return "Slot not found.";
  if (message.includes("NOT_A_MEMBER")) return "Join this workspace first.";
  if (message.includes("NOT_AUTHENTICATED")) return "Please sign in.";
  return message;
}

function mapCancelError(message: string): string {
  if (message.includes("REASON_TOO_SHORT")) {
    return "Please enter at least 10 characters.";
  }
  if (message.includes("FORBIDDEN")) {
    return "You can only cancel your own reservation.";
  }
  if (message.includes("NOT_CLAIMED")) return "This reservation is not active.";
  if (message.includes("RESERVATION_NOT_FOUND")) return "Reservation not found.";
  return message;
}

export async function claimSlot(slotId: string): Promise<ActionResult<Reservation>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Please sign in." };
  }

  const { data, error } = await supabase.rpc("claim_slot", {
    p_slot_id: slotId,
  });

  if (error) {
    return { ok: false, error: mapClaimError(error.message) };
  }

  return { ok: true, data: data as Reservation };
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
