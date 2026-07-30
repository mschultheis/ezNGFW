<!-- Route view for `/interfaces/[name]` — per-interface detail with tabs. -->

<script lang="ts">
  import { page } from '$app/stores';
  import InterfaceDetail from '$lib/components/interfaces/InterfaceDetail.svelte';
  import { _ } from '$lib/i18n';

  const name = $derived($page.params.name);
</script>

<svelte:head>
  <title>{name ? `${name} — Interface Detail` : 'Interface Detail'} — ezNGFW</title>
</svelte:head>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  {#if name}
    <InterfaceDetail {name} />
  {:else}
    <p class="text-slate-400">{$_('interfaces_detail.no_interface_selected')}</p>
  {/if}
</div>
