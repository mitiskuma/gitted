// =============================================================================
// WEBGL2 INSTANCED RENDERER
// =============================================================================
// Replaces per-node Canvas 2D draw calls with ~10 instanced WebGL2 draw calls.
// Falls back to Canvas 2D if WebGL2 is unavailable.

import {
  FULLSCREEN_QUAD_VS,
  BACKGROUND_FS,
  NODE_VS,
  NODE_FS,
  EDGE_VS,
  EDGE_FS,
  BEAM_VS,
  BEAM_FS,
  PARTICLE_VS,
  PARTICLE_FS,
  BLOOM_THRESHOLD_FS,
  BLUR_FS,
  COMPOSITE_FS,
  CONTRIBUTOR_VS,
  CONTRIBUTOR_FS,
} from './webgl-shaders';
import type { LayoutBuffers } from './layout-buffers';
import { NodeFlags } from './layout-buffers';
import type { BeamPool, ParticlePool } from './object-pools';
import type { GourceCamera, GourceSettings, GourceContributor, Bounds } from '@/lib/types';

// =============================================================================
// RENDERER INTERFACE
// =============================================================================

/** Per-frame scene data passed to the renderer. */
export interface RenderSceneData {
  buffers: LayoutBuffers;
  beams: BeamPool;
  particles: ParticlePool;
  contributors: Map<string, GourceContributor>;
  camera: GourceCamera;
  settings: GourceSettings;
  simulationTime: number;
  viewport: Bounds;
  fps: number;
  currentDate: string;
}

/** Common interface for rendering backends (WebGL2 or Canvas 2D fallback). */
export interface IGourceRenderer {
  initialize(canvas: HTMLCanvasElement): boolean;
  resize(width: number, height: number): void;
  render(scene: RenderSceneData): void;
  dispose(): void;
  readonly isWebGL: boolean;
}

// =============================================================================
// WEBGL2 RENDERER
// =============================================================================

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
}

interface BloomFBO {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

/**
 * WebGL2 instanced renderer for the Gource visualization.
 *
 * Replaces per-node Canvas 2D draw calls with a small number of instanced
 * WebGL2 draw calls. Renders nodes, edges, beams, particles, and contributors
 * with per-instance attributes uploaded each frame. Includes a Canvas 2D HUD
 * overlay for text elements.
 */
export class WebGLRenderer implements IGourceRenderer {
  readonly isWebGL = true;

  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private width = 0;
  private height = 0;
  private pixelRatio = 1;

  // Shader programs
  private bgProgram: ShaderProgram | null = null;
  private nodeProgram: ShaderProgram | null = null;
  private edgeProgram: ShaderProgram | null = null;
  private beamProgram: ShaderProgram | null = null;
  private particleProgram: ShaderProgram | null = null;
  private contributorProgram: ShaderProgram | null = null;
  private bloomThresholdProgram: ShaderProgram | null = null;
  private blurProgram: ShaderProgram | null = null;
  private compositeProgram: ShaderProgram | null = null;

  // Geometry buffers
  private quadVAO: WebGLVertexArrayObject | null = null;
  private quadCornerBuffer: WebGLBuffer | null = null;
  private lineVAO: WebGLVertexArrayObject | null = null;
  private lineBuffer: WebGLBuffer | null = null;

  // Instance buffers (dynamically updated each frame)
  private nodeInstanceBuffer: WebGLBuffer | null = null;
  private edgeInstanceBuffer: WebGLBuffer | null = null;
  private beamInstanceBuffer: WebGLBuffer | null = null;
  private particleInstanceBuffer: WebGLBuffer | null = null;
  private contributorInstanceBuffer: WebGLBuffer | null = null;

  // Bloom FBOs
  private sceneFBO: BloomFBO | null = null;
  private bloomFBO1: BloomFBO | null = null;
  private bloomFBO2: BloomFBO | null = null;

