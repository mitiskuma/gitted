"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen, Sparkles, Play, ArrowRight } from "lucide-react";
import type { Repository, DateRange } from "@/lib/types";

interface QuickLinksProps {
  repository: Repository;
  dateRange?: DateRange;
}

const quickLinks = [
  {
    id: "story",
    title: "View Story",
    description:
      "Read the AI-generated narrative of this repository's journey — key milestones, pivots, and breakthroughs told as a developer story.",
    icon: BookOpen,
    gradient: "from-violet-600 via-purple-600 to-indigo-600",
    glowColor: "shadow-violet-500/20",
    hoverGlow: "hover:shadow-violet-500/40",
    badgeText: "AI-Powered",
    badgeVariant: "secondary" as const,
    buildPath: (repoId: string) => `/story?repo=${encodeURIComponent(repoId)}`,
  },
  {
    id: "wrapped",
    title: "View in Wrapped",
    description:
      "See this repository featured in your Spotify Wrapped-style year in review — beautiful animated slides with stats and superlatives.",
    icon: Sparkles,
    gradient: "from-pink-600 via-rose-600 to-orange-600",
    glowColor: "shadow-pink-500/20",
    hoverGlow: "hover:shadow-pink-500/40",
    badgeText: "Interactive",
    badgeVariant: "secondary" as const,
    buildPath: (repoId: string) =>
      `/wrapped?highlight=${encodeURIComponent(repoId)}`,
  },
  {
    id: "gource",
    title: "View Gource",
    description:
      "Watch this repository come to life with a real-time visualization of every commit, contributor, and file change over time.",
    icon: Play,
    gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    glowColor: "shadow-emerald-500/20",
    hoverGlow: "hover:shadow-emerald-500/40",
    badgeText: "Live Viz",
    badgeVariant: "secondary" as const,
    buildPath: (repoId: string) =>
      `/gource?repo=${encodeURIComponent(repoId)}`,
  },
];

export function QuickLinks({ repository, dateRange }: QuickLinksProps) {
  const repoId = repository.fullName;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Explore Further</h2>
        <p className="text-sm text-muted-foreground">
          Dive deeper into{" "}
          <span className="font-medium text-white">{repository.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const href = link.buildPath(repoId);

          return (
            <Link key={link.id} href={href} className="group block">
              <Card
                className={`relative overflow-hidden border-white/10 bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] ${link.glowColor} ${link.hoverGlow} shadow-lg hover:shadow-xl hover:-translate-y-1`}
              >
                {/* Gradient top border */}
                <div
                  className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${link.gradient} opacity-60 transition-opacity duration-300 group-hover:opacity-100`}
                />

                {/* Background glow effect */}
                <div
                  className={`pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-br ${link.gradient} opacity-[0.04] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.1]`}
                />

                <CardContent className="relative flex flex-col gap-4 p-6">
                  {/* Icon and badge row */}
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${link.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <Badge
                      variant={link.badgeVariant}
                      className="border-white/10 bg-white/5 text-xs text-muted-foreground"
                    >
                      {link.badgeText}
                    </Badge>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-white transition-colors duration-200 group-hover:text-white">
                    {link.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {link.description}
                  </p>

                  {/* Contextual info */}
                  {dateRange && (
                    <p className="text-xs text-muted-foreground/60">
                      Covering{" "}
                      {new Date(dateRange.start).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      –{" "}
                      {new Date(dateRange.end).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}

                  {/* CTA */}
                  <div className="mt-auto flex items-center pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto -ml-2 gap-2 p-2 text-sm text-muted-foreground transition-colors group-hover:text-white"
                      asChild
                    >
                      <span>
                        Explore
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
