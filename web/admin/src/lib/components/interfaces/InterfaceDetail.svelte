<!-- Interface management component for the InterfaceDetail tab and related data. -->

<script lang="ts">
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Switch } from '$lib/components/ui/switch';
  import { Table, TableBody, TableCell, TableRow } from '$lib/components/ui/table';
  import UnderlineTabs from '$lib/components/admin/UnderlineTabs.svelte';

  const detailTabs = [
    { id: 'general', label: 'General' },
    { id: 'ipv4', label: 'IPv4' },
    { id: 'ipv6', label: 'IPv6' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'dhcp', label: 'DHCP Server' },
    { id: 'status', label: 'Status' },
  ];
  import Save from '@lucide/svelte/icons/save';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';

  let { name }: { name: string } = $props();
  let tab = $state('general');
  let loading = $state(true);
  let saving = $state(false);
  let model = $state<Record<string, unknown>>({});
  let dhcp = $state<Record<string, unknown>>({});
  let status = $state<Record<string, unknown>>({});
  let ifaceOptions = $state<string[]>([]);
  let dhcpLoading = $state(false);
  let dhcpSaving = $state(false);
  let statusLoading = $state(false);

  const ipv4Type = $derived(String(model.ipv4_type ?? model.ipv4_config_type ?? 'None'));
  const ipv6Type = $derived(String(model.ipv6_type ?? model.ipv6_config_type ?? 'None'));
  const dhcpFields = ['range_start', 'range_end', 'lease_time', 'gateway', 'dns_servers', 'domain_name', 'ntp_servers', 'tftp_server', 'boot_file'];
  const dhcpHints: Record<string, string> = {
    range_start: 'First IP in the DHCP pool (e.g., 192.168.1.100).',
    range_end: 'Last IP in the DHCP pool (e.g., 192.168.1.200).',
    lease_time: 'Lease duration in seconds. Default 86400 (24h). Shorter for guest networks.',
    gateway: 'Default gateway sent to DHCP clients. Usually this interface\'s IP.',
    dns_servers: 'DNS servers sent to clients. Comma-separated. Leave empty to use this firewall.',
    domain_name: 'Domain name sent to DHCP clients (e.g., home.lan).',
    ntp_servers: 'NTP servers for time sync. Comma-separated IPs.',
    tftp_server: 'TFTP server IP for PXE/network boot. Leave empty if not needed.',
    boot_file: 'PXE boot filename (e.g., pxelinux.0). Requires TFTP server to be set.',
  };
  const statusRows = [['Link State', 'link_state'], ['MTU', 'mtu'], ['Speed', 'speed'], ['Duplex', 'duplex'], ['TX/RX Packets', 'tx_packets', 'rx_packets'], ['TX/RX Bytes', 'tx_bytes', 'rx_bytes'], ['TX/RX Errors', 'tx_errors', 'rx_errors'], ['TX/RX Dropped', 'tx_dropped', 'rx_dropped']];

  function text(v: unknown) { return v === null || v === undefined ? '' : String(v); }
  function setValue(key: string, value: string | boolean) { model[key] = value; }
  function setDhcp(key: string, value: string | boolean) { dhcp[key] = value; }
  function setIpv4Type(value: string) { model.ipv4_type = value; model.ipv4_config_type = value; }
  function setIpv6Type(value: string) { model.ipv6_type = value; model.ipv6_config_type = value; }

  async function loadDetail() {
    loading = true;
    try { model = { ...(await api.get<Record<string, unknown>>(`/interfaces/${encodeURIComponent(name)}`)) }; }
    catch (e) { toasts.error(e instanceof Error ? e.message : `Unable to load ${name}`); model = {}; }
    finally { loading = false; }
  }
  async function saveDetail() {
    saving = true;
    try { await api.patch(`/interfaces/${encodeURIComponent(name)}`, model); toasts.success(`${name} saved`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : `Unable to save ${name}`); }
    finally { saving = false; }
  }
  async function loadDhcp() {
    dhcpLoading = true;
    try { dhcp = await api.get<Record<string, unknown>>(`/interfaces/${encodeURIComponent(name)}/dhcp-server`); }
    catch { dhcp = { enabled: false }; }
    finally { dhcpLoading = false; }
  }
  async function saveDhcp() {
    dhcpSaving = true;
    try { await api.patch(`/interfaces/${encodeURIComponent(name)}/dhcp-server`, dhcp); toasts.success(`${name} DHCP server updated`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Unable to save DHCP server settings'); }
    finally { dhcpSaving = false; }
  }
  async function loadStatus() {
    statusLoading = true;
    try { status = await api.get<Record<string, unknown>>(`/interfaces/${encodeURIComponent(name)}/status`); }
    catch { status = {}; }
    finally { statusLoading = false; }
  }
  async function loadInterfaces() {
    try {
      const payload = await api.get<Record<string, unknown>[]>('/interfaces/overview');
      ifaceOptions = Array.isArray(payload) ? payload.map((entry) => String(entry.name ?? entry.identifier ?? '')).filter((v) => v.length > 0) : [];
    } catch {
      ifaceOptions = [];
    }
  }

  $effect(() => {
    if (!name) return;
    tab = 'general';
    void Promise.all([loadDetail(), loadDhcp(), loadStatus(), loadInterfaces()]);
  });
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div><CardTitle class="text-slate-100">Interface Detail: {name}</CardTitle><CardDescription class="text-slate-400">General, IPv4, IPv6, hardware, DHCP server, and live status</CardDescription></div>
      <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={saveDetail} disabled={saving || loading}><Save class="size-4" /> {saving ? 'Saving...' : 'Save Interface'}</Button>
    </div>
  </CardHeader>
  <CardContent>
    {#if loading}
      <div class="space-y-2">{#each Array.from({ length: 8 }) as _}<Skeleton class="h-10 bg-slate-800" />{/each}</div>
    {:else}
      <div class="space-y-4">
        <UnderlineTabs tabs={detailTabs} bind:activeTab={tab} />

        {#if tab === 'general'}<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable or disable this network interface. Disabled interfaces will not pass traffic." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.enabled)} onCheckedChange={(v) => setValue('enabled', v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Lock" hint="Prevent accidental changes. Locked interfaces require explicit unlock before editing." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.lock)} onCheckedChange={(v) => setValue('lock', v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Identifier" hint="Logical name for this interface (e.g., LAN, WAN). Read-only - set in Assignments." /><Input class="border-slate-700 bg-slate-950" value={text(model.identifier || name)} disabled /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Device" hint="Physical network device mapped to this interface. Read-only - change in Assignments." /><Input class="border-slate-700 bg-slate-950" value={text(model.device)} disabled /></label>
          <label class="space-y-1 text-sm xl:col-span-2"><FieldLabel label="Description" hint="Human-readable label shown in the dashboard and firewall rule selectors." /><Input class="border-slate-700 bg-slate-950" value={text(model.description)} oninput={(e) => setValue('description', (e.currentTarget as HTMLInputElement).value)} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Block Private Networks" hint="Drop RFC 1918 traffic (10.x, 172.16-31.x, 192.168.x). Enable on WAN interfaces." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.block_private_networks)} onCheckedChange={(v) => setValue('block_private_networks', v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Block Bogon Networks" hint="Drop traffic from unassigned/reserved IP ranges. Enable on WAN interfaces." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.block_bogon_networks)} onCheckedChange={(v) => setValue('block_bogon_networks', v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="IPv4 Config Type" hint="How this interface gets its IPv4 address: Static, DHCP, PPPoE, or disabled." /><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100" value={ipv4Type} onchange={(e) => setIpv4Type((e.currentTarget as HTMLSelectElement).value)}><option>Static</option><option>Dhcp</option><option>PPPoE</option><option>None</option></select></label>
          <label class="space-y-1 text-sm"><FieldLabel label="IPv6 Config Type" hint="IPv6 addressing method: Static, DHCPv6, SLAAC, Track Interface, 6rd, or 6to4." /><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100" value={ipv6Type} onchange={(e) => setIpv6Type((e.currentTarget as HTMLSelectElement).value)}><option>None</option><option>Static</option><option>Dhcpv6</option><option>Slaac</option><option>TrackInterface</option><option>Sixrd</option><option>SixToFour</option></select></label>
          <label class="space-y-1 text-sm"><FieldLabel label="MAC Override" hint="Spoof a different MAC address. Useful for ISPs that lock to a specific MAC." /><Input class="border-slate-700 bg-slate-950" value={text(model.mac_override)} oninput={(e) => setValue('mac_override', (e.currentTarget as HTMLInputElement).value)} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Promiscuous Mode" hint="Capture all traffic on the segment, not just frames addressed to this NIC." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.promiscuous_mode)} onCheckedChange={(v) => setValue('promiscuous_mode', v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="MTU" hint="Maximum Transmission Unit in bytes. Default 1500. Lower for tunnels, raise for jumbo frames." /><Input type="number" class="border-slate-700 bg-slate-950" value={text(model.mtu)} oninput={(e) => setValue('mtu', (e.currentTarget as HTMLInputElement).value)} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="MSS" hint="TCP Maximum Segment Size clamping. Helps avoid fragmentation on PPPoE/VPN links." /><Input type="number" class="border-slate-700 bg-slate-950" value={text(model.mss)} oninput={(e) => setValue('mss', (e.currentTarget as HTMLInputElement).value)} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Speed" hint="Force link speed. Use Auto unless troubleshooting NIC negotiation issues." /><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100" value={text(model.speed || 'Auto')} onchange={(e) => setValue('speed', (e.currentTarget as HTMLSelectElement).value)}><option>Auto</option><option>10</option><option>100</option><option>1000</option><option>2500</option><option>5000</option><option>10000</option><option>25000</option><option>40000</option><option>100000</option></select></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Duplex" hint="Force full/half duplex. Use Auto unless the switch requires a fixed setting." /><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100" value={text(model.duplex || 'Auto')} onchange={(e) => setValue('duplex', (e.currentTarget as HTMLSelectElement).value)}><option>Auto</option><option>Full</option><option>Half</option></select></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Dynamic Gateway Policy" hint="Allow gateway to be learned dynamically from DHCP/PPPoE responses." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.dynamic_gateway_policy)} onCheckedChange={(v) => setValue('dynamic_gateway_policy', v)} /></div></label>
        </div>{/if}

        {#if tab === 'ipv4'}<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {#if ipv4Type === 'Static'}
            <label class="space-y-1 text-sm"><FieldLabel label="Address" hint="Static IPv4 address for this interface (e.g., 192.168.1.1)." /><Input class="border-slate-700 bg-slate-950" value={text(model.ipv4_address)} oninput={(e) => setValue('ipv4_address', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Subnet (/32 to /0)" hint="CIDR prefix length. /24 = 255.255.255.0 (254 hosts). /30 = point-to-point." /><Input type="number" min="0" max="32" class="border-slate-700 bg-slate-950" value={text(model.ipv4_subnet)} oninput={(e) => setValue('ipv4_subnet', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Gateway" hint="Default gateway IP for this interface. Usually the upstream router." /><Input class="border-slate-700 bg-slate-950" value={text(model.ipv4_gateway)} oninput={(e) => setValue('ipv4_gateway', (e.currentTarget as HTMLInputElement).value)} /></label>
          {:else if ipv4Type === 'Dhcp'}
            <label class="space-y-1 text-sm"><FieldLabel label="Hostname" hint="Hostname sent in DHCP requests. Some ISPs require a specific value." /><Input class="border-slate-700 bg-slate-950" value={text(model.dhcp_hostname)} oninput={(e) => setValue('dhcp_hostname', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Reject IPs" hint="Comma-separated IPs to reject in DHCP offers. Prevents rogue DHCP servers." /><Input class="border-slate-700 bg-slate-950" value={text(model.dhcp_reject_ips)} oninput={(e) => setValue('dhcp_reject_ips', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Send Options" hint="Custom DHCP options to send in requests (advanced)." /><Input class="border-slate-700 bg-slate-950" value={text(model.dhcp_send_options)} oninput={(e) => setValue('dhcp_send_options', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Override MTU" hint="Use MTU value from DHCP server instead of the interface setting." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.dhcp_override_mtu)} onCheckedChange={(v) => setValue('dhcp_override_mtu', v)} /></div></label>
          {:else if ipv4Type === 'PPPoE'}
            <label class="space-y-1 text-sm"><FieldLabel label="Username" hint="PPPoE username from your ISP." /><Input class="border-slate-700 bg-slate-950" value={text(model.pppoe_username)} oninput={(e) => setValue('pppoe_username', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Password" hint="PPPoE password from your ISP." /><Input type="password" class="border-slate-700 bg-slate-950" value={text(model.pppoe_password)} oninput={(e) => setValue('pppoe_password', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Service Name" hint="PPPoE service name. Leave empty unless your ISP requires it." /><Input class="border-slate-700 bg-slate-950" value={text(model.pppoe_service_name)} oninput={(e) => setValue('pppoe_service_name', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Idle Timeout" hint="Disconnect after this many seconds of inactivity. 0 = always connected." /><Input type="number" class="border-slate-700 bg-slate-950" value={text(model.pppoe_idle_timeout)} oninput={(e) => setValue('pppoe_idle_timeout', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Dial on Demand" hint="Connect only when traffic needs to pass. Reduces costs on metered links." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.pppoe_dial_on_demand)} onCheckedChange={(v) => setValue('pppoe_dial_on_demand', v)} /></div></label>
          {:else}
            <p class="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-400">IPv4 is disabled for this interface.</p>
          {/if}
        </div>{/if}

        {#if tab === 'ipv6'}<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {#if ipv6Type === 'Static'}
            <label class="space-y-1 text-sm"><FieldLabel label="Address" hint="Static IPv6 address for this interface (e.g., 2001:db8:1::1)." /><Input class="border-slate-700 bg-slate-950" value={text(model.ipv6_address)} oninput={(e) => setValue('ipv6_address', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Prefix Length (/128 to /0)" hint="CIDR prefix length for IPv6. /64 is typical for LAN segments." /><Input type="number" min="0" max="128" class="border-slate-700 bg-slate-950" value={text(model.ipv6_prefix_length)} oninput={(e) => setValue('ipv6_prefix_length', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Gateway" hint="Upstream IPv6 gateway for static routing on this interface." /><Input class="border-slate-700 bg-slate-950" value={text(model.ipv6_gateway)} oninput={(e) => setValue('ipv6_gateway', (e.currentTarget as HTMLInputElement).value)} /></label>
          {:else if ipv6Type === 'TrackInterface'}
            <label class="space-y-1 text-sm"><FieldLabel label="Parent Interface" hint="WAN interface providing the IPv6 prefix delegation." /><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100" value={text(model.ipv6_track_parent_interface)} onchange={(e) => setValue('ipv6_track_parent_interface', (e.currentTarget as HTMLSelectElement).value)}>{#each ifaceOptions as option}<option value={option}>{option}</option>{/each}</select></label><label class="space-y-1 text-sm"><FieldLabel label="Prefix ID" hint="Subnet ID within the delegated prefix. Each LAN interface needs a unique ID." /><Input class="border-slate-700 bg-slate-950" value={text(model.ipv6_track_prefix_id)} oninput={(e) => setValue('ipv6_track_prefix_id', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Interface ID Suffix" hint="Host portion of the IPv6 address (::1 is conventional for routers)." /><Input class="border-slate-700 bg-slate-950" value={text(model.ipv6_track_interface_id_suffix)} oninput={(e) => setValue('ipv6_track_interface_id_suffix', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Manual Config" hint="Manually set additional IPv6 parameters instead of auto-deriving them." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.ipv6_track_manual_config)} onCheckedChange={(v) => setValue('ipv6_track_manual_config', v)} /></div></label>
          {:else if ipv6Type === 'Dhcpv6'}
            <p class="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-400">DHCPv6 is configured globally for this interface type.</p>
          {:else if ipv6Type === 'Slaac'}
            <p class="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-400">SLAAC auto-configuration is enabled.</p>
          {:else}
            <p class="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-400">No IPv6 configuration active.</p>
          {/if}
        </div>{/if}

        {#if tab === 'hardware'}<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label class="space-y-1 text-sm"><FieldLabel label="Checksum Offload" hint="Offload IP/TCP/UDP checksum to NIC hardware. Disable if seeing checksum errors." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.checksum_offload)} onCheckedChange={(v) => setValue('checksum_offload', v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="TSO" hint="TCP Segmentation Offload. NIC splits large TCP segments. Disable if causing packet issues." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.tso)} onCheckedChange={(v) => setValue('tso', v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="LRO" hint="Large Receive Offload. Aggregates incoming packets. Disable for routing/bridging." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.lro)} onCheckedChange={(v) => setValue('lro', v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="GRO" hint="Generic Receive Offload. Software-level receive aggregation. Usually safe to enable." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(model.gro)} onCheckedChange={(v) => setValue('gro', v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Tx Ring Buffer" hint="Transmit ring buffer size. Higher values reduce drops under load but use more memory." /><Input type="number" class="border-slate-700 bg-slate-950" value={text(model.tx_ring_buffer)} oninput={(e) => setValue('tx_ring_buffer', (e.currentTarget as HTMLInputElement).value)} /></label><label class="space-y-1 text-sm"><FieldLabel label="Rx Ring Buffer" hint="Receive ring buffer size. Increase if seeing rx_dropped counters climb." /><Input type="number" class="border-slate-700 bg-slate-950" value={text(model.rx_ring_buffer)} oninput={(e) => setValue('rx_ring_buffer', (e.currentTarget as HTMLInputElement).value)} /></label>
          <label class="space-y-1 text-sm xl:col-span-3"><FieldLabel label="Driver Info" hint="Kernel driver name for this NIC. Read-only." /><Input class="border-slate-700 bg-slate-950" value={text(model.driver_info || model.driver)} disabled /></label>
        </div>{/if}

        {#if tab === 'dhcp'}<div class="space-y-3">
          {#if dhcpLoading}<Skeleton class="h-10 bg-slate-800" />{:else}
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><label class="space-y-1 text-sm"><FieldLabel label="Enable" hint="Run a DHCP server on this interface to automatically assign IP addresses to clients." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={Boolean(dhcp.enabled)} onCheckedChange={(v) => setDhcp('enabled', v)} /></div></label>{#each dhcpFields as key}<label class="space-y-1 text-sm"><FieldLabel label={key.replaceAll('_', ' ')} hint={dhcpHints[key] ?? ''} /><Input class="border-slate-700 bg-slate-950" value={text(dhcp[key])} oninput={(e) => setDhcp(key, (e.currentTarget as HTMLInputElement).value)} /></label>{/each}</div>
            <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={saveDhcp} disabled={dhcpSaving}>{dhcpSaving ? 'Saving...' : 'Save DHCP Server'}</Button>
          {/if}
        </div>{/if}

        {#if tab === 'status'}<div class="space-y-3">
          <Button variant="outline" class="border-slate-700 bg-slate-950 text-slate-200" onclick={loadStatus} disabled={statusLoading}><RefreshCw class="size-4" /> {statusLoading ? 'Refreshing...' : 'Refresh Status'}</Button>
          <div class="overflow-hidden rounded-md border border-slate-800"><Table><TableBody>{#each statusRows as row}<TableRow class="border-slate-800 hover:bg-slate-800/20"><TableCell class="text-slate-400">{row[0]}</TableCell><TableCell class="text-slate-100">{#if row.length === 3}{text(status[row[1]])} / {text(status[row[2]])}{:else}{text(status[row[1]])}{/if}</TableCell></TableRow>{/each}</TableBody></Table></div>
        </div>{/if}
      </div>
    {/if}
  </CardContent>
</Card>
