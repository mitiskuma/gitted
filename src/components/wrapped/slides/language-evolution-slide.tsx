'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type WrappedSlideProps,
  type LanguageEvolutionEntry,
  GITHUB_LANGUAGE_COLORS,
} from '@/lib/types';

interface BubbleData {
  name: string;
  percentage: number;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  targetRadius: number;
  opacity: number;
  vx: number;
  vy: number;
}

interface TimelinePoint {
  period: string;
  languages: Record<string, number>;
}

const LANGUAGE_COLORS: Record<string, string> = {
  ...GITHUB_LANGUAGE_COLORS,
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  CSS: '#663399',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  HTML: '#e34c26',
  Shell: '#89e051',
  Ruby: '#701516',
};

function getLanguageColor(lang: string): string {
  return LANGUAGE_COLORS[lang] || GITHUB_LANGUAGE_COLORS[lang] || '#94a3b8';
}

export function LanguageEvolutionSlide({ data, isActive, animationState, onAnimationComplete }: WrappedSlideProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<BubbleData[]>([]);
  const animationFrameRef = useRef<number>(0);
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(-1);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [topLanguages, setTopLanguages] = useState<{ name: string; percentage: number; color: string }[]>([]);
  const periodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const evolution: LanguageEvolutionEntry[] = data.languageEvolution?.length
    ? data.languageEvolution
    : generateMockEvolution();

  function generateMockEvolution(): LanguageEvolutionEntry[] {
    return [
      { period: 'Jan', date: '2024-01-01', languages: { TypeScript: 55, JavaScript: 20, CSS: 12, Python: 8, Shell: 5 } },
      { period: 'Feb', date: '2024-02-01', languages: { TypeScript: 58, JavaScript: 18, CSS: 11, Python: 9, Shell: 4 } },
      { period: 'Mar', date: '2024-03-01', languages: { TypeScript: 52, JavaScript: 15, CSS: 10, Python: 14, Rust: 5, Shell: 4 } },
      { period: 'Apr', date: '2024-04-01', languages: { TypeScript: 48, Python: 20, JavaScript: 14, CSS: 9, Rust: 6, Shell: 3 } },
      { period: 'May', date: '2024-05-01', languages: { TypeScript: 50, Python: 18, JavaScript: 12, Rust: 10, CSS: 7, Shell: 3 } },
      { period: 'Jun', date: '2024-06-01', languages: { TypeScript: 45, Rust: 18, Python: 16, JavaScript: 10, Go: 6, CSS: 5 } },
      { period: 'Jul', date: '2024-07-01', languages: { TypeScript: 42, Rust: 22, Python: 15, Go: 10, JavaScript: 7, CSS: 4 } },
      { period: 'Aug', date: '2024-08-01', languages: { TypeScript: 44, Rust: 20, Python: 14, Go: 12, JavaScript: 6, CSS: 4 } },
      { period: 'Sep', date: '2024-09-01', languages: { TypeScript: 50, Go: 15, Rust: 15, Python: 10, JavaScript: 6, CSS: 4 } },
      { period: 'Oct', date: '2024-10-01', languages: { TypeScript: 55, Go: 14, Python: 12, Rust: 10, JavaScript: 5, CSS: 4 } },
      { period: 'Nov', date: '2024-11-01', languages: { TypeScript: 58, Python: 14, Go: 12, Rust: 8, JavaScript: 5, CSS: 3 } },
      { period: 'Dec', date: '2024-12-01', languages: { TypeScript: 60, Python: 13, Go: 10, Rust: 8, JavaScript: 5, CSS: 4 } },
    ];
  }

  // Compute top languages from final period
  useEffect(() => {
    if (evolution.length === 0) return;
    const last = evolution[evolution.length - 1];
    const sorted = Object.entries(last.languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, percentage]) => ({
        name,
        percentage,
        color: getLanguageColor(name),
      }));
    setTopLanguages(sorted);
  }, []);

  // Animate period progression
  useEffect(() => {
    if (!isActive || animationState !== 'active') {
      setIsRevealed(false);
      setCurrentPeriodIndex(-1);
      setShowTimeline(false);
      return;
    }

    const revealTimer = setTimeout(() => {
      setIsRevealed(true);
    }, 300);

    const timelineTimer = setTimeout(() => {
      setShowTimeline(true);
    }, 800);

    const startTimer = setTimeout(() => {
      setCurrentPeriodIndex(0);
    }, 1200);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(timelineTimer);
      clearTimeout(startTimer);
    };
  }, [isActive, animationState]);

  // Auto-advance periods
  useEffect(() => {
    if (currentPeriodIndex < 0 || currentPeriodIndex >= evolution.length - 1) return;

    periodTimerRef.current = setTimeout(() => {
      setCurrentPeriodIndex((prev) => prev + 1);
    }, 500);

    return () => {
      if (periodTimerRef.current) clearTimeout(periodTimerRef.current);
    };
  }, [currentPeriodIndex, evolution.length]);

  // Notify animation complete
  useEffect(() => {
    if (currentPeriodIndex === evolution.length - 1 && onAnimationComplete) {
      const timer = setTimeout(onAnimationComplete, 800);
      return () => clearTimeout(timer);
    }
  }, [currentPeriodIndex, evolution.length, onAnimationComplete]);

  // Canvas bubble visualization
  const updateBubbles = useCallback((periodData: Record<string, number>, canvasWidth: number, canvasHeight: number) => {
    const entries = Object.entries(periodData).sort((a, b) => b[1] - a[1]);
    const maxRadius = Math.min(canvasWidth, canvasHeight) * 0.18;
    const minRadius = 12;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const existingMap = new Map(bubblesRef.current.map((b) => [b.name, b]));
    const newBubbles: BubbleData[] = [];

    entries.forEach(([name, pct], i) => {
      const radius = Math.max(minRadius, (pct / 100) * maxRadius * 2);
      const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
      const spread = Math.min(canvasWidth, canvasHeight) * 0.25;
      const targetX = centerX + Math.cos(angle) * spread * (0.5 + (i * 0.1));
      const targetY = centerY + Math.sin(angle) * spread * (0.5 + (i * 0.1));

      const existing = existingMap.get(name);
      if (existing) {
        existing.targetRadius = radius;
        existing.targetX = targetX;
        existing.targetY = targetY;
        existing.percentage = pct;
        existing.opacity = 1;
        newBubbles.push(existing);
      } else {
        newBubbles.push({
          name,
          percentage: pct,
          color: getLanguageColor(name),
          x: centerX + (Math.random() - 0.5) * 50,
          y: centerY + (Math.random() - 0.5) * 50,
          targetX,
          targetY,
          radius: 0,
          targetRadius: radius,
          opacity: 0,
          vx: 0,
          vy: 0,
        });
      }
    });

    // Fade out removed languages
    bubblesRef.current.forEach((b) => {
      if (!entries.find(([name]) => name === b.name)) {
        b.targetRadius = 0;
        b.opacity = Math.max(0, b.opacity - 0.05);
        if (b.opacity > 0.01) {
          newBubbles.push(b);
        }
      }
    });

    bubblesRef.current = newBubbles;
  }, []);

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      // Update and resolve collisions
      bubblesRef.current.forEach((bubble) => {
        const ease = 0.08;
        bubble.x += (bubble.targetX - bubble.x) * ease;
        bubble.y += (bubble.targetY - bubble.y) * ease;
        bubble.radius += (bubble.targetRadius - bubble.radius) * ease;
        bubble.opacity = Math.min(1, bubble.opacity + 0.03);
      });

      // Simple collision resolution
      for (let i = 0; i < bubblesRef.current.length; i++) {
        for (let j = i + 1; j < bubblesRef.current.length; j++) {
          const a = bubblesRef.current[i];
          const b = bubblesRef.current[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.radius + b.radius + 4;
          if (dist < minDist && dist > 0) {
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * overlap * 0.3;
            a.y -= ny * overlap * 0.3;
            b.x += nx * overlap * 0.3;
            b.y += ny * overlap * 0.3;
          }
        }
      }

      // Draw bubbles
      bubblesRef.current.forEach((bubble) => {
        if (bubble.radius < 1) return;

        // Glow
        const gradient = ctx.createRadialGradient(
          bubble.x, bubble.y, bubble.radius * 0.3,
          bubble.x, bubble.y, bubble.radius * 1.5
        );
        gradient.addColorStop(0, `${bubble.color}40`);
        gradient.addColorStop(1, `${bubble.color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Main bubble
        ctx.globalAlpha = bubble.opacity;
        const bgGradient = ctx.createRadialGradient(
          bubble.x - bubble.radius * 0.3, bubble.y - bubble.radius * 0.3, 0,
          bubble.x, bubble.y, bubble.radius
        );
        bgGradient.addColorStop(0, `${bubble.color}ee`);
        bgGradient.addColorStop(1, `${bubble.color}aa`);
        ctx.fillStyle = bgGradient;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = `${bubble.color}`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Text
        if (bubble.radius > 20) {
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const nameFontSize = Math.max(10, Math.min(bubble.radius * 0.35, 18));
          ctx.font = `700 ${nameFontSize}px system-ui, -apple-system, sans-serif`;
          ctx.fillText(bubble.name, bubble.x, bubble.y - nameFontSize * 0.4);

          const pctFontSize = Math.max(8, Math.min(bubble.radius * 0.28, 14));
          ctx.font = `500 ${pctFontSize}px system-ui, -apple-system, sans-serif`;
          ctx.fillStyle = '#ffffffcc';
          ctx.fillText(`${Math.round(bubble.percentage)}%`, bubble.x, bubble.y + pctFontSize * 0.8);
        }

        ctx.globalAlpha = 1;
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isActive]);

  // Update bubbles when period changes
  useEffect(() => {
    if (currentPeriodIndex < 0 || currentPeriodIndex >= evolution.length) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    updateBubbles(evolution[currentPeriodIndex].languages, rect.width, rect.height);
  }, [currentPeriodIndex, evolution, updateBubbles]);

  const currentPeriod = currentPeriodIndex >= 0 && currentPeriodIndex < evolution.length
    ? evolution[currentPeriodIndex]
    : null;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-8">
      {/* Background floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 4 + Math.random() * 6,
              height: 4 + Math.random() * 6,
              background: Object.values(LANGUAGE_COLORS)[i % Object.values(LANGUAGE_COLORS).length],
              opacity: 0.15,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.1, 0.25, 0.1],
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Title */}
      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative z-10 mb-2 text-center"
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-300/80">
              Language Evolution
            </h2>
            <h1 className="mt-1 text-3xl font-black sm:text-4xl md:text-5xl">
              <span className="bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
                Your Code DNA
              </span>
            </h1>
            <p className="mt-2 text-sm text-white/50 sm:text-base">
              Watch your language preferences evolve through {data.wrappedYear}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Period Indicator */}
      <AnimatePresence mode="wait">
        {currentPeriod && (
          <motion.div
            key={currentPeriod.period}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 mb-4"
          >
            <span className="rounded-full border border-white/10 bg-white/5 px-5 py-1.5 text-lg font-bold text-white backdrop-blur-md sm:text-xl">
              {currentPeriod.period} {data.wrappedYear}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas Bubble Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: isRevealed ? 1 : 0, scale: isRevealed ? 1 : 0.9 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="relative z-10 w-full max-w-lg flex-1 sm:max-w-xl md:max-w-2xl"
        style={{ minHeight: '250px', maxHeight: '400px' }}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ display: 'block' }}
        />
      </motion.div>

      {/* Timeline scrubber */}
      <AnimatePresence>
        {showTimeline && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 mt-4 w-full max-w-lg px-2 sm:max-w-xl md:max-w-2xl"
          >
            <div className="flex items-center justify-between gap-1">
              {evolution.map((entry, i) => (
                <button
                  key={`${entry.period}-${i}`}
                  onClick={() => setCurrentPeriodIndex(i)}
                  className="group flex flex-col items-center gap-1"
                >
                  <motion.div
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === currentPeriodIndex ? 14 : 8,
                      height: i === currentPeriodIndex ? 14 : 8,
                      background:
                        i <= currentPeriodIndex
                          ? 'linear-gradient(135deg, #ec4899, #a855f7)'
                          : 'rgba(255,255,255,0.15)',
                      boxShadow:
                        i === currentPeriodIndex
                          ? '0 0 12px rgba(236, 72, 153, 0.6)'
                          : 'none',
                    }}
                    animate={{
                      scale: i === currentPeriodIndex ? [1, 1.2, 1] : 1,
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: i === currentPeriodIndex ? Infinity : 0,
                      repeatDelay: 1,
                    }}
                  />
                  <span
                    className="text-[9px] font-medium transition-all sm:text-[10px]"
                    style={{
                      color: i === currentPeriodIndex ? '#f9a8d4' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {entry.period.slice(0, 3)}
                  </span>
                </button>
              ))}
            </div>
            {/* Connecting line */}
            <div className="absolute left-4 right-4 top-[7px] -z-10 h-[2px] bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                animate={{
                  width: currentPeriodIndex >= 0
                    ? `${(currentPeriodIndex / (evolution.length - 1)) * 100}%`
                    : '0%',
                }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Language legend cards */}
      <AnimatePresence>
        {isRevealed && currentPeriodIndex >= evolution.length - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3"
          >
            {topLanguages.slice(0, 5).map((lang, i) => (
              <motion.div
                key={lang.name}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm"
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: lang.color,
                    boxShadow: `0 0 8px ${lang.color}80`,
                  }}
                />
                <span className="text-xs font-semibold text-white/90">{lang.name}</span>
                <span className="text-[10px] font-medium text-white/50">{lang.percentage}%</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stacked area chart visualization (bottom) */}
      <AnimatePresence>
        {showTimeline && currentPeriodIndex >= evolution.length - 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 80 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="relative z-10 mt-4 w-full max-w-lg overflow-hidden sm:max-w-xl md:max-w-2xl"
          >
            <StackedAreaMini data={evolution} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mini stacked area chart component
function StackedAreaMini({ data }: { data: LanguageEvolutionEntry[] }) {
  const allLanguages = new Set<string>();
  data.forEach((entry) => {
    Object.keys(entry.languages).forEach((lang) => allLanguages.add(lang));
  });

  const sortedLangs = Array.from(allLanguages).sort((a, b) => {
    const lastEntry = data[data.length - 1].languages;
    return (lastEntry[b] || 0) - (lastEntry[a] || 0);
  });

  const topLangs = sortedLangs.slice(0, 6);
  const width = 100;
  const height = 60;
  const stepX = width / (data.length - 1);

  const paths: { lang: string; d: string; color: string }[] = [];

  topLangs.forEach((lang) => {
    const langIndex = topLangs.indexOf(lang);

    let pathD = `M 0 ${height}`;

    // Top edge
    data.forEach((entry, i) => {
      const x = i * stepX;
      let yBottom = 0;
      for (let k = 0; k < langIndex; k++) {
        yBottom += (entry.languages[topLangs[k]] || 0) / 100;
      }
      const yTop = yBottom + (entry.languages[lang] || 0) / 100;
      const y = height - yTop * height;
      pathD += ` L ${x} ${y}`;
    });

    // Bottom edge (reverse)
    for (let i = data.length - 1; i >= 0; i--) {
      const x = i * stepX;
      let yBottom = 0;
      for (let k = 0; k < langIndex; k++) {
        yBottom += (data[i].languages[topLangs[k]] || 0) / 100;
      }
      const y = height - yBottom * height;
      pathD += ` L ${x} ${y}`;
    }

    pathD += ' Z';
    paths.push({ lang, d: pathD, color: getLanguageColor(lang) });
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full rounded-lg"
      style={{ opacity: 0.7 }}
    >
      <defs>
        {paths.map(({ lang, color }) => (
          <linearGradient key={lang} id={`area-${lang}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={0.2} />
          </linearGradient>
        ))}
      </defs>
      {paths.reverse().map(({ lang, d }) => (
        <motion.path
          key={lang}
          d={d}
          fill={`url(#area-${lang})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
      ))}
    </svg>
  );
}
