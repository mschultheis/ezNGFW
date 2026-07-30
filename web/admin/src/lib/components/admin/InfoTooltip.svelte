<!--
  Inline info tooltip used by form labels and compact admin UI controls.
  Rendering: only mounts tooltip primitives when `hint` is non-empty.
-->

<script lang="ts">
  import InfoCircle from '@lucide/svelte/icons/info';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    // Tooltip content. Empty value disables rendering.
    hint = ''
  }: {
    hint?: string;
  } = $props();
</script>

{#if hint}
  <!-- Render-on-demand avoids empty tooltip triggers in forms without hints. -->
  <Tooltip.Root delayDuration={150}>
    <Tooltip.Trigger
      class="inline-flex cursor-help text-slate-500 transition-colors hover:text-cyan-400"
      onclick={(e: MouseEvent) => e.preventDefault()}
    >
      <InfoCircle class="size-3.5" />
    </Tooltip.Trigger>
    <Tooltip.Content
      side="top"
      class="max-w-xs rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs leading-relaxed text-slate-200 shadow-lg"
    >
      {hint}
    </Tooltip.Content>
  </Tooltip.Root>
{/if}
