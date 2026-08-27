"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[spotra] client error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[var(--background,#f4f7f4)] px-4 text-[var(--foreground,#0f2e1f)]">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border,#d5ddd6)] bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-[var(--muted,#5c6b60)]">
            The page hit an unexpected error. Try again, or go back to your
            workspaces.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button variant="secondary" asChild>
              <Link href="/workspaces">Workspaces</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
