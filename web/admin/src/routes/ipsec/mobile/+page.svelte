<!-- Route view for `/ipsec/mobile` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asObject } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import InfoIcon from '@lucide/svelte/icons/info';
  import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import SaveIcon from '@lucide/svelte/icons/save';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import { _ } from '$lib/i18n';

  type MobileConfig = {
    enabled: boolean;
    ike_version: string;
    interface: string;
    description: string;
    auth_method: string;
    server_cert: string;
    client_auth: string;
    eap_id: string;
    psk: string;
    virtual_ip_pool: string;
    dns_servers: string;
    wins_servers: string;
    default_domain: string;
    split_tunneling: boolean;
    split_networks: string;
    redirect_gateway: boolean;
    p1_encryption: string;
    p1_hash: string;
    p1_dh_group: string;
    p1_lifetime: string;
    p2_encryption: string;
    p2_hash: string;
    p2_pfs_group: string;
    p2_lifetime: string;
  };

  const defaultConfig: MobileConfig = {
    enabled: false,
    ike_version: 'ikev2',
    interface: '',
    description: '',
    auth_method: 'eap-mschapv2',
    server_cert: '',
    client_auth: 'local',
    eap_id: '',
    psk: '',
    virtual_ip_pool: '',
    dns_servers: '',
    wins_servers: '',
    default_domain: '',
    split_tunneling: false,
    split_networks: '',
    redirect_gateway: true,
    p1_encryption: 'aes256',
    p1_hash: 'sha256',
    p1_dh_group: 'modp2048',
    p1_lifetime: '28800',
    p2_encryption: 'aes256',
    p2_hash: 'sha256',
    p2_pfs_group: 'modp2048',
    p2_lifetime: '3600'
  };

  let config = $state<MobileConfig>({ ...defaultConfig });
  let loading = $state(true);
  let saving = $state(false);
  let loadError = $state('');
  let interfaceOptions = $state<{ label: string; value: string }[]>([]);
  let certOptions = $state<{ label: string; value: string }[]>([]);

  let showPhase1 = $state(false);
  let showPhase2 = $state(false);
  let showClientNetwork = $state(false);

  let statusBanner = $derived.by(() => {
    if (!config.enabled) {
      return { type: 'info' as const, message: 'IPsec Mobile VPN is disabled. Enable it to allow remote clients to connect via IKEv1/IKEv2.' };
    }
    if (!config.interface) {
      return { type: 'warning' as const, message: 'IPsec Mobile VPN is enabled but no listen interface is selected. Remote clients will not be able to connect.' };
    }
    if (!config.virtual_ip_pool) {
      return { type: 'warning' as const, message: 'IPsec Mobile VPN is enabled but no virtual IP pool is configured. Clients will not receive a tunnel IP address.' };
    }
    if (config.auth_method === 'psk' && !config.psk) {
      return { type: 'warning' as const, message: 'Pre-Shared Key authentication is selected but no PSK is configured.' };
    }
    return null;
  });

  function asText(value: unknown, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  function asBool(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value !== 0;
    return fallback;
  }

  function asCSV(value: unknown, fallback = ''): string {
    if (Array.isArray(value)) return (value as string[]).join(', ');
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  async function loadInterfaces() {
    try {
      const payload = await api.get('/interfaces');
      if (Array.isArray(payload)) {
        interfaceOptions = payload.map((iface: unknown) => {
          const obj = typeof iface === 'object' && iface !== null ? iface as Record<string, unknown> : {};
          const name = asText(obj.name || obj.interface || obj.id);
          const desc = asText(obj.description || obj.alias || '');
          return { label: desc ? `${name} (${desc})` : name, value: name };
        }).filter(o => o.value);
      } else if (typeof payload === 'object' && payload !== null) {
        interfaceOptions = Object.entries(payload as Record<string, unknown>).map(([key, val]) => {
          const desc = typeof val === 'object' && val !== null ? asText((val as Record<string, unknown>).description || '') : '';
          return { label: desc ? `${key} (${desc})` : key, value: key };
        });
      }
    } catch {
      interfaceOptions = [];
    }
  }

  async function loadCertificates() {
    try {
      const payload = await api.get('/certificates');
      if (Array.isArray(payload)) {
        certOptions = payload.map((cert: unknown) => {
          const obj = typeof cert === 'object' && cert !== null ? cert as Record<string, unknown> : {};
          const name = asText(obj.name || obj.cn || obj.id);
          const issuer = asText(obj.issuer || '');
          return { label: issuer ? `${name} (${issuer})` : name, value: name };
        }).filter(o => o.value);
      }
    } catch {
      certOptions = [];
    }
  }

  async function loadConfig() {
    loading = true;
    loadError = '';
    try {
      const payload = asObject(await api.get('/ipsec/mobile'));
      config = {
        enabled: asBool(payload.enabled, defaultConfig.enabled),
        ike_version: asText(payload.ike_version || payload.ikeVersion, 'ikev2'),
        interface: asText(payload.interface),
        description: asText(payload.description),
        auth_method: asText(payload.auth_method || payload.authMethod, 'eap-mschapv2'),
        server_cert: asText(payload.server_cert || payload.serverCert),
        client_auth: asText(payload.client_auth || payload.clientAuth, 'local'),
        eap_id: asText(payload.eap_id || payload.eapId),
        psk: asText(payload.psk),
        virtual_ip_pool: asText(payload.virtual_ip_pool || payload.virtualIpPool),
        dns_servers: asCSV(payload.dns_servers ?? payload.dnsServers),
        wins_servers: asCSV(payload.wins_servers ?? payload.winsServers),
        default_domain: asText(payload.default_domain || payload.defaultDomain),
        split_tunneling: asBool(payload.split_tunneling ?? payload.splitTunneling, false),
        split_networks: asCSV(payload.split_networks ?? payload.splitNetworks),
        redirect_gateway: asBool(payload.redirect_gateway ?? payload.redirectGateway, true),
        p1_encryption: asText(payload.p1_encryption || asObject(payload.phase1)?.encryption, 'aes256'),
        p1_hash: asText(payload.p1_hash || asObject(payload.phase1)?.hash, 'sha256'),
        p1_dh_group: asText(payload.p1_dh_group || asObject(payload.phase1)?.dh_group, 'modp2048'),
        p1_lifetime: asText(payload.p1_lifetime || asObject(payload.phase1)?.lifetime, '28800'),
        p2_encryption: asText(payload.p2_encryption || asObject(payload.phase2)?.encryption, 'aes256'),
        p2_hash: asText(payload.p2_hash || asObject(payload.phase2)?.hash, 'sha256'),
        p2_pfs_group: asText(payload.p2_pfs_group || asObject(payload.phase2)?.pfs_group, 'modp2048'),
        p2_lifetime: asText(payload.p2_lifetime || asObject(payload.phase2)?.lifetime, '3600')
      };
      // Auto-expand sections with non-default values
      if (config.virtual_ip_pool || config.dns_servers || config.split_tunneling) showClientNetwork = true;
      if (config.p1_encryption !== 'aes256' || config.p1_hash !== 'sha256' || config.p1_dh_group !== 'modp2048') showPhase1 = true;
      if (config.p2_encryption !== 'aes256' || config.p2_hash !== 'sha256' || config.p2_pfs_group !== 'modp2048') showPhase2 = true;
    } catch (e) {
      config = { ...defaultConfig };
      loadError = e instanceof Error ? e.message : 'Unable to load IPsec Mobile VPN settings';
    } finally {
      loading = false;
    }
  }

  function splitCsv(val: string): string[] {
    return val.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  }

  async function saveConfig() {
    saving = true;
    try {
      const payload: Record<string, unknown> = {
        enabled: config.enabled,
        ike_version: config.ike_version,
        interface: config.interface || null,
        description: config.description || null,
        auth_method: config.auth_method,
        server_cert: config.server_cert || null,
        client_auth: config.client_auth,
        eap_id: config.eap_id || null,
        psk: config.psk || null,
        virtual_ip_pool: config.virtual_ip_pool || null,
        dns_servers: splitCsv(config.dns_servers),
        wins_servers: splitCsv(config.wins_servers),
        default_domain: config.default_domain || null,
        split_tunneling: config.split_tunneling,
        split_networks: splitCsv(config.split_networks),
        redirect_gateway: config.redirect_gateway,
        phase1: {
          encryption: config.p1_encryption,
          hash: config.p1_hash,
          dh_group: config.p1_dh_group,
          lifetime: Number(config.p1_lifetime || 28800)
        },
        phase2: {
          encryption: config.p2_encryption,
          hash: config.p2_hash,
          pfs_group: config.p2_pfs_group,
          lifetime: Number(config.p2_lifetime || 3600)
        }
      };
      await api.patch('/ipsec/mobile', payload);
      toasts.success($_('ipsec_mobile.toastipsec_mobile_vpn_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save IPsec Mobile VPN settings');
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    loadConfig();
    loadInterfaces();
    loadCertificates();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/50">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-lg text-slate-100">{$_('ipsec_mobile.ipsec_mobile_clients')}</CardTitle>
          <CardDescription class="text-slate-400">
            Configure IPsec remote access VPN for mobile and road-warrior clients. Supports IKEv1/IKEv2 with
            EAP, PSK, or certificate-based authentication.
          </CardDescription>
        </div>
        <div class="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            class="border-slate-700 text-slate-300 hover:bg-slate-800"
            onclick={() => { loadConfig(); loadInterfaces(); loadCertificates(); }}
            disabled={loading}
          >
            <RefreshCwIcon class="mr-1.5 h-3.5 w-3.5" />
            Reload
          </Button>
          <Button
            size="sm"
            class="bg-cyan-600 hover:bg-cyan-700 text-white"
            onclick={saveConfig}
            disabled={saving || loading}
          >
            <SaveIcon class="mr-1.5 h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      {#if loadError}
        <div class="rounded-lg border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
          {loadError}
        </div>
      {/if}

      {#if loading}
        <div class="flex items-center justify-center py-12 text-slate-400">
          <RefreshCwIcon class="mr-2 h-4 w-4 animate-spin" />
          Loading IPsec Mobile VPN settings...
        </div>
      {:else}
        <!-- Status Banner -->
        {#if statusBanner}
          <div class="rounded-lg border p-4 text-sm flex items-start gap-3
            {statusBanner.type === 'info' ? 'border-blue-800/50 bg-blue-950/30 text-blue-300' : 'border-amber-800/50 bg-amber-950/30 text-amber-300'}">
            {#if statusBanner.type === 'info'}
              <InfoIcon class="h-4 w-4 mt-0.5 shrink-0" />
            {:else}
              <AlertTriangleIcon class="h-4 w-4 mt-0.5 shrink-0" />
            {/if}
            <span>{statusBanner.message}</span>
          </div>
        {/if}

        <!-- Enable Toggle -->
        <div class="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
          <div class="flex items-center justify-between">
            <div>
              <FieldLabel label="IPsec Mobile VPN" hint="Enable or disable the IPsec remote access VPN server. When enabled, the firewall accepts incoming IKE negotiations from mobile/road-warrior clients on the selected interface. Clients use native OS VPN clients (Windows, macOS, iOS, Android) or strongSwan to connect." />
            </div>
            <div class="flex h-9 items-center gap-3">
              <Switch checked={config.enabled} onCheckedChange={(c) => config.enabled = c} />
              <span class="text-xs font-medium min-w-[60px]" class:text-emerald-400={config.enabled} class:text-slate-500={!config.enabled}>
                {config.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <!-- General Settings -->
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-slate-300">{$_('ipsec_mobile.general')}</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel label="IKE Version" hint="The Internet Key Exchange protocol version. IKEv2 (RFC 7296) is recommended — it's faster, more reliable, supports MOBIKE for seamless roaming, and is natively supported by all modern operating systems. IKEv1 (RFC 2409) is only needed for legacy devices that don't support IKEv2." />
              <Select.Root type="single" value={config.ike_version} onValueChange={(v) => { if (v) config.ike_version = v; }}>
                <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{config.ike_version === 'ikev2' ? 'IKEv2 (Recommended)' : config.ike_version === 'ikev1' ? 'IKEv1 (Legacy)' : 'Select...'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  <Select.Item value="ikev2" label="IKEv2 (Recommended)" class="cursor-pointer hover:bg-slate-800" />
                  <Select.Item value="ikev1" label="IKEv1 (Legacy)" class="cursor-pointer hover:bg-slate-800" />
                </Select.Content>
              </Select.Root>
            </div>
            <div>
              <FieldLabel label="Listen Interface" hint="The network interface on which the IPsec daemon listens for incoming IKE connections (UDP ports 500 and 4500). Typically your WAN interface. Remote clients must be able to reach this interface's IP address." />
              <Select.Root type="single" value={config.interface} onValueChange={(v) => { if (v) config.interface = v; }}>
                <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{config.interface ? interfaceOptions.find(o => o.value === config.interface)?.label || config.interface : '— Select interface —'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each interfaceOptions as opt}
                    <Select.Item value={opt.value} label={opt.label} class="cursor-pointer hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
          <div>
            <FieldLabel label="Description" hint="Optional description for this mobile VPN configuration. Helps identify the purpose (e.g. 'Employee Remote Access', 'Contractor VPN')." />
            <Input
              class="border-slate-700 bg-slate-950 text-slate-100"
              placeholder="e.g. Employee Remote Access VPN"
              value={config.description}
              oninput={(e) => config.description = (e.currentTarget as HTMLInputElement).value}
            />
          </div>
        </div>

        <!-- Authentication -->
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-slate-300">{$_('ipsec_mobile.authentication')}</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel label="Authentication Method" hint="How the VPN server authenticates remote clients. EAP-MSCHAPv2 — username/password via EAP, works with Windows native VPN client. EAP-TLS — client certificate via EAP, strongest security. EAP-RADIUS — delegates authentication to an external RADIUS server. PSK — Pre-Shared Key, simplest but least secure. Certificate — mutual certificate authentication without EAP." />
              <Select.Root type="single" value={config.auth_method} onValueChange={(v) => { if (v) config.auth_method = v; }}>
                <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{
                    config.auth_method === 'eap-mschapv2' ? 'EAP-MSCHAPv2' :
                    config.auth_method === 'eap-tls' ? 'EAP-TLS' :
                    config.auth_method === 'eap-radius' ? 'EAP-RADIUS' :
                    config.auth_method === 'psk' ? 'Pre-Shared Key' :
                    config.auth_method === 'certificate' ? 'Certificate' :
                    'Select method...'
                  }</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  <Select.Item value="eap-mschapv2" label="EAP-MSCHAPv2" class="cursor-pointer hover:bg-slate-800" />
                  <Select.Item value="eap-tls" label="EAP-TLS" class="cursor-pointer hover:bg-slate-800" />
                  <Select.Item value="eap-radius" label="EAP-RADIUS" class="cursor-pointer hover:bg-slate-800" />
                  <Select.Item value="psk" label="Pre-Shared Key" class="cursor-pointer hover:bg-slate-800" />
                  <Select.Item value="certificate" label="Certificate" class="cursor-pointer hover:bg-slate-800" />
                </Select.Content>
              </Select.Root>
            </div>
            <div>
              <FieldLabel label="Server Certificate" hint="The X.509 certificate presented by the VPN server during IKE negotiation. Clients verify this certificate to ensure they're connecting to the genuine server (prevents man-in-the-middle attacks). Select a certificate from the Certificate Store, or use the Internal CA to generate one." />
              <Select.Root type="single" value={config.server_cert} onValueChange={(v) => { if (v) config.server_cert = v; }}>
                <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{config.server_cert ? certOptions.find(o => o.value === config.server_cert)?.label || config.server_cert : '— Select certificate —'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each certOptions as opt}
                    <Select.Item value={opt.value} label={opt.label} class="cursor-pointer hover:bg-slate-800" />
                  {/each}
                  {#if certOptions.length === 0}
                    <div class="px-3 py-2 text-xs text-slate-500">No certificates found. Create one under Security → Certificates.</div>
                  {/if}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel label="Client Authentication Backend" hint="Where user credentials are verified. 'Local' uses the firewall's local user database (Users page). 'RADIUS' forwards authentication to an external RADIUS server (configure under Services → AAA → RADIUS). 'LDAP' authenticates against an LDAP/Active Directory server (configure under Services → AAA → LDAP)." />
              <Select.Root type="single" value={config.client_auth} onValueChange={(v) => { if (v) config.client_auth = v; }}>
                <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{
                    config.client_auth === 'local' ? 'Local Database' :
                    config.client_auth === 'radius' ? 'RADIUS Server' :
                    config.client_auth === 'ldap' ? 'LDAP / Active Directory' :
                    'Select...'
                  }</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  <Select.Item value="local" label="Local Database" class="cursor-pointer hover:bg-slate-800" />
                  <Select.Item value="radius" label="RADIUS Server" class="cursor-pointer hover:bg-slate-800" />
                  <Select.Item value="ldap" label="LDAP / Active Directory" class="cursor-pointer hover:bg-slate-800" />
                </Select.Content>
              </Select.Root>
            </div>
            {#if config.auth_method.startsWith('eap')}
              <div>
                <FieldLabel label="EAP Identity" hint="The server identity string presented during EAP authentication. Usually the FQDN of the firewall or its WAN IP. Clients may need to match this in their VPN profile. Leave empty to use the server certificate's CN or SAN as identity." />
                <Input
                  class="border-slate-700 bg-slate-950 text-slate-100"
                  placeholder="e.g. vpn.example.com"
                  value={config.eap_id}
                  oninput={(e) => config.eap_id = (e.currentTarget as HTMLInputElement).value}
                />
              </div>
            {/if}
            {#if config.auth_method === 'psk'}
              <div>
                <FieldLabel label="Pre-Shared Key" hint="The shared secret used to authenticate both the server and clients. Must be identical on the server and all client VPN profiles. Use a strong, random string (minimum 20 characters recommended). PSK is the simplest method but offers weaker identity verification than certificates." />
                <Input
                  class="border-slate-700 bg-slate-950 text-slate-100"
                  type="password"
                  placeholder={$_('ipsec_mobile.placeholderenter_shared_secret')}
                  value={config.psk}
                  oninput={(e) => config.psk = (e.currentTarget as HTMLInputElement).value}
                />
              </div>
            {/if}
          </div>
        </div>

        <!-- Client Network (Collapsible) -->
        <div class="rounded-lg border border-slate-700/50">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/30 transition-colors"
            onclick={() => showClientNetwork = !showClientNetwork}
          >
            <span>{$_('ipsec_mobile.client_network_settings')}</span>
            {#if showClientNetwork}
              <ChevronDownIcon class="h-4 w-4 text-slate-500" />
            {:else}
              <ChevronRightIcon class="h-4 w-4 text-slate-500" />
            {/if}
          </button>
          {#if showClientNetwork}
            <div class="space-y-4 border-t border-slate-700/50 px-4 py-4">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Virtual IP Pool" hint="CIDR range used to assign tunnel IP addresses to connected VPN clients. Each client gets a unique IP from this pool. Must not overlap with any existing LAN subnets. Example: '10.10.10.0/24' supports up to 254 concurrent clients. Alternatively, reference a named pool from IPsec → Address Pools." />
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-100"
                    placeholder="e.g. 10.10.10.0/24"
                    value={config.virtual_ip_pool}
                    oninput={(e) => config.virtual_ip_pool = (e.currentTarget as HTMLInputElement).value}
                  />
                </div>
                <div>
                  <FieldLabel label="DNS Servers" hint="Comma-separated DNS server IPs pushed to VPN clients via IKEv2 Configuration Payload (CP) or Mode Config (IKEv1). Clients use these DNS servers while connected. Typically the firewall's LAN IP (if running DNS resolver) or internal DNS servers. Example: '192.168.1.1, 10.0.0.53'." />
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-100"
                    placeholder="e.g. 192.168.1.1, 10.0.0.53"
                    value={config.dns_servers}
                    oninput={(e) => config.dns_servers = (e.currentTarget as HTMLInputElement).value}
                  />
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="WINS Servers" hint="Comma-separated WINS (NetBIOS name resolution) server IPs pushed to clients. Only needed in legacy Windows environments that rely on NetBIOS/WINS for network browsing. Leave empty for modern networks." />
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-100"
                    placeholder="e.g. 192.168.1.10"
                    value={config.wins_servers}
                    oninput={(e) => config.wins_servers = (e.currentTarget as HTMLInputElement).value}
                  />
                </div>
                <div>
                  <FieldLabel label="Default Domain" hint="DNS search domain pushed to VPN clients. Clients append this domain to unqualified hostnames. Example: 'corp.example.com' means a lookup for 'intranet' becomes 'intranet.corp.example.com'." />
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-100"
                    placeholder="e.g. corp.example.com"
                    value={config.default_domain}
                    oninput={(e) => config.default_domain = (e.currentTarget as HTMLInputElement).value}
                  />
                </div>
              </div>

              <!-- Routing -->
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Redirect Gateway (Full Tunnel)" hint="When enabled, all client traffic (including internet-bound) is routed through the VPN tunnel. This provides maximum security but increases bandwidth usage on the VPN server. When disabled, only traffic to specified split-tunnel networks goes through the VPN." />
                  <div class="flex h-9 items-center gap-3 mt-1">
                    <Switch checked={config.redirect_gateway} onCheckedChange={(c) => config.redirect_gateway = c} />
                    <span class="text-xs" class:text-emerald-400={config.redirect_gateway} class:text-slate-500={!config.redirect_gateway}>
                      {config.redirect_gateway ? 'Full Tunnel' : 'Split Tunnel'}
                    </span>
                  </div>
                </div>
                <div>
                  <FieldLabel label="Split Tunneling" hint="When enabled, only traffic destined for the specified networks is sent through the VPN tunnel — all other traffic uses the client's local internet connection. This reduces VPN bandwidth usage but exposes clients to their local network. Only effective when 'Redirect Gateway' is disabled." />
                  <div class="flex h-9 items-center gap-3 mt-1">
                    <Switch checked={config.split_tunneling} onCheckedChange={(c) => config.split_tunneling = c} />
                    <span class="text-xs" class:text-emerald-400={config.split_tunneling} class:text-slate-500={!config.split_tunneling}>
                      {config.split_tunneling ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
              {#if config.split_tunneling}
                <div>
                  <FieldLabel label="Split Tunnel Networks" hint="Comma-separated list of CIDR networks that should be routed through the VPN tunnel when split tunneling is enabled. Only traffic to these networks goes through the VPN — everything else uses the client's local gateway. Example: '192.168.1.0/24, 10.0.0.0/8, 172.16.0.0/12'." />
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-100"
                    placeholder="e.g. 192.168.1.0/24, 10.0.0.0/8"
                    value={config.split_networks}
                    oninput={(e) => config.split_networks = (e.currentTarget as HTMLInputElement).value}
                  />
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Phase 1 IKE Proposals (Collapsible) -->
        <div class="rounded-lg border border-slate-700/50">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/30 transition-colors"
            onclick={() => showPhase1 = !showPhase1}
          >
            <span>{$_('ipsec_mobile.phase_1_ike_proposals')}</span>
            {#if showPhase1}
              <ChevronDownIcon class="h-4 w-4 text-slate-500" />
            {:else}
              <ChevronRightIcon class="h-4 w-4 text-slate-500" />
            {/if}
          </button>
          {#if showPhase1}
            <div class="space-y-4 border-t border-slate-700/50 px-4 py-4">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Encryption Algorithm" hint="The symmetric cipher used for IKE SA encryption (Phase 1). AES-256 is the recommended default, providing strong 256-bit encryption. AES-128 offers faster performance with adequate security. ChaCha20-Poly1305 is excellent for ARM devices without AES-NI hardware acceleration." />
                  <Select.Root type="single" value={config.p1_encryption} onValueChange={(v) => { if (v) config.p1_encryption = v; }}>
                    <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                      <span>{
                        config.p1_encryption === 'aes256' ? 'AES-256-CBC' :
                        config.p1_encryption === 'aes128' ? 'AES-128-CBC' :
                        config.p1_encryption === 'aes256gcm16' ? 'AES-256-GCM-16' :
                        config.p1_encryption === 'aes128gcm16' ? 'AES-128-GCM-16' :
                        config.p1_encryption === 'chacha20poly1305' ? 'ChaCha20-Poly1305' :
                        config.p1_encryption || 'Select...'
                      }</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                      <Select.Item value="aes256" label="AES-256-CBC" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="aes128" label="AES-128-CBC" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="aes256gcm16" label="AES-256-GCM-16" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="aes128gcm16" label="AES-128-GCM-16" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="chacha20poly1305" label="ChaCha20-Poly1305" class="cursor-pointer hover:bg-slate-800" />
                    </Select.Content>
                  </Select.Root>
                </div>
                <div>
                  <FieldLabel label="Hash Algorithm" hint="The pseudo-random function (PRF) and integrity algorithm for IKE SA. SHA-256 is the recommended default. SHA-384 and SHA-512 provide stronger integrity at the cost of slightly higher CPU usage. SHA-1 is deprecated — only use for legacy device compatibility." />
                  <Select.Root type="single" value={config.p1_hash} onValueChange={(v) => { if (v) config.p1_hash = v; }}>
                    <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                      <span>{
                        config.p1_hash === 'sha256' ? 'SHA-256' :
                        config.p1_hash === 'sha384' ? 'SHA-384' :
                        config.p1_hash === 'sha512' ? 'SHA-512' :
                        config.p1_hash === 'sha1' ? 'SHA-1 (Deprecated)' :
                        config.p1_hash || 'Select...'
                      }</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                      <Select.Item value="sha256" label="SHA-256" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="sha384" label="SHA-384" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="sha512" label="SHA-512" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="sha1" label="SHA-1 (Deprecated)" class="cursor-pointer hover:bg-slate-800" />
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="DH Group" hint="The Diffie-Hellman group used for key exchange during IKE Phase 1. Higher groups provide stronger security but require more CPU. MODP-2048 (Group 14) is the minimum recommended. ECP-256 and ECP-384 use elliptic curves for better performance at equivalent security levels." />
                  <Select.Root type="single" value={config.p1_dh_group} onValueChange={(v) => { if (v) config.p1_dh_group = v; }}>
                    <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                      <span>{
                        config.p1_dh_group === 'modp2048' ? 'MODP-2048 (Group 14)' :
                        config.p1_dh_group === 'modp3072' ? 'MODP-3072 (Group 15)' :
                        config.p1_dh_group === 'modp4096' ? 'MODP-4096 (Group 16)' :
                        config.p1_dh_group === 'ecp256' ? 'ECP-256 (Group 19)' :
                        config.p1_dh_group === 'ecp384' ? 'ECP-384 (Group 20)' :
                        config.p1_dh_group || 'Select...'
                      }</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                      <Select.Item value="modp2048" label="MODP-2048 (Group 14)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="modp3072" label="MODP-3072 (Group 15)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="modp4096" label="MODP-4096 (Group 16)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="ecp256" label="ECP-256 (Group 19)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="ecp384" label="ECP-384 (Group 20)" class="cursor-pointer hover:bg-slate-800" />
                    </Select.Content>
                  </Select.Root>
                </div>
                <div>
                  <FieldLabel label="Lifetime (seconds)" hint="How long the IKE SA (Phase 1) remains valid before rekeying. Default 28800 seconds (8 hours). Shorter lifetimes improve forward secrecy (compromise of one key reveals less traffic) but increase rekeying overhead. Recommended range: 14400 (4h) to 86400 (24h)." />
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-100"
                    type="number"
                    placeholder="28800"
                    value={config.p1_lifetime}
                    oninput={(e) => config.p1_lifetime = (e.currentTarget as HTMLInputElement).value}
                  />
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Phase 2 ESP Proposals (Collapsible) -->
        <div class="rounded-lg border border-slate-700/50">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/30 transition-colors"
            onclick={() => showPhase2 = !showPhase2}
          >
            <span>{$_('ipsec_mobile.phase_2_esp_proposals')}</span>
            {#if showPhase2}
              <ChevronDownIcon class="h-4 w-4 text-slate-500" />
            {:else}
              <ChevronRightIcon class="h-4 w-4 text-slate-500" />
            {/if}
          </button>
          {#if showPhase2}
            <div class="space-y-4 border-t border-slate-700/50 px-4 py-4">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Encryption Algorithm" hint="The cipher used to encrypt the actual VPN traffic (ESP payload). AES-256-CBC is the widely-compatible default. AES-GCM provides authenticated encryption (combined encryption + integrity) with better performance on hardware with AES-NI. ChaCha20-Poly1305 is optimal for ARM/mobile devices." />
                  <Select.Root type="single" value={config.p2_encryption} onValueChange={(v) => { if (v) config.p2_encryption = v; }}>
                    <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                      <span>{
                        config.p2_encryption === 'aes256' ? 'AES-256-CBC' :
                        config.p2_encryption === 'aes128' ? 'AES-128-CBC' :
                        config.p2_encryption === 'aes256gcm16' ? 'AES-256-GCM-16' :
                        config.p2_encryption === 'aes128gcm16' ? 'AES-128-GCM-16' :
                        config.p2_encryption === 'chacha20poly1305' ? 'ChaCha20-Poly1305' :
                        config.p2_encryption || 'Select...'
                      }</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                      <Select.Item value="aes256" label="AES-256-CBC" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="aes128" label="AES-128-CBC" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="aes256gcm16" label="AES-256-GCM-16" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="aes128gcm16" label="AES-128-GCM-16" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="chacha20poly1305" label="ChaCha20-Poly1305" class="cursor-pointer hover:bg-slate-800" />
                    </Select.Content>
                  </Select.Root>
                </div>
                <div>
                  <FieldLabel label="Hash Algorithm" hint="The integrity/HMAC algorithm for ESP packets. Ensures that encrypted traffic hasn't been tampered with. SHA-256 is the recommended default. When using AES-GCM encryption, integrity is built into the cipher — this setting acts as a fallback for non-AEAD proposals." />
                  <Select.Root type="single" value={config.p2_hash} onValueChange={(v) => { if (v) config.p2_hash = v; }}>
                    <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                      <span>{
                        config.p2_hash === 'sha256' ? 'SHA-256' :
                        config.p2_hash === 'sha384' ? 'SHA-384' :
                        config.p2_hash === 'sha512' ? 'SHA-512' :
                        config.p2_hash === 'sha1' ? 'SHA-1 (Deprecated)' :
                        config.p2_hash || 'Select...'
                      }</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                      <Select.Item value="sha256" label="SHA-256" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="sha384" label="SHA-384" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="sha512" label="SHA-512" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="sha1" label="SHA-1 (Deprecated)" class="cursor-pointer hover:bg-slate-800" />
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="PFS Group" hint="Perfect Forward Secrecy — performs an additional Diffie-Hellman exchange for the Phase 2 (Child SA) keys, independent of the Phase 1 keys. If the Phase 1 key is later compromised, past Phase 2 traffic remains protected. Set to the same or stronger group as Phase 1. 'None' disables PFS (not recommended)." />
                  <Select.Root type="single" value={config.p2_pfs_group} onValueChange={(v) => { if (v) config.p2_pfs_group = v; }}>
                    <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                      <span>{
                        config.p2_pfs_group === 'none' ? 'None (No PFS)' :
                        config.p2_pfs_group === 'modp2048' ? 'MODP-2048 (Group 14)' :
                        config.p2_pfs_group === 'modp3072' ? 'MODP-3072 (Group 15)' :
                        config.p2_pfs_group === 'modp4096' ? 'MODP-4096 (Group 16)' :
                        config.p2_pfs_group === 'ecp256' ? 'ECP-256 (Group 19)' :
                        config.p2_pfs_group === 'ecp384' ? 'ECP-384 (Group 20)' :
                        config.p2_pfs_group || 'Select...'
                      }</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                      <Select.Item value="none" label="None (No PFS)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="modp2048" label="MODP-2048 (Group 14)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="modp3072" label="MODP-3072 (Group 15)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="modp4096" label="MODP-4096 (Group 16)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="ecp256" label="ECP-256 (Group 19)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="ecp384" label="ECP-384 (Group 20)" class="cursor-pointer hover:bg-slate-800" />
                    </Select.Content>
                  </Select.Root>
                </div>
                <div>
                  <FieldLabel label="Lifetime (seconds)" hint="How long the IPsec Child SA (Phase 2) remains valid before rekeying. Default 3600 seconds (1 hour). Phase 2 lifetimes are typically shorter than Phase 1 because they protect the actual data traffic. Recommended: 1800 (30min) to 7200 (2h)." />
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-100"
                    type="number"
                    placeholder="3600"
                    value={config.p2_lifetime}
                    oninput={(e) => config.p2_lifetime = (e.currentTarget as HTMLInputElement).value}
                  />
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Bottom Save Button -->
        <div class="flex justify-end pt-2">
          <Button
            size="sm"
            class="bg-cyan-600 hover:bg-cyan-700 text-white"
            onclick={saveConfig}
            disabled={saving || loading}
          >
            <SaveIcon class="mr-1.5 h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
