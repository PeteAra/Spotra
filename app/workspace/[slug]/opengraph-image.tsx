import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";

export const alt = "Spotra workspace invite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function WorkspaceOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let title = "Spotra workspace";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("workspaces")
      .select("title")
      .eq("slug", slug)
      .maybeSingle();
    if (data?.title) {
      title = data.title as string;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background:
            "linear-gradient(145deg, #f3efe6 0%, #ebe4d6 45%, #d7efe6 100%)",
          color: "#1c241c",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#1f6f5b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f7fff9",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div
            style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            Spotra
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 28,
              color: "#1f6f5b",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
            }}
          >
            You are invited
          </div>
          <div
            style={{
              fontSize: title.length > 36 ? 56 : 68,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 980,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#6a7264",
              maxWidth: 820,
              lineHeight: 1.35,
            }}
          >
            Sign in with Google to claim available spots.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#1f6f5b",
            fontWeight: 600,
          }}
        >
          spotra.dev
        </div>
      </div>
    ),
    { ...size },
  );
}
