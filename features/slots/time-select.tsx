"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTE_STEP = 5;
const MINUTES = Array.from(
  { length: 60 / MINUTE_STEP },
  (_, i) => i * MINUTE_STEP,
);
const LATEST_TIME_MINUTES = 23 * 60 + (60 - MINUTE_STEP);

function formatTimeLabel(hour24: number, minute: number) {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function parseTime(value: string): {
  hour12: number;
  minute: number;
  period: "AM" | "PM";
} {
  const snapped = snapToTimeStep(value || "09:00");
  const [h, m] = snapped.split(":").map(Number);
  return {
    hour12: h % 12 || 12,
    minute: m,
    period: h >= 12 ? "PM" : "AM",
  };
}

function toValue(hour12: number, minute: number, period: "AM" | "PM") {
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Snap HH:mm to the nearest 5-minute mark. */
export function snapToTimeStep(time: string): string {
  const [hRaw, mRaw] = time.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) return "09:00";
  const total = hRaw * 60 + mRaw;
  const snapped = Math.round(total / MINUTE_STEP) * MINUTE_STEP;
  const clamped = Math.min(Math.max(snapped, 0), LATEST_TIME_MINUTES);
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** @deprecated Use snapToTimeStep */
export const snapToQuarterHour = snapToTimeStep;

/** Return start + 1 hour, clamped to the same day (max 23:55). */
export function addOneHour(time: string): string {
  const snapped = snapToTimeStep(time);
  const [h, m] = snapped.split(":").map(Number);
  const startTotal = h * 60 + m;
  let endTotal = startTotal + 60;
  if (endTotal > LATEST_TIME_MINUTES) endTotal = LATEST_TIME_MINUTES;
  if (endTotal <= startTotal) {
    endTotal = Math.min(startTotal + MINUTE_STEP, LATEST_TIME_MINUTES);
  }
  const hour = Math.floor(endTotal / 60);
  const minute = endTotal % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function PickerColumn({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-h-48 overflow-y-auto overscroll-contain rounded-lg bg-[var(--surface-muted)]/60 p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PickerOption({
  selected,
  onClick,
  children,
  optionRef,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  optionRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={optionRef}
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-center rounded-md px-3 py-1.5 text-sm transition",
        selected
          ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]"
          : "text-[var(--foreground)] hover:bg-[var(--surface-elevated)]",
      )}
    >
      {children}
    </button>
  );
}

export function TimeSelect({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedHourRef = useRef<HTMLButtonElement>(null);
  const selectedMinuteRef = useRef<HTMLButtonElement>(null);
  const safeValue = snapToTimeStep(value || "09:00");
  const parts = useMemo(() => parseTime(safeValue), [safeValue]);
  const label = useMemo(() => {
    const [h, m] = safeValue.split(":").map(Number);
    return formatTimeLabel(h, m);
  }, [safeValue]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      selectedHourRef.current?.scrollIntoView({ block: "center" });
      selectedMinuteRef.current?.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, parts.hour12, parts.minute]);

  function commit(next: {
    hour12?: number;
    minute?: number;
    period?: "AM" | "PM";
  }) {
    onChange(
      toValue(
        next.hour12 ?? parts.hour12,
        next.minute ?? parts.minute,
        next.period ?? parts.period,
      ),
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Mobile: native time picker */}
      <input
        id={id}
        type="time"
        step={MINUTE_STEP * 60}
        value={safeValue}
        onChange={(e) => onChange(snapToTimeStep(e.target.value || "09:00"))}
        className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:hidden"
      />

      {/* Desktop: in-app hour / minute / AM-PM picker (stays in viewport) */}
      <div className="hidden sm:block">
        <Popover modal open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              id={id ? `${id}-desktop` : undefined}
              type="button"
              aria-label={
                id === "startTime"
                  ? "Start time"
                  : id === "endTime"
                    ? "End time"
                    : "Time"
              }
              className="flex h-10 w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_color-mix(in_srgb,white_55%,transparent)] transition hover:border-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <span>{label}</span>
              <ChevronDown className="h-4 w-4 text-[var(--muted)]" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={6}
            collisionPadding={16}
            className="z-[100] w-auto border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl"
          >
            <div className="flex gap-1.5">
              <PickerColumn className="w-14">
                {HOURS_12.map((hour) => (
                  <PickerOption
                    key={hour}
                    selected={parts.hour12 === hour}
                    optionRef={parts.hour12 === hour ? selectedHourRef : undefined}
                    onClick={() => commit({ hour12: hour })}
                  >
                    {hour}
                  </PickerOption>
                ))}
              </PickerColumn>
              <PickerColumn className="w-16">
                {MINUTES.map((minute) => (
                  <PickerOption
                    key={minute}
                    selected={parts.minute === minute}
                    optionRef={
                      parts.minute === minute ? selectedMinuteRef : undefined
                    }
                    onClick={() => commit({ minute })}
                  >
                    :{String(minute).padStart(2, "0")}
                  </PickerOption>
                ))}
              </PickerColumn>
              <PickerColumn className="w-14">
                {(["AM", "PM"] as const).map((period) => (
                  <PickerOption
                    key={period}
                    selected={parts.period === period}
                    onClick={() => commit({ period })}
                  >
                    {period}
                  </PickerOption>
                ))}
              </PickerColumn>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)]"
            >
              Done
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
