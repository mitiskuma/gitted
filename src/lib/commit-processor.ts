// src/lib/commit-processor.ts

import type { CommitData, CommitBatch } from '@/lib/types';

export type { CommitData, CommitBatch };

/**
 * Split an array of commits into time-sorted batches for Claude processing.
 */
export function batchCommitsForClaude(
  commits: CommitData[],
  maxPerBatch: number = 100
): CommitBatch[] {
  if (commits.length === 0) return [];

  const sorted = [...commits].sort((a, b) => a.timestampMs - b.timestampMs);
  const totalBatches = Math.ceil(sorted.length / maxPerBatch);
  const batches: CommitBatch[] = [];

  for (let i = 0; i < sorted.length; i += maxPerBatch) {
    const batchIndex = Math.floor(i / maxPerBatch);
    batches.push({
      repoId: sorted[i].repoId,
      batchIndex,
      totalBatches,
      commits: sorted.slice(i, i + maxPerBatch),
      isLast: batchIndex === totalBatches - 1,
    });
  }

  return batches;
}
