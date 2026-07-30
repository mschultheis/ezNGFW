/**
 * Safe-mode (config rollback protection) store.
 *
 * Implements a safety net inspired by OPNsense: after applying config
 * changes the operator has N seconds to confirm.  If the countdown
 * expires (e.g. network loss locked them out), the backend automatically
 * reverts to the previous configuration snapshot.  A heartbeat keeps
 * the session alive while safe mode is active.
 */
import { get, writable } from 'svelte/store';
import { api } from '$lib/api/client';
import { toasts } from './toast';

/** Whether a safe-mode rollback countdown is currently active. */
export const safeModeActive = writable(false);
/** Seconds remaining before automatic config revert. */
export const rollbackCountdown = writable(0);
/** Timer handle for the countdown interval (used for cleanup). */
export const rollbackTimerId = writable<ReturnType<typeof setInterval> | null>(null);
/** Total timeout duration in seconds (default 60). */
export const rollbackTimeout = writable(60);

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/** Begin sending periodic heartbeats to the backend to signal GUI connectivity. */
export function startHeartbeat() {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(async () => {
    if (get(safeModeActive)) {
      try {
        await api.post('/system/heartbeat', {});
      } catch {
        // Connection lost - server-side safety rollback should trigger.
      }
    }
  }, 5000);
}

/** Stop the heartbeat interval. */
export function stopHeartbeat() {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function clearSafeModeState() {
  const timer = get(rollbackTimerId);
  if (timer) {
    clearInterval(timer);
  }
  rollbackTimerId.set(null);
  safeModeActive.set(false);
  rollbackCountdown.set(0);
  rollbackTimeout.set(60);
  stopHeartbeat();
}

// Apply config changes with rollback protection
/** Apply config changes with automatic rollback protection if not confirmed in time. */
export async function applyWithRollback(changes: () => Promise<void>, timeoutSeconds: number = 60): Promise<boolean> {
  clearSafeModeState();

  try {
    await api.post('/system/snapshot', {});
    toasts.success('Configuration snapshot saved');
  } catch {
    toasts.error('Failed to create config snapshot');
    return false;
  }

  try {
    await changes();
  } catch {
    toasts.error('Failed to apply changes - rolling back');
    try {
      await api.post('/system/rollback', {});
    } catch {
      toasts.error('Rollback failed - manual intervention required');
    }
    return false;
  }

  safeModeActive.set(true);
  rollbackCountdown.set(timeoutSeconds);
  rollbackTimeout.set(timeoutSeconds);
  startHeartbeat();

  const timer = setInterval(async () => {
    rollbackCountdown.update((n) => n - 1);
    const remaining = get(rollbackCountdown);

    if (remaining <= 0) {
      clearInterval(timer);
      rollbackTimerId.set(null);
      safeModeActive.set(false);
      stopHeartbeat();

      try {
        await api.post('/system/rollback', {});
        toasts.error('No confirmation received - changes reverted automatically');
      } catch {
        toasts.error('Rollback failed - manual intervention required');
      }
    }
  }, 1000);

  rollbackTimerId.set(timer);
  toasts.success(`Changes applied. Confirm within ${timeoutSeconds}s or they will be reverted.`);
  return true;
}

// User confirms the changes are good
/** Confirm that applied changes are good — cancels the rollback countdown. */
export async function confirmApply() {
  clearSafeModeState();

  try {
    await api.post('/system/confirm', {});
    toasts.success('Configuration confirmed and saved permanently');
  } catch {
    toasts.error('Confirm failed');
  }
}

// User manually reverts
/** Explicitly revert changes before the countdown expires. */
export async function manualRollback() {
  clearSafeModeState();

  try {
    await api.post('/system/rollback', {});
    toasts.success('Changes reverted successfully');
  } catch {
    toasts.error('Rollback failed');
  }
}
