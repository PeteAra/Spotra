"use client";

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { reauthenticateWithGoogle } from "@/features/auth/actions";

export const PENDING_WORKSPACE_DELETE_KEY = "spotra_pending_workspace_delete";

export type PendingWorkspaceDelete = {
  id: string;
  title: string;
  confirmTitle: string;
};

export function readPendingWorkspaceDelete(): PendingWorkspaceDelete | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_WORKSPACE_DELETE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingWorkspaceDelete;
    if (!parsed?.id || typeof parsed.title !== "string") return null;
    if (typeof parsed.confirmTitle !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingWorkspaceDelete() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_WORKSPACE_DELETE_KEY);
}

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceTitle: string;
}) {
  const [confirmTitle, setConfirmTitle] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) setConfirmTitle("");
  }, [open]);

  const titleMatches =
    confirmTitle.trim().length > 0 &&
    confirmTitle.trim() === workspaceTitle.trim();

  async function handleContinue() {
    if (!titleMatches) {
      toast.error("Type the workspace name exactly to continue.");
      return;
    }

    setStarting(true);
    try {
      const pending: PendingWorkspaceDelete = {
        id: workspaceId,
        title: workspaceTitle,
        confirmTitle: confirmTitle.trim(),
      };
      sessionStorage.setItem(
        PENDING_WORKSPACE_DELETE_KEY,
        JSON.stringify(pending),
      );

      const returnTo = `/workspaces?deleteWorkspace=${encodeURIComponent(workspaceId)}`;
      await reauthenticateWithGoogle(returnTo);
    } catch (e) {
      clearPendingWorkspaceDelete();
      setStarting(false);
      toast.error(
        e instanceof Error ? e.message : "Could not start Google sign-in.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete workspace?</DialogTitle>
          <DialogDescription>
            This permanently deletes <strong>{workspaceTitle}</strong>,
            including all spots and claim history. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-workspace-title">
            Type <span className="font-semibold">{workspaceTitle}</span> to
            confirm
          </Label>
          <Input
            id="confirm-workspace-title"
            value={confirmTitle}
            autoComplete="off"
            placeholder={workspaceTitle}
            onChange={(event) => setConfirmTitle(event.target.value)}
          />
          <p className="text-xs text-[var(--muted)]">
            For security, you’ll sign in with Google again before deletion.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={starting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!titleMatches || starting}
            onClick={() => void handleContinue()}
          >
            {starting ? "Redirecting…" : "Sign in with Google to delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
