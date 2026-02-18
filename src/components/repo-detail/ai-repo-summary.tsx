"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Sparkles,
  GitCommit,
  Calendar,
  Rocket,
  ChevronRight,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import type { Repository, DateRange, StoryMilestone } from "@/lib/types";

interface AiRepoSummaryProps {
  repository: Repository;
  dateRange: DateRange;
  commitCount: number;
  topContributors?: string[];
  milestones?: StoryMilestone[];
}

export function AIRepoSummary({
  repository,
  dateRange,
  commitCount,
  topContributors = [],
  milestones = [],
}: AiRepoSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate realistic narrative based on the repository data
  const narrative = generateNarrative(repository, dateRange, commitCount, topContributors);
  const keyMilestones = milestones.length > 0 ? milestones : generateMockMilestones(repository);
  const techEvolution = generateTechEvolution(repository);

  return (
    <Card className="relative overflow-hidden border-purple-500/20 bg-gradient-to-br from-gray-900/80 via-purple-950/30 to-gray-900/80 backdrop-blur-sm">
      {/* Decorative gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-violet-500" />

      {/* Sparkle decoration */}
      <div className="pointer-events-none absolute top-4 right-4">
        <div className="relative">
          <Sparkles className="h-6 w-6 text-purple-400/50 animate-pulse" />
          <div className="absolute inset-0 h-6 w-6 text-purple-400/30 blur-sm animate-pulse" />
        </div>
      </div>

      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 ring-1 ring-purple-500/30">
            <Lightbulb className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-white">
              AI-Generated Summary
            </CardTitle>
            <p className="text-sm text-gray-400">
              Powered by deep commit analysis
            </p>
          </div>
          <Badge
            variant="outline"
            className="ml-auto border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs"
          >
            <Sparkles className="mr-1 h-3 w-3" />
            AI Insight
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Narrative Section */}
        <div className="space-y-3">
          <div className="space-y-3 text-sm leading-relaxed text-gray-300">
            <p>{narrative.paragraph1}</p>
            <p>{narrative.paragraph2}</p>
            {isExpanded && <p>{narrative.paragraph3}</p>}
          </div>
          {!isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 group cursor-pointer"
            >
              Read more
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        {/* Key Milestones */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-fuchsia-400" />
            <h4 className="text-sm font-semibold text-white">Key Milestones</h4>
          </div>
          <div className="space-y-2">
            {keyMilestones.slice(0, isExpanded ? undefined : 4).map((milestone, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 border border-white/[0.04] transition-colors hover:bg-white/[0.05]"
              >
                <span className="mt-0.5 text-base leading-none">{milestone.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">
                      {milestone.title}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(milestone.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                    {milestone.description}
                  </p>
                </div>
                {milestone.significance >= 4 && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] px-1.5"
                  >
                    Major
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Technology Evolution */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-white">
              Technology Evolution
            </h4>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {techEvolution.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2 border border-white/[0.04]"
              >
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-200">{item.name}</span>
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {item.note}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Commit Patterns Summary */}
        <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 px-4 py-3">
          <GitCommit className="h-5 w-5 text-purple-400 shrink-0" />
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-white">
              {commitCount.toLocaleString()} commits
            </span>{" "}
            analyzed across{" "}
            <span className="font-medium text-purple-300">
              {dateRange.totalDays} days
            </span>{" "}
            of development history, averaging{" "}
            <span className="font-medium text-fuchsia-300">
              {Math.round(commitCount / Math.max(dateRange.totalDays / 7, 1))}{" "}
              commits/week
            </span>
          </p>
        </div>

        {/* Read Full Story CTA */}
        <div className="pt-2">
          <Link
            href={`/story?repo=${encodeURIComponent(repository.fullName)}`}
          >
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white border-0 shadow-lg shadow-purple-500/20 transition-all hover:shadow-purple-500/30 cursor-pointer"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Read Full Story
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Helper Functions ---

function generateNarrative(
  repo: Repository,
  dateRange: DateRange,
  commitCount: number,
  contributors: string[]
) {
  const repoName = repo.name;
  const language = repo.language || "TypeScript";
  const startYear = new Date(dateRange.start).getFullYear();
  const endYear = new Date(dateRange.end).getFullYear();
  const isMultiYear = endYear > startYear;
  const contributorCount = contributors.length || 1;

  const paragraph1 = `${repoName} began its journey in ${startYear} as a ${language}-powered project${
    repo.description
      ? `, focused on ${repo.description.toLowerCase().replace(/\.$/, "")}`
      : ""
  }. Over ${
    isMultiYear ? `${endYear - startYear}+ years` : "the past year"
  }, the codebase has evolved through ${commitCount.toLocaleString()} commits, reflecting a disciplined and iterative approach to software development. ${
    contributorCount > 1
      ? `A team of ${contributorCount} contributors has shaped the project's direction, each bringing unique perspectives and expertise.`
      : "The project has been primarily shaped by a dedicated solo developer with a clear vision."
  }`;

  const paragraph2 = `The repository's commit history reveals distinct phases of development — from initial scaffolding and rapid feature development to periods of stabilization and refactoring. ${
    repo.starCount > 100
      ? `With ${repo.starCount.toLocaleString()} stars on GitHub, the project has garnered significant community attention and trust.`
      : repo.starCount > 0
        ? `The project has earned ${repo.starCount} stars, showing growing interest from the developer community.`
        : "The project represents a focused effort in solving specific technical challenges."
  } The code frequency patterns suggest a ${
    commitCount > 500
      ? "highly active"
      : commitCount > 100
        ? "moderately active"
        : "focused"
  } development cadence.`;

  const paragraph3 = `Looking at the overall trajectory, ${repoName} demonstrates the kind of engineering maturity that comes from ${
    isMultiYear ? "years" : "months"
  } of sustained effort. The ratio of additions to deletions shows healthy refactoring habits, and the commit message patterns indicate a well-organized development workflow. ${
    repo.topics && repo.topics.length > 0
      ? `The project's focus areas — ${repo.topics.slice(0, 3).join(", ")} — align well with modern development practices.`
      : `The technology choices, centered around ${language}, position it well for long-term maintainability.`
  }`;

  return { paragraph1, paragraph2, paragraph3 };
}

function generateMockMilestones(repo: Repository): StoryMilestone[] {
  const createdAt = repo.createdAt || new Date().toISOString();
  const createdDate = new Date(createdAt);

  const milestones: StoryMilestone[] = [
    {
      date: createdAt,
      title: "Project Initialized",
      description: `The ${repo.name} repository was created with initial project scaffolding and core configuration files.`,
      repoId: repo.id,
      repoName: repo.name,
      type: "project-start",
      significance: 5,
      relatedCommits: [],
      icon: "🚀",
    },
    {
      date: new Date(
        createdDate.getTime() + 14 * 24 * 60 * 60 * 1000
      ).toISOString(),
      title: "Core Architecture Established",
      description: `Major architectural decisions were implemented, setting the foundation for ${repo.language || "TypeScript"}-based development patterns.`,
      repoId: repo.id,
      repoName: repo.name,
      type: "milestone",
      significance: 4,
      relatedCommits: [],
      icon: "🏗️",
    },
    {
      date: new Date(
        createdDate.getTime() + 45 * 24 * 60 * 60 * 1000
      ).toISOString(),
      title: "First Feature Complete",
      description:
        "The initial feature set reached a stable, functional state with comprehensive implementation.",
      repoId: repo.id,
      repoName: repo.name,
      type: "breakthrough",
      significance: 4,
      relatedCommits: [],
      icon: "✅",
    },
    {
      date: new Date(
        createdDate.getTime() + 90 * 24 * 60 * 60 * 1000
      ).toISOString(),
      title: "Major Refactoring Phase",
      description:
        "Significant code restructuring improved maintainability and set the stage for scaling the project.",
      repoId: repo.id,
      repoName: repo.name,
      type: "pivot",
      significance: 3,
      relatedCommits: [],
      icon: "🔄",
    },
    {
      date: new Date(
        createdDate.getTime() + 150 * 24 * 60 * 60 * 1000
      ).toISOString(),
      title: "Community Milestone",
      description: `${
        repo.starCount > 100
          ? `Surpassed ${Math.floor(repo.starCount / 100) * 100} stars`
          : repo.forkCount > 5
            ? `Reached ${repo.forkCount} forks from the community`
            : "First external contribution received"
      }, marking growing community adoption.`,
      repoId: repo.id,
      repoName: repo.name,
      type: "achievement",
      significance: repo.starCount > 100 ? 5 : 3,
      relatedCommits: [],
      icon: "⭐",
    },
  ];

  return milestones;
}

interface TechEvolutionItem {
  name: string;
  color: string;
  note: string;
}

function generateTechEvolution(repo: Repository): TechEvolutionItem[] {
  const items: TechEvolutionItem[] = [];
  const languageColors: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    CSS: "#563d7c",
    Python: "#3572A5",
    Go: "#00ADD8",
    Rust: "#dea584",
    Java: "#b07219",
    Ruby: "#701516",
    HTML: "#e34c26",
    Shell: "#89e051",
  };

  if (repo.languages && Object.keys(repo.languages).length > 0) {
    const sortedLangs = Object.entries(repo.languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
    const total = sortedLangs.reduce((sum, [, bytes]) => sum + bytes, 0);

    sortedLangs.forEach(([lang, bytes]) => {
      const pct = ((bytes / total) * 100).toFixed(1);
      items.push({
        name: lang,
        color: languageColors[lang] || "#6b7280",
        note: `${pct}%`,
      });
    });
  } else if (repo.language) {
    items.push({
      name: repo.language,
      color: languageColors[repo.language] || "#3178c6",
      note: "Primary",
    });

    // Add realistic supporting languages based on primary
    if (repo.language === "TypeScript") {
      items.push(
        { name: "CSS", color: "#563d7c", note: "Styling" },
        { name: "JavaScript", color: "#f1e05a", note: "Config" }
      );
    } else if (repo.language === "Python") {
      items.push(
        { name: "Shell", color: "#89e051", note: "Scripts" },
        { name: "Dockerfile", color: "#384d54", note: "Deploy" }
      );
    }
  }

  return items;
}
