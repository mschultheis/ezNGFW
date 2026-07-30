/**
 * UI layout state store.
 *
 * Tracks sidebar open/close, command palette visibility, and other
 * ephemeral UI states used by the admin shell.
 */
import { writable } from 'svelte/store';

/**
 * Controls whether the mobile sidebar sheet is open.
 * Default: `false` so first render starts with content focus.
 */
export const sidebarOpen = writable(false);

/**
 * Controls whether the Cmd+K / Ctrl+K command palette overlay is visible.
 * Default: `false` until user opens it.
 */
export const commandPaletteOpen = writable(false);

/**
 * Controls whether the desktop sidebar is collapsed to icon-only mode.
 * Persisted in localStorage so the preference survives page reloads.
 */
function createSidebarCollapsed() {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('ezngfw_sidebar_collapsed') : null;
  const { subscribe, set, update } = writable(stored === 'true');

  return {
    subscribe,
    set(value: boolean) {
      set(value);
      if (typeof window !== 'undefined') localStorage.setItem('ezngfw_sidebar_collapsed', String(value));
    },
    toggle() {
      update((current) => {
        const next = !current;
        if (typeof window !== 'undefined') localStorage.setItem('ezngfw_sidebar_collapsed', String(next));
        return next;
      });
    }
  };
}

/**
 * Controls whether the desktop sidebar is collapsed to icon-only mode.
 * Default: `false` unless overridden by persisted user preference.
 */
export const sidebarCollapsed = createSidebarCollapsed();
