<!-- Administrative component that powers the ServiceBadge workflow in the ezNGFW GUI. -->

<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleX from '@lucide/svelte/icons/circle-x';
  import CircleOff from '@lucide/svelte/icons/circle-off';
  import CircleHelp from '@lucide/svelte/icons/circle-help';

  let {
    status = 'unknown',
    message = ''
  }: {
    status?: string;
    message?: string;
  } = $props();

  const normalized = $derived(status.toLowerCase().replace(/[\s_-]/g, ''));

  const isRunning = $derived(normalized === 'running' || normalized === 'online');
  const isStopped = $derived(normalized === 'stopped' || normalized === 'offline');
  const isNotInstalled = $derived(normalized === 'notinstalled');
  const isError = $derived(normalized === 'error');

  const badgeClass = $derived(
    isRunning
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      : isNotInstalled || isError
        ? 'border-red-500/30 bg-red-500/10 text-red-400'
        : isStopped
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
  );

  const displayLabel = $derived(
    isRunning ? 'Running'
    : isNotInstalled ? 'Not Installed'
    : isError ? 'Error'
    : isStopped ? 'Stopped'
    : status || 'Unknown'
  );
</script>

<div class="inline-flex flex-col gap-1">
  <Badge class="{badgeClass} inline-flex items-center gap-1.5">
    {#if isRunning}
      <CircleCheck class="h-3 w-3" />
    {:else if isNotInstalled}
      <CircleOff class="h-3 w-3" />
    {:else if isError}
      <CircleX class="h-3 w-3" />
    {:else if isStopped}
      <CircleAlert class="h-3 w-3" />
    {:else}
      <CircleHelp class="h-3 w-3" />
    {/if}
    {displayLabel}
  </Badge>
  {#if message}
    <p class="max-w-xs text-xs {isNotInstalled || isError ? 'text-red-400/70' : 'text-slate-500'}">{message}</p>
  {/if}
</div>
