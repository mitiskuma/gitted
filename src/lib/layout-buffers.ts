// =============================================================================
// STRUCTURE-OF-ARRAYS (SoA) LAYOUT BUFFERS
// =============================================================================
// Typed-array backed storage for node data. Eliminates per-frame garbage from
// Map iterations and enables zero-copy transfer to Web Workers via
// SharedArrayBuffer or Transferable postMessage.

/** Bitfield flags for per-node state, stored in a Uint8Array. */
export const NodeFlags = {
  IS_DIR:   0b0000_0001,
  PINNED:   0b0000_0010,
  VISIBLE:  0b0000_0100,
  DELETING: 0b0000_1000,
  POP_IN:   0b0001_0000,
} as const;

/**
 * LayoutBuffers holds all per-node data in contiguous typed arrays.
 * Index 0 is reserved (unused sentinel), so valid indices start at 1.
 */
export class LayoutBuffers {
  // Capacity (max node count, excluding index 0 sentinel)
  capacity: number;
  // Current number of live nodes (next index to allocate = count + 1)
  count: number;

  // --- Position (Float64 for precision during physics accumulation) ---
  x: Float64Array;
  y: Float64Array;
  targetX: Float64Array;
  targetY: Float64Array;

  // --- Physics (Float32 is plenty for velocities / visual properties) ---
  vx: Float32Array;
  vy: Float32Array;
  mass: Float32Array;
  angle: Float32Array;
  radius: Float32Array;
  opacity: Float32Array;
  scale: Float32Array;
  popInTarget: Float32Array; // Pop-in animation overshoot target (0 = no pop)

  // --- Tree structure ---
  depth: Uint8Array;
  flags: Uint8Array;
  childCount: Uint16Array;
  parentIndex: Int32Array; // -1 for roots
  subtreeWeight: Uint32Array;

  // --- Radial sector layout ---
  subtreeAngleStart: Float32Array;
  subtreeAngleSpan: Float32Array;

  // --- Pre-computed color (avoids per-frame hexToRgba) ---
  colorR: Uint8Array;
  colorG: Uint8Array;
  colorB: Uint8Array;

  // --- Timestamps (Float64 for ms precision) ---
  lastModified: Float64Array;
  modificationCount: Uint16Array;

  // --- ID mapping ---
  idToIndex: Map<string, number>;
  indexToId: string[];

  // --- Children lists (variable-length, kept as arrays) ---
  children: Int32Array[]; // children[i] = typed array of child indices

  constructor(capacity: number = 16384) {
    this.capacity = capacity;
    this.count = 0;

    const n = capacity + 1; // +1 for sentinel at index 0

    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.targetX = new Float64Array(n);
    this.targetY = new Float64Array(n);

    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.mass = new Float32Array(n);
    this.angle = new Float32Array(n);
    this.radius = new Float32Array(n);
    this.opacity = new Float32Array(n);
    this.scale = new Float32Array(n);
    this.popInTarget = new Float32Array(n);

    this.depth = new Uint8Array(n);
    this.flags = new Uint8Array(n);
    this.childCount = new Uint16Array(n);
    this.parentIndex = new Int32Array(n);
    this.subtreeWeight = new Uint32Array(n);

    this.subtreeAngleStart = new Float32Array(n);
    this.subtreeAngleSpan = new Float32Array(n);

    this.colorR = new Uint8Array(n);
    this.colorG = new Uint8Array(n);
    this.colorB = new Uint8Array(n);

    this.lastModified = new Float64Array(n);
    this.modificationCount = new Uint16Array(n);

    // Fill parentIndex with -1 (no parent)
    this.parentIndex.fill(-1);

    this.idToIndex = new Map();
    this.indexToId = [''];  // index 0 = sentinel empty string

    this.children = [new Int32Array(0)]; // sentinel
  }

