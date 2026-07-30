<!-- Route view for `/dns` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  import { _ } from '$lib/i18n';
  onMount(() => {
    void goto(base + '/dns/settings', { replaceState: true });
  });
</script>

<p class="text-slate-400">{$_('dns_overview.redirecting')}</p>
