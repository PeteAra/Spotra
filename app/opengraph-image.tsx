import { ImageResponse } from "next/og";

export const alt = "Spotra — Claim time, simply";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 900,
            }}
          >
            Claim time, simply
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#6a7264",
              maxWidth: 820,
              lineHeight: 1.35,
            }}
          >
            Create a calendar, open available slots, share the link, let people
            claim seats.
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
