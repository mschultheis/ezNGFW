<!-- Route view for `/ipsec` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  onMount(() => {
    void goto(base + '/ipsec/tunnels', { replaceState: true });
  });
</script>

<p class="text-slate-400">Redirecting to IPsec...</p>
