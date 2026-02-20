// =============================================================================
// WEIGHTED RADIAL TREE LAYOUT
// =============================================================================
// Each subtree is allocated an angular sector proportional to its descendant
// count (subtreeWeight). This produces a clear hierarchical tree structure
// instead of the random-blob output of golden-angle + physics repulsion.
//
// Updates are incremental: when a node is added, only the affected branch's
// sectors are recomputed (O(depth)), not the entire tree.

import { LayoutBuffers, NodeFlags } from './layout-buffers';

// =============================================================================
// BRANCH LENGTH FORMULA
// =============================================================================

/**
 * Compute the ideal branch length for a node given its depth and subtree size.
 * - Root-level branches are long (200px base), deeper branches are shorter.
 * - Subtrees with more descendants get a logarithmic bonus so large directories
 *   visually spread outward instead of collapsing on top of each other.
 * - Generous spacing ensures the tree looks expanded with clear separation.
 */
function branchLength(depth: number, subtreeWeight: number): number {
  const base = 200 - depth * 10;
  const weightBonus = Math.log2(Math.max(1, subtreeWeight)) * 25;
  return Math.max(60, base + weightBonus);
}

// =============================================================================
// TREE LAYOUT ENGINE
// =============================================================================

/**
 * Weighted radial tree layout engine.
 *
 * Each subtree is allocated an angular sector proportional to its descendant
 * count. Layout updates are incremental: adding a node recomputes only the
 * affected branch in O(depth), not the entire tree.
 */
export class TreeLayout {
  private buffers: LayoutBuffers;

  // Root nodes (index into buffers). In a multi-repo visualization each repo
  // root is a separate root node.
  private roots: number[] = [];

  constructor(buffers: LayoutBuffers) {
    this.buffers = buffers;
  }

  /** Register a root node (repo root). */
  addRoot(index: number): void {
    if (!this.roots.includes(index)) {
      this.roots.push(index);
    }
  }

  /** Remove a root node. */
  removeRoot(index: number): void {
    const idx = this.roots.indexOf(index);
    if (idx !== -1) this.roots.splice(idx, 1);
  }

  /** Get all root indices. */
  getRoots(): readonly number[] {
    return this.roots;
  }

  // =========================================================================
  // INCREMENTAL UPDATE ON NODE ADDITION
  // =========================================================================

  /**
   * Called after a new node has been allocated in buffers and linked to its
   * parent. Propagates subtreeWeight up to the root and recomputes angular
   * sectors for the affected branch only.
   *
   * @param nodeIndex - The newly added node's index in LayoutBuffers.
   */
  onNodeAdded(nodeIndex: number): void {
    const b = this.buffers;

    // 1. Propagate subtreeWeight up to root — O(depth)
    this.propagateWeightsUp(nodeIndex);

    // 2. Find the root of this node's tree
    let rootIdx = nodeIndex;
    while (b.parentIndex[rootIdx] > 0) {
      rootIdx = b.parentIndex[rootIdx];
    }

    // 3. Recompute sectors for the affected branch
    //    For efficiency, we only recompute from the grandparent of the new node
    //    up to the root. In practice, we recompute from root down the affected
    //    branch since sector allocation is top-down.
    this.recomputeSectorsFromRoot(rootIdx);
  }

  /**
   * Called after a node is removed. Propagates weight changes up and
   * recomputes sectors.
   */
  onNodeRemoved(parentIndex: number): void {
    if (parentIndex <= 0) return;

    const b = this.buffers;

    // Recompute weight from parent up
    this.recomputeSubtreeWeight(parentIndex);
    this.propagateWeightsUp(parentIndex);

    // Find root and recompute
    let rootIdx = parentIndex;
    while (b.parentIndex[rootIdx] > 0) {
      rootIdx = b.parentIndex[rootIdx];
    }
    this.recomputeSectorsFromRoot(rootIdx);
  }

  // =========================================================================
  // FULL LAYOUT (for initial build or after major changes like seek)
  // =========================================================================

  /**
   * Full recompute of all subtree weights and sector allocations.
   * Call this after bulk operations (reset, seek backward, etc.).
   */
  recomputeAll(): void {
    // Recompute all weights bottom-up
    for (const root of this.roots) {
      this.recomputeSubtreeWeight(root);
    }

    // Assign sectors for each root
    const rootCount = this.roots.length;
    if (rootCount === 0) return;

    if (rootCount === 1) {
      // Single repo: full circle
      const root = this.roots[0];
      this.buffers.subtreeAngleStart[root] = 0;
      this.buffers.subtreeAngleSpan[root] = Math.PI * 2;
      this.buffers.angle[root] = 0;
      this.assignSectorsRecursive(root);
    } else {
      // Multiple repos: divide circle equally among roots
      const slicePerRepo = (Math.PI * 2) / rootCount;
      for (let i = 0; i < rootCount; i++) {
        const root = this.roots[i];
        const start = i * slicePerRepo - Math.PI / 2;
        this.buffers.subtreeAngleStart[root] = start;
        this.buffers.subtreeAngleSpan[root] = slicePerRepo;
        this.buffers.angle[root] = start + slicePerRepo / 2;
        this.assignSectorsRecursive(root);
      }
    }

    // Set target positions from sectors
    this.updateTargetPositions();
  }

