import type {
  GourceNode,
  GourceCommitEvent,
  GourceFileChange,
  GourceSettings,
  QuadTreeBounds,
  Point,
  Bounds,
  FileCategory,
} from '@/lib/types';
import {
  FileCategory as FileCategoryEnum,
  FILE_EXTENSION_CATEGORIES,
  FILE_CATEGORY_COLORS,
} from '@/lib/types';

// =============================================================================
// QUADTREE SPATIAL INDEX
// =============================================================================

interface QuadTreeItem {
  id: string;
  x: number;
  y: number;
}

class QuadTree<T extends QuadTreeItem> {
  private bounds: QuadTreeBounds;
  private items: T[];
  private children: QuadTree<T>[] | null;
  private depth: number;
  private maxDepth: number;
  private maxItems: number;

  constructor(
    bounds: QuadTreeBounds,
    maxDepth: number = 8,
    maxItems: number = 8,
    depth: number = 0
  ) {
    this.bounds = bounds;
    this.items = [];
    this.children = null;
    this.depth = depth;
    this.maxDepth = maxDepth;
    this.maxItems = maxItems;
  }

  clear(): void {
    this.items = [];
    this.children = null;
  }

  insert(item: T): boolean {
    if (!this.containsPoint(item.x, item.y)) {
      return false;
    }

    if (this.children === null) {
      this.items.push(item);

      if (this.items.length > this.maxItems && this.depth < this.maxDepth) {
        this.subdivide();
      }
      return true;
    }

    for (const child of this.children) {
      if (child.insert(item)) {
        return true;
      }
    }

    // Fallback: store in this node if no child accepts it
    this.items.push(item);
    return true;
  }

  remove(id: string): boolean {
    const idx = this.items.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.items.splice(idx, 1);
      return true;
    }

    if (this.children !== null) {
      for (const child of this.children) {
        if (child.remove(id)) {
          return true;
        }
      }
    }

    return false;
  }

  queryRange(range: QuadTreeBounds): T[] {
    const found: T[] = [];

    if (!this.intersects(range)) {
      return found;
    }

    for (const item of this.items) {
      if (
        item.x >= range.x &&
        item.x <= range.x + range.width &&
        item.y >= range.y &&
        item.y <= range.y + range.height
      ) {
        found.push(item);
      }
    }

    if (this.children !== null) {
      for (const child of this.children) {
        found.push(...child.queryRange(range));
      }
    }

    return found;
  }

  queryRadius(cx: number, cy: number, radius: number): T[] {
    const rangeBounds: QuadTreeBounds = {
      x: cx - radius,
      y: cy - radius,
      width: radius * 2,
      height: radius * 2,
    };

    const candidates = this.queryRange(rangeBounds);
    const r2 = radius * radius;

    return candidates.filter((item) => {
      const dx = item.x - cx;
      const dy = item.y - cy;
      return dx * dx + dy * dy <= r2;
    });
  }

  getAllItems(): T[] {
    const all: T[] = [...this.items];
    if (this.children !== null) {
      for (const child of this.children) {
        all.push(...child.getAllItems());
      }
    }
    return all;
  }

  private subdivide(): void {
    const { x, y, width, height } = this.bounds;
    const hw = width / 2;
    const hh = height / 2;

    this.children = [
      new QuadTree<T>({ x, y, width: hw, height: hh }, this.maxDepth, this.maxItems, this.depth + 1),
      new QuadTree<T>({ x: x + hw, y, width: hw, height: hh }, this.maxDepth, this.maxItems, this.depth + 1),
      new QuadTree<T>({ x, y: y + hh, width: hw, height: hh }, this.maxDepth, this.maxItems, this.depth + 1),
      new QuadTree<T>({ x: x + hw, y: y + hh, width: hw, height: hh }, this.maxDepth, this.maxItems, this.depth + 1),
    ];

    const existingItems = [...this.items];
    this.items = [];

    for (const item of existingItems) {
      let inserted = false;
      for (const child of this.children) {
        if (child.insert(item)) {
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this.items.push(item);
      }
    }
  }

  private containsPoint(px: number, py: number): boolean {
    return (
      px >= this.bounds.x &&
      px <= this.bounds.x + this.bounds.width &&
      py >= this.bounds.y &&
      py <= this.bounds.y + this.bounds.height
    );
  }

  private intersects(range: QuadTreeBounds): boolean {
    return !(
      range.x > this.bounds.x + this.bounds.width ||
      range.x + range.width < this.bounds.x ||
      range.y > this.bounds.y + this.bounds.height ||
      range.y + range.height < this.bounds.y
    );
  }
}

