import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspacesPageClient } from "@/features/workspace/workspaces-page-client";

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return <WorkspacesPageClient />;
}
