"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { HeroSectionProps } from "@/lib/types";

function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    color: string;
    pulseSpeed: number;
    pulseOffset: number;
    connections: number[];
  }>>([]);

  const colors = [
    "#7b2ff7",
    "#c084fc",
    "#60a5fa",
    "#34d399",
    "#f97316",
    "#e94560",
    "#3178c6",
    "#f1e05a",
  ];

  const initParticles = useCallback((width: number, height: number) => {
    const count = Math.min(Math.floor((width * height) / 12000), 80);
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.3 - 0.1,
      size: Math.random() * 3 + 1.5,
      opacity: Math.random() * 0.5 + 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      pulseSpeed: Math.random() * 0.02 + 0.005,
      pulseOffset: Math.random() * Math.PI * 2,
      connections: [],
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      if (particlesRef.current.length === 0) {
        initParticles(rect.width, rect.height);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    let frameCount = 0;

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);
      frameCount++;

      const particles = particlesRef.current;

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const opacity = (1 - dist / 120) * 0.15;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(123, 47, 247, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        const pulse = Math.sin(frameCount * p.pulseSpeed + p.pulseOffset);
        const currentSize = p.size + pulse * 0.8;
        const currentOpacity = p.opacity + pulse * 0.15;

        // Glow effect
        const gradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, currentSize * 3
        );
        gradient.addColorStop(0, p.color + Math.round(currentOpacity * 255).toString(16).padStart(2, "0"));
        gradient.addColorStop(0.5, p.color + Math.round(currentOpacity * 100).toString(16).padStart(2, "0"));
        gradient.addColorStop(1, p.color + "00");

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, currentSize * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentOpacity;
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

function CommitNode({ delay, x, y, size }: { delay: number; x: string; y: string; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        background: `radial-gradient(circle, rgba(123, 47, 247, 0.8) 0%, rgba(192, 132, 252, 0.3) 60%, transparent 100%)`,
        boxShadow: `0 0 ${size * 2}px rgba(123, 47, 247, 0.4)`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1.2, 1],
        opacity: [0, 0.8, 0.5],
        y: [0, -10, 0, 10, 0],
      }}
      transition={{
        delay,
        duration: 4,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
      }}
    />
  );
}

export function HeroSection({
  headline = "Your Git Story, Beautifully Told",
  subheadline = "Transform your GitHub activity into stunning visualizations, Spotify Wrapped-style stories, and mesmerizing Gource animations.",
  ctaText = "Get Started",
  ctaLink = "/connect",
}: Partial<HeroSectionProps>) {
  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(123, 47, 247, 0.25) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 50%, rgba(49, 120, 198, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 60% 50% at 20% 80%, rgba(233, 69, 96, 0.1) 0%, transparent 50%),
            linear-gradient(180deg, #050510 0%, #0a0a1a 40%, #0f0f23 100%)
          `,
        }}
      />

      {/* CSS animated gradient overlay */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `linear-gradient(
            135deg,
            rgba(123, 47, 247, 0.1) 0%,
            rgba(49, 120, 198, 0.05) 25%,
            rgba(192, 132, 252, 0.08) 50%,
            rgba(233, 69, 96, 0.05) 75%,
            rgba(123, 47, 247, 0.1) 100%
          )`,
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
        }}
      />

      {/* Floating commit particles (Canvas) */}
      <FloatingParticles />

      {/* Floating commit nodes (DOM) */}
      <CommitNode delay={0} x="10%" y="20%" size={12} />
      <CommitNode delay={0.5} x="85%" y="15%" size={8} />
      <CommitNode delay={1} x="70%" y="70%" size={14} />
      <CommitNode delay={1.5} x="15%" y="75%" size={10} />
      <CommitNode delay={2} x="50%" y="10%" size={6} />
      <CommitNode delay={0.8} x="90%" y="45%" size={9} />
      <CommitNode delay={1.2} x="5%" y="50%" size={11} />
      <CommitNode delay={1.8} x="35%" y="85%" size={7} />
      <CommitNode delay={0.3} x="60%" y="30%" size={5} />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(123, 47, 247, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(123, 47, 247, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-purple-500/20 bg-purple-500/10 text-purple-300 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            Your Git history, visualized beautifully
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 leading-[1.05]"
        >
          <span className="block text-white/90">Your</span>
          <span
            className="block bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, #7b2ff7 0%, #c084fc 30%, #60a5fa 60%, #34d399 100%)",
              backgroundSize: "200% 200%",
              animation: "gradientText 6s ease infinite",
            }}
          >
            Git Story
          </span>
          <span className="block text-white/90">Beautifully Told</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg sm:text-xl md:text-2xl text-white/50 max-w-3xl mx-auto mb-10 leading-relaxed font-light"
        >
          {subheadline}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href={ctaLink}>
            <Button
              size="lg"
              className="relative px-8 py-6 text-lg font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white shadow-2xl shadow-purple-500/25 transition-all duration-300 hover:shadow-purple-500/40 hover:scale-105 border-0"
            >
              <span className="relative z-10 flex items-center gap-2">
                {ctaText}
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </span>
            </Button>
          </Link>

          <Link href="#features">
            <Button
              variant="ghost"
              size="lg"
              className="px-8 py-6 text-lg font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300 border border-white/10 hover:border-white/20"
            >
              See What&apos;s Possible
            </Button>
          </Link>
        </motion.div>

      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-xs text-white/30 uppercase tracking-widest">
            Scroll
          </span>
          <svg
            className="w-5 h-5 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </motion.div>
      </motion.div>

      {/* CSS Keyframes */}
      <style jsx global>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes gradientText {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </section>
  );
}
