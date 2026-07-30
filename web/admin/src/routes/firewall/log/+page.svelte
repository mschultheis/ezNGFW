<!-- Route view for `/firewall/log` in the ezNGFW admin GUI. -->

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
  import DownloadIcon from '@lucide/svelte/icons/download';

  import { _ } from '$lib/i18n';
  type LogRow = {
    timestamp: string;
    action: string;
    interface: string;
    protocol: string;
    source: string;
    destination: string;
    source_port: string;
    destination_port: string;
    rule: string;
    severity: string;
  };

  const severityOptions = [
    { label: 'All severities', value: 'all' },
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
    { label: 'Info', value: 'info' }
  ];

  const actionOptions = [
    { label: 'All actions', value: 'all' },
    { label: 'Pass', value: 'pass' },
    { label: 'Block', value: 'block' },
    { label: 'Reject', value: 'reject' }
  ];

  const timeRangeOptions = [
    { label: 'Last 15 minutes', value: '15m' },
    { label: 'Last 1 hour', value: '1h' },
    { label: 'Last 6 hours', value: '6h' },
    { label: 'Last 24 hours', value: '24h' }
  ];

  const refreshOptions = [
    { label: 'Off', value: 'off' },
    { label: '5 seconds', value: '5000' },
    { label: '10 seconds', value: '10000' },
    { label: '30 seconds', value: '30000' }
  ];

  let loading = $state(false);
  let exporting = $state(false);
  let autoRefresh = $state(true);
  let refreshRate = $state('5000');

  let rows = $state<LogRow[]>([]);
  let interfaceOptions = $state<{ label: string; value: string }[]>([{ label: 'All interfaces', value: 'all' }]);

  let severityFilter = $state('all');
  let actionFilter = $state('all');
  let interfaceFilter = $state('all');
  let timeRangeFilter = $state('1h');
  let sourceFilter = $state('');
  let destinationFilter = $state('');

  function toLogRow(raw: unknown): LogRow {
    const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    return {
      timestamp: String(row.timestamp ?? row.time ?? '-'),
      action: String(row.action ?? '-').toLowerCase(),
      interface: String(row.interface ?? row.iface ?? '-'),
      protocol: String(row.protocol ?? row.proto ?? '-').toLowerCase(),
      source: String(row.source ?? row.src ?? '-'),
      destination: String(row.destination ?? row.dst ?? '-'),
      source_port: String(row.source_port ?? row.src_port ?? row.sport ?? ''),
      destination_port: String(row.destination_port ?? row.dst_port ?? row.dport ?? ''),
      rule: String(row.rule ?? row.rule_id ?? '-'),
      severity: String(row.severity ?? row.level ?? 'info').toLowerCase()
    };
  }

  function parseTimestamp(value: string) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function rangeMs(range: string) {
    if (range === '15m') return 15 * 60 * 1000;
    if (range === '1h') return 60 * 60 * 1000;
    if (range === '6h') return 6 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000;
  }

  async function loadInterfaces() {
    try {
      const payload = await api.get<unknown[]>('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      const parsed = list
        .map((item) => {
          const row = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
          const value = String(row.name ?? row.id ?? item ?? '').trim();
          return { label: value, value };
        })
        .filter((item) => item.value.length > 0);
      interfaceOptions = [{ label: 'All interfaces', value: 'all' }, ...parsed];
    } catch {
      interfaceOptions = [{ label: 'All interfaces', value: 'all' }];
    }
  }

  async function loadLogs() {
    loading = true;
    try {
      const payload = await api.get<unknown>('/firewall/log');
      const list = Array.isArray(payload) ? payload : [];
      rows = list.map((item) => toLogRow(item));
    } catch (error) {
      rows = [];
      toasts.error(error instanceof Error ? error.message : 'Failed to load firewall logs');
    } finally {
      loading = false;
    }
  }

  function rowClass(action: string) {
    if (action === 'pass') return 'border-emerald-500/30 bg-emerald-500/10';
    if (action === 'block') return 'border-red-500/40 bg-red-500/10';
    if (action === 'reject') return 'border-amber-500/40 bg-amber-500/10';
    return 'border-slate-800 bg-slate-950/40';
  }

  async function exportCsv() {
    exporting = true;
    try {
      const header = ['timestamp', 'action', 'interface', 'protocol', 'source', 'destination', 'rule'];
      const lines = [header.join(',')];
      for (const row of filteredRows) {
        const values = [row.timestamp, row.action, row.interface, row.protocol, row.source, row.destination, row.rule]
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(',');
        lines.push(values);
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `firewall-log-${new Date().toISOString().replaceAll(':', '-')}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toasts.success($_('firewall_log.toast_csv_export_started'));
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to export CSV');
    } finally {
      exporting = false;
    }
  }

  const filteredRows = $derived.by(() => {
    const sourceNeedle = sourceFilter.trim().toLowerCase();
    const destinationNeedle = destinationFilter.trim().toLowerCase();
    const cutoff = Date.now() - rangeMs(timeRangeFilter);
    return rows.filter((row) => {
      if (severityFilter !== 'all' && row.severity !== severityFilter) return false;
      if (actionFilter !== 'all' && row.action !== actionFilter) return false;
      if (interfaceFilter !== 'all' && row.interface.toLowerCase() !== interfaceFilter.toLowerCase()) return false;
      if (sourceNeedle && !row.source.toLowerCase().includes(sourceNeedle)) return false;
      if (destinationNeedle && !row.destination.toLowerCase().includes(destinationNeedle)) return false;
      if (parseTimestamp(row.timestamp) < cutoff) return false;
      return true;
    });
  });

  const passCount = $derived.by(() => filteredRows.filter((row) => row.action === 'pass').length);
  const blockCount = $derived.by(() => filteredRows.filter((row) => row.action === 'block').length);

  onMount(() => {
    void loadInterfaces();
    void loadLogs();
  });

  $effect(() => {
    if (!autoRefresh || refreshRate === 'off') return;
    const period = Number(refreshRate);
    if (!Number.isFinite(period) || period < 1000) return;
    const timer = setInterval(() => {
      void loadLogs();
    }, period);
    return () => clearInterval(timer);
  });
</script>

<div class="space-y-6 p-4 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('firewall_log.realtime_firewall_log_viewer')}</CardTitle><CardDescription class="text-slate-400">Streaming-style policy hit table with filter controls and CSV export.</CardDescription></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_log.visible_entries')}</p><p class="text-lg text-slate-100">{filteredRows.length}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_log.pass')}</p><p class="text-lg text-emerald-300">{passCount}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_log.block')}</p><p class="text-lg text-red-300">{blockCount}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('common.refresh')}</p><p class="text-lg text-slate-100">{autoRefresh && refreshRate !== 'off' ? `${Number(refreshRate) / 1000}s` : 'off'}</p></div>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div class="space-y-1"><FieldLabel label="Severity" hint="Filter by log severity classification." /><Select.Root type="single" value={severityFilter} onValueChange={(value) => value && (severityFilter = value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{severityOptions.find((item) => item.value === severityFilter)?.label ?? 'All severities'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each severityOptions as item}<Select.Item value={item.value} label={item.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-1"><FieldLabel label="Action" hint="Filter by pass, block, or reject outcomes." /><Select.Root type="single" value={actionFilter} onValueChange={(value) => value && (actionFilter = value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{actionOptions.find((item) => item.value === actionFilter)?.label ?? 'All actions'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each actionOptions as item}<Select.Item value={item.value} label={item.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-1"><FieldLabel label="Interface" hint="Filter by network interface name from API." /><Select.Root type="single" value={interfaceFilter} onValueChange={(value) => value && (interfaceFilter = value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{interfaceOptions.find((item) => item.value === interfaceFilter)?.label ?? 'All interfaces'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each interfaceOptions as item}<Select.Item value={item.value} label={item.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-1"><FieldLabel label="Time Range" hint="Only show entries newer than this range." /><Select.Root type="single" value={timeRangeFilter} onValueChange={(value) => value && (timeRangeFilter = value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{timeRangeOptions.find((item) => item.value === timeRangeFilter)?.label ?? 'Last 1 hour'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each timeRangeOptions as item}<Select.Item value={item.value} label={item.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-1"><FieldLabel label="Source" hint="Substring match on source address." /><Input class="border-slate-700 bg-slate-950" value={sourceFilter} oninput={(event) => (sourceFilter = (event.currentTarget as HTMLInputElement).value)} placeholder="198.51.100.50" /></div>
        <div class="space-y-1"><FieldLabel label="Destination" hint="Substring match on destination address." /><Input class="border-slate-700 bg-slate-950" value={destinationFilter} oninput={(event) => (destinationFilter = (event.currentTarget as HTMLInputElement).value)} placeholder="10.0.0.20" /></div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-1"><Switch checked={autoRefresh} onCheckedChange={(checked) => (autoRefresh = checked)} /><span class="text-xs text-slate-300">{$_('firewall_log.enable_auto_refresh')}</span></div>
        <div class="w-52"><FieldLabel label="Refresh Interval" hint="Interval used when auto-refresh is enabled." /><Select.Root type="single" value={refreshRate} onValueChange={(value) => value && (refreshRate = value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{refreshOptions.find((item) => item.value === refreshRate)?.label ?? 'Off'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each refreshOptions as item}<Select.Item value={item.value} label={item.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <Button variant="outline" class="border-slate-700 text-slate-100" onclick={() => void loadLogs()} disabled={loading}><RefreshCwIcon class="mr-2 h-4 w-4" />{loading ? 'Refreshing...' : 'Refresh now'}</Button>
        <Button variant="outline" class="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10" onclick={exportCsv} disabled={exporting}><DownloadIcon class="mr-2 h-4 w-4" />{exporting ? 'Exporting...' : 'Export CSV'}</Button>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('firewall_log.firewall_log_entries')}</CardTitle></CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-400">{$_('firewall_log.loading_firewall_logs')}</p>
      {:else if filteredRows.length === 0}
        <p class="text-sm text-slate-400">{$_('firewall_log.no_entries_match_current_filters')}</p>
      {:else}
        <div class="space-y-2">
          {#each filteredRows as row}
            <div class={`grid gap-2 rounded-md border p-3 text-xs text-slate-200 md:grid-cols-7 ${rowClass(row.action)}`}>
              <div><FieldLabel label="Timestamp" hint="Event timestamp from log feed." /><p class="mt-1">{row.timestamp}</p></div>
              <div><FieldLabel label="Action" hint="Firewall action result for this packet." /><p class="mt-1 uppercase">{row.action}</p></div>
              <div><FieldLabel label="Interface" hint="Interface where this event was observed." /><p class="mt-1">{row.interface}</p></div>
              <div><FieldLabel label="Protocol" hint="Protocol parsed from packet metadata." /><p class="mt-1 uppercase">{row.protocol}</p></div>
              <div><FieldLabel label="Source" hint="Source endpoint and optional port." /><p class="mt-1 break-all">{row.source}{row.source_port ? `:${row.source_port}` : ''}</p></div>
              <div><FieldLabel label="Destination" hint="Destination endpoint and optional port." /><p class="mt-1 break-all">{row.destination}{row.destination_port ? `:${row.destination_port}` : ''}</p></div>
              <div><FieldLabel label="Rule" hint="Rule id associated with this decision." /><p class="mt-1">{row.rule}</p></div>
            </div>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
