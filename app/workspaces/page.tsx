import { redirect } from "next/navigation";
import { getMyAccount } from "@/features/workspace/actions";
import { WorkspacesPageClient } from "@/features/workspace/workspaces-page-client";

export default async function WorkspacesPage() {
  const accountResult = await getMyAccount();

  if (!accountResult.ok) {
    redirect("/");
  }

  return <WorkspacesPageClient account={accountResult.data} />;
}
