"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FeatureItem } from "@/lib/types";

const features: FeatureItem[] = [
  {
    icon: "📖",
    title: "Story",
    description:
      "Transform your commit history into an AI-generated narrative. Every merge, refactor, and late-night push becomes a chapter in your developer journey — powered by Claude.",
    link: "/story",
    gradientColors: ["#3178c6", "#60a5fa"],
  },
  {
    icon: "🎵",
    title: "Wrapped",
    description:
      "Your year in code, Spotify Wrapped-style. Swipeable cards reveal your top repos, longest streaks, coding patterns, and superlatives like 'Night Owl' or 'Weekend Warrior'.",
    link: "/wrapped",
    gradientColors: ["#7b2ff7", "#c084fc"],
  },
  {
    icon: "🌳",
    title: "Gource",
    description:
      "Watch your codebase grow in real time. A stunning force-directed visualization renders every file and contributor as your repository evolves from first commit to present.",
    link: "/gource",
    gradientColors: ["#10b981", "#34d399"],
  },
  {
    icon: "📊",
    title: "Analytics",
    description:
      "Deep-dive into contribution heatmaps, commit frequency, language breakdowns, productivity metrics, and year-over-year growth across all your repositories.",
    link: "/dashboard",
    gradientColors: ["#f59e0b", "#fbbf24"],
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: FeatureItem;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: true, margin: "-50px" });

  return (
    <Link href={feature.link} className="block">
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{
        duration: 0.6,
        delay: index * 0.15,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="group relative"
    >
      {/* Gradient border glow on hover */}
      <div
        className="absolute -inset-[1px] rounded-2xl opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-70"
        style={{
          background: `linear-gradient(135deg, ${feature.gradientColors[0]}, ${feature.gradientColors[1]})`,
        }}
      />
      <div
        className="absolute -inset-[1px] rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${feature.gradientColors[0]}40, ${feature.gradientColors[1]}40)`,
        }}
      />

      <Card className="relative h-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14]/80 p-0 backdrop-blur-xl transition-all duration-500 group-hover:border-white/[0.12] group-hover:bg-[#0d0d14]/90">
        {/* Subtle gradient overlay at top */}
        <div
          className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `linear-gradient(90deg, transparent, ${feature.gradientColors[0]}, ${feature.gradientColors[1]}, transparent)`,
          }}
        />

        <div className="relative flex h-full flex-col p-6 sm:p-8">
          {/* Icon with gradient background */}
          <div className="mb-5 flex items-start justify-between">
            <motion.div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
              style={{
                background: `linear-gradient(135deg, ${feature.gradientColors[0]}20, ${feature.gradientColors[1]}20)`,
                border: `1px solid ${feature.gradientColors[0]}30`,
              }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {feature.icon}
            </motion.div>

            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.03] text-xs text-white/40 transition-colors duration-300 group-hover:border-white/20 group-hover:text-white/60"
            >
              Explore →
            </Badge>
          </div>

          {/* Title */}
          <h3
            className="mb-3 bg-clip-text text-xl font-bold text-transparent sm:text-2xl"
            style={{
              backgroundImage: `linear-gradient(135deg, ${feature.gradientColors[0]}, ${feature.gradientColors[1]})`,
            }}
          >
            {feature.title}
          </h3>

          {/* Description */}
          <p className="flex-1 text-sm leading-relaxed text-white/50 transition-colors duration-300 group-hover:text-white/65 sm:text-[15px]">
            {feature.description}
          </p>

          {/* Bottom decoration */}
          <div className="mt-6 flex items-center gap-2">
            <div
              className="h-1 w-8 rounded-full transition-all duration-500 group-hover:w-16"
              style={{
                background: `linear-gradient(90deg, ${feature.gradientColors[0]}, ${feature.gradientColors[1]})`,
              }}
            />
            <div
              className="h-1 w-2 rounded-full opacity-40"
              style={{ backgroundColor: feature.gradientColors[0] }}
            />
            <div
              className="h-1 w-1 rounded-full opacity-20"
              style={{ backgroundColor: feature.gradientColors[1] }}
            />
          </div>
        </div>
      </Card>
    </motion.div>
    </Link>
  );
}

export function FeaturesOverview() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative px-4 py-24 sm:px-6 sm:py-32 lg:px-8"
    >
      {/* Background subtle gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#7b2ff7]/[0.03] to-transparent" />

      <div className="relative mx-auto max-w-7xl">
        {/* Section header */}
        <motion.div
          className="mb-16 text-center sm:mb-20"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          <Badge
            variant="outline"
            className="mb-4 border-[#7b2ff7]/30 bg-[#7b2ff7]/10 px-4 py-1.5 text-sm text-[#c084fc]"
          >
            ✨ Four Ways to Explore
          </Badge>

          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Everything your{" "}
            <span className="bg-gradient-to-r from-[#7b2ff7] to-[#c084fc] bg-clip-text text-transparent">
              git history
            </span>{" "}
            can become
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-base text-white/40 sm:text-lg">
            Built with Next.js 13 and TypeScript. Connect your GitHub, select
            repos, and generate beautiful visualizations of your activity.
          </p>
        </motion.div>

        {/* Feature cards grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>

      </div>
    </section>
  );
}
