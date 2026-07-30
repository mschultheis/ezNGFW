<!-- Administrative component that powers the ReadOnlyTable workflow in the ezNGFW GUI. -->

<script lang="ts">
  import { api } from '$lib/api/client';
  import { asList, asString } from '$lib/utils/api-data';
  import type { TableColumn } from '$lib/types/admin';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';

  let {
    title,
    endpoint,
    columns,
    description = ''
  }: { title: string; endpoint: string; columns: TableColumn[]; description?: string } = $props();

  let loading = $state(true);
  let error = $state('');
  let rows = $state<Record<string, unknown>[]>([]);

  async function load() {
    loading = true;
    error = '';
    try {
      const payload = await api.get(endpoint);
      rows = asList(payload);
    } catch (e) {
      error = e instanceof Error ? e.message : `Failed loading ${title.toLowerCase()}`;
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
    <CardTitle class="text-slate-100">{title}</CardTitle>
    {#if description}
      <CardDescription class="text-slate-400">{description}</CardDescription>
    {/if}
  </CardHeader>
  <CardContent>
    {#if loading}
      <div class="space-y-2">
        <Skeleton class="h-9 bg-slate-800" />
        <Skeleton class="h-9 bg-slate-800" />
        <Skeleton class="h-9 bg-slate-800" />
      </div>
    {:else if error}
      <p class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
    {:else}
      <div class="overflow-x-auto rounded-md border border-slate-800">
        <Table>
          <TableHeader class="bg-slate-800">
            <TableRow class="border-slate-700 hover:bg-slate-800">
              {#each columns as column}
                <TableHead class="text-slate-300">{column.label}</TableHead>
              {/each}
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if rows.length === 0}
              <TableRow class="border-slate-800 hover:bg-slate-900">
                <TableCell colspan={columns.length} class="py-8 text-center text-slate-500">No records found</TableCell>
              </TableRow>
            {:else}
              {#each rows as row}
                <TableRow class="border-slate-800 hover:bg-slate-800/30">
                  {#each columns as column}
                    <TableCell class={column.mono ? 'mono text-xs' : ''}>{asString(row[column.key])}</TableCell>
                  {/each}
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>
    {/if}
  </CardContent>
</Card>
