'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BookOpen, Sparkles, Play, Lock } from 'lucide-react';
import type { NavigationCardProps } from '@/lib/types';

interface NavigationCardData extends NavigationCardProps {
  badge?: string;
  iconComponent: React.ReactNode;
  previewLines?: string[];
}

const navigationCards: NavigationCardData[] = [
  {
    title: 'Your Developer Story',
    description:
      'AI-generated narrative of your coding journey. From your first commit to your latest push — every milestone, pivot, and breakthrough woven into a compelling story powered by Claude.',
    icon: '📖',
    href: '/story',
    gradientColors: ['#3178c6', '#663399'],
    isReady: true,
    badge: 'AI-Powered',
    iconComponent: <BookOpen className="h-8 w-8" />,
    previewLines: [
      'Chapter 1: The Beginning',
      'It started with a single repository...',
      'Chapter 2: Finding Your Stack',
      'TypeScript became the language of choice...',
    ],
  },
  {
    title: 'Git Wrapped',
    description:
      'Your year in code, beautifully visualized. Spotify Wrapped-style slides showcasing your top repos, longest streaks, peak productivity hours, and fun superlatives you can share.',
    icon: '🎁',
    href: '/wrapped',
    gradientColors: ['#e94560', '#5a189a'],
    isReady: true,
    badge: 'Shareable',
    iconComponent: <Sparkles className="h-8 w-8" />,
    previewLines: [
      '🔥 247-day streak',
      '⭐ 1,342 commits this year',
      '🦉 Night owl — peak at 11pm',
      '💻 TypeScript was your #1',
    ],
  },
  {
    title: 'Gource Visualization',
    description:
      'Watch your repositories come alive. An interactive, real-time visualization of every commit, contributor, and file — rendered as an organic, growing tree of your entire codebase.',
    icon: '🌳',
    href: '/gource',
    gradientColors: ['#00ADD8', '#34d399'],
    isReady: true,
    badge: 'Interactive',
    iconComponent: <Play className="h-8 w-8" />,
    previewLines: [
      '● src/lib/analytics-engine.ts',
      '● src/components/dashboard/',
      '○ README.md',
      '● package.json',
    ],
  },
];

function AnimatedPreview({
  lines,
  gradientColors,
  isHovered,
}: {
  lines: string[];
  gradientColors: [string, string];
  isHovered: boolean;
}) {
  return (
    <div className="relative h-32 w-full overflow-hidden rounded-lg bg-black/30 backdrop-blur-sm border border-white/5">
      <div
        className="absolute inset-0 opacity-10 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]})`,
          opacity: isHovered ? 0.2 : 0.08,
        }}
      />
      <div className="relative p-3 space-y-1.5">
        {lines.map((line, i) => (
          <div
            key={i}
            className="flex items-center gap-2 transition-all duration-300"
            style={{
              transform: isHovered
                ? `translateX(${i % 2 === 0 ? 4 : 0}px)`
                : 'translateX(0)',
              opacity: isHovered ? 1 : 0.6,
              transitionDelay: `${i * 50}ms`,
            }}
          >
            <div
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: i % 2 === 0 ? gradientColors[0] : gradientColors[1],
                boxShadow: isHovered
                  ? `0 0 6px ${i % 2 === 0 ? gradientColors[0] : gradientColors[1]}60`
                  : 'none',
              }}
            />
            <span className="text-xs text-muted-foreground font-mono truncate">
              {line}
            </span>
          </div>
        ))}
      </div>
      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isHovered
            ? `linear-gradient(180deg, transparent 0%, ${gradientColors[0]}08 50%, transparent 100%)`
            : 'transparent',
          animation: isHovered ? 'scanline 2s ease-in-out infinite' : 'none',
        }}
      />
    </div>
  );
}

