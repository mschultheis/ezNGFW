<!-- Route view for `/interfaces/neighbors` — read-only ARP/NDP neighbor discovery. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import SearchIcon from '@lucide/svelte/icons/search';

  import { _ } from '$lib/i18n';
  type Neighbor = {
    ip_address: string;
    mac_address: string;
    interface: string;
    state: string;
    is_permanent: boolean;
  };

  let neighbors = $state<Neighbor[]>([]);
  let loading = $state(true);
  let search = $state('');

  let filtered = $derived.by(() => {
    if (!search.trim()) return neighbors;
    const q = search.toLowerCase();
    return neighbors.filter((n) =>
      n.ip_address.toLowerCase().includes(q) ||
      n.mac_address.toLowerCase().includes(q) ||
      n.interface.toLowerCase().includes(q) ||
      n.state.toLowerCase().includes(q)
    );
  });

  async function load() {
    loading = true;
    try {
      const payload = await api.get('/interfaces/neighbors');
      neighbors = Array.isArray(payload) ? (payload as Neighbor[]) : [];
    } catch {
      neighbors = [];
    } finally {
      loading = false;
    }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/80">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-lg text-slate-100">{$_('iface_neighbors.neighbor_table')}</CardTitle>
          <CardDescription class="text-slate-400">ARP and NDP neighbor entries discovered on this system. This view is read-only — entries are populated by the kernel.</CardDescription>
        </div>
        <Button variant="outline" size="sm" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => load()} disabled={loading}>
          <RefreshCwIcon class="mr-1.5 h-4 w-4 {loading ? 'animate-spin' : ''}" />
          Refresh
        </Button>
      </div>
      <div class="relative mt-3 max-w-sm">
        <SearchIcon class="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
        <Input type="text" placeholder="Filter neighbors…" class="border-slate-700 bg-slate-800 pl-9 text-sm text-slate-200 placeholder:text-slate-500" bind:value={search} />
      </div>
    </CardHeader>
    <CardContent class="p-0">
      {#if loading && neighbors.length === 0}
        <div class="px-6 py-10 text-center text-sm text-slate-500">Loading neighbors…</div>
      {:else if filtered.length === 0}
        <div class="px-6 py-10 text-center text-sm text-slate-500">
          {search ? 'No neighbors match your filter.' : 'No neighbors discovered.'}
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                <th class="px-4 py-3">IP Address</th>
                <th class="px-4 py-3">MAC Address</th>
                <th class="px-4 py-3">Interface</th>
                <th class="px-4 py-3">State</th>
                <th class="px-4 py-3">Permanent</th>
              </tr>
            </thead>
            <tbody>
              {#each filtered as n (n.ip_address + n.interface)}
                <tr class="border-b border-slate-800/50 transition-colors hover:bg-slate-800/40">
                  <td class="px-4 py-2.5 font-mono text-cyan-400">{n.ip_address}</td>
                  <td class="px-4 py-2.5 font-mono text-xs text-slate-300">{n.mac_address || '—'}</td>
                  <td class="px-4 py-2.5 font-mono text-slate-300">{n.interface || '—'}</td>
                  <td class="px-4 py-2.5">
                    <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium
                      {n.state === 'REACHABLE' ? 'bg-emerald-500/10 text-emerald-400' :
                       n.state === 'STALE' ? 'bg-amber-500/10 text-amber-400' :
                       n.state === 'DELAY' ? 'bg-sky-500/10 text-sky-400' :
                       'bg-slate-700/50 text-slate-400'}">
                      {n.state || 'unknown'}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    {#if n.is_permanent}
                      <span class="text-xs text-cyan-400">Yes</span>
                    {:else}
                      <span class="text-xs text-slate-500">{$_('common.no')}</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <div class="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
        {filtered.length} neighbor{filtered.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}
      </div>
    </CardContent>
  </Card>
</div>
