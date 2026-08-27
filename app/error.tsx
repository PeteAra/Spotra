"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[spotra] route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" asChild>
          <Link href="/workspaces">Workspaces</Link>
        </Button>
      </div>
    </div>
  );
}
