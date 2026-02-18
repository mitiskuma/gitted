'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWrappedSlideshow } from '@/hooks/use-wrapped-slideshow';
import { useAppStore } from '@/stores/app-store';
import { WRAPPED_SLIDE_DEFINITIONS } from '@/lib/types';
import type {
  WrappedSlideType,
  WrappedData,
  GitHubUser,
  WrappedRepoStat,
  LanguageEvolutionEntry,
} from '@/lib/types';

// Lazy-load slide components to avoid SSR/server-component issues
import dynamic from 'next/dynamic';

const WrappedSlideContainer = dynamic(
  () => import('@/components/wrapped/wrapped-slide-container').then(mod => ({ default: mod.WrappedSlideContainer })),
  { ssr: false }
);
const IntroSlide = dynamic(
  () => import('@/components/wrapped/slides/intro-slide').then(mod => ({ default: mod.IntroSlide })),
  { ssr: false }
);
const TopReposSlide = dynamic(
  () => import('@/components/wrapped/slides/top-repos-slide').then(mod => ({ default: mod.TopReposSlide })),
  { ssr: false }
);
const ProductivitySlide = dynamic(
  () => import('@/components/wrapped/slides/productivity-slide').then(mod => ({ default: mod.ProductivitySlide })),
  { ssr: false }
);
const LanguageEvolutionSlide = dynamic(
  () => import('@/components/wrapped/slides/language-evolution-slide').then(mod => ({ default: mod.LanguageEvolutionSlide })),
  { ssr: false }
);
const StreaksSlide = dynamic(
  () => import('@/components/wrapped/slides/streaks-slide').then(mod => ({ default: mod.StreaksSlide })),
  { ssr: false }
);
const MonthlyBreakdownSlide = dynamic(
  () => import('@/components/wrapped/slides/monthly-breakdown-slide').then(mod => ({ default: mod.MonthlyBreakdownSlide })),
  { ssr: false }
);
const YearlyComparisonSlide = dynamic(
  () => import('@/components/wrapped/slides/yearly-comparison-slide').then(mod => ({ default: mod.YearlyComparisonSlide })),
  { ssr: false }
);
const SuperlativesSlide = dynamic(
  () => import('@/components/wrapped/slides/superlatives-slide').then(mod => ({ default: mod.SuperlativesSlide })),
  { ssr: false }
);
const FinalSummarySlide = dynamic(
  () => import('@/components/wrapped/slides/final-summary-slide').then(mod => ({ default: mod.FinalSummarySlide })),
  { ssr: false }
);
const ShareWrapped = dynamic(
  () => import('@/components/wrapped/share-wrapped').then(mod => ({ default: mod.ShareWrapped })),
  { ssr: false }
);

// ─── Build WrappedData from real analytics + user ────────────────────────────

import { useGitData } from '@/context/git-data-provider';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { useAnalytics } from '@/hooks/use-analytics';
import { GITHUB_LANGUAGE_COLORS } from '@/lib/types';