// =============================================================================
// LAYOUT STATE
// =============================================================================

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  mass: number;
  pinned: boolean;
  isDirectory: boolean;
  parentId: string | null;
  depth: number;
  angle: number;
  radius: number;
  childCount: number;
}

interface LayoutEdge {
  sourceId: string;
  targetId: string;
  restLength: number;
  stiffness: number;
}

// =============================================================================
// GOURCE LAYOUT CLASS
// =============================================================================

export class GourceLayout {
  private nodes: Map<string, GourceNode> = new Map();
  private layoutNodes: Map<string, LayoutNode> = new Map();
  private edges: LayoutEdge[] = [];
  private quadTree: QuadTree<QuadTreeItem>;
  private rootNodes: Set<string> = new Set();
  private repoRoots: Map<string, string> = new Map(); // repoId -> rootNodeId
  private commitIndex: number = 0;
  private sortedEvents: GourceCommitEvent[] = [];
  private processedCommits: Set<string> = new Set();

  // Physics parameters
  private springStiffness: number = 0.01;
  private repulsionForce: number = 100;
  private damping: number = 0.92;
  private centerGravity: number = 0.001;
  private maxVelocity: number = 8;
  private theta: number = 0.8; // Barnes-Hut approximation threshold

  // Layout dimensions
  private worldBounds: QuadTreeBounds = {
    x: -5000,
    y: -5000,
    width: 10000,
    height: 10000,
  };

  // Color assignments per repo
  private repoColors: Map<string, string> = new Map();
  private repoColorPalette: string[] = [
    '#60a5fa', '#f97316', '#a78bfa', '#34d399', '#fb923c',
    '#f472b6', '#fbbf24', '#2dd4bf', '#818cf8', '#e879f9',
    '#22d3ee', '#a3e635', '#f43f5e', '#14b8a6', '#8b5cf6',
  ];

  constructor() {
    this.quadTree = new QuadTree<QuadTreeItem>(this.worldBounds, 10, 12);
  }

  /**
   * Initialize the layout with commit data sorted by timestamp.
   */
  initialize(
    commitEvents: GourceCommitEvent[],
    settings?: Partial<{
      springStiffness: number;
      repulsionForce: number;
    }>
  ): void {
    this.nodes.clear();
    this.layoutNodes.clear();
    this.edges = [];
    this.rootNodes.clear();
    this.repoRoots.clear();
    this.commitIndex = 0;
    this.processedCommits.clear();

    if (settings?.springStiffness !== undefined) {
      this.springStiffness = settings.springStiffness;
    }
    if (settings?.repulsionForce !== undefined) {
      this.repulsionForce = settings.repulsionForce;
    }

    // Sort events by timestamp
    this.sortedEvents = [...commitEvents].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    // Assign colors to repos
    const repoIds = new Set(this.sortedEvents.map((e) => e.repoId));
    let colorIdx = 0;
    for (const repoId of repoIds) {
      this.repoColors.set(
        repoId,
        this.repoColorPalette[colorIdx % this.repoColorPalette.length]
      );
      colorIdx++;
    }
  }

  /**
   * Update layout for the given simulation time.
   * Processes new commits up to currentTime, then runs physics simulation.
   */
  update(
    currentTime: number,
    deltaTime: number = 16
  ): {
    nodes: GourceNode[];
    edges: Array<{ sourceId: string; targetId: string; sourceX: number; sourceY: number; targetX: number; targetY: number }>;
    newCommitEvents: GourceCommitEvent[];
  } {
    // Process new commits up to currentTime
    const newEvents = this.processCommitsUpTo(currentTime);

    // Run physics simulation
    const dt = Math.min(deltaTime / 1000, 0.05); // Cap at 50ms
    this.applyForces(dt);
    this.integratePositions(dt);
    this.rebuildQuadTree();

    // Update GourceNode positions from layout nodes
    this.syncNodePositions();

    // Build edge list for renderer
    const renderedEdges = this.edges.map((edge) => {
      const source = this.layoutNodes.get(edge.sourceId);
      const target = this.layoutNodes.get(edge.targetId);
      return {
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        sourceX: source?.x ?? 0,
        sourceY: source?.y ?? 0,
        targetX: target?.x ?? 0,
        targetY: target?.y ?? 0,
      };
    });

    return {
      nodes: Array.from(this.nodes.values()),
      edges: renderedEdges,
      newCommitEvents: newEvents,
    };
  }

