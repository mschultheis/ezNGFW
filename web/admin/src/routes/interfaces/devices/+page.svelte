<!-- Route view for `/interfaces/devices` — read-only physical device discovery. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import SearchIcon from '@lucide/svelte/icons/search';

  import { _ } from '$lib/i18n';
  type Device = {
    name: string;
    mac_address: string;
    mac: string;
    driver: string;
    speed: string;
    link_detected: boolean;
    status: string;
    ipv4_addresses: string[];
    ipv6_addresses: string[];
  };

  let devices = $state<Device[]>([]);
  let loading = $state(true);
  let search = $state('');

  let filtered = $derived.by(() => {
    if (!search.trim()) return devices;
    const q = search.toLowerCase();
    return devices.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      d.mac.toLowerCase().includes(q) ||
      d.mac_address.toLowerCase().includes(q) ||
      d.driver.toLowerCase().includes(q) ||
      d.status.toLowerCase().includes(q) ||
      (d.ipv4_addresses ?? []).some((ip) => ip.includes(q)) ||
      (d.ipv6_addresses ?? []).some((ip) => ip.toLowerCase().includes(q))
    );
  });

  async function load() {
    loading = true;
    try {
      const payload = await api.get('/interfaces/devices');
      devices = Array.isArray(payload) ? (payload as Device[]) : [];
    } catch {
      devices = [];
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
          <CardTitle class="text-lg text-slate-100">{$_('iface_devices.physical_devices')}</CardTitle>
          <CardDescription class="text-slate-400">Discovered network interfaces on this system. This view is read-only — devices are detected automatically.</CardDescription>
        </div>
        <Button variant="outline" size="sm" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => load()} disabled={loading}>
          <RefreshCwIcon class="mr-1.5 h-4 w-4 {loading ? 'animate-spin' : ''}" />
          Refresh
        </Button>
      </div>
      <div class="relative mt-3 max-w-sm">
        <SearchIcon class="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
        <Input type="text" placeholder="Filter devices…" class="border-slate-700 bg-slate-800 pl-9 text-sm text-slate-200 placeholder:text-slate-500" bind:value={search} />
      </div>
    </CardHeader>
    <CardContent class="p-0">
      {#if loading && devices.length === 0}
        <div class="px-6 py-10 text-center text-sm text-slate-500">Loading devices…</div>
      {:else if filtered.length === 0}
        <div class="px-6 py-10 text-center text-sm text-slate-500">
          {search ? 'No devices match your filter.' : 'No devices discovered.'}
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                <th class="px-4 py-3">Name</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">MAC</th>
                <th class="px-4 py-3">Driver</th>
                <th class="px-4 py-3">Speed</th>
                <th class="px-4 py-3">IPv4</th>
                <th class="px-4 py-3">IPv6</th>
              </tr>
            </thead>
            <tbody>
              {#each filtered as d (d.name)}
                <tr class="border-b border-slate-800/50 transition-colors hover:bg-slate-800/40">
                  <td class="px-4 py-2.5 font-mono text-cyan-400">{d.name}</td>
                  <td class="px-4 py-2.5">
                    <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {d.link_detected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}">
                      <span class="h-1.5 w-1.5 rounded-full {d.link_detected ? 'bg-emerald-400' : 'bg-slate-500'}"></span>
                      {d.status || (d.link_detected ? 'Up' : 'Down')}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 font-mono text-xs text-slate-300">{d.mac || d.mac_address || '—'}</td>
                  <td class="px-4 py-2.5 text-slate-300">{d.driver || '—'}</td>
                  <td class="px-4 py-2.5 text-slate-300">{d.speed || '—'}</td>
                  <td class="px-4 py-2.5 font-mono text-xs text-slate-300">{(d.ipv4_addresses ?? []).join(', ') || '—'}</td>
                  <td class="px-4 py-2.5 font-mono text-xs text-slate-300">{(d.ipv6_addresses ?? []).join(', ') || '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <div class="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
        {filtered.length} device{filtered.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}
      </div>
    </CardContent>
  </Card>
</div>
