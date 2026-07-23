import { createClient } from "@/lib/supabase/server";
import { getWorkspaceGate } from "@/features/workspace/actions";
import { WorkspacePageClient } from "@/features/workspace/workspace-page-client";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const gateResult = await getWorkspaceGate(slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <WorkspacePageClient
        slug={slug}
        isAuthenticated={Boolean(user)}
        gate={gateResult.ok ? gateResult.data : null}
      />
    </div>
  );
}
