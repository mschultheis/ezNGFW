<!-- Interface management component for the OverviewTab tab and related data. -->

<script lang="ts">
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';

  type OverviewRow = {
    name: string;
    role?: string;
    identifier?: string;
    enabled: boolean;
    address: string;
    ipv4_config_type: string;
    ipv6_config_type: string;
    mtu: number;
    link_up: boolean;
    dhcp_server_enabled: boolean;
  };

  let { onSelectInterface }: { onSelectInterface?: (name: string) => void } = $props();

  let loading = $state(true);
  let rows = $state<OverviewRow[]>([]);
  let error = $state('');

  function text(v: unknown) {
    return v === null || v === undefined || v === '' ? 'N/A' : String(v);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const payload = await api.get<OverviewRow[]>('/interfaces/overview');
      rows = Array.isArray(payload) ? payload : [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to load interface overview';
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
        <CardTitle class="text-slate-100">Overview</CardTitle>
        <CardDescription class="text-slate-400">Interface health, addressing, and link telemetry</CardDescription>
      </div>
      <Button variant="outline" class="border-slate-700 bg-slate-950 text-slate-200" onclick={load}>
        <RefreshCw class="size-4" /> Refresh
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    {#if loading}
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {#each Array.from({ length: 6 }) as _}
          <Skeleton class="h-36 bg-slate-800" />
        {/each}
      </div>
    {:else if error}
      <p class="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>
    {:else}
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {#each rows as row}
          <button
            type="button"
            class="rounded-lg border border-slate-800 bg-slate-950 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900"
            onclick={() => onSelectInterface?.(String(row.name ?? row.identifier ?? ''))}
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <p class="font-medium text-slate-100">{text(row.name)}</p>
                {#if row.identifier}
                  <p class="text-xs text-slate-500">({text(row.identifier)})</p>
                {/if}
              </div>
              <div class="flex items-center gap-2">
                {#if row.role}
                  <Badge class="border-slate-600 bg-slate-800 text-slate-300">{text(row.role)}</Badge>
                {/if}
                <Badge class={row.link_up ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-rose-500/40 bg-rose-500/15 text-rose-300'}>
                  {row.link_up ? 'UP' : 'DOWN'}
                </Badge>
              </div>
            </div>
            <div class="space-y-1 text-sm text-slate-300">
              <p><span class="text-slate-500">Enabled:</span>
                <span class={row.enabled ? 'text-emerald-400' : 'text-slate-500'}>{row.enabled ? 'Yes' : 'No'}</span>
              </p>
              <p><span class="text-slate-500">IP:</span> {text(row.address)}</p>
              <p><span class="text-slate-500">Type:</span> {text(row.ipv4_config_type)}</p>
              <p><span class="text-slate-500">MTU:</span> {text(row.mtu)}</p>
            </div>
            {#if row.dhcp_server_enabled}
              <div class="mt-2">
                <Badge class="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">DHCP Server</Badge>
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>
