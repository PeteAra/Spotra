import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spotra.dev";

export const metadata: Metadata = {
  title: {
    default: "Spotra — Claim a spot, simply",
    template: "%s — Spotra",
  },
  description:
    "Create a calendar, open available spots, share the link, let people claim a spot.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Spotra",
    title: "Spotra — Claim a spot, simply",
    description:
      "Create a calendar, open available spots, share the link, let people claim a spot.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spotra — Claim a spot, simply",
    description:
      "Create a calendar, open available spots, share the link, let people claim a spot.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <Providers>
          <Suspense fallback={null}>{children}</Suspense>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
