"use client";

import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/features/auth/actions";
import { useState } from "react";
import { toast } from "sonner";

export function SignInWithGoogleButton({
  returnTo = "/",
  label = "Sign in with Google",
  size = "default",
}: {
  returnTo?: string;
  label?: string;
  size?: "default" | "lg" | "sm";
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size={size}
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          await signInWithGoogle(returnTo);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Sign-in failed");
          setLoading(false);
        }
      }}
    >
      {loading ? "Redirecting…" : label}
    </Button>
  );
}
