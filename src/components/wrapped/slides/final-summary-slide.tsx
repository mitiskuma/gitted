'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WrappedSlideProps } from '@/lib/types';

// Confetti particle type
interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  opacity: number;
  shape: 'square' | 'circle' | 'triangle';
}

const CONFETTI_COLORS = [
  '#7b2ff7',
  '#c084fc',
  '#f472b6',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#fb923c',
  '#e94560',
  '#3178c6',
  '#f1e05a',
];

function createConfettiParticles(count: number): ConfettiParticle[] {
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i++) {
    const shapes: ConfettiParticle['shape'][] = ['square', 'circle', 'triangle'];
    particles.push({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.random() * 8 + 4,
      opacity: 1,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    });
  }
  return particles;
}

function AnimatedCounter({
  target,
  duration = 2000,
  delay = 0,
  suffix = '',
  prefix = '',
}: {
  target: number;
  duration?: number;
  delay?: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(delayTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;

    const startTime = performance.now();
    let rafId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [started, target, duration]);

  return (
    <span>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    particlesRef.current = createConfettiParticles(150);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      particlesRef.current.forEach((p) => {
        p.x += p.vx * 0.3;
        p.y += p.vy * 0.5;
        p.vy += 0.02;
        p.rotation += p.rotationSpeed;

        if (p.y > 110) {
          p.opacity = Math.max(0, p.opacity - 0.02);
        }

        const px = (p.x / 100) * window.innerWidth;
        const py = (p.y / 100) * window.innerHeight;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'square') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });

      const allDone = particlesRef.current.every((p) => p.opacity <= 0);
      if (!allDone) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    // Small delay before confetti starts
    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 800);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
    />
  );
}

