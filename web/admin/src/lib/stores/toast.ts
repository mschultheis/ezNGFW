/**
 * Global toast notification store.
 *
 * Provides success / error / warning / info notifications rendered by
 * the `<Toast>` layout component.  Each toast auto-dismisses after a
 * configurable duration and can be dismissed manually.
 */
import { writable } from 'svelte/store';

/** Severity levels that determine toast styling and urgency. */
export type ToastType = 'success' | 'error' | 'warning' | 'info';
/** Single toast notification with unique ID, severity, and message text. */
export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const { subscribe, update } = writable<Toast[]>([]);
let nextId = 0;

/**
 * Global toast API used by pages and actions to raise transient notifications.
 *
 * Extend by adding helper methods that call `add()` with your preferred
 * defaults (for example, longer durations for critical notices).
 */
export const toasts = {
  subscribe,
  /** Push a new toast and schedule automatic removal after `duration` ms. */
  add(type: ToastType, message: string, duration = 5000) {
    const id = nextId++;
    update((t) => [...t, { id, type, message }]);
    setTimeout(() => {
      update((t) => t.filter((x) => x.id !== id));
    }, duration);
  },
  /** Convenience helper for positive confirmations. */
  success: (msg: string) => toasts.add('success', msg),
  /** Convenience helper for errors; uses a longer default visibility window. */
  error: (msg: string) => toasts.add('error', msg, 8000),
  /** Convenience helper for non-fatal warnings. */
  warning: (msg: string) => toasts.add('warning', msg),
  /** Dismiss a toast by its generated id. */
  dismiss: (id: number) => update((t) => t.filter((x) => x.id !== id))
};
