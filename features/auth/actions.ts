"use client";

import { createClient } from "@/lib/supabase/browser";
import { setAuthReturnCookie } from "@/lib/auth-return";

export async function signInWithGoogle(returnTo = "/") {
  const supabase = createClient();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

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
