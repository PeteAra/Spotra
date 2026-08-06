import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/features/workspace/actions";
import { MembersTable } from "@/features/members/members-table";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { Button } from "@/components/ui/button";

export default async function WorkspaceUsersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/workspace/${slug}`);
  }

  const result = await getWorkspaceBySlug(slug);
  if (!result.ok) {
    redirect(`/workspace/${slug}`);
  }

  if (result.data.role !== "admin") {
    redirect(`/workspace/${slug}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            {result.data.workspace.title}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">
            Workspace users
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href={`/workspace/${slug}`}>Back to calendar</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>
      <MembersTable
        workspaceId={result.data.workspace.id}
        workspaceSlug={slug}
        currentAccountId={user.id}
      />
    </div>
  );
}
