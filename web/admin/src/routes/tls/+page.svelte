<!-- Route view for `/tls` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asObject, asList, asString } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Badge } from '$lib/components/ui/badge';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import * as Select from '$lib/components/ui/select';
  import SaveIcon from '@lucide/svelte/icons/save';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash-2';
  import EditIcon from '@lucide/svelte/icons/pencil';
  import XIcon from '@lucide/svelte/icons/x';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import { _ } from '$lib/i18n';

  /* ── Types & defaults ─────────────────────────────────── */

  type TlsSettings = {
    enabled: boolean;
    inspectionMode: string;
    caCertificate: string;
    caPrivateKey: string;
    minTlsVersion: string;
    maxTlsVersion: string;
    logInspected: boolean;
    logBypassed: boolean;
    logErrors: boolean;
    upstreamCertVerification: boolean;
    cacheSize: number;
    cacheTimeoutSeconds: number;
    interfaces: string;
    sniFilterMode: string;
    blockExpiredCerts: boolean;
    blockSelfSigned: boolean;
    blockRevoked: boolean;
    ocspStapling: boolean;
  };

  const defaults: TlsSettings = {
    enabled: false,
    inspectionMode: 'bump',
    caCertificate: '',
    caPrivateKey: '',
    minTlsVersion: 'tls1.2',
    maxTlsVersion: 'tls1.3',
    logInspected: true,
    logBypassed: false,
    logErrors: true,
    upstreamCertVerification: true,
    cacheSize: 10000,
    cacheTimeoutSeconds: 3600,
    interfaces: '',
    sniFilterMode: 'inspect-all',
    blockExpiredCerts: true,
    blockSelfSigned: false,
    blockRevoked: true,
    ocspStapling: true
  };

  type BypassRule = {
    name: string;
    hostnamePattern: string;
    port: number | string;
    sourceNetwork: string;
    reason: string;
    enabled: boolean;
  };

  const bypassDefaults: BypassRule = {
    name: '',
    hostnamePattern: '',
    port: 443,
    sourceNetwork: '',
    reason: '',
    enabled: true
  };

  let settings = $state<TlsSettings>({ ...defaults });
  let loading = $state(true);
  let saving = $state(false);
  let showAdvanced = $state(false);

  let bypassRules = $state<BypassRule[]>([]);
  let editingBypass = $state<BypassRule | null>(null);
  let addingBypass = $state(false);
  let savingBypass = $state(false);
  let interfaceOptions = $state<{ label: string; value: string }[]>([]);

  let stats = $state<Record<string, unknown>>({});
  let statsLoading = $state(true);

  /* ── Options ──────────────────────────────────────────── */

  const inspectionModeOptions = [
    { label: 'Bump (full inspection)', value: 'bump' },
    { label: 'Splice (passthrough)', value: 'splice' },
    { label: 'Peek & Splice', value: 'peek-splice' },
    { label: 'Peek & Bump', value: 'peek-bump' }
  ];

  const tlsVersionOptions = [
    { label: 'TLS 1.0', value: 'tls1.0' },
    { label: 'TLS 1.1', value: 'tls1.1' },
    { label: 'TLS 1.2', value: 'tls1.2' },
    { label: 'TLS 1.3', value: 'tls1.3' }
  ];

  const sniModeOptions = [
    { label: 'Inspect All', value: 'inspect-all' },
    { label: 'SNI Allowlist Only', value: 'allowlist' },
    { label: 'SNI Blocklist Only', value: 'blocklist' }
  ];

  /* ── Data fetching ────────────────────────────────────── */

  async function load() {
    loading = true;
    try {
      const [payload, bypassPayload, statsPayload, interfacesPayload] = await Promise.all([
        api.get('/tls-inspection'),
        api.get('/tls/bypass'),
        api.get('/tls/stats').catch(() => ({})),
        api.get('/interfaces').catch(() => [])
      ]);
      const d = asObject(payload);
      settings = {
        enabled: Boolean(d.enabled ?? defaults.enabled),
        inspectionMode: String(d.inspectionMode ?? d.inspection_mode ?? defaults.inspectionMode),
        caCertificate: String(d.caCertificate ?? d.ca_certificate ?? defaults.caCertificate),
        caPrivateKey: String(d.caPrivateKey ?? d.ca_private_key ?? defaults.caPrivateKey),
        minTlsVersion: String(d.minTlsVersion ?? d.min_tls_version ?? defaults.minTlsVersion),
        maxTlsVersion: String(d.maxTlsVersion ?? d.max_tls_version ?? defaults.maxTlsVersion),
        logInspected: Boolean(d.logInspected ?? d.log_inspected ?? defaults.logInspected),
        logBypassed: Boolean(d.logBypassed ?? d.log_bypassed ?? defaults.logBypassed),
        logErrors: Boolean(d.logErrors ?? d.log_errors ?? defaults.logErrors),
        upstreamCertVerification: Boolean(d.upstreamCertVerification ?? d.upstream_cert_verification ?? defaults.upstreamCertVerification),
        cacheSize: Number(d.cacheSize ?? d.cache_size ?? defaults.cacheSize),
        cacheTimeoutSeconds: Number(d.cacheTimeoutSeconds ?? d.cache_timeout_seconds ?? defaults.cacheTimeoutSeconds),
        interfaces: String(d.interfaces ?? defaults.interfaces),
        sniFilterMode: String(d.sniFilterMode ?? d.sni_filter_mode ?? defaults.sniFilterMode),
        blockExpiredCerts: Boolean(d.blockExpiredCerts ?? d.block_expired_certs ?? defaults.blockExpiredCerts),
        blockSelfSigned: Boolean(d.blockSelfSigned ?? d.block_self_signed ?? defaults.blockSelfSigned),
        blockRevoked: Boolean(d.blockRevoked ?? d.block_revoked ?? defaults.blockRevoked),
        ocspStapling: Boolean(d.ocspStapling ?? d.ocsp_stapling ?? defaults.ocspStapling)
      };
      const bypassList = asList(bypassPayload);
      bypassRules = bypassList.map((r: unknown) => {
        const row = asObject(r);
        return {
          name: String(row.name ?? ''),
          hostnamePattern: String(row.hostnamePattern ?? row.hostname_pattern ?? ''),
          port: Number(row.port ?? 443),
          sourceNetwork: String(row.sourceNetwork ?? row.source_network ?? ''),
          reason: String(row.reason ?? ''),
          enabled: Boolean(row.enabled ?? true)
        };
      });
      interfaceOptions = asList(interfacesPayload)
        .map((entry: unknown) => {
          const row = asObject(entry);
          const value = String(row.name ?? row.interface ?? row.id ?? '').trim();
          const description = String(row.description ?? row.alias ?? '').trim();
          if (!value) return null;
          return {
            value,
            label: description ? `${value} (${description})` : value
          };
        })
        .filter((opt): opt is { label: string; value: string } => Boolean(opt));
      stats = asObject(statsPayload);
    } catch (e) {
      settings = { ...defaults };
      toasts.error(e instanceof Error ? e.message : 'Failed to load TLS settings');
    } finally { loading = false; statsLoading = false; }
  }

  async function save() {
    saving = true;
    try {
      await api.patch('/tls-inspection', settings);
      toasts.success($_('tls.toasttls_inspection_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save TLS settings');
    } finally { saving = false; }
  }

  /* ── Bypass CRUD ──────────────────────────────────────── */

  function startAddBypass() {
    editingBypass = { ...bypassDefaults };
    addingBypass = true;
  }

  function startEditBypass(rule: BypassRule) {
    editingBypass = { ...rule };
    addingBypass = false;
  }

  function cancelBypass() {
    editingBypass = null;
    addingBypass = false;
  }

  async function saveBypass() {
    if (!editingBypass) return;
    savingBypass = true;
    try {
      if (addingBypass) {
        await api.post('/tls/bypass', editingBypass);
        toasts.success($_('tls.toastbypass_rule_created'));
      } else {
        await api.patch(`/tls/bypass/${encodeURIComponent(editingBypass.name)}`, editingBypass);
        toasts.success($_('tls.toastbypass_rule_updated'));
      }
      editingBypass = null;
      addingBypass = false;
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save bypass rule');
    } finally { savingBypass = false; }
  }

  async function deleteBypass(name: string) {
    try {
      await api.del(`/tls/bypass/${encodeURIComponent(name)}`);
      toasts.success($_('tls.toastbypass_rule_deleted'));
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to delete bypass rule');
    }
  }

  onMount(() => { void load(); });

</script>

<div class="space-y-6">
  <!-- ── TLS Settings ────────────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="flex items-center gap-2 text-slate-100"><ShieldIcon class="size-4" /> TLS Inspection Settings</CardTitle>
          <CardDescription class="text-slate-400">{$_('tls.control_certificate_authority_material_inspection')}</CardDescription>
        </div>
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={save} disabled={saving || loading}>
          <SaveIcon class="mr-2 size-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-3"><Skeleton class="h-9 bg-slate-800" /><Skeleton class="h-9 bg-slate-800" /><Skeleton class="h-9 bg-slate-800" /></div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1 text-sm md:col-span-2">
            <FieldLabel label="TLS Inspection Enabled" hint="Enable transparent TLS interception (SSL bumping) for encrypted traffic flowing through the firewall. When enabled, the firewall decrypts, inspects, and re-encrypts TLS sessions using the configured CA certificate. All clients must trust the inspection CA. Disable to pass encrypted traffic uninspected. Example: enable for corporate networks requiring DLP/IDS on HTTPS." />
            <div class="flex h-9 items-center gap-3">
              <Switch checked={settings.enabled} onCheckedChange={(v) => (settings.enabled = v)} />
              <span class="text-xs" class:text-emerald-400={settings.enabled} class:text-slate-500={!settings.enabled}>{settings.enabled ? 'Intercepting' : 'Passthrough'}</span>
            </div>
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="Inspection Mode" hint="Controls how TLS sessions are handled. 'Bump' fully decrypts and inspects all content (highest visibility). 'Splice' passes traffic after SNI peek (no content inspection). 'Peek & Splice' inspects the ClientHello then decides. 'Peek & Bump' peeks first then bumps if policy requires. Example: 'Bump' for full DLP, 'Peek & Splice' for selective inspection." />
            <Select.Root type="single" value={settings.inspectionMode} onValueChange={(v) => { if (v) settings.inspectionMode = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                <span>{inspectionModeOptions.find(o => o.value === settings.inspectionMode)?.label ?? settings.inspectionMode}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each inspectionModeOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="SNI Filter Mode" hint="How Server Name Indication is used for inspection decisions. 'Inspect All' bumps everything. 'Allowlist Only' inspects only listed domains. 'Blocklist Only' inspects everything except listed domains. Use allowlist for targeted inspection, blocklist for broad coverage with exceptions. Example: 'Blocklist' to skip banking sites." />
            <Select.Root type="single" value={settings.sniFilterMode} onValueChange={(v) => { if (v) settings.sniFilterMode = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                <span>{sniModeOptions.find(o => o.value === settings.sniFilterMode)?.label ?? settings.sniFilterMode}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each sniModeOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="Min TLS Version" hint="Minimum TLS version allowed for inspected connections. Setting to TLS 1.2 blocks insecure TLS 1.0/1.1 sessions (recommended). Some legacy systems may require TLS 1.0 — add bypass rules instead of lowering the global minimum. Example: 'TLS 1.2' for PCI-DSS compliance." />
            <Select.Root type="single" value={settings.minTlsVersion} onValueChange={(v) => { if (v) settings.minTlsVersion = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                <span>{tlsVersionOptions.find(o => o.value === settings.minTlsVersion)?.label ?? settings.minTlsVersion}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each tlsVersionOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="Max TLS Version" hint="Maximum TLS version the inspection proxy negotiates. TLS 1.3 provides the best security and performance. Only lower this for troubleshooting compatibility with servers that misbehave on TLS 1.3. Example: 'TLS 1.3' (default, recommended)." />
            <Select.Root type="single" value={settings.maxTlsVersion} onValueChange={(v) => { if (v) settings.maxTlsVersion = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                <span>{tlsVersionOptions.find(o => o.value === settings.maxTlsVersion)?.label ?? settings.maxTlsVersion}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each tlsVersionOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="Interface" hint="Interface on which TLS inspection should be enforced. Choose the network edge where client traffic enters the firewall. Example: LAN or guest VLAN interface." />
            <Select.Root type="single" value={settings.interfaces} onValueChange={(v) => { if (v) settings.interfaces = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                <span>{interfaceOptions.find((opt) => opt.value === settings.interfaces)?.label ?? (settings.interfaces || 'Select interface...')}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each interfaceOptions as option}
                  <Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>

          <label class="space-y-1 text-sm md:col-span-2">
            <FieldLabel label="CA Certificate (PEM)" hint="The X.509 CA certificate in PEM format used to sign intercepted server certificates on-the-fly. All client devices on inspected networks must trust this CA via MDM, GPO, or manual install. Generate a dedicated CA for this purpose — never reuse your organization's root CA. Example: paste the full PEM including -----BEGIN CERTIFICATE----- header." />
            <Textarea class="min-h-[100px] border-slate-700 bg-slate-950 font-mono text-xs text-slate-100" value={settings.caCertificate} oninput={(e) => (settings.caCertificate = (e.currentTarget as HTMLTextAreaElement).value)} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" />
          </label>

          <label class="space-y-1 text-sm md:col-span-2">
            <FieldLabel label="CA Private Key (PEM)" hint="Private key for the inspection CA certificate. This key signs every intercepted certificate, so protect it carefully. Compromise of this key allows an attacker to silently intercept all inspected TLS traffic. Store the backup encrypted. Example: RSA 4096 or ECDSA P-384 key." />
            <Textarea class="min-h-[100px] border-slate-700 bg-slate-950 font-mono text-xs text-slate-100" value={settings.caPrivateKey} oninput={(e) => (settings.caPrivateKey = (e.currentTarget as HTMLTextAreaElement).value)} placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" />
          </label>

          <label class="space-y-1 text-sm">
            <FieldLabel label="Verify Upstream Certificates" hint="Validate the origin server's TLS certificate during interception. When enabled, connections to servers with expired, self-signed, or untrusted certificates are blocked or flagged. Disable only for troubleshooting — never in production. Example: always enable." />
            <div class="flex h-9 items-center gap-3">
              <Switch checked={settings.upstreamCertVerification} onCheckedChange={(v) => (settings.upstreamCertVerification = v)} />
              <span class="text-xs" class:text-emerald-400={settings.upstreamCertVerification} class:text-amber-400={!settings.upstreamCertVerification}>{settings.upstreamCertVerification ? 'Verifying' : 'Disabled (unsafe)'}</span>
            </div>
          </label>
        </div>

        <!-- Advanced -->
        <button class="mt-4 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 cursor-pointer" onclick={() => (showAdvanced = !showAdvanced)}>
          {#if showAdvanced}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon class="size-4" />{/if}
          Advanced Options
        </button>

        {#if showAdvanced}
          <div class="mt-3 grid gap-4 rounded-md border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-2">
            <label class="space-y-1 text-sm">
              <FieldLabel label="Session Cache Size" hint="Number of TLS session entries cached for faster re-handshakes. Larger cache improves performance for repeat visitors but uses more memory (approx. 2KB per entry). Example: 10000 for medium networks, 50000 for enterprise." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(settings.cacheSize)} oninput={(e) => (settings.cacheSize = Number((e.currentTarget as HTMLInputElement).value || 10000))} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Cache Timeout (seconds)" hint="How long cached TLS sessions remain valid. Shorter timeouts improve forward secrecy but increase CPU load from full handshakes. Balance between security and performance. Example: 3600 (1 hour) for standard use, 300 for high-security." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(settings.cacheTimeoutSeconds)} oninput={(e) => (settings.cacheTimeoutSeconds = Number((e.currentTarget as HTMLInputElement).value || 3600))} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Block Expired Certificates" hint="Block connections to servers presenting expired TLS certificates. Expired certs may indicate a misconfigured server or a man-in-the-middle attack. Users see a block page instead of a browser warning. Example: enable for corporate networks." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.blockExpiredCerts} onCheckedChange={(v) => (settings.blockExpiredCerts = v)} />
                <span class="text-xs text-slate-400">{settings.blockExpiredCerts ? 'Blocking' : 'Allowing'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Block Self-Signed" hint="Block connections to servers with self-signed certificates. Self-signed certs are common in internal tools but unusual for public sites. Enable cautiously — may break access to legitimate internal services not using a trusted CA. Example: enable only if all internal services use proper certificates." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.blockSelfSigned} onCheckedChange={(v) => (settings.blockSelfSigned = v)} />
                <span class="text-xs text-slate-400">{settings.blockSelfSigned ? 'Blocking' : 'Allowing'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Block Revoked Certificates" hint="Block connections to servers with revoked certificates (checked via CRL or OCSP). Revoked certificates often indicate compromised keys. Always enable unless your network cannot reach CRL/OCSP endpoints. Example: always enable in production." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.blockRevoked} onCheckedChange={(v) => (settings.blockRevoked = v)} />
                <span class="text-xs text-slate-400">{settings.blockRevoked ? 'Blocking' : 'Allowing'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="OCSP Stapling" hint="Enable OCSP stapling on re-signed certificates to reduce client-side revocation check latency. The proxy fetches OCSP responses and staples them to the TLS handshake. Improves client performance and privacy. Example: enable unless blocked by corporate proxy." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.ocspStapling} onCheckedChange={(v) => (settings.ocspStapling = v)} />
                <span class="text-xs text-slate-400">{settings.ocspStapling ? 'Stapling' : 'Disabled'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Log Inspected Sessions" hint="Write a log entry for every TLS session that was successfully decrypted and inspected. Useful for auditing and DLP correlation. Disable if log volume is too high on busy networks. Example: enable during initial rollout, then tune." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.logInspected} onCheckedChange={(v) => (settings.logInspected = v)} />
                <span class="text-xs text-slate-400">{settings.logInspected ? 'Logging' : 'Silent'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Log Bypassed Sessions" hint="Log sessions that matched a bypass rule and were not inspected. Useful for auditing bypass policy effectiveness and detecting policy drift over time. Example: enable to verify banking and healthcare domains are actually bypassed." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.logBypassed} onCheckedChange={(v) => (settings.logBypassed = v)} />
                <span class="text-xs text-slate-400">{settings.logBypassed ? 'Logging' : 'Silent'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Log Errors" hint="Log TLS inspection failures (handshake errors, certificate issues, timeouts). Critical for troubleshooting broken sites and identifying certificate trust issues. Example: always enable." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.logErrors} onCheckedChange={(v) => (settings.logErrors = v)} />
                <span class="text-xs text-slate-400">{settings.logErrors ? 'Logging' : 'Silent'}</span>
              </div>
            </label>
          </div>
        {/if}
      {/if}
    </CardContent>
  </Card>

  <!-- ── Bypass Rules ────────────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('tls.bypass_rules')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('tls.exclude_sensitive_destinations_from_tls_inspection')}</CardDescription>
        </div>
        {#if !editingBypass}
          <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={startAddBypass}>
            <PlusIcon class="mr-2 size-4" />
            Add Bypass Rule
          </Button>
        {/if}
      </div>
    </CardHeader>
    <CardContent>
      {#if editingBypass}
        <div class="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
          <p class="text-sm font-medium text-slate-200">{addingBypass ? 'New Bypass Rule' : `Edit: ${editingBypass.name}`}</p>
          <div class="grid gap-3 md:grid-cols-2">
            <label class="space-y-1 text-sm">
              <FieldLabel label="Rule Name" hint="Unique identifier for this bypass rule. Use descriptive names for easy audit trail. Example: 'banking-bypass' or 'healthcare-portals'." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" value={editingBypass.name} oninput={(e) => { if (editingBypass) editingBypass.name = (e.currentTarget as HTMLInputElement).value; }} />
            </label>
            <label class="space-y-1 text-sm">
              <FieldLabel label="Hostname / Pattern" hint="FQDN or wildcard pattern to match against the TLS SNI. Supports *.domain.com wildcards. Multiple domains require separate rules. Example: '*.bank.example.com' or 'health-portal.gov'." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" value={editingBypass.hostnamePattern} oninput={(e) => { if (editingBypass) editingBypass.hostnamePattern = (e.currentTarget as HTMLInputElement).value; }} placeholder="*.bank.example.com" />
            </label>
            <label class="space-y-1 text-sm">
              <FieldLabel label="Port" hint="TCP port to match for this bypass. Usually 443 for HTTPS. Use a different port only if the service runs on a non-standard TLS port. Example: 443 or 8443." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(editingBypass.port)} oninput={(e) => { if (editingBypass) editingBypass.port = Number((e.currentTarget as HTMLInputElement).value || 443); }} />
            </label>
            <label class="space-y-1 text-sm">
              <FieldLabel label="Source Network" hint="Optional client subnet to scope this bypass. Only traffic from this CIDR is bypassed; other clients are still inspected for this destination. Leave empty to bypass for all clients. Example: '10.0.10.0/24' for the finance VLAN only." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" value={editingBypass.sourceNetwork} oninput={(e) => { if (editingBypass) editingBypass.sourceNetwork = (e.currentTarget as HTMLInputElement).value; }} placeholder="10.0.0.0/8" />
            </label>
            <label class="space-y-1 text-sm">
              <FieldLabel label="Reason" hint="Document why this bypass exists. Good reasons make audits and change reviews faster. Include the compliance requirement or business justification. Example: 'PCI-DSS requires banking connections not be intercepted'." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" value={editingBypass.reason} oninput={(e) => { if (editingBypass) editingBypass.reason = (e.currentTarget as HTMLInputElement).value; }} placeholder={$_('tls.placeholdercompliance_or_technical_reason')} />
            </label>
            <label class="space-y-1 text-sm">
              <FieldLabel label="Enabled" hint="Toggle this bypass rule on or off without deleting it. Disabled rules are retained for audit trails and can be quickly re-enabled. Example: disable temporarily while troubleshooting." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={editingBypass.enabled} onCheckedChange={(v) => { if (editingBypass) editingBypass.enabled = v; }} />
                <span class="text-xs" class:text-emerald-400={editingBypass.enabled} class:text-slate-500={!editingBypass.enabled}>{editingBypass.enabled ? 'Active' : 'Disabled'}</span>
              </div>
            </label>
          </div>
          <div class="flex gap-2">
            <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={saveBypass} disabled={savingBypass}>{savingBypass ? 'Saving…' : 'Save Rule'}</Button>
            <Button variant="outline" class="border-slate-700 text-slate-100" onclick={cancelBypass}><XIcon class="mr-2 size-4" />Cancel</Button>
          </div>
        </div>
      {/if}

      {#if bypassRules.length > 0}
        <div class="mt-4 overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader class="bg-slate-800">
              <TableRow class="border-slate-700 hover:bg-slate-800">
                <TableHead class="text-slate-300">{$_('tls.name')}</TableHead>
                <TableHead class="text-slate-300">{$_('tls.pattern')}</TableHead>
                <TableHead class="text-slate-300">{$_('tls.port')}</TableHead>
                <TableHead class="text-slate-300">{$_('tls.source')}</TableHead>
                <TableHead class="text-slate-300">{$_('tls.reason')}</TableHead>
                <TableHead class="text-slate-300">{$_('tls.status')}</TableHead>
                <TableHead class="text-slate-300 text-right">{$_('tls.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each bypassRules as rule}
                <TableRow class="border-slate-800 hover:bg-slate-800/30">
                  <TableCell class="font-medium text-slate-100">{rule.name}</TableCell>
                  <TableCell class="font-mono text-xs">{rule.hostnamePattern}</TableCell>
                  <TableCell class="font-mono text-xs">{rule.port}</TableCell>
                  <TableCell class="font-mono text-xs">{rule.sourceNetwork || 'any'}</TableCell>
                  <TableCell class="text-xs text-slate-400">{rule.reason}</TableCell>
                  <TableCell>
                    <Badge class={rule.enabled ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : 'border-slate-600 bg-slate-800 text-slate-400'}>{rule.enabled ? 'Active' : 'Disabled'}</Badge>
                  </TableCell>
                  <TableCell class="text-right">
                    <div class="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" class="text-slate-400 hover:text-slate-100" onclick={() => startEditBypass(rule)}><EditIcon class="size-3.5" /></Button>
                      <Button variant="ghost" size="sm" class="text-red-400 hover:text-red-300" onclick={() => deleteBypass(rule.name)}><TrashIcon class="size-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </div>
      {:else if !editingBypass}
        <p class="mt-4 text-sm text-slate-500">{$_('tls.no_bypass_rules_configured_all_tls_traffic_on_insp')}</p>
      {/if}
    </CardContent>
  </Card>

  <!-- ── Stats ───────────────────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('tls.inspection_statistics')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('tls.realtime_counters_for_tls_inspection_throughput_an')}</CardDescription>
    </CardHeader>
    <CardContent>
      {#if statsLoading}
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Skeleton class="h-20 bg-slate-800" /><Skeleton class="h-20 bg-slate-800" /><Skeleton class="h-20 bg-slate-800" /><Skeleton class="h-20 bg-slate-800" /><Skeleton class="h-20 bg-slate-800" /></div>
      {:else}
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
            <p class="text-xs text-slate-500">{$_('tls.inspected')}</p>
            <p class="text-lg font-semibold text-emerald-400">{asString(stats.connectionsInspected ?? stats.inspected ?? 0)}</p>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
            <p class="text-xs text-slate-500">{$_('tls.bypassed')}</p>
            <p class="text-lg font-semibold text-amber-400">{asString(stats.bypassed ?? 0)}</p>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
            <p class="text-xs text-slate-500">{$_('tls.failures')}</p>
            <p class="text-lg font-semibold text-red-400">{asString(stats.inspectionFailures ?? stats.failures ?? 0)}</p>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
            <p class="text-xs text-slate-500">{$_('tls.certs_issued')}</p>
            <p class="text-lg font-semibold text-slate-100">{asString(stats.certificatesIssued ?? stats.certs ?? 0)}</p>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
            <p class="text-xs text-slate-500">{$_('tls.cache_hit_rate')}</p>
            <p class="text-lg font-semibold text-cyan-400">{asString(stats.cacheHitRate ?? stats.cache_hit_rate ?? '0%')}</p>
          </div>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
