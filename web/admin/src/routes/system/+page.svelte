<!-- Route view for `/system` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asObject, asList, asString } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import ReadOnlyTable from '$lib/components/admin/ReadOnlyTable.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Badge } from '$lib/components/ui/badge';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Select from '$lib/components/ui/select';
  import SaveIcon from '@lucide/svelte/icons/save';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import UploadIcon from '@lucide/svelte/icons/upload';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import ServerIcon from '@lucide/svelte/icons/server';
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
  import { setAppLocale } from '$lib/i18n';

  /* ── Types & defaults ─────────────────────────────────── */

  type SystemSettings = {
    hostname: string;
    domain: string;
    timezone: string;
    language: string;
    console: string;
    dnsServers: string;
    ntpServers: string;
    ntpEnabled: boolean;
    sshEnabled: boolean;
    sshPort: number;
    sshPasswordAuth: boolean;
    serialSpeed: string;
    thermalShutdown: boolean;
    thermalThreshold: number;
    webGuiRedirectHttps: boolean;
    webGuiPort: number;
    webGuiListenAddress: string;
    webGuiListenInterfaces: string;
    webGuiCert: string;
  };

  const defaults: SystemSettings = {
    hostname: 'ezngfw',
    domain: 'localdomain',
    timezone: 'UTC',
    language: 'en',
    console: 'serial',
    dnsServers: '1.1.1.1, 8.8.8.8',
    ntpServers: '0.pool.ntp.org, 1.pool.ntp.org',
    ntpEnabled: true,
    sshEnabled: true,
    sshPort: 22,
    sshPasswordAuth: false,
    serialSpeed: '115200',
    thermalShutdown: true,
    thermalThreshold: 85,
    webGuiRedirectHttps: true,
    webGuiPort: 8080,
    webGuiListenAddress: '0.0.0.0',
    webGuiListenInterfaces: '',
    webGuiCert: ''
  };

  let settings = $state<SystemSettings>({ ...defaults });
  let loading = $state(true);
  let saving = $state(false);
  let showAdvanced = $state(false);
  let interfaceOptions = $state<{ label: string; value: string }[]>([]);

  let firmware = $state<Record<string, unknown>>({ currentVersion: '-', buildDate: '-', latestAvailable: '-' });
  let firmwareFile = $state<File | null>(null);
  let importFile = $state<File | null>(null);
  let checkingUpdates = $state(false);

  let validation = $state<Record<string, unknown>>({ schema: 'unknown', runtime: 'unknown', pending: 0, errors: 0 });

  /* ── Timezone / language options ───────────────────────── */

  const timezoneOptions = [
    { label: 'UTC', value: 'UTC' },
    { label: 'US/Eastern', value: 'US/Eastern' },
    { label: 'US/Central', value: 'US/Central' },
    { label: 'US/Pacific', value: 'US/Pacific' },
    { label: 'Europe/London', value: 'Europe/London' },
    { label: 'Europe/Berlin', value: 'Europe/Berlin' },
    { label: 'Europe/Paris', value: 'Europe/Paris' },
    { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
    { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
    { label: 'Australia/Sydney', value: 'Australia/Sydney' }
  ];

  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'German', value: 'de' },
    { label: 'French', value: 'fr' },
    { label: 'Spanish', value: 'es' },
    { label: 'Japanese', value: 'ja' },
    { label: 'Chinese', value: 'zh' }
  ];

  const consoleOptions = [
    { label: 'Serial', value: 'serial' },
    { label: 'VGA', value: 'vga' },
    { label: 'None (headless)', value: 'none' }
  ];

  const serialSpeedOptions = [
    { label: '9600', value: '9600' },
    { label: '19200', value: '19200' },
    { label: '38400', value: '38400' },
    { label: '57600', value: '57600' },
    { label: '115200', value: '115200' }
  ];

  /* ── Data fetching ────────────────────────────────────── */

  async function load() {
    loading = true;
    try {
      const [cfg, v, f] = await Promise.all([
        api.get('/system/config'),
        api.get('/system/validation').catch(() => ({ schema: 'unknown', runtime: 'unknown', pending: 0, errors: 0 })),
        api.get('/system/firmware').catch(() => ({ currentVersion: '-', buildDate: '-' }))
      ]);
      const d = asObject(cfg);
      settings = {
        hostname: String(d.hostname ?? defaults.hostname),
        domain: String(d.domain ?? defaults.domain),
        timezone: String(d.timezone ?? defaults.timezone),
        language: String(d.language ?? defaults.language),
        console: String(d.console ?? defaults.console),
        dnsServers: String(d.dnsServers ?? d.dns_servers ?? defaults.dnsServers),
        ntpServers: String(d.ntpServers ?? d.ntp_servers ?? defaults.ntpServers),
        ntpEnabled: Boolean(d.ntpEnabled ?? d.ntp_enabled ?? defaults.ntpEnabled),
        sshEnabled: Boolean(d.sshEnabled ?? d.ssh_enabled ?? defaults.sshEnabled),
        sshPort: Number(d.sshPort ?? d.ssh_port ?? defaults.sshPort),
        sshPasswordAuth: Boolean(d.sshPasswordAuth ?? d.ssh_password_auth ?? defaults.sshPasswordAuth),
        serialSpeed: String(d.serialSpeed ?? d.serial_speed ?? defaults.serialSpeed),
        thermalShutdown: Boolean(d.thermalShutdown ?? d.thermal_shutdown ?? defaults.thermalShutdown),
        thermalThreshold: Number(d.thermalThreshold ?? d.thermal_threshold ?? defaults.thermalThreshold),
        webGuiRedirectHttps: Boolean(d.webGuiRedirectHttps ?? d.web_gui_redirect_https ?? defaults.webGuiRedirectHttps),
        webGuiPort: Number(d.webGuiPort ?? d.web_gui_port ?? defaults.webGuiPort),
        webGuiListenAddress: String(d.webGuiListenAddress ?? d.web_gui_listen_address ?? defaults.webGuiListenAddress),
        webGuiListenInterfaces: String(d.webGuiListenInterfaces ?? d.web_gui_listen_interfaces ?? defaults.webGuiListenInterfaces),
        webGuiCert: String(d.webGuiCert ?? d.web_gui_cert ?? defaults.webGuiCert)
      };
      validation = asObject(v);
      firmware = asObject(f);
      // Sync i18n locale from backend setting
      if (settings.language) setAppLocale(settings.language);
    } catch (e) {
      settings = { ...defaults };
      toasts.error(e instanceof Error ? e.message : 'Failed to load system settings');
    } finally { loading = false; }
  }

  async function save() {
    saving = true;
    try {
      await api.patch('/system/config', settings);
      toasts.success('System settings saved');
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save system settings');
    } finally { saving = false; }
  }

  /* ── Firmware ─────────────────────────────────────────── */

  async function checkUpdates() {
    checkingUpdates = true;
    try {
      await api.post('/system/firmware/check');
      toasts.success('Update check started');
      firmware = asObject(await api.get('/system/firmware'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Update check failed');
    } finally { checkingUpdates = false; }
  }

  async function uploadFirmware() {
    if (!firmwareFile) { toasts.warning('Select firmware image first'); return; }
    try {
      const data = new FormData();
      data.append('file', firmwareFile);
      const res = await fetch('/api/system/firmware/upload', {
        method: 'POST',
        headers: api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : undefined,
        body: data
      });
      if (!res.ok) throw new Error(await res.text());
      toasts.success('Firmware upload started');
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Firmware upload failed');
    }
  }

  /* ── System actions ───────────────────────────────────── */

  async function doAction(path: string, label: string) {
    try {
      await api.post(path);
      toasts.success(`${label} request submitted`);
    } catch (e) { toasts.error(e instanceof Error ? e.message : `${label} failed`); }
  }

  function factoryReset() {
    if (!confirm('Factory reset will erase all configuration and restore defaults. This cannot be undone. Continue?')) return;
    void doAction('/system/factory-reset', 'Factory reset');
  }

  /* ── Config export / import ───────────────────────────── */

  async function exportConfig() {
    try {
      const res = await fetch('/api/config/export', {
        headers: api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : undefined
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ezngfw-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toasts.success('Configuration exported');
    } catch (e) { toasts.error(e instanceof Error ? e.message : 'Export failed'); }
  }

  async function importConfig() {
    if (!importFile) { toasts.warning('Select import file first'); return; }
    try {
      const data = new FormData();
      data.append('file', importFile);
      const res = await fetch('/api/config/import', {
        method: 'POST',
        headers: api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : undefined,
        body: data
      });
      if (!res.ok) throw new Error(await res.text());
      toasts.success('Configuration import started');
    } catch (e) { toasts.error(e instanceof Error ? e.message : 'Import failed'); }
  }

  async function loadInterfaces() {
    try {
      const data = await api.get<Record<string, any>>('/interfaces');
      const entries = Array.isArray(data) ? data : Object.entries(data).map(([k, v]: [string, any]) => ({ name: k, ...v }));
      interfaceOptions = entries.map((iface: any) => ({ label: iface.name || iface.description || String(iface), value: iface.name || String(iface) }));
    } catch { interfaceOptions = []; }
  }

  onMount(() => { void load(); void loadInterfaces(); });

</script>

<div class="space-y-6">
  <!-- ── General Settings ────────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="flex items-center gap-2 text-slate-100"><ServerIcon class="size-4" /> General Settings</CardTitle>
          <CardDescription class="text-slate-400">Core system identity, time synchronization, and resolver configuration.</CardDescription>
        </div>
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={save} disabled={saving || loading}>
          <SaveIcon class="mr-2 size-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-3">
          <Skeleton class="h-9 bg-slate-800" />
          <Skeleton class="h-9 bg-slate-800" />
          <Skeleton class="h-9 bg-slate-800" />
        </div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1 text-sm">
            <FieldLabel label="Hostname" hint="System hostname used in DHCP, DNS, syslog headers, and the browser title bar. Must be a valid RFC 1123 hostname (letters, digits, hyphens, no dots). Changing the hostname requires a service restart to propagate. Example: 'fw-edge-01' or 'office-gw'." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" value={settings.hostname} oninput={(e) => (settings.hostname = (e.currentTarget as HTMLInputElement).value)} placeholder="ezngfw" />
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="Domain" hint="DNS domain appended to the hostname to form the FQDN (hostname.domain). Used in certificate generation, reverse DNS, and DHCP domain assignments. Example: 'corp.example.com' or 'home.lan'." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" value={settings.domain} oninput={(e) => (settings.domain = (e.currentTarget as HTMLInputElement).value)} placeholder="localdomain" />
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="Timezone" hint="System timezone for log timestamps, cron schedules, certificate validity checks, and the admin GUI clock display. Incorrect timezone makes log correlation across systems difficult during incident response. Example: 'Europe/Berlin' for CET/CEST." />
            <Select.Root type="single" value={settings.timezone} onValueChange={(v) => { if (v) settings.timezone = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                <span>{timezoneOptions.find(o => o.value === settings.timezone)?.label ?? settings.timezone}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each timezoneOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="Language" hint="Admin GUI display language. This affects only the web interface text — firewall behavior, logs, and CLI output remain in English. Example: 'de' for German interface." />
            <Select.Root type="single" value={settings.language} onValueChange={(v) => { if (v) { settings.language = v; setAppLocale(v); } }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                <span>{languageOptions.find(o => o.value === settings.language)?.label ?? settings.language}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each languageOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="DNS Servers" hint="Comma-separated list of upstream DNS resolvers the firewall uses for its own lookups (package updates, ACME challenges, DynDNS). These are NOT the DNS servers pushed to LAN clients — configure those in DHCP settings. Use reliable resolvers with low latency. Example: '1.1.1.1, 8.8.8.8' or '9.9.9.9, 149.112.112.112'." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" value={settings.dnsServers} oninput={(e) => (settings.dnsServers = (e.currentTarget as HTMLInputElement).value)} placeholder="1.1.1.1, 8.8.8.8" />
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="NTP Enabled" hint="Enable Network Time Protocol synchronization. Accurate time is critical for TLS certificate validation, log correlation, TOTP/MFA tokens, and cron-based backup schedules. Only disable in air-gapped networks with a local stratum-1 source. Example: always enable in production." />
            <div class="flex h-9 items-center gap-3">
              <Switch checked={settings.ntpEnabled} onCheckedChange={(v) => (settings.ntpEnabled = v)} />
              <span class="text-xs" class:text-emerald-400={settings.ntpEnabled} class:text-slate-500={!settings.ntpEnabled}>{settings.ntpEnabled ? 'Syncing' : 'Disabled'}</span>
            </div>
          </label>

          {#if settings.ntpEnabled}
            <label class="space-y-1 text-sm md:col-span-2">
              <FieldLabel label="NTP Servers" hint="Comma-separated list of NTP server hostnames or IPs for time synchronization. Use pool addresses for automatic geographic distribution, or specific servers for deterministic stratum. Mix at least 2 sources for fault tolerance. Example: '0.pool.ntp.org, 1.pool.ntp.org' or 'time.google.com, time.cloudflare.com'." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" value={settings.ntpServers} oninput={(e) => (settings.ntpServers = (e.currentTarget as HTMLInputElement).value)} placeholder="0.pool.ntp.org, 1.pool.ntp.org" />
            </label>
          {/if}

          <label class="space-y-1 text-sm">
            <FieldLabel label="Console" hint="Local console output device for boot messages and emergency recovery. Use 'Serial' for headless rack-mounted appliances with IPMI/iLO, 'VGA' for systems with a physical display, or 'None' for fully headless cloud instances. Example: 'Serial' for NanoPi R5S." />
            <Select.Root type="single" value={settings.console} onValueChange={(v) => { if (v) settings.console = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                <span>{consoleOptions.find(o => o.value === settings.console)?.label ?? settings.console}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each consoleOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>
        </div>

        <!-- Advanced settings -->
        <button class="mt-4 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 cursor-pointer" onclick={() => (showAdvanced = !showAdvanced)}>
          {#if showAdvanced}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon class="size-4" />{/if}
          Advanced Settings
        </button>

        {#if showAdvanced}
          <div class="mt-3 grid gap-4 rounded-md border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-2">
            <label class="space-y-1 text-sm">
              <FieldLabel label="SSH Access" hint="Enable the SSH daemon for command-line administration and emergency recovery. Restrict access with firewall rules to management networks only. Disable on appliances that are managed exclusively via the web GUI. Example: enable for admin access from 10.0.0.0/24." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.sshEnabled} onCheckedChange={(v) => (settings.sshEnabled = v)} />
                <span class="text-xs" class:text-emerald-400={settings.sshEnabled} class:text-slate-500={!settings.sshEnabled}>{settings.sshEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </label>

            {#if settings.sshEnabled}
              <label class="space-y-1 text-sm">
                <FieldLabel label="SSH Port" hint="TCP port for the SSH daemon. Changing from the default 22 reduces automated brute-force noise but is not a security substitute for key-based auth and fail2ban. Ensure your firewall rules match the new port. Example: 22 (standard) or 2222 (non-standard)." />
                <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(settings.sshPort)} oninput={(e) => (settings.sshPort = Number((e.currentTarget as HTMLInputElement).value || 22))} />
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="SSH Password Auth" hint="Allow password-based SSH login. Disable to require SSH key authentication only, which is significantly more secure against brute-force attacks. Ensure you have SSH keys deployed before disabling. Example: disable and use ed25519 keys." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.sshPasswordAuth} onCheckedChange={(v) => (settings.sshPasswordAuth = v)} />
                  <span class="text-xs" class:text-emerald-400={settings.sshPasswordAuth} class:text-amber-400={!settings.sshPasswordAuth}>{settings.sshPasswordAuth ? 'Password allowed' : 'Key only'}</span>
                </div>
              </label>
            {/if}

            {#if settings.console === 'serial'}
              <label class="space-y-1 text-sm">
                <FieldLabel label="Serial Speed" hint="Baud rate for the serial console connection. Must match the terminal emulator or IPMI settings on the other end. 115200 is the standard for modern hardware. Example: 115200 for most server BMCs." />
                <Select.Root type="single" value={settings.serialSpeed} onValueChange={(v) => { if (v) settings.serialSpeed = v; }}>
                  <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                    <span>{settings.serialSpeed} baud</span>
                  </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900">
                    {#each serialSpeedOptions as opt}
                      <Select.Item value={opt.value} label={`${opt.label} baud`} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </label>
            {/if}

            <label class="space-y-1 text-sm">
              <FieldLabel label="Web GUI HTTPS Redirect" hint="Automatically redirect HTTP requests to HTTPS on the management interface. Disable only on isolated management segments where TLS adds unnecessary latency. Strongly recommended for any network-accessible management. Example: always enable in production." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.webGuiRedirectHttps} onCheckedChange={(v) => (settings.webGuiRedirectHttps = v)} />
                <span class="text-xs" class:text-emerald-400={settings.webGuiRedirectHttps} class:text-slate-500={!settings.webGuiRedirectHttps}>{settings.webGuiRedirectHttps ? 'HTTPS enforced' : 'HTTP allowed'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Web GUI Port" hint="TCP port for the admin web interface. Changing this requires updating browser bookmarks, API clients, and any monitoring integrations. Ensure the anti-lockout rule covers the new port. Example: 8080 (default) or 443 for standard HTTPS." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(settings.webGuiPort)} oninput={(e) => (settings.webGuiPort = Number((e.currentTarget as HTMLInputElement).value || 8080))} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="GUI Listen Address" hint="Primary bind address for the management GUI listener. Use 0.0.0.0 to listen on all IPv4 addresses, or set a dedicated management IP for tighter exposure. Example: 192.168.50.1 for a dedicated mgmt VLAN." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" value={settings.webGuiListenAddress} oninput={(e) => (settings.webGuiListenAddress = (e.currentTarget as HTMLInputElement).value)} placeholder="0.0.0.0" />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="GUI Listen Interfaces" hint="Comma-separated list of interfaces the web GUI binds to. Leave empty to listen on all interfaces. Restrict to management interfaces for security. Example: 'lan0' or 'mgmt0,lan0'." />
              <select class="cursor-pointer h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" bind:value={settings.webGuiListenInterfaces}>
                <option value="">All Interfaces</option>
                {#each interfaceOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="GUI Certificate" hint="Certificate reference used by the HTTPS web UI listener. Set this to a managed certificate name from the certificate store when terminating TLS with a trusted chain. Leave empty to use the default self-signed certificate." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" value={settings.webGuiCert} oninput={(e) => (settings.webGuiCert = (e.currentTarget as HTMLInputElement).value)} placeholder="management-ui-cert" />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Thermal Shutdown" hint="Enable automatic shutdown when CPU temperature exceeds the threshold. Protects hardware from permanent damage in rack environments with cooling failures. The system sends a warning at 5°C below threshold. Example: enable with 85°C threshold." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.thermalShutdown} onCheckedChange={(v) => (settings.thermalShutdown = v)} />
                <span class="text-xs" class:text-emerald-400={settings.thermalShutdown} class:text-slate-500={!settings.thermalShutdown}>{settings.thermalShutdown ? 'Protected' : 'Unprotected'}</span>
              </div>
            </label>

            {#if settings.thermalShutdown}
              <label class="space-y-1 text-sm">
                <FieldLabel label="Thermal Threshold (°C)" hint="CPU temperature in Celsius that triggers an automatic shutdown. Set conservatively below the CPU's maximum junction temperature. Most x86 CPUs tolerate up to 100°C but sustained high temps reduce lifespan. Example: 85 for standard rack servers." />
                <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(settings.thermalThreshold)} oninput={(e) => (settings.thermalThreshold = Number((e.currentTarget as HTMLInputElement).value || 85))} />
              </label>
            {/if}
          </div>
        {/if}
      {/if}
    </CardContent>
  </Card>

  <!-- ── Validation Status ───────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">Validation Status</CardTitle>
      <CardDescription class="text-slate-400">Configuration schema and runtime health checks.</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">Schema</p>
          <p class="text-lg font-semibold" class:text-emerald-400={String(validation.schema) === 'ok'} class:text-amber-400={String(validation.schema) !== 'ok'}>{asString(validation.schema)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">Runtime</p>
          <p class="text-lg font-semibold" class:text-emerald-400={String(validation.runtime) === 'ok'} class:text-amber-400={String(validation.runtime) !== 'ok'}>{asString(validation.runtime)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">Pending</p>
          <p class="text-lg font-semibold text-slate-100">{asString(validation.pending)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">Errors</p>
          <p class="text-lg font-semibold" class:text-emerald-400={Number(validation.errors ?? 0) === 0} class:text-red-400={Number(validation.errors ?? 0) > 0}>{asString(validation.errors)}</p>
        </div>
      </div>
    </CardContent>
  </Card>

  <!-- ── Firmware ────────────────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">Firmware</CardTitle>
      <CardDescription class="text-slate-400">Inspect current build version and apply signed firmware updates.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">Current Version</p>
          <p class="text-sm font-mono text-slate-100">{asString(firmware.currentVersion)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">Build Date</p>
          <p class="text-sm font-mono text-slate-100">{asString(firmware.buildDate)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">Latest Available</p>
          <p class="text-sm font-mono text-slate-100">{asString(firmware.latestAvailable ?? '-')}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={checkUpdates} disabled={checkingUpdates}>
          <RefreshCwIcon class="mr-2 size-4" />
          {checkingUpdates ? 'Checking…' : 'Check for Updates'}
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Input type="file" accept=".img,.bin,.tar,.zip" onchange={(e) => (firmwareFile = (e.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
        <Button variant="outline" class="border-slate-700 text-slate-100" onclick={uploadFirmware}>
          <UploadIcon class="mr-2 size-4" />
          Upload Firmware
        </Button>
      </div>
    </CardContent>
  </Card>

  <!-- ── System Actions ──────────────────────────────── -->
  <Card class="border-red-500/30 bg-red-500/5">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-red-200"><TriangleAlertIcon class="size-4" /> System Actions</CardTitle>
      <CardDescription class="text-red-200/70">Execute host-level control operations. These actions are immediate and may cause service disruption.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-wrap gap-2">
      <Button class="bg-amber-500 text-slate-950 hover:bg-amber-400" onclick={() => doAction('/system/reboot', 'Reboot')}>Reboot</Button>
      <Button class="bg-red-500 text-white hover:bg-red-600" onclick={() => doAction('/system/shutdown', 'Shutdown')}>Shutdown</Button>
      <Button class="bg-red-600 text-white hover:bg-red-700" onclick={factoryReset}>Factory Reset</Button>
    </CardContent>
  </Card>

  <!-- ── Config Export / Import ──────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">Config Export / Import</CardTitle>
      <CardDescription class="text-slate-400">Move JSON configuration between appliances for migration or cloning.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={exportConfig}>
        <DownloadIcon class="mr-2 size-4" />
        Export Config
      </Button>
      <div class="flex flex-wrap items-center gap-2">
        <Input type="file" accept=".json" onchange={(e) => (importFile = (e.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
        <Button variant="outline" class="border-slate-700 text-slate-100" onclick={importConfig}>
          <UploadIcon class="mr-2 size-4" />
          Import Config
        </Button>
      </div>
    </CardContent>
  </Card>

  <!-- ── ARP Table ───────────────────────────────────── -->
  <ReadOnlyTable
    title="ARP Table"
    endpoint="/system/arp"
    columns={[
      { key: 'ip', label: 'IP', mono: true },
      { key: 'mac', label: 'MAC', mono: true },
      { key: 'interface', label: 'Interface' },
      { key: 'expires', label: 'Expires' }
    ]}
  />

  <!-- ── System Routes ───────────────────────────────── -->
  <ReadOnlyTable
    title="System Routes"
    endpoint="/system/routes"
    columns={[
      { key: 'destination', label: 'Destination', mono: true },
      { key: 'gateway', label: 'Gateway', mono: true },
      { key: 'interface', label: 'Interface' },
      { key: 'flags', label: 'Flags' }
    ]}
  />
</div>
