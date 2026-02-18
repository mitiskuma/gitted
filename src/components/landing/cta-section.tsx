'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export function CtaSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24 sm:py-32"
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]" />

      {/* Mesh gradient overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(123, 47, 247, 0.3), transparent), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(233, 69, 96, 0.2), transparent), radial-gradient(ellipse 50% 50% at 20% 80%, rgba(49, 120, 198, 0.2), transparent)',
        }}
      />

      {/* Animated grid lines */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating orbs */}
      <motion.div
        className="absolute top-20 left-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[100px]"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 15, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-20 right-1/4 h-64 w-64 rounded-full bg-pink-500/10 blur-[100px]"
        animate={{
          x: [0, -25, 20, 0],
          y: [0, 15, -25, 0],
          scale: [1, 0.95, 1.1, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main CTA */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="relative mx-auto max-w-3xl text-center"
        >
          {/* Decorative badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Powered by GitHub API & AI</span>
          </motion.div>

          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ready to See{' '}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Your Git Story
            </span>
            ?
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Connect your GitHub, select your repos, and generate beautiful
            visualizations of your coding journey — your{' '}
            <span className="text-slate-300">Wrapped</span>,{' '}
            <span className="text-slate-300">Story</span>, and{' '}
            <span className="text-slate-300">Gource</span> — all in under a minute.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link href="/connect">
              <Button
                size="lg"
                className="group relative h-14 min-w-[240px] overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 px-8 text-base font-semibold text-white shadow-2xl shadow-purple-900/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-purple-900/50"
              >
                {/* Shimmer effect */}
                <span className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="relative flex items-center gap-2">
                  Start Your Git Story
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Button>
            </Link>

            <p className="text-sm text-slate-500">
              Free • No credit card required • MIT licensed
            </p>
          </motion.div>

        </motion.div>
      </div>

      {/* Bottom fade to match footer transition */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </section>
  );
}
