import { writable } from 'svelte/store';

/**
 * Supported visual themes.
 *
 * To add a new theme, extend this union and update the toggle/apply logic
 * so the new value can be selected and mapped to CSS variables.
 */
export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ezngfw_theme';

/**
 * Global theme store for light/dark mode with localStorage persistence.
 *
 * The store writes the active theme to both HTML (`data-theme`) and
 * localStorage so theme-specific CSS is applied immediately and survives
 * reloads.
 */
function createThemeStore() {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  const initial: Theme = stored === 'light' ? 'light' : 'dark';
  const { subscribe, set, update } = writable<Theme>(initial);

  /**
   * Apply the theme to the root HTML node.
   *
   * `data-theme` is used as the single source for CSS theme selectors.
   */
  function apply(theme: Theme) {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  if (typeof window !== 'undefined') {
    apply(initial);
  }

  return {
    subscribe,
    set(value: Theme) {
      set(value);
      apply(value);
    },
    toggle() {
      update((current) => {
        const next: Theme = current === 'dark' ? 'light' : 'dark';
        apply(next);
        return next;
      });
    }
  };
}

/** Global theme store instance consumed by layout and settings UI. */
export const theme = createThemeStore();
