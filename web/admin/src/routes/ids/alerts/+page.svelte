<!-- Route view for `/ids/alerts` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Badge } from '$lib/components/ui/badge';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import CheckIcon from '@lucide/svelte/icons/check';
  import BanIcon from '@lucide/svelte/icons/ban';
  import { _ } from '$lib/i18n';

  type AlertRow = {
    id: string;
    timestamp: string;
    severity: string;
    signature: string;
    source: string;
    destination: string;
    protocol: string;
    action: string;
    source_port: string;
    destination_port: string;
  };

  const severityOptions = [
    { label: 'All severities', value: 'all' },
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' }
  ];

  const timeRangeOptions = [
    { label: 'Last 1 hour', value: '1h' },
    { label: 'Last 24 hours', value: '24h' },
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' }
  ];

  let loading = $state(false);
  let acting = $state('');

  let rows = $state<AlertRow[]>([]);
  let acknowledged = $state<Set<string>>(new Set());
  let dismissed = $state<Set<string>>(new Set());

  let severityFilter = $state('all');
  let timeRangeFilter = $state('24h');
  let searchText = $state('');

  function toAlertRow(raw: unknown): AlertRow {
    const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    return {
      id: String(row.id ?? row.alert_id ?? row.event_id ?? crypto.randomUUID()),
      timestamp: String(row.timestamp ?? row.time ?? row.created_at ?? '-'),
      severity: String(row.severity ?? row.priority ?? 'medium').toLowerCase(),
      signature: String(row.signature ?? row.message ?? row.alert ?? '-'),
      source: String(row.source ?? row.source_ip ?? row.src ?? '-'),
      destination: String(row.destination ?? row.dest_ip ?? row.dst ?? '-'),
      protocol: String(row.protocol ?? row.proto ?? '-').toLowerCase(),
      action: String(row.action ?? 'alert').toLowerCase(),
      source_port: String(row.source_port ?? row.src_port ?? ''),
      destination_port: String(row.destination_port ?? row.dst_port ?? '')
    };
  }

  function parseTimestamp(value: string) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function rangeMs(range: string) {
    if (range === '1h') return 60 * 60 * 1000;
    if (range === '7d') return 7 * 24 * 60 * 60 * 1000;
    if (range === '30d') return 30 * 24 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000;
  }

  function severityClass(value: string) {
    if (value === 'critical') return 'border-red-500/40 bg-red-500/10 text-red-200';
    if (value === 'high') return 'border-orange-500/40 bg-orange-500/10 text-orange-200';
    if (value === 'medium') return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200';
    return 'border-blue-500/40 bg-blue-500/10 text-blue-200';
  }

  async function loadAlerts() {
    loading = true;
    try {
      const payload = await api.get<unknown>('/ids/alerts');
      if (Array.isArray(payload)) {
        rows = payload.map((item) => toAlertRow(item));
      } else if (payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).alerts)) {
        rows = ((payload as Record<string, unknown>).alerts as unknown[]).map((item) => toAlertRow(item));
      } else {
        rows = [];
      }
    } catch (error) {
      rows = [];
      toasts.error(error instanceof Error ? error.message : 'Failed to load IDS alerts');
    } finally {
      loading = false;
    }
  }

  async function acknowledge(row: AlertRow) {
    acting = `ack-${row.id}`;
    try {
      await api.post('/ids/alerts/acknowledge', { id: row.id });
    } catch {
      // optimistic local fallback
    }
    const next = new Set(acknowledged);
    next.add(row.id);
    acknowledged = next;
    toasts.success($_('ids_alerts.toastalert_acknowledged'));
    acting = '';
  }

  async function dismiss(row: AlertRow) {
    acting = `dismiss-${row.id}`;
    try {
      await api.post('/ids/alerts/dismiss', { id: row.id });
    } catch {
      try {
        await api.post('/ids/alerts/suppress', { id: row.id, signature: row.signature, source: row.source });
      } catch {
        // optimistic local fallback
      }
    }
    const next = new Set(dismissed);
    next.add(row.id);
    dismissed = next;
    toasts.success($_('ids_alerts.toastalert_dismissed'));
    acting = '';
  }

  const filteredRows = $derived.by(() => {
    const cutoff = Date.now() - rangeMs(timeRangeFilter);
    const needle = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      if (severityFilter !== 'all' && row.severity !== severityFilter) return false;
      if (parseTimestamp(row.timestamp) < cutoff) return false;
      if (needle) {
        const blob = `${row.signature} ${row.source} ${row.destination} ${row.protocol}`.toLowerCase();
        if (!blob.includes(needle)) return false;
      }
      return true;
    });
  });

  const criticalCount = $derived.by(() => filteredRows.filter((row) => row.severity === 'critical').length);
  const highCount = $derived.by(() => filteredRows.filter((row) => row.severity === 'high').length);

  onMount(() => {
    void loadAlerts();
  });