  /**
   * Allocate a new node and return its index.
   * Automatically grows buffers if capacity is exceeded.
   */
  allocate(id: string): number {
    if (this.idToIndex.has(id)) {
      return this.idToIndex.get(id)!;
    }

    this.count++;
    const idx = this.count;

    if (idx >= this.capacity + 1) {
      this.grow(this.capacity * 2);
    }

    this.idToIndex.set(id, idx);
    this.indexToId[idx] = id;

    // Defaults
    this.mass[idx] = 1;
    this.scale[idx] = 0;
    this.opacity[idx] = 0;
    this.parentIndex[idx] = -1;
    this.subtreeWeight[idx] = 1;
    this.flags[idx] = NodeFlags.VISIBLE;
    this.children[idx] = new Int32Array(0);

    return idx;
  }

  /** Look up index by string id, returns 0 (sentinel) if not found. */
  getIndex(id: string): number {
    return this.idToIndex.get(id) ?? 0;
  }

  /** Get string id by index. */
  getId(index: number): string {
    return this.indexToId[index] ?? '';
  }

  /** Check if a node exists by id. */
  has(id: string): boolean {
    return this.idToIndex.has(id);
  }

  /** Set a flag bit. */
  setFlag(index: number, flag: number): void {
    this.flags[index] |= flag;
  }

  /** Clear a flag bit. */
  clearFlag(index: number, flag: number): void {
    this.flags[index] &= ~flag;
  }

  /** Test a flag bit. */
  hasFlag(index: number, flag: number): boolean {
    return (this.flags[index] & flag) !== 0;
  }

  /** Add a child index to a parent. */
  addChild(parentIdx: number, childIdx: number): void {
    const existing = this.children[parentIdx];
    const newArr = new Int32Array(existing.length + 1);
    newArr.set(existing);
    newArr[existing.length] = childIdx;
    this.children[parentIdx] = newArr;
    this.childCount[parentIdx] = newArr.length;
    this.parentIndex[childIdx] = parentIdx;
  }

  /** Remove a child index from a parent. */
  removeChild(parentIdx: number, childIdx: number): void {
    const existing = this.children[parentIdx];
    const filtered: number[] = [];
    for (let i = 0; i < existing.length; i++) {
      if (existing[i] !== childIdx) filtered.push(existing[i]);
    }
    this.children[parentIdx] = new Int32Array(filtered);
    this.childCount[parentIdx] = filtered.length;
  }

  /**
   * Set pre-computed color from a hex string like "#rrggbb" or "rgb(r,g,b)".
   */
  setColor(index: number, hex: string): void {
    const rgb = parseColorToRgb(hex);
    this.colorR[index] = rgb.r;
    this.colorG[index] = rgb.g;
    this.colorB[index] = rgb.b;
  }

  /** Get color as {r, g, b} Uint8 values. */
  getColor(index: number): { r: number; g: number; b: number } {
    return {
      r: this.colorR[index],
      g: this.colorG[index],
      b: this.colorB[index],
    };
  }

  /** Get color as CSS rgba string. */
  getRgba(index: number, alpha: number): string {
    return `rgba(${this.colorR[index]}, ${this.colorG[index]}, ${this.colorB[index]}, ${alpha})`;
  }

  /**
   * Soft-delete a node (mark DELETING flag). Actual compaction is deferred.
   * Returns true if the node existed.
   */
  markDeleting(index: number): boolean {
    if (index <= 0 || index > this.count) return false;
    this.setFlag(index, NodeFlags.DELETING);
    return true;
  }

  /**
   * Hard-remove a node by index. O(1) swap-remove with the last live node.
   * Updates idToIndex and parent/child references.
   */
  remove(index: number): void {
    if (index <= 0 || index > this.count) return;

    const id = this.indexToId[index];
    if (!id) return;

    // Remove from parent's child list
    const parentIdx = this.parentIndex[index];
    if (parentIdx > 0) {
      this.removeChild(parentIdx, index);
    }

    // Reparent children (orphan them)
    const childArr = this.children[index];
    for (let i = 0; i < childArr.length; i++) {
      this.parentIndex[childArr[i]] = -1;
    }

    const lastIdx = this.count;
    if (index !== lastIdx) {
      // Swap last node into this slot
      this.swapIndices(index, lastIdx);
    }

    // Clear the last slot
    this.idToIndex.delete(id);
    this.indexToId[lastIdx] = '';
    this.count--;
  }

