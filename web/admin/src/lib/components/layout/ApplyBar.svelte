<!-- Layout component that controls the ApplyBar area of the admin shell. -->

<script lang="ts">
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import CheckCheck from '@lucide/svelte/icons/check-check';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { stagedMode, changeQueue, applyQueue, clearQueue } from '$lib/stores/staged';
  import {
    safeModeActive,
    rollbackCountdown,
    rollbackTimeout,
    applyWithRollback,
    confirmApply,
    manualRollback
  } from '$lib/stores/safemode';

  let reviewOpen = $state(false);

  const queueCount = $derived($changeQueue.length);
  const isCountdown = $derived($safeModeActive);
  const isVisible = $derived(queueCount > 0 || isCountdown);
  const pendingLabels = $derived($changeQueue.map((item) => item.label));
  const countdownCopy = $derived(
    `Confirm within ${Math.max(0, $rollbackCountdown)}s or changes will be reverted`
  );

  const progress = $derived.by(() => {
    const total = Math.max(1, $rollbackTimeout);
    return Math.max(0, Math.min(100, ($rollbackCountdown / total) * 100));
  });

  async function handleApplyChanges() {
    if (queueCount === 0) return;

    const queuedChanges = [...$changeQueue];
    if (queuedChanges.length === 0) {
      await applyQueue();
      return;
    }
    const applied = await applyWithRollback(async () => {
      for (const item of queuedChanges) {
        await item.action();
      }
    }, 60);

    if (applied) {
      changeQueue.set([]);
      reviewOpen = false;
    }
  }

  function handleDiscardAll() {
    clearQueue();
    reviewOpen = false;
  }

  function toggleReview() {
    reviewOpen = !reviewOpen;
  }

</script>

{#if isVisible}
  <section class="border-b border-slate-800 bg-slate-950 px-4 py-3 md:px-6">
    <div
      class={`mx-auto max-w-7xl rounded-lg border px-4 py-3 shadow-lg shadow-black/30 transition-colors ${
        isCountdown
          ? 'border-emerald-500/70 bg-emerald-500/10'
          : 'border-amber-500/70 bg-amber-500/10'
      }`}
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
          {#if isCountdown}
            <div class="flex items-center gap-2 text-emerald-100">
              <CheckCheck class="size-4 shrink-0" />
              <p class="text-sm font-semibold">Changes applied and awaiting confirmation</p>
            </div>
            <p class="text-xs text-emerald-200/90">{countdownCopy}</p>
          {:else}
            <div class="flex items-center gap-2 text-amber-100">
              <TriangleAlert class="size-4 shrink-0" />
              <p class="text-sm font-semibold">
                {queueCount} unsaved configuration change{queueCount === 1 ? '' : 's'}
              </p>
            </div>
            <p class="text-xs text-amber-200/90">
              {#if $stagedMode}
                Review pending updates before applying to the running config.
              {:else}
                Staged mode is off, but queued updates are still waiting to be applied.
              {/if}
            </p>
          {/if}
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          {#if isCountdown}
            <Button class="bg-emerald-500 text-white hover:bg-emerald-400" onclick={() => void confirmApply()}>
              Confirm
            </Button>
            <Button
              variant="outline"
              class="border-red-500/60 bg-red-500/10 text-red-100 hover:bg-red-500/20"
              onclick={() => void manualRollback()}
            >
              <RotateCcw class="size-4" />
              Revert Now
            </Button>
          {:else}
            <Button
              variant="outline"
              class="border-amber-500/60 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
              onclick={toggleReview}
            >
              Review Changes
              {#if reviewOpen}
                <ChevronUp class="size-4" />
              {:else}
                <ChevronDown class="size-4" />
              {/if}
            </Button>
            <Button class="bg-emerald-500 text-white hover:bg-emerald-400" onclick={() => void handleApplyChanges()}>
              <CheckCheck class="size-4" />
              Apply Changes
            </Button>
            <Button
              variant="outline"
              class="border-red-500/60 bg-transparent text-red-200 hover:bg-red-500/15"
              onclick={handleDiscardAll}
            >
              <Trash2 class="size-4" />
              Discard All
            </Button>
          {/if}
        </div>
      </div>

      {#if !isCountdown && reviewOpen && queueCount > 0}
        <div class="mt-3 rounded-md border border-amber-500/40 bg-slate-900/70 p-3">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-xs font-semibold tracking-wide text-amber-200 uppercase">Queued Changes</p>
            <Badge class="border border-amber-500/40 bg-amber-500/10 text-amber-100">{queueCount}</Badge>
          </div>
          <ul class="space-y-1.5 text-sm text-slate-100">
            {#each pendingLabels as label, index (`${label}-${index}`)}
              <li class="rounded border border-slate-700/80 bg-slate-950/60 px-2.5 py-1.5">{label}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if isCountdown}
        <div class="mt-3 space-y-1.5">
          <div class="h-2 overflow-hidden rounded-full bg-slate-900/90">
            <div
              class="h-full rounded-full bg-emerald-400 transition-all duration-700 ease-linear"
              style={`width: ${progress}%`}
            ></div>
          </div>
          <p class="text-right text-xs text-emerald-200/90">{$rollbackCountdown}/{$rollbackTimeout}s</p>
        </div>
      {/if}
    </div>
  </section>
{/if}
