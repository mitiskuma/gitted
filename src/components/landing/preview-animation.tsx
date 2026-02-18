"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

// Mini Gource tree node for the visualization
interface TreeNode {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  color: string;
  opacity: number;
  label: string;
  children: TreeNode[];
  depth: number;
}

// Beam animation between contributor and file
interface Beam {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  progress: number;
  opacity: number;
}

function MiniGourceVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.3 });
  const nodesRef = useRef<TreeNode[]>([]);
  const beamsRef = useRef<Beam[]>([]);
  const frameCountRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 400;
    const height = 300;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const colors = [
      "#3178c6", // TypeScript blue
      "#f1e05a", // JavaScript yellow
      "#e34c26", // HTML red
      "#563d7c", // CSS purple
      "#34d399", // green
      "#f97316", // orange
      "#a78bfa", // violet
      "#fb923c", // amber
    ];

    const fileLabels = [
      "src/",
      "api/",
      "lib/",
      "hooks/",
      "utils/",
      "components/",
      "pages/",
      "styles/",
      "public/",
      "config/",
    ];

    // Build a random tree
    function buildTree(
      centerX: number,
      centerY: number,
      depth: number = 0,
      maxDepth: number = 3
    ): TreeNode {
      const angle = Math.random() * Math.PI * 2;
      const dist = depth === 0 ? 0 : 30 + Math.random() * 40;
      const tx = centerX + Math.cos(angle) * dist;
      const ty = centerY + Math.sin(angle) * dist;

      const node: TreeNode = {
        x: centerX,
        y: centerY,
        targetX: tx,
        targetY: ty,
        radius: depth === 0 ? 8 : 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0,
        label: fileLabels[Math.floor(Math.random() * fileLabels.length)],
        children: [],
        depth,
      };

      if (depth < maxDepth) {
        const childCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < childCount; i++) {
          node.children.push(buildTree(tx, ty, depth + 1, maxDepth));
        }
      }

      return node;
    }

    function flattenTree(node: TreeNode): TreeNode[] {
      let result: TreeNode[] = [node];
      for (const child of node.children) {
        result = result.concat(flattenTree(child));
      }
      return result;
    }

    // Initialize
    const rootNode = buildTree(width / 2, height / 2, 0, 3);
    nodesRef.current = flattenTree(rootNode);

    function addBeam() {
      const nodes = nodesRef.current;
      if (nodes.length < 2) return;

      const target = nodes[Math.floor(Math.random() * nodes.length)];
      const startAngle = Math.random() * Math.PI * 2;
      const startDist = 120 + Math.random() * 60;

      beamsRef.current.push({
        fromX: width / 2 + Math.cos(startAngle) * startDist,
        fromY: height / 2 + Math.sin(startAngle) * startDist,
        toX: target.targetX,
        toY: target.targetY,
        color: target.color,
        progress: 0,
        opacity: 0.8,
      });
    }

    function draw() {
      if (!ctx) return;
      frameCountRef.current++;

      ctx.clearRect(0, 0, width, height);

      // Background glow
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        180
      );
      gradient.addColorStop(0, "rgba(99, 51, 153, 0.08)");
      gradient.addColorStop(0.5, "rgba(49, 120, 198, 0.04)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const nodes = nodesRef.current;

      // Animate nodes appearing
      for (const node of nodes) {
        if (node.opacity < 1) {
          node.opacity = Math.min(1, node.opacity + 0.02);
        }
        // Gentle float
        node.x += (node.targetX - node.x) * 0.05;
        node.y += (node.targetY - node.y) * 0.05;
        node.targetX +=
          Math.sin(frameCountRef.current * 0.01 + node.depth) * 0.1;
        node.targetY +=
          Math.cos(frameCountRef.current * 0.012 + node.depth * 0.5) * 0.08;
      }

      // Draw edges
      for (const node of nodes) {
        for (const child of node.children) {
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(child.x, child.y);
          ctx.strokeStyle = `rgba(100, 120, 180, ${0.15 * Math.min(node.opacity, child.opacity)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Draw beams
      const beams = beamsRef.current;
      for (let i = beams.length - 1; i >= 0; i--) {
        const beam = beams[i];
        beam.progress += 0.03;
        beam.opacity = Math.max(0, beam.opacity - 0.01);

        if (beam.progress >= 1 || beam.opacity <= 0) {
          beams.splice(i, 1);
          continue;
        }

        const currentX =
          beam.fromX + (beam.toX - beam.fromX) * beam.progress;
        const currentY =
          beam.fromY + (beam.toY - beam.fromY) * beam.progress;

        ctx.beginPath();
        ctx.moveTo(beam.fromX, beam.fromY);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = beam.color + Math.floor(beam.opacity * 255).toString(16).padStart(2, "0");
        ctx.lineWidth = 2;
        ctx.stroke();

        // Head particle
        ctx.beginPath();
        ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
        ctx.fillStyle = beam.color;
        ctx.fill();
      }

      // Draw nodes with glow
      for (const node of nodes) {
        if (node.opacity <= 0) continue;

        // Glow
        const glow = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.radius * 3
        );
        glow.addColorStop(
          0,
          node.color +
            Math.floor(node.opacity * 60)
              .toString(16)
              .padStart(2, "0")
        );
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(
          node.x - node.radius * 3,
          node.y - node.radius * 3,
          node.radius * 6,
          node.radius * 6
        );

        // Node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle =
          node.color +
          Math.floor(node.opacity * 255)
            .toString(16)
            .padStart(2, "0");
        ctx.fill();
      }

      // Add beams periodically
      if (frameCountRef.current % 30 === 0 && isInView) {
        addBeam();
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    if (isInView) {
      animationRef.current = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isInView]);

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        className="w-full max-w-[400px] h-[300px] rounded-xl"
        style={{ imageRendering: "auto" }}
      />
    </div>
  );
}

function WrappedStatCard() {
  const [count, setCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!isInView) return;

    let current = 0;
    const target = 2847;
    const duration = 2000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.floor(eased * target);
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView]);

  return (
    <div ref={cardRef}>
      <motion.div
        initial={{ opacity: 0, y: 30, rotateY: -15 }}
        whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        viewport={{ once: true, amount: 0.3 }}
        className="relative w-[280px] sm:w-[320px]"
        style={{ perspective: "1000px" }}
      >
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#533483] p-6 text-white shadow-2xl">
          {/* Decorative background circles */}
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-purple-500/20 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-blue-500/20 blur-2xl" />

          {/* Top label */}
          <div className="relative z-10">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-purple-300/80">
              Your {new Date().getFullYear()} in Code
            </p>
            <div className="mb-4 h-px w-12 bg-gradient-to-r from-purple-400 to-transparent" />

            {/* Main stat */}
            <div className="mb-6">
              <span className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-5xl font-bold tabular-nums tracking-tight text-transparent">
                {count.toLocaleString()}
              </span>
              <p className="mt-1 text-sm font-medium text-white/70">
                total commits
              </p>
            </div>

            {/* Sub stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-lg font-bold text-emerald-400">127</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wider">
                  day streak
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-400">12</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wider">
                  repos
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-cyan-400">95.3%</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wider">
                  TypeScript
                </p>
              </div>
            </div>

            {/* Language bar */}
            <div className="mt-4 flex h-2 overflow-hidden rounded-full">
              <div
                className="bg-[#3178c6]"
                style={{ width: "65%" }}
              />
              <div
                className="bg-[#f1e05a]"
                style={{ width: "15%" }}
              />
              <div
                className="bg-[#e34c26]"
                style={{ width: "10%" }}
              />
              <div
                className="bg-[#563d7c]"
                style={{ width: "7%" }}
              />
              <div
                className="bg-slate-500"
                style={{ width: "3%" }}
              />
            </div>
            <div className="mt-2 flex gap-3 text-[9px] text-white/40">
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#3178c6]" />
                TypeScript
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#f1e05a]" />
                JavaScript
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e34c26]" />
                HTML
              </span>
            </div>

            {/* Bottom branding */}
            <div className="mt-5 flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-[0.15em] text-white/30 uppercase">
                gitted wrapped
              </span>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-1 w-1 rounded-full"
                    style={{
                      backgroundColor: `rgba(168, 85, 247, ${0.3 + i * 0.15})`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Card shadow/reflection */}
        <div className="absolute -bottom-4 left-4 right-4 h-8 rounded-b-xl bg-gradient-to-b from-purple-900/20 to-transparent blur-lg" />
      </motion.div>
    </div>
  );
}

function FloatingBadges() {
  const badges = [
    { label: "Night Owl 🦉", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
    { label: "127-Day Streak 🔥", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
    { label: "TypeScript Pro 💎", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    { label: "Open Source Hero ⭐", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {badges.map((badge, i) => (
        <motion.div
          key={badge.label}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 + i * 0.15 }}
          viewport={{ once: true }}
        >
          <Badge
            variant="outline"
            className={`${badge.color} px-3 py-1 text-xs border backdrop-blur-sm`}
          >
            {badge.label}
          </Badge>
        </motion.div>
      ))}
    </div>
  );
}

export function PreviewAnimation() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-purple-600/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, amount: 0.3 }}
          className="mb-16 text-center"
        >
          <Badge
            variant="outline"
            className="mb-4 border-purple-500/30 bg-purple-500/10 text-purple-300 px-4 py-1"
          >
            See it in action
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Beautiful visualizations of{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              your code journey
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/50">
            From real-time Gource-style repository visualizations to Spotify Wrapped–inspired stat cards,
            see your Git history like never before.
          </p>
        </motion.div>

        {/* Preview content - two columns */}
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left: Gource Visualization */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            viewport={{ once: true, amount: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="relative w-full max-w-[400px]">
              {/* Gource frame */}
              <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0f]/80 p-2 shadow-2xl shadow-purple-900/20 backdrop-blur-sm">
                {/* Window controls */}
                <div className="mb-2 flex items-center gap-1.5 px-2 py-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                  <span className="ml-3 text-[10px] text-white/30 font-mono">
                    gource — gitted
                  </span>
                </div>

                <MiniGourceVisualization />

                {/* Playback controls mockup */}
                <div className="mt-2 flex items-center gap-3 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center">
                      <div className="ml-0.5 border-l-[6px] border-y-[4px] border-l-white/60 border-y-transparent" />
                    </div>
                  </div>
                  <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                      initial={{ width: "0%" }}
                      whileInView={{ width: "65%" }}
                      transition={{ duration: 3, delay: 0.5, ease: "linear" }}
                      viewport={{ once: true }}
                    />
                  </div>
                  <span className="text-[10px] text-white/30 font-mono tabular-nums">
                    2:34 / 3:47
                  </span>
                </div>
              </div>

              {/* Floating label */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                viewport={{ once: true }}
                className="absolute -bottom-6 left-1/2 -translate-x-1/2"
              >
                <Badge
                  variant="outline"
                  className="border-blue-500/30 bg-blue-500/10 text-blue-300 text-[10px] px-3"
                >
                  Live Gource Visualization
                </Badge>
              </motion.div>
            </div>

            <div className="mt-10 text-center max-w-sm">
              <h3 className="text-lg font-semibold text-white mb-2">
                Repository Gource Replay
              </h3>
              <p className="text-sm text-white/40 leading-relaxed">
                Watch your repository grow in real-time. Every commit becomes a visual event —
                files bloom as nodes, contributors appear as avatars navigating the codebase.
              </p>
            </div>
          </motion.div>

          {/* Right: Wrapped Card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            viewport={{ once: true, amount: 0.3 }}
            className="flex flex-col items-center"
          >
            <WrappedStatCard />

            <div className="mt-10 w-full max-w-sm">
              <h3 className="text-center text-lg font-semibold text-white mb-3">
                Your Year in Code, Wrapped
              </h3>
              <p className="text-center text-sm text-white/40 leading-relaxed mb-5">
                Inspired by Spotify Wrapped, get a stunning slideshow of your coding year —
                top repos, streak records, language evolution, and fun superlatives.
              </p>

              <FloatingBadges />
            </div>
          </motion.div>
        </div>

        {/* Bottom teaser row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true, amount: 0.3 }}
          className="mt-20 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6 max-w-3xl mx-auto"
        >
          {[
            {
              label: "Contribution Heatmap",
              emoji: "🟩",
              desc: "GitHub-style calendar",
            },
            {
              label: "Commit Timeline",
              emoji: "📈",
              desc: "Activity over time",
            },
            {
              label: "Language Breakdown",
              emoji: "🎨",
              desc: "Your tech stack",
            },
            {
              label: "AI Story",
              emoji: "📖",
              desc: "Your developer journey",
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="group relative overflow-hidden border border-white/5 bg-white/[0.02] p-4 text-center transition-all duration-300 hover:border-white/15 hover:bg-white/[0.05] cursor-default">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative z-10">
                  <span className="text-2xl">{item.emoji}</span>
                  <p className="mt-2 text-xs font-medium text-white/70">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/30">
                    {item.desc}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
