import { browser } from '$app/environment';
import { init, register, locale } from 'svelte-i18n';

/**
 * Locale registration table.
 *
 * Add a new locale by adding another `register('<code>', ...)` entry and
 * providing the matching JSON file under `./locales/`.
 */
register('en', () => import('./locales/en.json'));
register('de', () => import('./locales/de.json'));
register('fr', () => import('./locales/fr.json'));
register('es', () => import('./locales/es.json'));
register('ja', () => import('./locales/ja.json'));
register('zh', () => import('./locales/zh.json'));

const storedLocale = browser ? localStorage.getItem('ezngfw_locale') : null;

/**
 * i18n bootstrap:
 * - uses English fallback when a key is missing,
 * - starts from persisted locale when available,
 * - otherwise derives language from browser settings.
 */
init({
  fallbackLocale: 'en',
  initialLocale: storedLocale || (browser ? navigator.language.split('-')[0] : 'en')
});

/**
 * Switch the active application locale and persist user preference.
 */
export function setAppLocale(lang: string) {
  locale.set(lang);
  if (browser) {
    localStorage.setItem('ezngfw_locale', lang);
  }
}

/** Reactive locale store from `svelte-i18n` for language-aware components. */
export { locale } from 'svelte-i18n';
/** Translation and formatter helpers re-exported for app-wide convenience. */
export { _, t, format, number, date, time, isLoading } from 'svelte-i18n';
