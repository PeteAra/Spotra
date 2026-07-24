"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInWithGoogleButton } from "@/features/auth/sign-in-button";
import { CreateWorkspaceModal } from "@/features/workspace/create-workspace-modal";
import { createClient } from "@/lib/supabase/browser";

export function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsCreate = searchParams.get("create") === "1";

  const [createOpen, setCreateOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [sessionReady, setSessionReady] = useState(!wantsCreate);
  const [statusMessage, setStatusMessage] = useState(
    wantsCreate ? "Finishing sign-in…" : "",
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function openCreateFlow() {
      if (cancelled) return;
      setStatusMessage("Opening workspace setup…");
      setAuthed(true);
      setCreateOpen(true);
      setSessionReady(true);
      // Drop ?create=1 so refresh doesn't re-trigger the waiting state
      router.replace("/", { scroll: false });
    }

    async function resolveSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session) {
        setAuthed(true);
        if (wantsCreate) {
          await openCreateFlow();
        } else {
          setSessionReady(true);
        }
        return;
      }

      // Session cookie can lag right after OAuth redirect — keep waiting briefly
      if (wantsCreate) {
        setStatusMessage("Finishing sign-in…");
        setSessionReady(false);
      } else {
        setSessionReady(true);
      }
    }

    void resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (!session) {
        setAuthed(false);
        if (!wantsCreate) setSessionReady(true);
        return;
      }

      setAuthed(true);
      if (wantsCreate && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void openCreateFlow();
      }
    });

    // Safety timeout so we never spin forever
    const timeout = window.setTimeout(() => {
      if (cancelled || !wantsCreate) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        if (data.session) {
          void openCreateFlow();
        } else {
          setStatusMessage("");
          setSessionReady(true);
        }
      });
    }, 12_000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [wantsCreate, router]);

  const showBootOverlay = wantsCreate && !createOpen && !sessionReady;

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
          {!sessionReady && wantsCreate ? (
            <button
              type="button"
              disabled
              className="inline-flex h-12 items-center rounded-xl bg-[var(--accent)] px-6 text-base font-medium text-[var(--accent-foreground)] opacity-70"
            >
              Preparing…
            </button>
          ) : authed ? (
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

      {showBootOverlay && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[color-mix(in_srgb,var(--background)_78%,transparent)] p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-xl">
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]"
              aria-hidden
            />
            <p className="mt-5 font-[family-name:var(--font-display)] text-xl font-semibold">
              {statusMessage || "Finishing sign-in…"}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Hang tight — we&apos;ll open workspace setup next.
            </p>
          </div>
        </div>
      )}

      <CreateWorkspaceModal open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}