function buildWrappedDataFromAnalytics(
  user: GitHubUser,
  analytics: import('@/lib/types').AnalyticsResult,
  repos: import('@/lib/types').Repository[],
  commits: import('@/lib/types').CommitData[],
): WrappedData {
  const totalCommits = analytics.totals.totalCommits;

  // Build topRepos from commitsByRepo counts
  const repoCommitCounts: Record<string, number> = {};
  for (const commit of commits) {
    repoCommitCounts[commit.repoId] = (repoCommitCounts[commit.repoId] || 0) + 1;
  }

  const topRepos: WrappedRepoStat[] = Object.entries(repoCommitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([repoId, count], index) => {
      const repo = repos.find(r => r.id === repoId || r.fullName === repoId);
      const lang = repo?.language || null;
      return {
        repoId,
        repoName: repo?.name || repoId.split('/').pop() || repoId,
        commits: count,
        language: lang,
        languageColor: lang ? (GITHUB_LANGUAGE_COLORS[lang] || '#94a3b8') : '#94a3b8',
        rank: index + 1,
        percentage: totalCommits > 0 ? Math.round((count / totalCommits) * 1000) / 10 : 0,
      };
    });

  // Build language evolution from commits grouped by month
  const langByMonth: Record<string, Record<string, number>> = {};
  for (const commit of commits) {
    const monthKey = commit.timestamp.slice(0, 7); // YYYY-MM
    if (!langByMonth[monthKey]) langByMonth[monthKey] = {};
    // Find the repo's language
    const repo = repos.find(r => r.id === commit.repoId || r.fullName === commit.repoId);
    const lang = repo?.language || 'Other';
    langByMonth[monthKey][lang] = (langByMonth[monthKey][lang] || 0) + 1;
  }

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const languageEvolution: LanguageEvolutionEntry[] = Object.entries(langByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, langs]) => {
      const total = Object.values(langs).reduce((s, v) => s + v, 0);
      const percentages: Record<string, number> = {};
      for (const [lang, count] of Object.entries(langs)) {
        percentages[lang] = Math.round((count / total) * 100);
      }
      const monthNum = parseInt(monthKey.split('-')[1], 10);
      return {
        period: monthLabels[monthNum - 1] || monthKey,
        date: `${monthKey}-01`,
        languages: percentages,
      };
    });

  return {
    user,
    totals: analytics.totals,
    topRepos,
    productivity: analytics.productivity,
    languageEvolution,
    streaks: analytics.streaks,
    monthlyBreakdown: analytics.monthlyBreakdown,
    yearOverYear: analytics.yearOverYear,
    superlatives: analytics.superlatives,
    dateRange: analytics.dateRange,
    wrappedYear: new Date().getFullYear(),
  };
}

// ─── Slide Component Map ─────────────────────────────────────────────────────

