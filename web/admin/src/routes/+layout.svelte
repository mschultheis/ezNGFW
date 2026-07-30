<!-- Root app shell that enforces auth/initialization guards and renders global layout chrome. -->

<script lang="ts">
  import '../app.css';
  import '$lib/i18n';
  import { isLoading as i18nLoading } from '$lib/i18n';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { api } from '$lib/api/client';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Header from '$lib/components/layout/Header.svelte';
  import SafeModeBar from '$lib/components/layout/SafeModeBar.svelte';
  import Toast from '$lib/components/layout/Toast.svelte';
  import CommandPalette from '$lib/components/layout/CommandPalette.svelte';
  import ChatWidget from '$lib/components/admin/ChatWidget.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { commandPaletteOpen } from '$lib/stores/ui';
  import { theme } from '$lib/stores/theme';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();

  function appPath(pathname: string) {
    return base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      commandPaletteOpen.update((v) => !v);
    }
  }

  /** Public routes bypass the authenticated shell so login and onboarding can render standalone. */
  const isPublicPage = $derived(appPath($page.url.pathname) === '/login' || appPath($page.url.pathname).startsWith('/wizard'));

  /** Guard that runs once on mount and on each client-side navigation. */
  let guardRunning = $state(false);
  /** Whether the user is authenticated — gates rendering of non-public children to prevent pre-auth API calls. */
  let authenticated = $state(false);

  /** Enforce initialization and auth requirements before protected routes are rendered. */
  async function enforceGuards() {
    if (guardRunning) return;
    guardRunning = true;
    try {
      const pathname = appPath(window.location.pathname);

      if (!pathname.startsWith('/wizard')) {
        try {
          const init = await api.get<{ initialized: boolean }>('/system/initialized');
          if (!init.initialized) {
            await goto(base + '/wizard');
            return;
          }
        } catch {
          // Fall through to auth gate if initialization check is unavailable.
        }
      }

      const token = api.getToken();
      const onPublic = pathname === '/login' || pathname.startsWith('/wizard');
      if (!token && !onPublic) {
        authenticated = false;
        await goto(base + '/login');
        return;
      }
      if (token && pathname === '/login') {
        authenticated = true;
        await goto(base + '/');
      } else if (token) {
        authenticated = true;
      }
    } finally {
      guardRunning = false;
    }
  }

  onMount(() => {
    void enforceGuards();
    // Ensure theme attribute is set on the HTML element at startup
    if (browser) {
      document.documentElement.setAttribute('data-theme', $theme);
    }
  });

  // Also run guards on navigation (afterNavigate-style via page store subscription)
  // but only in browser and with debounce to avoid rapid re-fires
  let lastGuardPath = '';
  $effect(() => {
    if (!browser) return;
      const pathname = appPath($page.url.pathname);
    if (pathname !== lastGuardPath) {
      lastGuardPath = pathname;
      void enforceGuards();
      // Scroll main content area to top on every navigation
      const main = document.querySelector('main');
      if (main) main.scrollTo({ top: 0 });
      else window.scrollTo({ top: 0 });
    }
  });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if !$i18nLoading}
<Tooltip.Provider delayDuration={150}>
  {#if isPublicPage}
    {@render children()}
  {:else if authenticated}
    <div class="flex h-screen bg-slate-950">
      <Sidebar />
      <div class="flex flex-1 flex-col overflow-hidden">
        <Header />
        <SafeModeBar />
        <main class="flex-1 overflow-y-auto p-3 md:p-6">
          {@render children()}
        </main>
      </div>
    </div>
    <ChatWidget />
  {/if}
  <Toast />
  <CommandPalette />
</Tooltip.Provider>
{/if}