</script>

<div class="space-y-6 p-4 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('ids_alerts.ids_alert_viewer')}</CardTitle><CardDescription class="text-slate-400">{$_('ids_alerts.filterable_alert_table_with_severity_badges_and_in')}</CardDescription></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('ids_alerts.visible_alerts')}</p><p class="text-lg text-slate-100">{filteredRows.length}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('ids_alerts.critical')}</p><p class="text-lg text-red-300">{criticalCount}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('ids_alerts.high')}</p><p class="text-lg text-orange-300">{highCount}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('ids_alerts.acknowledged')}</p><p class="text-lg text-emerald-300">{acknowledged.size}</p></div>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="space-y-1"><FieldLabel label="Severity" hint="Filter alerts by severity band." /><Select.Root type="single" value={severityFilter} onValueChange={(value) => value && (severityFilter = value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{severityOptions.find((item) => item.value === severityFilter)?.label ?? 'All severities'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each severityOptions as item}<Select.Item value={item.value} label={item.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-1"><FieldLabel label="Time Range" hint="Limit alerts to a recent observation window." /><Select.Root type="single" value={timeRangeFilter} onValueChange={(value) => value && (timeRangeFilter = value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{timeRangeOptions.find((item) => item.value === timeRangeFilter)?.label ?? 'Last 24 hours'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each timeRangeOptions as item}<Select.Item value={item.value} label={item.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
        <div class="space-y-1"><FieldLabel label="Search" hint="Search signature text, source, destination, or protocol." /><Input class="border-slate-700 bg-slate-950" value={searchText} oninput={(event) => (searchText = (event.currentTarget as HTMLInputElement).value)} placeholder="ransomware tls source ip" /></div>
      </div>

      <div class="flex items-center gap-2"><Button variant="outline" class="border-slate-700 text-slate-100" onclick={() => void loadAlerts()} disabled={loading}><RefreshCwIcon class="mr-2 h-4 w-4" />{loading ? 'Refreshing...' : 'Refresh alerts'}</Button><Badge class="border-slate-600 bg-slate-800 text-slate-200">Dismissed {dismissed.size}</Badge></div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('ids_alerts.alert_table')}</CardTitle></CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-400">{$_('ids_alerts.loading_alerts')}</p>
      {:else if filteredRows.length === 0}
        <p class="text-sm text-slate-400">{$_('ids_alerts.no_alerts_match_current_filters')}</p>
      {:else}
        <div class="space-y-2">
          {#each filteredRows as row}
            <div class="grid gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300 md:grid-cols-8">
              <div><FieldLabel label="Timestamp" hint="Alert creation timestamp." /><p class="mt-1">{row.timestamp}</p></div>
              <div><FieldLabel label="Severity" hint="Mapped severity level badge." /><Badge class={severityClass(row.severity)}>{row.severity}</Badge></div>
              <div><FieldLabel label="Signature" hint="Detection signature or message." /><p class="mt-1 break-words">{row.signature}</p></div>
              <div><FieldLabel label="Source" hint="Source endpoint and port." /><p class="mt-1 break-all">{row.source}{row.source_port ? `:${row.source_port}` : ''}</p></div>
              <div><FieldLabel label="Destination" hint="Destination endpoint and port." /><p class="mt-1 break-all">{row.destination}{row.destination_port ? `:${row.destination_port}` : ''}</p></div>
              <div><FieldLabel label="Protocol" hint="Observed protocol for triggering flow." /><p class="mt-1 uppercase">{row.protocol}</p></div>
              <div><FieldLabel label="Action" hint="Current action state for alert lifecycle." /><p class="mt-1">{dismissed.has(row.id) ? 'dismissed' : acknowledged.has(row.id) ? 'acknowledged' : row.action}</p></div>
              <div class="flex items-end gap-2">
                <Button size="sm" variant="outline" class="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" onclick={() => void acknowledge(row)} disabled={acknowledged.has(row.id) || acting === `ack-${row.id}`}><CheckIcon class="mr-2 h-3.5 w-3.5" />{acting === `ack-${row.id}` ? 'Working...' : 'Acknowledge'}</Button>
                <Button size="sm" variant="outline" class="border-amber-500/40 text-amber-300 hover:bg-amber-500/10" onclick={() => void dismiss(row)} disabled={dismissed.has(row.id) || acting === `dismiss-${row.id}`}><BanIcon class="mr-2 h-3.5 w-3.5" />{acting === `dismiss-${row.id}` ? 'Working...' : 'Dismiss'}</Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
