import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceGate } from "@/features/workspace/actions";
import { WorkspacePageClient } from "@/features/workspace/workspace-page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gateResult = await getWorkspaceGate(slug);

  if (!gateResult.ok) {
    return {
      title: "Workspace not found",
      description: "This Spotra workspace could not be found.",
    };
  }

  const { title } = gateResult.data;
  const description = `Join ${title} on Spotra to claim available time slots.`;
  const url = `/workspace/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} — Spotra`,
      description,
      url,
      type: "website",
      siteName: "Spotra",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Spotra`,
      description,
    },
  };
}

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
