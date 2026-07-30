/**
 * Manual & auto-refresh trigger store.
 *
 * Dashboard and data-table pages subscribe to `refreshTrigger` so they
 * re-fetch data when the operator clicks Refresh or when the auto-refresh
 * countdown reaches zero.
 */
import { writable } from 'svelte/store';

/** Incremented to signal data-fetching components to re-fetch. */
export const refreshTrigger = writable(0);
/** Whether the auto-refresh countdown timer is running. */
export const autoRefreshEnabled = writable(false);
/** Seconds remaining until the next auto-refresh cycle. */
export const autoRefreshCountdown = writable(30);

/** Manually trigger a data refresh across all subscribed components. */
export function triggerRefresh() {
  refreshTrigger.update((n) => n + 1);
}
