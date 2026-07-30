<!-- Route view for `/dhcp/relay` in the ezNGFW admin GUI. -->

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
  type RelaySettings = {
    enabled: boolean;
    relay_servers: string;
    listen_interfaces: string[];
    upstream_interface: string;
    append_circuit_id: boolean;
    append_remote_id: boolean;
    max_hop_count: string;
    policy: string;
  };

  const defaultSettings: RelaySettings = {
    enabled: false,
    relay_servers: '',
    listen_interfaces: [],
    upstream_interface: '',
    append_circuit_id: true,
    append_remote_id: true,
    max_hop_count: '10',
    policy: 'append'
  };

  let settings = $state<RelaySettings>({ ...defaultSettings });
  let loading = $state(true);
  let saving = $state(false);
  let loadError = $state('');
  let interfaceOptions = $state<{ label: string; value: string }[]>([]);

  let showAdvanced = $state(false);

  let statusBanner = $derived.by(() => {
    if (!settings.enabled) {
      return { type: 'info' as const, message: 'DHCP Relay agent is disabled. Enable it to forward DHCP requests to upstream servers.' };
    }
    if (!settings.relay_servers.trim()) {
      return { type: 'warning' as const, message: 'DHCP Relay is enabled but no relay server addresses are configured. Requests will not be forwarded.' };
    }
    if (settings.listen_interfaces.length === 0) {
      return { type: 'warning' as const, message: 'DHCP Relay is enabled but no listen interfaces are selected. The relay agent needs at least one interface to receive client requests.' };
    }
    if (!settings.upstream_interface) {
      return { type: 'warning' as const, message: 'DHCP Relay is enabled but no upstream interface is selected. The relay agent needs an upstream interface to forward requests.' };
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

  function asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((v) => String(v));
    if (typeof value === 'string' && value) return value.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    return [];
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
    loading = true;
    loadError = '';
    try {
      const payload = asObject(await api.get('/dhcp/relay'));
      settings = {
        enabled: asBool(payload.enabled, defaultSettings.enabled),
        relay_servers: asCSV(payload.relay_servers ?? payload.relayServers),
        listen_interfaces: asStringArray(payload.listen_interfaces ?? payload.listenInterfaces),
        upstream_interface: asText(payload.upstream_interface || payload.upstreamInterface),
        append_circuit_id: asBool(payload.append_circuit_id ?? payload.appendCircuitId, true),
        append_remote_id: asBool(payload.append_remote_id ?? payload.appendRemoteId, true),
        max_hop_count: asText(payload.max_hop_count || payload.maxHopCount || '10'),
        policy: asText(payload.policy, 'append')
      };
      if (settings.append_circuit_id || settings.append_remote_id || settings.max_hop_count !== '10' || settings.policy !== 'append') {
        showAdvanced = true;
      }
    } catch (e) {
      settings = { ...defaultSettings };
      loadError = e instanceof Error ? e.message : 'Unable to load DHCP Relay settings';
    } finally {
      loading = false;
    }
  }

  function splitCsv(val: string): string[] {
    return val.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  }

  async function saveSettings() {
    saving = true;
    try {
      const payload: Record<string, unknown> = {
        enabled: settings.enabled,
        relay_servers: splitCsv(settings.relay_servers),
        listen_interfaces: settings.listen_interfaces,
        upstream_interface: settings.upstream_interface || null,
        append_circuit_id: settings.append_circuit_id,
        append_remote_id: settings.append_remote_id,
        max_hop_count: Number(settings.max_hop_count || 10),
        policy: settings.policy
      };
      await api.patch('/dhcp/relay', payload);
      toasts.success($_('dhcp_relay.toast_dhcp_relay_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save DHCP Relay settings');
    } finally {
      saving = false;
    }
  }

  function toggleListenInterface(iface: string) {
    const idx = settings.listen_interfaces.indexOf(iface);
    if (idx >= 0) {
      settings.listen_interfaces = settings.listen_interfaces.filter((_, i) => i !== idx);
    } else {
      settings.listen_interfaces = [...settings.listen_interfaces, iface];
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
          <CardTitle class="text-lg text-slate-100">{$_('dhcp_relay.dhcp_relay_agent')}</CardTitle>
          <CardDescription class="text-slate-400">
            Forward DHCP requests from local network segments to a remote DHCP server. The relay agent inserts
            Option 82 (RFC 3046) information so the server can identify the originating interface and client.
          </CardDescription>
        </div>
        <div class="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            class="border-slate-700 text-slate-300 hover:bg-slate-800"
            onclick={() => { loadSettings(); loadInterfaces(); }}
            disabled={loading}
          >
            <RefreshCwIcon class="mr-1.5 h-3.5 w-3.5" />
            Reload
          </Button>
          <Button
            size="sm"
            class="bg-cyan-600 hover:bg-cyan-700 text-white"
            onclick={saveSettings}
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
          Loading DHCP Relay settings...
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
              <FieldLabel label="DHCP Relay Service" hint="Enable or disable the DHCP relay agent. When enabled, the agent listens on selected interfaces for DHCP broadcast requests and forwards them as unicast packets to the configured upstream DHCP servers. This allows clients on subnets without a local DHCP server to obtain leases from a remote server." />
            </div>
            <div class="flex h-9 items-center gap-3">
              <Switch checked={settings.enabled} onCheckedChange={(c) => settings.enabled = c} />
              <span class="text-xs font-medium min-w-[60px]" class:text-emerald-400={settings.enabled} class:text-slate-500={!settings.enabled}>
                {settings.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <!-- Relay Servers -->
        <div>
          <FieldLabel label="Relay Server Addresses" hint="Comma-separated list of upstream DHCP server IP addresses. The relay agent forwards DHCP DISCOVER and REQUEST messages to these servers. For redundancy, specify multiple servers — the agent forwards to all of them and the client accepts the first OFFER. Example: '10.0.0.1, 10.0.0.2'." />
          <Input
            class="border-slate-700 bg-slate-950 text-slate-100"
            placeholder="e.g. 10.0.0.1, 10.0.0.2"
            value={settings.relay_servers}
            oninput={(e) => settings.relay_servers = (e.currentTarget as HTMLInputElement).value}
          />
        </div>

        <!-- Listen Interfaces -->
        <div>
          <FieldLabel label="Listen Interfaces" hint="Select the interfaces on which the relay agent listens for DHCP broadcast traffic from clients. These are typically your LAN or internal network interfaces — the subnets that do not have a local DHCP server. You can select multiple interfaces to serve multiple network segments through a single relay agent." />
          <div class="mt-2 space-y-2">
            {#if interfaceOptions.length === 0}
              <p class="text-xs text-slate-500">{$_('dhcp_relay.no_interfaces_available_check_the_interfaces_confi')}</p>
            {:else}
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {#each interfaceOptions as opt}
                  <button
                    type="button"
                    class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors
                      {settings.listen_interfaces.includes(opt.value)
                        ? 'border-cyan-600 bg-cyan-950/30 text-cyan-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-300'}"
                    onclick={() => toggleListenInterface(opt.value)}
                  >
                    <span class="h-3 w-3 rounded-full border-2 flex items-center justify-center
                      {settings.listen_interfaces.includes(opt.value) ? 'border-cyan-500' : 'border-slate-600'}">
                      {#if settings.listen_interfaces.includes(opt.value)}
                        <span class="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                      {/if}
                    </span>
                    <span class="truncate">{opt.label}</span>
                  </button>
                {/each}
              </div>
              <p class="text-xs text-slate-500 mt-1">
                {settings.listen_interfaces.length} interface{settings.listen_interfaces.length !== 1 ? 's' : ''} selected
              </p>
            {/if}
          </div>
        </div>

        <!-- Upstream Interface -->
        <div>
          <FieldLabel label="Upstream Interface" hint="The network interface connected to the subnet where the upstream DHCP server(s) reside. The relay agent sends forwarded DHCP packets out through this interface. Typically your WAN, trunk, or server VLAN interface. Must be different from the listen interfaces." />
          <Select.Root type="single" value={settings.upstream_interface} onValueChange={(v) => { if (v) settings.upstream_interface = v; }}>
            <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{settings.upstream_interface ? interfaceOptions.find(o => o.value === settings.upstream_interface)?.label || settings.upstream_interface : '— Select upstream interface —'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each interfaceOptions as opt}
                <Select.Item value={opt.value} label={opt.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <!-- Advanced Options (Collapsible) -->
        <div class="rounded-lg border border-slate-700/50">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/30 transition-colors"
            onclick={() => showAdvanced = !showAdvanced}
          >
            <span>Advanced Options (RFC 3046 / RFC 2131)</span>
            {#if showAdvanced}
              <ChevronDownIcon class="h-4 w-4 text-slate-500" />
            {:else}
              <ChevronRightIcon class="h-4 w-4 text-slate-500" />
            {/if}
          </button>
          {#if showAdvanced}
            <div class="space-y-4 border-t border-slate-700/50 px-4 py-4">
              <!-- Option 82 sub-options -->
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Append Circuit ID (Option 82, Sub-option 1)" hint="RFC 3046 sub-option 1 — inserts the identifier of the relay agent's interface (e.g. VLAN ID, port number, or interface name) that received the client's DHCP request. The upstream DHCP server can use this to assign addresses based on which network segment the client is on. Recommended to keep enabled." />
                  <div class="flex h-9 items-center gap-3 mt-1">
                    <Switch checked={settings.append_circuit_id} onCheckedChange={(c) => settings.append_circuit_id = c} />
                    <span class="text-xs" class:text-emerald-400={settings.append_circuit_id} class:text-slate-500={!settings.append_circuit_id}>
                      {settings.append_circuit_id ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                <div>
                  <FieldLabel label="Append Remote ID (Option 82, Sub-option 2)" hint="RFC 3046 sub-option 2 — inserts a unique identifier for the relay agent itself (typically its IP address or hostname). This helps the DHCP server distinguish between multiple relay agents when they all forward to the same server. Recommended to keep enabled." />
                  <div class="flex h-9 items-center gap-3 mt-1">
                    <Switch checked={settings.append_remote_id} onCheckedChange={(c) => settings.append_remote_id = c} />
                    <span class="text-xs" class:text-emerald-400={settings.append_remote_id} class:text-slate-500={!settings.append_remote_id}>
                      {settings.append_remote_id ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <!-- Max Hop Count -->
                <div>
                  <FieldLabel label="Max Hop Count" hint="RFC 2131 — the maximum number of relay hops allowed. The DHCP relay agent increments the 'hops' field in each relayed message. If this count exceeds the configured maximum, the message is silently discarded. This prevents infinite relay loops in misconfigured networks. Default: 10 (suitable for most networks). Range: 1–255." />
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-100"
                    type="number"
                    placeholder="10"
                    value={settings.max_hop_count}
                    oninput={(e) => settings.max_hop_count = (e.currentTarget as HTMLInputElement).value}
                  />
                </div>

                <!-- Relay Policy -->
                <div>
                  <FieldLabel label="Option 82 Policy" hint="Determines how the relay agent handles incoming DHCP packets that already contain an Option 82 field (e.g. from another relay in the chain). 'Append' adds a new sub-option without removing existing ones. 'Replace' overwrites any existing Option 82 with the relay's own. 'Forward' passes the packet unchanged (transparent mode). 'Discard' drops packets that already have Option 82 (strict single-relay mode)." />
                  <Select.Root type="single" value={settings.policy} onValueChange={(v) => { if (v) settings.policy = v; }}>
                    <Select.Trigger class="h-9 w-full border-slate-700 bg-slate-950 text-slate-100">
                      <span>{
                        settings.policy === 'append' ? 'Append (add to existing)' :
                        settings.policy === 'replace' ? 'Replace (overwrite existing)' :
                        settings.policy === 'forward' ? 'Forward (pass unchanged)' :
                        settings.policy === 'discard' ? 'Discard (drop if present)' :
                        settings.policy || 'Select policy...'
                      }</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                      <Select.Item value="append" label="Append (add to existing)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="replace" label="Replace (overwrite existing)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="forward" label="Forward (pass unchanged)" class="cursor-pointer hover:bg-slate-800" />
                      <Select.Item value="discard" label="Discard (drop if present)" class="cursor-pointer hover:bg-slate-800" />
                    </Select.Content>
                  </Select.Root>
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
            onclick={saveSettings}
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