  /**
   * Process all commits with timestamp <= currentTime.
   */
  private processCommitsUpTo(currentTime: number): GourceCommitEvent[] {
    const newEvents: GourceCommitEvent[] = [];

    while (
      this.commitIndex < this.sortedEvents.length &&
      this.sortedEvents[this.commitIndex].timestamp <= currentTime
    ) {
      const event = this.sortedEvents[this.commitIndex];
      if (!this.processedCommits.has(event.sha)) {
        this.addCommit(event);
        this.processedCommits.add(event.sha);
        newEvents.push(event);
      }
      this.commitIndex++;
    }

    return newEvents;
  }

  /**
   * Add a single commit to the layout, creating/updating nodes as needed.
   */
  addCommit(event: GourceCommitEvent): void {
    const { repoId, affectedFiles, timestamp } = event;

    // Ensure repo root exists
    if (!this.repoRoots.has(repoId)) {
      this.createRepoRoot(repoId);
    }

    for (const fileChange of affectedFiles) {
      if (fileChange.type === 'delete') {
        this.removeFileNode(repoId, fileChange.path);
      } else {
        this.ensureFileNode(repoId, fileChange.path, timestamp);
      }
    }
  }

  /**
   * Create the root node for a repository.
   */
  private createRepoRoot(repoId: string): void {
    const rootId = `${repoId}:/`;

    // Position repo roots in a circle around the center
    const existingRoots = this.repoRoots.size;
    const angle = (existingRoots * Math.PI * 2) / Math.max(1, existingRoots + 1);
    const spreadRadius = 200 + existingRoots * 100;

    const x = Math.cos(angle) * spreadRadius;
    const y = Math.sin(angle) * spreadRadius;

    const node: GourceNode = {
      id: rootId,
      name: repoId.split('/').pop() || repoId,
      path: '/',
      parentId: null,
      isDirectory: true,
      children: [],
      extension: '',
      category: FileCategoryEnum.OTHER,
      repoId,
      x,
      y,
      targetX: x,
      targetY: y,
      vx: 0,
      vy: 0,
      color: this.repoColors.get(repoId) || '#60a5fa',
      opacity: 1,
      scale: 1,
      lastModified: 0,
      modificationCount: 0,
      isVisible: true,
      depth: 0,
      angle,
      radius: 0,
    };

    this.nodes.set(rootId, node);
    this.rootNodes.add(rootId);
    this.repoRoots.set(repoId, rootId);

    const layoutNode: LayoutNode = {
      id: rootId,
      x,
      y,
      targetX: x,
      targetY: y,
      vx: 0,
      vy: 0,
      mass: 5,
      pinned: false,
      isDirectory: true,
      parentId: null,
      depth: 0,
      angle,
      radius: 0,
      childCount: 0,
    };

    this.layoutNodes.set(rootId, layoutNode);
  }

  /**
   * Ensure all directory nodes along a file path exist, then create/update the file node.
   */
  private ensureFileNode(
    repoId: string,
    filePath: string,
    timestamp: number
  ): void {
    const parts = filePath.split('/').filter(Boolean);
    if (parts.length === 0) return;

    const rootId = this.repoRoots.get(repoId);
    if (!rootId) return;

    let parentId = rootId;
    let currentPath = '';

    // Create directory nodes
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += '/' + parts[i];
      const dirId = `${repoId}:${currentPath}`;

      if (!this.nodes.has(dirId)) {
        this.createDirectoryNode(dirId, parts[i], currentPath, parentId, repoId, i + 1, timestamp);
      } else {
        // Update modification time
        const existing = this.nodes.get(dirId)!;
        existing.lastModified = timestamp;
        existing.modificationCount++;
      }

      parentId = dirId;
    }

