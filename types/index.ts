export type WorkspaceRole = "admin" | "participant";
export type ReservationStatus = "claimed" | "cancelled";
export type SlotAvailability = "available" | "partial" | "full";

export type Account = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Workspace = {
  id: string;
  title: string;
  slug: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  account_id: string;
  role: WorkspaceRole;
  joined_at: string;
  account?: Account;
};

export type Slot = {
  id: string;
  workspace_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Reservation = {
  id: string;
  workspace_id: string;
  slot_id: string;
  account_id: string;
  status: ReservationStatus;
  claimed_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  account?: Account;
};

export type SlotWithReservations = Slot & {
  reservations: Reservation[];
  claimed_count: number;
  availability: SlotAvailability;
};

export type WorkspaceGate = {
  id: string;
  title: string;
  slug: string;
};

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
