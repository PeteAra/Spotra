import type { Metadata } from "next";
import { LandingPage } from "@/features/workspace/landing-page";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Spotra",
  url: "https://spotra.dev",
  applicationCategory: "SchedulingApplication",
  operatingSystem: "Web",
  description:
    "Create a calendar, open available spots, share the link, let people claim a spot.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
