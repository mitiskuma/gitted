"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { GitBranch, FolderSearch, Sparkles } from "lucide-react";
import type { HowItWorksStep } from "@/lib/types";

const steps: HowItWorksStep[] = [
  {
    step: 1,
    icon: "🔗",
    title: "Connect GitHub",
    description:
      "Authenticate with your GitHub account using a Personal Access Token. We only need public_repo and read:user permissions to analyze your activity.",
  },
  {
    step: 2,
    icon: "📂",
    title: "Select Repos",
    description:
      "Browse your repositories and pick the ones you want to visualize. Filter by language, stars, or activity — select as many as you'd like.",
  },
  {
    step: 3,
    icon: "✨",
    title: "Generate Your Story",
    description:
      "We analyze your commits, compute analytics, and generate beautiful visualizations — your Wrapped cards, Gource animation, and AI-powered developer story.",
  },
];

const stepIcons = [GitBranch, FolderSearch, Sparkles];

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <section
      ref={sectionRef}
      className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-5xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              How It Works
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to transform your Git history into a beautiful
            visual experience.
          </p>
        </motion.div>

        {/* Steps container */}
        <div className="relative">
          {/* Animated dotted connector line — desktop (horizontal) */}
          <div className="hidden lg:block absolute top-[72px] left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] z-0">
            <motion.svg
              className="w-full h-4"
              viewBox="0 0 800 16"
              preserveAspectRatio="none"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <motion.line
                x1="0"
                y1="8"
                x2="800"
                y2="8"
                stroke="url(#dotLineGradient)"
                strokeWidth="2"
                strokeDasharray="8 6"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={isInView ? { pathLength: 1 } : {}}
                transition={{ duration: 1.2, delay: 0.6, ease: "easeInOut" }}
              />
              <defs>
                <linearGradient
                  id="dotLineGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
            </motion.svg>
          </div>

          {/* Animated dotted connector line — mobile/tablet (vertical) */}
          <div className="lg:hidden absolute left-[39px] top-[140px] bottom-[140px] z-0">
            <motion.svg
              className="w-4 h-full"
              viewBox="0 0 16 600"
              preserveAspectRatio="none"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <motion.line
                x1="8"
                y1="0"
                x2="8"
                y2="600"
                stroke="url(#dotLineGradientV)"
                strokeWidth="2"
                strokeDasharray="8 6"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={isInView ? { pathLength: 1 } : {}}
                transition={{ duration: 1.2, delay: 0.6, ease: "easeInOut" }}
              />
              <defs>
                <linearGradient
                  id="dotLineGradientV"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
            </motion.svg>
          </div>

          {/* Steps grid */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8">
            {steps.map((step, index) => {
              const IconComponent = stepIcons[index];
              const gradientColors = [
                "from-purple-500 to-violet-600",
                "from-pink-500 to-rose-600",
                "from-orange-500 to-amber-600",
              ];
              const glowColors = [
                "shadow-purple-500/20",
                "shadow-pink-500/20",
                "shadow-orange-500/20",
              ];
              const borderColors = [
                "border-purple-500/30",
                "border-pink-500/30",
                "border-orange-500/30",
              ];

              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.6,
                    delay: 0.2 + index * 0.2,
                    ease: "easeOut",
                  }}
                  className="flex flex-row lg:flex-col items-start lg:items-center gap-5 lg:gap-0"
                >
                  {/* Step number circle */}
                  <motion.div
                    className="relative flex-shrink-0"
                    whileHover={{ scale: 1.1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 15,
                    }}
                  >
                    {/* Glow ring */}
                    <div
                      className={`absolute -inset-2 rounded-full bg-gradient-to-br ${gradientColors[index]} opacity-20 blur-md`}
                    />

                    {/* Circle */}
                    <div
                      className={`relative w-[72px] h-[72px] lg:w-20 lg:h-20 rounded-full border-2 ${borderColors[index]} bg-black/60 backdrop-blur-sm flex items-center justify-center shadow-lg ${glowColors[index]}`}
                    >
                      {/* Number badge */}
                      <div
                        className={`absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br ${gradientColors[index]} flex items-center justify-center text-xs font-bold text-white shadow-md`}
                      >
                        {step.step}
                      </div>

                      {/* Icon */}
                      <IconComponent className="w-7 h-7 lg:w-8 lg:h-8 text-white/90" />
                    </div>
                  </motion.div>

                  {/* Content */}
                  <div className="lg:mt-6 lg:text-center">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xs lg:max-w-sm">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bottom accent */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={isInView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 0.8, delay: 1.2, ease: "easeOut" }}
          className="mt-16 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"
        />
      </div>
    </section>
  );
}