export function FinalSummarySlide({ data, isActive, animationState, onAnimationComplete }: WrappedSlideProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && animationState === 'active') {
      const timer = setTimeout(() => setShowConfetti(true), 400);
      return () => clearTimeout(timer);
    }
    setShowConfetti(false);
  }, [isActive, animationState]);

  useEffect(() => {
    if (animationState === 'entering') {
      const timer = setTimeout(() => {
        onAnimationComplete?.();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [animationState, onAnimationComplete]);

  const topLanguage = data.languageEvolution.length > 0
    ? Object.entries(data.languageEvolution[data.languageEvolution.length - 1]?.languages ?? {})
        .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'TypeScript'
    : 'TypeScript';

  const totalCommits = data.totals.totalCommits;
  const totalRepos = data.totals.totalRepos;
  const activeDays = data.totals.activeDays;

  const stats = [
    {
      label: 'Total Commits',
      value: totalCommits,
      icon: '🔥',
      color: 'from-orange-400 to-red-500',
    },
    {
      label: 'Repos Contributed To',
      value: totalRepos,
      icon: '📦',
      color: 'from-blue-400 to-indigo-500',
    },
    {
      label: 'Days Active',
      value: activeDays,
      icon: '📅',
      color: 'from-green-400 to-emerald-500',
    },
    {
      label: 'Top Language',
      value: topLanguage,
      icon: '💻',
      color: 'from-purple-400 to-violet-500',
      isText: true,
    },
  ];

  const [shareCopied, setShareCopied] = useState(false);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gitted.dev';

  const handleShareClick = useCallback(() => {
    const shareText = `My ${data.wrappedYear} Git Wrapped:\n\n${totalCommits.toLocaleString()} commits\n${totalRepos} repos\n${activeDays} active days\nTop language: ${topLanguage}\n\nPowered by gitted`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `My ${data.wrappedYear} Git Wrapped`,
        text: shareText,
        url: siteUrl,
      }).catch(() => {
        // Fallback to clipboard
        navigator.clipboard?.writeText(shareText).then(() => {
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2500);
        });
      });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      });
    }
  }, [data.wrappedYear, totalCommits, totalRepos, activeDays, topLanguage, siteUrl]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadClick = useCallback(async () => {
    if (!cardRef.current || isDownloading) return;

    setIsDownloading(true);
    try {
      const { captureElementAsDataUrl } = await import('@/lib/capture-utils');
      const dataUrl = await captureElementAsDataUrl(cardRef.current);

      const link = document.createElement('a');
      link.download = `gitted-wrapped-${data.wrappedYear}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    } catch {
      console.warn('Could not generate image for download');
    } finally {
      setIsDownloading(false);
    }
  }, [data.wrappedYear, isDownloading]);

  const isVisible = animationState === 'active' || animationState === 'entering';

  return (
    <>
      <ConfettiCanvas active={showConfetti} />

      <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-4 py-8">
        {/* Animated background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #7b2ff7, transparent)' }}
            animate={isVisible ? { scale: [1, 1.3, 1], x: [0, 30, 0], y: [0, 20, 0] } : {}}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #c084fc, transparent)' }}
            animate={isVisible ? { scale: [1.2, 1, 1.2], x: [0, -20, 0], y: [0, -30, 0] } : {}}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, #e94560, transparent)' }}
            animate={isVisible ? { scale: [1, 1.5, 1] } : {}}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex w-full max-w-lg flex-col items-center gap-6"
            >
              {/* Year Badge */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Badge
                  variant="outline"
                  className="border-purple-400/40 bg-purple-500/10 px-4 py-1.5 text-sm font-medium text-purple-300 backdrop-blur-sm"
                >
                  ✨ Year in Review
                </Badge>
              </motion.div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-center text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl md:text-5xl"
              >
                Your {data.wrappedYear} Wrapped
              </motion.h1>

              {/* Main Stats Card */}
              <motion.div
                ref={cardRef}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a2e]/90 via-[#2d1b69]/80 to-[#7b2ff7]/30 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
                style={{
                  boxShadow:
                    '0 0 60px rgba(123, 47, 247, 0.15), 0 0 120px rgba(192, 132, 252, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                {/* Avatar and username */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="mb-6 flex items-center gap-3"
                >
                  {data.user.avatarUrl && (
                    <div className="relative">
                      <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-60 blur-sm" />
                      <img
                        src={data.user.avatarUrl}
                        alt={data.user.login}
                        className="relative h-12 w-12 rounded-full border-2 border-white/20 sm:h-14 sm:w-14"
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-bold text-white sm:text-xl">
                      @{data.user.login}
                    </p>
                    <p className="text-xs text-purple-300/70 sm:text-sm">
                      {data.dateRange.start.slice(0, 10)} — {data.dateRange.end.slice(0, 10)}
                    </p>
                  </div>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {stats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        delay: 0.9 + index * 0.15,
                        duration: 0.5,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/5 p-3 transition-colors hover:bg-white/10 sm:p-4"
                    >
                      {/* Background gradient effect on hover */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 transition-opacity duration-300 group-hover:opacity-10`}
                      />

                      <div className="relative">
                        <span className="text-xl sm:text-2xl">{stat.icon}</span>
                        <div className="mt-1.5">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50 sm:text-xs">
                            {stat.label}
                          </p>
                          {stat.isText ? (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 1.5 + index * 0.1 }}
                              className="mt-0.5 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-lg font-extrabold text-transparent sm:text-2xl"
                            >
                              {stat.value}
                            </motion.p>
                          ) : (
                            <p className="mt-0.5 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-lg font-extrabold text-transparent sm:text-2xl">
                              <AnimatedCounter
                                target={stat.value as number}
                                duration={2200}
                                delay={900 + index * 150}
                              />
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Gitted branding */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2 }}
                  className="mt-5 flex items-center justify-center gap-2"
                >
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <span className="text-[10px] font-medium tracking-[0.2em] text-white/30 sm:text-xs">
                    GITTED · GIT WRAPPED
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </motion.div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.8, duration: 0.5 }}
                className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center"
              >
                <Button
                  onClick={handleShareClick}
                  size="lg"
                  className="relative overflow-hidden rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-8 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30"
                >
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                  <span className="relative flex items-center gap-2">
                    {shareCopied ? (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                          <polyline points="16 6 12 2 8 6" />
                          <line x1="12" x2="12" y1="2" y2="15" />
                        </svg>
                        Share Your Wrapped
                      </>
                    )}
                  </span>
                </Button>

                <Button
                  onClick={handleDownloadClick}
                  size="lg"
                  variant="outline"
                  disabled={isDownloading}
                  className="rounded-full border-white/15 bg-white/5 px-8 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/25 disabled:opacity-60"
                >
                  <span className="flex items-center gap-2">
                    {isDownloading ? (
                      <>
                        <svg className="h-[18px] w-[18px] animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" x2="12" y1="15" y2="3" />
                        </svg>
                        Download Image
                      </>
                    )}
                  </span>
                </Button>
              </motion.div>

              {/* Powered by */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.2 }}
                className="text-center text-[10px] text-white/25 sm:text-xs"
              >
                Powered by{' '}
                <span className="font-semibold text-white/40">gitted</span> · Built
                with Next.js & TypeScript
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
