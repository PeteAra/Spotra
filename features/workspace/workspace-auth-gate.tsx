"use client";

import { format } from "date-fns";
import { SignInWithGoogleButton } from "@/features/auth/sign-in-button";
import type { WorkspaceGate } from "@/types";

export function WorkspaceAuthGate({
  gate,
  slug,
}: {
  gate: WorkspaceGate | null;
  slug: string;
}) {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="relative min-h-[70vh] overflow-hidden rounded-3xl border border-[var(--border)]">
      <div
        aria-hidden
        className="pointer-events-none select-none p-6 opacity-40 blur-[2px] grayscale"
      >
        <div className="mb-4 h-8 w-48 rounded bg-[var(--surface-muted)]" />
        <div className="grid grid-cols-7 gap-2">
          {weekdays.map((d) => (
            <div key={d} className="text-center text-xs text-[var(--muted)]">
              {d}
            </div>
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-[var(--surface-muted)]"
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--background)_72%,transparent)] p-6 backdrop-blur-sm">
        <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
            Private calendar
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {gate?.title ?? "Spotra workspace"}
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            Sign in with Google to view availability and claim a spot.
          </p>
          <div className="mt-6 flex justify-center">
            <SignInWithGoogleButton
              returnTo={`/workspace/${slug}`}
              label="Sign in with Google"
              size="lg"
            />
          </div>
          <p className="mt-4 text-xs text-[var(--muted)]">
            {format(new Date(), "MMMM yyyy")}
          </p>
        </div>
      </div>
    </div>
  );
}
