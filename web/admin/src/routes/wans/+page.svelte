<!-- Route view for `/wans` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import StatusPill from '$lib/components/admin/StatusPill.svelte';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import SaveIcon from '@lucide/svelte/icons/save';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

  import { _ } from '$lib/i18n';
  type LoadBalancingMode =
    | 'Failover'
    | 'RoundRobin'
    | 'Weighted'
    | 'LatencyBased'
    | 'Spillover'
    | 'BandwidthBased';

  type StickySessionConfig = {
    enabled: boolean;
    timeout_sec: number;
    match_mode: string;
  };

  type WanHealthCheck = {
    check_type: string;
    target: string;
    interval_sec: number;
    timeout_sec: number;
    fail_threshold: number;
    recover_threshold: number;
    http_url: string;
    http_expected_code: number;
    dns_query: string;
    jitter_threshold_ms: number;
    latency_threshold_ms: number;
    packet_loss_threshold: number;
  };

  type WanHealthCheckEntry = {
    id: string;
    interface: string;
    enabled: boolean;
    health_check: WanHealthCheck;
    failover_priority: number;
    failover_trigger_ms: number;
    recovery_delay_ms: number;
    expanded: boolean;
  };

  type LinkQuality = {
    wan_id: string;
    interface: string;
    status: string;
    latency_ms: number;
    jitter_ms: number;
    packet_loss_pct: number;
  };

  const lbModeOptions: { value: LoadBalancingMode; label: string }[] = [
    { value: 'Failover', label: 'Failover' },
    { value: 'RoundRobin', label: 'Round Robin' },
    { value: 'Weighted', label: 'Weighted' },
    { value: 'LatencyBased', label: 'Latency Based' },
    { value: 'Spillover', label: 'Spillover' },
    { value: 'BandwidthBased', label: 'Bandwidth Based' }
  ];

  const stickyModeOptions = [
    { value: 'source-ip', label: 'Source IP' },
    { value: 'source-dest', label: 'Source + Destination' },
    { value: 'source-dest-port', label: 'Source + Destination + Port' }
  ];

  const healthCheckTypes = [
    { value: 'ping', label: 'Ping' },
    { value: 'http', label: 'HTTP' },
    { value: 'dns', label: 'DNS' },
    { value: 'tcp', label: 'TCP' }
  ];

  let loading = $state(true);
  let savingLbMode = $state(false);
  let savingHealthCheck = $state('');

  let healthChecks = $state<WanHealthCheckEntry[]>([]);
  let linkQuality = $state<LinkQuality[]>([]);

  let lbMode = $state<LoadBalancingMode>('Failover');
  let stickySessions = $state<StickySessionConfig>({ enabled: false, timeout_sec: 3600, match_mode: 'source-ip' });

  function normalizeHealthCheck(raw: Record<string, unknown>): WanHealthCheck {
    return {
      check_type: String(raw.check_type ?? 'ping'),
      target: String(raw.target ?? ''),
      interval_sec: Number(raw.interval_sec ?? 5),
      timeout_sec: Number(raw.timeout_sec ?? 3),
      fail_threshold: Number(raw.fail_threshold ?? 3),
      recover_threshold: Number(raw.recover_threshold ?? 3),
      http_url: String(raw.http_url ?? ''),
      http_expected_code: Number(raw.http_expected_code ?? 200),
      dns_query: String(raw.dns_query ?? ''),
      jitter_threshold_ms: Number(raw.jitter_threshold_ms ?? 50),
      latency_threshold_ms: Number(raw.latency_threshold_ms ?? 150),
      packet_loss_threshold: Number(raw.packet_loss_threshold ?? 5)
    };
  }

  async function loadData() {
    loading = true;
    try {
      const [lbPayload, healthPayload, linkPayload] = await Promise.all([
        api.get<Record<string, unknown>>('/wans/lb-mode'),
        api.get<unknown[]>('/wans/health-checks'),
        api.get<unknown[]>('/wans/link-quality')
      ]);

      lbMode = String(lbPayload.lb_mode ?? 'Failover') as LoadBalancingMode;
      const stickyRaw = (lbPayload.sticky_sessions ?? {}) as Record<string, unknown>;
      stickySessions = {
        enabled: Boolean(stickyRaw.enabled ?? false),
        timeout_sec: Number(stickyRaw.timeout_sec ?? 3600),
        match_mode: String(stickyRaw.match_mode ?? 'source-ip')
      };

      healthChecks = Array.isArray(healthPayload)
        ? healthPayload.map((row) => {
            const item = (row ?? {}) as Record<string, unknown>;
            return {
              id: String(item.id ?? ''),
              interface: String(item.interface ?? ''),
              enabled: Boolean(item.enabled ?? true),
              health_check: normalizeHealthCheck((item.health_check ?? {}) as Record<string, unknown>),
              failover_priority: Number(item.failover_priority ?? 1),
              failover_trigger_ms: Number(item.failover_trigger_ms ?? 5000),
              recovery_delay_ms: Number(item.recovery_delay_ms ?? 10000),
              expanded: false
            };
          })
        : [];

      linkQuality = Array.isArray(linkPayload)
        ? linkPayload.map((row) => {
            const item = (row ?? {}) as Record<string, unknown>;
            return {
              wan_id: String(item.wan_id ?? ''),
              interface: String(item.interface ?? ''),
              status: String(item.status ?? 'unknown'),
              latency_ms: Number(item.latency_ms ?? 0),
              jitter_ms: Number(item.jitter_ms ?? 0),
              packet_loss_pct: Number(item.packet_loss_pct ?? 0)
            };
          })
        : [];
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load WAN enterprise settings');
    } finally {
      loading = false;
    }
  }

  async function saveLoadBalancing() {
    savingLbMode = true;
    try {
      await api.put('/wans/lb-mode', {
        lb_mode: lbMode,
        sticky_sessions: {
          enabled: stickySessions.enabled,
          timeout_sec: Number(stickySessions.timeout_sec || 0),
          match_mode: stickySessions.match_mode
        }
      });
      toasts.success($_('wans.toast_load_balancing_and_sticky_session_settings_saved'));
      await loadData();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save load balancing settings');
    } finally {
      savingLbMode = false;
    }
  }

  async function saveHealthCheck(row: WanHealthCheckEntry) {
    savingHealthCheck = row.id;
    try {
      await api.put(`/wans/${row.id}/health-check`, {
        id: row.id,
        interface: row.interface,
        enabled: row.enabled,
        health_check: {
          check_type: row.health_check.check_type,
          target: row.health_check.target,
          interval_sec: Number(row.health_check.interval_sec || 0),
          timeout_sec: Number(row.health_check.timeout_sec || 0),
          fail_threshold: Number(row.health_check.fail_threshold || 0),
          recover_threshold: Number(row.health_check.recover_threshold || 0),
          http_url: row.health_check.http_url,
          http_expected_code: Number(row.health_check.http_expected_code || 0),
          dns_query: row.health_check.dns_query,
          jitter_threshold_ms: Number(row.health_check.jitter_threshold_ms || 0),
          latency_threshold_ms: Number(row.health_check.latency_threshold_ms || 0),
          packet_loss_threshold: Number(row.health_check.packet_loss_threshold || 0)
        },
        failover_priority: Number(row.failover_priority || 0),
        failover_trigger_ms: Number(row.failover_trigger_ms || 0),
        recovery_delay_ms: Number(row.recovery_delay_ms || 0)
      });
      toasts.success(`Health check saved for ${row.interface}`);
      await loadData();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save health check');
    } finally {
      savingHealthCheck = '';
    }
  }

  function tone(status: string) {
    const normalized = status.toLowerCase();
    if (normalized.includes('degraded') || normalized.includes('down')) return 'text-rose-300 border-rose-500/40 bg-rose-950/40';
    return 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40';
  }

  onMount(() => {
    void loadData();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader class="flex flex-row items-start justify-between gap-3">
      <div>
        <CardTitle class="text-slate-100">{$_('wans.enterprise_wan_controls')}</CardTitle>
        <p class="mt-1 text-sm text-slate-400">{$_('wans.configure_global_load_balancing_behavior_sticky_se')}</p>
      </div>
      <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={() => void loadData()} disabled={loading}>
        <RefreshCwIcon class="mr-2 h-4 w-4" /> Refresh
      </Button>
    </CardHeader>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('wans.load_balancing_mode')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel label="Load balancing algorithm" hint="Choose how traffic is distributed across all active WAN links. Example: use Weighted when you want primary fiber to receive 80% of sessions and LTE backup to receive 20%." />
          <Select.Root type="single" value={lbMode} onValueChange={(value) => value && (lbMode = value as LoadBalancingMode)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{lbModeOptions.find((option) => option.value === lbMode)?.label ?? 'Select mode'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each lbModeOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      <div class="rounded-md border border-slate-800 bg-slate-950/60 p-4">
        <h3 class="text-sm font-medium text-slate-200">{$_('wans.sticky_sessions')}</h3>
        <div class="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabel label="Enabled" hint="Sticky sessions keep related flows on the same WAN to prevent breakage with session-bound applications. Example: enable this for banking portals or SIP flows that reject source path changes." />
            <div class="mt-2 flex items-center justify-between rounded-md border border-slate-800 px-3 py-2">
              <span class="text-xs text-slate-400">{stickySessions.enabled ? 'Enabled' : 'Disabled'}</span>
              <Switch checked={stickySessions.enabled} onCheckedChange={(checked) => (stickySessions.enabled = checked)} />
            </div>
          </div>
          <div>
            <FieldLabel label="Timeout (seconds)" hint="Defines how long affinity is preserved after the most recent matching packet. Example: set 3600 to hold an hour-long SaaS session on the same WAN path." />
            <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="30" bind:value={stickySessions.timeout_sec} />
          </div>
          <div>
            <FieldLabel label="Match mode" hint="Controls the tuple used to pin sessions to a WAN path. Example: source-dest-port gives the strongest stickiness for multi-tenant outbound NAT environments." />
            <Select.Root type="single" value={stickySessions.match_mode} onValueChange={(value) => value && (stickySessions.match_mode = value)}>
              <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                <span>{stickyModeOptions.find((option) => option.value === stickySessions.match_mode)?.label ?? 'Select match mode'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                {#each stickyModeOptions as option}
                  <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </div>

      <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveLoadBalancing} disabled={savingLbMode || loading}>
        <SaveIcon class="mr-2 h-4 w-4" /> {savingLbMode ? 'Saving...' : 'Save Load Balancing'}
      </Button>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('wans.per_wan_health_check_policies')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      {#if healthChecks.length === 0}
        <p class="text-sm text-slate-400">{$_('wans.no_wan_health_check_entries_available')}</p>
      {/if}
      {#each healthChecks as row}
        <Collapsible.Root bind:open={row.expanded}>
          <div class="rounded-md border border-slate-800 bg-slate-950/60">
            <Collapsible.Trigger class="flex w-full items-center justify-between px-4 py-3 text-left">
              <div>
                <p class="text-sm font-medium text-slate-100">{row.interface}</p>
                <p class="text-xs text-slate-400">WAN ID: {row.id}</p>
              </div>
              <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${row.expanded ? 'rotate-180' : ''}`} />
            </Collapsible.Trigger>
            <Collapsible.Content class="space-y-4 border-t border-slate-800 px-4 py-4">
              <div class="grid gap-4 md:grid-cols-3">
                <div>
                  <FieldLabel label="Check type" hint="Select probe protocol based on uplink and provider behavior. Example: use HTTP against a cloud URL when ICMP is deprioritized by the ISP edge." />
                  <Select.Root type="single" value={row.health_check.check_type} onValueChange={(value) => value && (row.health_check.check_type = value)}>
                    <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                      <span>{healthCheckTypes.find((option) => option.value === row.health_check.check_type)?.label ?? 'Select check type'}</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                      {#each healthCheckTypes as option}
                        <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
                <div>
                  <FieldLabel label="Target" hint="Target is the primary probe endpoint used for path liveliness. Example: use 1.1.1.1 for generic internet reachability or a private head-end for MPLS validation." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={row.health_check.target} />
                </div>
                <div>
                  <FieldLabel label="HTTP URL" hint="HTTP checks validate real application path behavior instead of basic ICMP liveness. Example: https://status.example.com/health returning 200 for success." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={row.health_check.http_url} />
                </div>
                <div>
                  <FieldLabel label="DNS query" hint="DNS probe validates recursive resolver and internet path in one test. Example: query example.com to detect walled-garden states after CPE reconnects." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={row.health_check.dns_query} />
                </div>
                <div>
                  <FieldLabel label="Interval (sec)" hint="Probe interval controls how quickly impairment is detected and how much monitoring traffic is generated. Example: 5 seconds balances fast failover with low probe overhead." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="1" bind:value={row.health_check.interval_sec} />
                </div>
                <div>
                  <FieldLabel label="Timeout (sec)" hint="Timeout should stay below interval to avoid check pileups under congestion. Example: use 3 seconds on high-latency satellite links and 1-2 seconds on fiber WANs." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="1" bind:value={row.health_check.timeout_sec} />
                </div>
                <div>
                  <FieldLabel label="Fail threshold" hint="Threshold prevents transient jitter spikes from forcing unnecessary path failover. Example: mark link down after 3 consecutive failures in branch office deployments." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="1" bind:value={row.health_check.fail_threshold} />
                </div>
                <div>
                  <FieldLabel label="Recover threshold" hint="Recovery threshold adds hysteresis so paths stabilize before traffic returns. Example: require 3 successful checks before restoring primary WAN traffic." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="1" bind:value={row.health_check.recover_threshold} />
                </div>
                <div>
                  <FieldLabel label="Expected HTTP code" hint="HTTP checks can enforce strict status validation for app health semantics. Example: expect 200 for a healthy endpoint or 204 for no-content probe responses." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="100" max="599" bind:value={row.health_check.http_expected_code} />
                </div>
                <div>
                  <FieldLabel label="Latency threshold (ms)" hint="Threshold marks path quality degradation before complete outage occurs. Example: set 120ms for voice-critical links to trigger SD-WAN reroute early." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="1" bind:value={row.health_check.latency_threshold_ms} />
                </div>
                <div>
                  <FieldLabel label="Jitter threshold (ms)" hint="Jitter controls real-time media experience and should be kept low on voice/video paths. Example: 30ms is a common upper bound for high-quality VoIP trunks." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="1" bind:value={row.health_check.jitter_threshold_ms} />
                </div>
                <div>
                  <FieldLabel label="Packet loss threshold (%)" hint="Packet loss threshold protects application reliability under congestion and flaps. Example: set 2-5% maximum before switching to cleaner WAN transport." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="0" max="100" bind:value={row.health_check.packet_loss_threshold} />
                </div>
                <div>
                  <FieldLabel label="Failover trigger (ms)" hint="Failover trigger controls how long impairment must persist before traffic reroutes. Example: 5000ms avoids failover storms during short ISP micro-outages." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="0" bind:value={row.failover_trigger_ms} />
                </div>
                <div>
                  <FieldLabel label="Recovery delay (ms)" hint="Recovery delay is hysteresis time before restored links can carry traffic again. Example: 10000ms helps stabilize dynamic carrier links before preemption." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="0" bind:value={row.recovery_delay_ms} />
                </div>
                <div>
                  <FieldLabel label="Failover priority" hint="Priority orders WAN links from preferred to least preferred during failover operation. Example: priority 1 for MPLS primary and priority 2 for broadband backup." />
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="0" bind:value={row.failover_priority} />
                </div>
              </div>
              <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveHealthCheck(row)} disabled={savingHealthCheck === row.id}>
                <SaveIcon class="mr-2 h-4 w-4" /> {savingHealthCheck === row.id ? 'Saving...' : `Save ${row.interface}`}
              </Button>
            </Collapsible.Content>
          </div>
        </Collapsible.Root>
      {/each}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('wans.link_quality')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-2">
      {#if linkQuality.length === 0}
        <p class="text-sm text-slate-400">{$_('wans.no_link_quality_samples_available')}</p>
      {/if}
      {#each linkQuality as metric}
        <div class="grid gap-2 rounded-md border p-3 md:grid-cols-5 {tone(metric.status)}">
          <div>
            <p class="text-xs uppercase tracking-wide">WAN</p>
            <p class="text-sm font-medium">{metric.interface}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide">Latency</p>
            <p class="text-sm font-medium">{metric.latency_ms} ms</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide">Jitter</p>
            <p class="text-sm font-medium">{metric.jitter_ms} ms</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide">Packet Loss</p>
            <p class="text-sm font-medium">{metric.packet_loss_pct}%</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide">Status</p>
            <StatusPill status={String(metric.status)} />
          </div>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
