<!-- Route view for `/netdata` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asObject, asList } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import Info from '@lucide/svelte/icons/info';
  import Save from '@lucide/svelte/icons/save';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Copy from '@lucide/svelte/icons/copy';
  import Terminal from '@lucide/svelte/icons/terminal';
  import FileCode from '@lucide/svelte/icons/file-code';
  import { _ } from '$lib/i18n';

  type NetdataStreamingConfig = {
    enabled: boolean;
    role: string;
    destination: string;
    api_key: string;
    buffer_size: number;
    reconnect_seconds: number;
  };

  type NetdataHealthConfig = {
    enabled: boolean;
    default_recipient: string;
    log_alarms: boolean;
    alarm_check_interval: number;
  };

  type NetdataConfig = {
    enabled: boolean;
    integration_mode: string;
    install_status: string;
    web_port: number;
    web_bind: string;
    history_seconds: number;
    scrape_interval_seconds: number;
    ebpf_plugin: boolean;
    memory_mode: string;
    ssl_enabled: boolean;
    ssl_certificate: string;
    ssl_key: string;
    allowed_origins: string;
    apps_plugin: boolean;
    proc_plugin: boolean;
    charts_plugin: boolean;
    debug_logging: boolean;
    oom_score_adj: number;
    streaming: NetdataStreamingConfig;
    health: NetdataHealthConfig;
    custom_dashboards: string[];
  };

  const defaults: NetdataConfig = {
    enabled: false,
    integration_mode: 'external',
    install_status: 'unknown',
    web_port: 19999,
    web_bind: '0.0.0.0',
    history_seconds: 3600,
    scrape_interval_seconds: 5,
    ebpf_plugin: false,
    memory_mode: 'dbengine',
    ssl_enabled: false,
    ssl_certificate: '',
    ssl_key: '',
    allowed_origins: '*',
    apps_plugin: true,
    proc_plugin: true,
    charts_plugin: false,
    debug_logging: false,
    oom_score_adj: 0,
    streaming: {
      enabled: false,
      role: 'child',
      destination: '',
      api_key: '',
      buffer_size: 1048576,
      reconnect_seconds: 5
    },
    health: {
      enabled: true,
      default_recipient: 'sysadmin',
      log_alarms: true,
      alarm_check_interval: 10
    },
    custom_dashboards: []
  };

  let settings = $state<NetdataConfig>({ ...defaults, streaming: { ...defaults.streaming }, health: { ...defaults.health }, custom_dashboards: [] });
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');

  let showStreaming = $state(false);
  let showHealth = $state(false);
  let showAdvanced = $state(false);
  let showCollectors = $state(true);

  let newDashboardUrl = $state('');
  let showDockerInstructions = $state(false);
  let copiedCompose = $state(false);
  let copiedEnv = $state(false);
  let status = $state<Record<string, unknown>>({ running: false, version: '-', pid: null });

  const memoryModes = [
    { value: 'ram', label: 'ram' },
    { value: 'save', label: 'save' },
    { value: 'map', label: 'map' },
    { value: 'alloc', label: 'alloc' },
    { value: 'dbengine', label: 'dbengine' }
  ];

  const streamRoles = [
    { value: 'parent', label: 'Parent (aggregate from children)' },
    { value: 'child', label: 'Child (stream out to parent)' }
  ];

  const integrationModes = [
    { value: 'integrated', label: 'Integrated (embedded through ezNGFW proxy)' },
    { value: 'external', label: 'External (open Netdata in new tab)' },
    { value: 'disabled', label: 'Disabled (hide dashboard access)' }
  ];

  const dashboardUrl = $derived.by(() => {
    const scheme = settings.ssl_enabled ? 'https' : 'http';
    const host = settings.web_bind === '0.0.0.0' ? 'localhost' : settings.web_bind;
    return `${scheme}://${host}:${settings.web_port}`;
  });

  /** Pre-configured Docker Compose YAML for external Netdata deployment. */
  const dockerComposeYaml = $derived.by(() => {
    const ngfwHost = settings.web_bind === '0.0.0.0' ? '<NGFW_IP>' : settings.web_bind;
    const streamKey = settings.streaming.api_key || 'change-me-to-a-random-uuid';
    return `# Netdata Docker Compose — pre-configured for ezNGFW
# Save as docker-compose.netdata.yml and run:
#   docker compose -f docker-compose.netdata.yml up -d

services:
  netdata:
    image: netdata/netdata:stable
    container_name: ezngfw-netdata
    hostname: ezngfw-monitor
    restart: unless-stopped
    pid: host
    network_mode: host
    cap_add:
      - SYS_PTRACE
      - SYS_ADMIN
    security_opt:
      - apparmor:unconfined
    volumes:
      - netdata-config:/etc/netdata
      - netdata-lib:/var/lib/netdata
      - netdata-cache:/var/cache/netdata
      - /etc/passwd:/host/etc/passwd:ro
      - /etc/group:/host/etc/group:ro
      - /etc/localtime:/etc/localtime:ro
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /var/log:/host/var/log:ro
      - /run/dbus:/run/dbus:ro
    environment:
      # ---- ezNGFW streaming (child → this Netdata parent) ----
      - NETDATA_STREAM_ENABLED=yes
      - NETDATA_STREAM_API_KEY=\${STREAM_API_KEY:-${streamKey}}
      # ---- General settings matching your ezNGFW config ----
      - NETDATA_PORT=${settings.web_port}
      - NETDATA_HISTORY=${settings.history_seconds}
      - NETDATA_MEMORY_MODE=${settings.memory_mode}
      - NETDATA_UPDATE_EVERY=${settings.scrape_interval_seconds}
    ports:
      - "${settings.web_port}:${settings.web_port}"

volumes:
  netdata-config:
  netdata-lib:
  netdata-cache:
`;
  });

  /** ezNGFW streaming config snippet to enable child mode on the firewall. */
  const streamConfigSnippet = $derived.by(() => {
    const parentHost = '<DOCKER_HOST_IP>';
    const streamKey = settings.streaming.api_key || 'change-me-to-a-random-uuid';
    return `# On your ezNGFW appliance, enable streaming (child mode):
#   Settings → Monitoring → Netdata → Streaming Configuration
#
#   Enable streaming:   ON
#   Node role:          Child
#   Destination:        ${parentHost}:${settings.web_port}
#   API key:            ${streamKey}
#   Buffer size:        ${settings.streaming.buffer_size}
#   Reconnect:          ${settings.streaming.reconnect_seconds}s`;
  });

  function copyToClipboard(text: string, which: 'compose' | 'env') {
    if (typeof navigator === 'undefined') return;
    navigator.clipboard.writeText(text).then(() => {
      if (which === 'compose') {
        copiedCompose = true;
        setTimeout(() => (copiedCompose = false), 2000);
      } else {
        copiedEnv = true;
        setTimeout(() => (copiedEnv = false), 2000);
      }
    });
  }

  const collectorCount = $derived.by(
    () =>
      Number(settings.ebpf_plugin) +
      Number(settings.apps_plugin) +
      Number(settings.proc_plugin) +
      Number(settings.charts_plugin)
  );

  const netdataInstalled = $derived.by(() => String(status.state) !== 'NotInstalled');

  const hints = {
    enabled:
      'This master toggle controls whether the Netdata daemon should run and collect metrics at boot. Disable it when you need to conserve RAM/CPU on smaller appliances or while replacing your telemetry stack. Example: enabled on production firewalls, disabled on temporary lab VMs.',
    integration_mode:
      'Integration mode controls how operators access dashboards: embedded through the ezNGFW auth proxy, direct browser access to Netdata, or fully disabled dashboard exposure. Example: integrated for admin-only in-product visibility, external for direct NOC bookmarks, disabled on hardened appliances with no UI exposure.',
    install_status:
      'Install controls manage the underlying Netdata package on Alpine via apk add/apk del, and keep install status aligned with runtime state. Example: install during initial observability rollout, uninstall on minimal edge footprints that do not need local dashboarding.',
    dashboardUrl:
      'This is the effective Netdata dashboard URL computed from bind address, port, and SSL mode. Use this link when embedding Netdata into external runbooks or NOC dashboards so operators always open the right endpoint. Example: https://fw-core-1.example.net:19999, and update when you move management traffic to a different interface.',
    web_bind:
      'The bind address determines which interfaces expose the Netdata web server and API surface. Keep it scoped to a management VLAN or loopback whenever possible to reduce attack surface from untrusted segments. Example: 127.0.0.1 for local-only access, and switch to 10.20.0.1 when remote NOC visibility is required.',
    web_port:
      'The listener port is where browsers and API clients connect to the Netdata dashboard service. Keep 19999 if your tooling already references it, but move to an alternate port if conflicts or policy controls demand it. Example: 19999 by default, and change to 8443 in restricted environments.',
    scrape_interval_seconds:
      'Collection interval controls how often Netdata samples counters and system state from plugins. Lower values improve granularity for burst troubleshooting but increase CPU and I/O overhead on busy appliances. Example: 1-2 seconds for packet-loss investigations, and increase to 5-10 seconds for long-term steady monitoring.',
    history_seconds:
      'History retention defines how long local time-series points stay available before aging out. Higher retention helps with trend analysis during incident reviews but uses more memory or disk depending on memory mode. Example: 86400 for one day of local history, and shorten to 3600 on constrained hardware.',
    memory_mode:
      'Memory mode selects the storage strategy Netdata uses for metric history and page cache behavior. Use ram for fastest ephemeral data, save/map for disk-backed persistence, alloc for compatibility, and dbengine for long-lived retention. Example: dbengine on appliances with SSD, and switch to ram on read-only or low-end edge nodes.',
    ssl_enabled:
      'TLS encryption protects dashboard credentials and metric payloads in transit across management networks. Enable this whenever operators connect over routed networks, VPN links, or shared infrastructure. Example: enabled with internal PKI certificates, and keep disabled only for isolated localhost access.',
    ssl_certificate:
      'Certificate path points to the PEM file presented by Netdata when SSL mode is enabled. Use a certificate signed by your internal CA to avoid browser warnings and to support automated trust validation. Example: /etc/ssl/certs/netdata.pem, and update when certificate rotation moves files.',
    ssl_key:
      'Private key path should match the certificate and remain readable only by the Netdata service account. Keep key material outside user home paths and rotate quickly if compromise is suspected. Example: /etc/ssl/private/netdata.key, and change after every PKI renewal or key rollover.',
    allowed_origins:
      'Allowed origins controls which web origins can make browser-based cross-origin calls to the Netdata API. Restrict this list to trusted dashboards or automation portals to prevent unauthorized script access from random sites. Example: https://noc.example.net,https://grafana.example.net, and tighten it whenever new integrations are removed.',
    debug_logging:
      'Debug logging enables verbose diagnostics for plugin load order, stream state changes, and collector timing. Keep this off during normal operations to avoid noisy logs and extra disk writes, then enable briefly for root-cause analysis. Example: disabled normally, enabled during a plugin crash investigation.',
    oom_score_adj:
      'OOM score adjustment influences Linux out-of-memory kill priority for the Netdata process. Lower values protect Netdata from being killed first, while higher values make it more disposable under pressure. Example: -200 on observability-critical gateways, and raise toward 200 on memory-starved edge devices.',
    ebpf_plugin:
      'The eBPF plugin unlocks low-overhead kernel telemetry such as process, socket, and network behavior with richer context. Enable it on kernels that support eBPF when you need deep flow visibility and latency root-cause data. Example: enabled on 5.x kernels with BTF, and disable on unsupported or heavily locked-down kernels.',
    apps_plugin:
      'apps.plugin captures per-process CPU, memory, and I/O usage so you can correlate spikes with specific services. Keep this on in most deployments to shorten troubleshooting time for daemon contention and noisy neighbors. Example: enabled on shared appliances, and disable only when strict overhead budgets require it.',
    proc_plugin:
      'proc.plugin reads kernel /proc counters and exposes fundamental host and network charts used by most dashboards. Disabling it removes many core metrics, so keep it enabled unless you are intentionally reducing surface area. Example: enabled by default, and disable only in highly specialized collector setups.',
    charts_plugin:
      'charts.d plugin runs script-based collectors for custom services and niche telemetry sources. Enable it when you rely on bespoke scripts or third-party collectors that are not available as native modules. Example: enable for custom IPS signatures charting, and disable when standard built-in collectors are sufficient.',
    stream_enabled:
      'Streaming mode forwards or aggregates metrics between Netdata agents for distributed topologies. Enable this when branch nodes should publish to a central parent or when this node should aggregate children. Example: enabled on branch firewalls streaming to HQ, and disable in standalone deployments.',
    stream_role:
      'Role selects whether this node acts as a parent collector receiving streams or as a child sender. Set parent on central observability nodes and child on edge systems that report upstream. Example: child on remote office firewalls, and switch to parent for a regional aggregation hub.',
    stream_destination:
      'Destination defines the upstream parent host:port for child streaming mode. Use a resilient internal address reachable over your management overlay to avoid dropped stream sessions. Example: netdata-core.example.net:19999, and update after failover topology changes.',
    stream_api_key:
      'Streaming API key authenticates child-to-parent ingestion and should be treated like service credentials. Rotate the key periodically and whenever a node is decommissioned to reduce unauthorized stream risk. Example: a long random token generated per cluster, and change when onboarding or offboarding branches.',
    stream_buffer_size:
      'Buffer size controls how much metric data can queue before transmission under congestion or parent interruptions. Larger buffers smooth transient outages but consume additional memory for queued chunks. Example: 1048576 bytes for stable LAN links, and raise for high-latency WAN paths.',
    stream_reconnect_seconds:
      'Reconnect interval defines how quickly a child retries when stream sessions drop. Lower values improve recovery speed but can create extra connection churn during sustained outages. Example: 5 seconds for normal operations, and increase to 30 seconds on unstable WAN links.',
    health_enabled:
      'Health monitoring enables Netdata alarm evaluation across configured charts and dimensions. Keep this enabled so threshold breaches produce actionable events instead of silent failures. Example: enabled with standard templates, and disable temporarily during controlled load testing to avoid alert noise.',
    health_default_recipient:
      'Default recipient maps alarm notifications to a target route such as sysadmin, slack, or pager integration labels. Use a route name your notification backend understands so alarms are not dropped. Example: sysadmin or noc-oncall, and change when ownership of the service moves teams.',
    health_log_alarms:
      'Alarm logging writes transitions to logs for audit timelines and post-incident reconstruction. Keep this on in regulated or production environments so alert history survives dashboard refresh cycles. Example: enabled for SOC evidence trails, and disable only in ephemeral lab systems.',
    health_alarm_check_interval:
      'Alarm check interval controls how often health rules evaluate current metric values. Short intervals catch threshold crossings sooner but increase evaluation load and potential alert chatter. Example: 10 seconds in production, and reduce to 2 seconds when debugging intermittent spikes.',
    custom_dashboards:
      'Custom dashboard entries provide quick links to pre-filtered Netdata views or external observability boards. Keep this list curated so on-call engineers can jump directly to relevant charts during incidents. Example: https://noc.example.net/netdata?host=branch-7, and update whenever dashboard URLs change.'
  };

  function toNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toText(value: unknown, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  function toBool(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return fallback;
  }

  function normalize(payload: Record<string, unknown>): NetdataConfig {
    const streaming = asObject(payload.streaming ?? {});
    const health = asObject(payload.health ?? {});
    const customDashboards = asList(payload.custom_dashboards).map((item) => String(item)).filter(Boolean);

    return {
      enabled: toBool(payload.enabled, defaults.enabled),
      integration_mode: toText(payload.integration_mode, defaults.integration_mode),
      install_status: toText(payload.install_status, defaults.install_status),
      web_port: toNumber(payload.web_port, defaults.web_port),
      web_bind: toText(payload.web_bind, defaults.web_bind),
      history_seconds: toNumber(payload.history_seconds, defaults.history_seconds),
      scrape_interval_seconds: toNumber(payload.scrape_interval_seconds, defaults.scrape_interval_seconds),
      ebpf_plugin: toBool(payload.ebpf_plugin, defaults.ebpf_plugin),
      memory_mode: toText(payload.memory_mode, defaults.memory_mode),
      ssl_enabled: toBool(payload.ssl_enabled, defaults.ssl_enabled),
      ssl_certificate: toText(payload.ssl_certificate, defaults.ssl_certificate),
      ssl_key: toText(payload.ssl_key, defaults.ssl_key),
      allowed_origins: toText(payload.allowed_origins, defaults.allowed_origins),
      apps_plugin: toBool(payload.apps_plugin, defaults.apps_plugin),
      proc_plugin: toBool(payload.proc_plugin, defaults.proc_plugin),
      charts_plugin: toBool(payload.charts_plugin, defaults.charts_plugin),
      debug_logging: toBool(payload.debug_logging, defaults.debug_logging),
      oom_score_adj: toNumber(payload.oom_score_adj, defaults.oom_score_adj),
      streaming: {
        enabled: toBool(streaming.enabled, defaults.streaming.enabled),
        role: toText(streaming.role, defaults.streaming.role),
        destination: toText(streaming.destination, defaults.streaming.destination),
        api_key: toText(streaming.api_key, defaults.streaming.api_key),
        buffer_size: toNumber(streaming.buffer_size, defaults.streaming.buffer_size),
        reconnect_seconds: toNumber(streaming.reconnect_seconds, defaults.streaming.reconnect_seconds)
      },
      health: {
        enabled: toBool(health.enabled, defaults.health.enabled),
        default_recipient: toText(health.default_recipient, defaults.health.default_recipient),
        log_alarms: toBool(health.log_alarms, defaults.health.log_alarms),
        alarm_check_interval: toNumber(health.alarm_check_interval, defaults.health.alarm_check_interval)
      },
      custom_dashboards: customDashboards
    };
  }

  async function loadStatus() {
    try {
      status = asObject(await api.get('/netdata/status'));
    } catch {
      status = { running: false, version: '-', pid: null };
    }
  }

  async function loadSettings() {
    loading = true;
    error = '';
    try {
      const payload = asObject(await api.get('/netdata'));
      settings = normalize(payload);
      showStreaming = settings.streaming.enabled;
      showHealth = settings.health.enabled;
      showAdvanced = settings.ssl_enabled || settings.debug_logging || settings.oom_score_adj !== 0;
      showCollectors = true;
    } catch (e) {
      settings = { ...defaults, streaming: { ...defaults.streaming }, health: { ...defaults.health }, custom_dashboards: [] };
      error = e instanceof Error ? e.message : 'Unable to load Netdata configuration';
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.patch('/netdata', settings);
      toasts.success($_('netdata.toastnetdata_settings_saved'));
      await loadStatus();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save Netdata settings');
    } finally {
      saving = false;
    }
  }

  async function installNetdata() {
    try {
      await api.post('/netdata/install');
      settings.install_status = 'installed';
      toasts.success($_('netdata.toastnetdata_installed'));
      await loadStatus();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to install Netdata');
    }
  }

  async function uninstallNetdata() {
    try {
      await api.post('/netdata/uninstall');
      settings.enabled = false;
      settings.integration_mode = 'disabled';
      settings.install_status = 'not_installed';
      toasts.success($_('netdata.toastnetdata_uninstalled'));
      await loadStatus();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to uninstall Netdata');
    }
  }

  function addDashboardUrl() {
    const candidate = newDashboardUrl.trim();
    if (!candidate) return;
    settings.custom_dashboards = [...settings.custom_dashboards, candidate];
    newDashboardUrl = '';
  }

  function removeDashboardUrl(index: number) {
    settings.custom_dashboards = settings.custom_dashboards.filter((_, idx) => idx !== index);
  }

  function openDashboard() {
    if (typeof window === 'undefined') return;
    window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
  }

  onMount(() => {
    loadSettings();
    loadStatus();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-700 bg-slate-950/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('netdata.netdata_service_configuration')}</CardTitle>
          <CardDescription class="text-slate-400">
            Build an OPNsense-depth telemetry profile with collector tuning, streaming, health alarms, and hardening controls.
          </CardDescription>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" class="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onclick={loadSettings} disabled={loading}>
            <RefreshCw class="mr-1.5 h-3.5 w-3.5" />
            Reload
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={loading || saving}>
            <Save class="mr-1.5 h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      {#if error}
        <div class="rounded-md border border-red-700/50 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>
      {/if}

      <div class="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
        <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <FieldLabel label="Integration mode" hint={hints.integration_mode} />
            <Select.Root type="single" value={settings.integration_mode} onValueChange={(value) => value && (settings.integration_mode = value)}>
            <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
              <span>{integrationModes.find(o => o.value === settings.integration_mode)?.label ?? settings.integration_mode}</span>
            </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                {#each integrationModes as mode}
                  <Select.Item value={mode.value} label={mode.label} class="text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="flex justify-start md:justify-end">
            {#if !netdataInstalled}
              <Button class="bg-emerald-600 text-white hover:bg-emerald-700" onclick={installNetdata}>
                Install Netdata
              </Button>
            {:else}
              <Button variant="outline" class="border-red-700 text-red-300 hover:bg-slate-800" onclick={uninstallNetdata}>
                Uninstall Netdata
              </Button>
            {/if}
          </div>
        </div>
        <div class="mt-2 text-xs text-slate-400">
          <FieldLabel label="Install actions" hint={hints.install_status} />
        </div>
        {#if settings.integration_mode === 'external' && netdataInstalled}
          <div class="mt-3 flex items-center gap-2">
            <Button variant="outline" class="border-cyan-700 bg-slate-900 text-cyan-300 hover:bg-slate-800" onclick={openDashboard}>
              <ExternalLink class="mr-1.5 h-3.5 w-3.5" />
              Open Dashboard
            </Button>
          </div>
        {:else if settings.integration_mode === 'external' && !netdataInstalled}
          <div class="mt-3">
            <button
              type="button"
              class="flex w-full cursor-pointer items-center gap-2 rounded-md border border-cyan-700/40 bg-cyan-950/20 px-4 py-3 text-left text-sm font-medium text-cyan-300 transition hover:bg-cyan-950/30"
              onclick={() => (showDockerInstructions = !showDockerInstructions)}
            >
              <Terminal class="h-4 w-4 shrink-0" />
              <span>{$_('netdata.deploy_netdata_externally_with_docker_compose')}</span>
              {#if showDockerInstructions}
                <ChevronDown class="ml-auto h-4 w-4 text-slate-500" />
              {:else}
                <ChevronRight class="ml-auto h-4 w-4 text-slate-500" />
              {/if}
            </button>
            {#if showDockerInstructions}
              <div class="mt-3 space-y-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                <div>
                  <div class="flex items-center justify-between">
                    <h4 class="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <FileCode class="h-4 w-4 text-cyan-400" />
                      Quick Start
                    </h4>
                  </div>
                  <ol class="mt-2 space-y-1.5 pl-5 text-sm leading-relaxed text-slate-300">
                    <li class="list-decimal">Copy the Docker Compose file below to your monitoring host.</li>
                    <li class="list-decimal">Replace <code class="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-cyan-300">&lt;NGFW_IP&gt;</code> with your ezNGFW management IP.</li>
                    <li class="list-decimal">Replace <code class="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-cyan-300">&lt;DOCKER_HOST_IP&gt;</code> with the Docker host IP in the streaming config.</li>
                    <li class="list-decimal">Run <code class="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-cyan-300">docker compose -f docker-compose.netdata.yml up -d</code></li>
                    <li class="list-decimal">Enable streaming on ezNGFW (see config snippet below) and click <strong>Save</strong>.</li>
                    <li class="list-decimal">Open <code class="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-cyan-300">http://&lt;DOCKER_HOST_IP&gt;:{settings.web_port}</code> to access the dashboard.</li>
                  </ol>
                </div>

                <div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs font-medium uppercase tracking-wide text-slate-400">{$_('netdata.dockercomposenetdatayml')}</p>
                    <Button
                      variant="ghost"
                      class="h-7 cursor-pointer gap-1.5 px-2 text-xs text-slate-400 hover:text-cyan-300"
                      onclick={() => copyToClipboard(dockerComposeYaml, 'compose')}
                    >
                      <Copy class="h-3 w-3" />
                      {copiedCompose ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre class="mt-1 max-h-[400px] overflow-auto rounded-md border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300"><code>{dockerComposeYaml}</code></pre>
                </div>

                <div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs font-medium uppercase tracking-wide text-slate-400">{$_('netdata.ezngfw_streaming_config')}</p>
                    <Button
                      variant="ghost"
                      class="h-7 cursor-pointer gap-1.5 px-2 text-xs text-slate-400 hover:text-cyan-300"
                      onclick={() => copyToClipboard(streamConfigSnippet, 'env')}
                    >
                      <Copy class="h-3 w-3" />
                      {copiedEnv ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <pre class="mt-1 overflow-auto rounded-md border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300"><code>{streamConfigSnippet}</code></pre>
                </div>

                <div class="rounded-md border border-amber-700/40 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-200/80">
                  <strong>Tip:</strong> The Docker Compose above uses <code class="rounded bg-slate-800 px-1 py-0.5 text-amber-300">network_mode: host</code> for full system visibility.
                  All settings (port, history, memory mode, update interval) are pre-filled from your current configuration.
                  Change the <code class="rounded bg-slate-800 px-1 py-0.5 text-amber-300">STREAM_API_KEY</code> environment variable to a unique UUID for production use.
                </div>
              </div>
            {/if}
          </div>
        {:else if settings.integration_mode === 'disabled'}
          <p class="mt-3 rounded-md border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
            Netdata dashboard access is disabled. Metrics collection settings can still be edited below.
          </p>
        {/if}
      </div>

      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('netdata.service_status')}</p>
          {#if String(status.state) === 'Running'}
            <p class="mt-1 text-sm font-medium text-emerald-400">{$_('netdata.running')}</p>
          {:else if String(status.state) === 'NotInstalled'}
            <p class="mt-1 text-sm font-medium text-red-400">{$_('netdata.not_installed')}</p>
          {:else if String(status.state) === 'Error'}
            <p class="mt-1 text-sm font-medium text-red-400">{$_('netdata.error')}</p>
          {:else}
            <p class="mt-1 text-sm font-medium text-amber-400">{$_('netdata.stopped')}</p>
          {/if}
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('netdata.version')}</p>
          <p class="mt-1 text-sm text-slate-200">{String(status.version || '-')}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('netdata.collectors_enabled')}</p>
          <p class="mt-1 text-sm text-cyan-300">{collectorCount} / 4</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('netdata.dashboard_url')}</p>
          <p class="mt-1 truncate text-sm text-slate-200">{dashboardUrl}</p>
        </div>
      </div>

      {#if status.error_message || status.install_hint}
        <div class="rounded-md border px-4 py-3 text-sm {String(status.state) === 'NotInstalled' ? 'border-red-700/50 bg-red-950/30 text-red-200' : 'border-amber-700/50 bg-amber-950/30 text-amber-200'}">
          {#if status.error_message}
            <p class="font-medium">{String(status.error_message)}</p>
          {/if}
          {#if status.install_hint}
            <p class="mt-1 text-xs opacity-80">{String(status.install_hint)}</p>
          {/if}
        </div>
      {/if}

      <div class="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-2">
            <FieldLabel label="Enable Netdata" hint={hints.enabled} />
            <p class="text-xs text-slate-400">{$_('netdata.core_service_power_switch_for_local_metric_collect')}</p>
          </div>
          <div class="flex items-center gap-3">
            <Switch checked={settings.enabled} onCheckedChange={(value) => (settings.enabled = value)} />
            <span class="text-xs" class:text-emerald-400={settings.enabled} class:text-slate-500={!settings.enabled}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel label="Dashboard URL" hint={hints.dashboardUrl} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" value={dashboardUrl} readonly />
        </div>
        <div>
          <FieldLabel label="Web bind address" hint={hints.web_bind} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.web_bind} placeholder="0.0.0.0" />
        </div>
        <div>
          <FieldLabel label="Web port" hint={hints.web_port} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.web_port} min="1" max="65535" />
        </div>
        <div>
          <FieldLabel label="Update interval (seconds)" hint={hints.scrape_interval_seconds} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.scrape_interval_seconds} min="1" />
        </div>
        <div>
          <FieldLabel label="History retention (seconds)" hint={hints.history_seconds} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.history_seconds} min="60" />
        </div>
        <div>
          <FieldLabel label="Memory mode" hint={hints.memory_mode} />
          <Select.Root type="single" value={settings.memory_mode} onValueChange={(value) => value && (settings.memory_mode = value)}>
          <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
            <span>{memoryModes.find(o => o.value === settings.memory_mode)?.label ?? settings.memory_mode}</span>
          </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each memoryModes as mode}
                <Select.Item value={mode.value} label={mode.label} class="text-slate-200 hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showCollectors = !showCollectors)}>
          <span>{$_('netdata.collectors_and_plugins')}</span>
          {#if showCollectors}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showCollectors}
          <div class="space-y-4 border-t border-slate-700 px-4 py-4">
            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between">
                  <FieldLabel label="eBPF plugin" hint={hints.ebpf_plugin} />
                  <Switch checked={settings.ebpf_plugin} onCheckedChange={(value) => (settings.ebpf_plugin = value)} />
                </div>
              </div>
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between">
                  <FieldLabel label="apps plugin" hint={hints.apps_plugin} />
                  <Switch checked={settings.apps_plugin} onCheckedChange={(value) => (settings.apps_plugin = value)} />
                </div>
              </div>
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between">
                  <FieldLabel label="proc plugin" hint={hints.proc_plugin} />
                  <Switch checked={settings.proc_plugin} onCheckedChange={(value) => (settings.proc_plugin = value)} />
                </div>
              </div>
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between">
                  <FieldLabel label="charts plugin" hint={hints.charts_plugin} />
                  <Switch checked={settings.charts_plugin} onCheckedChange={(value) => (settings.charts_plugin = value)} />
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showStreaming = !showStreaming)}>
          <span>{$_('netdata.streaming_configuration')}</span>
          {#if showStreaming}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showStreaming}
          <div class="space-y-4 border-t border-slate-700 px-4 py-4">
            <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div class="flex items-center justify-between">
                <FieldLabel label="Enable streaming" hint={hints.stream_enabled} />
                <Switch checked={settings.streaming.enabled} onCheckedChange={(value) => (settings.streaming.enabled = value)} />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="Node role" hint={hints.stream_role} />
                <Select.Root type="single" value={settings.streaming.role} onValueChange={(value) => value && (settings.streaming.role = value)}>
                <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
                  <span>{streamRoles.find(o => o.value === settings.streaming.role)?.label ?? settings.streaming.role}</span>
                </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each streamRoles as role}
                      <Select.Item value={role.value} label={role.label} class="text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <FieldLabel label="Destination host:port" hint={hints.stream_destination} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.streaming.destination} placeholder="netdata-parent.example.net:19999" />
              </div>
              <div>
                <FieldLabel label="Streaming API key" hint={hints.stream_api_key} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="password" bind:value={settings.streaming.api_key} placeholder="cluster-secret" />
              </div>
              <div>
                <FieldLabel label="Buffer size (bytes)" hint={hints.stream_buffer_size} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.streaming.buffer_size} min="1024" />
              </div>
              <div>
                <FieldLabel label="Reconnect interval (seconds)" hint={hints.stream_reconnect_seconds} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.streaming.reconnect_seconds} min="1" />
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showHealth = !showHealth)}>
          <span>{$_('netdata.health_and_alarms')}</span>
          {#if showHealth}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showHealth}
          <div class="space-y-4 border-t border-slate-700 px-4 py-4">
            <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div class="flex items-center justify-between">
                <FieldLabel label="Enable health engine" hint={hints.health_enabled} />
                <Switch checked={settings.health.enabled} onCheckedChange={(value) => (settings.health.enabled = value)} />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="Default recipient" hint={hints.health_default_recipient} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.health.default_recipient} placeholder="sysadmin" />
              </div>
              <div>
                <FieldLabel label="Alarm check interval (seconds)" hint={hints.health_alarm_check_interval} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.health.alarm_check_interval} min="1" />
              </div>
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3 md:col-span-2">
                <div class="flex items-center justify-between">
                  <FieldLabel label="Log alarms" hint={hints.health_log_alarms} />
                  <Switch checked={settings.health.log_alarms} onCheckedChange={(value) => (settings.health.log_alarms = value)} />
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showAdvanced = !showAdvanced)}>
          <span>{$_('netdata.advanced_web_and_runtime_controls')}</span>
          {#if showAdvanced}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showAdvanced}
          <div class="space-y-4 border-t border-slate-700 px-4 py-4">
            <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div class="flex items-center justify-between">
                <FieldLabel label="Enable SSL/TLS" hint={hints.ssl_enabled} />
                <Switch checked={settings.ssl_enabled} onCheckedChange={(value) => (settings.ssl_enabled = value)} />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="SSL certificate path" hint={hints.ssl_certificate} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.ssl_certificate} placeholder="/etc/ssl/certs/netdata.pem" />
              </div>
              <div>
                <FieldLabel label="SSL private key path" hint={hints.ssl_key} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.ssl_key} placeholder="/etc/ssl/private/netdata.key" />
              </div>
              <div class="md:col-span-2">
                <FieldLabel label="Allowed origins" hint={hints.allowed_origins} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.allowed_origins} placeholder="https://noc.example.net,https://grafana.example.net" />
              </div>
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between">
                  <FieldLabel label="Debug logging" hint={hints.debug_logging} />
                  <Switch checked={settings.debug_logging} onCheckedChange={(value) => (settings.debug_logging = value)} />
                </div>
              </div>
              <div>
                <FieldLabel label="OOM score adjust" hint={hints.oom_score_adj} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.oom_score_adj} min="-1000" max="1000" />
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="space-y-3 rounded-lg border border-slate-700 p-4">
        <div class="flex items-center gap-2 text-cyan-300">
          <Info class="h-4 w-4" />
          <FieldLabel label="Custom dashboard shortcuts" hint={hints.custom_dashboards} />
        </div>
        <div class="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={newDashboardUrl} placeholder="https://noc.example.net/netdata?host=edge-01" />
          <Button variant="outline" class="border-cyan-700 text-cyan-300 hover:bg-slate-800" onclick={addDashboardUrl}>
            <Plus class="mr-1.5 h-3.5 w-3.5" />
            Add URL
          </Button>
        </div>
        <div class="space-y-2">
          {#if settings.custom_dashboards.length === 0}
            <p class="rounded-md border border-dashed border-slate-700 px-3 py-3 text-sm text-slate-500">{$_('netdata.no_custom_dashboard_shortcuts_configured')}</p>
          {:else}
            {#each settings.custom_dashboards as item, index (index)}
              <div class="grid gap-2 rounded-md border border-slate-700 bg-slate-900/50 p-3 md:grid-cols-[1fr_auto]">
                <Input class="border-slate-700 bg-slate-950 text-slate-200" value={item} oninput={(event) => (settings.custom_dashboards[index] = (event.currentTarget as HTMLInputElement).value)} />
                <Button variant="outline" class="border-red-700 text-red-300 hover:bg-slate-800" onclick={() => removeDashboardUrl(index)}>
                  <Trash2 class="mr-1.5 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="flex justify-end">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={loading || saving}>
          <Save class="mr-1.5 h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Netdata Settings'}
        </Button>
      </div>
    </CardContent>
  </Card>

  {#if settings.integration_mode === 'integrated' && netdataInstalled}
    <Card class="border-slate-700 bg-slate-950/70">
      <CardHeader>
        <CardTitle class="text-slate-100">{$_('netdata.integrated_netdata_dashboard')}</CardTitle>
        <CardDescription class="text-slate-400">
          Embedded dashboard is served through the ezNGFW reverse proxy and authorization layer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
          <iframe
            title="Netdata Dashboard"
            src="/api/netdata/proxy/"
            class="h-[70vh] w-full"
            loading="lazy"
          ></iframe>
        </div>
      </CardContent>
    </Card>
  {/if}
</div>
