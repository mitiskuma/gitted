"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star,
  GitFork,
  Eye,
  ExternalLink,
  Calendar,
  GitCommit,
  Shield,
  Clock,
} from "lucide-react";
import Link from "next/link";
import type { Repository, DateRange, GITHUB_LANGUAGE_COLORS } from "@/lib/types";

export interface RepoHeaderProps {
  repository: Repository;
  dateRange: DateRange;
  commitCount: number;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Scala: "#c22d40",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Lua: "#000080",
  R: "#198CE7",
};

function getLanguageColor(language: string | null): string {
  if (!language) return "#6b7280";
  return LANGUAGE_COLORS[language] || "#6b7280";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 99, g: 102, b: 241 };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

function getTimeSince(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function RepoHeader({ repository, dateRange, commitCount }: RepoHeaderProps) {
  const langColor = getLanguageColor(repository.language);
  const rgb = hexToRgb(langColor);

  const stats = [
    {
      icon: Star,
      label: "Stars",
      value: formatNumber(repository.starCount),
      rawValue: repository.starCount,
    },
    {
      icon: GitFork,
      label: "Forks",
      value: formatNumber(repository.forkCount),
      rawValue: repository.forkCount,
    },
    {
      icon: Eye,
      label: "Watchers",
      value: formatNumber(repository.watcherCount),
      rawValue: repository.watcherCount,
    },
    {
      icon: GitCommit,
      label: "Commits Analyzed",
      value: formatNumber(commitCount),
      rawValue: commitCount,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80 backdrop-blur-sm">
      {/* Gradient Banner */}
      <div
        className="relative h-32 sm:h-40 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, 
            rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4) 0%, 
            rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15) 40%,
            rgba(15, 15, 25, 0.9) 100%)`,
        }}
      >
        {/* Animated gradient mesh */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 20% 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 20%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2) 0%, transparent 50%),
              radial-gradient(ellipse at 60% 80%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15) 0%, transparent 50%)
            `,
          }}
        />

        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Corner accent glow */}
        <div
          className="absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl"
          style={{
            backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative -mt-8 px-4 pb-6 sm:px-6 lg:px-8">
        {/* Top row: avatar/icon + repo name */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          {/* Repo icon/avatar */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 shadow-lg"
            style={{
              borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`,
              background: `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05))`,
              boxShadow: `0 4px 24px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
            }}
          >
            {repository.owner.avatarUrl ? (
              <img
                src={repository.owner.avatarUrl}
                alt={repository.owner.login}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <GitCommit
                className="h-8 w-8"
                style={{ color: langColor }}
              />
            )}
          </div>

          {/* Name and description */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-white sm:text-3xl">
                {repository.name}
              </h1>

              {repository.isPrivate && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-400"
                >
                  <Shield className="mr-1 h-3 w-3" />
                  Private
                </Badge>
              )}

              {repository.isArchived && (
                <Badge
                  variant="outline"
                  className="border-zinc-500/40 bg-zinc-500/10 text-zinc-400"
                >
                  Archived
                </Badge>
              )}

              {repository.isFork && (
                <Badge
                  variant="outline"
                  className="border-blue-500/40 bg-blue-500/10 text-blue-400"
                >
                  <GitFork className="mr-1 h-3 w-3" />
                  Fork
                </Badge>
              )}
            </div>

            <p className="mt-1 text-sm text-zinc-400">
              {repository.owner.login} / {repository.name}
            </p>

            {repository.description && (
              <p className="mt-2 text-sm leading-relaxed text-zinc-300 sm:text-base">
                {repository.description}
              </p>
            )}
          </div>

          {/* GitHub link button */}
          <div className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
              asChild
            >
              <a
                href={repository.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>

        {/* Language and metadata badges row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {repository.language && (
            <Badge
              className="border-0 text-white"
              style={{
                backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
              }}
            >
              <span
                className="mr-1.5 inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: langColor }}
              />
              {repository.language}
            </Badge>
          )}

          {repository.license && (
            <Badge
              variant="outline"
              className="border-white/10 text-zinc-400"
            >
              <Shield className="mr-1 h-3 w-3" />
              {repository.license.name}
            </Badge>
          )}

          {repository.topics &&
            repository.topics.slice(0, 5).map((topic) => (
              <Badge
                key={topic}
                variant="outline"
                className="border-white/10 bg-white/5 text-zinc-400"
              >
                {topic}
              </Badge>
            ))}

          {repository.topics && repository.topics.length > 5 && (
            <Badge
              variant="outline"
              className="border-white/10 text-zinc-500"
            >
              +{repository.topics.length - 5} more
            </Badge>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
            >
              <stat.icon className="h-4 w-4 shrink-0 text-zinc-500" />
              <div className="min-w-0">
                <p className="text-lg font-semibold tabular-nums text-white">
                  {stat.value}
                </p>
                <p className="truncate text-xs text-zinc-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Date range and last commit info */}
        <div className="mt-4 flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>
                Analysis: {formatDate(dateRange.start)} — {formatDate(dateRange.end)}
              </span>
            </div>
            <div className="hidden h-4 w-px bg-white/10 sm:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">{dateRange.totalDays} days analyzed</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
            <Clock className="h-3.5 w-3.5 text-zinc-500" />
            <span>
              Last push {getTimeSince(repository.pushedAt)}
            </span>
          </div>
        </div>

        {/* Language breakdown bar (if multiple languages) */}
        {Object.keys(repository.languages).length > 1 && (
          <div className="mt-4">
            <div className="flex h-2 overflow-hidden rounded-full">
              {Object.entries(repository.languages)
                .sort(([, a], [, b]) => b - a)
                .map(([lang, bytes]) => {
                  const totalBytes = Object.values(repository.languages).reduce(
                    (sum, b) => sum + b,
                    0
                  );
                  const percentage = (bytes / totalBytes) * 100;
                  const color = LANGUAGE_COLORS[lang] || "#6b7280";
                  return (
                    <div
                      key={lang}
                      className="transition-all duration-300"
                      style={{
                        width: `${Math.max(percentage, 0.5)}%`,
                        backgroundColor: color,
                      }}
                      title={`${lang}: ${percentage.toFixed(1)}%`}
                    />
                  );
                })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(repository.languages)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([lang, bytes]) => {
                  const totalBytes = Object.values(repository.languages).reduce(
                    (sum, b) => sum + b,
                    0
                  );
                  const percentage = (bytes / totalBytes) * 100;
                  const color = LANGUAGE_COLORS[lang] || "#6b7280";
                  return (
                    <div
                      key={lang}
                      className="flex items-center gap-1.5 text-xs text-zinc-400"
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span>{lang}</span>
                      <span className="text-zinc-600">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              {Object.keys(repository.languages).length > 6 && (
                <span className="text-xs text-zinc-600">
                  +{Object.keys(repository.languages).length - 6} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
