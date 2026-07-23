"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SignInWithGoogleButton } from "@/features/auth/sign-in-button";
import { CreateWorkspaceModal } from "@/features/workspace/create-workspace-modal";
import { createClient } from "@/lib/supabase/browser";

export function LandingPage() {
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      const signedIn = Boolean(data.session);
      setAuthed(signedIn);
      if (signedIn && searchParams.get("create") === "1") {
        setCreateOpen(true);
      }
    });
  }, [searchParams]);

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--accent-soft),transparent_45%),radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--success)_18%,transparent),transparent_40%),linear-gradient(160deg,var(--background),var(--surface-muted))]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
          Spotra
        </p>
        <h1 className="mt-4 max-w-3xl font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-6xl md:text-7xl">
          Open slots.
          <br />
          Share the link.
          <br />
          Let people claim time.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[var(--muted)]">
          A simple calendar for tutoring, office hours, labs, practice rooms, and
          appointments — without the setup maze.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          {authed ? (
            <button
              type="button"
              className="inline-flex h-12 items-center rounded-xl bg-[var(--accent)] px-6 text-base font-medium text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)]"
              onClick={() => setCreateOpen(true)}
            >
              Open a New Workspace
            </button>
          ) : (
            <SignInWithGoogleButton
              returnTo="/?create=1"
              label="Open a New Workspace"
              size="lg"
            />
          )}
        </div>
      </div>
      <CreateWorkspaceModal open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}
