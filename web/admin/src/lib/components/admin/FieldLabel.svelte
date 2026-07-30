<!--
  Form field label with optional inline info icon.
  Usage: pass `label` always, pass `hint` to show contextual help tooltip.
-->

<script lang="ts">
  import InfoTooltip from '$lib/components/admin/InfoTooltip.svelte';

  let {
    // Visible form label text.
    label,
    // Optional helper text shown by InfoTooltip; empty string hides the icon.
    hint = ''
  }: {
    label: string;
    hint?: string;
  } = $props();
</script>

<span class="inline-flex items-center gap-1 text-slate-300">
  {label}
  <InfoTooltip hint={hint} />
</span>