  // CPU-side instance data arrays (reused each frame)
  private nodeInstanceData: Float32Array = new Float32Array(0);
  private edgeInstanceData: Float32Array = new Float32Array(0);
  private beamInstanceData: Float32Array = new Float32Array(0);
  private particleInstanceData: Float32Array = new Float32Array(0);
  private contributorInstanceData: Float32Array = new Float32Array(0);

  // HUD overlay (Canvas 2D for text only)
  private hudCanvas: HTMLCanvasElement | null = null;
  private hudCtx: CanvasRenderingContext2D | null = null;
  private hudTexture: WebGLTexture | null = null;

  initialize(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      desynchronized: true,
    });

    if (!gl) return false;

    this.gl = gl;
    this.canvas = canvas;
    this.pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Compile all shader programs
    try {
      this.bgProgram = this.compileProgram(FULLSCREEN_QUAD_VS, BACKGROUND_FS);
      this.nodeProgram = this.compileProgram(NODE_VS, NODE_FS);
      this.edgeProgram = this.compileProgram(EDGE_VS, EDGE_FS);
      this.beamProgram = this.compileProgram(BEAM_VS, BEAM_FS);
      this.particleProgram = this.compileProgram(PARTICLE_VS, PARTICLE_FS);
      this.contributorProgram = this.compileProgram(CONTRIBUTOR_VS, CONTRIBUTOR_FS);
      this.bloomThresholdProgram = this.compileProgram(FULLSCREEN_QUAD_VS, BLOOM_THRESHOLD_FS);
      this.blurProgram = this.compileProgram(FULLSCREEN_QUAD_VS, BLUR_FS);
      this.compositeProgram = this.compileProgram(FULLSCREEN_QUAD_VS, COMPOSITE_FS);
    } catch (e) {
      console.error('WebGL shader compilation failed:', e);
      this.dispose();
      return false;
    }

    // Create geometry buffers
    this.createGeometry(gl);
    this.createInstanceBuffers(gl);

    // Create HUD canvas
    this.hudCanvas = document.createElement('canvas');
    this.hudCtx = this.hudCanvas.getContext('2d');

    this.resize(canvas.clientWidth, canvas.clientHeight);

