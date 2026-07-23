"use client";

import { useState } from "react";
import { Check, Copy, Link2, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Workspace, WorkspaceRole } from "@/types";

export function WorkspaceHeader({
  workspace,
  role,
}: {
  workspace: Workspace;
  role: WorkspaceRole;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/workspace/${workspace.slug}`
      : `/workspace/${workspace.slug}`;

  return (
    <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
          Spotra workspace
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {workspace.title}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {role === "admin" && (
          <Button variant="secondary" asChild>
            <Link href={`/workspace/${workspace.slug}/users`}>
              <Users className="h-4 w-4" />
              Users
            </Link>
          </Button>
        )}
        <Button onClick={() => setShareOpen(true)}>
          <Link2 className="h-4 w-4" />
          Share
        </Button>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this workspace</DialogTitle>
            <DialogDescription>
              Anyone with this link can sign in with Google and claim available
              slots.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={shareUrl} />
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
