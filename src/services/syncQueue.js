/**
 * Offline Sync Queue for PostgreSQL API Integration
 *
 * This module manages a persistent queue for PostgreSQL API sync operations.
 * When PostgreSQL API sync fails, operations are queued for retry.
 * The queue is persisted to local storage and survives app restarts.
 */

import { genId } from '../constants';

/**
 * Queue item structure:
 * {
 *   id: string - Unique queue item ID
 *   action: "create" | "update" | "delete" - Type of operation
 *   recordId: string - Record ID being synced
 *   payload: object - Full record data (for create/update) or deletion info
 *   createdAt: string - ISO timestamp when queued
 *   retryCount: number - Number of retry attempts
 *   lastError: string - Last error message
 *   status: "pending" | "processing" | "failed" - Queue item status
 * }
 */

/**
 * Create a new queue item
 */
export function createQueueItem(action, recordId, payload, integrationType = "postgres_api") {
  return {
    id: genId(),
    action,
    recordId,
    payload,
    integrationType,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: "",
    status: "pending"
  };
}

/**
 * Add item to queue
 */
export function addToQueue(queue, item) {
  // Check if item already exists for this record and action
  const exists = queue.some(q =>
    q.recordId === item.recordId &&
    q.action === item.action &&
    q.status === "pending"
  );

  if (exists) {
    // Update existing item instead of adding duplicate
    return queue.map(q => {
      if (q.recordId === item.recordId && q.action === item.action && q.status === "pending") {
        return { ...item, id: q.id, retryCount: q.retryCount };
      }
      return q;
    });
  }

  return [...queue, item];
}

/**
 * Remove item from queue
 */
export function removeFromQueue(queue, itemId) {
  return queue.filter(q => q.id !== itemId);
}

/**
 * Update queue item status
 */
export function updateQueueItem(queue, itemId, updates) {
  return queue.map(q => {
    if (q.id === itemId) {
      return { ...q, ...updates };
    }
    return q;
  });
}

/**
 * Get pending queue items
 */
export function getPendingItems(queue) {
  return queue.filter(q => q.status === "pending");
}

/**
 * Get retryable queue items (pending + failed)
 */
export function getRetryableItems(queue) {
  return queue.filter(q => q.status === "pending" || q.status === "failed");
}

/**
 * Get failed queue items
 */
export function getFailedItems(queue) {
  return queue.filter(q => q.status === "failed");
}

/**
 * Mark item as processing
 */
export function markAsProcessing(queue, itemId) {
  return updateQueueItem(queue, itemId, { status: "processing" });
}

/**
 * Mark item as failed
 */
export function markAsFailed(queue, itemId, error) {
  return updateQueueItem(queue, itemId, {
    status: "failed",
    lastError: error,
    retryCount: (queue.find(q => q.id === itemId)?.retryCount || 0) + 1
  });
}

/**
 * Retry failed item (reset to pending)
 */
export function retryItem(queue, itemId) {
  return updateQueueItem(queue, itemId, { status: "pending" });
}

/**
 * Retry all failed items
 */
export function retryAllFailed(queue) {
  return queue.map(q => {
    if (q.status === "failed") {
      return { ...q, status: "pending" };
    }
    return q;
  });
}

/**
 * Clear all successfully processed items (keep only pending/processing/failed)
 */
export function clearProcessed(queue) {
  return queue.filter(q =>
    q.status === "pending" ||
    q.status === "processing" ||
    q.status === "failed"
  );
}

/**
 * Get queue stats
 */
export function getQueueStats(queue) {
  return {
    total: queue.length,
    pending: queue.filter(q => q.status === "pending").length,
    processing: queue.filter(q => q.status === "processing").length,
    failed: queue.filter(q => q.status === "failed").length
  };
}