    return true;
  }

  resize(width: number, height: number): void {
    if (!this.gl || !this.canvas) return;

    this.width = width;
    this.height = height;

    const pw = Math.floor(width * this.pixelRatio);
    const ph = Math.floor(height * this.pixelRatio);

    this.canvas.width = pw;
    this.canvas.height = ph;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.gl.viewport(0, 0, pw, ph);

    // Recreate FBOs at new size
    this.createBloomFBOs(this.gl, pw, ph);

    // Resize HUD canvas
    if (this.hudCanvas) {
      this.hudCanvas.width = pw;
      this.hudCanvas.height = ph;
    }
  }

  render(scene: RenderSceneData): void {
    const gl = this.gl;
    if (!gl) return;

    const { buffers, beams, particles, contributors, camera, settings, viewport } = scene;

    // Build view matrix: maps world coords to clip space [-1,1]
    const viewMatrix = this.buildViewMatrix(camera);

    // 1. Clear
    const bgR = parseInt(settings.backgroundColor.slice(1, 3), 16) / 255;
    const bgG = parseInt(settings.backgroundColor.slice(3, 5), 16) / 255;
    const bgB = parseInt(settings.backgroundColor.slice(5, 7), 16) / 255;
    gl.clearColor(bgR, bgG, bgB, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 2. Background gradient/vignette
    this.renderBackground(gl, bgR, bgG, bgB);

    // 3. Edges
    this.renderEdges(gl, buffers, viewport, viewMatrix, settings);

    // 4. Beams
    this.renderBeams(gl, beams, viewMatrix, settings);

    // 5. Particles
    if (settings.showParticles) {
      this.renderParticles(gl, particles, viewMatrix);
    }

    // 6. Nodes
    this.renderNodes(gl, buffers, viewport, viewMatrix, settings, scene.simulationTime);

    // 7. Contributors
    if (settings.showAvatars) {
      this.renderContributors(gl, contributors, viewport, viewMatrix, camera);
    }

    // 8. HUD overlay (text via Canvas 2D)
    this.renderHUD(scene);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;

    // Delete all programs, buffers, VAOs, textures, FBOs
    const programs = [
      this.bgProgram, this.nodeProgram, this.edgeProgram,
      this.beamProgram, this.particleProgram, this.contributorProgram,
      this.bloomThresholdProgram, this.blurProgram, this.compositeProgram,
    ];
    for (const p of programs) {
      if (p) gl.deleteProgram(p.program);
    }

    const buffers = [
      this.quadCornerBuffer, this.lineBuffer,
      this.nodeInstanceBuffer, this.edgeInstanceBuffer,
      this.beamInstanceBuffer, this.particleInstanceBuffer,
      this.contributorInstanceBuffer,
    ];
    for (const b of buffers) {
      if (b) gl.deleteBuffer(b);
    }

    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
    if (this.lineVAO) gl.deleteVertexArray(this.lineVAO);

    this.deleteFBO(gl, this.sceneFBO);
    this.deleteFBO(gl, this.bloomFBO1);
    this.deleteFBO(gl, this.bloomFBO2);

    if (this.hudTexture) gl.deleteTexture(this.hudTexture);

    this.gl = null;
    this.canvas = null;
  }

  // =========================================================================
  // SHADER COMPILATION
  // =========================================================================

  private compileProgram(vsSrc: string, fsSrc: string): ShaderProgram {
    const gl = this.gl!;
    const vs = this.compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`Shader link error: ${log}`);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Collect all uniforms
    const uniforms = new Map<string, WebGLUniformLocation>();
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) {
        const loc = gl.getUniformLocation(program, info.name);
        if (loc) uniforms.set(info.name, loc);
      }
    }

    return { program, uniforms };
  }

  private compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${log}\nSource:\n${source}`);
    }
    return shader;
  }

  // =========================================================================
  // GEOMETRY CREATION
  // =========================================================================

  private createGeometry(gl: WebGL2RenderingContext): void {
    // Unit quad: 4 vertices forming a triangle strip
    const quadCorners = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);

    this.quadCornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadCornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadCorners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // Line endpoints: [0, 1]
    const lineEndpoints = new Float32Array([0, 1]);
    this.lineVAO = gl.createVertexArray();
    gl.bindVertexArray(this.lineVAO);

    this.lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, lineEndpoints, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private createInstanceBuffers(gl: WebGL2RenderingContext): void {
    this.nodeInstanceBuffer = gl.createBuffer();
    this.edgeInstanceBuffer = gl.createBuffer();
    this.beamInstanceBuffer = gl.createBuffer();
    this.particleInstanceBuffer = gl.createBuffer();
    this.contributorInstanceBuffer = gl.createBuffer();
  }

  // =========================================================================
  // BLOOM FBOs
  // =========================================================================

  private createBloomFBOs(gl: WebGL2RenderingContext, w: number, h: number): void {
    this.deleteFBO(gl, this.sceneFBO);
    this.deleteFBO(gl, this.bloomFBO1);
    this.deleteFBO(gl, this.bloomFBO2);

    const hw = Math.floor(w / 4);
    const hh = Math.floor(h / 4);

    this.sceneFBO = this.createFBO(gl, w, h);
    this.bloomFBO1 = this.createFBO(gl, hw, hh);
    this.bloomFBO2 = this.createFBO(gl, hw, hh);
  }

  private createFBO(gl: WebGL2RenderingContext, w: number, h: number): BloomFBO {
    const fb = gl.createFramebuffer()!;
    const tex = gl.createTexture()!;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return { framebuffer: fb, texture: tex, width: w, height: h };
  }

  private deleteFBO(gl: WebGL2RenderingContext, fbo: BloomFBO | null): void {
    if (!fbo) return;
    gl.deleteFramebuffer(fbo.framebuffer);
    gl.deleteTexture(fbo.texture);
  }

  // =========================================================================
  // VIEW MATRIX
  // =========================================================================

  /**
   * Build a 3x3 transformation matrix that maps world coordinates to
   * clip space [-1, 1] accounting for camera position, zoom, and aspect ratio.
   */
  private buildViewMatrix(camera: GourceCamera): Float32Array {
    const sx = (2 * camera.zoom) / this.width;
    const sy = (2 * camera.zoom) / this.height;
    const tx = -camera.x * sx;
    const ty = camera.y * sy; // flip Y for WebGL

    // Column-major 3x3
    return new Float32Array([
      sx, 0,  0,
      0,  -sy, 0,  // negate Y to flip
      tx, -ty, 1,
    ]);
  }

  // =========================================================================
  // RENDER PASSES
  // =========================================================================

  private renderBackground(gl: WebGL2RenderingContext, r: number, g: number, b: number): void {
    const prog = this.bgProgram!;
    gl.useProgram(prog.program);

    gl.uniform3f(prog.uniforms.get('uBgColor')!, r, g, b);
    gl.uniform2f(prog.uniforms.get('uResolution')!, this.width, this.height);

    // Fullscreen triangle strip with implicit vertices (no VAO needed)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private renderEdges(
    gl: WebGL2RenderingContext,
    buffers: LayoutBuffers,
    viewport: Bounds,
    viewMatrix: Float32Array,
    settings: GourceSettings,
  ): void {
    const prog = this.edgeProgram!;
    gl.useProgram(prog.program);
    gl.uniformMatrix3fv(prog.uniforms.get('uViewMatrix')!, false, viewMatrix);

    // Build edge instance data: from(2) + to(2) + opacity(1) + color(3) + thickness(1) = 9 floats
    const STRIDE = 9;
    const maxEdges = buffers.count;
    if (this.edgeInstanceData.length < maxEdges * STRIDE) {
      this.edgeInstanceData = new Float32Array(maxEdges * STRIDE);
    }

    let edgeCount = 0;
    for (let i = 1; i <= buffers.count; i++) {
      const parentIdx = buffers.parentIndex[i];
      if (parentIdx <= 0) continue;
      if (buffers.opacity[i] < 0.05 || buffers.opacity[parentIdx] < 0.05) continue;

      // Viewport culling
      const nx = buffers.x[i], ny = buffers.y[i];
      const px = buffers.x[parentIdx], py = buffers.y[parentIdx];
      const m = 100;
      const inView = (
        (nx >= viewport.x - m && nx <= viewport.x + viewport.width + m &&
         ny >= viewport.y - m && ny <= viewport.y + viewport.height + m) ||
        (px >= viewport.x - m && px <= viewport.x + viewport.width + m &&
         py >= viewport.y - m && py <= viewport.y + viewport.height + m)
      );
      if (!inView) continue;

      const off = edgeCount * STRIDE;
      const alpha = Math.min(buffers.opacity[i], buffers.opacity[parentIdx]) * 0.35;
      const isDir = buffers.hasFlag(i, NodeFlags.IS_DIR);
      const thickness = isDir ? settings.edgeThickness * 1.5 : settings.edgeThickness;

      this.edgeInstanceData[off] = px;
      this.edgeInstanceData[off + 1] = py;
      this.edgeInstanceData[off + 2] = nx;
      this.edgeInstanceData[off + 3] = ny;
      this.edgeInstanceData[off + 4] = alpha;
      this.edgeInstanceData[off + 5] = buffers.colorR[i] / 255;
      this.edgeInstanceData[off + 6] = buffers.colorG[i] / 255;
      this.edgeInstanceData[off + 7] = buffers.colorB[i] / 255;
      this.edgeInstanceData[off + 8] = thickness;

      edgeCount++;
    }

    if (edgeCount === 0) return;

    // Upload and draw
    gl.bindVertexArray(this.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeInstanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.edgeInstanceData.subarray(0, edgeCount * STRIDE), gl.DYNAMIC_DRAW);

    // Setup instance attributes
    const bpe = 4; // bytes per float
    for (let a = 1; a <= 5; a++) gl.enableVertexAttribArray(a);

    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE * bpe, 0);      // aFrom
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE * bpe, 2 * bpe); // aTo
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE * bpe, 4 * bpe); // aOpacity
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, STRIDE * bpe, 5 * bpe); // aColor
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, STRIDE * bpe, 8 * bpe); // aThickness

    for (let a = 1; a <= 5; a++) gl.vertexAttribDivisor(a, 1);

    gl.drawArraysInstanced(gl.LINES, 0, 2, edgeCount);

    // Cleanup divisors
    for (let a = 1; a <= 5; a++) {
      gl.vertexAttribDivisor(a, 0);
      gl.disableVertexAttribArray(a);
    }
    gl.bindVertexArray(null);
  }

  private renderNodes(
    gl: WebGL2RenderingContext,
    buffers: LayoutBuffers,
    viewport: Bounds,
    viewMatrix: Float32Array,
    settings: GourceSettings,
    simulationTime: number,
  ): void {
    const prog = this.nodeProgram!;
    gl.useProgram(prog.program);
    gl.uniformMatrix3fv(prog.uniforms.get('uViewMatrix')!, false, viewMatrix);
    gl.uniform1f(prog.uniforms.get('uNodeSize')!, settings.nodeSize);

    // Build node instance data: position(2) + scale(1) + opacity(1) + color(3) + nodeType(1) + glowIntensity(1) + ringCount(1) = 10 floats
    const STRIDE = 10;
    const maxNodes = buffers.count;
    if (this.nodeInstanceData.length < maxNodes * STRIDE) {
      this.nodeInstanceData = new Float32Array(maxNodes * STRIDE);
    }

    let nodeCount = 0;
    const m = 50;

    for (let i = 1; i <= buffers.count; i++) {
      if (buffers.opacity[i] < 0.05) continue;
      if (!buffers.hasFlag(i, NodeFlags.VISIBLE)) continue;

      const nx = buffers.x[i], ny = buffers.y[i];
      if (nx < viewport.x - m || nx > viewport.x + viewport.width + m ||
          ny < viewport.y - m || ny > viewport.y + viewport.height + m) continue;

      if (nodeCount >= settings.maxVisibleNodes) break;

      const isDir = buffers.hasFlag(i, NodeFlags.IS_DIR);
      const scale = buffers.scale[i];
      const timeSinceMod = simulationTime - buffers.lastModified[i];
      const recentlyModified = buffers.lastModified[i] > 0 && timeSinceMod < 3000;

      let glowIntensity = 0;
      if (settings.showGlowEffects) {
        if (scale > 1.05 || recentlyModified) {
          glowIntensity = recentlyModified
            ? Math.min(1, Math.abs(scale - 1) * 0.8 + 0.35)
            : Math.min(1, Math.abs(scale - 1) * 0.5);
        } else if (buffers.opacity[i] > 0.2) {
          glowIntensity = recentlyModified ? 0.18 : 0.08;
        }
      }

      let ringCount = 0;
      if (scale > 1.05) ringCount = 1;
      if (scale > 1.15) ringCount = 2;
      if (scale > 1.3) ringCount = 3;

      const off = nodeCount * STRIDE;
      this.nodeInstanceData[off] = nx;
      this.nodeInstanceData[off + 1] = ny;
      this.nodeInstanceData[off + 2] = scale;
      this.nodeInstanceData[off + 3] = buffers.opacity[i];
      this.nodeInstanceData[off + 4] = buffers.colorR[i] / 255;
      this.nodeInstanceData[off + 5] = buffers.colorG[i] / 255;
      this.nodeInstanceData[off + 6] = buffers.colorB[i] / 255;
      this.nodeInstanceData[off + 7] = isDir ? 1 : 0;
      this.nodeInstanceData[off + 8] = glowIntensity;
      this.nodeInstanceData[off + 9] = ringCount;

      nodeCount++;
    }

    if (nodeCount === 0) return;

    // Upload and draw
    gl.bindVertexArray(this.quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeInstanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.nodeInstanceData.subarray(0, nodeCount * STRIDE), gl.DYNAMIC_DRAW);

    const bpe = 4;
    // Instance attributes start at location 1
    for (let a = 1; a <= 7; a++) gl.enableVertexAttribArray(a);

    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE * bpe, 0);       // aPosition
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE * bpe, 2 * bpe); // aScale
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE * bpe, 3 * bpe); // aOpacity
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, STRIDE * bpe, 4 * bpe); // aColor
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, STRIDE * bpe, 7 * bpe); // aNodeType
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, STRIDE * bpe, 8 * bpe); // aGlowIntensity
    gl.vertexAttribPointer(7, 1, gl.FLOAT, false, STRIDE * bpe, 9 * bpe); // aRingCount

    for (let a = 1; a <= 7; a++) gl.vertexAttribDivisor(a, 1);

    // Use premultiplied alpha blending for proper glow compositing
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nodeCount);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (let a = 1; a <= 7; a++) {
      gl.vertexAttribDivisor(a, 0);
      gl.disableVertexAttribArray(a);
    }
    gl.bindVertexArray(null);
  }

  private renderBeams(
    gl: WebGL2RenderingContext,
    beams: BeamPool,
    viewMatrix: Float32Array,
    settings: GourceSettings,
  ): void {
    if (beams.count === 0 || !settings.showCommitBeams) return;

    const prog = this.beamProgram!;
    gl.useProgram(prog.program);
    gl.uniformMatrix3fv(prog.uniforms.get('uViewMatrix')!, false, viewMatrix);

    // Build instance data: from(2) + to(2) + progress(1) + opacity(1) + color(3) = 9 floats
    const STRIDE = 9;
    if (this.beamInstanceData.length < beams.count * STRIDE) {
      this.beamInstanceData = new Float32Array(beams.capacity * STRIDE);
    }

    for (let i = 0; i < beams.count; i++) {
      const off = i * STRIDE;
      this.beamInstanceData[off] = beams.getFromX(i);
      this.beamInstanceData[off + 1] = beams.getFromY(i);
      this.beamInstanceData[off + 2] = beams.getToX(i);
      this.beamInstanceData[off + 3] = beams.getToY(i);
      this.beamInstanceData[off + 4] = Math.min(1, beams.getProgress(i));
      this.beamInstanceData[off + 5] = beams.getOpacity(i);
      this.beamInstanceData[off + 6] = beams.colorR[i] / 255;
      this.beamInstanceData[off + 7] = beams.colorG[i] / 255;
      this.beamInstanceData[off + 8] = beams.colorB[i] / 255;
    }

    gl.bindVertexArray(this.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamInstanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.beamInstanceData.subarray(0, beams.count * STRIDE), gl.DYNAMIC_DRAW);

    const bpe = 4;
    for (let a = 1; a <= 5; a++) gl.enableVertexAttribArray(a);

    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE * bpe, 0);       // aFrom
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE * bpe, 2 * bpe); // aTo
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE * bpe, 4 * bpe); // aProgress
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, STRIDE * bpe, 5 * bpe); // aOpacity
    gl.vertexAttribPointer(5, 3, gl.FLOAT, false, STRIDE * bpe, 6 * bpe); // aColor

    for (let a = 1; a <= 5; a++) gl.vertexAttribDivisor(a, 1);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for beams
    gl.drawArraysInstanced(gl.LINES, 0, 2, beams.count);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (let a = 1; a <= 5; a++) {
      gl.vertexAttribDivisor(a, 0);
      gl.disableVertexAttribArray(a);
    }
    gl.bindVertexArray(null);
  }

  private renderParticles(
    gl: WebGL2RenderingContext,
    particles: ParticlePool,
    viewMatrix: Float32Array,
  ): void {
    if (particles.count === 0) return;

    const prog = this.particleProgram!;
    gl.useProgram(prog.program);
    gl.uniformMatrix3fv(prog.uniforms.get('uViewMatrix')!, false, viewMatrix);
    gl.uniform1f(prog.uniforms.get('uPixelRatio')!, this.pixelRatio);

    // Build instance data: position(2) + size(1) + opacity(1) + color(3) = 7 floats
    const STRIDE = 7;
    if (this.particleInstanceData.length < particles.count * STRIDE) {
      this.particleInstanceData = new Float32Array(particles.capacity * STRIDE);
    }

    for (let i = 0; i < particles.count; i++) {
      const off = i * STRIDE;
      this.particleInstanceData[off] = particles.getX(i);
      this.particleInstanceData[off + 1] = particles.getY(i);
      this.particleInstanceData[off + 2] = particles.getSize(i);
      this.particleInstanceData[off + 3] = particles.getOpacity(i);
      this.particleInstanceData[off + 4] = particles.colorR[i] / 255;
      this.particleInstanceData[off + 5] = particles.colorG[i] / 255;
      this.particleInstanceData[off + 6] = particles.colorB[i] / 255;
    }

    // Particles use point sprites — no VAO with vertex buffer needed
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleInstanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.particleInstanceData.subarray(0, particles.count * STRIDE), gl.DYNAMIC_DRAW);

    const bpe = 4;
    for (let a = 0; a <= 3; a++) gl.enableVertexAttribArray(a);

    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE * bpe, 0);       // aPosition
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, STRIDE * bpe, 2 * bpe); // aSize
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE * bpe, 3 * bpe); // aOpacity
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, STRIDE * bpe, 4 * bpe); // aColor

    for (let a = 0; a <= 3; a++) gl.vertexAttribDivisor(a, 1);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive for particles
    gl.drawArraysInstanced(gl.POINTS, 0, 1, particles.count);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (let a = 0; a <= 3; a++) {
      gl.vertexAttribDivisor(a, 0);
      gl.disableVertexAttribArray(a);
    }
  }

  private renderContributors(
    gl: WebGL2RenderingContext,
    contributors: Map<string, GourceContributor>,
    viewport: Bounds,
    viewMatrix: Float32Array,
    camera: GourceCamera,
  ): void {
    const prog = this.contributorProgram!;
    gl.useProgram(prog.program);
    gl.uniformMatrix3fv(prog.uniforms.get('uViewMatrix')!, false, viewMatrix);

    // Build instance data: position(2) + opacity(1) + color(3) + size(1) = 7 floats
    const STRIDE = 7;
    const maxContributors = contributors.size;
    if (this.contributorInstanceData.length < maxContributors * STRIDE) {
      this.contributorInstanceData = new Float32Array(maxContributors * STRIDE);
    }

    let count = 0;
    const m = 40;
    contributors.forEach((c) => {
      if (!c.isVisible || c.opacity < 0.05) return;
      if (c.x < viewport.x - m || c.x > viewport.x + viewport.width + m ||
          c.y < viewport.y - m || c.y > viewport.y + viewport.height + m) return;

      const off = count * STRIDE;
      // Parse contributor color
      const rgb = parseContributorColor(c.color);

      this.contributorInstanceData[off] = c.x;
      this.contributorInstanceData[off + 1] = c.y;
      this.contributorInstanceData[off + 2] = c.opacity;
      this.contributorInstanceData[off + 3] = rgb.r / 255;
      this.contributorInstanceData[off + 4] = rgb.g / 255;
      this.contributorInstanceData[off + 5] = rgb.b / 255;
      this.contributorInstanceData[off + 6] = 12; // avatar half-size

      count++;
    });

    if (count === 0) return;

    gl.bindVertexArray(this.quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.contributorInstanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.contributorInstanceData.subarray(0, count * STRIDE), gl.DYNAMIC_DRAW);

    const bpe = 4;
    for (let a = 1; a <= 4; a++) gl.enableVertexAttribArray(a);

    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE * bpe, 0);       // aPosition
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE * bpe, 2 * bpe); // aOpacity
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, STRIDE * bpe, 3 * bpe); // aColor
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, STRIDE * bpe, 6 * bpe); // aSize

    for (let a = 1; a <= 4; a++) gl.vertexAttribDivisor(a, 1);

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);

    for (let a = 1; a <= 4; a++) {
      gl.vertexAttribDivisor(a, 0);
      gl.disableVertexAttribArray(a);
    }
    gl.bindVertexArray(null);
  }

  private renderHUD(scene: RenderSceneData): void {
    if (!this.hudCtx || !this.hudCanvas) return;

    const ctx = this.hudCtx;
    const w = this.width;
    const h = this.height;
    const pr = this.pixelRatio;

    ctx.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
    ctx.save();
    ctx.scale(pr, pr);

    // Date overlay
    const dateStr = scene.currentDate;
    const fontSize = Math.min(28, w * 0.035);
    ctx.font = `bold ${fontSize}px "SF Mono", "Fira Code", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    const dateWidth = ctx.measureText(dateStr).width;
    const px = 16, py = 8;
    const boxX = w - 20 - dateWidth - px;
    const boxY = 16;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, dateWidth + px * 2, fontSize + py * 2, 8);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(dateStr, w - 20 - px + 4, boxY + py);

    // Stats
    const nodeCount = scene.buffers.count;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px -apple-system, system-ui, sans-serif';
    ctx.fillText(
      `${nodeCount} nodes · ${scene.fps} fps`,
      w - 20 - px + 4,
      boxY + fontSize + py + 8,
    );

    ctx.restore();

    // Composite HUD onto WebGL canvas using CSS layering
    // The HUD canvas is positioned on top of the WebGL canvas in the DOM
  }
}