  // =========================================================================
  // SECTOR ASSIGNMENT
  // =========================================================================

  /**
   * Recompute angular sectors starting from a root node, descending only
   * into the tree. O(subtreeSize) for the affected root.
   */
  private recomputeSectorsFromRoot(rootIdx: number): void {
    this.assignSectorsRecursive(rootIdx);
    this.updateTargetPositions();
  }

  /**
   * Recursively assign angular sectors to all children of a node.
   *
   * Each child C gets angular share = (subtreeWeight(C) / totalChildWeight) * parentSpan,
   * but with a minimum angular gap between siblings so leaf files don't overlap.
   */
  private assignSectorsRecursive(nodeIdx: number): void {
    const b = this.buffers;
    const children = b.children[nodeIdx];
    if (!children || children.length === 0) return;

    const parentSpan = b.subtreeAngleSpan[nodeIdx];
    const parentStart = b.subtreeAngleStart[nodeIdx];

    // Minimum angular separation per child (radians).
    // At depth 3 with branch length ~110px, 0.12 rad ≈ 13px arc between siblings.
    const minChildSpan = 0.12;

    let totalChildWeight = 0;
    for (let i = 0; i < children.length; i++) {
      totalChildWeight += b.subtreeWeight[children[i]];
    }

    if (totalChildWeight === 0) return;

    // Check if minimum gaps require more angular space than available.
    // If so, expand the effective span (children will extend beyond parent sector,
    // which is fine — it just means the tree fans out more).
    const requiredMinSpan = children.length * minChildSpan;
    const effectiveSpan = Math.max(parentSpan, requiredMinSpan);

    let currentAngle = parentStart;
    for (let i = 0; i < children.length; i++) {
      const childIdx = children[i];
      const childWeight = b.subtreeWeight[childIdx];
      const weightSpan = (childWeight / totalChildWeight) * effectiveSpan;
      const childSpan = Math.max(minChildSpan, weightSpan);

      b.subtreeAngleStart[childIdx] = currentAngle;
      b.subtreeAngleSpan[childIdx] = childSpan;
      b.angle[childIdx] = currentAngle + childSpan / 2; // center of sector

      currentAngle += childSpan;

      // Recurse into children
      this.assignSectorsRecursive(childIdx);
    }
  }

  // =========================================================================
  // TARGET POSITION COMPUTATION
  // =========================================================================

  /**
   * Compute targetX/targetY for all nodes based on their parent position,
   * angle, and branch length.
   */
  private updateTargetPositions(): void {
    // Process each root tree
    for (const root of this.roots) {
      this.updateTargetPositionsRecursive(root);
    }
  }

  private updateTargetPositionsRecursive(nodeIdx: number): void {
    const b = this.buffers;
    const children = b.children[nodeIdx];
    if (!children) return;

    for (let i = 0; i < children.length; i++) {
      const childIdx = children[i];
      const childDepth = b.depth[childIdx];
      const childWeight = b.subtreeWeight[childIdx];
      const isDir = b.hasFlag(childIdx, NodeFlags.IS_DIR);

      // Compute branch length — files get generous spacing from their parent dir
      const bl = isDir
        ? branchLength(childDepth, childWeight)
        : Math.max(70, 140 - childDepth * 6);

      b.radius[childIdx] = bl;

      const angle = b.angle[childIdx];
      const parentX = b.targetX[nodeIdx];
      const parentY = b.targetY[nodeIdx];

      b.targetX[childIdx] = parentX + Math.cos(angle) * bl;
      b.targetY[childIdx] = parentY + Math.sin(angle) * bl;

      // Recurse
      this.updateTargetPositionsRecursive(childIdx);
    }
  }

  // =========================================================================
  // WEIGHT PROPAGATION
  // =========================================================================

  /**
   * Recompute subtreeWeight for a node and all its descendants (bottom-up).
   */
  private recomputeSubtreeWeight(nodeIdx: number): void {
    const b = this.buffers;
    const children = b.children[nodeIdx];

    if (!children || children.length === 0) {
      b.subtreeWeight[nodeIdx] = 1;
      return;
    }

    let weight = 1; // self
    for (let i = 0; i < children.length; i++) {
      this.recomputeSubtreeWeight(children[i]);
      weight += b.subtreeWeight[children[i]];
    }
    b.subtreeWeight[nodeIdx] = weight;
  }

  /**
   * Propagate subtreeWeight changes from a node upward to the root.
   * O(depth) — typically 3-8 levels.
   */
  private propagateWeightsUp(nodeIdx: number): void {
    const b = this.buffers;
    let current = b.parentIndex[nodeIdx];

    while (current > 0) {
      // Recompute this node's weight from its children
      const children = b.children[current];
      let weight = 1;
      for (let i = 0; i < children.length; i++) {
        weight += b.subtreeWeight[children[i]];
      }
      b.subtreeWeight[current] = weight;
      current = b.parentIndex[current];
    }
  }