    // Create/update file node
    const fileName = parts[parts.length - 1];
    currentPath += '/' + fileName;
    const fileId = `${repoId}:${currentPath}`;

    if (!this.nodes.has(fileId)) {
      this.createFileNode(
        fileId,
        fileName,
        currentPath,
        parentId,
        repoId,
        parts.length,
        timestamp
      );
    } else {
      const existing = this.nodes.get(fileId)!;
      existing.lastModified = timestamp;
      existing.modificationCount++;
      existing.opacity = 1;
      existing.scale = 1.5; // Pulse on modification
    }
  }

  /**
   * Create a directory node with initial position based on radial layout.
   */
  private createDirectoryNode(
    id: string,
    name: string,
    path: string,
    parentId: string,
    repoId: string,
    depth: number,
    timestamp: number
  ): void {
    const parent = this.layoutNodes.get(parentId);
    if (!parent) return;

    // Radial placement
    const siblingCount = parent.childCount;
    const angleSpread = Math.PI * 2;
    const angle = parent.angle + (siblingCount * angleSpread) / Math.max(siblingCount + 1, 4);
    const radius = 60 + depth * 30;

    const x = parent.x + Math.cos(angle) * radius + (Math.random() - 0.5) * 20;
    const y = parent.y + Math.sin(angle) * radius + (Math.random() - 0.5) * 20;

    parent.childCount++;

    const node: GourceNode = {
      id,
      name,
      path,
      parentId,
      isDirectory: true,
      children: [],
      extension: '',
      category: FileCategoryEnum.OTHER,
      repoId,
      x,
      y,
      targetX: x,
      targetY: y,
      vx: 0,
      vy: 0,
      color: this.repoColors.get(repoId) || '#60a5fa',
      opacity: 1,
      scale: 1,
      lastModified: timestamp,
      modificationCount: 1,
      isVisible: true,
      depth,
      angle,
      radius,
    };

    this.nodes.set(id, node);

    // Add to parent's children
    const parentNode = this.nodes.get(parentId);
    if (parentNode && !parentNode.children.includes(id)) {
      parentNode.children.push(id);
    }

    const layoutNode: LayoutNode = {
      id,
      x,
      y,
      targetX: x,
      targetY: y,
      vx: 0,
      vy: 0,
      mass: 3,
      pinned: false,
      isDirectory: true,
      parentId,
      depth,
      angle,
      radius,
      childCount: 0,
    };

    this.layoutNodes.set(id, layoutNode);

    // Create edge from parent to this directory
    this.edges.push({
      sourceId: parentId,
      targetId: id,
      restLength: radius,
      stiffness: this.springStiffness * (1 + 1 / (depth + 1)),
    });
  }

  /**
   * Create a file (leaf) node.
   */
  private createFileNode(
    id: string,
    name: string,
    path: string,
    parentId: string,
    repoId: string,
    depth: number,
    timestamp: number
  ): void {
    const parent = this.layoutNodes.get(parentId);
    if (!parent) return;

    const ext = this.getExtension(name);
    const category = this.getFileCategory(ext);
    const color = FILE_CATEGORY_COLORS[category] || '#94a3b8';

    const siblingCount = parent.childCount;
    const angleOffset = (siblingCount * Math.PI * 2) / Math.max(siblingCount + 3, 6);
    const angle = parent.angle + angleOffset + (Math.random() - 0.5) * 0.5;
    const radius = 30 + Math.random() * 20;

    const x = parent.x + Math.cos(angle) * radius + (Math.random() - 0.5) * 10;
    const y = parent.y + Math.sin(angle) * radius + (Math.random() - 0.5) * 10;

    parent.childCount++;

    const node: GourceNode = {
      id,
      name,
      path,
      parentId,
      isDirectory: false,
      children: [],
      extension: ext,
      category,
      repoId,
      x,
      y,
      targetX: x,
      targetY: y,
      vx: 0,
      vy: 0,
      color,
      opacity: 1,
      scale: 1.5, // Start bigger for animation
      lastModified: timestamp,
      modificationCount: 1,
      isVisible: true,
      depth,
      angle,
      radius,
    };

    this.nodes.set(id, node);

    // Add to parent's children
    const parentNode = this.nodes.get(parentId);
    if (parentNode && !parentNode.children.includes(id)) {
      parentNode.children.push(id);
    }

    const layoutNode: LayoutNode = {
      id,
      x,
      y,
      targetX: x,
      targetY: y,
      vx: 0,
      vy: 0,
      mass: 1,
      pinned: false,
      isDirectory: false,
      parentId,
      depth,
      angle,
      radius,
      childCount: 0,
    };

    this.layoutNodes.set(id, layoutNode);

    // Create edge from parent to this file
    this.edges.push({
      sourceId: parentId,
      targetId: id,
      restLength: radius,
      stiffness: this.springStiffness * 2,
    });
  }

  /**
   * Remove a file node (on deletion commit).
   */
  private removeFileNode(repoId: string, filePath: string): void {
    const fileId = `${repoId}:/${filePath}`;
    const node = this.nodes.get(fileId);

    if (!node) return;

    // Fade out instead of immediate removal
    node.opacity = 0;
    node.isVisible = false;

    // Remove from parent's children
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter((childId) => childId !== fileId);
      }
      const parentLayout = this.layoutNodes.get(node.parentId);
      if (parentLayout) {
        parentLayout.childCount = Math.max(0, parentLayout.childCount - 1);
      }
    }

    // Remove edges involving this node
    this.edges = this.edges.filter(
      (e) => e.sourceId !== fileId && e.targetId !== fileId
    );

    // Schedule node removal
    this.nodes.delete(fileId);
    this.layoutNodes.delete(fileId);
  }

  /**
   * Apply spring forces (edges) and repulsion forces (Barnes-Hut approximation).
   */
  private applyForces(dt: number): void {
    const layoutNodesArray = Array.from(this.layoutNodes.values());

    // Reset forces
    for (const node of layoutNodesArray) {
      if (node.pinned) continue;
      node.vx *= this.damping;
      node.vy *= this.damping;
    }

    // Spring forces (attractive along edges)
    for (const edge of this.edges) {
      const source = this.layoutNodes.get(edge.sourceId);
      const target = this.layoutNodes.get(edge.targetId);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const displacement = dist - edge.restLength;

      const fx = (edge.stiffness * displacement * dx) / dist;
      const fy = (edge.stiffness * displacement * dy) / dist;

      if (!source.pinned) {
        source.vx += fx / source.mass;
        source.vy += fy / source.mass;
      }
      if (!target.pinned) {
        target.vx -= fx / target.mass;
        target.vy -= fy / target.mass;
      }
    }

    // Repulsion forces (node-node)
    // Use simple O(n^2) for small node counts, otherwise use quadtree approximation
    if (layoutNodesArray.length < 500) {
      this.applyDirectRepulsion(layoutNodesArray);
    } else {
      this.applyBarnesHutRepulsion(layoutNodesArray);
    }

    // Center gravity: pull all nodes toward origin gently
    for (const node of layoutNodesArray) {
      if (node.pinned) continue;
      node.vx -= node.x * this.centerGravity;
      node.vy -= node.y * this.centerGravity;
    }
  }

  /**
   * Direct O(n^2) repulsion for small graphs.
   */
  private applyDirectRepulsion(nodes: LayoutNode[]): void {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist2 = dx * dx + dy * dy;
        const minDist2 = 4; // Minimum distance squared

        if (dist2 < minDist2) continue;

        const dist = Math.sqrt(dist2);
        const force = this.repulsionForce / dist2;

        const fx = (force * dx) / dist;
        const fy = (force * dy) / dist;

        if (!a.pinned) {
          a.vx -= fx / a.mass;
          a.vy -= fy / a.mass;
        }
        if (!b.pinned) {
          b.vx += fx / b.mass;
          b.vy += fy / b.mass;
        }
      }
    }
  }

  /**
   * Barnes-Hut approximation for large graphs using the quadtree.
   */
  private applyBarnesHutRepulsion(nodes: LayoutNode[]): void {
    // For each node, find nearby neighbors and apply repulsion
    for (const node of nodes) {
      if (node.pinned) continue;

      // Query nearby nodes within a reasonable radius
      const queryRadius = Math.max(200, this.repulsionForce * 2);
      const nearby = this.quadTree.queryRadius(node.x, node.y, queryRadius);

      for (const neighbor of nearby) {
        if (neighbor.id === node.id) continue;

        const other = this.layoutNodes.get(neighbor.id);
        if (!other) continue;

        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dist2 = dx * dx + dy * dy;
        const minDist2 = 4;

        if (dist2 < minDist2) continue;

        const dist = Math.sqrt(dist2);
        const force = this.repulsionForce / dist2;

        const fx = (force * dx) / dist;
        const fy = (force * dy) / dist;

        node.vx -= fx / node.mass;
        node.vy -= fy / node.mass;
      }
    }
  }

  /**
   * Integrate velocity into position, clamping velocity.
   */
  private integratePositions(dt: number): void {
    for (const node of this.layoutNodes.values()) {
      if (node.pinned) continue;

      // Clamp velocity
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > this.maxVelocity) {
        const scale = this.maxVelocity / speed;
        node.vx *= scale;
        node.vy *= scale;
      }

      node.x += node.vx;
      node.y += node.vy;

      // Clamp to world bounds
      node.x = Math.max(
        this.worldBounds.x,
        Math.min(this.worldBounds.x + this.worldBounds.width, node.x)
      );
      node.y = Math.max(
        this.worldBounds.y,
        Math.min(this.worldBounds.y + this.worldBounds.height, node.y)
      );
    }
  }

  /**
   * Rebuild the quadtree from current layout node positions.
   */
  private rebuildQuadTree(): void {
    this.quadTree.clear();
    for (const node of this.layoutNodes.values()) {
      this.quadTree.insert({
        id: node.id,
        x: node.x,
        y: node.y,
      });
    }
  }

  /**
   * Sync GourceNode positions from LayoutNode positions.
   */
  private syncNodePositions(): void {
    for (const [id, layoutNode] of this.layoutNodes.entries()) {
      const node = this.nodes.get(id);
      if (!node) continue;

      node.x = layoutNode.x;
      node.y = layoutNode.y;
      node.targetX = layoutNode.targetX;
      node.targetY = layoutNode.targetY;
      node.vx = layoutNode.vx;
      node.vy = layoutNode.vy;

      // Decay scale back to 1
      if (node.scale > 1) {
        node.scale = Math.max(1, node.scale * 0.95);
      }
    }
  }

  /**
   * Get nodes visible within a viewport (for culling).
   */
  getVisibleNodes(viewport: Bounds): GourceNode[] {
    const queryBounds: QuadTreeBounds = {
      x: viewport.x,
      y: viewport.y,
      width: viewport.width,
      height: viewport.height,
    };

    const items = this.quadTree.queryRange(queryBounds);
    const visibleNodes: GourceNode[] = [];

    for (const item of items) {
      const node = this.nodes.get(item.id);
      if (node && node.isVisible) {
        visibleNodes.push(node);
      }
    }

    return visibleNodes;
  }

  /**
   * Get all current nodes.
   */
  getAllNodes(): GourceNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get a single node by ID.
   */
  getNode(id: string): GourceNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get the number of active nodes.
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get all edges.
   */
  getAllEdges(): LayoutEdge[] {
    return this.edges;
  }

  /**
   * Get the bounding box of all nodes.
   */
  getBounds(): Bounds {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of this.layoutNodes.values()) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    }

    if (minX === Infinity) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const padding = 100;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }

  /**
   * Get the center of mass of all nodes.
   */
  getCenterOfMass(): Point {
    let totalX = 0;
    let totalY = 0;
    let totalMass = 0;

    for (const node of this.layoutNodes.values()) {
      totalX += node.x * node.mass;
      totalY += node.y * node.mass;
      totalMass += node.mass;
    }

    if (totalMass === 0) return { x: 0, y: 0 };

    return {
      x: totalX / totalMass,
      y: totalY / totalMass,
    };
  }

  /**
   * Find the node closest to a given point (for hover/click detection).
   */
  findNearestNode(px: number, py: number, maxDistance: number = 30): GourceNode | null {
    const nearby = this.quadTree.queryRadius(px, py, maxDistance);

    let nearest: GourceNode | null = null;
    let nearestDist = maxDistance * maxDistance;

    for (const item of nearby) {
      const node = this.nodes.get(item.id);
      if (!node || !node.isVisible) continue;

      const dx = node.x - px;
      const dy = node.y - py;
      const dist2 = dx * dx + dy * dy;

      if (dist2 < nearestDist) {
        nearestDist = dist2;
        nearest = node;
      }
    }

    return nearest;
  }

  /**
   * Update physics settings at runtime.
   */
  setPhysicsSettings(settings: {
    springStiffness?: number;
    repulsionForce?: number;
    damping?: number;
    centerGravity?: number;
  }): void {
    if (settings.springStiffness !== undefined) {
      this.springStiffness = settings.springStiffness;
      // Update all edge stiffness proportionally
      for (const edge of this.edges) {
        edge.stiffness = this.springStiffness;
      }
    }
    if (settings.repulsionForce !== undefined) {
      this.repulsionForce = settings.repulsionForce;
    }
    if (settings.damping !== undefined) {
      this.damping = settings.damping;
    }
    if (settings.centerGravity !== undefined) {
      this.centerGravity = settings.centerGravity;
    }
  }

  /**
   * Apply fading to nodes that haven't been modified recently.
   */
  applyNodeFading(currentTime: number, fadeTime: number): void {
    for (const node of this.nodes.values()) {
      if (node.isDirectory) continue;

      const timeSinceModified = currentTime - node.lastModified;
      if (timeSinceModified > fadeTime) {
        const fadeProgress = Math.min(
          1,
          (timeSinceModified - fadeTime) / fadeTime
        );
        node.opacity = Math.max(0.15, 1 - fadeProgress * 0.85);
      } else {
        node.opacity = 1;
      }
    }
  }

  /**
   * Filter nodes to only show specific repos.
   */
  filterByRepos(repoIds: string[] | null): void {
    if (repoIds === null) {
      // Show all
      for (const node of this.nodes.values()) {
        node.isVisible = true;
      }
      return;
    }

    const repoSet = new Set(repoIds);
    for (const node of this.nodes.values()) {
      node.isVisible = repoSet.has(node.repoId);
    }
  }

  /**
   * Get the color assigned to a repo.
   */
  getRepoColor(repoId: string): string {
    return this.repoColors.get(repoId) || '#60a5fa';
  }

  /**
   * Get all repo colors.
   */
  getRepoColors(): Map<string, string> {
    return new Map(this.repoColors);
  }

  /**
   * Reset the commit index for replay.
   */
  resetPlayback(): void {
    this.commitIndex = 0;
    this.processedCommits.clear();
    this.nodes.clear();
    this.layoutNodes.clear();
    this.edges = [];
    this.rootNodes.clear();
    this.repoRoots.clear();
    this.quadTree.clear();
  }

  /**
   * Seek to a specific time. Resets and replays all commits up to that time.
   */
  seekTo(targetTime: number): void {
    this.resetPlayback();
    this.processCommitsUpTo(targetTime);

    // Run several physics iterations to settle the layout
    for (let i = 0; i < 50; i++) {
      this.applyForces(0.016);
      this.integratePositions(0.016);
    }

    this.rebuildQuadTree();
    this.syncNodePositions();
  }

  /**
   * Get file extension from filename.
   */
  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0) return '';
    return filename.substring(lastDot + 1).toLowerCase();
  }

  /**
   * Get file category from extension.
   */
  private getFileCategory(extension: string): FileCategory {
    if (!extension) return FileCategoryEnum.OTHER;
    return (
      (FILE_EXTENSION_CATEGORIES as Record<string, FileCategory>)[extension] ||
      FileCategoryEnum.OTHER
    );
  }

  /**
   * Get statistics about the current layout state.
   */
  getStats(): {
    totalNodes: number;
    fileNodes: number;
    directoryNodes: number;
    totalEdges: number;
    processedCommits: number;
    totalCommits: number;
    repos: number;
  } {
    let fileNodes = 0;
    let directoryNodes = 0;

    for (const node of this.nodes.values()) {
      if (node.isDirectory) {
        directoryNodes++;
      } else {
        fileNodes++;
      }
    }

    return {
      totalNodes: this.nodes.size,
      fileNodes,
      directoryNodes,
      totalEdges: this.edges.length,
      processedCommits: this.processedCommits.size,
      totalCommits: this.sortedEvents.length,
      repos: this.repoRoots.size,
    };
  }
}
