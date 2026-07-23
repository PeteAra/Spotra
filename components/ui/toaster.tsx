"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-lg",
        },
      }}
    />
  );
}
