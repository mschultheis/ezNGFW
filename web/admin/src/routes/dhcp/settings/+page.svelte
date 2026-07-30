<!-- Route view for `/dhcp/settings` in the ezNGFW admin GUI. -->

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
  import InfoIcon from '@lucide/svelte/icons/info';
  import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import SaveIcon from '@lucide/svelte/icons/save';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import { Badge } from '$lib/components/ui/badge';

  import { _ } from '$lib/i18n';
  type DhcpSettings = {
    enabled: boolean;
    backend: string;
    interface: string;
    poolStart: string;
    poolEnd: string;
    leaseSeconds: string;
    gateway: string;
    dnsServers: string;
    domainName: string;
    ntpServers: string;
    enableDhcpRelay: boolean;
    relayServers: string;
    tftpServer: string;
    bootFile: string;
    vendorClassId: string;
    vendorSpecificInfo: string;
    pxeServer: string;
    pxeFilename: string;
    tftpServers: string;
    wpadUrl: string;
    maxLeaseSeconds: string;
    classlessStaticRoutes: string;
    denyUnknownClients: boolean;
  };

  const defaultSettings: DhcpSettings = {
    enabled: false,
    backend: 'Kea',
    interface: '',
    poolStart: '',
    poolEnd: '',
    leaseSeconds: '86400',
    gateway: '',
    dnsServers: '',
    domainName: '',
    ntpServers: '',
    enableDhcpRelay: false,
    relayServers: '',
    tftpServer: '',
    bootFile: '',
    vendorClassId: '',
    vendorSpecificInfo: '',
    pxeServer: '',
    pxeFilename: '',
    tftpServers: '',
    wpadUrl: '',
    maxLeaseSeconds: '',
    classlessStaticRoutes: '',
    denyUnknownClients: false
  };

  let settings = $state<DhcpSettings>({ ...defaultSettings });
  let loadingSettings = $state(true);
  let savingSettings = $state(false);
  let settingsError = $state('');

  let interfaceOptions = $state<{ label: string; value: string }[]>([]);

  // Collapsible sections
  let showRelay = $state(false);
  let showTftpPxe = $state(false);
  let showVendor = $state(false);
  let showNetwork = $state(false);

  // Derived status warnings
  let statusBanner = $derived.by(() => {
    if (!settings.enabled) {
      return { type: 'info' as const, message: 'DHCP service is disabled. Enable it to start serving leases.' };
    }
    if (!settings.interface) {
      return { type: 'warning' as const, message: 'DHCP is enabled but no interface is selected. Clients will not receive leases.' };
    }
    if (!settings.poolStart && !settings.poolEnd) {
      return { type: 'warning' as const, message: 'DHCP is enabled but no address pool is configured. Add a pool or set pool start/end range below.' };
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

  async function loadSettings() {
    loadingSettings = true;
    settingsError = '';
    try {
      const payload = asObject(await api.get('/dhcp'));
      settings = {
        enabled: asBool(payload.enabled, defaultSettings.enabled),
        backend: asText(payload.backend, 'Kea'),
        interface: asText(payload.interface),
        poolStart: asText(payload.poolStart || payload.pool_start),
        poolEnd: asText(payload.poolEnd || payload.pool_end),
        leaseSeconds: asText(payload.leaseSeconds || payload.lease_seconds || '86400'),
        gateway: asText(payload.gateway),
        dnsServers: asCSV(payload.dnsServers ?? payload.dns_servers),
        domainName: asText(payload.domainName || payload.domain_name),
        ntpServers: asCSV(payload.ntpServers ?? payload.ntp_servers),
        enableDhcpRelay: asBool(payload.enableDhcpRelay || payload.relay_enabled),
        relayServers: asCSV(payload.relayServers ?? payload.relay_servers),
        tftpServer: asText(payload.tftpServer || payload.tftp_server),
        bootFile: asText(payload.bootFile || payload.boot_file),
        vendorClassId: asText(payload.vendorClassId || payload.vendor_class_id),
        vendorSpecificInfo: asText(payload.vendorSpecificInfo || payload.vendor_specific_info),
        pxeServer: asText(payload.pxeServer || payload.pxe_server),
        pxeFilename: asText(payload.pxeFilename || payload.pxe_filename),
        tftpServers: asCSV(payload.tftpServers ?? payload.tftp_servers),
        wpadUrl: asText(payload.wpadUrl || payload.wpad_url),
        maxLeaseSeconds: asText(payload.maxLeaseSeconds || payload.max_lease_seconds),
        classlessStaticRoutes: asCSV(payload.classlessStaticRoutes ?? payload.classless_static_routes),
        denyUnknownClients: asBool(payload.denyUnknownClients || payload.deny_unknown_clients)
      };
      // Auto-expand sections that have content
      if (settings.enableDhcpRelay || settings.relayServers) showRelay = true;
      if (settings.tftpServer || settings.bootFile || settings.pxeServer || settings.pxeFilename || settings.tftpServers) showTftpPxe = true;
      if (settings.vendorClassId || settings.vendorSpecificInfo) showVendor = true;
      if (settings.wpadUrl || settings.classlessStaticRoutes || settings.maxLeaseSeconds) showNetwork = true;
    } catch (e) {
      settings = { ...defaultSettings };
      settingsError = e instanceof Error ? e.message : 'Unable to load DHCP settings';
    } finally {
      loadingSettings = false;
    }
  }

  function splitCsv(val: string): string[] {
    return val.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  }

  async function saveSettings() {
    savingSettings = true;
    try {
      const payload: Record<string, unknown> = {
        enabled: settings.enabled,
        backend: settings.backend,
        interface: settings.interface,
        pool_start: settings.poolStart,
        pool_end: settings.poolEnd,
        lease_seconds: Number(settings.leaseSeconds || 0),
        gateway: settings.gateway || null,
        dns_servers: splitCsv(settings.dnsServers),
        domain_name: settings.domainName || null,
        ntp_servers: splitCsv(settings.ntpServers),
        relay_enabled: settings.enableDhcpRelay,
        relay_servers: splitCsv(settings.relayServers),
        tftp_server: settings.tftpServer || null,
        boot_file: settings.bootFile || null,
        vendor_class_id: settings.vendorClassId || null,
        vendor_specific_info: settings.vendorSpecificInfo || null,
        pxe_server: settings.pxeServer || null,
        pxe_filename: settings.pxeFilename || null,
        tftp_servers: splitCsv(settings.tftpServers),
        wpad_url: settings.wpadUrl || null,
        max_lease_seconds: settings.maxLeaseSeconds ? Number(settings.maxLeaseSeconds) : null,
        classless_static_routes: splitCsv(settings.classlessStaticRoutes),
        deny_unknown_clients: settings.denyUnknownClients
      };
      await api.patch('/dhcp', payload);
      toasts.success($_('dhcp_settings.toast_dhcp_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save DHCP settings');
    } finally {
      savingSettings = false;
    }
  }

  onMount(() => {
    loadSettings();
    loadInterfaces();
  });

</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/50">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-lg text-slate-100">{$_('dhcp_settings.dhcp_server_settings')}</CardTitle>
          <CardDescription class="text-slate-400">
            Configure the DHCP server to automatically assign IP addresses and network parameters to clients on your network.
          </CardDescription>
        </div>
        <div class="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            class="border-slate-700 text-slate-300 hover:bg-slate-800"
            onclick={() => { loadSettings(); loadInterfaces(); }}
            disabled={loadingSettings}
          >
            <RefreshCwIcon class="mr-1.5 h-3.5 w-3.5" />
            Reload
          </Button>
          <Button
            size="sm"
            class="bg-cyan-600 hover:bg-cyan-700 text-white"
            onclick={saveSettings}
            disabled={savingSettings || loadingSettings}
          >
            <SaveIcon class="mr-1.5 h-3.5 w-3.5" />
            {savingSettings ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      {#if settingsError}
        <div class="rounded-lg border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
          {settingsError}
        </div>
      {/if}

      {#if loadingSettings}
        <div class="flex items-center justify-center py-12 text-slate-400">
          <RefreshCwIcon class="mr-2 h-4 w-4 animate-spin" />
          Loading DHCP settings...
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

        <!-- Enabled Toggle -->
        <div class="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
          <div class="flex items-center justify-between">
            <div>
              <FieldLabel label="DHCP Service" hint="Enable or disable the DHCP server. When disabled, no IP addresses will be assigned to network clients. You can safely disable the service without losing your configuration — all settings are preserved and will be applied when re-enabled." />
            </div>
            <div class="flex h-9 items-center gap-3">
              <Switch checked={settings.enabled} onCheckedChange={(c) => settings.enabled = c} />
              <span class="text-xs font-medium min-w-[60px]" class:text-emerald-400={settings.enabled} class:text-slate-500={!settings.enabled}>
                {settings.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <!-- Backend Selector -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel label="DHCP Backend" hint="Select the DHCP server engine. Kea DHCP (by ISC) is enterprise-grade with JSON configuration, control socket API, high-availability, host reservation databases, and multiple lease backends (memfile, MySQL, PostgreSQL). Recommended for large or complex networks. dnsmasq is a lightweight combined DNS/DHCP daemon with simple text configuration and low memory footprint — ideal for small to medium networks and embedded appliances." />
            <select
              class="cursor-pointer flex h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-100 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={settings.backend}
              onchange={(e) => settings.backend = (e.target as HTMLSelectElement).value}
            >
              <option value="Kea">Kea DHCP (Enterprise)</option>
              <option value="Dnsmasq">dnsmasq (Lightweight)</option>
            </select>
          </div>

          <div>
            <FieldLabel label="Interface" hint="The network interface on which the DHCP server listens for client requests. Only devices connected to this interface (or its VLAN sub-interfaces) will receive DHCP offers. Example: 'eth1' for the LAN port, 'br0' for a bridge interface, or 'vlan100' for a tagged VLAN." />
            <select
              class="cursor-pointer flex h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-100 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={settings.interface}
              onchange={(e) => settings.interface = (e.target as HTMLSelectElement).value}
            >
              <option value="">— Select interface —</option>
              {#each interfaceOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Address Pool -->
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-slate-300">{$_('dhcp_settings.address_pool')}</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel label="Pool Start" hint="The first IP address in the dynamic pool range. The DHCP server assigns addresses starting from this IP. Must be within the subnet of the selected interface. Example: '192.168.1.100'. Leave empty if you only use named pools (configured under DHCP > Pools)." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 192.168.1.100" bind:value={settings.poolStart} />
            </div>
            <div>
              <FieldLabel label="Pool End" hint="The last IP address in the dynamic pool range. Must be greater than Pool Start and within the same subnet. The range determines how many clients can receive dynamic addresses simultaneously. Example: '192.168.1.200' gives you 101 addresses." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 192.168.1.200" bind:value={settings.poolEnd} />
            </div>
          </div>
        </div>

        <!-- Lease & DNS -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <FieldLabel label="Default Lease Time (seconds)" hint="How long (in seconds) a DHCP lease is valid before the client must renew it. Shorter leases (e.g. 3600 = 1 hour) recover addresses faster in dynamic environments. Longer leases (e.g. 86400 = 24 hours) reduce DHCP traffic. Typical values: 3600 (1h) for guest networks, 43200 (12h) for offices, 86400 (24h) for home networks." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" placeholder="86400" bind:value={settings.leaseSeconds} />
          </div>
          <div>
            <FieldLabel label="Default Gateway" hint="The IP address of the default gateway (router) sent to DHCP clients via option 3. Clients use this as their route to the internet and other networks. Usually the firewall's LAN IP address. Example: '192.168.1.1'. Leave empty to not advertise a gateway." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 192.168.1.1" bind:value={settings.gateway} />
          </div>
          <div>
            <FieldLabel label="DNS Servers" hint="Comma-separated list of DNS server IPs sent to clients via option 6. Clients use these to resolve domain names. You can use the firewall itself (if running Unbound/dnsmasq DNS), public resolvers like 1.1.1.1 (Cloudflare) or 8.8.8.8 (Google), or internal DNS servers. Example: '192.168.1.1, 1.1.1.1'." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 192.168.1.1, 1.1.1.1" bind:value={settings.dnsServers} />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <FieldLabel label="Domain Name" hint="The DNS domain name sent to DHCP clients via option 15. Clients append this domain when resolving unqualified hostnames. Example: 'home.lan' means a lookup for 'printer' becomes 'printer.home.lan'. Leave empty if not needed." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. home.lan" bind:value={settings.domainName} />
          </div>
          <div>
            <FieldLabel label="NTP Servers" hint="Comma-separated list of NTP (Network Time Protocol) server IPs sent to clients via option 42. Clients use these to synchronize their clocks. Example: '192.168.1.1, pool.ntp.org'. Important for Kerberos authentication and certificate validation." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 0.pool.ntp.org" bind:value={settings.ntpServers} />
          </div>
          <div>
            <FieldLabel label="Deny Unknown Clients" hint="When enabled, only clients with a static reservation (MAC-to-IP mapping) will receive an IP address. Unknown clients are silently ignored. Useful for high-security networks where you want to whitelist every device. Warning: new devices will not get network access until you manually add a reservation." />
            <div class="flex h-9 items-center gap-3 mt-1">
              <Switch checked={settings.denyUnknownClients} onCheckedChange={(c) => settings.denyUnknownClients = c} />
              <span class="text-xs" class:text-emerald-400={settings.denyUnknownClients} class:text-slate-500={!settings.denyUnknownClients}>
                {settings.denyUnknownClients ? 'Only known clients' : 'All clients'}
              </span>
            </div>
          </div>
        </div>

        <!-- Collapsible: DHCP Relay -->
        <div class="rounded-lg border border-slate-700/50">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/30 transition-colors"
            onclick={() => showRelay = !showRelay}
          >
            <span>DHCP Relay</span>
            {#if showRelay}
              <ChevronDownIcon class="h-4 w-4 text-slate-500" />
            {:else}
              <ChevronRightIcon class="h-4 w-4 text-slate-500" />
            {/if}
          </button>
          {#if showRelay}
            <div class="space-y-4 border-t border-slate-700/50 px-4 py-4">
              <div>
                <FieldLabel label="Enable DHCP Relay" hint="DHCP relay (RFC 3046) forwards DHCP requests from one network segment to a DHCP server on another segment. Enable this if your DHCP server is on a different subnet than the clients. The relay agent adds option 82 (circuit/remote ID) so the server knows which interface the request came from." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.enableDhcpRelay} onCheckedChange={(c) => settings.enableDhcpRelay = c} />
                  <span class="text-xs" class:text-emerald-400={settings.enableDhcpRelay} class:text-slate-500={!settings.enableDhcpRelay}>
                    {settings.enableDhcpRelay ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
              {#if settings.enableDhcpRelay}
                <div>
                  <FieldLabel label="Relay Servers" hint="Comma-separated list of DHCP server IPs to forward requests to. These are the actual DHCP servers that will process the relayed requests and assign addresses. Example: '10.0.0.1, 10.0.0.2' for redundant DHCP servers on the server VLAN." />
                  <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 10.0.0.1, 10.0.0.2" bind:value={settings.relayServers} />
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Collapsible: Advanced TFTP/PXE -->
        <div class="rounded-lg border border-slate-700/50">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/30 transition-colors"
            onclick={() => showTftpPxe = !showTftpPxe}
          >
            <span>Advanced TFTP / PXE Boot</span>
            {#if showTftpPxe}
              <ChevronDownIcon class="h-4 w-4 text-slate-500" />
            {:else}
              <ChevronRightIcon class="h-4 w-4 text-slate-500" />
            {/if}
          </button>
          {#if showTftpPxe}
            <div class="space-y-4 border-t border-slate-700/50 px-4 py-4">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="TFTP Server" hint="IP address of the TFTP server sent via DHCP option 66 (TFTP server name). Used for PXE boot, IP phone provisioning, and firmware updates. The TFTP server hosts the boot files that clients download during network boot. Example: '192.168.1.1' if running TFTP on this firewall." />
                  <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 192.168.1.1" bind:value={settings.tftpServer} />
                </div>
                <div>
                  <FieldLabel label="Boot File" hint="Filename of the boot image sent via DHCP option 67 (bootfile name). PXE clients download this file from the TFTP server to begin the boot process. Common values: 'pxelinux.0' for legacy BIOS boot, 'grubx64.efi' for UEFI boot, 'ipxe.efi' for iPXE chain-loading." />
                  <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. pxelinux.0" bind:value={settings.bootFile} />
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="PXE Server" hint="Next-server IP (siaddr) field in the DHCP OFFER. Some PXE implementations use this instead of option 66 to locate the TFTP server. Set this to the same IP as your TFTP server if clients aren't finding boot files via the TFTP Server option alone." />
                  <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 192.168.1.1" bind:value={settings.pxeServer} />
                </div>
                <div>
                  <FieldLabel label="PXE Filename" hint="Alternative boot filename used in the 'file' field of the DHCP packet header. Some older PXE ROMs only read this field instead of option 67. Usually the same as Boot File. Example: 'pxelinux.0'." />
                  <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. pxelinux.0" bind:value={settings.pxeFilename} />
                </div>
              </div>
              <div>
                <FieldLabel label="Additional TFTP Servers" hint="Comma-separated list of additional TFTP server IPs. Some network boot setups require multiple TFTP servers for redundancy or for different boot stages. These are sent as additional server addresses alongside the primary TFTP server." />
                <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 10.0.0.10, 10.0.0.11" bind:value={settings.tftpServers} />
              </div>
            </div>
          {/if}
        </div>

        <!-- Collapsible: Vendor & Network Boot -->
        <div class="rounded-lg border border-slate-700/50">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/30 transition-colors"
            onclick={() => showVendor = !showVendor}
          >
            <span>Vendor Options</span>
            {#if showVendor}
              <ChevronDownIcon class="h-4 w-4 text-slate-500" />
            {:else}
              <ChevronRightIcon class="h-4 w-4 text-slate-500" />
            {/if}
          </button>
          {#if showVendor}
            <div class="space-y-4 border-t border-slate-700/50 px-4 py-4">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Vendor Class ID" hint="DHCP option 60 — identifies the vendor/type of the DHCP client. Used to match specific device types (e.g. IP phones, thin clients) and serve them vendor-specific options. Examples: 'Cisco-SPA' for Cisco phones, 'PXEClient' for PXE boot clients, 'MSFT 5.0' for Windows DHCP clients." />
                  <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. PXEClient" bind:value={settings.vendorClassId} />
                </div>
                <div>
                  <FieldLabel label="Vendor Specific Info" hint="DHCP option 43 — encapsulated vendor-specific information sent to clients matching the Vendor Class ID. Format depends on the vendor. For Cisco phones this might contain the TFTP server and firmware path. For UniFi APs it contains the controller URL. Consult your device vendor documentation." />
                  <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="Vendor-specific data" bind:value={settings.vendorSpecificInfo} />
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Collapsible: Network Options -->
        <div class="rounded-lg border border-slate-700/50">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/30 transition-colors"
            onclick={() => showNetwork = !showNetwork}
          >
            <span>Network Options</span>
            {#if showNetwork}
              <ChevronDownIcon class="h-4 w-4 text-slate-500" />
            {:else}
              <ChevronRightIcon class="h-4 w-4 text-slate-500" />
            {/if}
          </button>
          {#if showNetwork}
            <div class="space-y-4 border-t border-slate-700/50 px-4 py-4">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Max Lease Time (seconds)" hint="Maximum lease duration a client can request via option 51. If a client requests a longer lease, the server caps it at this value. Must be greater than the default lease time. Example: '172800' (48 hours). Leave empty to use the default lease time as the maximum." />
                  <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" placeholder="e.g. 172800" bind:value={settings.maxLeaseSeconds} />
                </div>
                <div>
                  <FieldLabel label="WPAD URL" hint="Web Proxy Auto-Discovery (WPAD) URL sent via DHCP option 252. Clients use this URL to auto-configure proxy settings. The URL should point to a PAC (Proxy Auto-Config) file. Example: 'http://wpad.home.lan/wpad.dat'. Leave empty to disable WPAD." />
                  <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. http://wpad.home.lan/wpad.dat" bind:value={settings.wpadUrl} />
                </div>
              </div>
              <div>
                <FieldLabel label="Classless Static Routes" hint="RFC 3442 classless static routes sent via DHCP option 121. Allows you to push additional routes to clients beyond the default gateway. Format: comma-separated list of 'subnet/prefix,gateway' pairs. Example: '10.10.0.0/16,192.168.1.254, 172.16.0.0/12,192.168.1.253'. Note: when option 121 is present, some clients may ignore the default gateway (option 3) per the RFC." />
                <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder="e.g. 10.10.0.0/16,192.168.1.254" bind:value={settings.classlessStaticRoutes} />
              </div>
            </div>
          {/if}
        </div>

        <!-- Bottom Save Button -->
        <div class="flex justify-end pt-2">
          <Button
            size="sm"
            class="bg-cyan-600 hover:bg-cyan-700 text-white"
            onclick={saveSettings}
            disabled={savingSettings || loadingSettings}
          >
            <SaveIcon class="mr-1.5 h-3.5 w-3.5" />
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
