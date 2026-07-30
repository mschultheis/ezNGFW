<!-- Layout component that controls the Header area of the admin shell. -->

<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import Menu from '@lucide/svelte/icons/menu';
  import LogOut from '@lucide/svelte/icons/log-out';
  import UserRound from '@lucide/svelte/icons/user-round';
  import Search from '@lucide/svelte/icons/search';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import WandSparkles from '@lucide/svelte/icons/wand-sparkles';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import BadgeCheck from '@lucide/svelte/icons/badge-check';
  import { api } from '$lib/api/client';
  import { getPageTitle, getPageSection } from '$lib/config/navigation';
  import { sidebarOpen, commandPaletteOpen } from '$lib/stores/ui';
  import { theme } from '$lib/stores/theme';
  import { _ } from '$lib/i18n';
  import { globalSearch, searchNavigation, type NavSearchItem } from '$lib/stores/search';
  import { stagedMode, changeQueue } from '$lib/stores/staged';
  import {
    autoRefreshEnabled,
    autoRefreshCountdown,
    triggerRefresh
  } from '$lib/stores/refresh';
  import { toasts } from '$lib/stores/toast';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Sheet from '$lib/components/ui/sheet';
  import Sidebar from './Sidebar.svelte';

  let role = $state('admin');
  let refreshState = $state<'Idle' | 'Refreshing...'>('Idle');
  let refreshResetTimer: ReturnType<typeof setTimeout> | null = null;

  let searchContainer = $state<HTMLDivElement | null>(null);
  let searchOpen = $state(false);
  let activeSearchIndex = $state(0);

  const title = $derived(getPageTitle($page.url.pathname));
  const section = $derived(getPageSection($page.url.pathname));
  const queueCount = $derived($changeQueue.length);
  const searchQuery = $derived($globalSearch.trim());
  const searchResults = $derived(searchNavigation(searchQuery, 9));
  const showSearchDropdown = $derived(searchOpen && searchQuery.length > 0);

  $effect(() => {
    if (browser) {
      role = localStorage.getItem('ezngfw_role') ?? 'admin';
    }
  });

  $effect(() => {
    if (!$autoRefreshEnabled) {
      autoRefreshCountdown.set(30);
      return;
    }

    const interval = setInterval(() => {
      let shouldRefresh = false;
      autoRefreshCountdown.update((seconds) => {
        if (seconds <= 1) {
          shouldRefresh = true;
          return 30;
        }
        return seconds - 1;
      });
      if (shouldRefresh) refreshNow();
    }, 1000);

    return () => clearInterval(interval);
  });

  $effect(() => {
    return () => {
      if (refreshResetTimer) clearTimeout(refreshResetTimer);
    };
  });

  $effect(() => {
    if (!searchQuery) {
      searchOpen = false;
      activeSearchIndex = 0;
      return;
    }

    searchOpen = true;
    if (activeSearchIndex >= searchResults.length) {
      activeSearchIndex = 0;
    }
  });

  $effect(() => {
    if (!browser) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!searchContainer) return;
      if (!(event.target instanceof Node)) return;
      if (!searchContainer.contains(event.target)) {
        searchOpen = false;
      }
    };

    window.addEventListener('pointerdown', closeOnOutsideClick);
    return () => window.removeEventListener('pointerdown', closeOnOutsideClick);
  });

  function refreshNow() {
    refreshState = 'Refreshing...';
    triggerRefresh();
    if (refreshResetTimer) clearTimeout(refreshResetTimer);
    refreshResetTimer = setTimeout(() => {
      refreshState = 'Idle';
    }, 900);
  }

  function openSearchDropdown() {
    if (searchQuery) {
      searchOpen = true;
    }
  }

  function moveSearchSelection(direction: 1 | -1) {
    if (!searchResults.length) return;

    const maxIndex = searchResults.length - 1;
    if (direction === 1) {
      activeSearchIndex = activeSearchIndex >= maxIndex ? 0 : activeSearchIndex + 1;
      return;
    }

    activeSearchIndex = activeSearchIndex <= 0 ? maxIndex : activeSearchIndex - 1;
  }

  async function navigateToSearchResult(result: NavSearchItem) {
    searchOpen = false;
    activeSearchIndex = 0;
    globalSearch.set('');
    await goto(result.path);
  }

  async function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      searchOpen = false;
      return;
    }

    if (!searchQuery) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      searchOpen = true;
      moveSearchSelection(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      searchOpen = true;
      moveSearchSelection(-1);
      return;
    }

    if (event.key === 'Enter' && searchResults.length > 0) {
      event.preventDefault();
      await navigateToSearchResult(searchResults[activeSearchIndex] ?? searchResults[0]);
    }
  }

  async function runValidation() {
    try {
      const result = await api.get<{ valid?: boolean; message?: string; status?: string }>('/system/validate');
      const failed = result.valid === false || result.status === 'error';
      const message = result.message ?? (failed ? 'Validation failed' : 'Validation passed');
      if (failed) toasts.error(message);
      else toasts.success(message);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Validation failed');
    }
  }

  async function logout() {
    api.setToken(null);
    if (browser) localStorage.removeItem('ezngfw_role');
    await goto(base + '/login');
  }
</script>

