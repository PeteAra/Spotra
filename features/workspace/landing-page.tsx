"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInWithGoogleButton } from "@/features/auth/sign-in-button";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { CreateWorkspaceModal } from "@/features/workspace/create-workspace-modal";
import {
  clearAuthReturnCookie,
  readAuthReturnCookie,
} from "@/lib/auth-return";
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

    async function afterSignedIn() {
      if (cancelled) return;
      setAuthed(true);

      // Safety net: if OAuth fell back to / but a workspace return path was saved.
      const pendingReturn = readAuthReturnCookie();
      if (pendingReturn && pendingReturn !== "/") {
        clearAuthReturnCookie();
        setStatusMessage("Opening workspace…");
        router.replace(pendingReturn);
        return;
      }

      if (wantsCreate) {
        setStatusMessage("Opening workspace setup…");
        setCreateOpen(true);
        setSessionReady(true);
        router.replace("/", { scroll: false });
        return;
      }

      setStatusMessage("Loading your workspaces…");
      router.replace("/workspaces");
    }

    async function resolveSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session) {
        await afterSignedIn();
        return;
      }

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

      if (wantsCreate && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void afterSignedIn();
      } else if (!wantsCreate && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void afterSignedIn();
      }
    });

    const timeout = window.setTimeout(() => {
      if (cancelled || !wantsCreate) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        if (data.session) {
          void afterSignedIn();
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

  const showBootOverlay =
    (wantsCreate && !createOpen && !sessionReady) ||
    (authed &&
      !wantsCreate &&
      !createOpen &&
      (statusMessage === "Loading your workspaces…" ||
        statusMessage === "Opening workspace…"));

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--accent-soft),transparent_45%),radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--success)_18%,transparent),transparent_40%),linear-gradient(160deg,var(--background),var(--surface-muted))]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <div className="flex items-center gap-3 sm:gap-4">
          <img
            src="/brand/spotra-mark.png"
            alt=""
            width={56}
            height={56}
            className="h-12 w-12 shrink-0 sm:h-14 sm:w-14"
          />
          <div>
            <p className="font-[family-name:var(--font-body)] text-2xl font-semibold tracking-tight text-[#0F2E1F] sm:text-3xl">
              Spotra
            </p>
            <p className="mt-0.5 text-sm text-[var(--muted)] sm:text-base">
              Share your time. Simplify scheduling.
            </p>
          </div>
        </div>
        <h1 className="mt-8 max-w-3xl font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] sm:mt-10 sm:text-6xl md:text-7xl">
          Open spots.
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
            <>
              <Link
                href="/workspaces"
                className="inline-flex h-12 items-center rounded-xl bg-[var(--accent)] px-6 text-base font-medium text-[var(--accent-foreground)] transition hover:bg-[var(--accent-hover)]"
              >
                My workspaces
              </Link>
              <button
                type="button"
                className="inline-flex h-12 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 text-base font-medium transition hover:bg-[var(--surface-muted)]"
                onClick={() => setCreateOpen(true)}
              >
                Open a New Workspace
              </button>
              <SignOutButton size="lg" />
            </>
          ) : (
            <>
              <SignInWithGoogleButton
                returnTo="/workspaces"
                label="Sign in"
                size="lg"
              />
              <SignInWithGoogleButton
                returnTo="/?create=1"
                label="Open a New Workspace"
                size="lg"
              />
            </>
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
              Hang tight — this only takes a moment.
            </p>
          </div>
        </div>
      )}

      <CreateWorkspaceModal open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}
