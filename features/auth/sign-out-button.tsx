"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

export function SignOutButton({
  variant = "outline",
  size = "default",
  label = "Sign out",
}: {
  variant?: "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant={variant}
      size={size}
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);
          await signOut();
          router.push("/");
          router.refresh();
        } catch (e) {
          setLoading(false);
          toast.error(e instanceof Error ? e.message : "Could not sign out");
        }
      }}
    >
      <LogOut className="h-4 w-4" />
      {loading ? "Signing out…" : label}
    </Button>
  );
}
