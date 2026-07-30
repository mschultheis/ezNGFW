<!-- Route view for `/` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import Activity from '@lucide/svelte/icons/activity';
  import Zap from '@lucide/svelte/icons/zap';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import Clock from '@lucide/svelte/icons/clock';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { refreshTrigger } from '$lib/stores/refresh';
  import { formatNumber, formatUptime } from '$lib/utils/format';
  import { asList, asObject, asString } from '$lib/utils/api-data';
  import { changeQueue } from '$lib/stores/staged';
  import { Badge } from '$lib/components/ui/badge';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';

  import { _ } from '$lib/i18n';
  type StatusResponse = {
    interfacesUp?: number;
    activeFlows?: number;
    blockedPackets?: number;
    uptime?: number;
    vpnTunnels?: number;
    idsAlerts?: number;
    dnsQueries?: number;
    haData?: string;
    haStatus?: string;
  };


  type IdsStatsResponse = {
    enabled?: boolean | string | number;
    mode?: string;
    rules_loaded?: number | string;
  };

  type VpnStatusResponse = {
    wireguard_enabled?: boolean | string | number;
    ipsec_enabled?: boolean | string | number;
    tunnel_count?: number | string;
    remote_access_cidr?: string;
  };

  type HaStatusResponse = {
    role?: string;
    peer?: {
      address?: string;
      sync_state?: string;
    };
  };

  function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }


  /** Format an epoch-seconds string to a human-readable local timestamp. */
  function formatEpochTime(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '-';
    const d = new Date(n * 1000);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function toBool(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['1', 'true', 'enabled', 'on', 'up', 'active', 'yes'].includes(normalized);
    }
    return false;
  }

  let loading = $state(true);
  let stats = $state<StatusResponse>({});
  let traffic = $state<Array<{ timestamp: string; inbound: number; outbound: number }>>([]);

  let idsAlerts = $state<Record<string, unknown>[]>([]);

  let idsStats = $state<IdsStatsResponse>({});
  let vpnStatus = $state<VpnStatusResponse>({});
  let haStatus = $state<HaStatusResponse>({});
  let haData = $state('unknown');

  let natStats = $state<Record<string, unknown>>({});
  let tlsStats = $state<Record<string, unknown>>({});
  let zoneStats = $state<Record<string, unknown>>({});
  let dpiStats = $state<Record<string, unknown>>({});

  let trafficCanvas = $state<HTMLCanvasElement | null>(null);
  let protocolCanvas = $state<HTMLCanvasElement | null>(null);
  let trafficChart: Chart | null = null;
  let protocolChart: Chart | null = null;
  let fallbackWarned = false;

  const statCards = $derived([
    { label: 'Interfaces Up', value: formatNumber(stats.interfacesUp ?? 0), icon: Activity, tone: 'text-cyan-400' },
    { label: 'Active Flows', value: formatNumber(stats.activeFlows ?? 0), icon: Zap, tone: 'text-emerald-400' },
    { label: 'Blocked Packets', value: formatNumber(stats.blockedPackets ?? 0), icon: ShieldAlert, tone: 'text-red-400' },
    { label: 'Uptime', value: formatUptime(stats.uptime ?? 0), icon: Clock, tone: 'text-amber-400' }
  ]);

  const idsEnabled = $derived(toBool(idsStats.enabled));
  const idsMode = $derived(asString(idsStats.mode || 'unknown'));
  const idsRulesLoaded = $derived(toNumber(idsStats.rules_loaded));

  const wireguardEnabled = $derived(toBool(vpnStatus.wireguard_enabled));
  const ipsecEnabled = $derived(toBool(vpnStatus.ipsec_enabled));
  const vpnTunnelCount = $derived(toNumber(vpnStatus.tunnel_count));
  const vpnRemoteAccessCidr = $derived(asString(vpnStatus.remote_access_cidr || 'n/a'));

  const haRole = $derived(asString(haStatus.role || haData || 'unknown').toLowerCase());
  const haPeerAddress = $derived(asString(haStatus.peer?.address || 'unavailable'));
  const haSyncState = $derived(asString(haStatus.peer?.sync_state || 'unknown'));

  const haRoleBadgeClass = $derived(
    haRole === 'primary' || haRole === 'standalone'
      ? 'border-emerald-700 bg-emerald-900/35 text-emerald-300'
      : haRole === 'secondary'
        ? 'border-amber-700 bg-amber-900/35 text-amber-300'
        : haRole === 'degraded'
          ? 'border-red-700 bg-red-900/35 text-red-300'
          : 'border-slate-700 bg-slate-800 text-slate-300'
  );

  const natSnatCount = $derived(toNumber(natStats.snat ?? natStats.snatRules ?? natStats.snat_rules));
  const natDnatCount = $derived(toNumber(natStats.dnat ?? natStats.dnatRules ?? natStats.dnat_rules));
  const natMasqCount = $derived(toNumber(natStats.masq ?? natStats.masquerade ?? natStats.masqRules));
  const natTotalRules = $derived(
    toNumber(natStats.total_rules ?? natStats.totalRules ?? natSnatCount + natDnatCount + natMasqCount)
  );

  const natBreakdownTotal = $derived(Math.max(natSnatCount + natDnatCount + natMasqCount, 1));
  const natSnatPct = $derived((natSnatCount / natBreakdownTotal) * 100);
  const natDnatPct = $derived((natDnatCount / natBreakdownTotal) * 100);
  const natMasqPct = $derived((natMasqCount / natBreakdownTotal) * 100);

  const tlsEnabled = $derived(toBool(tlsStats.enabled ?? tlsStats.inspection_enabled));
  const tlsBindAddress = $derived(asString((tlsStats.management_bind ?? tlsStats.bind_address ?? tlsStats.listen) || '0.0.0.0:9443'));
  const tlsSessionTimeout = $derived(asString(tlsStats.session_timeout ?? tlsStats.sessionTimeout ?? '300s'));

  const zoneNames = $derived(
    Array.isArray(zoneStats.zone_names)
      ? (zoneStats.zone_names as unknown[]).map((item) => asString(item)).filter(Boolean)
      : Array.isArray(zoneStats.names)
        ? (zoneStats.names as unknown[]).map((item) => asString(item)).filter(Boolean)
        : Array.isArray(zoneStats.zones)
          ? (zoneStats.zones as unknown[]).map((item) => asString(item)).filter(Boolean)
          : []
  );
  const zoneCount = $derived(toNumber(zoneStats.count ?? zoneStats.zone_count ?? zoneNames.length));
  const zoneChain = $derived(
    Array.isArray(zoneStats.policy_order)
      ? (zoneStats.policy_order as unknown[]).map((item) => asString(item)).join(' > ')
      : asString(zoneStats.policy_chain ?? 'dnat > firewall > snat')
  );

  const dpiProtocols = $derived(
    Array.isArray(dpiStats.protocols)
      ? (dpiStats.protocols as Record<string, unknown>[])
      : asList(dpiStats)
  );

  const dpiEnabled = $derived(
    toBool(dpiStats.enabled ?? dpiStats.dpi_enabled ?? (Array.isArray(dpiStats.protocols) && dpiProtocols.length > 0))
  );

  async function fetchData() {
    try {
      // Use allSettled so one failing endpoint does not break the dashboard.
      // /api/metrics is Prometheus text — traffic data comes from /api/shaper/queues instead.
      const results = await Promise.allSettled([
        api.get<StatusResponse>('/status'),         // 0
        api.get('/ids/alerts?limit=5'),              // 1
        api.get<IdsStatsResponse>('/ids/stats'),     // 2
        api.get<VpnStatusResponse>('/vpn'),           // 3
        api.get<HaStatusResponse>('/ha/status'),      // 4
        api.get('/nat/stats'),                        // 5
        api.get('/tls/stats'),                        // 6
        api.get('/zones/stats'),                      // 7
        api.get('/dpi/stats')                         // 8
      ]);

      /** Extract fulfilled value or return fallback. */
      function val<T>(idx: number, fallback: T): T {
        const r = results[idx];
        return r && r.status === 'fulfilled' ? (r.value as T) : fallback;
      }

      const status = val<StatusResponse>(0, {});
      const idsPayload = val(1, []);
      const idsStatsPayload = val<IdsStatsResponse>(2, {});
      const vpnPayload = val<VpnStatusResponse>(3, {});
      const haPayload = val<HaStatusResponse>(4, {});
      const natPayload = val(5, {});
      const tlsPayloadRaw = val(6, {});
      const zonesPayload = val(7, {});
      const dpiPayload = val(8, {});

      const raw = status as Record<string, unknown>;
      stats = {
        interfacesUp: toNumber(raw.interfaces_up ?? raw.interfacesUp),
        activeFlows: toNumber(raw.active_flows ?? raw.activeFlows),
        blockedPackets: toNumber(raw.blocked_packets ?? raw.blockedPackets),
        uptime: toNumber(raw.uptime_seconds ?? raw.uptime),
        vpnTunnels: toNumber(raw.vpnTunnels ?? raw.vpn_tunnels),
        idsAlerts: toNumber(raw.idsAlerts ?? raw.ids_alerts),
        dnsQueries: toNumber(raw.dnsQueries ?? raw.dns_queries),
        haData: String(raw.haData ?? raw.ha_data ?? ''),
        haStatus: String(raw.haStatus ?? raw.ha_status ?? ''),
      };
      haData = status.haData ?? status.haStatus ?? 'unknown';

      idsAlerts = asList(idsPayload).slice(0, 5);

      idsStats = asObject(idsStatsPayload) as IdsStatsResponse;
      vpnStatus = asObject(vpnPayload) as VpnStatusResponse;
      haStatus = asObject(haPayload) as HaStatusResponse;

      natStats = asObject(natPayload);
      tlsStats = asObject(tlsPayloadRaw);
      zoneStats = asObject(zonesPayload);

      const parsedDpi = asObject(dpiPayload);
      dpiStats = Array.isArray(parsedDpi.protocols)
        ? parsedDpi
        : {
            enabled: parsedDpi.enabled ?? parsedDpi.dpi_enabled,
            protocols: asList(dpiPayload)
          };

      // Placeholder traffic data until a dedicated JSON traffic endpoint exists
      traffic = Array.from({ length: 12 }, (_, i) => ({
        timestamp: `${i * 5}m`,
        inbound: 80 + Math.round(Math.random() * 120),
        outbound: 45 + Math.round(Math.random() * 85)
      }));
    } catch {
      traffic = Array.from({ length: 12 }, (_, i) => ({
        timestamp: `${i * 5}m`,
        inbound: 90 + Math.round(Math.random() * 100),
        outbound: 50 + Math.round(Math.random() * 70)
      }));
      if (!fallbackWarned) {
        fallbackWarned = true;
        toasts.warning($_('dashboard.toast_using_fallback_dashboard_metrics'));
      }
    } finally {
      loading = false;
    }
  }

  function renderTrafficChart() {
    if (!browser || !trafficCanvas || traffic.length === 0) return;
    trafficChart?.destroy();
    trafficChart = new Chart(trafficCanvas, {
      type: 'line',
      data: {
        labels: traffic.map((point) => point.timestamp),
        datasets: [
          {
            label: 'Inbound Mbps',
            data: traffic.map((point) => point.inbound),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.18)',
            tension: 0.32,
            fill: true
          },
          {
            label: 'Outbound Mbps',
            data: traffic.map((point) => point.outbound),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.12)',
            tension: 0.32,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#d4d4d8' } }
        },
        scales: {
          x: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(63,63,70,0.45)' } },
          y: { ticks: { color: '#a1a1aa' }, grid: { color: 'rgba(63,63,70,0.45)' } }
        }
      }
    });
  }

  function renderProtocolChart() {
    if (!browser || !protocolCanvas || dpiProtocols.length === 0) return;
    protocolChart?.destroy();

    protocolChart = new Chart(protocolCanvas, {
      type: 'doughnut',
      data: {
        labels: dpiProtocols.map((item) => String(item.protocol ?? item.name ?? 'unknown')),
        datasets: [
          {
            data: dpiProtocols.map((item) => Number(item.value ?? item.count ?? 0)),
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#14b8a6']
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#d4d4d8' }
          }
        }
      }
    });
  }

  onMount(() => {
    void fetchData();
  });

  $effect(() => {
    renderTrafficChart();
    renderProtocolChart();
    return () => {
      trafficChart?.destroy();
      protocolChart?.destroy();
    };
  });

  // Re-fetch when header toolbar refresh button is clicked or auto-refresh fires
  $effect(() => {
    if ($refreshTrigger > 0) {
      void fetchData();
    }
  });

