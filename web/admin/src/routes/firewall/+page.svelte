<!-- Route view for `/firewall` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  onMount(() => {
    void goto(base + '/firewall/rules', { replaceState: true });
  });
</script>

<p class="text-slate-400">Redirecting...</p>
