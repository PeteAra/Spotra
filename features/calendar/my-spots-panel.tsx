"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isPast, isToday } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlotCancelToast } from "@/features/reservations/slot-cancel-toast";
import {
  getMyClaimedSlots,
} from "@/features/reservations/actions";
import { formatTimeRange } from "@/lib/utils/dates";
import { resolveSlotColor } from "@/lib/utils/slot-color";
import { cn } from "@/lib/utils/cn";
import type { MyClaimedSpot } from "@/types";

export function MySpotsPanel({
  workspaceId,
  open,
  onClose,
  onSelectDay,
  onChanged,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onSelectDay: (day: Date) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: spots = [], isLoading, error, refetch } = useQuery({
    queryKey: ["my-claimed-slots", workspaceId],
    enabled: open && Boolean(workspaceId),
    queryFn: async () => {
      const result = await getMyClaimedSlots(workspaceId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: MyClaimedSpot[] = [];
    const earlier: MyClaimedSpot[] = [];
    for (const spot of spots) {
      if (new Date(spot.slot.ends_at).getTime() < now) {
        earlier.push(spot);
      } else {
        up.push(spot);
      }
    }
    earlier.reverse();
    return { upcoming: up, past: earlier };
  }, [spots]);

  if (!open) return null;

  async function handleChanged() {
    await refetch();
    await onChanged();
  }

  return (
    <aside className="flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-6 lg:max-h-[min(50vh,24rem)]">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">Your claims</p>
          <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            My Spots
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label="Close My Spots"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-0.5">
        {isLoading ? (
          <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-center text-sm text-[var(--muted)]">
            Loading your spots…
          </p>
        ) : error ? (
          <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-center text-sm text-[var(--danger)]">
            {error instanceof Error ? error.message : "Could not load spots."}
          </p>
        ) : spots.length === 0 ? (
          <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-4 text-center text-sm text-[var(--muted)]">
            You haven&apos;t claimed any spots yet.
          </p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <ClaimGroup
                label="Upcoming"
                spots={upcoming}
                onOpenDay={onSelectDay}
                onCancel={setCancelId}
              />
            )}
            {past.length > 0 && (
              <ClaimGroup
                label="Past"
                spots={past}
                onOpenDay={onSelectDay}
                onCancel={setCancelId}
                muted
              />
            )}
          </>
        )}
      </div>

      {cancelId && (
        <SlotCancelToast
          open={Boolean(cancelId)}
          onOpenChange={(next) => {
            if (!next) setCancelId(null);
          }}
          reservationId={cancelId}
          onCancelled={() => {
            setCancelId(null);
            void handleChanged();
          }}
        />
      )}
    </aside>
  );
}

function ClaimGroup({
  label,
  spots,
  onOpenDay,
  onCancel,
  muted = false,
}: {
  label: string;
  spots: MyClaimedSpot[];
  onOpenDay: (day: Date) => void;
  onCancel: (reservationId: string) => void;
  muted?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      {spots.map((spot) => {
        const start = new Date(spot.slot.starts_at);
        const palette = resolveSlotColor(spot.slot.title, spot.slot.color_key);
        const title = spot.slot.title?.trim();
        const dayLabel = isToday(start)
          ? "Today"
          : format(start, "EEE, MMM d");

        return (
          <div
            key={spot.reservation_id}
            className={cn(
              "rounded-xl border px-3 py-2.5",
              muted && "opacity-70",
            )}
            style={{
              backgroundColor: palette.bg,
              borderColor: palette.border,
            }}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpenDay(start)}
              >
                <p
                  className="text-xs font-medium"
                  style={{ color: palette.text }}
                >
                  {dayLabel}
                </p>
                {title ? (
                  <p
                    className="mt-0.5 text-sm font-semibold leading-tight"
                    style={{ color: palette.text }}
                  >
                    {title}
                  </p>
                ) : null}
                <p
                  className={cn(
                    "text-sm font-semibold leading-tight",
                    title ? "mt-0.5 text-xs font-medium" : "text-sm",
                  )}
                  style={{ color: palette.text }}
                >
                  {formatTimeRange(spot.slot.starts_at, spot.slot.ends_at)}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Open this day"
                  onClick={() => onOpenDay(start)}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </Button>
                {!isPast(new Date(spot.slot.ends_at)) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => onCancel(spot.reservation_id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
