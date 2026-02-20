// =============================================================================
// LAYOUT WORKER PROTOCOL — Message types for main ↔ worker communication
// =============================================================================

/** Discriminated union of messages sent from the main thread to the layout worker. */
export type WorkerInMessage =
  | { type: 'init'; capacity: number; useSAB: boolean; sab?: SharedArrayBuffer }
  | { type: 'addNode'; id: string; parentId: string | null; isDir: boolean; depth: number; colorR: number; colorG: number; colorB: number }
  | { type: 'removeNode'; id: string }
  | { type: 'tick'; dt: number; simulationTime: number; nodeFadeTime: number }
  | { type: 'recomputeAll' }
  | { type: 'setRoots'; ids: string[] }
  | { type: 'updateNode'; id: string; updates: Partial<NodeUpdate> }
  | { type: 'reset' }
  | { type: 'getPositions' };

/** Mutable per-node fields that can be patched via the 'updateNode' message. */
export interface NodeUpdate {
  lastModified: number;
  modificationCount: number;
  opacity: number;
  scale: number;
  popInTarget: number;
  flags: number;
}

/** Discriminated union of messages sent from the layout worker to the main thread. */
export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'tickDone'; frameTime: number }
  | { type: 'positions'; buffer: Float64Array; count: number } // Transferable fallback
  | { type: 'error'; message: string };

/**
 * SharedArrayBuffer layout (when SAB is available):
 *
 * Section 0: Metadata (16 bytes = 4 Int32)
 *   [0] count (number of live nodes)
 *   [1] dirty flag (1 = worker has written new positions)
 *   [2] lock  (for Atomics — not used in basic version)
 *   [3] reserved
 *
 * Section 1: Positions — Float64 x[capacity], y[capacity]
 *   offset = 16
 *   x: Float64Array at offset 16, length = capacity
 *   y: Float64Array at offset 16 + capacity*8, length = capacity
 *
 * Total SAB size = 16 + capacity * 8 * 2
 */

/** Compute the required SharedArrayBuffer byte size for a given node capacity. */
export function computeSABSize(capacity: number): number {
  return 16 + capacity * 8 * 2;
}

/** Get the metadata view (count + dirty flag) from a SharedArrayBuffer. */
export function getSABMetadata(sab: SharedArrayBuffer): Int32Array {
  return new Int32Array(sab, 0, 4);
}

/** Get the X positions view from a SharedArrayBuffer. */
export function getSABPositionsX(sab: SharedArrayBuffer, capacity: number): Float64Array {
  return new Float64Array(sab, 16, capacity);
}

/** Get the Y positions view from a SharedArrayBuffer. */
export function getSABPositionsY(sab: SharedArrayBuffer, capacity: number): Float64Array {
  return new Float64Array(sab, 16 + capacity * 8, capacity);
}
