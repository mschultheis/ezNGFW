<!-- Route view for `/vlans` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asList, asObject, asString } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Select from '$lib/components/ui/select';
  import SaveIcon from '@lucide/svelte/icons/save';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash-2';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import NetworkIcon from '@lucide/svelte/icons/network';
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
  import XIcon from '@lucide/svelte/icons/x';
  import RefreshCcwIcon from '@lucide/svelte/icons/refresh-ccw';

  import { _ } from '$lib/i18n';
  /* ---------- types ---------- */
  type GlobalSettings = {
    vlanFilteringEnabled: boolean;
    protocol: string;
    defaultPriority: number;
    nativeVlan: number;
    pruneEligible: boolean;
  };
  type Vlan = {
    device_name: string;
    parent_interface: string;
    vlan_tag: number;
    priority: number;
    protocol: string;
    description: string;
    enabled: boolean;
    mtu: number;
    ingressFiltering: boolean;
    egressUntagged: boolean;
  };
  type StatusRow = {
    device: string;
    parent: string;
    tag: number;
    priority: number;
    state: string;
    rx_bytes: number;
    tx_bytes: number;
    rx_packets: number;
    tx_packets: number;
  };

  const globalDefaults: GlobalSettings = {
    vlanFilteringEnabled: true, protocol: '802.1Q', defaultPriority: 0, nativeVlan: 1, pruneEligible: false
  };
  const vlanDefaults: Vlan = {
    device_name: '', parent_interface: '', vlan_tag: 10, priority: 0, protocol: '802.1Q',
    description: '', enabled: true, mtu: 1500, ingressFiltering: true, egressUntagged: false
  };

  /* ---------- state ---------- */
  let loading = $state(true);
  let globalSettings = $state<GlobalSettings>({ ...globalDefaults });
  let vlans = $state<Vlan[]>([]);
  let statusRows = $state<StatusRow[]>([]);
  let interfaceOptions = $state<{ label: string; value: string }[]>([]);

  let savingGlobal = $state(false);
  let applying = $state(false);
  let showAddVlan = $state(false);
  let editingVlanDevice = $state<string | null>(null);
  let vlanForm = $state<Vlan>({ ...vlanDefaults });
  let savingVlan = $state(false);
  let showAdvanced = $state(false);
  let showAdvancedGlobal = $state(false);

  const protocolOptions = [
    { label: '802.1Q', value: '802.1Q' },
    { label: '802.1ad (QinQ)', value: '802.1ad' }
  ];

  /* ---------- derived ---------- */
  const activeCount = $derived(statusRows.filter((r) => String(r.state).toLowerCase().includes('up')).length);
  const totalRx = $derived(statusRows.reduce((a, r) => a + (r.rx_bytes || 0), 0));
  const totalTx = $derived(statusRows.reduce((a, r) => a + (r.tx_bytes || 0), 0));

  /* ---------- loaders ---------- */
  async function load() {
    loading = true;
    try {
      const [gData, vData, iData, sData] = await Promise.all([
        api.get('/vlans/settings'),
        api.get('/vlans'),
        api.get('/interfaces'),
        api.get('/vlans/status')
      ]);
      const g = asObject(gData);
      globalSettings = {
        vlanFilteringEnabled: Boolean(g.vlanFilteringEnabled ?? globalDefaults.vlanFilteringEnabled),
        protocol: String(g.protocol ?? globalDefaults.protocol),
        defaultPriority: Number(g.defaultPriority ?? globalDefaults.defaultPriority),
        nativeVlan: Number(g.nativeVlan ?? globalDefaults.nativeVlan),
        pruneEligible: Boolean(g.pruneEligible ?? globalDefaults.pruneEligible)
      };
      vlans = asList(vData).map((v: unknown) => {
        const r = asObject(v);
        return {
          device_name: String(r.device_name ?? ''),
          parent_interface: String(r.parent_interface ?? ''),
          vlan_tag: Number(r.vlan_tag ?? 10),
          priority: Number(r.priority ?? 0),
          protocol: String(r.protocol ?? '802.1Q'),
          description: String(r.description ?? ''),
          enabled: Boolean(r.enabled ?? true),
          mtu: Number(r.mtu ?? 1500),
          ingressFiltering: Boolean(r.ingressFiltering ?? true),
          egressUntagged: Boolean(r.egressUntagged ?? false)
        };
      });
      interfaceOptions = asList(iData).map((i: unknown) => {
        const r = typeof i === 'object' && i !== null ? (i as Record<string, unknown>) : {};
        const v = String(r.name ?? r.id ?? i ?? '');
        return { label: v, value: v };
      });
      const sList = asList(sData);
      statusRows = sList.map((s: unknown) => {
        const r = asObject(s);
        return {
          device: String(r.device ?? ''), parent: String(r.parent ?? ''),
          tag: Number(r.tag ?? 0), priority: Number(r.priority ?? 0),
          state: String(r.state ?? ''), rx_bytes: Number(r.rx_bytes ?? r.rxBytes ?? 0),
          tx_bytes: Number(r.tx_bytes ?? r.txBytes ?? 0),
          rx_packets: Number(r.rx_packets ?? r.rxPackets ?? 0),
          tx_packets: Number(r.tx_packets ?? r.txPackets ?? 0)
        };
      });
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load VLAN data');
    } finally {
      loading = false;
    }
  }

  async function saveGlobal() {
    savingGlobal = true;
    try {
      await api.patch('/vlans/settings', globalSettings);
      toasts.success($_('vlans.toast_global_vlan_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save global settings');
    } finally {
      savingGlobal = false;
    }
  }

  async function applyChanges() {
    applying = true;
    try {
      const payload = asObject(await api.post('/vlans/apply'));
      const msg = typeof payload.message === 'string' ? payload.message : 'VLAN changes queued for apply';
      toasts.success(msg);
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to apply VLAN changes');
    } finally {
      applying = false;
    }
  }

  /* ---------- VLAN CRUD ---------- */
  function startAddVlan() {
    showAddVlan = true;
    editingVlanDevice = null;
    vlanForm = { ...vlanDefaults };
  }
  function startEditVlan(v: Vlan) {
    showAddVlan = true;
    editingVlanDevice = v.device_name;
    vlanForm = { ...v };
  }
  function cancelVlanForm() {
    showAddVlan = false;
    editingVlanDevice = null;
  }
  async function saveVlan() {
    savingVlan = true;
    try {
      if (editingVlanDevice) {
        await api.put(`/vlans/${encodeURIComponent(editingVlanDevice)}`, vlanForm);
        toasts.success(`VLAN "${vlanForm.device_name}" updated`);
      } else {
        await api.post('/vlans', vlanForm);
        toasts.success(`VLAN "${vlanForm.device_name}" created`);
      }
      cancelVlanForm();
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save VLAN');
    } finally {
      savingVlan = false;
    }
  }
  async function deleteVlan(deviceName: string) {
    try {
      await api.del(`/vlans/${encodeURIComponent(deviceName)}`);
      toasts.success(`VLAN "${deviceName}" deleted`);
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to delete VLAN');
    }
  }

  onMount(() => { void load(); });

</script>

<div class="space-y-6">
  <!-- ====== STATS ====== -->
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {#each [
      { label: 'VLAN Interfaces', value: vlans.length },
      { label: 'Active (Up)', value: activeCount, tone: activeCount > 0 ? 'text-emerald-400' : 'text-amber-400' },
      { label: 'Total RX', value: `${(totalRx / 1024).toFixed(1)} KB` },
      { label: 'Total TX', value: `${(totalTx / 1024).toFixed(1)} KB` }
    ] as item}
      <Card class="border-slate-800 bg-slate-900">
        <CardContent class="pt-4 pb-4">
          <p class="text-xs text-slate-400">{item.label}</p>
          <p class="mt-1 text-2xl font-bold {item.tone || 'text-slate-100'}">{item.value}</p>
        </CardContent>
      </Card>
    {/each}
  </div>

  <!-- ====== GLOBAL SETTINGS ====== -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-slate-100"><NetworkIcon class="size-4" /> Global VLAN Settings</CardTitle>
      <CardDescription class="text-slate-400">System-wide VLAN filtering and encapsulation defaults applied to all bridge and trunk interfaces.</CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-2"><Skeleton class="h-9 bg-slate-800" /><Skeleton class="h-9 bg-slate-800" /></div>
      {:else}
        <form class="grid gap-4 md:grid-cols-2" onsubmit={(e) => { e.preventDefault(); void saveGlobal(); }}>
          <div class="space-y-1">
            <FieldLabel label="VLAN Filtering" hint="Enable 802.1Q VLAN tag enforcement on bridge ports. When enabled, frames with unknown VLAN tags are dropped. Disable only for flat bridge topologies. Example: enable on managed trunk bridges." />
            <div class="flex h-9 items-center gap-3">
              <Switch checked={globalSettings.vlanFilteringEnabled} onCheckedChange={(v) => (globalSettings.vlanFilteringEnabled = v)} />
              <span class="text-xs" class:text-emerald-400={globalSettings.vlanFilteringEnabled} class:text-slate-500={!globalSettings.vlanFilteringEnabled}>
                {globalSettings.vlanFilteringEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
          <div class="space-y-1">
            <FieldLabel label="Default Protocol" hint="Default encapsulation for new VLANs. 802.1Q is standard single-tag for enterprise; 802.1ad (QinQ) stacks a service tag over a customer tag for ISP/metro Ethernet. Example: 802.1Q for campus networks." />
            <Select.Root type="single" value={globalSettings.protocol} onValueChange={(v) => { if (v) globalSettings.protocol = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                <span>{protocolOptions.find((o) => o.value === globalSettings.protocol)?.label ?? 'Select...'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each protocolOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <!-- Advanced global -->
          <div class="md:col-span-2">
            <button type="button" class="flex cursor-pointer items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300" onclick={() => (showAdvancedGlobal = !showAdvancedGlobal)}>
              {#if showAdvancedGlobal}<ChevronDownIcon class="size-3.5" />{:else}<ChevronRightIcon class="size-3.5" />{/if}
              Advanced Settings
            </button>
          </div>
          {#if showAdvancedGlobal}
            <div class="space-y-1">
              <FieldLabel label="Default Priority" hint="Default 802.1p CoS priority (0-7) for new VLANs. Higher values get preferential treatment by QoS-aware switches. 0 is best-effort. Example: 5 for voice VLANs." />
              <Input class="border-slate-700 bg-slate-900" type="number" bind:value={globalSettings.defaultPriority} min={0} max={7} />
            </div>
            <div class="space-y-1">
              <FieldLabel label="Native VLAN" hint="VLAN ID for untagged frames on trunk ports. Should match your switch native VLAN to prevent VLAN hopping attacks. Default is 1. Example: 99 for a dedicated management VLAN." />
              <Input class="border-slate-700 bg-slate-900" type="number" bind:value={globalSettings.nativeVlan} min={1} max={4094} />
            </div>
            <div class="space-y-1">
              <FieldLabel label="VTP Prune Eligible" hint="Mark VLANs as eligible for VTP pruning on Cisco-interop environments. Pruning stops flooding of unused VLANs across trunks. Example: enable on large campus networks with many VLANs." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={globalSettings.pruneEligible} onCheckedChange={(v) => (globalSettings.pruneEligible = v)} />
                <span class="text-xs" class:text-emerald-400={globalSettings.pruneEligible} class:text-slate-500={!globalSettings.pruneEligible}>
                  {globalSettings.pruneEligible ? 'Eligible' : 'Not Eligible'}
                </span>
              </div>
            </div>
          {/if}

          <div class="md:col-span-2">
            <Button type="submit" class="bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer" disabled={savingGlobal}>
              <SaveIcon class="mr-1 size-4" />
              {savingGlobal ? 'Saving...' : 'Save Global Settings'}
            </Button>
          </div>
        </form>
      {/if}
    </CardContent>
  </Card>

  <!-- ====== VLAN INTERFACES ====== -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('vlans.vlan_interfaces')}</CardTitle>
          <CardDescription class="text-slate-400">Create tagged sub-interfaces on physical or bond parents. Each VLAN gets its own device name for firewall rules and routing.</CardDescription>
        </div>
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer" onclick={startAddVlan}>
          <PlusIcon class="mr-1 size-4" /> Add VLAN
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-2"><Skeleton class="h-10 bg-slate-800" /><Skeleton class="h-10 bg-slate-800" /></div>
      {:else if vlans.length === 0 && !showAddVlan}
        <p class="py-8 text-center text-sm text-slate-500">{$_('vlans.no_vlans_configured_click_add_vlan_to_create_one')}</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-700 text-left text-xs text-slate-400">
              <tr>
                <th class="px-3 py-2">Device</th>
                <th class="px-3 py-2">Parent</th>
                <th class="px-3 py-2">Tag</th>
                <th class="px-3 py-2">Priority</th>
                <th class="px-3 py-2">Protocol</th>
                <th class="px-3 py-2">Enabled</th>
                <th class="px-3 py-2">Description</th>
                <th class="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each vlans as v}
                <tr class="border-b border-slate-800 hover:bg-slate-800/30">
                  <td class="px-3 py-2 font-mono text-xs font-medium text-slate-100">{v.device_name}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{v.parent_interface}</td>
                  <td class="px-3 py-2 font-mono text-xs text-cyan-400">{v.vlan_tag}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{v.priority}</td>
                  <td class="px-3 py-2 text-slate-300">{v.protocol}</td>
                  <td class="px-3 py-2">
                    <Badge class={v.enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-600 bg-slate-800 text-slate-400'}>
                      {v.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td class="px-3 py-2 text-slate-400">{v.description || '—'}</td>
                  <td class="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" class="cursor-pointer text-slate-400 hover:text-slate-100" onclick={() => startEditVlan(v)}>
                      <PencilIcon class="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" class="cursor-pointer text-red-400 hover:text-red-300" onclick={() => void deleteVlan(v.device_name)}>
                      <TrashIcon class="size-3.5" />
                    </Button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <!-- Inline VLAN form -->
      {#if showAddVlan}
        <div class="mt-4 rounded-lg border border-cyan-500/30 bg-slate-950 p-4">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-sm font-semibold text-slate-100">{editingVlanDevice ? `Edit VLAN: ${editingVlanDevice}` : 'Create New VLAN'}</h4>
            <Button variant="ghost" size="sm" class="cursor-pointer text-slate-400" onclick={cancelVlanForm}><XIcon class="size-4" /></Button>
          </div>
          <form class="grid gap-4 md:grid-cols-2" onsubmit={(e) => { e.preventDefault(); void saveVlan(); }}>
            <div class="space-y-1">
              <FieldLabel label="Device Name" hint="Linux network device name for this VLAN sub-interface. Convention is parent.tag (e.g. eth0.10) or vlanN. Must be unique across the system. Example: vlan20 or eth0.100." />
              <Input class="border-slate-700 bg-slate-900" bind:value={vlanForm.device_name} placeholder="e.g. vlan10 or eth0.10" required />
            </div>
            <div class="space-y-1">
              <FieldLabel label="Parent Interface" hint="Physical or bond interface that carries the VLAN trunk. The parent must support 802.1Q tagging and be connected to a switch trunk port. Example: eth0 or bond0." />
              <Select.Root type="single" value={vlanForm.parent_interface} onValueChange={(v) => { if (v) vlanForm.parent_interface = v; }}>
                <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                  <span>{vlanForm.parent_interface || 'Select parent interface...'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  {#each interfaceOptions as opt}
                    <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
            <div class="space-y-1">
              <FieldLabel label="VLAN Tag" hint="802.1Q VLAN identifier (1-4094). Must match the VLAN configured on your upstream switch. Tag 1 is usually the native/default VLAN. Example: 10 for management, 20 for guest." />
              <Input class="border-slate-700 bg-slate-900" type="number" bind:value={vlanForm.vlan_tag} min={1} max={4094} required />
            </div>
            <div class="space-y-1">
              <FieldLabel label="Priority" hint="802.1p Class of Service priority (0-7). Higher values receive preferential QoS treatment on VLAN-aware switches. 0 = best effort, 5 = voice, 7 = network control. Example: 0 for data, 5 for VoIP." />
              <Input class="border-slate-700 bg-slate-900" type="number" bind:value={vlanForm.priority} min={0} max={7} />
            </div>
            <div class="space-y-1">
              <FieldLabel label="Protocol" hint="VLAN encapsulation: 802.1Q for standard single-tagged frames, 802.1ad for QinQ double-tagged frames used in carrier/ISP networks. Example: 802.1Q for most enterprise setups." />
              <Select.Root type="single" value={vlanForm.protocol} onValueChange={(v) => { if (v) vlanForm.protocol = v; }}>
                <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                  <span>{protocolOptions.find((o) => o.value === vlanForm.protocol)?.label ?? 'Select...'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  {#each protocolOptions as opt}
                    <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
            <div class="space-y-1">
              <FieldLabel label="Enabled" hint="Activate the VLAN interface immediately on save. Disable to keep the config stored but inactive — useful for planned maintenance or staged rollouts. Example: enabled for production VLANs." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={vlanForm.enabled} onCheckedChange={(v) => (vlanForm.enabled = v)} />
                <span class="text-xs" class:text-emerald-400={vlanForm.enabled} class:text-slate-500={!vlanForm.enabled}>{vlanForm.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>

            <!-- Advanced -->
            <div class="md:col-span-2">
              <button type="button" class="flex cursor-pointer items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300" onclick={() => (showAdvanced = !showAdvanced)}>
                {#if showAdvanced}<ChevronDownIcon class="size-3.5" />{:else}<ChevronRightIcon class="size-3.5" />{/if}
                Advanced Settings
              </button>
            </div>
            {#if showAdvanced}
              <div class="space-y-1">
                <FieldLabel label="MTU" hint="Maximum Transmission Unit for this VLAN. Should be ≤ parent interface MTU. Lower values prevent fragmentation on VPN/PPPoE trunks. Default 1500. Example: 1400 for VLAN over WireGuard." />
                <Input class="border-slate-700 bg-slate-900" type="number" bind:value={vlanForm.mtu} min={68} max={9000} />
              </div>
              <div class="space-y-1">
                <FieldLabel label="Ingress Filtering" hint="Drop incoming frames tagged with VLANs not allowed on this port. Prevents VLAN hopping attacks. Disable only for promiscuous monitoring. Example: enable on all production ports." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={vlanForm.ingressFiltering} onCheckedChange={(v) => (vlanForm.ingressFiltering = v)} />
                  <span class="text-xs" class:text-emerald-400={vlanForm.ingressFiltering} class:text-slate-500={!vlanForm.ingressFiltering}>{vlanForm.ingressFiltering ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              <div class="space-y-1">
                <FieldLabel label="Egress Untagged" hint="Strip the VLAN tag from outgoing frames on this interface, making it an access port instead of a trunk. Enable for end-host ports. Example: enable for a PC connected to VLAN 10." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={vlanForm.egressUntagged} onCheckedChange={(v) => (vlanForm.egressUntagged = v)} />
                  <span class="text-xs" class:text-emerald-400={vlanForm.egressUntagged} class:text-slate-500={!vlanForm.egressUntagged}>{vlanForm.egressUntagged ? 'Untagged' : 'Tagged'}</span>
                </div>
              </div>
            {/if}

            <div class="space-y-1 md:col-span-2">
              <FieldLabel label="Description" hint="Free-text note about this VLAN purpose. Good descriptions help during audits. Example: Guest Wi-Fi — isolated from corporate LAN." />
              <Textarea class="border-slate-700 bg-slate-900" bind:value={vlanForm.description} rows={2} placeholder="e.g. Guest Wi-Fi isolation" />
            </div>

            <div class="flex gap-2 md:col-span-2">
              <Button type="submit" class="bg-cyan-500 text-white hover:bg-cyan-600 cursor-pointer" disabled={savingVlan}>
                <SaveIcon class="mr-1 size-4" />
                {savingVlan ? 'Saving...' : editingVlanDevice ? 'Update VLAN' : 'Create VLAN'}
              </Button>
              <Button type="button" variant="outline" class="border-slate-700 text-slate-300 cursor-pointer" onclick={cancelVlanForm}>{$_('common.cancel')}</Button>
            </div>
          </form>
        </div>
      {/if}
    </CardContent>
  </Card>

  <!-- ====== APPLY CHANGES ====== -->
  <div class="rounded-lg border border-amber-500/30 bg-slate-900 p-4">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <TriangleAlertIcon class="size-4 text-amber-300" />
          <h3 class="text-sm font-semibold text-slate-100">{$_('vlans.apply_changes')}</h3>
        </div>
        <p class="text-xs text-slate-400">{$_('vlans.commits_vlan_device_changes_to_runtime_networking_')}</p>
      </div>
      <Button class="bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer" onclick={() => void applyChanges()} disabled={applying}>
        {applying ? 'Applying...' : 'Apply Changes'}
      </Button>
    </div>
  </div>

  <!-- ====== RUNTIME STATUS ====== -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('vlans.vlan_runtime_status')}</CardTitle>
          <CardDescription class="text-slate-400">Live VLAN state from the kernel — reflects actual interface status after apply.</CardDescription>
        </div>
        <Button variant="outline" size="sm" class="border-slate-700 text-slate-300 cursor-pointer" onclick={() => void load()}>
          <RefreshCcwIcon class="mr-1 size-3.5" /> Refresh
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if statusRows.length === 0}
        <p class="py-6 text-center text-sm text-slate-500">{$_('vlans.no_runtime_vlan_status_available')}</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-700 text-left text-xs text-slate-400">
              <tr>
                <th class="px-3 py-2">Device</th>
                <th class="px-3 py-2">Parent</th>
                <th class="px-3 py-2">Tag</th>
                <th class="px-3 py-2">Priority</th>
                <th class="px-3 py-2">State</th>
                <th class="px-3 py-2">RX Bytes</th>
                <th class="px-3 py-2">TX Bytes</th>
              </tr>
            </thead>
            <tbody>
              {#each statusRows as row}
                <tr class="border-b border-slate-800 hover:bg-slate-800/30">
                  <td class="px-3 py-2 font-mono text-xs text-slate-100">{row.device}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{row.parent}</td>
                  <td class="px-3 py-2 font-mono text-xs text-cyan-400">{row.tag}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{row.priority}</td>
                  <td class="px-3 py-2">
                    <Badge class={String(row.state).toLowerCase().includes('up') ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}>
                      {row.state || 'unknown'}
                    </Badge>
                  </td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{row.rx_bytes.toLocaleString()}</td>
                  <td class="px-3 py-2 font-mono text-xs text-slate-300">{row.tx_bytes.toLocaleString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