</script>

<div class="space-y-6">
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {#if loading}
      {#each Array(4) as _}
        <Skeleton class="h-28 rounded-lg bg-slate-900" />
      {/each}
    {:else}
      {#each statCards as card}
        <Card class="border-slate-800 bg-slate-900">
          <CardHeader class="pb-2">
            <CardTitle class="flex items-center justify-between text-sm font-medium text-slate-400">
              {card.label}
              <card.icon class={`size-4 ${card.tone}`} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-semibold tracking-tight text-slate-50">{card.value}</p>
          </CardContent>
        </Card>
      {/each}
    {/if}
  </div>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('dashboard.traffic_overview')}</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="h-80">
        <canvas bind:this={trafficCanvas}></canvas>
      </div>
    </CardContent>
  </Card>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Card class="border-slate-800 bg-slate-900">
      <CardHeader class="pb-3">
        <CardTitle class="text-slate-100">{$_('dashboard.ids_ips_status')}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3 text-sm">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-300">
          <span class="text-slate-400">{$_('dashboard.state')}</span>
          <span class={`inline-flex items-center gap-2 ${idsEnabled ? 'text-emerald-300' : 'text-red-300'}`}>
            <span class="inline-block size-2 rounded-full {idsEnabled ? 'bg-emerald-400' : 'bg-red-400'}"></span>
            {idsEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div class="flex items-center justify-between text-slate-300">
          <span class="text-slate-400">{$_('dashboard.mode')}</span>
          <span class="font-mono text-cyan-300">{idsMode}</span>
        </div>
        <div class="flex items-center justify-between text-slate-300">
          <span class="text-slate-400">{$_('dashboard.rules_loaded')}</span>
          <span class="font-mono text-cyan-300">{formatNumber(idsRulesLoaded)}</span>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900">
      <CardHeader class="pb-3">
        <CardTitle class="text-slate-100">{$_('dashboard.vpn_status')}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3 text-sm">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-300">
          <span class="text-slate-400">{$_('dashboard.wireguard')}</span>
          <span class={`inline-flex items-center gap-2 ${wireguardEnabled ? 'text-emerald-300' : 'text-red-300'}`}>
            <span class="inline-block size-2 rounded-full {wireguardEnabled ? 'bg-emerald-400' : 'bg-red-400'}"></span>
            {wireguardEnabled ? 'enabled' : 'disabled'}
          </span>
        </div>
        <div class="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-300">
          <span class="text-slate-400">{$_('dashboard.ipsec')}</span>
          <span class={`inline-flex items-center gap-2 ${ipsecEnabled ? 'text-emerald-300' : 'text-red-300'}`}>
            <span class="inline-block size-2 rounded-full {ipsecEnabled ? 'bg-emerald-400' : 'bg-red-400'}"></span>
            {ipsecEnabled ? 'enabled' : 'disabled'}
          </span>
        </div>
        <div class="flex items-center justify-between text-slate-300">
          <span class="text-slate-400">{$_('dashboard.tunnels')}</span>
          <span class="font-mono text-cyan-300">{formatNumber(vpnTunnelCount)}</span>
        </div>
        <div class="space-y-1 text-slate-300">
          <p class="text-slate-400">{$_('dashboard.remote_cidr')}</p>
          <p class="font-mono text-cyan-300">{vpnRemoteAccessCidr}</p>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900">
      <CardHeader class="pb-3">
        <CardTitle class="text-slate-100">{$_('dashboard.ha_status')}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3 text-sm">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-300">
          <span class="text-slate-400">{$_('dashboard.role')}</span>
          <Badge class={haRoleBadgeClass}>{haRole}</Badge>
        </div>
        <div class="space-y-1 text-slate-300">
          <p class="text-slate-400">{$_('dashboard.peer_address')}</p>
          <p class="font-mono text-cyan-300">{haPeerAddress}</p>
        </div>
        <div class="space-y-1 text-slate-300">
          <p class="text-slate-400">{$_('dashboard.sync_state')}</p>
          <p class="font-mono text-cyan-300">{haSyncState}</p>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900">
      <CardHeader class="pb-3">
        <CardTitle class="text-slate-100">{$_('dashboard.nat_statistics')}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3 text-sm text-slate-300">
        <div class="flex items-center justify-between">
          <span class="text-slate-400">{$_('dashboard.total_rules')}</span>
          <span class="font-mono text-cyan-300">{formatNumber(natTotalRules)}</span>
        </div>
        <div class="space-y-2">
          <div class="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <span class="bg-cyan-500" style={`width: ${natSnatPct}%`}></span>
            <span class="bg-emerald-500" style={`width: ${natDnatPct}%`}></span>
            <span class="bg-amber-500" style={`width: ${natMasqPct}%`}></span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <p class="text-cyan-300">SNAT: <span class="font-mono">{formatNumber(natSnatCount)}</span></p>
            <p class="text-emerald-300">DNAT: <span class="font-mono">{formatNumber(natDnatCount)}</span></p>
            <p class="text-amber-300">MASQ: <span class="font-mono">{formatNumber(natMasqCount)}</span></p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900">
      <CardHeader class="pb-3">
        <CardTitle class="text-slate-100">{$_('dashboard.tls_inspection')}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3 text-sm text-slate-300">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <span class="text-slate-400">{$_('dashboard.state')}</span>
          <Badge class={tlsEnabled ? 'border-emerald-700 bg-emerald-900/35 text-emerald-300' : 'border-red-700 bg-red-900/35 text-red-300'}>
            {tlsEnabled ? 'enabled' : 'disabled'}
          </Badge>
        </div>
        <div class="space-y-1">
          <p class="text-slate-400">{$_('dashboard.management_bind')}</p>
          <p class="font-mono text-cyan-300">{tlsBindAddress}</p>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-400">{$_('dashboard.session_timeout')}</span>
          <span class="font-mono text-cyan-300">{tlsSessionTimeout}</span>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900">
      <CardHeader class="pb-3">
        <CardTitle class="text-slate-100">{$_('dashboard.zone_statistics')}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3 text-sm text-slate-300">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <span class="text-slate-400">{$_('dashboard.zone_count')}</span>
          <span class="font-mono text-cyan-300">{formatNumber(zoneCount)}</span>
        </div>
        <div class="space-y-1">
          <p class="text-slate-400">{$_('dashboard.zones')}</p>
          <p class="font-mono text-cyan-300">{zoneNames.length > 0 ? zoneNames.join(', ') : 'none'}</p>
        </div>
        <div class="space-y-1">
          <p class="text-slate-400">{$_('dashboard.policy_order')}</p>
          <p class="font-mono text-cyan-300">{zoneChain}</p>
        </div>
      </CardContent>
    </Card>
  </div>

  <div class="grid gap-4 xl:grid-cols-2">
    <Card class="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle class="text-slate-100">{$_('dashboard.recent_activity')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader class="bg-slate-800">
              <TableRow class="border-slate-700 hover:bg-slate-800">
                <TableHead class="text-slate-300">{$_('dashboard.timestamp')}</TableHead>
                <TableHead class="text-slate-300">{$_('dashboard.actor')}</TableHead>
                <TableHead class="text-slate-300">{$_('common.action')}</TableHead>
                <TableHead class="text-slate-300">{$_('dashboard.details')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#if idsAlerts.length === 0}
                <TableRow class="border-slate-800 hover:bg-slate-900">
                  <TableCell class="py-6 text-center text-slate-500" colspan={4}>No recent activity</TableCell>
                </TableRow>
              {:else}
                {#each idsAlerts as row}
                  <TableRow class="border-slate-800 hover:bg-slate-800/30">
                    <TableCell class="mono text-xs">{formatEpochTime(row.timestamp_utc)}</TableCell>
                    <TableCell>{asString(row.actor)}</TableCell>
                    <TableCell>{asString(row.action)}</TableCell>
                    <TableCell>{asString(row.details)}</TableCell>
                  </TableRow>
                {/each}
              {/if}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle class="text-slate-100">{$_('dashboard.pending_change_queue')}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-2">
        {#if $changeQueue.length === 0}
          <p class="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-500">{$_('dashboard.no_pending_changes')}</p>
        {:else}
          {#each $changeQueue as item}
            <p class="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">{item.label}</p>
          {/each}

        {/if}
      </CardContent>
    </Card>
  </div>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-slate-100">
        Protocol Distribution
        <Badge class={dpiEnabled ? 'border-emerald-700 bg-emerald-900/35 text-emerald-300' : 'border-red-700 bg-red-900/35 text-red-300'}>
          {dpiEnabled ? 'enabled' : 'disabled'}
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="h-72">
        <canvas bind:this={protocolCanvas}></canvas>
      </div>
    </CardContent>
  </Card>
</div>