function NavigationCard({ card }: { card: NavigationCardData }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link href={card.href} className="block h-full">
      <Card
        className="relative h-full overflow-hidden transition-all duration-500 cursor-pointer border-white/5 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-transparent hover:shadow-2xl"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          borderImage: isHovered
            ? `linear-gradient(135deg, ${card.gradientColors[0]}, ${card.gradientColors[1]}) 1`
            : undefined,
          borderColor: isHovered ? 'transparent' : undefined,
        }}
      >
        {/* Gradient border overlay */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-500"
          style={{
            opacity: isHovered ? 1 : 0,
            padding: '1px',
            background: `linear-gradient(135deg, ${card.gradientColors[0]}, ${card.gradientColors[1]})`,
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'xor',
            WebkitMaskComposite: 'xor',
          }}
        />

        {/* Background glow */}
        <div
          className="absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl transition-opacity duration-700 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${card.gradientColors[0]}30, transparent)`,
            opacity: isHovered ? 1 : 0,
          }}
        />
        <div
          className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full blur-3xl transition-opacity duration-700 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${card.gradientColors[1]}20, transparent)`,
            opacity: isHovered ? 1 : 0,
          }}
        />

        <CardContent className="relative p-6 flex flex-col h-full gap-5">
          {/* Header with icon and badge */}
          <div className="flex items-start justify-between">
            <div
              className="flex items-center justify-center h-14 w-14 rounded-xl transition-all duration-500"
              style={{
                background: isHovered
                  ? `linear-gradient(135deg, ${card.gradientColors[0]}25, ${card.gradientColors[1]}25)`
                  : 'rgba(255,255,255,0.05)',
                boxShadow: isHovered
                  ? `0 0 20px ${card.gradientColors[0]}20`
                  : 'none',
                transform: isHovered ? 'scale(1.05) rotate(-2deg)' : 'scale(1)',
              }}
            >
              <div
                className="transition-all duration-300"
                style={{
                  color: isHovered ? card.gradientColors[0] : 'hsl(var(--muted-foreground))',
                }}
              >
                {card.iconComponent}
              </div>
            </div>
            {card.badge && (
              <Badge
                variant="outline"
                className="text-xs transition-all duration-300"
                style={{
                  borderColor: isHovered ? `${card.gradientColors[0]}60` : undefined,
                  color: isHovered ? card.gradientColors[0] : undefined,
                  backgroundColor: isHovered
                    ? `${card.gradientColors[0]}10`
                    : undefined,
                }}
              >
                {card.badge}
              </Badge>
            )}
          </div>

          {/* Title */}
          <div>
            <h3
              className="text-xl font-bold tracking-tight transition-colors duration-300 mb-2"
              style={{
                color: isHovered ? card.gradientColors[0] : undefined,
              }}
            >
              {card.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {card.description}
            </p>
          </div>

          {/* Animated preview */}
          {card.previewLines && (
            <AnimatedPreview
              lines={card.previewLines}
              gradientColors={card.gradientColors}
              isHovered={isHovered}
            />
          )}

          {/* CTA button area */}
          <div className="mt-auto pt-2">
            <Button
              variant="ghost"
              className="w-full justify-between px-4 py-3 h-auto transition-all duration-300"
              style={{
                backgroundColor: isHovered
                  ? `${card.gradientColors[0]}15`
                  : 'transparent',
                color: isHovered ? card.gradientColors[0] : undefined,
              }}
            >
              <span className="text-sm font-medium">
                {card.isReady ? 'Explore' : 'Coming Soon'}
              </span>
              <div
                className="transition-transform duration-300"
                style={{
                  transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                }}
              >
                {card.isReady ? (
                  <ArrowRight className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function NavigationCards() {
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {navigationCards.map((card) => (
          <NavigationCard key={card.href} card={card} />
        ))}
      </div>


      <style jsx global>{`
        @keyframes scanline {
          0%,
          100% {
            transform: translateY(-100%);
          }
          50% {
            transform: translateY(100%);
          }
        }
      `}</style>
    </section>
  );
}