  /** Grow all buffers to new capacity. */
  private grow(newCapacity: number): void {
    const n = newCapacity + 1;
    this.capacity = newCapacity;

    this.x = growFloat64(this.x, n);
    this.y = growFloat64(this.y, n);
    this.targetX = growFloat64(this.targetX, n);
    this.targetY = growFloat64(this.targetY, n);

    this.vx = growFloat32(this.vx, n);
    this.vy = growFloat32(this.vy, n);
    this.mass = growFloat32(this.mass, n);
    this.angle = growFloat32(this.angle, n);
    this.radius = growFloat32(this.radius, n);
    this.opacity = growFloat32(this.opacity, n);
    this.scale = growFloat32(this.scale, n);
    this.popInTarget = growFloat32(this.popInTarget, n);

    this.depth = growUint8(this.depth, n);
    this.flags = growUint8(this.flags, n);
    this.childCount = growUint16(this.childCount, n);
    this.parentIndex = growInt32(this.parentIndex, n, -1);
    this.subtreeWeight = growUint32(this.subtreeWeight, n);

    this.subtreeAngleStart = growFloat32(this.subtreeAngleStart, n);
    this.subtreeAngleSpan = growFloat32(this.subtreeAngleSpan, n);

    this.colorR = growUint8(this.colorR, n);
    this.colorG = growUint8(this.colorG, n);
    this.colorB = growUint8(this.colorB, n);

    this.lastModified = growFloat64(this.lastModified, n);
    this.modificationCount = growUint16(this.modificationCount, n);
  }

  /** Swap data at two indices (for swap-remove). */
  private swapIndices(a: number, b: number): void {
    if (a === b) return;

    const idA = this.indexToId[a];
    const idB = this.indexToId[b];

    // Swap id mapping
    this.indexToId[a] = idB;
    this.indexToId[b] = idA;
    if (idB) this.idToIndex.set(idB, a);
    if (idA) this.idToIndex.set(idA, b);

    // Swap all typed array slots
    swapF64(this.x, a, b);
    swapF64(this.y, a, b);
    swapF64(this.targetX, a, b);
    swapF64(this.targetY, a, b);

    swapF32(this.vx, a, b);
    swapF32(this.vy, a, b);
    swapF32(this.mass, a, b);
    swapF32(this.angle, a, b);
    swapF32(this.radius, a, b);
    swapF32(this.opacity, a, b);
    swapF32(this.scale, a, b);
    swapF32(this.popInTarget, a, b);

    swapU8(this.depth, a, b);
    swapU8(this.flags, a, b);
    swapU16(this.childCount, a, b);
    swapI32(this.parentIndex, a, b);
    swapU32(this.subtreeWeight, a, b);

    swapF32(this.subtreeAngleStart, a, b);
    swapF32(this.subtreeAngleSpan, a, b);

    swapU8(this.colorR, a, b);
    swapU8(this.colorG, a, b);
    swapU8(this.colorB, a, b);

    swapF64(this.lastModified, a, b);
    swapU16(this.modificationCount, a, b);

    // Swap children arrays
    const tmpChildren = this.children[a];
    this.children[a] = this.children[b];
    this.children[b] = tmpChildren;

    // Update parent references that point to a or b
    // Children of the swapped nodes need their parentIndex updated
    const childrenA = this.children[a];
    for (let i = 0; i < childrenA.length; i++) {
      this.parentIndex[childrenA[i]] = a;
    }
    const childrenB = this.children[b];
    for (let i = 0; i < childrenB.length; i++) {
      this.parentIndex[childrenB[i]] = b;
    }

    // Update parent's child list if either node had a parent
    this.updateParentChildRef(this.parentIndex[a], b, a);
    this.updateParentChildRef(this.parentIndex[b], a, b);
  }

