<!-- Route view for `/firewall/states` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import { Badge } from '$lib/components/ui/badge';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import XIcon from '@lucide/svelte/icons/x';

  import { _ } from '$lib/i18n';
  type StateRow = {
    id: string;
    protocol: string;
    source: string;
    destination: string;
    state: string;
    age: string;
    expires: string;
    packets: string;
    bytes: string;
    interface: string;
    direction: string;
    source_port: string;
    destination_port: string;
    rule: string;
  };

  const refreshOptions = [
    { label: 'Off', value: 'off' },
    { label: '5 seconds', value: '5000' },
    { label: '10 seconds', value: '10000' },
    { label: '30 seconds', value: '30000' }
  ];

  const protocolOptions = [
    { label: 'All protocols', value: 'all' },
    { label: 'TCP', value: 'tcp' },
    { label: 'UDP', value: 'udp' },
    { label: 'ICMP', value: 'icmp' },
    { label: 'GRE', value: 'gre' },
    { label: 'ESP', value: 'esp' }
  ];

  let loading = $state(false);
  let flushing = $state(false);
  let killingId = $state('');

  let rows = $state<StateRow[]>([]);
  let refreshMode = $state('5000');
  let autoRefresh = $state(true);

  let protocolFilter = $state('all');
  let sourceSearch = $state('');
  let destinationSearch = $state('');
  let interfaceSearch = $state('');

  function toRow(raw: unknown): StateRow {
    const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const src = String(row.source ?? row.src ?? '-');
    const dst = String(row.destination ?? row.dst ?? '-');
    const sport = String(row.source_port ?? row.src_port ?? row.sport ?? '');
    const dport = String(row.destination_port ?? row.dst_port ?? row.dport ?? '');
    return {
      id: String(row.id ?? row.stateid ?? row.key ?? `${src}:${sport}->${dst}:${dport}`),
      protocol: String(row.protocol ?? row.proto ?? '-').toLowerCase(),
      source: src,
      destination: dst,
      state: String(row.state ?? row.state_name ?? row.status ?? '-'),
      age: String(row.age ?? row.age_seconds ?? '-'),
      expires: String(row.expires ?? row.expire ?? '-'),
      packets: String(row.packets ?? row.pkts ?? '-'),
      bytes: String(row.bytes ?? '-'),
      interface: String(row.interface ?? row.iface ?? '-'),
      direction: String(row.direction ?? '-'),
      source_port: sport,
      destination_port: dport,
      rule: String(row.rule ?? row.rule_id ?? '-')
    };
  }

  async function loadStates() {
    loading = true;
    try {
      const payload = await api.get<unknown>('/firewall/states');
      const list = Array.isArray(payload) ? payload : [];
      rows = list.map((item) => toRow(item));
    } catch (error) {
      rows = [];
      toasts.error(error instanceof Error ? error.message : 'Failed to load firewall states');
    } finally {
      loading = false;
    }
  }

  async function flushStates() {
    flushing = true;
    try {
      await api.post('/firewall/states/flush');
      toasts.success($_('firewall_states.toast_all_states_flushed'));
      await loadStates();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to flush states');
    } finally {
      flushing = false;
    }
  }

  async function killState(row: StateRow) {
    killingId = row.id;
    try {
      await api.post('/firewall/states/kill', {
        id: row.id,
        protocol: row.protocol,
        source: row.source,
        source_port: row.source_port,
        destination: row.destination,
        destination_port: row.destination_port,
        interface: row.interface
      });
      toasts.success($_('firewall_states.toast_state_killed'));
      await loadStates();
    } catch {
      try {
        await api.post('/firewall/states/delete', {
          id: row.id,
          source: row.source,
          destination: row.destination,
          protocol: row.protocol
        });
        toasts.success($_('firewall_states.toast_state_killed'));
        await loadStates();
      } catch (error) {
        toasts.error(error instanceof Error ? error.message : 'Failed to kill state');
      }
    } finally {
      killingId = '';
    }
  }

  const filteredRows = $derived.by(() => {
    const srcNeedle = sourceSearch.trim().toLowerCase();
    const dstNeedle = destinationSearch.trim().toLowerCase();
    const ifaceNeedle = interfaceSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (protocolFilter !== 'all' && row.protocol !== protocolFilter) return false;
      if (srcNeedle && !row.source.toLowerCase().includes(srcNeedle)) return false;
      if (dstNeedle && !row.destination.toLowerCase().includes(dstNeedle)) return false;
      if (ifaceNeedle && !row.interface.toLowerCase().includes(ifaceNeedle)) return false;
      return true;
    });
  });

  const totalBytes = $derived.by(() =>
    filteredRows.reduce((acc, row) => acc + (Number(row.bytes) || 0), 0)
  );

  onMount(() => {
    void loadStates();
  });

  $effect(() => {
    if (!autoRefresh || refreshMode === 'off') return;
    const period = Number(refreshMode);
    if (!Number.isFinite(period) || period < 1000) return;
    const timer = setInterval(() => {
      void loadStates();
    }, period);
    return () => clearInterval(timer);
  });
</script>

