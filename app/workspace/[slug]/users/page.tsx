import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/features/workspace/actions";
import { WorkspaceUsersPageClient } from "@/features/members/users-page-client";

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
    <WorkspaceUsersPageClient
      workspaceId={result.data.workspace.id}
      workspaceSlug={slug}
      workspaceTitle={result.data.workspace.title}
      currentAccountId={user.id}
      createdByAccountId={result.data.workspace.created_by}
    />
  );
}
