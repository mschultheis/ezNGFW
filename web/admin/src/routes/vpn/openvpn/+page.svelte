<!-- Route view for `/vpn/openvpn` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import StatusPill from '$lib/components/admin/StatusPill.svelte';
  import { toasts } from '$lib/stores/toast';
  import { asList, asObject } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Select from '$lib/components/ui/select';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import SaveIcon from '@lucide/svelte/icons/save';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import RefreshCcwIcon from '@lucide/svelte/icons/refresh-ccw';

  import { _ } from '$lib/i18n';
  type OvpnSettings = {
    enabled: boolean; mode: string; protocol: string; port: number; device: string; topology: string;
    network: string; cipher: string; auth: string; tlsAuth: boolean; dhParams: string; caCert: string;
    serverCert: string; tlsCrypt: boolean; compression: string; dnsPush: boolean; dnsServers: string;
    redirectGateway: boolean; maxClients: number; clientToClient: boolean; duplicateCn: boolean;
    keepalive: string; keepaliveInterval: number; keepaliveTimeout: number; persistKey: boolean;
    persistTun: boolean; verbosity: number; verb: number; pushRoutes: string; pushDns: string;
    tlsCipher: string; renegSec: number; fragment: number; mssfix: number;
  };
  type Tunnel = {
    name: string; type: string; remoteEndpoint: string; status: string; latency: string;
    txBytes: string; rxBytes: string; lastHandshake: string;
  };

  const settingsDefaults: OvpnSettings = {
    enabled: false, mode: 'server', protocol: 'udp', port: 1194, device: 'tun', topology: 'subnet',
    network: '10.8.0.0/24', cipher: 'AES-256-GCM', auth: 'SHA256', tlsAuth: true, dhParams: '', caCert: '', serverCert: '',
    tlsCrypt: false, compression: 'none', dnsPush: false, dnsServers: '', redirectGateway: false,
    maxClients: 100, clientToClient: false, duplicateCn: false,
    keepalive: '10 120', keepaliveInterval: 10, keepaliveTimeout: 120, persistKey: true, persistTun: true,
    verbosity: 3, verb: 3, pushRoutes: '', pushDns: '',
    tlsCipher: '', renegSec: 3600, fragment: 0, mssfix: 1450
  };

  let loading = $state(true);
  let settings = $state<OvpnSettings>({ ...settingsDefaults });
  let tunnels = $state<Tunnel[]>([]);
  let savingSettings = $state(false);
  let showAdvanced = $state(false);

  const modeOptions = [
    { label: 'Server', value: 'server' },
    { label: 'Client', value: 'client' },
    { label: 'Site-to-Site', value: 'site-to-site' }
  ];
  const protoOptions = [
    { label: 'UDP (Recommended)', value: 'udp' },
    { label: 'TCP', value: 'tcp' }
  ];
  const topologyOptions = [
    { label: 'Subnet (Recommended)', value: 'subnet' },
    { label: 'Net30 (Legacy)', value: 'net30' },
    { label: 'P2P', value: 'p2p' }
  ];
  const deviceOptions = [
    { label: 'TUN (Layer 3, Recommended)', value: 'tun' },
    { label: 'TAP (Layer 2)', value: 'tap' }
  ];
  const cipherOptions = [
    { label: 'AES-256-GCM (Recommended)', value: 'AES-256-GCM' },
    { label: 'AES-128-GCM', value: 'AES-128-GCM' },
    { label: 'CHACHA20-POLY1305', value: 'CHACHA20-POLY1305' }
  ];
  const authOptions = [
    { label: 'SHA256 (Recommended)', value: 'SHA256' },
    { label: 'SHA384', value: 'SHA384' },
    { label: 'SHA512', value: 'SHA512' }
  ];
  const compressionOptions = [
    { label: 'None (Recommended)', value: 'none' },
    { label: 'LZ4', value: 'lz4' },
    { label: 'LZO (Legacy)', value: 'lzo' }
  ];

  const columns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'mode', label: 'Mode' },
    { key: 'protocol', label: 'Protocol' },
    { key: 'port', label: 'Port' },
    { key: 'subnet', label: 'Subnet' },
    { key: 'certificate', label: 'Certificate' },
    { key: 'status', label: 'Status' },
    { key: 'connectedClients', label: 'Clients' }
  ];

  const fields: FormField[] = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      hint: 'Unique instance identifier. Used in logs, CLI, and process management. Example: office-vpn or dc-site-link.'
    },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      options: modeOptions,
      hint: 'Server accepts inbound connections, Client connects outbound, Site-to-Site creates a permanent tunnel between two gateways.'
    },
    {
      key: 'protocol',
      label: 'Protocol',
      type: 'select',
      options: protoOptions,
      hint: 'Transport protocol used by this instance. UDP is generally faster and preferred for roaming clients.'
    },
    {
      key: 'port',
      label: 'Port',
      type: 'number',
      hint: 'Listening or destination port for this instance. Default is 1194.'
    },
    {
      key: 'localAddress',
      label: 'Local Address',
      type: 'text',
      hint: 'Local tunnel endpoint address. For server: the VPN gateway address.'
    },
    {
      key: 'remoteAddress',
      label: 'Remote Address',
      type: 'text',
      hint: 'Remote server address (client/site-to-site mode). FQDN or IP of the remote OpenVPN endpoint.'
    },
    {
      key: 'subnet',
      label: 'Subnet',
      type: 'text',
      hint: 'Tunnel network CIDR allocated for this instance. Example: 10.40.8.0/24.'
    },
    {
      key: 'certificate',
      label: 'Certificate',
      type: 'text',
      hint: 'Certificate or profile name used by this instance for TLS identity.'
    },
    {
      key: 'enabled',
      label: 'Enabled',
      type: 'boolean',
      hint: 'Toggles this instance operational state without deleting its profile.'
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      hint: 'Document the purpose and owner of this instance for operational clarity.'
    }
  ];

  async function load() {
    loading = true;
    try {
      const [sData, tData] = await Promise.all([
        api.get('/vpn/openvpn'),
        api.get('/vpn/tunnels')
      ]);
      const s = asObject(sData);
      settings = {
        enabled: Boolean(s.enabled ?? settingsDefaults.enabled),
        mode: String(s.mode ?? settingsDefaults.mode),
        protocol: String(s.protocol ?? settingsDefaults.protocol),
        port: Number(s.port ?? settingsDefaults.port),
        device: String(s.device ?? settingsDefaults.device),
        topology: String(s.topology ?? settingsDefaults.topology),
        network: String(s.network ?? settingsDefaults.network),
        cipher: String(s.cipher ?? settingsDefaults.cipher),
        auth: String(s.auth ?? settingsDefaults.auth),
        tlsAuth: Boolean(s.tlsAuth ?? settingsDefaults.tlsAuth),
        dhParams: String(s.dhParams ?? s.dh_params ?? ''),
        caCert: String(s.caCert ?? s.ca_cert ?? ''),
        serverCert: String(s.serverCert ?? s.server_cert ?? ''),
        tlsCrypt: Boolean(s.tlsCrypt ?? s.tls_crypt ?? settingsDefaults.tlsCrypt),
        compression: String(s.compression ?? settingsDefaults.compression),
        dnsPush: Boolean(s.dnsPush ?? s.dns_push ?? settingsDefaults.dnsPush),
        dnsServers: String(s.dnsServers ?? s.dns_servers ?? s.pushDns ?? settingsDefaults.dnsServers),
        redirectGateway: Boolean(s.redirectGateway ?? s.redirect_gateway ?? settingsDefaults.redirectGateway),
        maxClients: Number(s.maxClients ?? settingsDefaults.maxClients),
        clientToClient: Boolean(s.clientToClient ?? settingsDefaults.clientToClient),
        duplicateCn: Boolean(s.duplicateCn ?? settingsDefaults.duplicateCn),
        keepalive: String(s.keepalive ?? settingsDefaults.keepalive),
        keepaliveInterval: Number(s.keepaliveInterval ?? s.keepalive_interval ?? settingsDefaults.keepaliveInterval),
        keepaliveTimeout: Number(s.keepaliveTimeout ?? s.keepalive_timeout ?? settingsDefaults.keepaliveTimeout),
        persistKey: Boolean(s.persistKey ?? s.persist_key ?? settingsDefaults.persistKey),
        persistTun: Boolean(s.persistTun ?? s.persist_tun ?? settingsDefaults.persistTun),
        verbosity: Number(s.verbosity ?? settingsDefaults.verbosity),
        verb: Number(s.verb ?? s.verbosity ?? settingsDefaults.verb),
        pushRoutes: String(s.pushRoutes ?? settingsDefaults.pushRoutes),
        pushDns: String(s.pushDns ?? settingsDefaults.pushDns),
        tlsCipher: String(s.tlsCipher ?? settingsDefaults.tlsCipher),
        renegSec: Number(s.renegSec ?? settingsDefaults.renegSec),
        fragment: Number(s.fragment ?? settingsDefaults.fragment),
        mssfix: Number(s.mssfix ?? settingsDefaults.mssfix)
      };
      tunnels = asList(tData).map((t: unknown) => {
        const r = asObject(t);
        return {
          name: String(r.name ?? ''), type: String(r.type ?? ''),
          remoteEndpoint: String(r.remoteEndpoint ?? r.remote ?? ''),
          status: String(r.status ?? ''), latency: String(r.latency ?? ''),
          txBytes: String(r.txBytes ?? ''), rxBytes: String(r.rxBytes ?? ''),
          lastHandshake: String(r.lastHandshake ?? '')
        };
      });
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load OpenVPN data');
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    savingSettings = true;
    try { await api.patch('/vpn/openvpn', settings); toasts.success($_('vpn_openvpn.toast_openvpn_settings_saved')); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { savingSettings = false; }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-slate-100"><ShieldIcon class="size-4" /> OpenVPN Settings</CardTitle>
      <CardDescription class="text-slate-400">Global OpenVPN configuration — mode, encryption, network, and authentication parameters.</CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-2"><Skeleton class="h-9 bg-slate-800" /><Skeleton class="h-9 bg-slate-800" /><Skeleton class="h-9 bg-slate-800" /></div>
      {:else}
        <form class="grid gap-4 md:grid-cols-2 lg:grid-cols-3" onsubmit={(e) => { e.preventDefault(); void saveSettings(); }}>
          <div class="space-y-1">
            <FieldLabel label="Enabled" hint="Master switch for the OpenVPN service." />
            <div class="flex h-9 items-center gap-3">
              <Switch checked={settings.enabled} onCheckedChange={(v) => (settings.enabled = v)} />
              <span class="text-xs" class:text-emerald-400={settings.enabled} class:text-slate-500={!settings.enabled}>{settings.enabled ? 'Active' : 'Disabled'}</span>
            </div>
          </div>
          <div class="space-y-1">
            <FieldLabel label="Mode" hint="Server mode accepts incoming client connections." />
            <Select.Root type="single" value={settings.mode} onValueChange={(v) => { if (v) settings.mode = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                <span>{modeOptions.find((o) => o.value === settings.mode)?.label ?? 'Select...'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each modeOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1">
            <FieldLabel label="Protocol" hint="UDP is faster with lower overhead and recommended for most VPN deployments." />
            <Select.Root type="single" value={settings.protocol} onValueChange={(v) => { if (v) settings.protocol = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                <span>{protoOptions.find((o) => o.value === settings.protocol)?.label ?? 'Select...'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each protoOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1">
            <FieldLabel label="Port" hint="Listening port for incoming OpenVPN connections. Default is 1194/UDP." />
            <Input class="border-slate-700 bg-slate-900" type="number" bind:value={settings.port} min={1} max={65535} />
          </div>
          <div class="space-y-1">
            <FieldLabel label="Device Type" hint="TUN creates a Layer 3 routed tunnel (most common)." />
            <Select.Root type="single" value={settings.device} onValueChange={(v) => { if (v) settings.device = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                <span>{deviceOptions.find((o) => o.value === settings.device)?.label ?? 'Select...'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each deviceOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1">
            <FieldLabel label="Tunnel Network" hint="Private subnet assigned to the VPN tunnel." />
            <Input class="border-slate-700 bg-slate-900" bind:value={settings.network} placeholder="10.8.0.0/24" />
          </div>
          <div class="space-y-1">
            <FieldLabel label="Cipher" hint="Encryption algorithm for the data channel." />
            <Select.Root type="single" value={settings.cipher} onValueChange={(v) => { if (v) settings.cipher = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                <span>{cipherOptions.find((o) => o.value === settings.cipher)?.label ?? 'Select...'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each cipherOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1">
            <FieldLabel label="Auth Digest" hint="HMAC digest algorithm for packet authentication." />
            <Select.Root type="single" value={settings.auth} onValueChange={(v) => { if (v) settings.auth = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                <span>{authOptions.find((o) => o.value === settings.auth)?.label ?? 'Select...'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each authOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1">
            <FieldLabel label="TLS Auth" hint="Add an extra HMAC signature to TLS control channel packets." />
            <div class="flex h-9 items-center gap-3">
              <Switch checked={settings.tlsAuth} onCheckedChange={(v) => (settings.tlsAuth = v)} class="cursor-pointer" />
              <span class="text-xs" class:text-emerald-400={settings.tlsAuth} class:text-slate-500={!settings.tlsAuth}>{settings.tlsAuth ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          <div class="md:col-span-2 lg:col-span-3">
            <button type="button" class="flex cursor-pointer items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300" onclick={() => (showAdvanced = !showAdvanced)}>
              {#if showAdvanced}<ChevronDownIcon class="size-3.5" />{:else}<ChevronRightIcon class="size-3.5" />{/if}
              Advanced Settings
            </button>
          </div>
          {#if showAdvanced}
            <div class="space-y-1">
              <FieldLabel label="Verbosity" hint="Log verbosity level 0-11." />
              <select
              bind:value={settings.verbosity}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
              <option value="11">11</option>
            </select>
            </div>
            <div class="space-y-1">
              <FieldLabel label="Push Routes" hint="Routes pushed to VPN clients." />
              <Input class="border-slate-700 bg-slate-900" bind:value={settings.pushRoutes} placeholder="192.168.1.0/24" />
            </div>
            <div class="space-y-1">
              <FieldLabel label="Push DNS" hint="DNS servers pushed to VPN clients." />
              <Input class="border-slate-700 bg-slate-900" bind:value={settings.pushDns} placeholder="10.0.0.1" />
            </div>
          {/if}

          <div class="md:col-span-2 lg:col-span-3">
            <Button type="submit" class="bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer" disabled={savingSettings}>
              <SaveIcon class="mr-1 size-4" /> {savingSettings ? 'Saving...' : 'Save OpenVPN Settings'}
            </Button>
          </div>
        </form>
      {/if}
    </CardContent>
  </Card>

  <ResourceTable
    title="{$_('vpn_openvpn.openvpn_instances')}"
    description={$_('vpn_openvpn.descriptionruntime_state_for_active_server_and_cli')}
    endpoint="/vpn/openvpn/instances"
    columns={columns}
    fields={fields}
    idKey="name"
    addLabel={$_('vpn_openvpn.addlabeladd_instance')}
  />

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('vpn_openvpn.tunnel_status')}</CardTitle>
          <CardDescription class="text-slate-400">Live tunnel telemetry, handshake health, and traffic counters.</CardDescription>
        </div>
        <Button variant="outline" size="sm" class="border-slate-700 text-slate-300 cursor-pointer" onclick={() => void load()}>
          <RefreshCcwIcon class="mr-1 size-3.5" /> Refresh
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if tunnels.length === 0}
        <p class="py-6 text-center text-sm text-slate-500">{$_('vpn_openvpn.no_tunnel_status_available')}</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-700 text-left text-xs text-slate-400">
              <tr>
                <th class="px-3 py-2">Name</th>
                <th class="px-3 py-2">Type</th>
                <th class="px-3 py-2">Remote</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Latency</th>
                <th class="px-3 py-2">TX</th>
                <th class="px-3 py-2">RX</th>
                <th class="px-3 py-2">Last Handshake</th>
              </tr>
            </thead>
            <tbody>
              {#each tunnels as t}
                <tr class="border-b border-slate-800 hover:bg-slate-800/30">
                  <td class="px-3 py-2 text-slate-100">{t.name}</td>
                  <td class="px-3 py-2 text-slate-300">{t.type}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-400">{t.remoteEndpoint}</td>
                  <td class="px-3 py-2"><StatusPill status={String(t.status ?? '')} /></td>
                  <td class="px-3 py-2 text-slate-300">{t.latency}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{t.txBytes}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{t.rxBytes}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-400">{t.lastHandshake}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
