<!-- Route view for `/monitoring` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asList, asObject } from '$lib/utils/api-data';
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

  import { _ } from '$lib/i18n';
  type SnmpConfig = {
    enabled: boolean;
    version: string;
    community: string;
    sys_contact: string;
    sys_location: string;
    listen_address: string;
    allowed_networks: string;
    v3_auth_protocol: string;
    v3_auth_passphrase: string;
    v3_priv_protocol: string;
    v3_priv_passphrase: string;
    v3_username: string;
  };

  type AlertThresholds = {
    cpu_warning: number;
    cpu_critical: number;
    memory_warning: number;
    memory_critical: number;
    disk_warning: number;
    disk_critical: number;
    bandwidth_warning: number;
    bandwidth_critical: number;
    temperature_warning: number;
    temperature_critical: number;
  };

  type AlertNotifications = {
    email_enabled: boolean;
    smtp_server: string;
    smtp_port: number;
    smtp_tls: boolean;
    smtp_username: string;
    smtp_password: string;
    from_address: string;
    to_addresses: string;
    repeat_interval_seconds: number;
  };

  type FlowCollectorConfig = {
    enabled: boolean;
    protocol: string;
    listen_address: string;
    capture_interfaces: string[];
    active_timeout: number;
    inactive_timeout: number;
    export_destination: string;
  };

  type MonitoringConfig = {
    prometheus_enabled: boolean;
    metrics_bind: string;
    dashboard_enabled: boolean;
    refresh_interval: number;
    retention_hours: number;
    interface_graphing: boolean;
    grafana_url: string;
    syslog_integration: boolean;
    health_check_urls: string[];
    snmp: SnmpConfig;
    alert_thresholds: AlertThresholds;
    notifications: AlertNotifications;
    flow_collector: FlowCollectorConfig;
  };

  const defaults: MonitoringConfig = {
    prometheus_enabled: true,
    metrics_bind: '0.0.0.0:9090',
    dashboard_enabled: true,
    refresh_interval: 10,
    retention_hours: 168,
    interface_graphing: true,
    grafana_url: '',
    syslog_integration: true,
    health_check_urls: [],
    snmp: {
      enabled: false,
      version: 'v2c',
      community: 'public',
      sys_contact: 'noc@example.net',
      sys_location: 'Datacenter A / Rack 4',
      listen_address: '0.0.0.0:161',
      allowed_networks: '10.0.0.0/8,192.168.0.0/16',
      v3_auth_protocol: 'SHA',
      v3_auth_passphrase: '',
      v3_priv_protocol: 'AES',
      v3_priv_passphrase: '',
      v3_username: 'snmpadmin'
    },
    alert_thresholds: {
      cpu_warning: 80,
      cpu_critical: 95,
      memory_warning: 80,
      memory_critical: 95,
      disk_warning: 80,
      disk_critical: 95,
      bandwidth_warning: 80,
      bandwidth_critical: 95,
      temperature_warning: 70,
      temperature_critical: 85
    },
    notifications: {
      email_enabled: false,
      smtp_server: '',
      smtp_port: 587,
      smtp_tls: true,
      smtp_username: '',
      smtp_password: '',
      from_address: 'alerts@example.net',
      to_addresses: 'noc@example.net',
      repeat_interval_seconds: 900
    },
    flow_collector: {
      enabled: false,
      protocol: 'ipfix',
      listen_address: '0.0.0.0:2055',
      capture_interfaces: [],
      active_timeout: 60,
      inactive_timeout: 15,
      export_destination: ''
    }
  };

  let settings = $state<MonitoringConfig>({
    ...defaults,
    health_check_urls: [],
    snmp: { ...defaults.snmp },
    alert_thresholds: { ...defaults.alert_thresholds },
    notifications: { ...defaults.notifications },
    flow_collector: { ...defaults.flow_collector, capture_interfaces: [] }
  });

  let loading = $state(true);
  let saving = $state(false);
  let showSnmp = $state(false);
  let showAlerts = $state(true);
  let showNotifications = $state(false);
  let showFlowCollector = $state(false);
  let showHealthChecks = $state(true);

  let newHealthCheck = $state('');
  let newCaptureInterface = $state('');
  let interfaceOptions = $state<{ label: string; value: string }[]>([]);

  const snmpVersionOptions = ['v2c', 'v3'];
  const snmpAuthOptions = ['MD5', 'SHA', 'SHA-256'];
  const snmpPrivOptions = ['DES', 'AES', 'AES-256'];
  const flowProtocolOptions = ['netflow-v5', 'netflow-v9', 'ipfix', 'sflow'];

  const hints = {
    dashboard_enabled:
      'Dashboard enabled controls whether the built-in monitoring UI surfaces are available for operators. Disable only when using a fully external observability stack to reduce local attack surface. Example: enabled for local NOC workflows, and disable when all teams use centralized Grafana only.',
    refresh_interval:
      'Refresh interval determines how often dashboard widgets and charts request fresh telemetry from backend APIs. Short intervals improve responsiveness during incidents but increase client and API load. Example: 10 seconds for operations screens, and increase to 30 seconds for wallboard displays.',
    retention_hours:
      'Retention period controls how long local monitoring data is retained before pruning. Increase this for forensic trend analysis, but account for storage and memory impact on appliance hardware. Example: 168 hours for one week, and extend to 720 hours for monthly review requirements.',
    interface_graphing:
      'Per-interface graphing enables bandwidth chart generation for individual links instead of only global metrics. Keep enabled for troubleshooting asymmetric throughput and noisy interface issues. Example: enabled on multi-WAN deployments, and disable on ultra-minimal embedded builds.',
    prometheus_enabled:
      'Prometheus export exposes metrics endpoint data for pull-based monitoring integrations and long-term TSDB storage. Enable when you run Prometheus-compatible collectors and alerts outside the appliance. Example: enabled in Kubernetes-backed observability, and disable when no scraper exists.',
    metrics_bind:
      'Metrics bind address defines where the Prometheus endpoint listens and who can reach it. Restrict this endpoint to management networks or localhost if scraping through secure tunnels. Example: 10.20.0.1:9090, and change when management plane topology is updated.',
    grafana_url:
      'Grafana URL links this page to your external visualization platform for deep dashboards and drill-down context. Keep it accurate so operators can jump from local alarms to rich panels immediately. Example: https://grafana.example.net/d/edge-overview, and update after dashboard migration.',
    syslog_integration:
      'Syslog integration forwards monitoring events and notable threshold transitions to your centralized log pipeline. Enable it for auditability and SIEM correlation across network and security events. Example: enabled with rsyslog relay, and disable only in air-gapped lab scenarios.',
    health_check_urls:
      'Health check endpoints are URLs that monitoring probes periodically to verify service readiness and reachability. Use fast, deterministic endpoints that return simple success responses to avoid false alarms. Example: https://api.example.net/healthz, and update whenever service endpoints change.',
    snmp_enabled:
      'SNMP agent toggle enables legacy NMS integrations that rely on polling OIDs for interface and system state. Turn it on only for trusted management networks and pair with strict ACLs or SNMPv3 credentials. Example: enabled for enterprise NMS, and disable if SNMP is not used.',
    snmp_version:
      'SNMP version chooses between v2c simplicity and v3 secure authentication/privacy controls. Prefer v3 in production for credential and payload protection over untrusted links. Example: v3 for modern deployments, and keep v2c only for legacy tools that cannot be upgraded.',
    snmp_community:
      'Community string is the shared secret for SNMPv2c query authorization and should never stay default in production. Use unique random strings and rotate when team membership or exposure risk changes. Example: corp-observe-ro-2026, and rotate after audits.',
    snmp_contact:
      'System contact populates standard SNMP metadata so operators know which team owns the device. Keep it current to reduce incident escalation delays during after-hours outages. Example: noc@example.net, and update whenever ownership transfers.',
    snmp_location:
      'System location helps identify physical or logical placement of the appliance in maps and inventory tools. Include enough detail for dispatch and troubleshooting without exposing sensitive coordinates publicly. Example: DC-A / Rack-04 / U16, and change after hardware relocation.',
    snmp_listen:
      'SNMP listen address determines binding scope for UDP 161 and should be restricted to management interfaces where possible. Broad binds simplify setup but increase exposure to unsolicited scans. Example: 10.20.0.1:161, and change after management VLAN re-addressing.',
    snmp_allowed_networks:
      'Allowed networks enforce CIDR-based access control for SNMP polling clients. Keep this list tight to NMS collectors and remove stale entries after network changes. Example: 10.30.0.0/24,10.31.0.0/24, and update after NMS migration.',
    snmp_v3_auth_protocol:
      'SNMPv3 auth protocol controls digest strength for user authentication in secure polling sessions. Prefer stronger options supported by your NMS to reduce credential replay risk. Example: SHA-256 where supported, and downgrade only for compatibility.',
    snmp_v3_auth_passphrase:
      'SNMPv3 auth passphrase secures user authentication and should meet your credential entropy policy. Rotate periodically and avoid sharing across environments to limit blast radius. Example: long random phrase with symbols, and rotate after staff turnover.',
    snmp_v3_priv_protocol:
      'SNMPv3 privacy protocol defines encryption method for sensitive payloads in transit. Use AES variants when supported to avoid weaker legacy ciphers. Example: AES for baseline, and AES-256 for stricter policy domains.',
    snmp_v3_priv_passphrase:
      'SNMPv3 privacy passphrase protects encrypted payload access and should differ from auth passphrase. Keep it in secure secret stores and rotate with standard credential hygiene practices. Example: unique random passphrase, and rotate after compliance reviews.',
    snmp_v3_username:
      'SNMPv3 username identifies polling principal and should map to role-based monitoring ownership. Use distinct users per environment for clearer audit trails and revocation control. Example: snmp-noc-prod, and change when team ownership changes.',
    alert_thresholds:
      'Alert thresholds set warning and critical trigger points for core resource metrics and link utilization. Keep warning below critical with enough gap to act before service impact. Example: CPU warning 80 and critical 95, and tune after baseline performance studies.',
    notifications_enabled:
      'Email notifications switch controls whether alert transitions generate outbound SMTP messages. Enable for environments where email is a primary incident channel, and disable when handled exclusively by webhooks/SIEM. Example: enabled for branch sites without chatops, and disable for central automation-only setups.',
    smtp_server:
      'SMTP server hostname routes alert email through your approved relay infrastructure. Use resilient relay endpoints to prevent alert delivery failures during partial outages. Example: smtp-relay.example.net, and update after mail platform migration.',
    smtp_port:
      'SMTP port configures transport endpoint and should match relay TLS/auth policies. Common values are 25 for internal relay, 465 for implicit TLS, and 587 for STARTTLS. Example: 587 for authenticated submission, and change when relay hardening policy changes.',
    smtp_tls:
      'SMTP TLS enforces encrypted transport for alert messages and credentials between appliance and relay. Keep enabled unless using isolated internal relays with explicit exception policy. Example: enabled for internet-routed relays, and disable only in controlled private enclaves.',
    smtp_username:
      'SMTP username identifies the account used for relay authentication when required. Use dedicated service accounts rather than personal credentials for better lifecycle control. Example: ezngfw-alerts, and rotate or replace during IAM policy updates.',
    smtp_password:
      'SMTP password authenticates the relay account and should be stored securely with restricted visibility. Rotate on schedule and immediately after suspected exposure. Example: generated app password token, and refresh during incident response.',
    from_address:
      'From address appears as sender identity for alert emails and should align with approved domains and DMARC policy. Use a recognizable mailbox so responders trust and route alerts correctly. Example: alerts@network.example.net, and update after domain policy changes.',
    to_addresses:
      'Recipient addresses determine who receives monitoring notifications and can include team aliases for redundancy. Prefer distribution lists over individuals to avoid missed alerts during absences. Example: noc@example.net,secops@example.net, and revise with on-call rotation changes.',
    repeat_interval_seconds:
      'Repeat interval prevents alert storms by spacing repeated notifications for persistent conditions. Balance noise reduction with awareness needs so long incidents still remain visible. Example: 900 seconds for 15-minute reminders, and shorten for high-criticality services.',
    flow_enabled:
      'Flow collector toggle enables NetFlow/sFlow/IPFIX ingestion for traffic analytics and capacity planning. Turn it on when exporting or collecting flow metadata is part of your visibility strategy. Example: enabled for WAN behavior baselining, and disable if collector is external only.',
    flow_protocol:
      'Flow protocol selects packet metadata format expected from exporters and collectors. Match this to the capabilities of your network devices and downstream analytics platform. Example: ipfix for modern flexible fields, and switch to netflow-v9 for legacy interoperability.',
    flow_listen:
      'Flow listen address configures UDP endpoint receiving flow records and should bind to an interface reachable by exporters. Restrict exposure with firewall policy if listening broadly. Example: 10.20.0.1:2055, and change after exporter network redesign.',
    flow_capture_interfaces:
      'Capture interface list filters which local interfaces contribute to internally generated flow records. Keep list focused on transit interfaces to reduce noise from management segments. Example: wan0,lan0, and update when adding VLAN trunks.',
    flow_active_timeout:
      'Active timeout forces periodic export of long-lived flows to keep dashboards and anomaly detection current. Lower values increase update frequency at cost of additional flow volume. Example: 60 seconds for near-real-time visibility, and increase for low-bandwidth links.',
    flow_inactive_timeout:
      'Inactive timeout defines when idle flows are exported and expired from collector state. Tune this to balance timely closure visibility against churn in bursty microflow environments. Example: 15 seconds for interactive traffic, and raise for sparse telemetry environments.',
    flow_export_destination:
      'Export destination forwards collected flow records to external analytics platforms or SIEM pipelines. Ensure reachability and protocol compatibility before enabling to avoid silent drop behavior. Example: flow-core.example.net:2055, and update after collector failover changes.'
  };

  const totalHealthChecks = $derived.by(() => settings.health_check_urls.length);
  const totalFlowInterfaces = $derived.by(() => settings.flow_collector.capture_interfaces.length);

  function normalize(input: Record<string, unknown>): MonitoringConfig {
    const snmp = asObject(input.snmp ?? {});
    const thresholds = asObject(input.alert_thresholds ?? {});
    const notifications = asObject(input.notifications ?? {});
    const flow = asObject(input.flow_collector ?? {});

    return {
      prometheus_enabled: Boolean(input.prometheus_enabled),
      metrics_bind: String(input.metrics_bind ?? defaults.metrics_bind),
      dashboard_enabled: Boolean(input.dashboard_enabled),
      refresh_interval: Number(input.refresh_interval ?? defaults.refresh_interval),
      retention_hours: Number(input.retention_hours ?? defaults.retention_hours),
      interface_graphing: Boolean(input.interface_graphing),
      grafana_url: String(input.grafana_url ?? ''),
      syslog_integration: Boolean(input.syslog_integration),
      health_check_urls: asList(input.health_check_urls).map((item) => String(item)).filter(Boolean),
      snmp: {
        enabled: Boolean(snmp.enabled),
        version: String(snmp.version ?? defaults.snmp.version),
        community: String(snmp.community ?? defaults.snmp.community),
        sys_contact: String(snmp.sys_contact ?? defaults.snmp.sys_contact),
        sys_location: String(snmp.sys_location ?? defaults.snmp.sys_location),
        listen_address: String(snmp.listen_address ?? defaults.snmp.listen_address),
        allowed_networks: String(snmp.allowed_networks ?? defaults.snmp.allowed_networks),
        v3_auth_protocol: String(snmp.v3_auth_protocol ?? defaults.snmp.v3_auth_protocol),
        v3_auth_passphrase: String(snmp.v3_auth_passphrase ?? ''),
        v3_priv_protocol: String(snmp.v3_priv_protocol ?? defaults.snmp.v3_priv_protocol),
        v3_priv_passphrase: String(snmp.v3_priv_passphrase ?? ''),
        v3_username: String(snmp.v3_username ?? defaults.snmp.v3_username)
      },
      alert_thresholds: {
        cpu_warning: Number(thresholds.cpu_warning ?? defaults.alert_thresholds.cpu_warning),
        cpu_critical: Number(thresholds.cpu_critical ?? defaults.alert_thresholds.cpu_critical),
        memory_warning: Number(thresholds.memory_warning ?? defaults.alert_thresholds.memory_warning),
        memory_critical: Number(thresholds.memory_critical ?? defaults.alert_thresholds.memory_critical),
        disk_warning: Number(thresholds.disk_warning ?? defaults.alert_thresholds.disk_warning),
        disk_critical: Number(thresholds.disk_critical ?? defaults.alert_thresholds.disk_critical),
        bandwidth_warning: Number(thresholds.bandwidth_warning ?? defaults.alert_thresholds.bandwidth_warning),
        bandwidth_critical: Number(thresholds.bandwidth_critical ?? defaults.alert_thresholds.bandwidth_critical),
        temperature_warning: Number(thresholds.temperature_warning ?? defaults.alert_thresholds.temperature_warning),
        temperature_critical: Number(thresholds.temperature_critical ?? defaults.alert_thresholds.temperature_critical)
      },
      notifications: {
        email_enabled: Boolean(notifications.email_enabled),
        smtp_server: String(notifications.smtp_server ?? ''),
        smtp_port: Number(notifications.smtp_port ?? defaults.notifications.smtp_port),
        smtp_tls: Boolean(notifications.smtp_tls),
        smtp_username: String(notifications.smtp_username ?? ''),
        smtp_password: String(notifications.smtp_password ?? ''),
        from_address: String(notifications.from_address ?? defaults.notifications.from_address),
        to_addresses: String(notifications.to_addresses ?? defaults.notifications.to_addresses),
        repeat_interval_seconds: Number(notifications.repeat_interval_seconds ?? defaults.notifications.repeat_interval_seconds)
      },
      flow_collector: {
        enabled: Boolean(flow.enabled),
        protocol: String(flow.protocol ?? defaults.flow_collector.protocol),
        listen_address: String(flow.listen_address ?? defaults.flow_collector.listen_address),
        capture_interfaces: asList(flow.capture_interfaces).map((item) => String(item)).filter(Boolean),
        active_timeout: Number(flow.active_timeout ?? defaults.flow_collector.active_timeout),
        inactive_timeout: Number(flow.inactive_timeout ?? defaults.flow_collector.inactive_timeout),
        export_destination: String(flow.export_destination ?? '')
      }
    };
  }

  async function loadSettings() {
    loading = true;
    try {
      const payload = asObject(await api.get('/monitoring'));
      settings = normalize(payload);
      showSnmp = settings.snmp.enabled;
      showAlerts = true;
      showNotifications = settings.notifications.email_enabled;
      showFlowCollector = settings.flow_collector.enabled;
      showHealthChecks = true;
    } catch (e) {
      settings = {
        ...defaults,
        health_check_urls: [],
        snmp: { ...defaults.snmp },
        alert_thresholds: { ...defaults.alert_thresholds },
        notifications: { ...defaults.notifications },
        flow_collector: { ...defaults.flow_collector, capture_interfaces: [] }
      };
      toasts.error(e instanceof Error ? e.message : 'Failed to load monitoring settings');
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.patch('/monitoring', settings);
      toasts.success($_('monitoring.toast_monitoring_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save monitoring settings');
    } finally {
      saving = false;
    }
  }

  function addHealthCheck() {
    const candidate = newHealthCheck.trim();
    if (!candidate) return;
    settings.health_check_urls = [...settings.health_check_urls, candidate];
    newHealthCheck = '';
  }

  function removeHealthCheck(index: number) {
    settings.health_check_urls = settings.health_check_urls.filter((_, idx) => idx !== index);
  }

  function addCaptureInterface() {
    const candidate = newCaptureInterface.trim();
    if (!candidate) return;
    settings.flow_collector.capture_interfaces = [...settings.flow_collector.capture_interfaces, candidate];
    newCaptureInterface = '';
  }

  function removeCaptureInterface(index: number) {
    settings.flow_collector.capture_interfaces = settings.flow_collector.capture_interfaces.filter((_, idx) => idx !== index);
  }

  async function loadInterfaces() {
    try {
      const data = await api.get<Record<string, any>>('/interfaces');
      const entries = Array.isArray(data) ? data : Object.entries(data).map(([k, v]: [string, any]) => ({ name: k, ...v }));
      interfaceOptions = entries.map((iface: any) => ({ label: iface.name || iface.description || String(iface), value: iface.name || String(iface) }));
    } catch { interfaceOptions = []; }
  }

  onMount(() => {
    loadSettings();
    void loadInterfaces();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-700 bg-slate-950/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('monitoring.monitoring_and_alerting_fabric')}</CardTitle>
          <CardDescription class="text-slate-400">
            Deep observability controls for dashboard behavior, SNMP, thresholds, notifications, and flow telemetry.
          </CardDescription>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" class="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onclick={loadSettings} disabled={loading}>
            <RefreshCw class="mr-1.5 h-3.5 w-3.5" />
            Reload
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={saving || loading}>
            <Save class="mr-1.5 h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3"><p class="text-xs uppercase tracking-wide text-slate-400">{$_('monitoring.dashboard')}</p><p class="mt-1 text-sm" class:text-emerald-400={settings.dashboard_enabled} class:text-amber-300={!settings.dashboard_enabled}>{settings.dashboard_enabled ? 'Enabled' : 'Disabled'}</p></div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3"><p class="text-xs uppercase tracking-wide text-slate-400">{$_('monitoring.prometheus')}</p><p class="mt-1 text-sm" class:text-emerald-400={settings.prometheus_enabled} class:text-amber-300={!settings.prometheus_enabled}>{settings.prometheus_enabled ? 'Exporting' : 'Off'}</p></div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3"><p class="text-xs uppercase tracking-wide text-slate-400">{$_('monitoring.health_checks')}</p><p class="mt-1 text-sm text-cyan-300">{totalHealthChecks}</p></div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3"><p class="text-xs uppercase tracking-wide text-slate-400">{$_('monitoring.flow_interfaces')}</p><p class="mt-1 text-sm text-cyan-300">{totalFlowInterfaces}</p></div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
          <div class="flex items-center justify-between">
            <FieldLabel label="Enable dashboard widgets" hint={hints.dashboard_enabled} />
            <Switch checked={settings.dashboard_enabled} onCheckedChange={(value) => (settings.dashboard_enabled = value)} />
          </div>
        </div>
        <div>
          <FieldLabel label="Refresh interval (seconds)" hint={hints.refresh_interval} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" min="1" bind:value={settings.refresh_interval} />
        </div>
        <div>
          <FieldLabel label="Retention period (hours)" hint={hints.retention_hours} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" min="1" bind:value={settings.retention_hours} />
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
          <div class="flex items-center justify-between">
            <FieldLabel label="Per-interface bandwidth graphs" hint={hints.interface_graphing} />
            <Switch checked={settings.interface_graphing} onCheckedChange={(value) => (settings.interface_graphing = value)} />
          </div>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
          <div class="flex items-center justify-between">
            <FieldLabel label="Prometheus export" hint={hints.prometheus_enabled} />
            <Switch checked={settings.prometheus_enabled} onCheckedChange={(value) => (settings.prometheus_enabled = value)} />
          </div>
        </div>
        <div>
          <FieldLabel label="Prometheus bind address" hint={hints.metrics_bind} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.metrics_bind} placeholder="0.0.0.0:9090" />
        </div>
        <div>
          <FieldLabel label="Grafana integration URL" hint={hints.grafana_url} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.grafana_url} placeholder="https://grafana.example.net/d/firewall" />
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
          <div class="flex items-center justify-between">
            <FieldLabel label="Syslog integration" hint={hints.syslog_integration} />
            <Switch checked={settings.syslog_integration} onCheckedChange={(value) => (settings.syslog_integration = value)} />
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showHealthChecks = !showHealthChecks)}>
          <span>Health check endpoints (inline CRUD)</span>
          {#if showHealthChecks}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showHealthChecks}
          <div class="space-y-3 border-t border-slate-700 p-4">
            <div class="flex items-center gap-2 text-cyan-300">
              <Info class="h-4 w-4" />
              <FieldLabel label="Health endpoint list" hint={hints.health_check_urls} />
            </div>
            <div class="grid gap-2 md:grid-cols-[1fr_auto]">
              <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={newHealthCheck} placeholder="https://service.example.net/healthz" />
              <Button variant="outline" class="border-cyan-700 text-cyan-300 hover:bg-slate-800" onclick={addHealthCheck}>
                <Plus class="mr-1.5 h-3.5 w-3.5" />
                Add endpoint
              </Button>
            </div>
            <div class="space-y-2">
              {#if settings.health_check_urls.length === 0}
                <p class="rounded-md border border-dashed border-slate-700 px-3 py-3 text-sm text-slate-500">{$_('monitoring.no_health_checks_configured')}</p>
              {:else}
                {#each settings.health_check_urls as url, index (url + index)}
                  <div class="grid gap-2 rounded-md border border-slate-700 bg-slate-900/40 p-3 md:grid-cols-[1fr_auto]">
                    <Input class="border-slate-700 bg-slate-950 text-slate-200" value={url} oninput={(event) => (settings.health_check_urls[index] = (event.currentTarget as HTMLInputElement).value)} />
                    <Button variant="outline" class="border-red-700 text-red-300 hover:bg-slate-800" onclick={() => removeHealthCheck(index)}>
                      <Trash2 class="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showSnmp = !showSnmp)}>
          <span>SNMP configuration</span>
          {#if showSnmp}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showSnmp}
          <div class="space-y-4 border-t border-slate-700 p-4">
            <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div class="flex items-center justify-between">
                <FieldLabel label="Enable SNMP" hint={hints.snmp_enabled} />
                <Switch checked={settings.snmp.enabled} onCheckedChange={(value) => (settings.snmp.enabled = value)} />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="SNMP version" hint={hints.snmp_version} />
                <Select.Root type="single" value={settings.snmp.version} onValueChange={(value) => value && (settings.snmp.version = value)}>
                <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
                  <span>{snmpVersionOptions.find(o => o === settings.snmp.version) ?? settings.snmp.version}</span>
                </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each snmpVersionOptions as option}
                      <Select.Item value={option} label={option} class="text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <FieldLabel label="Community string" hint={hints.snmp_community} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.snmp.community} />
              </div>
              <div>
                <FieldLabel label="System contact" hint={hints.snmp_contact} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.snmp.sys_contact} />
              </div>
              <div>
                <FieldLabel label="System location" hint={hints.snmp_location} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.snmp.sys_location} />
              </div>
              <div>
                <FieldLabel label="Listen address" hint={hints.snmp_listen} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.snmp.listen_address} />
              </div>
              <div>
                <FieldLabel label="Allowed networks" hint={hints.snmp_allowed_networks} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.snmp.allowed_networks} />
              </div>
              <div>
                <FieldLabel label="SNMPv3 username" hint={hints.snmp_v3_username} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.snmp.v3_username} />
              </div>
              <div>
                <FieldLabel label="SNMPv3 auth protocol" hint={hints.snmp_v3_auth_protocol} />
                <Select.Root type="single" value={settings.snmp.v3_auth_protocol} onValueChange={(value) => value && (settings.snmp.v3_auth_protocol = value)}>
                <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
                  <span>{snmpAuthOptions.find(o => o === settings.snmp.v3_auth_protocol) ?? settings.snmp.v3_auth_protocol}</span>
                </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each snmpAuthOptions as option}
                      <Select.Item value={option} label={option} class="text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <FieldLabel label="SNMPv3 auth passphrase" hint={hints.snmp_v3_auth_passphrase} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="password" bind:value={settings.snmp.v3_auth_passphrase} />
              </div>
              <div>
                <FieldLabel label="SNMPv3 privacy protocol" hint={hints.snmp_v3_priv_protocol} />
                <Select.Root type="single" value={settings.snmp.v3_priv_protocol} onValueChange={(value) => value && (settings.snmp.v3_priv_protocol = value)}>
                <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
                  <span>{snmpPrivOptions.find(o => o === settings.snmp.v3_priv_protocol) ?? settings.snmp.v3_priv_protocol}</span>
                </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each snmpPrivOptions as option}
                      <Select.Item value={option} label={option} class="text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <FieldLabel label="SNMPv3 privacy passphrase" hint={hints.snmp_v3_priv_passphrase} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="password" bind:value={settings.snmp.v3_priv_passphrase} />
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showAlerts = !showAlerts)}>
          <span>Alert thresholds</span>
          {#if showAlerts}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showAlerts}
          <div class="space-y-4 border-t border-slate-700 p-4">
            <div class="flex items-center gap-2 text-cyan-300"><Info class="h-4 w-4" /><FieldLabel label="Resource threshold matrix" hint={hints.alert_thresholds} /></div>
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div><FieldLabel label="CPU warning" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.cpu_warning} /></div>
              <div><FieldLabel label="CPU critical" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.cpu_critical} /></div>
              <div><FieldLabel label="Memory warning" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.memory_warning} /></div>
              <div><FieldLabel label="Memory critical" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.memory_critical} /></div>
              <div><FieldLabel label="Disk warning" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.disk_warning} /></div>
              <div><FieldLabel label="Disk critical" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.disk_critical} /></div>
              <div><FieldLabel label="Bandwidth warning" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.bandwidth_warning} /></div>
              <div><FieldLabel label="Bandwidth critical" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.bandwidth_critical} /></div>
              <div><FieldLabel label="Temperature warning" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.temperature_warning} /></div>
              <div><FieldLabel label="Temperature critical" hint={hints.alert_thresholds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.alert_thresholds.temperature_critical} /></div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showNotifications = !showNotifications)}>
          <span>Email notifications</span>
          {#if showNotifications}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showNotifications}
          <div class="space-y-4 border-t border-slate-700 p-4">
            <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3"><div class="flex items-center justify-between"><FieldLabel label="Enable email notifications" hint={hints.notifications_enabled} /><Switch checked={settings.notifications.email_enabled} onCheckedChange={(value) => (settings.notifications.email_enabled = value)} /></div></div>
            <div class="grid gap-4 md:grid-cols-3">
              <div><FieldLabel label="SMTP server" hint={hints.smtp_server} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.notifications.smtp_server} /></div>
              <div><FieldLabel label="SMTP port" hint={hints.smtp_port} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.notifications.smtp_port} /></div>
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3"><div class="flex items-center justify-between"><FieldLabel label="SMTP TLS" hint={hints.smtp_tls} /><Switch checked={settings.notifications.smtp_tls} onCheckedChange={(value) => (settings.notifications.smtp_tls = value)} /></div></div>
              <div><FieldLabel label="SMTP username" hint={hints.smtp_username} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.notifications.smtp_username} /></div>
              <div><FieldLabel label="SMTP password" hint={hints.smtp_password} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="password" bind:value={settings.notifications.smtp_password} /></div>
              <div><FieldLabel label="From address" hint={hints.from_address} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.notifications.from_address} /></div>
              <div class="md:col-span-2"><FieldLabel label="Recipient addresses" hint={hints.to_addresses} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.notifications.to_addresses} /></div>
              <div><FieldLabel label="Repeat interval (seconds)" hint={hints.repeat_interval_seconds} /><Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.notifications.repeat_interval_seconds} /></div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showFlowCollector = !showFlowCollector)}>
          <span>NetFlow / sFlow collector</span>
          {#if showFlowCollector}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showFlowCollector}
          <div class="space-y-4 border-t border-slate-700 p-4">
            <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3"><div class="flex items-center justify-between"><FieldLabel label="Enable flow collector" hint={hints.flow_enabled} /><Switch checked={settings.flow_collector.enabled} onCheckedChange={(value) => (settings.flow_collector.enabled = value)} /></div></div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="Flow protocol" hint={hints.flow_protocol} />
                <Select.Root type="single" value={settings.flow_collector.protocol} onValueChange={(value) => value && (settings.flow_collector.protocol = value)}>
                <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
                  <span>{flowProtocolOptions.find(o => o === settings.flow_collector.protocol) ?? settings.flow_collector.protocol}</span>
                </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each flowProtocolOptions as option}
                      <Select.Item value={option} label={option} class="text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <FieldLabel label="Collector listen address" hint={hints.flow_listen} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.flow_collector.listen_address} />
              </div>
              <div>
                <FieldLabel label="Active timeout (seconds)" hint={hints.flow_active_timeout} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.flow_collector.active_timeout} />
              </div>
              <div>
                <FieldLabel label="Inactive timeout (seconds)" hint={hints.flow_inactive_timeout} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={settings.flow_collector.inactive_timeout} />
              </div>
              <div class="md:col-span-2">
                <FieldLabel label="Export destination" hint={hints.flow_export_destination} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.flow_collector.export_destination} placeholder="flow-core.example.net:2055" />
              </div>
            </div>
            <div class="space-y-2 rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div class="flex items-center gap-2 text-cyan-300"><Info class="h-4 w-4" /><FieldLabel label="Capture interfaces (inline CRUD)" hint={hints.flow_capture_interfaces} /></div>
              <div class="grid gap-2 md:grid-cols-[1fr_auto]">
                <select class="cursor-pointer h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" bind:value={newCaptureInterface}>
                  <option value="">— Select Interface —</option>
                  {#each interfaceOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
                <Button variant="outline" class="border-cyan-700 text-cyan-300 hover:bg-slate-800" onclick={addCaptureInterface}><Plus class="mr-1.5 h-3.5 w-3.5" />Add interface</Button>
              </div>
              <div class="space-y-2">
                {#if settings.flow_collector.capture_interfaces.length === 0}
                  <p class="rounded-md border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-500">{$_('monitoring.no_capture_interfaces_configured')}</p>
                {:else}
                  {#each settings.flow_collector.capture_interfaces as iface, index (iface + index)}
                    <div class="grid gap-2 rounded-md border border-slate-700 bg-slate-900/40 p-2 md:grid-cols-[1fr_auto]">
                      <Input class="border-slate-700 bg-slate-950 text-slate-200" value={iface} oninput={(event) => (settings.flow_collector.capture_interfaces[index] = (event.currentTarget as HTMLInputElement).value)} />
                      <Button variant="outline" class="border-red-700 text-red-300 hover:bg-slate-800" onclick={() => removeCaptureInterface(index)}><Trash2 class="mr-1.5 h-3.5 w-3.5" />Remove</Button>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="flex justify-end">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={saving || loading}>
          <Save class="mr-1.5 h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Monitoring Settings'}
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
