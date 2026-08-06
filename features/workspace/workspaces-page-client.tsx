"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
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
import { CreateWorkspaceModal } from "@/features/workspace/create-workspace-modal";
import {
  deleteWorkspace,
  leaveWorkspace,
  listMyWorkspaces,
} from "@/features/workspace/actions";
import { SignOutButton } from "@/features/auth/sign-out-button";

export function WorkspacesPageClient() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["my-workspaces"],
    queryFn: async () => {
      const result = await listMyWorkspaces();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["my-workspaces"] });
    await queryClient.refetchQueries({ queryKey: ["my-workspaces"] });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
            Spotra
            <span className="text-[0.65rem] tracking-[0.18em]">Beta</span>
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
            Your workspaces
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Pick a calendar to open, or create a new one.
            {isFetching && !isLoading ? " Updating…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href="/">Home</Link>
          </Button>
          <SignOutButton />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New workspace
          </Button>
        </div>
      </div>

      <div className="mt-10 space-y-3">
        {isLoading && (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--muted)]">
            Loading workspaces…
          </p>
        )}
        {error && (
          <p className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--surface)] p-6 text-[var(--danger)]">
            {error instanceof Error ? error.message : "Could not load workspaces."}
          </p>
        )}
        {!isLoading && !error && (data?.length ?? 0) === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
            <LayoutGrid className="mx-auto h-8 w-8 text-[var(--muted)]" />
            <p className="mt-4 font-medium">No workspaces yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Create one to open spots and share a booking link.
            </p>
            <Button className="mt-6" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create workspace
            </Button>
          </div>
        )}
        {data?.map((item) => (
          <div
            key={item.workspace.id}
            className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <Link
                href={`/workspace/${item.workspace.slug}`}
                className="font-[family-name:var(--font-display)] text-xl font-semibold hover:text-[var(--accent)]"
              >
                {item.workspace.title}
              </Link>
              <p className="mt-1 text-sm text-[var(--muted)]">
                <span className="capitalize">{item.role}</span>
                {" · "}
                Joined {format(new Date(item.joined_at), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/workspace/${item.workspace.slug}`}>Open</Link>
              </Button>
              {item.role === "admin" ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    setPendingDelete({
                      id: item.workspace.id,
                      title: item.workspace.title,
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={async () => {
                    const result = await leaveWorkspace(item.workspace.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Left workspace");
                    await refresh();
                  }}
                >
                  Leave
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <CreateWorkspaceModal open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <strong>{pendingDelete?.title}</strong>, including all spots and
              claim history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!pendingDelete) return;
                const result = await deleteWorkspace(pendingDelete.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Workspace deleted");
                setPendingDelete(null);
                await refresh();
              }}
            >
              Delete workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
