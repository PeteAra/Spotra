"use client";

import { createClient } from "@/lib/supabase/browser";
import { setAuthReturnCookie } from "@/lib/auth-return";

/** Prefer the live browser origin so OAuth never uses a mistaken http:// SITE_URL. */
function appOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spotra.dev";
  try {
    const url = new URL(raw);
    if (url.hostname === "spotra.dev" || url.hostname === "www.spotra.dev") {
      url.protocol = "https:";
    }
    return url.origin;
  } catch {
    return "https://spotra.dev";
  }
}

export async function signInWithGoogle(returnTo = "/") {
  const supabase = createClient();
  const origin = appOrigin();

  // Persist return path in a cookie. Supabase often drops query params on
  // redirectTo and falls back to the Site URL (/), which loses the workspace link.
  setAuthReturnCookie(returnTo);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
      // Let users pick a different Gmail after signing out.
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "global" });
}
