<!--
  Global command palette for fast route navigation.
  Keyboard behavior: Cmd+K/Ctrl+K opens, Escape closes, arrows move selection, Enter opens active result.
  Search behavior is delegated to `searchNavigation()` so sidebar and palette ranking stay aligned.
  Props: none (visibility is controlled through the `commandPaletteOpen` store).
-->

<script lang="ts">
  import { goto } from '$app/navigation';
  import Search from '@lucide/svelte/icons/search';
  import CornerDownLeft from '@lucide/svelte/icons/corner-down-left';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import { commandPaletteOpen } from '$lib/stores/ui';
  import { searchNavigation, type NavSearchItem } from '$lib/stores/search';
  import { _ } from '$lib/i18n';

  // Current user input for fuzzy search.
  let query = $state('');
  // Highlighted result index for keyboard navigation.
  let activeIndex = $state(0);
  // Input ref for focus-on-open behavior.
  let inputEl = $state<HTMLInputElement | null>(null);
  // Scroll container ref used to keep active item visible.
  let listEl = $state<HTMLDivElement | null>(null);

  // Uses the shared navigation search store so all navigation search entry
  // points (header, palette) return the same scoring and order.
  const results = $derived(searchNavigation(query.trim(), 12));

  $effect(() => {
    // Reset and autofocus every time the palette opens to avoid stale state
    // from the previous session.
    if ($commandPaletteOpen && inputEl) {
      query = '';
      activeIndex = 0;
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  $effect(() => {
    // Reset selection when results change
    results;
    activeIndex = 0;
  });

  function close() {
    commandPaletteOpen.set(false);
    query = '';
    activeIndex = 0;
  }

  async function selectResult(result: NavSearchItem) {
    close();
    await goto(result.path);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length > 0) {
        activeIndex = activeIndex >= results.length - 1 ? 0 : activeIndex + 1;
        scrollActiveIntoView();
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length > 0) {
        activeIndex = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
        scrollActiveIntoView();
      }
      return;
    }

    if (event.key === 'Enter' && results.length > 0) {
      event.preventDefault();
      selectResult(results[activeIndex] ?? results[0]);
    }
  }

  function scrollActiveIntoView() {
    requestAnimationFrame(() => {
      // Query by data attribute because items are generated dynamically and
      // only one can be active at a time.
      const active = listEl?.querySelector('[data-active="true"]');
      active?.scrollIntoView({ block: 'nearest' });
    });
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }
</script>

{#if $commandPaletteOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-sm"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div
      class="w-full max-w-lg overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60"
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
    >
      <div class="flex items-center gap-3 border-b border-slate-700/70 px-4">
        <Search class="size-4 shrink-0 text-slate-500" />
        <input
          bind:this={inputEl}
          bind:value={query}
          type="text"
          placeholder={$_('command_palette.placeholder')}
          class="h-12 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <kbd class="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">ESC</kbd>
      </div>

      <div bind:this={listEl} class="max-h-[50vh] overflow-y-auto overscroll-contain">
        {#if query.trim().length === 0}
          <div class="px-4 py-6 text-center text-sm text-slate-500">
            {$_('command_palette.type_to_search')}
          </div>
        {:else if results.length === 0}
          <div class="px-4 py-6 text-center text-sm text-slate-400">
            {$_('command_palette.no_results')}
          </div>
        {:else}
          {#each results as result, index (result.title + result.path)}
            <button
              type="button"
              data-active={index === activeIndex}
              class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors {index === activeIndex
                ? 'bg-cyan-500/10 text-cyan-50'
                : 'text-slate-300 hover:bg-slate-800/70'}"
              onclick={() => selectResult(result)}
              onmouseenter={() => { activeIndex = index; }}
            >
              <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-md border {index === activeIndex ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 bg-slate-950 text-slate-400'}">
                <result.icon class="size-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{result.title}</span>
                <span class="block truncate text-xs text-slate-500">{result.breadcrumb}</span>
              </span>
              {#if index === activeIndex}
                <span class="hidden rounded border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300 sm:inline">
                  {result.path}
                </span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>

      {#if results.length > 0 && query.trim().length > 0}
        <div class="flex items-center gap-4 border-t border-slate-700/70 px-4 py-2 text-[11px] text-slate-500">
          <span class="inline-flex items-center gap-1">
            <CornerDownLeft class="size-3" /> {$_('command_palette.open')}
          </span>
          <span class="inline-flex items-center gap-1">
            <ArrowUp class="size-3" /><ArrowDown class="size-3" /> {$_('command_palette.navigate')}
          </span>
          <span class="inline-flex items-center gap-1">
            <kbd class="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-[9px]">ESC</kbd> {$_('command_palette.close')}
          </span>
        </div>
      {/if}
    </div>
  </div>
{/if}