// =============================================================================
// HELPERS
// =============================================================================

let _ccCtx: CanvasRenderingContext2D | null = null;

function parseContributorColor(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#') && color.length >= 7) {
    return {
      r: parseInt(color.slice(1, 3), 16),
      g: parseInt(color.slice(3, 5), 16),
      b: parseInt(color.slice(5, 7), 16),
    };
  }
  if (color.startsWith('rgb')) {
    const m = color.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      return { r: Math.round(+m[0]), g: Math.round(+m[1]), b: Math.round(+m[2]) };
    }
  }
  // Use canvas to normalize
  if (typeof document !== 'undefined') {
    if (!_ccCtx) {
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      _ccCtx = c.getContext('2d')!;
    }
    if (_ccCtx) {
      _ccCtx.fillStyle = '#808080';
      _ccCtx.fillStyle = color;
      const hex = _ccCtx.fillStyle;
      if (hex.startsWith('#')) {
        return {
          r: parseInt(hex.slice(1, 3), 16),
          g: parseInt(hex.slice(3, 5), 16),
          b: parseInt(hex.slice(5, 7), 16),
        };
      }
    }
  }
  return { r: 128, g: 128, b: 128 };
}

// =============================================================================
// WEBGL2 FEATURE DETECTION
// =============================================================================

/** Detect whether WebGL2 with required extensions is available. */
export function isWebGL2Available(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl) {
      // Check for required extensions
      const hasFloat = gl.getExtension('EXT_color_buffer_float');
      canvas.remove();
      return !!hasFloat;
    }
    canvas.remove();
  } catch {
    // ignore
  }
  return false;
}
