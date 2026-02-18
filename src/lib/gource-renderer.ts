import type {
  GourceNode,
  GourceContributor,
  GourceBeam,
  GourceParticle,
  GourceSettings,
  GourceCamera,
  FileCategory,
  RenderContext,
} from '@/lib/types';

import {
  FILE_CATEGORY_COLORS,
  DEFAULT_GOURCE_SETTINGS,
} from '@/lib/types';

// ─── Internal types ──────────────────────────────────────────────────────────

interface RendererState {
  ctx: CanvasRenderingContext2D | null;
  canvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  pixelRatio: number;
  settings: GourceSettings;
  frameCount: number;
  avatarCache: Map<string, HTMLImageElement | null>;
  avatarLoadingSet: Set<string>;
  dirtyRects: DirtyRect[];
  lastRenderTime: number;
  glowCanvas: HTMLCanvasElement | null;
  glowCtx: CanvasRenderingContext2D | null;
}

interface DirtyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RenderableScene {
  nodes: GourceNode[];
  edges: EdgeData[];
  contributors: GourceContributor[];
  beams: GourceBeam[];
  particles: GourceParticle[];
  labels: LabelData[];
  camera: GourceCamera;
  currentDate: string;
  fps: number;
}

interface EdgeData {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  depth: number;
  repoColor: string;
  opacity: number;
}

interface LabelData {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  opacity: number;
  isDirectory: boolean;
}

// ─── Color utilities ─────────────────────────────────────────────────────────

// Cached canvas for color normalization (hsl/rgb → #hex)
let _normCtx: CanvasRenderingContext2D | null = null;
function normalizeToHex(color: string): string {
  if (color.startsWith('#') && color.length >= 7) return color;
  if (!_normCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    _normCtx = c.getContext('2d')!;
  }
  _normCtx.fillStyle = '#000000';
  _normCtx.fillStyle = color;
  return _normCtx.fillStyle; // browser normalizes to #rrggbb
}

