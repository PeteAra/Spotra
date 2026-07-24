import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberProfile } from "@/features/members/actions";
import { MemberHistoryPageClient } from "@/features/members/member-history-page";
import { getWorkspaceBySlug } from "@/features/workspace/actions";

export default async function MemberHistoryPage({
  params,
}: {
  params: Promise<{ slug: string; accountId: string }>;
}) {
  const { slug, accountId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/workspace/${slug}`);
  }

  const workspaceResult = await getWorkspaceBySlug(slug);
  if (!workspaceResult.ok) {
    redirect(`/workspace/${slug}`);
  }

  if (workspaceResult.data.role !== "admin") {
    redirect(`/workspace/${slug}`);
  }

  const profileResult = await getMemberProfile({
    workspaceId: workspaceResult.data.workspace.id,
    accountId,
  });

  if (!profileResult.ok) {
    redirect(`/workspace/${slug}/users`);
  }

  return (
    <MemberHistoryPageClient
      workspaceId={workspaceResult.data.workspace.id}
      workspaceSlug={slug}
      workspaceTitle={workspaceResult.data.workspace.title}
      account={profileResult.data.account}
      member={profileResult.data.member}
    />
  );
}
