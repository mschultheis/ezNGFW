<!-- Route view for `/vpn/tailscale` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  /** Imports for API communication, toast notifications, and data helpers. */
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asList, asObject, asString } from '$lib/utils/api-data';

  import StatusPill from '$lib/components/admin/StatusPill.svelte';

  /** UI component imports — shadcn-svelte primitives + lucide icons. */
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Select from '$lib/components/ui/select';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import SaveIcon from '@lucide/svelte/icons/save';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import NetworkIcon from '@lucide/svelte/icons/network';

  import { _ } from '$lib/i18n';
  /* ── Types ────────────────────────────────────────────────────────── */

  /** Core Tailscale configuration model aligned with backend API. */
  type TailscaleSettings = {
    enabled: boolean;
    authKey: string;
    hostname: string;
    acceptRoutes: boolean;
    exitNode: boolean;
    advertiseExitNode: boolean;
    advertiseRoutes: string;
    tags: string;
    acceptDns: boolean;
    shieldsUp: boolean;
    ssh: boolean;
    funnel: boolean;
    unattendedMode: boolean;
    magicDns: boolean;
    webclient: boolean;
    controlUrl: string;
    loginServer: string;
    netfilterMode: string;
    corpDns: boolean;
    operator: string;
    statePath: string;
    socketPath: string;
    verboseLog: boolean;
  };

  /** A single Tailscale node entry from the status endpoint. */
  type TailscaleNode = Record<string, unknown>;

  /** A single tunnel entry from the tunnels endpoint. */
  type TunnelEntry = Record<string, unknown>;

  /* ── Defaults ─────────────────────────────────────────────────────── */

  const defaults: TailscaleSettings = {
    enabled: false,
    authKey: '',
    hostname: '',
    acceptRoutes: false,
    exitNode: false,
    advertiseExitNode: false,
    advertiseRoutes: '',
    tags: '',
    acceptDns: true,
    shieldsUp: false,
    ssh: false,
    funnel: false,
    unattendedMode: false,
    magicDns: true,
    webclient: false,
    controlUrl: '',
    loginServer: '',
    netfilterMode: 'on',
    corpDns: true,
    operator: '',
    statePath: '/var/lib/tailscale/tailscaled.state',
    socketPath: '/var/run/tailscale/tailscaled.sock',
    verboseLog: false
  };

  /** Netfilter mode options for iptables/nftables integration. */
  const netfilterOptions = [
    { label: 'On (full management)', value: 'on' },
    { label: 'No Divert', value: 'nodivert' },
    { label: 'Off (manual rules)', value: 'off' }
  ];

  /* ── Reactive state ───────────────────────────────────────────────── */

  let settings = $state<TailscaleSettings>({ ...defaults });
  let loading = $state(true);
  let saving = $state(false);
  let showAdvanced = $state(false);
  let showPaths = $state(false);

  /** Tailscale node status table entries. */
  let nodes = $state<TailscaleNode[]>([]);
  /** Tunnel telemetry entries. */
  let tunnels = $state<TunnelEntry[]>([]);
  /** Status loading indicator. */
  let statusLoading = $state(true);

  /* ── Data loading ─────────────────────────────────────────────────── */

  /** Load Tailscale settings, node status, and tunnel telemetry in parallel. */
  async function load() {
    loading = true;
    statusLoading = true;
    try {
      const [configPayload, statusPayload, tunnelPayload] = await Promise.all([
        api.get('/vpn/tailscale'),
        api.get('/vpn/tailscale/status'),
        api.get('/vpn/tunnels')
      ]);

      const d = asObject(configPayload);
      settings = {
        enabled: Boolean(d.enabled ?? defaults.enabled),
        authKey: String(d.authKey ?? defaults.authKey),
        hostname: String(d.hostname ?? defaults.hostname),
        acceptRoutes: Boolean(d.acceptRoutes ?? defaults.acceptRoutes),
        exitNode: Boolean(d.exitNode ?? defaults.exitNode),
        advertiseExitNode: Boolean(d.advertiseExitNode ?? defaults.advertiseExitNode),
        advertiseRoutes: String(d.advertiseRoutes ?? defaults.advertiseRoutes),
        tags: String(d.tags ?? defaults.tags),
        acceptDns: Boolean(d.acceptDns ?? defaults.acceptDns),
        shieldsUp: Boolean(d.shieldsUp ?? defaults.shieldsUp),
        ssh: Boolean(d.ssh ?? defaults.ssh),
        funnel: Boolean(d.funnel ?? defaults.funnel),
        unattendedMode: Boolean(d.unattendedMode ?? d.unattended_mode ?? defaults.unattendedMode),
        magicDns: Boolean(d.magicDns ?? d.magic_dns ?? d.corpDns ?? defaults.magicDns),
        webclient: Boolean(d.webclient ?? defaults.webclient),
        controlUrl: String(d.controlUrl ?? defaults.controlUrl),
        loginServer: String(d.loginServer ?? defaults.loginServer),
        netfilterMode: String(d.netfilterMode ?? defaults.netfilterMode),
        corpDns: Boolean(d.corpDns ?? defaults.corpDns),
        operator: String(d.operator ?? defaults.operator),
        statePath: String(d.statePath ?? defaults.statePath),
        socketPath: String(d.socketPath ?? defaults.socketPath),
        verboseLog: Boolean(d.verboseLog ?? defaults.verboseLog)
      };

      const statusData = asObject(statusPayload);
      nodes = Array.isArray(statusData.nodes)
        ? (statusData.nodes as TailscaleNode[])
        : asList(statusPayload);

      tunnels = asList(tunnelPayload);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load Tailscale data');
    } finally {
      loading = false;
      statusLoading = false;
    }
  }

  /** Save Tailscale configuration to the backend. */
  async function save() {
    saving = true;
    try {
      await api.patch('/vpn/tailscale', settings);
      toasts.success($_('vpn_tailscale.toast_tailscale_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save Tailscale settings');
    } finally {
      saving = false;
    }
  }

  /** Refresh node status and tunnel telemetry without reloading settings. */
  async function refreshStatus() {
    statusLoading = true;
    try {
      const [statusPayload, tunnelPayload] = await Promise.all([
        api.get('/vpn/tailscale/status'),
        api.get('/vpn/tunnels')
      ]);
      const statusData = asObject(statusPayload);
      nodes = Array.isArray(statusData.nodes)
        ? (statusData.nodes as TailscaleNode[])
        : asList(statusPayload);
      tunnels = asList(tunnelPayload);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to refresh status');
    } finally {
      statusLoading = false;
    }
  }


  /** Load everything on mount. */
  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <!-- ── Tailscale Settings Card ──────────────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="flex items-center gap-2 text-slate-100">
            <NetworkIcon class="size-5" /> Tailscale Configuration
          </CardTitle>
          <CardDescription class="text-slate-400">
            Connect this firewall to your Tailscale network (tailnet) for zero-config mesh VPN with identity-based access control.
          </CardDescription>
        </div>
        <Badge class={settings.enabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-700/50 text-slate-400 border-slate-600/40'}>
          {settings.enabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>
    </CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-3">
          <Skeleton class="h-9 bg-slate-800" />
          <Skeleton class="h-9 bg-slate-800" />
          <Skeleton class="h-9 bg-slate-800" />
          <Skeleton class="h-9 bg-slate-800" />
        </div>
      {:else}
        <form class="space-y-5" onsubmit={(e) => { e.preventDefault(); void save(); }}>

          <!-- Core settings grid -->
          <div class="grid gap-4 md:grid-cols-2">
            <!-- Enabled toggle -->
            <label class="space-y-1 text-sm md:col-span-2">
              <FieldLabel label="Enabled" hint="Enable the Tailscale daemon on this firewall. When enabled, the node will attempt to authenticate and join your tailnet. Disable to disconnect without removing configuration. Example: enable on production firewalls after initial auth key setup." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.enabled} onCheckedChange={(v) => (settings.enabled = v)} />
                <span class="text-xs" class:text-emerald-400={settings.enabled} class:text-slate-500={!settings.enabled}>
                  {settings.enabled ? 'Daemon running' : 'Daemon stopped'}
                </span>
              </div>
            </label>

            <!-- Auth Key -->
            <label class="space-y-1 text-sm md:col-span-2">
              <FieldLabel label="Auth Key" hint="Pre-authentication key generated from the Tailscale admin console (admin.tailscale.com → Settings → Keys). Use a reusable key for appliances that may reconnect after reboots, or a single-use key for one-time provisioning. The key is only needed for initial registration. Example: tskey-auth-kABC123CNTRL-XXXXXXXXXXXX." />
              <Input
                class="border-slate-700 bg-slate-950 font-mono text-sm"
                type="password"
                placeholder="tskey-auth-..."
                value={settings.authKey}
                oninput={(e) => (settings.authKey = (e.currentTarget as HTMLInputElement).value)}
              />
            </label>

            <!-- Hostname -->
            <label class="space-y-1 text-sm">
              <FieldLabel label="Hostname" hint="The machine name visible in your Tailscale admin console and used for MagicDNS resolution (e.g., hostname.tailnet-name.ts.net). Use a descriptive name that identifies this firewall's role or location. Example: edge-fw-nyc or branch-gw-01." />
              <Input
                class="border-slate-700 bg-slate-950"
                placeholder="edge-fw-01"
                value={settings.hostname}
                oninput={(e) => (settings.hostname = (e.currentTarget as HTMLInputElement).value)}
              />
            </label>

            <!-- Advertise Routes -->
            <label class="space-y-1 text-sm">
              <FieldLabel label="Advertise Routes" hint="CIDR subnets this firewall should advertise to your tailnet, entered one route per line for safer review and easier change control. These routes let remote peers reach private LAN segments behind this gateway when ACLs permit. Example: add 10.0.0.0/24 and 192.168.50.0/24 on separate lines." />
              <Textarea
                class="min-h-24 border-slate-700 bg-slate-950"
                placeholder={'10.0.0.0/24\n192.168.1.0/24'}
                value={settings.advertiseRoutes}
                oninput={(e) => (settings.advertiseRoutes = (e.currentTarget as HTMLTextAreaElement).value)}
              />
            </label>

            <!-- Accept Routes -->
            <label class="space-y-1 text-sm">
              <FieldLabel label="Accept Routes" hint="Accept subnet routes advertised by other nodes in the tailnet. Enable this when remote subnets (e.g., branch offices, cloud VPCs) need to be reachable from this firewall's local network. Disable if this firewall should only expose its own subnets. Example: enable for hub-spoke topologies where branch subnets need mutual reachability." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.acceptRoutes} onCheckedChange={(v) => (settings.acceptRoutes = v)} />
                <span class="text-xs" class:text-emerald-400={settings.acceptRoutes} class:text-slate-500={!settings.acceptRoutes}>
                  {settings.acceptRoutes ? 'Accepting' : 'Ignoring'}
                </span>
              </div>
            </label>

            <!-- Exit Node (use remote) -->
            <label class="space-y-1 text-sm">
              <FieldLabel label="Use Exit Node" hint="Route all internet-bound traffic from this firewall through a designated exit node in your tailnet. This is useful for centralizing internet egress through a specific location for compliance or geo-restriction purposes. The exit node must be configured and approved separately. Example: enable to route all traffic through your datacenter exit node." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.exitNode} onCheckedChange={(v) => (settings.exitNode = v)} />
                <span class="text-xs" class:text-emerald-400={settings.exitNode} class:text-slate-500={!settings.exitNode}>
                  {settings.exitNode ? 'Using exit node' : 'Direct egress'}
                </span>
              </div>
            </label>

            <!-- Advertise Exit Node -->
            <label class="space-y-1 text-sm">
              <FieldLabel label="Advertise as Exit Node" hint="Offer this firewall as an exit node so other tailnet devices can route all their internet traffic through it. Useful for providing a secure internet breakout point at a trusted location. Requires approval in the admin console. Example: enable on a datacenter firewall to provide secure egress for remote workers." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.advertiseExitNode} onCheckedChange={(v) => (settings.advertiseExitNode = v)} />
                <span class="text-xs" class:text-emerald-400={settings.advertiseExitNode} class:text-slate-500={!settings.advertiseExitNode}>
                  {settings.advertiseExitNode ? 'Advertising' : 'Not advertising'}
                </span>
              </div>
            </label>

            <!-- ACL Tags -->
            <label class="space-y-1 text-sm md:col-span-2">
              <FieldLabel label="ACL Tags" hint="Comma-separated Tailscale ACL tags applied to this node. Tags control access policies defined in your tailnet's ACL policy file. Nodes with matching tags can communicate according to your ACL rules. Tags must be prefixed with 'tag:'. Example: tag:firewall,tag:production,tag:edge." />
              <Input
                class="border-slate-700 bg-slate-950"
                placeholder="tag:firewall,tag:production"
                value={settings.tags}
                oninput={(e) => (settings.tags = (e.currentTarget as HTMLInputElement).value)}
              />
            </label>

            <!-- Accept DNS -->
            <label class="space-y-1 text-sm">
              <FieldLabel label="Accept DNS" hint="Use the DNS configuration pushed by your tailnet's admin settings, including MagicDNS for resolving tailnet hostnames. Disable if this firewall manages its own DNS resolution and should not have its resolv.conf modified by Tailscale. Example: enable for seamless MagicDNS hostname resolution across your tailnet." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.acceptDns} onCheckedChange={(v) => (settings.acceptDns = v)} />
                <span class="text-xs" class:text-emerald-400={settings.acceptDns} class:text-slate-500={!settings.acceptDns}>
                  {settings.acceptDns ? 'Using tailnet DNS' : 'Local DNS only'}
                </span>
              </div>
            </label>

            <!-- Shields Up -->
            <label class="space-y-1 text-sm">
              <FieldLabel label="Shields Up" hint="Block all incoming connections over the Tailscale interface while still allowing outgoing connections. This is a defense-in-depth measure that prevents other tailnet nodes from initiating connections to this firewall over Tailscale. Useful during initial setup or for nodes that only need outbound connectivity. Example: enable on client-only nodes that should not accept inbound traffic." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.shieldsUp} onCheckedChange={(v) => (settings.shieldsUp = v)} />
                <span class="text-xs" class:text-amber-400={settings.shieldsUp} class:text-slate-500={!settings.shieldsUp}>
                  {settings.shieldsUp ? 'Blocking inbound' : 'Allowing inbound'}
                </span>
              </div>
            </label>
          </div>

          <!-- ── Advanced Section ─────────────────────────────────────── -->
          <button
            type="button"
            class="flex cursor-pointer items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300"
            onclick={() => (showAdvanced = !showAdvanced)}
          >
            {#if showAdvanced}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon class="size-4" />{/if}
            Advanced Settings
          </button>

          {#if showAdvanced}
            <div class="grid gap-4 rounded-md border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-2">
              <!-- Tailscale SSH -->
              <label class="space-y-1 text-sm">
                <FieldLabel label="Tailscale SSH" hint="Enable the built-in Tailscale SSH server, allowing SSH access to this firewall using Tailscale identity (no traditional SSH keys needed). Access is controlled by your tailnet's SSH ACL policy. Example: enable to allow admin SSH access authenticated via Tailscale identity." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.ssh} onCheckedChange={(v) => (settings.ssh = v)} class="cursor-pointer" />
                  <span class="text-xs" class:text-emerald-400={settings.ssh} class:text-slate-500={!settings.ssh}>
                    {settings.ssh ? 'SSH enabled' : 'SSH disabled'}
                  </span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="Funnel Enabled" hint="Lets you publish selected services to the public internet through Tailscale Funnel while still controlling access policy centrally. Keep this disabled unless a service is intentionally published and hardened. Example: enable only during support windows for a controlled remote troubleshooting portal." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.funnel} onCheckedChange={(v) => (settings.funnel = v)} class="cursor-pointer" />
                  <span class="text-xs" class:text-emerald-400={settings.funnel} class:text-slate-500={!settings.funnel}>{settings.funnel ? 'Enabled' : 'Disabled'}</span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="Unattended Mode" hint="Runs Tailscale in appliance-friendly mode so reconnections do not require interactive login prompts. This is best for branch gateways and remote hardware without local operators. Example: enable on always-on edge devices that use reusable auth keys." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.unattendedMode} onCheckedChange={(v) => (settings.unattendedMode = v)} class="cursor-pointer" />
                  <span class="text-xs" class:text-emerald-400={settings.unattendedMode} class:text-slate-500={!settings.unattendedMode}>{settings.unattendedMode ? 'Enabled' : 'Disabled'}</span>
                </div>
              </label>

              <!-- Web Client -->
              <label class="space-y-1 text-sm">
                <FieldLabel label="Web Client" hint="Enable the Tailscale built-in web client that allows basic node management through a browser at http://100.x.y.z:5252. Useful for quick status checks without CLI access. Disable if this firewall should not expose any additional web interfaces. Example: enable for convenient browser-based status monitoring." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.webclient} onCheckedChange={(v) => (settings.webclient = v)} />
                  <span class="text-xs" class:text-emerald-400={settings.webclient} class:text-slate-500={!settings.webclient}>
                    {settings.webclient ? 'Web UI active' : 'Web UI off'}
                  </span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="MagicDNS" hint="Enables tailnet hostname resolution so users can reach peers by stable names instead of memorizing 100.x addresses. It simplifies operations for junior admins and reduces support errors during incident response. Example: access node `branch-fw` by name rather than looking up its current tailnet IP." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.magicDns} onCheckedChange={(v) => (settings.magicDns = v)} class="cursor-pointer" />
                  <span class="text-xs" class:text-emerald-400={settings.magicDns} class:text-slate-500={!settings.magicDns}>
                    {settings.magicDns ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </label>

              <!-- Netfilter Mode -->
              <label class="space-y-1 text-sm">
                <FieldLabel label="Netfilter Mode" hint="Controls how Tailscale manages iptables/nftables rules. 'On' lets Tailscale fully manage firewall rules for its traffic. 'No Divert' skips the DNAT divert rules while keeping filter rules. 'Off' requires manual firewall rule management — only use this if you manage your own nftables/iptables rules for Tailscale traffic. Example: keep 'On' unless you have custom netfilter rules that conflict." />
                <Select.Root type="single" value={settings.netfilterMode} onValueChange={(v) => { if (v) settings.netfilterMode = v; }}>
                  <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                    <span>{netfilterOptions.find((o) => o.value === settings.netfilterMode)?.label ?? 'Select...'}</span>
                  </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900">
                    {#each netfilterOptions as opt}
                      <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </label>

              <!-- Operator -->
              <label class="space-y-1 text-sm">
                <FieldLabel label="Operator" hint="Unix username that is allowed to operate tailscaled without root privileges. This user can run 'tailscale up/down' and other control commands. Leave empty to require root for all operations. Example: admin or tailscale-operator." />
                <Input
                  class="border-slate-700 bg-slate-950"
                  placeholder="admin"
                  value={settings.operator}
                  oninput={(e) => (settings.operator = (e.currentTarget as HTMLInputElement).value)}
                />
              </label>

              <!-- Control URL -->
              <label class="space-y-1 text-sm">
                <FieldLabel label="Control Server URL" hint="Override the Tailscale coordination server URL. Leave empty to use the default Tailscale control plane (controlplane.tailscale.com). Set this to your Headscale server URL if using a self-hosted coordination server. Example: https://headscale.example.com." />
                <Input
                  class="border-slate-700 bg-slate-950"
                  placeholder="https://controlplane.tailscale.com"
                  value={settings.controlUrl}
                  oninput={(e) => (settings.controlUrl = (e.currentTarget as HTMLInputElement).value)}
                />
              </label>

              <!-- Login Server -->
              <label class="space-y-1 text-sm">
                <FieldLabel label="Login Server" hint="Alternative login server URL used during the initial authentication flow. Typically only needed when using Headscale or a custom DERP/coordination setup. Leave empty for standard Tailscale authentication. Example: https://headscale.example.com." />
                <Input
                  class="border-slate-700 bg-slate-950"
                  placeholder="https://login.tailscale.com"
                  value={settings.loginServer}
                  oninput={(e) => (settings.loginServer = (e.currentTarget as HTMLInputElement).value)}
                />
              </label>

              <!-- Verbose Log -->
              <label class="space-y-1 text-sm">
                <FieldLabel label="Verbose Logging" hint="Enable verbose debug logging for the Tailscale daemon. Produces significantly more log output — useful for troubleshooting connectivity issues, DERP relay problems, or ACL debugging. Disable in production to reduce log volume. Example: enable temporarily when diagnosing connection failures." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.verboseLog} onCheckedChange={(v) => (settings.verboseLog = v)} />
                  <span class="text-xs" class:text-amber-400={settings.verboseLog} class:text-slate-500={!settings.verboseLog}>
                    {settings.verboseLog ? 'Verbose' : 'Normal'}
                  </span>
                </div>
              </label>
            </div>

            <!-- Paths sub-section -->
            <button
              type="button"
              class="ml-4 flex cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 hover:text-slate-300"
              onclick={() => (showPaths = !showPaths)}
            >
              {#if showPaths}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon class="size-4" />{/if}
              Daemon Paths
            </button>

            {#if showPaths}
              <div class="ml-4 grid gap-4 rounded-md border border-slate-800 bg-slate-950/30 p-4 md:grid-cols-2">
                <label class="space-y-1 text-sm">
                  <FieldLabel label="State File Path" hint="Filesystem path where tailscaled stores persistent state including node keys and registration data. Must be on a persistent volume that survives reboots. Default works for most installations. Example: /var/lib/tailscale/tailscaled.state." />
                  <Input
                    class="border-slate-700 bg-slate-950 font-mono text-xs"
                    value={settings.statePath}
                    oninput={(e) => (settings.statePath = (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>

                <label class="space-y-1 text-sm">
                  <FieldLabel label="Socket Path" hint="Unix socket path for CLI-to-daemon communication. The tailscale CLI tool connects to tailscaled through this socket. Changing this requires updating both daemon and CLI configuration. Example: /var/run/tailscale/tailscaled.sock." />
                  <Input
                    class="border-slate-700 bg-slate-950 font-mono text-xs"
                    value={settings.socketPath}
                    oninput={(e) => (settings.socketPath = (e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
              </div>
            {/if}
          {/if}

          <!-- Save button -->
          <div class="flex items-center gap-3 pt-2">
            <Button type="submit" class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700" disabled={saving}>
              <SaveIcon class="mr-2 size-4" />
              {saving ? 'Saving...' : 'Save Tailscale Settings'}
            </Button>
          </div>
        </form>
      {/if}
    </CardContent>
  </Card>

  <!-- ── Node Status Table ────────────────────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('vpn_tailscale.tailscale_node_status')}</CardTitle>
          <CardDescription class="text-slate-400">Live view of all nodes in your tailnet visible from this firewall, including IPs, relay status, and online state.</CardDescription>
        </div>
        <Button
          variant="outline"
          class="cursor-pointer border-slate-700 text-slate-100"
          onclick={() => void refreshStatus()}
          disabled={statusLoading}
        >
          <RefreshCwIcon class="mr-2 size-4" />
          {statusLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if statusLoading && nodes.length === 0}
        <div class="space-y-2">
          <Skeleton class="h-10 bg-slate-800" />
          <Skeleton class="h-10 bg-slate-800" />
          <Skeleton class="h-10 bg-slate-800" />
        </div>
      {:else}
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader class="bg-slate-800">
              <TableRow class="border-slate-700 hover:bg-slate-800">
                <TableHead class="text-slate-300">{$_('vpn_tailscale.hostname')}</TableHead>
                <TableHead class="text-slate-300">{$_('vpn_tailscale.tailscale_ip')}</TableHead>
                <TableHead class="text-slate-300">{$_('vpn_tailscale.os')}</TableHead>
                <TableHead class="text-slate-300">{$_('common.status')}</TableHead>
                <TableHead class="text-slate-300">{$_('vpn_tailscale.relay')}</TableHead>
                <TableHead class="text-slate-300">{$_('vpn_tailscale.rx_bytes')}</TableHead>
                <TableHead class="text-slate-300">{$_('vpn_tailscale.tx_bytes')}</TableHead>
                <TableHead class="text-slate-300">{$_('vpn_tailscale.online')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#if nodes.length === 0}
                <TableRow class="border-slate-800 hover:bg-slate-900">
                  <TableCell class="py-8 text-center text-slate-500" colspan={8}>No tailnet nodes available. Verify Tailscale is enabled and authenticated.</TableCell>
                </TableRow>
              {:else}
                {#each nodes as node}
                  <TableRow class="border-slate-800 hover:bg-slate-800/30">
                    <TableCell class="font-medium text-slate-200">{asString(node.hostname)}</TableCell>
                    <TableCell class="font-mono text-xs text-slate-300">{asString(node.ip ?? node.tailscaleIp)}</TableCell>
                    <TableCell class="text-slate-400">{asString(node.os ?? node.platform)}</TableCell>
                    <TableCell>
                      <StatusPill status={asString(node.status)} />
                    </TableCell>
                    <TableCell class="text-slate-400">{asString(node.relay ?? node.derp)}</TableCell>
                    <TableCell class="font-mono text-xs text-slate-400">{asString(node.rxBytes ?? '-')}</TableCell>
                    <TableCell class="font-mono text-xs text-slate-400">{asString(node.txBytes ?? '-')}</TableCell>
                    <TableCell>
                      <Badge class={Boolean(node.online) ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}>
                        {Boolean(node.online) ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                {/each}
              {/if}
            </TableBody>
          </Table>
        </div>
      {/if}
    </CardContent>
  </Card>

  <!-- ── Tunnel Telemetry Table ───────────────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('vpn_tailscale.tunnel_telemetry')}</CardTitle>
      <CardDescription class="text-slate-400">Real-time tunnel metrics including latency, throughput, and last handshake timestamps for all active VPN tunnels.</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto rounded-md border border-slate-800">
        <Table>
          <TableHeader class="bg-slate-800">
            <TableRow class="border-slate-700 hover:bg-slate-800">
              <TableHead class="text-slate-300">{$_('common.name')}</TableHead>
              <TableHead class="text-slate-300">{$_('common.type')}</TableHead>
              <TableHead class="text-slate-300">{$_('vpn_tailscale.remote_endpoint')}</TableHead>
              <TableHead class="text-slate-300">{$_('common.status')}</TableHead>
              <TableHead class="text-slate-300">{$_('vpn_tailscale.latency')}</TableHead>
              <TableHead class="text-slate-300">{$_('vpn_tailscale.tx_bytes')}</TableHead>
              <TableHead class="text-slate-300">{$_('vpn_tailscale.rx_bytes')}</TableHead>
              <TableHead class="text-slate-300">{$_('vpn_tailscale.last_handshake')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if tunnels.length === 0}
              <TableRow class="border-slate-800 hover:bg-slate-900">
                <TableCell class="py-8 text-center text-slate-500" colspan={8}>No active tunnels</TableCell>
              </TableRow>
            {:else}
              {#each tunnels as tunnel}
                <TableRow class="border-slate-800 hover:bg-slate-800/30">
                  <TableCell class="font-medium text-slate-200">{asString(tunnel.name)}</TableCell>
                  <TableCell class="text-slate-400">{asString(tunnel.type)}</TableCell>
                  <TableCell class="font-mono text-xs text-slate-300">{asString(tunnel.remoteEndpoint ?? tunnel.remote)}</TableCell>
                  <TableCell>
                    <StatusPill status={asString(tunnel.status)} />
                  </TableCell>
                  <TableCell class="text-slate-400">{asString(tunnel.latency ?? '-')}</TableCell>
                  <TableCell class="font-mono text-xs text-slate-400">{asString(tunnel.txBytes ?? '-')}</TableCell>
                  <TableCell class="font-mono text-xs text-slate-400">{asString(tunnel.rxBytes ?? '-')}</TableCell>
                  <TableCell class="font-mono text-xs text-slate-400">{asString(tunnel.lastHandshake ?? '-')}</TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
</div>
