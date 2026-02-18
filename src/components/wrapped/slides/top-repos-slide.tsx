'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { type WrappedSlideProps, type WrappedRepoStat, GITHUB_LANGUAGE_COLORS } from '@/lib/types';

interface AnimatedBarProps {
  repo: WrappedRepoStat;
  maxCommits: number;
  index: number;
  isActive: boolean;
}

function AnimatedBar({ repo, maxCommits, index, isActive }: AnimatedBarProps) {
  const [width, setWidth] = useState(0);
  const [countDisplay, setCountDisplay] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const countRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const targetWidth = maxCommits > 0 ? (repo.commits / maxCommits) * 100 : 0;

  useEffect(() => {
    if (!isActive) {
      setWidth(0);
      setCountDisplay(0);
      setOpacity(0);
      return;
    }

    const staggerDelay = index * 250;

    const fadeTimer = setTimeout(() => {
      setOpacity(1);
    }, staggerDelay);

    const barTimer = setTimeout(() => {
      setWidth(targetWidth);
    }, staggerDelay + 150);

    const countTimer = setTimeout(() => {
      const duration = 1200;
      const startTime = performance.now();
      const target = repo.commits;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCountDisplay(Math.round(eased * target));

        if (progress < 1) {
          countRef.current = requestAnimationFrame(animate);
        }
      };

      countRef.current = requestAnimationFrame(animate);
    }, staggerDelay + 300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(barTimer);
      clearTimeout(countTimer);
      if (countRef.current) {
        cancelAnimationFrame(countRef.current);
      }
    };
  }, [isActive, index, targetWidth, repo.commits]);

  const languageColor = repo.languageColor || GITHUB_LANGUAGE_COLORS[repo.language || ''] || '#6366f1';

  const rankEmojis: Record<number, string> = {
    1: '🥇',
    2: '🥈',
    3: '🥉',
    4: '4️⃣',
    5: '5️⃣',
  };

  const rankGradients: Record<number, string> = {
    1: 'from-yellow-400 via-amber-400 to-orange-500',
    2: 'from-slate-300 via-gray-300 to-slate-400',
    3: 'from-amber-600 via-orange-600 to-amber-700',
    4: 'from-indigo-400 to-purple-500',
    5: 'from-violet-400 to-fuchsia-500',
  };

  return (
    <div
      className="flex items-center gap-3 sm:gap-4"
      style={{
        opacity,
        transform: opacity === 1 ? 'translateX(0)' : 'translateX(-20px)',
        transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
      }}
    >
      {/* Rank badge */}
      <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
        <span className="text-2xl sm:text-3xl">{rankEmojis[repo.rank] || `#${repo.rank}`}</span>
      </div>

      {/* Bar and info */}
      <div className="flex-1 min-w-0">
        {/* Repo name and language */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm sm:text-base font-bold text-white truncate">
            {repo.repoName}
          </span>
          {repo.language && (
            <Badge
              variant="secondary"
              className="text-[10px] sm:text-xs px-1.5 py-0 h-5 flex-shrink-0 border-0"
              style={{
                backgroundColor: `${languageColor}25`,
                color: languageColor,
              }}
            >
              <span
                className="w-2 h-2 rounded-full mr-1 inline-block flex-shrink-0"
                style={{ backgroundColor: languageColor }}
              />
              {repo.language}
            </Badge>
          )}
        </div>

        {/* Animated bar */}
        <div className="relative h-8 sm:h-10 rounded-lg overflow-hidden bg-white/5 backdrop-blur-sm">
          <div
            className={`absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r ${rankGradients[repo.rank] || 'from-indigo-500 to-purple-600'}`}
            style={{
              width: `${width}%`,
              transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: `0 0 20px ${languageColor}40`,
            }}
          />
          {/* Shimmer effect */}
          <div
            className="absolute inset-y-0 left-0 rounded-lg overflow-hidden"
            style={{
              width: `${width}%`,
              transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                animationName: isActive ? 'shimmer' : 'none',
                animationDuration: '2s',
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDelay: `${index * 0.3}s`,
              }}
            />
          </div>

          {/* Commit count inside bar */}
          <div className="absolute inset-0 flex items-center px-3">
            <span
              className="text-xs sm:text-sm font-bold text-white drop-shadow-lg"
              style={{
                opacity: width > 15 ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            >
              {countDisplay.toLocaleString()} commits
            </span>
          </div>
        </div>

        {/* Percentage */}
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] sm:text-xs text-white/40">
            {repo.percentage.toFixed(1)}% of all commits
          </span>
          {/* Show count outside bar if bar is too small */}
          <span
            className="text-xs sm:text-sm font-semibold text-white/70"
            style={{
              opacity: width <= 15 ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          >
            {countDisplay.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TopReposSlide({ data, isActive, animationState, onAnimationComplete }: WrappedSlideProps) {
  const [showTitle, setShowTitle] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showBars, setShowBars] = useState(false);
  const hasAnimated = useRef(false);

  const topRepos = data.topRepos.slice(0, 5);
  const maxCommits = topRepos.length > 0 ? topRepos[0].commits : 1;

  const triggerAnimations = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    setTimeout(() => setShowTitle(true), 100);
    setTimeout(() => setShowSubtitle(true), 400);
    setTimeout(() => setShowBars(true), 700);

    const totalAnimTime = 700 + topRepos.length * 250 + 1500;
    setTimeout(() => {
      onAnimationComplete?.();
    }, totalAnimTime);
  }, [topRepos.length, onAnimationComplete]);

  useEffect(() => {
    if (isActive && (animationState === 'entering' || animationState === 'active')) {
      triggerAnimations();
    }

    if (!isActive) {
      hasAnimated.current = false;
      setShowTitle(false);
      setShowSubtitle(false);
      setShowBars(false);
    }
  }, [isActive, animationState, triggerAnimations]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center px-6 sm:px-10 md:px-16 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating code symbols */}
        {['{ }', '< />', '( )', '[ ]', '&&', '||', '=>', '::'].map((symbol, i) => (
          <span
            key={i}
            className="absolute text-white/[0.03] font-mono select-none"
            style={{
              fontSize: `${20 + Math.random() * 40}px`,
              left: `${10 + Math.random() * 80}%`,
              top: `${5 + Math.random() * 90}%`,
              transform: `rotate(${-15 + Math.random() * 30}deg)`,
              animation: isActive ? `float-gentle ${4 + Math.random() * 3}s ease-in-out infinite` : 'none',
              animationDelay: `${Math.random() * 3}s`,
            }}
          >
            {symbol}
          </span>
        ))}

        {/* Radial glow */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(83,52,131,0.3) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Content container */}
      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Title */}
        <div
          className="text-center mb-8 sm:mb-10"
          style={{
            opacity: showTitle ? 1 : 0,
            transform: showTitle ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-purple-300/80 mb-2">
            Your Top Repositories
          </p>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight"
            style={{
              background: 'linear-gradient(135deg, #c084fc, #818cf8, #60a5fa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Where You Built
          </h2>
        </div>

        {/* Subtitle */}
        <div
          className="text-center mb-8 sm:mb-10"
          style={{
            opacity: showSubtitle ? 1 : 0,
            transform: showSubtitle ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s ease-out',
          }}
        >
          <p className="text-sm sm:text-base text-white/50">
            {topRepos.length > 0 ? (
              <>
                <span className="text-white/80 font-semibold">{topRepos[0].repoName}</span>{' '}
                dominated with{' '}
                <span className="text-white/80 font-semibold">
                  {topRepos[0].commits.toLocaleString()} commits
                </span>{' '}
                — that&apos;s{' '}
                <span className="text-purple-300 font-semibold">
                  {topRepos[0].percentage.toFixed(0)}%
                </span>{' '}
                of your total output
              </>
            ) : (
              'Your repositories at a glance'
            )}
          </p>
        </div>

        {/* Bar chart */}
        <div className="space-y-4 sm:space-y-5">
          {topRepos.map((repo, index) => (
            <AnimatedBar
              key={repo.repoId}
              repo={repo}
              maxCommits={maxCommits}
              index={index}
              isActive={showBars}
            />
          ))}
        </div>

        {/* Total repos stat */}
        <div
          className="mt-8 sm:mt-10 text-center"
          style={{
            opacity: showBars ? 1 : 0,
            transform: showBars ? 'translateY(0)' : 'translateY(15px)',
            transition: 'all 0.6s ease-out',
            transitionDelay: `${topRepos.length * 0.25 + 0.5}s`,
          }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="text-white/40 text-xs sm:text-sm">
              Out of{' '}
              <span className="text-white/80 font-bold">{data.totals.totalRepos} repos</span>{' '}
              and{' '}
              <span className="text-white/80 font-bold">
                {data.totals.totalCommits.toLocaleString()} total commits
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Inline styles for animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
        @keyframes float-gentle {
          0%,
          100% {
            transform: translateY(0px) rotate(var(--rotate, 0deg));
          }
          50% {
            transform: translateY(-12px) rotate(var(--rotate, 0deg));
          }
        }
      `}</style>
    </div>
  );
}