<header class="border-b border-slate-800 bg-slate-950">
  <div class="flex flex-col gap-4 px-4 py-4 md:px-6">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div class="flex items-center gap-3">
        <Sheet.Root bind:open={$sidebarOpen}>
          <Sheet.Trigger
            class="inline-flex size-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800/60 md:hidden"
          >
            <Menu class="size-4" />
          </Sheet.Trigger>
          <Sheet.Content side="left" class="w-[280px] border-slate-800 bg-slate-950 p-0">
            <Sidebar inSheet={true} />
          </Sheet.Content>
        </Sheet.Root>

        <div>
          <h1 class="text-lg font-semibold text-slate-100">{title}</h1>
          <p class="text-xs text-slate-400">{section}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <div class="relative min-w-[220px] flex-1 sm:flex-none" bind:this={searchContainer}>
          <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            bind:value={$globalSearch}
            onfocus={openSearchDropdown}
            onkeydown={handleSearchKeydown}
            placeholder={$_('header.search_placeholder')}
            class="h-9 w-full border-slate-700 bg-slate-900 pl-9 pr-16 text-slate-100 placeholder:text-slate-500 sm:w-[260px]"
          />
          <button
            type="button"
            onclick={() => commandPaletteOpen.set(true)}
            class="pointer-events-auto absolute top-1/2 right-2 -translate-y-1/2 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
            title="Open command palette"
          >
            <span class="hidden sm:inline">{navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl+'}K</span>
            <span class="sm:hidden">⌘K</span>
          </button>

          {#if showSearchDropdown}
            <div class="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl shadow-black/40 sm:w-[420px]">
              {#if searchResults.length > 0}
                {#each searchResults as result, index (result.title + result.path + result.breadcrumb)}
                  <button
                    type="button"
                    class={`flex w-full items-center gap-3 border-b border-slate-800/70 px-3 py-2.5 text-left transition-colors ${
                      index === activeSearchIndex ? 'bg-slate-800' : 'hover:bg-slate-800/70'
                    }`}
                    onclick={() => navigateToSearchResult(result)}
                    onmouseenter={() => {
                      activeSearchIndex = index;
                    }}
                  >
                    <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-cyan-300">
                      <result.icon class="size-4" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium text-slate-100">{result.title}</span>
                      <span class="block truncate text-xs text-slate-400">{result.breadcrumb}</span>
                    </span>
                    <span class="hidden rounded border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300 sm:inline">
                      {result.path}
                    </span>
                  </button>
                {/each}

                <div class="flex items-center justify-between bg-slate-950 px-3 py-2 text-[11px] text-slate-500">
                  <span>Enter to open</span>
                  <span class="text-cyan-300">↑ ↓ navigate</span>
                  <span>Esc closes</span>
                </div>
              {:else}
                <div class="px-3 py-3 text-xs text-slate-400">{$_('command_palette.no_results')}</div>
              {/if}
            </div>
          {/if}
        </div>

        <label class="hidden h-9 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 sm:inline-flex">
          <input
            type="checkbox"
            class="size-4 rounded border-slate-600 bg-slate-950 text-cyan-400"
            bind:checked={$stagedMode}
          />
          <span>{$_('header.staged')}</span>
          <Badge class="border border-cyan-500/30 bg-cyan-900/30 text-cyan-200">{queueCount}</Badge>
        </label>


        <Button
          href="{base}/wizard"
          variant="outline"
          size="sm"
          class="hidden border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800/60 sm:inline-flex"
        >
          <WandSparkles class="size-4" />
          {$_('header.setup_wizard')}
        </Button>

        <Button
          size="sm"
          variant="outline"
          class="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800/60"
          onclick={() => theme.toggle()}
          title={$theme === 'dark' ? $_('header.light_mode') : $_('header.dark_mode')}
        >
          {#if $theme === 'dark'}
            <Sun class="size-4" />
          {:else}
            <Moon class="size-4" />
          {/if}
        </Button>

        <Button size="sm" class="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onclick={refreshNow}>
          <RefreshCw class="size-4" />
          {$_('header.refresh')}
        </Button>

        <label class="hidden h-9 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 sm:inline-flex">
          <input
            type="checkbox"
            class="size-4 rounded border-slate-600 bg-slate-950 text-cyan-400"
            bind:checked={$autoRefreshEnabled}
          />
          <span>Auto</span>          <Badge class="border border-cyan-500/30 bg-cyan-900/30 text-cyan-200">{$autoRefreshCountdown}s</Badge>
        </label>

        <Button
          size="sm"
          class="hidden border-emerald-400/70 bg-emerald-500 text-white hover:bg-emerald-400 sm:inline-flex"
          onclick={runValidation}
        >
          <BadgeCheck class="size-4" />
          {$_('header.validate')}
        </Button>
      </div>
    </div>

    <div class="hidden flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-3 sm:flex">

      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-100 hover:bg-slate-800/60"
        >
          <UserRound class="size-4" />
          {$_('header.admin')}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="border-slate-700 bg-slate-900 text-slate-100">
          <div class="px-2 py-1.5">
            <p class="text-xs text-slate-500">{$_('header.role')}</p>
            <Badge class="mt-1 border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{role}</Badge>
          </div>
          <DropdownMenu.Separator class="bg-slate-700" />
          <DropdownMenu.Item variant="destructive" onclick={logout}>
            <LogOut class="size-4" />
            {$_('header.logout')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>
</header>