<div class="space-y-6 p-4 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('firewall_states.firewall_connection_states')}</CardTitle><CardDescription class="text-slate-400">Live state table with protocol/source/destination filtering and kill controls.</CardDescription></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_states.visible_states')}</p><p class="text-lg text-slate-100">{filteredRows.length}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_states.total_loaded')}</p><p class="text-lg text-slate-100">{rows.length}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_states.visible_bytes')}</p><p class="text-lg text-cyan-300">{totalBytes}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_states.auto_refresh')}</p><p class="text-lg text-slate-100">{autoRefresh && refreshMode !== 'off' ? `${Number(refreshMode) / 1000}s` : 'off'}</p></div>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div class="space-y-2"><FieldLabel label="Protocol" hint="Filter live state rows by transport protocol." /><Select.Root type="single" value={protocolFilter} onValueChange={(value) => value && (protocolFilter = value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{protocolOptions.find((option) => option.value === protocolFilter)?.label ?? 'All protocols'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each protocolOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-2"><FieldLabel label="Source Search" hint="Match source IP or host substring." /><Input class="border-slate-700 bg-slate-950" value={sourceSearch} oninput={(event) => (sourceSearch = (event.currentTarget as HTMLInputElement).value)} placeholder="192.0.2.10" /></div>
        <div class="space-y-2"><FieldLabel label="Destination Search" hint="Match destination IP or host substring." /><Input class="border-slate-700 bg-slate-950" value={destinationSearch} oninput={(event) => (destinationSearch = (event.currentTarget as HTMLInputElement).value)} placeholder="10.0.0.12" /></div>
        <div class="space-y-2"><FieldLabel label="Interface Search" hint="Filter by interface name text." /><Input class="border-slate-700 bg-slate-950" value={interfaceSearch} oninput={(event) => (interfaceSearch = (event.currentTarget as HTMLInputElement).value)} placeholder="lan" /></div>
        <div class="space-y-2"><FieldLabel label="Auto-refresh" hint="Choose refresh interval for live state updates." /><Select.Root type="single" value={refreshMode} onValueChange={(value) => value && (refreshMode = value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{refreshOptions.find((option) => option.value === refreshMode)?.label ?? 'Off'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each refreshOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-1"><Switch checked={autoRefresh} onCheckedChange={(checked) => (autoRefresh = checked)} /><span class="text-xs text-slate-300">{$_('firewall_states.enable_auto_refresh')}</span></div>
        <Button variant="outline" class="border-slate-700 text-slate-100" onclick={() => void loadStates()} disabled={loading}><RefreshCwIcon class="mr-2 h-4 w-4" />{loading ? 'Refreshing...' : 'Refresh now'}</Button>
        <Button variant="outline" class="border-amber-500/40 text-amber-300 hover:bg-amber-500/10" onclick={flushStates} disabled={flushing}>{flushing ? 'Flushing...' : 'Flush all states'}</Button>
        <Badge class="border-slate-600 bg-slate-800 text-slate-200">Filter count {filteredRows.length}</Badge>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('firewall_states.live_state_table')}</CardTitle></CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-400">{$_('firewall_states.loading_live_connection_states')}</p>
      {:else if filteredRows.length === 0}
        <p class="text-sm text-slate-400">{$_('firewall_states.no_states_match_current_filters')}</p>
      {:else}
        <div class="space-y-2">
          {#each filteredRows as row}
            <div class="grid gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300 md:grid-cols-10">
              <div><FieldLabel label="Protocol" hint="Connection transport protocol." /><p class="mt-1">{row.protocol.toUpperCase()}</p></div>
              <div><FieldLabel label="Source" hint="Source endpoint in state table." /><p class="mt-1 break-all">{row.source}{row.source_port ? `:${row.source_port}` : ''}</p></div>
              <div><FieldLabel label="Destination" hint="Destination endpoint in state table." /><p class="mt-1 break-all">{row.destination}{row.destination_port ? `:${row.destination_port}` : ''}</p></div>
              <div><FieldLabel label="State" hint="State machine value from packet filter." /><p class="mt-1">{row.state}</p></div>
              <div><FieldLabel label="Age" hint="Elapsed lifetime for this state entry." /><p class="mt-1">{row.age}</p></div>
              <div><FieldLabel label="Expires" hint="Remaining lifetime before expiry." /><p class="mt-1">{row.expires}</p></div>
              <div><FieldLabel label="Packets" hint="Observed packet count for this state." /><p class="mt-1">{row.packets}</p></div>
              <div><FieldLabel label="Bytes" hint="Observed byte count for this state." /><p class="mt-1">{row.bytes}</p></div>
              <div><FieldLabel label="Meta" hint="Interface, direction, and rule reference." /><p class="mt-1">{row.interface} / {row.direction} / #{row.rule}</p></div>
              <div class="flex items-end"><Button size="sm" variant="outline" class="w-full border-red-500/40 text-red-300 hover:bg-red-500/10" onclick={() => void killState(row)} disabled={killingId === row.id}><XIcon class="mr-2 h-3.5 w-3.5" />{killingId === row.id ? 'Killing...' : 'Kill state'}</Button></div>
            </div>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
