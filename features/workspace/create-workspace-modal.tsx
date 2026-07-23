"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspace } from "@/features/workspace/actions";
import {
  workspaceTitleSchema,
  type WorkspaceTitleInput,
} from "@/lib/validators";

export function CreateWorkspaceModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<WorkspaceTitleInput>({
    resolver: zodResolver(workspaceTitleSchema),
    defaultValues: { title: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create your workspace</DialogTitle>
          <DialogDescription>
            Give your calendar a clear title — for example, “Biology Lab Practice
            Sessions”.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            const result = await createWorkspace(values);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Click any day to create available time slots.");
            onOpenChange(false);
            router.push(`/workspace/${result.data.slug}`);
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="title">Workspace / Calendar title</Label>
            <Input
              id="title"
              placeholder="Biology Lab Practice Sessions"
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-[var(--danger)]">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
