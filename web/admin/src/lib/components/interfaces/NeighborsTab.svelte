<!-- Interface management component for the NeighborsTab tab and related data. -->

<script lang="ts">
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';

  let loading = $state(true);
  let error = $state('');
  let rows = $state<Record<string, unknown>[]>([]);

  function text(value: unknown) {
    return value === null || value === undefined || value === '' ? 'N/A' : String(value);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const payload = await api.get<Record<string, unknown>[]>('/interfaces/neighbors');
      rows = Array.isArray(payload) ? payload : [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to load neighbors';
      toasts.error(error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <CardTitle class="text-slate-100">Neighbors (ARP/NDP)</CardTitle>
        <CardDescription class="text-slate-400">Resolved peer entries discovered on each interface</CardDescription>
      </div>
      <Button variant="outline" class="border-slate-700 bg-slate-950 text-slate-200" onclick={load}>
        <RefreshCw class="size-4" /> Refresh
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    {#if loading}
      <div class="space-y-2">{#each Array.from({ length: 6 }) as _}<Skeleton class="h-10 bg-slate-800" />{/each}</div>
    {:else if error}
      <p class="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>
    {:else}
      <div class="overflow-x-auto rounded-md border border-slate-800">
        <Table>
          <TableHeader class="bg-slate-800">
            <TableRow class="border-slate-700 hover:bg-slate-800">
              <TableHead class="text-slate-300">IP</TableHead>
              <TableHead class="text-slate-300">MAC</TableHead>
              <TableHead class="text-slate-300">Interface</TableHead>
              <TableHead class="text-slate-300">State</TableHead>
              <TableHead class="text-slate-300">Permanent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if rows.length === 0}
              <TableRow class="border-slate-800 hover:bg-slate-900"><TableCell colspan={5} class="py-8 text-center text-slate-500">No neighbors found</TableCell></TableRow>
            {:else}
              {#each rows as row}
                <TableRow class="border-slate-800 hover:bg-slate-800/30">
                  <TableCell class="mono text-xs">{text(row.ip)}</TableCell>
                  <TableCell class="mono text-xs">{text(row.mac)}</TableCell>
                  <TableCell>{text(row.interface)}</TableCell>
                  <TableCell>{text(row.state)}</TableCell>
                  <TableCell>{Boolean(row.permanent) ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>
    {/if}
  </CardContent>
</Card>
