"use client";

import { useState } from "react";
import { Check, Copy, LayoutGrid, Link2, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteWorkspace } from "@/features/workspace/actions";
import type { Workspace, WorkspaceRole } from "@/types";

export function WorkspaceHeader({
  workspace,
  role,
}: {
  workspace: Workspace;
  role: WorkspaceRole;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/workspace/${workspace.slug}`
      : `/workspace/${workspace.slug}`;

  async function handleShare() {
    const shareData: ShareData = {
      title: `${workspace.title} — Spotra`,
      text: `Join ${workspace.title} on Spotra to claim available slots.`,
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
        // User dismissed the sheet — don't open the fallback dialog.
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
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </>
        )}
        <Button onClick={handleShare}>
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
                toast.success("Link copied");
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this workspace?</DialogTitle>
            <DialogDescription>
              This permanently deletes {workspace.title}, including slots and
              reservation history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                const result = await deleteWorkspace(workspace.id);
                if (!result.ok) {
                  setDeleting(false);
                  toast.error(result.error);
                  return;
                }
                await queryClient.invalidateQueries({
                  queryKey: ["my-workspaces"],
                });
                toast.success("Workspace deleted");
                router.push("/workspaces");
                router.refresh();
              }}
            >
              {deleting ? "Deleting…" : "Delete workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