function hexToRgba(color: string, alpha: number): string {
  const hex = normalizeToHex(color);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(color: string, amount: number): string {
  const hex = normalizeToHex(color);
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, Math.floor(r + (255 - r) * amount));
  g = Math.min(255, Math.floor(g + (255 - g) * amount));
  b = Math.min(255, Math.floor(b + (255 - b) * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenHex(color: string, amount: number): string {
  const hex = normalizeToHex(color);
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── Repo color palette (for multi-repo combined view) ────────────────────

const REPO_COLORS = [
  '#60a5fa', // blue
  '#f472b6', // pink
  '#34d399', // emerald
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#e879f9', // fuchsia
  '#4ade80', // green
  '#f87171', // red
];

function getRepoColor(index: number): string {
  return REPO_COLORS[index % REPO_COLORS.length];
}

// ─── GourceRenderer class ────────────────────────────────────────────────────

export class GourceRenderer {
  private state: RendererState;

  constructor() {
    this.state = {
      ctx: null,
      canvas: null,
      width: 0,
      height: 0,
      pixelRatio: 1,
      settings: { ...DEFAULT_GOURCE_SETTINGS },
      frameCount: 0,
      avatarCache: new Map(),
      avatarLoadingSet: new Set(),
      dirtyRects: [],
      lastRenderTime: 0,
      glowCanvas: null,
      glowCtx: null,
    };
  }

  /**
   * Initialize the renderer with a canvas element.
   * Sets up high-DPI rendering and creates offscreen buffers.
   */
  initialize(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) {
      throw new Error('GourceRenderer: Failed to get 2D context');
    }

    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.state.canvas = canvas;
    this.state.ctx = ctx;
    this.state.pixelRatio = pixelRatio;

    // Create offscreen glow buffer
    const glowCanvas = document.createElement('canvas');
    const glowCtx = glowCanvas.getContext('2d');
    this.state.glowCanvas = glowCanvas;
    this.state.glowCtx = glowCtx;

    this.resize(canvas.clientWidth, canvas.clientHeight);

    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  /**
   * Resize the canvas while preserving high-DPI quality.
   */
  resize(width: number, height: number): void {
    const { canvas, ctx, pixelRatio, glowCanvas, glowCtx } = this.state;
    if (!canvas || !ctx) return;

    this.state.width = width;
    this.state.height = height;

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    // Resize glow buffer
    if (glowCanvas && glowCtx) {
      glowCanvas.width = width * pixelRatio;
      glowCanvas.height = height * pixelRatio;
      glowCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
  }

  /**
   * Update visualization settings.
   */
  setOptions(opts: Partial<GourceSettings>): void {
    this.state.settings = { ...this.state.settings, ...opts };
  }

  /**
   * Main render entry point.
   * Draws the complete scene: background, edges, nodes, beams, particles,
   * contributors, labels, and optional glow effects.
   */
  render(scene: RenderableScene): void {
    const { ctx, width, height, settings } = this.state;
    if (!ctx) return;

    const startTime = performance.now();
    this.state.frameCount++;

    const { camera, nodes, edges, contributors, beams, particles, labels, currentDate, fps } = scene;

    // Save state
    ctx.save();

    // Clear with background
    this.drawBackground(ctx, width, height, settings.backgroundColor);

    // Apply camera transform
    this.applyCamera(ctx, camera, width, height);

    // Draw edges (directory connections)
    this.drawEdges(ctx, edges, settings);

    // Draw nodes (files)
    this.drawNodes(ctx, nodes, camera, settings);

    // Draw commit beams
    if (settings.showCommitBeams) {
      this.drawBeams(ctx, beams, settings);
    }

    // Draw particles
    if (settings.showParticles) {
      this.drawParticles(ctx, particles);
    }

    // Draw contributor avatars
    if (settings.showAvatars) {
      this.drawContributors(ctx, contributors, settings);
    }

    // Draw labels
    if (settings.showLabels) {
      this.drawLabels(ctx, labels, camera);
    }

    // Restore to screen space for overlay
    ctx.restore();

    // Draw glow effects (composited on top)
    if (settings.showGlowEffects) {
      this.drawGlowEffects(ctx, scene, camera, width, height);
    }

    // Draw HUD overlay (date, fps)
    this.drawHUD(ctx, currentDate, fps, width, height);

    this.state.lastRenderTime = performance.now() - startTime;
  }

  /**
   * Get current render performance stats.
   */
  getRenderTime(): number {
    return this.state.lastRenderTime;
  }

  /**
   * Dispose renderer resources.
   */
  dispose(): void {
    this.state.avatarCache.clear();
    this.state.avatarLoadingSet.clear();
    this.state.ctx = null;
    this.state.canvas = null;
    this.state.glowCanvas = null;
    this.state.glowCtx = null;
  }

  // ─── Drawing sub-methods ─────────────────────────────────────────────────

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    bgColor: string
  ): void {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Subtle radial gradient vignette
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.15,
      width / 2, height / 2, width * 0.75
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, hexToRgba(bgColor, 0.6));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle grid pattern for depth
    ctx.save();
    ctx.strokeStyle = hexToRgba('#ffffff', 0.015);
    ctx.lineWidth = 0.5;
    const gridSize = 60;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private applyCamera(
    ctx: CanvasRenderingContext2D,
    camera: GourceCamera,
    width: number,
    height: number
  ): void {
    // Translate to center
    ctx.translate(width / 2, height / 2);
    // Apply zoom
    ctx.scale(camera.zoom, camera.zoom);
    // Apply pan
    ctx.translate(-camera.x, -camera.y);
  }

  private drawEdges(
    ctx: CanvasRenderingContext2D,
    edges: EdgeData[],
    settings: GourceSettings
  ): void {
    if (edges.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const edge of edges) {
      if (edge.opacity < 0.01) continue;

      const thickness = settings.edgeThickness * Math.max(0.3, 1 - edge.depth * 0.12);

      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(edge.repoColor, edge.opacity * 0.35);
      ctx.lineWidth = thickness;

      // Curved bezier connection for organic feel
      const dx = edge.toX - edge.fromX;
      const dy = edge.toY - edge.fromY;
      const cx1 = edge.fromX + dx * 0.3;
      const cy1 = edge.fromY;
      const cx2 = edge.fromX + dx * 0.7;
      const cy2 = edge.toY;

      ctx.moveTo(edge.fromX, edge.fromY);
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, edge.toX, edge.toY);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawNodes(
    ctx: CanvasRenderingContext2D,
    nodes: GourceNode[],
    camera: GourceCamera,
    settings: GourceSettings
  ): void {
    if (nodes.length === 0) return;

    ctx.save();

    // Sort nodes so directories render behind files
    const sortedNodes = [...nodes].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.depth - b.depth;
    });

    for (const node of sortedNodes) {
      if (!node.isVisible || node.opacity < 0.01) continue;

      // LOD: reduce detail for small/distant nodes
      const apparentSize = settings.nodeSize * node.scale * camera.zoom;
      if (apparentSize < 0.5) continue; // cull sub-pixel nodes

      const isLOD = apparentSize < 3; // low detail for tiny nodes

      if (node.isDirectory) {
        this.drawDirectoryNode(ctx, node, settings, isLOD);
      } else {
        this.drawFileNode(ctx, node, settings, isLOD);
      }
    }

    ctx.restore();
  }

  private drawFileNode(
    ctx: CanvasRenderingContext2D,
    node: GourceNode,
    settings: GourceSettings,
    isLOD: boolean
  ): void {
    const size = settings.nodeSize * node.scale;
    const color = this.getNodeColor(node, settings);

    ctx.globalAlpha = node.opacity;

    if (isLOD) {
      // Simple filled circle for low LOD
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Draw outer glow ring for recently modified files
      const timeSinceModified = Date.now() - node.lastModified;
      const recentThreshold = 5000; // 5 seconds in animation time
      if (timeSinceModified < recentThreshold) {
        const glowIntensity = 1 - (timeSinceModified / recentThreshold);
        const glowSize = size * (1.5 + glowIntensity * 1.5);

        const gradient = ctx.createRadialGradient(
          node.x, node.y, size * 0.3,
          node.x, node.y, glowSize
        );
        gradient.addColorStop(0, hexToRgba(color, 0.4 * glowIntensity));
        gradient.addColorStop(0.6, hexToRgba(color, 0.1 * glowIntensity));
        gradient.addColorStop(1, hexToRgba(color, 0));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main node circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      const highlight = lightenHex(color, 0.3);
      ctx.fillStyle = hexToRgba(highlight, 0.6);
      ctx.beginPath();
      ctx.arc(node.x - size * 0.2, node.y - size * 0.2, size * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Subtle border
      ctx.strokeStyle = hexToRgba(lightenHex(color, 0.5), 0.5);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
      ctx.stroke();

      // Modification count badge (for frequently modified files)
      if (node.modificationCount > 5) {
        const badgeSize = Math.min(size * 0.6, 8);
        ctx.fillStyle = hexToRgba('#ffffff', 0.8 * node.opacity);
        ctx.font = `bold ${Math.max(6, badgeSize)}px "Inter", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // We won't draw text for very small nodes
        if (badgeSize >= 6) {
          ctx.fillText(
            node.modificationCount > 99 ? '99+' : String(node.modificationCount),
            node.x, node.y
          );
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  private drawDirectoryNode(
    ctx: CanvasRenderingContext2D,
    node: GourceNode,
    settings: GourceSettings,
    isLOD: boolean
  ): void {
    const size = settings.nodeSize * node.scale * 0.7;
    const color = darkenHex(node.color || '#4a5568', 0.2);

    ctx.globalAlpha = node.opacity * 0.6;

    if (isLOD) {
      ctx.fillStyle = hexToRgba(color, 0.3);
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Directory shown as a ring/hollow circle
      ctx.strokeStyle = hexToRgba(color, 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
      ctx.stroke();

      // Inner dot
      ctx.fillStyle = hexToRgba(color, 0.3);
      ctx.beginPath();
      ctx.arc(node.x, node.y, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  private getNodeColor(node: GourceNode, settings: GourceSettings): string {
    // Check custom extension color overrides first
    if (node.extension && settings.extensionColors[node.extension]) {
      return settings.extensionColors[node.extension];
    }

    // Use the node's assigned color (from category or repo)
    if (node.color) {
      return node.color;
    }

    // Fallback to category color
    return FILE_CATEGORY_COLORS[node.category] || FILE_CATEGORY_COLORS.other;
  }

  private drawBeams(
    ctx: CanvasRenderingContext2D,
    beams: GourceBeam[],
    settings: GourceSettings
  ): void {
    if (beams.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';

    for (const beam of beams) {
      if (beam.opacity < 0.01) continue;

      const dx = beam.toX - beam.fromX;
      const dy = beam.toY - beam.fromY;

      // Animated head position along the beam
      const headX = beam.fromX + dx * beam.progress;
      const headY = beam.fromY + dy * beam.progress;

      // Beam trail gradient: fades from head to origin
      const trailStart = Math.max(0, beam.progress - 0.3);
      const startX = beam.fromX + dx * trailStart;
      const startY = beam.fromY + dy * trailStart;

      const gradient = ctx.createLinearGradient(startX, startY, headX, headY);
      gradient.addColorStop(0, hexToRgba(beam.color, 0));
      gradient.addColorStop(0.7, hexToRgba(beam.color, beam.opacity * 0.5));
      gradient.addColorStop(1, hexToRgba(beam.color, beam.opacity));

      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.moveTo(startX, startY);
      ctx.lineTo(headX, headY);
      ctx.stroke();

      // Beam head glow
      const headGlow = ctx.createRadialGradient(headX, headY, 0, headX, headY, 8);
      headGlow.addColorStop(0, hexToRgba(beam.color, beam.opacity * 0.8));
      headGlow.addColorStop(0.5, hexToRgba(beam.color, beam.opacity * 0.2));
      headGlow.addColorStop(1, hexToRgba(beam.color, 0));

      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(headX, headY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Small bright core at head
      ctx.fillStyle = hexToRgba('#ffffff', beam.opacity * 0.9);
      ctx.beginPath();
      ctx.arc(headX, headY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: GourceParticle[]
  ): void {
    if (particles.length === 0) return;

    ctx.save();

    for (const particle of particles) {
      if (particle.opacity < 0.01 || particle.ttl <= 0) continue;

      const lifeRatio = particle.ttl / particle.maxTtl;
      const currentOpacity = particle.opacity * lifeRatio;
      const currentSize = particle.size * (0.3 + lifeRatio * 0.7);

      if (currentSize < 0.3) continue;

      ctx.globalAlpha = currentOpacity;

      // Particle glow
      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, currentSize * 3
      );
      gradient.addColorStop(0, hexToRgba(particle.color, 0.6));
      gradient.addColorStop(0.4, hexToRgba(particle.color, 0.15));
      gradient.addColorStop(1, hexToRgba(particle.color, 0));

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, currentSize * 3, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = lightenHex(particle.color, 0.5);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawContributors(
    ctx: CanvasRenderingContext2D,
    contributors: GourceContributor[],
    settings: GourceSettings
  ): void {
    if (contributors.length === 0) return;

    ctx.save();

    for (const contributor of contributors) {
      if (!contributor.isVisible || contributor.opacity < 0.01) continue;

      ctx.globalAlpha = contributor.opacity;

      const avatarSize = 20;
      const hasAvatar = contributor.avatarImage && contributor.avatarImage.complete;

      if (hasAvatar && contributor.avatarImage) {
        // Draw circular avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(contributor.x, contributor.y, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        try {
          ctx.drawImage(
            contributor.avatarImage,
            contributor.x - avatarSize / 2,
            contributor.y - avatarSize / 2,
            avatarSize,
            avatarSize
          );
        } catch {
          // Fallback if image draw fails
          this.drawAvatarFallback(ctx, contributor, avatarSize);
        }

        ctx.restore();

        // Avatar border ring with contributor color
        ctx.strokeStyle = hexToRgba(contributor.color, contributor.opacity);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(contributor.x, contributor.y, avatarSize / 2 + 1, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Fallback: colored circle with initial
        this.drawAvatarFallback(ctx, contributor, avatarSize);

        // Try to load avatar if we haven't already
        if (contributor.avatarUrl && !this.state.avatarLoadingSet.has(contributor.id)) {
          this.loadAvatar(contributor);
        }
      }

      // Name label below avatar
      ctx.fillStyle = hexToRgba('#ffffff', contributor.opacity * 0.9);
      ctx.font = '10px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        contributor.name.length > 15 ? contributor.name.slice(0, 14) + '…' : contributor.name,
        contributor.x,
        contributor.y + avatarSize / 2 + 4
      );

      // Subtle pulsing ring when active (recently committed)
      const timeSinceActive = Date.now() - contributor.lastActiveTime;
      if (timeSinceActive < 3000) {
        const pulse = 1 - (timeSinceActive / 3000);
        const pulseSize = avatarSize / 2 + 4 + pulse * 12;

        ctx.strokeStyle = hexToRgba(contributor.color, pulse * 0.4);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(contributor.x, contributor.y, pulseSize, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawAvatarFallback(
    ctx: CanvasRenderingContext2D,
    contributor: GourceContributor,
    avatarSize: number
  ): void {
    // Colored circle
    ctx.fillStyle = contributor.color;
    ctx.beginPath();
    ctx.arc(contributor.x, contributor.y, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Initial letter
    const initial = (contributor.name || '?')[0].toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${avatarSize * 0.45}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, contributor.x, contributor.y);
  }

  private loadAvatar(contributor: GourceContributor): void {
    if (!contributor.avatarUrl) return;

    this.state.avatarLoadingSet.add(contributor.id);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      this.state.avatarCache.set(contributor.id, img);
      // The contributor object holds a reference to avatarImage that gets
      // updated by the layout/engine layer. Here we store in cache for reuse.
      contributor.avatarImage = img;
    };

    img.onerror = () => {
      this.state.avatarCache.set(contributor.id, null);
    };

    // Use smaller avatar for performance
    const size = 64;
    img.src = contributor.avatarUrl.includes('?')
      ? `${contributor.avatarUrl}&s=${size}`
      : `${contributor.avatarUrl}?s=${size}`;
  }

  private drawLabels(
    ctx: CanvasRenderingContext2D,
    labels: LabelData[],
    camera: GourceCamera
  ): void {
    if (labels.length === 0) return;

    ctx.save();

    for (const label of labels) {
      if (label.opacity < 0.05) continue;

      // Skip labels that would be too small at current zoom
      const apparentFontSize = label.fontSize * camera.zoom;
      if (apparentFontSize < 6) continue;

      ctx.globalAlpha = label.opacity;

      if (label.isDirectory) {
        // Directory labels: bolder, slightly larger
        ctx.font = `600 ${label.fontSize}px "Inter", system-ui, sans-serif`;
        ctx.fillStyle = hexToRgba('#94a3b8', label.opacity);

        // Subtle text shadow for readability
        ctx.shadowColor = hexToRgba('#000000', 0.5);
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
      } else {
        // File labels: lighter, smaller
        ctx.font = `400 ${label.fontSize}px "Inter", system-ui, sans-serif`;
        ctx.fillStyle = hexToRgba('#64748b', label.opacity * 0.8);
        ctx.shadowColor = hexToRgba('#000000', 0.3);
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.text, label.x, label.y);
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawGlowEffects(
    ctx: CanvasRenderingContext2D,
    scene: RenderableScene,
    camera: GourceCamera,
    width: number,
    height: number
  ): void {
    const { glowCanvas, glowCtx } = this.state;
    if (!glowCanvas || !glowCtx) return;

    // Clear glow buffer
    glowCtx.clearRect(0, 0, width, height);

    // Draw glow sources
    glowCtx.save();
    glowCtx.translate(width / 2, height / 2);
    glowCtx.scale(camera.zoom, camera.zoom);
    glowCtx.translate(-camera.x, -camera.y);

    // Glow from active beams
    for (const beam of scene.beams) {
      if (beam.opacity < 0.1) continue;
      const headX = beam.fromX + (beam.toX - beam.fromX) * beam.progress;
      const headY = beam.fromY + (beam.toY - beam.fromY) * beam.progress;

      const gradient = glowCtx.createRadialGradient(headX, headY, 0, headX, headY, 20);
      gradient.addColorStop(0, hexToRgba(beam.color, beam.opacity * 0.3));
      gradient.addColorStop(1, hexToRgba(beam.color, 0));

      glowCtx.fillStyle = gradient;
      glowCtx.beginPath();
      glowCtx.arc(headX, headY, 20, 0, Math.PI * 2);
      glowCtx.fill();
    }

    // Glow from recently modified nodes
    const now = Date.now();
    for (const node of scene.nodes) {
      if (!node.isVisible || node.isDirectory) continue;
      const timeSince = now - node.lastModified;
      if (timeSince > 3000) continue;

      const intensity = 1 - (timeSince / 3000);
      const color = this.getNodeColor(node, this.state.settings);

      const gradient = glowCtx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, 15
      );
      gradient.addColorStop(0, hexToRgba(color, intensity * 0.2));
      gradient.addColorStop(1, hexToRgba(color, 0));

      glowCtx.fillStyle = gradient;
      glowCtx.beginPath();
      glowCtx.arc(node.x, node.y, 15, 0, Math.PI * 2);
      glowCtx.fill();
    }

    glowCtx.restore();

    // Composite glow buffer onto main canvas with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(glowCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  private drawHUD(
    ctx: CanvasRenderingContext2D,
    currentDate: string,
    fps: number,
    width: number,
    height: number
  ): void {
    ctx.save();

    // Current date display (top-right)
    if (currentDate) {
      const dateText = currentDate;
      ctx.font = '600 16px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';

      // Background pill
      const metrics = ctx.measureText(dateText);
      const pillPadX = 14;
      const pillPadY = 8;
      const pillW = metrics.width + pillPadX * 2;
      const pillH = 16 + pillPadY * 2;
      const pillX = width - 20 - pillW;
      const pillY = 20;

      ctx.fillStyle = hexToRgba('#0a0a0f', 0.7);
      this.drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 8);
      ctx.fill();

      ctx.strokeStyle = hexToRgba('#ffffff', 0.1);
      ctx.lineWidth = 1;
      this.drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 8);
      ctx.stroke();

      ctx.fillStyle = hexToRgba('#ffffff', 0.9);
      ctx.fillText(dateText, width - 20 - pillPadX, pillY + pillPadY);
    }

    // FPS counter (top-left, debug)
    if (fps > 0) {
      ctx.font = '11px "JetBrains Mono", "Fira Code", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = hexToRgba(fps < 30 ? '#f87171' : fps < 50 ? '#fbbf24' : '#34d399', 0.5);
      ctx.fillText(`${Math.round(fps)} FPS`, 12, 12);

      ctx.fillStyle = hexToRgba('#94a3b8', 0.3);
      ctx.fillText(`${this.state.lastRenderTime.toFixed(1)}ms`, 12, 26);
    }

    ctx.restore();
  }

  // ─── Utility drawing helpers ──────────────────────────────────────────────

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // ─── Static utility: world-to-screen coordinate conversion ────────────────

  /**
   * Convert world coordinates to screen (canvas) coordinates.
   */
  static worldToScreen(
    worldX: number,
    worldY: number,
    camera: GourceCamera,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number } {
    return {
      x: (worldX - camera.x) * camera.zoom + canvasWidth / 2,
      y: (worldY - camera.y) * camera.zoom + canvasHeight / 2,
    };
  }

  /**
   * Convert screen (canvas) coordinates to world coordinates.
   */
  static screenToWorld(
    screenX: number,
    screenY: number,
    camera: GourceCamera,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number } {
    return {
      x: (screenX - canvasWidth / 2) / camera.zoom + camera.x,
      y: (screenY - canvasHeight / 2) / camera.zoom + camera.y,
    };
  }

  /**
   * Check if a point in world space is visible on screen.
   */
  static isVisible(
    worldX: number,
    worldY: number,
    radius: number,
    camera: GourceCamera,
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    const screen = GourceRenderer.worldToScreen(worldX, worldY, camera, canvasWidth, canvasHeight);
    const apparentRadius = radius * camera.zoom;
    return (
      screen.x + apparentRadius > 0 &&
      screen.x - apparentRadius < canvasWidth &&
      screen.y + apparentRadius > 0 &&
      screen.y - apparentRadius < canvasHeight
    );
  }

  /**
   * Get a cached avatar image (or null if not loaded).
   */
  getCachedAvatar(contributorId: string): HTMLImageElement | null {
    return this.state.avatarCache.get(contributorId) ?? null;
  }

  /**
   * Get the repo color for a given index.
   */
  static getRepoColor(index: number): string {
    return getRepoColor(index);
  }

  /**
   * Get the category color for a file category.
   */
  static getCategoryColor(category: FileCategory): string {
    return FILE_CATEGORY_COLORS[category] || FILE_CATEGORY_COLORS.other;
  }
}

export default GourceRenderer;
