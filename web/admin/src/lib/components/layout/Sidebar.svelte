<!-- Layout component that controls the Sidebar area of the admin shell. -->

<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
  import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import { navGroups, type NavItem } from '$lib/config/navigation';
  import { cn } from '$lib/utils';
  import { sidebarOpen, sidebarCollapsed } from '$lib/stores/ui';
  import { interfaceStore } from '$lib/stores/interfaces';
  import { _ } from '$lib/i18n';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let { inSheet = false } = $props<{ inSheet?: boolean }>();

  /** Map navigation group titles to i18n keys. Falls back to the raw title if no key exists. */
  const groupTitleKeys: Record<string, string> = {
    'MONITORING': 'nav.monitoring',
    'NETWORK': 'nav.network',
    'SECURITY': 'nav.security',
    'SECURITY SERVICES': 'nav.security',
    'ROUTING & VPN': 'nav.routing_vpn',
    'PLATFORM': 'nav.platform'
  };

  function localizedGroupTitle(title: string): string {
    const key = groupTitleKeys[title];
    return key ? $_(key) : title;
  }
  let collapsedGroups = $state<Record<string, boolean>>({});
  let collapsedItems = $state<Record<string, boolean>>({});

  /** When rendered inside a Sheet (mobile), never collapse — always show full sidebar. */
  const isCollapsed = $derived(!inSheet && $sidebarCollapsed);

  function toggleGroup(groupTitle: string) {
    collapsedGroups[groupTitle] = !collapsedGroups[groupTitle];
  }

  function toggleItem(itemPath: string) {
    collapsedItems[itemPath] = !collapsedItems[itemPath];
  }

  function closeIfSheet() {
    if (inSheet) sidebarOpen.set(false);
  }

  function appPath(pathname: string) {
    return base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
  }

  function isPathActive(path: string, exact = false): boolean {
    const current = appPath($page.url.pathname);
    if (path === '/' || exact) return current === path;
    return current === path || current.startsWith(path + '/');
  }

  function hasActiveChild(item: NavItem): boolean {
    return item.children?.some((child) => isPathActive(child.path)) ?? false;
  }

  function isItemExpanded(item: NavItem): boolean {
    if (!item.children?.length) return false;
    if (collapsedItems[item.path] !== undefined) return !collapsedItems[item.path];
    return hasActiveChild(item);
  }

  onMount(() => interfaceStore.start());
  onDestroy(() => interfaceStore.stop());

  /** Scroll the currently active sidebar item into view after navigation. */
  $effect(() => {
    const _path = $page.url.pathname;
    queueMicrotask(() => {
      const nav = document.querySelector('aside nav');
      if (!nav) return;
      const active = nav.querySelector('a[class*="border-cyan-400"]') as HTMLElement | null;
      if (active) {
        active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  });
</script>

<aside
  class={cn(
    'hidden h-screen border-r border-slate-800 bg-slate-950 transition-all duration-200 md:flex md:flex-col',
    isCollapsed ? 'w-16' : 'w-64',
    inSheet && 'flex w-full'
  )}
>
  <!-- Brand header -->
  <div class={cn('px-4 py-5', isCollapsed && 'px-2')}>
    {#if isCollapsed}
      <div class="flex items-center justify-center">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-cyan-800 bg-cyan-900/40">
          <ShieldCheck class="size-4 text-cyan-400" />
        </span>
      </div>
    {:else}
      <div class="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
        <div class="flex items-center gap-2">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-cyan-800 bg-cyan-900/40">
            <ShieldCheck class="size-4 text-cyan-400" />
          </span>
          <div class="flex flex-col leading-tight">
            <span class="text-sm font-bold text-slate-100">EZ-NGFW</span>
            <span class="text-[9px] font-medium text-slate-400 uppercase">Administrative Plane</span>
          </div>
        </div>
        <span class="rounded-full border border-cyan-700/60 bg-cyan-900/35 px-2 py-1 text-[10px] font-medium text-cyan-300">Enterprise</span>
      </div>
    {/if}
  </div>

  <!-- Navigation -->
  <nav class={cn('flex-1 overflow-y-auto py-4', isCollapsed ? 'px-1' : 'px-3')}>
    {#each navGroups as group}
      <div class="mb-4">
        <!-- Group title: hidden when collapsed -->
        {#if !isCollapsed}
          <button
            type="button"
            class="section-toggle flex w-full items-center justify-between rounded-md px-2 py-2 text-[0.65rem] font-semibold tracking-[0.14em] text-slate-300 uppercase transition-colors hover:bg-slate-800/60 hover:text-slate-100"
            onclick={() => toggleGroup(group.title)}
          >
            {localizedGroupTitle(group.title)}
            <ChevronDown class={cn('size-3.5 text-slate-500 transition-transform', collapsedGroups[group.title] && '-rotate-90')} />
          </button>
        {:else}
          <div class="my-2 mx-2 border-t border-slate-800"></div>
        {/if}

        {#if !collapsedGroups[group.title]}
          <ul class="mt-1 space-y-1">
            {#each group.items as item}
              <li>
                {#if isCollapsed}
                  <!-- Collapsed: icon-only with tooltip -->
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <a
                        href={base + (item.children?.length ? (item.children[0]?.path ?? item.path) : item.path)}
                        onclick={closeIfSheet}
                        class={cn(
                          'flex items-center justify-center rounded-md p-2 text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-slate-100',
                          (isPathActive(item.path) || hasActiveChild(item)) && 'border-l-2 border-cyan-400 bg-cyan-900/30 text-cyan-100'
                        )}
                      >
                        <item.icon class={cn('size-4', (isPathActive(item.path) || hasActiveChild(item)) ? 'text-cyan-300' : 'text-slate-500')} />
                      </a>
                    </Tooltip.Trigger>
                    <Tooltip.Content side="right" class="border-slate-700 bg-slate-900 text-slate-100">
                      <p>{item.title}</p>
                    </Tooltip.Content>
                  </Tooltip.Root>
                {:else if item.children?.length}
                  <!-- Expanded: with sub-items -->
                  <button
                    type="button"
                    class={cn(
                      'flex w-full items-center justify-between rounded-md border-l-2 border-transparent px-2 py-2 text-[0.78rem] font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-slate-100',
                      hasActiveChild(item) && 'border-cyan-400 bg-cyan-900/30 text-cyan-100'
                    )}
                    onclick={() => toggleItem(item.path)}
                  >
                    <span class="flex items-center gap-2.5">
                      <item.icon class={cn('size-4', hasActiveChild(item) ? 'text-cyan-300' : 'text-slate-500')} />
                      <span>{item.title}</span>
                    </span>
                    <ChevronDown class={cn('size-3.5 transition-transform', !isItemExpanded(item) && '-rotate-90')} />
                  </button>

                  {#if isItemExpanded(item)}
                    <ul class="ml-8 mt-1 space-y-1 border-l-2 border-slate-700 pl-4">
                      {#each item.children as child}
                        <li>
                          <a
                            href={base + child.path}
                            onclick={closeIfSheet}
                            class={cn(
                              'flex items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-slate-100',
                              isPathActive(child.path, child.path === item.path) && 'border-cyan-400 bg-cyan-900/30 text-cyan-100'
                            )}
                          >
                            <child.icon class={cn('size-3.5', isPathActive(child.path, child.path === item.path) ? 'text-cyan-300' : 'text-slate-500')} />
                            <span>{child.title}</span>
                          </a>
                        </li>
                      {/each}

                      {#if item.title === 'Interfaces' && $interfaceStore.length > 0}
                        <li class="mt-2 border-t border-slate-700/50 pt-2">
                          <span
                            class="px-2 text-[0.6rem] font-semibold tracking-wider text-slate-500 uppercase"
                            >Live Status</span
                          >
                        </li>
                        {#each $interfaceStore as iface}
                          <li>
                            <a
                              href="{base}/interfaces/{iface.name}"
                              class="flex items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-slate-100"
                            >
                              <span
                                class="{iface.status === 'up'
                                  ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]'
                                  : iface.status === 'down'
                                    ? 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.5)]'
                                    : 'bg-slate-500'} inline-block size-2 rounded-full"
                              ></span>
                              <span class="truncate">{iface.name}</span>
                              {#if iface.role}
                                <span class="ml-auto text-[0.6rem] text-slate-500">{iface.role}</span>
                              {/if}
                            </a>
                          </li>
                        {/each}
                      {/if}
                    </ul>
                  {/if}
                {:else}
                  <!-- Expanded: leaf item -->
                  <a
                    href={base + item.path}
                    onclick={closeIfSheet}
                    class={cn(
                      'flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-2 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-slate-100',
                      isPathActive(item.path) && 'border-cyan-400 bg-cyan-900/30 text-cyan-100'
                    )}
                  >
                    <item.icon class={cn('size-4', isPathActive(item.path) ? 'text-cyan-300' : 'text-slate-500')} />
                    <span>{item.title}</span>
                  </a>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </nav>

  <!-- Collapse toggle button at the bottom -->
  {#if !inSheet}
    <div class={cn('border-t border-slate-800 p-2', isCollapsed ? 'flex justify-center' : 'px-3')}>
      <button
        type="button"
        class={cn(
          'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-100',
          isCollapsed && 'justify-center'
        )}
        onclick={() => sidebarCollapsed.toggle()}
        aria-label={isCollapsed ? $_('sidebar.expand') : $_('sidebar.collapse')}
      >
        {#if isCollapsed}
          <PanelLeftOpen class="size-4" />
        {:else}
          <PanelLeftClose class="size-4" />
          <span>{$_('sidebar.collapse')}</span>
        {/if}
      </button>
    </div>
  {/if}
</aside>
