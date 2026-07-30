/**
 * Staged configuration change queue.
 *
 * When staged mode is active, mutations are not applied immediately.
 * Instead they are collected into a queue that the operator can review,
 * apply in bulk, or clear.  This mirrors OPNsense's "pending changes"
 * workflow and prevents accidental partial configuration.
 */
import { writable, get } from 'svelte/store';
import { toasts } from './toast';

/** A staged configuration change: a label for display and an async action to execute. */
type QueuedChange = { label: string; action: () => Promise<void> };

/** Whether staged mode is active (mutations are queued, not applied immediately). */
export const stagedMode = writable(false);
/** Queue of pending configuration changes awaiting bulk apply. */
export const changeQueue = writable<QueuedChange[]>([]);

/** Add a labelled change to the queue and show a toast confirmation. */
export function queueChange(label: string, action: () => Promise<void>) {
  changeQueue.update((q) => [...q, { label, action }]);
  toasts.success(`Staged: ${label}`);
}

/** Execute all queued changes sequentially, stopping on first failure. */
export async function applyQueue() {
  const items = get(changeQueue);
  if (items.length === 0) return;

  for (const item of items) {
    try {
      await item.action();
    } catch (e) {
      toasts.error(`Failed: ${item.label}`);
      return;
    }
  }

  changeQueue.set([]);
  toasts.success(`${items.length} changes applied`);
}

/** Discard all queued changes without applying them. */
export function clearQueue() {
  changeQueue.set([]);
  toasts.success('Queue cleared');
}