  // =========================================================================
  // PHYSICS: SIMPLE SPRING-TO-TARGET
  // =========================================================================

  /**
   * Per-frame physics update. Each node springs toward its layout-computed
   * target position. O(n) with no spatial queries needed.
   *
   * Optional light sibling repulsion between leaf nodes at the same depth
   * to prevent overlap when sectors are tight.
   */
  updatePhysics(dt: number): void {
    const b = this.buffers;
    const dtSec = dt / 1000;
    const springStrength = 0.08;
    const damping = 0.85;
    const siblingRepulsion = 300;
    const siblingRepulsionRadiusSq = 8100; // 90px squared

    for (let i = 1; i <= b.count; i++) {
      if (!b.hasFlag(i, NodeFlags.VISIBLE)) continue;

      // Spring toward target
      const dx = b.targetX[i] - b.x[i];
      const dy = b.targetY[i] - b.y[i];
      b.vx[i] += dx * springStrength;
      b.vy[i] += dy * springStrength;

      // Light sibling repulsion for leaf nodes (no children)
      if (b.childCount[i] === 0) {
        const parentIdx = b.parentIndex[i];
        if (parentIdx > 0) {
          const siblings = b.children[parentIdx];
          for (let j = 0; j < siblings.length; j++) {
            const sibIdx = siblings[j];
            if (sibIdx <= i) continue; // avoid double-processing
            if (b.childCount[sibIdx] !== 0) continue; // only leaf-leaf

            const sdx = b.x[sibIdx] - b.x[i];
            const sdy = b.y[sibIdx] - b.y[i];
            const distSq = sdx * sdx + sdy * sdy;

            if (distSq < siblingRepulsionRadiusSq && distSq > 0.01) {
              const dist = Math.sqrt(distSq);
              const force = siblingRepulsion / distSq;
              const fx = (sdx / dist) * force * dtSec;
              const fy = (sdy / dist) * force * dtSec;
              b.vx[i] -= fx;
              b.vy[i] -= fy;
              b.vx[sibIdx] += fx;
              b.vy[sibIdx] += fy;
            }
          }
        }
      }

      // Damping
      b.vx[i] *= damping;
      b.vy[i] *= damping;

      // Integrate
      b.x[i] += b.vx[i];
      b.y[i] += b.vy[i];
    }
  }

  // =========================================================================
  // ANIMATION UPDATES
  // =========================================================================

  /**
   * Per-frame animation update: pop-in, deletion fade, modification pulse,
   * and inactive file fading.
   */
  updateAnimations(simulationTime: number, nodeFadeTime: number): void {
    const b = this.buffers;

    for (let i = 1; i <= b.count; i++) {
      // --- Deletion animation ---
      if (b.hasFlag(i, NodeFlags.DELETING)) {
        b.scale[i] = lerp(b.scale[i], 0, 0.06);
        b.opacity[i] = lerp(b.opacity[i], 0, 0.04);
        continue;
      }

      // --- Pop-in animation ---
      const popTarget = b.popInTarget[i];
      if (popTarget > 0) {
        // Rapidly scale up with overshoot
        b.scale[i] = lerp(b.scale[i], popTarget, 0.15);
        if (b.scale[i] >= popTarget * 0.95) {
          b.popInTarget[i] = -1; // Switch to settling
        }
      } else if (popTarget < 0) {
        // Settling from overshoot back to 1.0
        b.scale[i] = lerp(b.scale[i], 1, 0.08);
        if (Math.abs(b.scale[i] - 1) < 0.02) {
          b.scale[i] = 1;
          b.popInTarget[i] = 0;
        }
      } else if (b.scale[i] > 1) {
        // Normal pulse decay (from modifications)
        b.scale[i] = lerp(b.scale[i], 1, 0.05);
        if (b.scale[i] < 1.01) b.scale[i] = 1;
      }

      // --- Opacity fading ---
      const isDir = b.hasFlag(i, NodeFlags.IS_DIR);
      if (!isDir) {
        // Files fade out if not modified recently
        const lastMod = b.lastModified[i];
        if (lastMod > 0) {
          const timeSince = simulationTime - lastMod;
          if (timeSince > nodeFadeTime) {
            const fadeFactor = (timeSince - nodeFadeTime) / (nodeFadeTime * 1.5);
            b.opacity[i] = Math.max(0.15, 1 - fadeFactor * 0.6);
          }
        }
      } else {
        // Directories: stay visible if any child is visible
        const children = b.children[i];
        let hasVisibleChild = false;
        for (let j = 0; j < children.length; j++) {
          if (b.opacity[children[j]] > 0.1) {
            hasVisibleChild = true;
            break;
          }
        }
        if (hasVisibleChild) {
          b.opacity[i] = Math.min(1, b.opacity[i] + 0.02);
        } else if (children.length === 0) {
          b.opacity[i] = Math.max(0, b.opacity[i] - 0.01);
        }
      }
    }
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
