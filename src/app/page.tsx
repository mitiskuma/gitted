import { Metadata } from "next";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesOverview } from "@/components/landing/features-overview";
import { PreviewAnimation } from "@/components/landing/preview-animation";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CtaSection } from "@/components/landing/cta-section";

export const metadata: Metadata = {
  title: "gitted — Your Git Story, Beautifully Told",
  description:
    "Generate beautiful visualizations of your GitHub activity. Git Wrapped, Gource visualizations, AI-powered developer stories, and deep analytics — all from your commit history.",
  keywords: [
    "git wrapped",
    "github wrapped",
    "git story",
    "gource",
    "github analytics",
    "developer story",
    "commit visualization",
    "github activity",
  ],
  openGraph: {
    title: "gitted — Your Git Story, Beautifully Told",
    description:
      "Generate beautiful visualizations of your GitHub activity. Wrapped cards, Gource trees, AI stories, and deep analytics.",
    type: "website",
    url: "https://gitted.dev",
  },
  twitter: {
    card: "summary_large_image",
    title: "gitted — Your Git Story, Beautifully Told",
    description:
      "Generate beautiful visualizations of your GitHub activity.",
  },
};

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 h-[600px] w-[600px] rounded-full bg-purple-600/10 blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[128px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-pink-600/5 blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <HeroSection
          headline="Your Git Story, Beautifully Told"
          subheadline="Generate stunning visualizations of your GitHub activity — Wrapped cards, Gource trees, AI-powered developer stories, and deep analytics. All from your commit history."
          ctaText="Get Started"
          ctaLink="/connect"
        />

        {/* Features Overview */}
        <FeaturesOverview />

        {/* Preview Animation */}
        <PreviewAnimation />

        {/* How It Works */}
        <HowItWorks />

        {/* CTA Section */}
        <CtaSection />
      </div>
    </main>
  );
}
