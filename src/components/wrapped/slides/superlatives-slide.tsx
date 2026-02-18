'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type { WrappedSlideProps, SuperlativesData, Badge as BadgeType } from '@/lib/types';

interface SuperlativeCard {
  id: string;
  emoji: string;
  title: string;
  value: string;
  subtitle: string;
  gradient: string;
  delay: number;
}

function buildSuperlativeCards(superlatives: SuperlativesData): SuperlativeCard[] {
  const cards: SuperlativeCard[] = [];

  // Chronotype
  const chronotypeEmoji =
    superlatives.chronotype === 'night-owl'
      ? '🦉'
      : superlatives.chronotype === 'early-bird'
        ? '🐦'
        : '⚖️';
  const chronotypeTitle =
    superlatives.chronotype === 'night-owl'
      ? 'Night Owl'
      : superlatives.chronotype === 'early-bird'
        ? 'Early Bird'
        : 'Balanced Coder';
  const chronotypeSubtitle =
    superlatives.chronotype === 'night-owl'
      ? 'Most of your commits happen after dark'
      : superlatives.chronotype === 'early-bird'
        ? 'You ship code before the sun is up'
        : 'You code around the clock, evenly';

  cards.push({
    id: 'chronotype',
    emoji: chronotypeEmoji,
    title: chronotypeTitle,
    value: chronotypeTitle,
    subtitle: chronotypeSubtitle,
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    delay: 0,
  });

  // Weekend type
  const weekendEmoji =
    superlatives.weekendType === 'weekend-warrior'
      ? '🏋️'
      : superlatives.weekendType === 'weekday-warrior'
        ? '💼'
        : '🤝';
  const weekendTitle =
    superlatives.weekendType === 'weekend-warrior'
      ? 'Weekend Warrior'
      : superlatives.weekendType === 'weekday-warrior'
        ? 'Weekday Warrior'
        : 'Balanced Contributor';
  const weekendSubtitle =
    superlatives.weekendType === 'weekend-warrior'
      ? 'Saturdays and Sundays are your prime coding time'
      : superlatives.weekendType === 'weekday-warrior'
        ? 'You keep it professional — weekdays only'
        : 'You code any day that ends in Y';

  cards.push({
    id: 'weekend',
    emoji: weekendEmoji,
    title: weekendTitle,
    value: weekendTitle,
    subtitle: weekendSubtitle,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    delay: 0.15,
  });

  // Favorite commit word
  cards.push({
    id: 'favorite-word',
    emoji: '💬',
    title: 'Favorite Commit Word',
    value: `"${superlatives.favoriteCommitWord.word}"`,
    subtitle: `Used ${superlatives.favoriteCommitWord.count} times in your commit messages`,
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    delay: 0.3,
  });

  // Longest commit message
  cards.push({
    id: 'longest-message',
    emoji: '📜',
    title: 'Longest Commit Message',
    value: `${superlatives.longestCommitMessage.length} characters`,
    subtitle:
      superlatives.longestCommitMessage.message.length > 60
        ? `"${superlatives.longestCommitMessage.message.slice(0, 57)}..."`
        : `"${superlatives.longestCommitMessage.message}"`,
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    delay: 0.45,
  });

  // Shortest commit message
  cards.push({
    id: 'shortest-message',
    emoji: '⚡',
    title: 'Shortest Commit Message',
    value: `${superlatives.shortestCommitMessage.length} characters`,
    subtitle: `"${superlatives.shortestCommitMessage.message}"`,
    gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
    delay: 0.6,
  });

  // Commit mood
  const moodEmoji =
    superlatives.commitMood === 'positive'
      ? '😊'
      : superlatives.commitMood === 'negative'
        ? '😤'
        : '😐';
  const moodTitle =
    superlatives.commitMood === 'positive'
      ? 'Positive Vibes'
      : superlatives.commitMood === 'negative'
        ? 'Battle-Hardened'
        : 'Cool & Collected';

  cards.push({
    id: 'mood',
    emoji: moodEmoji,
    title: 'Commit Mood',
    value: moodTitle,
    subtitle: `${superlatives.fixCommits} fixes, ${superlatives.featureCommits} features, ${superlatives.refactorCommits} refactors`,
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    delay: 0.75,
  });

  return cards;
}