  /** In parent's child list, replace oldChild with newChild. */
  private updateParentChildRef(parentIdx: number, oldChild: number, newChild: number): void {
    if (parentIdx <= 0) return;
    const arr = this.children[parentIdx];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === oldChild) {
        arr[i] = newChild;
        return;
      }
    }
  }

  /** Reset all data (keep allocated buffers). */
  clear(): void {
    this.count = 0;
    this.idToIndex.clear();
    this.indexToId.length = 1;
    this.indexToId[0] = '';
    this.children.length = 1;
    this.children[0] = new Int32Array(0);
    this.parentIndex.fill(-1);
  }
}

// =============================================================================
// COLOR PARSING UTILITY
// =============================================================================

let _colorCanvas: HTMLCanvasElement | null = null;
let _colorCtx: CanvasRenderingContext2D | null = null;

/**
 * Parse any CSS color string into {r, g, b} Uint8 components.
 * Handles #rrggbb, rgb(), and falls back to a canvas for named colors.
 */
export function parseColorToRgb(color: string): { r: number; g: number; b: number } {
  // Fast path for #rrggbb
  if (color.startsWith('#') && color.length >= 7) {
    return {
      r: parseInt(color.slice(1, 3), 16),
      g: parseInt(color.slice(3, 5), 16),
      b: parseInt(color.slice(5, 7), 16),
    };
  }

  // Fast path for rgb(r, g, b)
  if (color.startsWith('rgb')) {
    const match = color.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      return {
        r: Math.round(parseFloat(match[0])),
        g: Math.round(parseFloat(match[1])),
        b: Math.round(parseFloat(match[2])),
      };
    }
  }

  // Fallback: use canvas to normalize any CSS color
  if (typeof document !== 'undefined') {
    if (!_colorCanvas) {
      _colorCanvas = document.createElement('canvas');
      _colorCanvas.width = 1;
      _colorCanvas.height = 1;
      _colorCtx = _colorCanvas.getContext('2d')!;
    }
    if (_colorCtx) {
      _colorCtx.fillStyle = '#000000';
      _colorCtx.fillStyle = color;
      const hex = _colorCtx.fillStyle; // browser normalizes to #rrggbb
      if (hex.startsWith('#') && hex.length >= 7) {
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
// TYPED ARRAY HELPERS
// =============================================================================

function growFloat64(old: Float64Array, newLen: number): Float64Array {
  const arr = new Float64Array(newLen);
  arr.set(old);
  return arr;
}

function growFloat32(old: Float32Array, newLen: number): Float32Array {
  const arr = new Float32Array(newLen);
  arr.set(old);
  return arr;
}

function growUint8(old: Uint8Array, newLen: number): Uint8Array {
  const arr = new Uint8Array(newLen);
  arr.set(old);
  return arr;
}

function growUint16(old: Uint16Array, newLen: number): Uint16Array {
  const arr = new Uint16Array(newLen);
  arr.set(old);
  return arr;
}

function growInt32(old: Int32Array, newLen: number, fillValue: number = 0): Int32Array {
  const arr = new Int32Array(newLen);
  arr.set(old);
  if (fillValue !== 0) {
    for (let i = old.length; i < newLen; i++) arr[i] = fillValue;
  }
  return arr;
}

function growUint32(old: Uint32Array, newLen: number): Uint32Array {
  const arr = new Uint32Array(newLen);
  arr.set(old);
  return arr;
}

function swapF64(arr: Float64Array, a: number, b: number): void {
  const tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
}

function swapF32(arr: Float32Array, a: number, b: number): void {
  const tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
}

function swapU8(arr: Uint8Array, a: number, b: number): void {
  const tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
}

function swapU16(arr: Uint16Array, a: number, b: number): void {
  const tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
}

function swapI32(arr: Int32Array, a: number, b: number): void {
  const tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
}

function swapU32(arr: Uint32Array, a: number, b: number): void {
  const tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
}
