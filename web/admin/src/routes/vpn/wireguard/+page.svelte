<!-- Route view for `/vpn/wireguard` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import SaveIcon from '@lucide/svelte/icons/save';
  import KeyRoundIcon from '@lucide/svelte/icons/key-round';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

  import { _ } from '$lib/i18n';
  type WireGuardConfig = {
    enabled: boolean; interface: string; listenPort: number; mtu: number; addresses: string;
    dnsServers: string; privateKey: string; publicKey: string; fwMark: string; table: string;
    preUp: string; postUp: string; preDown: string; postDown: string; saveConfig: boolean;
    routeAllTraffic: boolean; allowLocalLan: boolean; persistentKeepaliveDefault: number;
    description: string;
  };
  type TunnelStatus = {
    name: string; status: string; endpoint: string; latestHandshake: string;
    transferRx: string; transferTx: string; latency: string;
  };

  const roleOptions = [
    { label: 'Road Warrior Client', value: 'client' },
    { label: 'Site-to-Site Branch', value: 'site' },
    { label: 'Hub Spoke', value: 'hub' },
    { label: 'Partner Link', value: 'partner' }
  ];

  const tableOptions = [
    { label: 'Auto', value: 'auto' },
    { label: 'Off', value: 'off' },
    { label: 'Main', value: 'main' },
    { label: 'Default', value: 'default' }
  ];

  const operationalNotes = [
    'Generate keys only from trusted administrator sessions and rotate keys on personnel changes or endpoint compromise events.',
    'Use narrow Allowed IP ranges wherever possible.',
    'Set persistent keepalive only for NAT traversal and mobile endpoints.',
    'Document peer ownership and support contacts in descriptions.'
  ];

  const defaultWgConfig: WireGuardConfig = {
    enabled: false, interface: 'wg0', listenPort: 51820, mtu: 1420, addresses: '10.10.10.1/24',
    dnsServers: '1.1.1.1,9.9.9.9', privateKey: '', publicKey: '', fwMark: '0xca6c', table: 'auto',
    preUp: '', postUp: '', preDown: '', postDown: '', saveConfig: false, routeAllTraffic: false,
    allowLocalLan: true, persistentKeepaliveDefault: 25, description: ''
  };

  let loading = $state(true);
  let savingWg = $state(false);
  let lastError = $state('');
  let showGuidance = $state(false);
  let showWgAdvanced = $state(false);
  let wgConfig = $state<WireGuardConfig>({ ...defaultWgConfig });
  let tunnelStatus = $state<TunnelStatus[]>([]);
  let interfaceOptions = $state<{ label: string; value: string }[]>([]);
  let peerCount = $state(0);

  const columns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'endpointHost', label: 'Endpoint' },
    { key: 'allowedIps', label: 'Allowed IPs' },
    { key: 'enabled', label: 'Enabled' }
  ];

  const fields: FormField[] = [
    { key: 'name', label: 'Peer Name', type: 'text', required: true, hint: 'Unique identifier used for updates.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Controls whether this peer is active.' },
    { key: 'role', label: 'Peer Role', type: 'select', options: roleOptions, hint: 'Role categorization for deployment templates.' },
    { key: 'publicKey', label: 'Public Key', type: 'text', required: true, hint: 'Remote peer public key.' },
    { key: 'presharedKey', label: 'Preshared Key', type: 'text', hint: 'Optional symmetric key.' },
    { key: 'endpointHost', label: 'Endpoint Host', type: 'text', hint: 'Remote endpoint hostname or IP.' },
    { key: 'endpointPort', label: 'Endpoint Port', type: 'number', hint: 'Remote UDP port.' },
    { key: 'allowedIps', label: 'Allowed IPs', type: 'text', required: true, hint: 'CIDR ranges routed through this peer.' },
    { key: 'localAddress', label: 'Local Address', type: 'text', hint: 'Client-side interface address.' },
    { key: 'dns', label: 'Peer DNS', type: 'text', hint: 'DNS resolvers for peer profile.' },
    { key: 'mtu', label: 'Peer MTU', type: 'number', hint: 'Peer-specific tunnel MTU.' },
    { key: 'persistentKeepalive', label: 'Persistent Keepalive', type: 'number', hint: 'Seconds between keepalive packets.' },
    { key: 'allowedApps', label: 'Allowed Applications', type: 'text', hint: 'Application tags allowed for this peer.' },
    { key: 'tableOff', label: 'Table Off', type: 'boolean', hint: 'Disables automatic route installation.' },
    { key: 'useTunnelDns', label: 'Use Tunnel DNS', type: 'boolean', hint: 'Forces DNS preference to tunnel resolvers.' },
    { key: 'autoStart', label: 'Auto Start', type: 'boolean', hint: 'Automatically enables peer in profiles.' },
    { key: 'monitorTarget', label: 'Monitor Target', type: 'text', hint: 'Probe destination for peer health checks.' },
    { key: 'monitorInterval', label: 'Monitor Interval', type: 'number', hint: 'Seconds between active monitor probes.' },
    { key: 'monitorTimeout', label: 'Monitor Timeout', type: 'number', hint: 'Probe timeout in seconds.' },
    { key: 'description', label: 'Description', type: 'text', hint: 'Operational context for this peer.' }
  ];

  function randomBytesBase64(length: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let binary = '';
    for (const value of bytes) binary += String.fromCharCode(value);
    return btoa(binary);
  }

  function regenerateInterfaceKeys() {
    wgConfig.privateKey = randomBytesBase64(32);
    wgConfig.publicKey = randomBytesBase64(32);
    wgConfig = { ...wgConfig };
    toasts.success($_('vpn_wireguard.toast_generated_new_interface_key_pair'));
  }

  async function load() {
    loading = true;
    lastError = '';
    try {
      const [wgPayload, peerPayload, tunnelPayload] = await Promise.all([
        api.get('/vpn/wireguard'),
        api.get('/vpn/wireguard/peers'),
        api.get('/vpn/tunnels')
      ]);
      const raw = (wgPayload as Record<string, any>) ?? {};
      const ifaces = Array.isArray(raw.interfaces) ? raw.interfaces : [];
      const iface0 = ifaces[0] ?? {};
      wgConfig = {
        enabled: Boolean(raw.enabled),
        interface: String(iface0.name ?? 'wg0'),
        listenPort: Number(iface0.listen_port ?? 51820),
        mtu: Number(iface0.mtu ?? 1420),
        addresses: String(iface0.addresses ?? ''),
        dnsServers: String(iface0.dns ?? ''),
        privateKey: String(iface0.private_key ?? ''),
        publicKey: String(iface0.public_key ?? ''),
        fwMark: String(raw.fwMark ?? '0xca6c'),
        table: String(raw.table ?? 'auto'),
        preUp: String(raw.preUp ?? ''),
        postUp: String(raw.postUp ?? ''),
        preDown: String(raw.preDown ?? ''),
        postDown: String(raw.postDown ?? ''),
        saveConfig: Boolean(raw.saveConfig),
        routeAllTraffic: Boolean(raw.routeAllTraffic),
        allowLocalLan: Boolean(raw.allowLocalLan),
        persistentKeepaliveDefault: Number(raw.persistentKeepaliveDefault ?? 25),
        description: String(raw.description ?? '')
      };
      peerCount = Array.isArray(peerPayload) ? peerPayload.length : 0;
      tunnelStatus = (Array.isArray(tunnelPayload) ? tunnelPayload : []).map((row: any) => ({
        name: String(row.name ?? 'unknown'),
        status: String(row.status ?? 'unknown'),
        endpoint: String(row.endpoint ?? '-'),
        latestHandshake: String(row.latestHandshake ?? '-'),
        transferRx: String(row.transferRx ?? '-'),
        transferTx: String(row.transferTx ?? '-'),
        latency: String(row.latency ?? '-')
      }));
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Failed to load WireGuard data';
    } finally {
      loading = false;
    }
  }

  async function saveWireGuard() {
    savingWg = true;
    try {
      await api.put('/vpn/wireguard', wgConfig);
      toasts.success($_('vpn_wireguard.toast_wireguard_interface_settings_saved'));
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      savingWg = false;
    }
  }

  async function loadInterfaces() {
    try {
      const data = await api.get<any[]>('/interfaces');
      interfaceOptions = data.map((iface: any) => ({ label: iface.name || String(iface), value: iface.name || String(iface) }));
    } catch { interfaceOptions = []; }
  }

  onMount(() => { void load(); void loadInterfaces(); });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-700 bg-slate-900/95">
    <CardHeader class="space-y-3">
      <CardTitle class="text-cyan-400">{$_('vpn_wireguard.wireguard')}</CardTitle>
      <CardDescription class="text-slate-300">Deep WireGuard management with inline key workflows and peer CRUD.</CardDescription>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('vpn_wireguard.peers')}</p>
          <p class="text-lg font-semibold text-cyan-400">{peerCount}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('common.interface')}</p>
          <p class="text-sm font-semibold text-cyan-400">{wgConfig.interface}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" class="border-slate-700 text-slate-200 hover:bg-slate-800" onclick={() => void load()}>
          <RefreshCwIcon class="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>
    </CardHeader>
  </Card>

  <Card class="border-slate-700 bg-slate-900/95">
    <CardHeader>
      <CardTitle class="text-cyan-400">{$_('vpn_wireguard.operational_guidance')}</CardTitle>
      <CardDescription class="text-slate-300">Practice-oriented notes for stable and secure tunnel operations.</CardDescription>
    </CardHeader>
    <CardContent>
      <Collapsible.Root bind:open={showGuidance} class="rounded-md border border-slate-700 bg-slate-950/70 p-4">
        <Collapsible.Trigger class="flex w-full items-center justify-between text-left text-sm font-medium text-slate-200">
          Open deep guidance
          <ChevronDownIcon class={`h-4 w-4 text-cyan-400 transition-transform ${showGuidance ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content class="pt-4">
          <ul class="space-y-2 text-sm leading-6 text-slate-300">
            {#each operationalNotes as note}
              <li class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2">{note}</li>
            {/each}
          </ul>
        </Collapsible.Content>
      </Collapsible.Root>
    </CardContent>
  </Card>

  <Card class="border-slate-700 bg-slate-900/95">
    <CardHeader>
      <CardTitle class="text-cyan-400">{$_('vpn_wireguard.interface_configuration')}</CardTitle>
      <CardDescription class="text-slate-300">Core WireGuard interface settings.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void saveWireGuard(); }}>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div class="space-y-2">
            <FieldLabel label="Enabled" hint="Enable this WireGuard instance." />
            <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
              <Switch checked={wgConfig.enabled} onCheckedChange={(v) => (wgConfig.enabled = v)} />
              <span class="text-xs text-slate-300">{wgConfig.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
          <div class="space-y-2">
            <FieldLabel label="Interface Name" hint="Kernel interface name." />
            <select class="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" bind:value={wgConfig.interface}>
              {#each interfaceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
            </select>
          </div>
          <div class="space-y-2">
            <FieldLabel label="Listen Port" hint="UDP port used by remote peers." />
            <Input class="border-slate-700 bg-slate-950" type="number" bind:value={wgConfig.listenPort} />
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button type="button" variant="outline" class="border-slate-700 text-slate-200 hover:bg-slate-800" onclick={regenerateInterfaceKeys}>
            <KeyRoundIcon class="mr-2 h-4 w-4" />Generate Keys
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-500" type="submit" disabled={savingWg}>
            <SaveIcon class="mr-2 h-4 w-4" />{savingWg ? 'Saving...' : 'Save Interface Settings'}
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>

  <ResourceTable
    title="{$_('vpn_wireguard.wireguard_peers')}"
    description={$_('vpn_wireguard.descriptionmanage_wireguard_vpn_peer_connections_a')}
    endpoint="/vpn/wireguard/peers"
    columns={columns}
    fields={fields}
    idKey="name"
    addLabel={$_('vpn_wireguard.addlabeladd_peer')}
  />

  <Card class="border-slate-700 bg-slate-900/95">
    <CardHeader>
      <CardTitle class="text-cyan-400">{$_('vpn_wireguard.tunnel_status')}</CardTitle>
      <CardDescription class="text-slate-300">Live tunnel telemetry.</CardDescription>
    </CardHeader>
    <CardContent>
      {#if tunnelStatus.length === 0}
        <p class="py-6 text-center text-sm text-slate-500">{$_('vpn_wireguard.no_tunnel_status_available')}</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-700 text-left text-xs text-slate-400">
              <tr>
                <th class="px-3 py-2">Name</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Endpoint</th>
                <th class="px-3 py-2">Handshake</th>
                <th class="px-3 py-2">TX</th>
                <th class="px-3 py-2">RX</th>
              </tr>
            </thead>
            <tbody>
              {#each tunnelStatus as t}
                <tr class="border-b border-slate-800 hover:bg-slate-800/30">
                  <td class="px-3 py-2 text-slate-100">{t.name}</td>
                  <td class="px-3 py-2 text-slate-300">{t.status}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-400">{t.endpoint}</td>
                  <td class="px-3 py-2 text-slate-300">{t.latestHandshake}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{t.transferTx}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{t.transferRx}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