function AnimatedEmoji({ emoji, delay }: { emoji: string; delay: number }) {
  return (
    <motion.span
      className="inline-block text-4xl md:text-5xl"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay: delay + 0.2,
      }}
    >
      {emoji}
    </motion.span>
  );
}

function BadgeAward({ badge, index }: { badge: BadgeType; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 15,
        delay: 1.2 + index * 0.15,
      }}
    >
      <Badge
        variant="secondary"
        className="bg-white/10 border-white/20 text-white px-3 py-1.5 text-xs md:text-sm backdrop-blur-sm hover:bg-white/20 transition-colors cursor-default"
      >
        <span className="mr-1.5">{badge.icon}</span>
        {badge.name}
      </Badge>
    </motion.div>
  );
}

function FloatingParticle({ delay, x, y }: { delay: number; x: number; y: number }) {
  const emojis = ['✨', '🏆', '🎖️', '⭐', '🌟', '💫'];
  const emoji = emojis[Math.floor(Math.abs(x * y * 100) % emojis.length)];

  return (
    <motion.div
      className="absolute pointer-events-none text-lg md:text-xl opacity-40"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.4, 0.2, 0.4, 0],
        scale: [0, 1, 0.8, 1, 0],
        y: [0, -20, -10, -30, -50],
        rotate: [0, 10, -10, 15, 0],
      }}
      transition={{
        duration: 6,
        delay: delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {emoji}
    </motion.div>
  );
}

