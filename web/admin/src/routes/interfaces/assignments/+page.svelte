<!-- Route view for `/interfaces/assignments` in the ezNGFW admin GUI. -->

<script lang="ts">
  import AssignmentsTab from '$lib/components/interfaces/AssignmentsTab.svelte';
  import { goto } from '$app/navigation';

  import { _ } from '$lib/i18n';
  function handleSelectInterface(name: string) {
    goto(`/interfaces/${encodeURIComponent(name)}`);
  }
</script>

<svelte:head>
  <title>Interface Assignments — ezNGFW</title>
</svelte:head>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <AssignmentsTab onSelectInterface={handleSelectInterface} />
</div>
