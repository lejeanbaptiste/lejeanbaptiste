import type { TagBombDocumentResult } from './integration';

/**
 * Remaining documents from a multi-document tag bomb run, kept module-level
 * (like {@link import('./batchHolder')}) so reopening the Tag bomb dialog
 * after reviewing one document can resume the rest of the queue.
 */
let queue: TagBombDocumentResult[] | null = null;

export function setTagBombQueue(documents: TagBombDocumentResult[]): void {
  queue = documents.length > 0 ? documents : null;
}

export function peekTagBombQueue(): TagBombDocumentResult[] | null {
  return queue;
}

/** Remove `filePath` from the pending queue (reviewed or applied). */
export function consumeTagBombQueueEntry(filePath: string): TagBombDocumentResult[] | null {
  if (!queue) return null;
  queue = queue.filter((doc) => doc.filePath !== filePath);
  if (queue.length === 0) queue = null;
  return queue;
}

export function clearTagBombQueue(): void {
  queue = null;
}
