// =============================================================================
// LAYOUT WORKER — Offloaded physics computation
// =============================================================================
// Runs tree layout physics (spring-to-target + sibling repulsion) in a
// dedicated Web Worker to keep the main thread free for rendering.
//
// Supports two modes:
// 1. SharedArrayBuffer: worker writes positions directly to shared memory.
//    Main thread reads them with zero copying.
// 2. Transferable fallback: worker posts Float64Array position buffers via
//    zero-copy postMessage transfer.

import { LayoutBuffers, NodeFlags } from './layout-buffers';
import { TreeLayout } from './tree-layout';
import type {
  WorkerInMessage,
  WorkerOutMessage,
} from './layout-worker-protocol';
import {
  getSABMetadata,
  getSABPositionsX,
  getSABPositionsY,
} from './layout-worker-protocol';

// Worker-local state
let buffers: LayoutBuffers | null = null;
let layout: TreeLayout | null = null;
let useSAB = false;
let sab: SharedArrayBuffer | null = null;
let sabMeta: Int32Array | null = null;
let sabX: Float64Array | null = null;
let sabY: Float64Array | null = null;
let capacity = 16384;

// =============================================================================
// MESSAGE HANDLER
// =============================================================================

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'init':
        handleInit(msg);
        break;
      case 'addNode':
        handleAddNode(msg);
        break;
      case 'removeNode':
        handleRemoveNode(msg);
        break;
      case 'tick':
        handleTick(msg);
        break;
      case 'recomputeAll':
        handleRecomputeAll();
        break;
      case 'setRoots':
        handleSetRoots(msg);
        break;
      case 'updateNode':
        handleUpdateNode(msg);
        break;
      case 'reset':
        handleReset();
        break;
      case 'getPositions':
        handleGetPositions();
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postOut({ type: 'error', message });
  }
};

// =============================================================================
// HANDLERS
// =============================================================================

function handleInit(msg: Extract<WorkerInMessage, { type: 'init' }>): void {
  capacity = msg.capacity;
  useSAB = msg.useSAB;

  buffers = new LayoutBuffers(capacity);
  layout = new TreeLayout(buffers);

  if (useSAB && msg.sab) {
    sab = msg.sab;
    sabMeta = getSABMetadata(sab);
    sabX = getSABPositionsX(sab, capacity);
    sabY = getSABPositionsY(sab, capacity);
  }

  postOut({ type: 'ready' });
}

function handleAddNode(msg: Extract<WorkerInMessage, { type: 'addNode' }>): void {
  if (!buffers || !layout) return;

  const idx = buffers.allocate(msg.id);

  // Set properties
  buffers.depth[idx] = msg.depth;
  buffers.colorR[idx] = msg.colorR;
  buffers.colorG[idx] = msg.colorG;
  buffers.colorB[idx] = msg.colorB;

  if (msg.isDir) {
    buffers.setFlag(idx, NodeFlags.IS_DIR);
  }

  // Link to parent
  if (msg.parentId) {
    const parentIdx = buffers.getIndex(msg.parentId);
    if (parentIdx > 0) {
      buffers.addChild(parentIdx, idx);
    }
  }

  // Trigger incremental layout update
  layout.onNodeAdded(idx);
}

function handleRemoveNode(msg: Extract<WorkerInMessage, { type: 'removeNode' }>): void {
  if (!buffers || !layout) return;

  const idx = buffers.getIndex(msg.id);
  if (idx <= 0) return;

  const parentIdx = buffers.parentIndex[idx];
  buffers.markDeleting(idx);

  if (parentIdx > 0) {
    layout.onNodeRemoved(parentIdx);
  }
}

function handleTick(msg: Extract<WorkerInMessage, { type: 'tick' }>): void {
  if (!buffers || !layout) return;

  const start = performance.now();

  // Run physics
  layout.updatePhysics(msg.dt);

  // Run animations
  layout.updateAnimations(msg.simulationTime, msg.nodeFadeTime);

  const frameTime = performance.now() - start;

  // Write positions to SAB or post them
  if (useSAB && sabX && sabY && sabMeta) {
    for (let i = 1; i <= buffers.count; i++) {
      sabX[i] = buffers.x[i];
      sabY[i] = buffers.y[i];
    }
    Atomics.store(sabMeta, 0, buffers.count);
    Atomics.store(sabMeta, 1, 1); // dirty flag
    postOut({ type: 'tickDone', frameTime });
  } else {
    postOut({ type: 'tickDone', frameTime });
  }
}

function handleRecomputeAll(): void {
  if (!layout) return;
  layout.recomputeAll();
}

function handleSetRoots(msg: Extract<WorkerInMessage, { type: 'setRoots' }>): void {
  if (!buffers || !layout) return;

  for (const id of msg.ids) {
    const idx = buffers.getIndex(id);
    if (idx > 0) {
      layout.addRoot(idx);
    }
  }
}

function handleUpdateNode(msg: Extract<WorkerInMessage, { type: 'updateNode' }>): void {
  if (!buffers) return;

  const idx = buffers.getIndex(msg.id);
  if (idx <= 0) return;

  const u = msg.updates;
  if (u.lastModified !== undefined) buffers.lastModified[idx] = u.lastModified;
  if (u.modificationCount !== undefined) buffers.modificationCount[idx] = u.modificationCount;
  if (u.opacity !== undefined) buffers.opacity[idx] = u.opacity;
  if (u.scale !== undefined) buffers.scale[idx] = u.scale;
  if (u.popInTarget !== undefined) buffers.popInTarget[idx] = u.popInTarget;
  if (u.flags !== undefined) buffers.flags[idx] = u.flags;
}

function handleReset(): void {
  if (!buffers || !layout) return;
  buffers.clear();
  // Recreate layout
  layout = new TreeLayout(buffers);
}

function handleGetPositions(): void {
  if (!buffers) return;

  // Transferable fallback: create position arrays and transfer them
  const count = buffers.count;
  const posBuffer = new Float64Array(count * 2);

  for (let i = 0; i < count; i++) {
    const idx = i + 1;
    posBuffer[i * 2] = buffers.x[idx];
    posBuffer[i * 2 + 1] = buffers.y[idx];
  }

  // Transfer ownership of the buffer (zero-copy)
  (self as unknown as Worker).postMessage(
    { type: 'positions', buffer: posBuffer, count } as WorkerOutMessage,
    [posBuffer.buffer],
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function postOut(msg: WorkerOutMessage): void {
  self.postMessage(msg);
}