function getSlideComponent(
  slideType: WrappedSlideType,
  data: WrappedData,
  isActive: boolean,
  animationState: 'entering' | 'active' | 'exiting' | 'hidden'
) {
  const commonProps = { data, isActive, animationState };

  const slideTypes = WRAPPED_SLIDE_DEFINITIONS.map(d => d.type);
  const introType = slideTypes[0];
  const topReposType = slideTypes[1];
  const productivityType = slideTypes[2];
  const langEvoType = slideTypes[3];
  const streaksType = slideTypes[4];
  const monthlyType = slideTypes[5];
  const yearlyType = slideTypes[6];
  const superlativesType = slideTypes[7];
  const finalType = slideTypes[8];

  if (slideType === introType) {
    return <IntroSlide {...commonProps} />;
  }
  if (slideType === topReposType) {
    return <TopReposSlide {...commonProps} />;
  }
  if (slideType === productivityType) {
    return <ProductivitySlide {...commonProps} />;
  }
  if (slideType === langEvoType) {
    return <LanguageEvolutionSlide {...commonProps} />;
  }
  if (slideType === streaksType) {
    return <StreaksSlide {...commonProps} />;
  }
  if (slideType === monthlyType) {
    return <MonthlyBreakdownSlide {...commonProps} />;
  }
  if (slideType === yearlyType) {
    return <YearlyComparisonSlide {...commonProps} />;
  }
  if (slideType === superlativesType) {
    return <SuperlativesSlide {...commonProps} />;
  }
  if (slideType === finalType) {
    return <FinalSummarySlide {...commonProps} />;
  }
  return null;
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function WrappedPage() {
  const router = useRouter();
  const gitData = useGitData();
  const githubAuth = useGitHubAuth();
  const { analytics } = useAnalytics();
  const {
    currentSlide,
    totalSlides,
    next,
    prev,
    goTo,
    isAnimating,
    slideData,
    direction,
    autoAdvance,
    toggleAutoAdvance,
  } = useWrappedSlideshow();

  const [shareOpen, setShareOpen] = useState(false);
  const [animationState, setAnimationState] = useState<'entering' | 'active' | 'exiting' | 'hidden'>('entering');
  const slideRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build wrapped data from real analytics, or use pre-computed wrappedData from context
  const wrappedData: WrappedData | null = useMemo(() => {
    // First check if GitDataProvider already has computed wrapped data
    if (gitData.wrappedData) return gitData.wrappedData;

    // Otherwise build from analytics + user
    if (!analytics || !githubAuth.user) return null;

    return buildWrappedDataFromAnalytics(
      githubAuth.user,
      analytics,
      gitData.selectedRepositories,
      gitData.allCommitsSorted,
    );
  }, [gitData.wrappedData, analytics, githubAuth.user, gitData.selectedRepositories, gitData.allCommitsSorted]);

  // Set fullscreen mode on mount, restore on unmount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHeight = document.body.style.height;
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.height = originalHeight;
    };
  }, []);

  // Reset slide index on mount
  useEffect(() => {
    const { setWrappedSlideIndex } = useAppStore.getState();
    setWrappedSlideIndex(0);
  }, []);

  // Handle animation states when slide changes
  useEffect(() => {
    if (isAnimating) {
      setAnimationState('entering');
    } else {
      const timer = setTimeout(() => {
        setAnimationState('active');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentSlide, isAnimating]);

  // Click to advance (desktop)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('[data-no-advance]')
      ) {
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const threshold = rect.width * 0.3;

      if (clickX < threshold) {
        prev();
      } else {
        next();
      }
    },
    [next, prev]
  );

  // Escape to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // No data — show redirect prompt (after all hooks)
  if (!wrappedData) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a0533] via-[#0f0a1a] to-[#0a0a0f] text-white">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-6">{'📊'}</div>
          <h1 className="text-2xl font-bold mb-3">No Data Yet</h1>
          <p className="text-zinc-400 mb-8">
            Connect your GitHub account and select repositories first to generate your Wrapped experience.
          </p>
          <button
            onClick={() => router.push('/connect')}
            className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-3 font-semibold text-white transition-all hover:opacity-90"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  const currentSlideDef = slideData ?? WRAPPED_SLIDE_DEFINITIONS[0];
  const gradientColors = currentSlideDef.gradientColors;

  const bgGradient =
    gradientColors.length === 3
      ? `linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]}, ${gradientColors[2]})`
      : `linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]})`;

  const isFinalSlide = currentSlide === totalSlides - 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none"
      style={{
        background: bgGradient,
        transition: 'background 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={handleClick}
    >
      {/* Progress dots */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center gap-1.5 px-4 py-3 sm:py-4">
        {WRAPPED_SLIDE_DEFINITIONS.map((slide, index) => (
          <button
            key={slide.type}
            onClick={(e) => {
              e.stopPropagation();
              goTo(index);
            }}
            className="relative h-1 flex-1 max-w-12 rounded-full transition-all duration-300"
            aria-label={`Go to slide ${index + 1}`}
            data-no-advance
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                backgroundColor:
                  index < currentSlide
                    ? 'rgba(255, 255, 255, 0.8)'
                    : index === currentSlide
                    ? '#ffffff'
                    : 'rgba(255, 255, 255, 0.25)',
                transform: index === currentSlide ? 'scaleY(1.8)' : 'scaleY(1)',
              }}
            />
          </button>
        ))}
      </div>

      {/* Slide counter */}
      <div className="absolute top-3 right-4 z-50 text-white/50 text-xs font-mono sm:top-4 sm:right-6">
        {currentSlide + 1} / {totalSlides}
      </div>

      {/* Close / Exit button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          router.push('/dashboard');
        }}
        className="absolute top-2.5 left-3 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white sm:top-3 sm:left-4"
        aria-label="Exit Wrapped"
        data-no-advance
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Main slide area */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <div
          ref={slideRef}
          className="relative flex h-full w-full max-w-lg flex-col items-center justify-center px-6 py-16 sm:max-w-2xl sm:px-8 md:max-w-3xl"
        >
          <WrappedSlideContainer
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            onSlideChange={goTo}
            direction={direction}
          >
            {getSlideComponent(
              currentSlideDef.type,
              wrappedData,
              !isAnimating,
              animationState
            )}
          </WrappedSlideContainer>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        {/* Navigation arrows */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          disabled={currentSlide === 0 || isAnimating}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:opacity-0 disabled:pointer-events-none"
          aria-label="Previous slide"
          data-no-advance
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Center controls */}
        <div className="flex items-center gap-2" data-no-advance>
          {/* Auto-advance toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAutoAdvance();
            }}
            className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium backdrop-blur-sm transition-all ${
              autoAdvance
                ? 'bg-white/20 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80'
            }`}
            data-no-advance
          >
            {autoAdvance ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="4" height="10" rx="1" fill="currentColor" />
                <rect x="7" y="1" width="4" height="10" rx="1" fill="currentColor" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 1L10 6L2 11V1Z" fill="currentColor" />
              </svg>
            )}
            <span className="hidden sm:inline">{autoAdvance ? 'Pause' : 'Auto-play'}</span>
          </button>

          {/* Share button (visible on shareable slides) */}
          {currentSlideDef.shareable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShareOpen(true);
              }}
              className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-medium text-white/60 backdrop-blur-sm transition-all hover:bg-white/15 hover:text-white/80"
              data-no-advance
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M9 4C10.1046 4 11 3.10457 11 2C11 0.895431 10.1046 0 9 0C7.89543 0 7 0.895431 7 2C7 2.12 7.012 2.237 7.035 2.35L4.035 3.85C3.668 3.33 3.076 3 2.4 3C1.296 3 0.4 3.896 0.4 5C0.4 6.104 1.296 7 2.4 7C3.076 7 3.668 6.67 4.035 6.15L7.035 7.65C7.012 7.763 7 7.88 7 8C7 9.105 7.895 10 9 10C10.105 10 11 9.105 11 8C11 6.895 10.105 6 9 6C8.324 6 7.732 6.33 7.365 6.85L4.365 5.35C4.388 5.237 4.4 5.12 4.4 5C4.4 4.88 4.388 4.763 4.365 4.65L7.365 3.15C7.732 3.67 8.324 4 9 4Z" fill="currentColor" />
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
        </div>

        {/* Next arrow */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          disabled={isFinalSlide || isAnimating}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:opacity-0 disabled:pointer-events-none"
          aria-label="Next slide"
          data-no-advance
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Keyboard hint (shown briefly on first slide) */}
      {currentSlide === 0 && (
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 text-white/30 text-xs animate-pulse"
          style={{ animationDuration: '3s' }}
        >
          <span className="hidden sm:flex items-center gap-1">
            <kbd className="inline-flex h-5 items-center rounded border border-white/20 px-1.5 text-[10px] font-mono">←</kbd>
            <kbd className="inline-flex h-5 items-center rounded border border-white/20 px-1.5 text-[10px] font-mono">→</kbd>
            <span className="ml-1">to navigate</span>
          </span>
          <span className="sm:hidden">Tap or swipe to navigate</span>
        </div>
      )}

      {/* Ambient floating particles */}
      <FloatingParticles />

      {/* Share dialog — Dialog component provides its own overlay */}
      <ShareWrapped
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        slideType={currentSlideDef.type}
        captureRef={slideRef}
        userName={wrappedData.user.login}
      />
    </div>
  );
}

// ─── Floating Particles ──────────────────────────────────────────────────────

function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    interface Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      opacityDir: number;
    }

    const particles: Particle[] = [];
    const particleCount = Math.min(30, Math.floor((width * height) / 40000));

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.2 - 0.1,
        opacity: Math.random() * 0.3 + 0.05,
        opacityDir: Math.random() > 0.5 ? 0.001 : -0.001,
      });
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        p.opacity += p.opacityDir;

        if (p.opacity > 0.35 || p.opacity < 0.03) {
          p.opacityDir *= -1;
        }

        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
    />
  );
}
