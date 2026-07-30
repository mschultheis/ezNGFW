<!-- Route view for `/captive-portal` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  onMount(() => {
    void goto(base + '/captive-portal/zones', { replaceState: true });
  });
</script>

<p class="text-slate-400">Redirecting to captive portal...</p>
