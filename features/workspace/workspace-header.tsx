"use client";

import { useState } from "react";
import { Check, Copy, LayoutGrid, Link2, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DeleteWorkspaceDialog } from "@/features/workspace/delete-workspace-dialog";
import { SignOutButton } from "@/features/auth/sign-out-button";
import type { Workspace, WorkspaceRole } from "@/types";

export function WorkspaceHeader({
  workspace,
  role,
  accountId,
}: {
  workspace: Workspace;
  role: WorkspaceRole;
  accountId: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isOwner = workspace.created_by === accountId;
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/workspace/${workspace.slug}`
      : `/workspace/${workspace.slug}`;

  async function handleShare() {
    const shareData: ShareData = {
      title: `${workspace.title} — Spotra`,
      text: `Join ${workspace.title} on Spotra to claim available spots.`,
      url: shareUrl,
    };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        if (
          typeof navigator.canShare !== "function" ||
          navigator.canShare(shareData)
        ) {
          await navigator.share(shareData);
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    setShareOpen(true);
  }

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
        <Button variant="secondary" asChild>
          <Link href="/workspaces">
            <LayoutGrid className="h-4 w-4" />
            Workspaces
          </Link>
        </Button>
        {role === "admin" && (
          <>
            <Button variant="secondary" asChild>
              <Link href={`/workspace/${workspace.slug}/users`}>
                <Users className="h-4 w-4" />
                Users
              </Link>
            </Button>
            {isOwner ? (
              <Button variant="outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </>
        )}
        <Button onClick={handleShare}>
          <Link2 className="h-4 w-4" />
          Share
        </Button>
        <SignOutButton />
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this workspace</DialogTitle>
            <DialogDescription>
              Anyone with this link can sign in with Google and claim available
              spots.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={shareUrl} />
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                toast.success("Link copied");
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteWorkspaceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workspaceId={workspace.id}
        workspaceTitle={workspace.title}
      />
    </header>
  );
}