export function SuperlativesSlide({ data, isActive, animationState, onAnimationComplete }: WrappedSlideProps) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const superlatives = data.superlatives;
  const cards = buildSuperlativeCards(superlatives);

  useEffect(() => {
    if (isActive && animationState === 'active' && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isActive, animationState, hasAnimated]);

  useEffect(() => {
    if (animationState === 'entering') {
      const timeout = setTimeout(() => {
        onAnimationComplete?.();
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [animationState, onAnimationComplete]);

  // Reset animations when slide becomes hidden
  useEffect(() => {
    if (animationState === 'hidden') {
      setHasAnimated(false);
    }
  }, [animationState]);

  const shouldAnimate = isActive && (animationState === 'active' || animationState === 'entering');

  // Generate floating particles
  const particles = [
    { delay: 0.5, x: 5, y: 10 },
    { delay: 1.2, x: 90, y: 15 },
    { delay: 2.0, x: 15, y: 80 },
    { delay: 0.8, x: 85, y: 75 },
    { delay: 1.5, x: 50, y: 5 },
    { delay: 2.5, x: 8, y: 45 },
    { delay: 1.8, x: 92, y: 50 },
    { delay: 3.0, x: 45, y: 90 },
  ];

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full h-full overflow-hidden px-4 py-8 md:px-8 md:py-12"
    >
      {/* Floating particles */}
      {shouldAnimate &&
        particles.map((p, i) => (
          <FloatingParticle key={i} delay={p.delay} x={p.x} y={p.y} />
        ))}

      {/* Animated background orbs */}
      <motion.div
        className="absolute top-1/4 -left-20 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl"
        animate={
          shouldAnimate
            ? {
                x: [0, 30, -10, 20, 0],
                y: [0, -20, 10, -15, 0],
                scale: [1, 1.2, 0.9, 1.1, 1],
              }
            : {}
        }
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-20 w-72 h-72 rounded-full bg-fuchsia-500/10 blur-3xl"
        animate={
          shouldAnimate
            ? {
                x: [0, -25, 15, -20, 0],
                y: [0, 15, -25, 10, 0],
                scale: [1, 0.9, 1.15, 0.95, 1],
              }
            : {}
        }
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Title */}
      <motion.div
        className="relative z-10 text-center mb-6 md:mb-8"
        initial={{ opacity: 0, y: -30 }}
        animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <motion.div
          className="text-4xl md:text-5xl mb-2"
          initial={{ scale: 0, rotate: -180 }}
          animate={shouldAnimate ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -180 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        >
          🏆
        </motion.div>
        <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
          Your{' '}
          <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
            Superlatives
          </span>
        </h2>
        <p className="text-white/50 text-sm md:text-base mt-2 max-w-md mx-auto">
          The awards you never knew you deserved
        </p>
      </motion.div>

      {/* Superlative Cards Grid */}
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <AnimatePresence>
            {cards.map((card) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 40, scale: 0.85 }}
                animate={
                  shouldAnimate
                    ? { opacity: 1, y: 0, scale: 1 }
                    : { opacity: 0, y: 40, scale: 0.85 }
                }
                transition={{
                  type: 'spring',
                  stiffness: 180,
                  damping: 18,
                  delay: card.delay,
                }}
                whileHover={{ scale: 1.03, y: -2 }}
                className="group relative"
              >
                {/* Card glow effect */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`}
                />

                <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 md:p-5 overflow-hidden">
                  {/* Gradient accent bar */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`}
                  />

                  <div className="flex items-start gap-3">
                    <AnimatedEmoji emoji={card.emoji} delay={card.delay} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-0.5">
                        {card.title}
                      </p>
                      <p
                        className={`text-base md:text-lg font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent leading-tight`}
                      >
                        {card.value}
                      </p>
                      <p className="text-white/40 text-xs md:text-sm mt-1.5 leading-relaxed line-clamp-2">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Busiest Hour Callout */}
      <motion.div
        className="relative z-10 mt-5 md:mt-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={
          shouldAnimate
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 0.9 }
        }
        transition={{ delay: 1.0, duration: 0.5 }}
      >
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2 md:px-6 md:py-3">
          <span className="text-lg">⏰</span>
          <span className="text-white/70 text-xs md:text-sm">
            Busiest hour ever:{' '}
            <span className="text-white font-semibold">
              {superlatives.busiestHour.commits} commits
            </span>{' '}
            on {superlatives.busiestHour.date} at{' '}
            <span className="text-white font-semibold">
              {superlatives.busiestHour.hour.toString().padStart(2, '0')}:00
            </span>
          </span>
        </div>
      </motion.div>

      {/* Most Churned Repo */}
      <motion.div
        className="relative z-10 mt-3"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={
          shouldAnimate
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 0.9 }
        }
        transition={{ delay: 1.1, duration: 0.5 }}
      >
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2 md:px-6 md:py-3">
          <span className="text-lg">🔥</span>
          <span className="text-white/70 text-xs md:text-sm">
            Most churned repo:{' '}
            <span className="text-white font-semibold font-mono">
              {superlatives.mostChurnedRepo.repoName}
            </span>{' '}
            with{' '}
            <span className="text-white font-semibold">
              {superlatives.mostChurnedRepo.totalChanges.toLocaleString()}
            </span>{' '}
            total line changes
          </span>
        </div>
      </motion.div>

      {/* Merge percentage + Badges row */}
      <motion.div
        className="relative z-10 mt-4 md:mt-5 flex flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={shouldAnimate ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.15, duration: 0.5 }}
      >
        {/* Merge commit stat */}
        <div className="flex items-center gap-1.5 text-white/50 text-xs md:text-sm">
          <span>🔀</span>
          <span>
            {superlatives.mergePercentage.toFixed(1)}% of your commits were merges
          </span>
        </div>

        {/* Achievement Badges */}
        {superlatives.badges.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
            {superlatives.badges.map((badge, index) => (
              <BadgeAward key={badge.id} badge={badge} index={index} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Bottom decorative element */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/30 to-transparent pointer-events-none"
        initial={{ opacity: 0 }}
        animate={shouldAnimate ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
      />
    </div>
  );
}
