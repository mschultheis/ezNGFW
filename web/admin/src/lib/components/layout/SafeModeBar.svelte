<!-- Layout component that controls the SafeModeBar area of the admin shell. -->

<script lang="ts">
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { Button } from '$lib/components/ui/button';
  import {
    confirmApply,
    manualRollback,
    rollbackCountdown,
    rollbackTimeout,
    safeModeActive
  } from '$lib/stores/safemode';

  const progress = $derived.by(() => {
    const total = Math.max(1, $rollbackTimeout);
    return Math.max(0, Math.min(100, ($rollbackCountdown / total) * 100));
  });
</script>

{#if $safeModeActive}
  <section class="border-b border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-200 md:px-6">
    <div class="mx-auto max-w-7xl space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-2">
          <TriangleAlert class="mt-0.5 size-4 shrink-0" />
          <p class="text-sm leading-relaxed">
            <span class="font-semibold">Safe Mode:</span>
            Config changes applied. Confirm within {$rollbackCountdown}s or they will be automatically reverted.
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <Button
            class="bg-emerald-500 text-white hover:bg-emerald-600"
            onclick={() => void confirmApply()}
          >
            Confirm Changes
          </Button>
          <Button
            variant="outline"
            class="border-red-500/60 bg-red-500/10 text-red-100 hover:bg-red-500/20"
            onclick={() => void manualRollback()}
          >
            Revert Now
          </Button>
        </div>
      </div>

      <div class="space-y-1">
        <div class="h-2 overflow-hidden rounded-full bg-amber-950/80">
          <div
            class="h-full rounded-full bg-amber-300 transition-all duration-700 ease-linear"
            style={`width: ${progress}%`}
          ></div>
        </div>
        <p class="text-right text-xs text-amber-300/90">{$rollbackCountdown}/{$rollbackTimeout}s</p>
      </div>
    </div>
  </section>
{/if}
