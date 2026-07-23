"use client";

import { createClient } from "@/lib/supabase/browser";

export async function signInWithGoogle(returnTo = "/") {
  const supabase = createClient();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
