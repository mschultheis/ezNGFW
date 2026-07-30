<!-- Route view for `/routing/vrrp` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { _ } from '$lib/i18n';

  type Track = { interface: string; weight: number };
  type Group = { id?: string; interface: string; virtual_router_id: number; priority: number; virtual_addresses: string[]; preempt: boolean; preempt_delay: number; advertisement_interval_ms: number; authentication_type: string; authentication_key: string; track_interfaces: Track[]; description: string; enabled: boolean };

  let loading = $state(true);
  let saving = $state(false);
  let interfaces = $state<string[]>([]);
  let groups = $state<Group[]>([]);
  let form = $state<Group>({ interface: '', virtual_router_id: 1, priority: 100, virtual_addresses: [], preempt: true, preempt_delay: 0, advertisement_interval_ms: 1000, authentication_type: 'none', authentication_key: '', track_interfaces: [], description: '', enabled: true });
  let virtualIps = $state('');
  let trackInterface = $state('');
  let trackWeight = $state(0);

  async function load() {
    loading = true;
    try {
      const [groupData, ifaceData] = await Promise.all([api.get('/routing/vrrp'), api.get('/interfaces').catch(() => [])]);
      groups = Array.isArray(groupData) ? (groupData as Group[]) : [];
      interfaces = Array.isArray(ifaceData)
        ? ifaceData.map((row) => String((row as Record<string, unknown>).name ?? '')).filter(Boolean)
        : [];
      if (!form.interface && interfaces.length > 0) form.interface = interfaces[0];
      trackInterface = interfaces[0] ?? '';
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load VRRP groups');
    } finally {
      loading = false;
    }
  }

  function addTrackInterface() {
    if (!trackInterface) return;
    form.track_interfaces = [...form.track_interfaces, { interface: trackInterface, weight: trackWeight }];
  }

  async function createGroup() {
    saving = true;
    try {
      form.virtual_addresses = virtualIps.split(',').map((v) => v.trim()).filter(Boolean);
      await api.post('/routing/vrrp', form);
      await load();
      form = { interface: interfaces[0] ?? '', virtual_router_id: 1, priority: 100, virtual_addresses: [], preempt: true, preempt_delay: 0, advertisement_interval_ms: 1000, authentication_type: 'none', authentication_key: '', track_interfaces: [], description: '', enabled: true };
      virtualIps = '';
      toasts.success($_('routing_vrrp.toastvrrp_group_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create VRRP group');
    } finally {
      saving = false;
    }
  }

  async function saveGroup(group: Group, idx: number) {
    saving = true;
    try {
      await api.put(`/routing/vrrp/${group.id ?? String(idx)}`, group);
      toasts.success($_('routing_vrrp.toastvrrp_group_updated'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to update VRRP group');
    } finally {
      saving = false;
    }
  }

  async function removeGroup(group: Group, idx: number) {
    saving = true;
    try {
      await api.del(`/routing/vrrp/${group.id ?? String(idx)}`);
      groups = groups.filter((_, i) => i !== idx);
      toasts.success($_('routing_vrrp.toastvrrp_group_removed'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove VRRP group');
    } finally {
      saving = false;
    }
  }

  onMount(() => void load());
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <CardTitle class="text-slate-100">{$_('routing_vrrp.vrrp_groups')}</CardTitle>
    <CardDescription class="text-slate-400">{$_('routing_vrrp.create_vrrp_firsthop_redundancy_groups_with_preemp')}</CardDescription>
  </CardHeader>
  <CardContent class="space-y-4">
    {#if loading}
      <p class="text-sm text-slate-400">{$_('routing_vrrp.loading_vrrp_data')}</p>
    {:else}
      <div class="rounded border border-slate-800 p-4">
        <h3 class="mb-3 text-sm font-semibold text-slate-100">{$_('routing_vrrp.create_vrrp_group')}</h3>
        <div class="grid gap-3 md:grid-cols-3">
          <div><FieldLabel label="Interface" hint="Choose interface participating in VRRP state machine and virtual IP ownership election. This should be the LAN or segment where first-hop redundancy is required. Example: lan0." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={form.interface}>{#each interfaces as iface}<option value={iface}>{iface}</option>{/each}</select></div>
          <div><FieldLabel label="Virtual Router ID" hint="Set VRID unique per broadcast domain so peers join the same redundancy group correctly. Reusing IDs on the same subnet causes election and ARP conflicts. Example: 51 for server VLAN default gateway." /><Input type="number" min="1" max="255" class="mt-2 border-slate-700 bg-slate-950" bind:value={form.virtual_router_id} /></div>
          <div><FieldLabel label="Priority" hint="Higher priority wins master election when preemption is enabled and peers are healthy. Keep deterministic values across members to avoid ambiguous failover outcomes. Example: 120 primary and 100 secondary." /><Input type="number" min="1" max="254" class="mt-2 border-slate-700 bg-slate-950" bind:value={form.priority} /></div>
          <div><FieldLabel label="Virtual Addresses" hint="Define one or more virtual IP addresses announced by the active VRRP master on this segment. Use comma-separated IPs and include only addresses within interface subnet. Example: 10.20.30.1,10.20.30.2." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={virtualIps} /></div>
          <div><FieldLabel label="Preempt" hint="Enable preemption so higher-priority router retakes master role when it returns to service. Disable if you prefer stability over deterministic role restoration. Example: true in strict active/standby designs." /><div class="mt-2"><Switch bind:checked={form.preempt} /></div></div>
          <div><FieldLabel label="Preempt Delay" hint="Delay master takeover after recovery to allow routing protocols and health checks to stabilize first. This avoids immediate churn after reboot or link flap. Example: 30 seconds on WAN edge clusters." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={form.preempt_delay} /></div>
          <div><FieldLabel label="Advertisement Interval (ms)" hint="Set VRRP advertisement cadence controlling failover sensitivity and control traffic overhead. Lower intervals detect failure faster but increase protocol chatter. Example: 1000 milliseconds for standard LAN redundancy." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={form.advertisement_interval_ms} /></div>
          <div><FieldLabel label="Authentication Type" hint="Choose authentication method to protect VRRP control messages from spoofing and accidental takeover. Match this across all group members before activation. Example: text authentication on isolated management VLAN." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={form.authentication_type}><option value="none">none</option><option value="text">text</option><option value="ah">ah</option></select></div>
          <div><FieldLabel label="Authentication Key" hint="Provide shared secret corresponding to selected authentication type for group integrity checks. Rotate this under maintenance windows to avoid split-brain conditions. Example: VRRP-SEGMENT-51." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={form.authentication_key} /></div>
          <div><FieldLabel label="Description" hint="Add operational context explaining where this VRRP group is used and who owns it. Good descriptions speed up failover incident triage and escalation routing. Example: App cluster gateway for rack A/B." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={form.description} /></div>
          <div><FieldLabel label="Enabled" hint="Toggle VRRP group without deleting parameters so maintenance and rollback remain quick and safe. Disable to drain active role during planned cutovers. Example: false during temporary migration testing." /><div class="mt-2"><Switch bind:checked={form.enabled} /></div></div>
        </div>

        <div class="mt-3 rounded border border-slate-800 p-3">
          <h4 class="text-sm font-medium text-slate-200">{$_('routing_vrrp.track_interfaces')}</h4>
          <div class="mt-2 grid gap-2 md:grid-cols-3">
            <div><FieldLabel label="Track Interface" hint="Select interface whose link state should influence VRRP priority and failover behavior. This ensures gateway role follows upstream path health. Example: wan0 tracked on campus default gateway group." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={trackInterface}>{#each interfaces as iface}<option value={iface}>{iface}</option>{/each}</select></div>
            <div><FieldLabel label="Weight" hint="Set signed priority adjustment applied when tracked interface state changes to bias failover logic. Negative values reduce priority on failure while positive values can boost preferred paths. Example: -30 on critical uplink loss." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={trackWeight} /></div>
          </div>
          <Button variant="outline" class="mt-3 border-slate-700" onclick={addTrackInterface}>Add Track Interface</Button>
          <div class="mt-2 text-sm text-slate-300">Tracked: {form.track_interfaces.map((t) => `${t.interface}(${t.weight})`).join(', ') || '-'}</div>
        </div>

        <Button class="mt-3 bg-cyan-600 text-white hover:bg-cyan-500" onclick={createGroup} disabled={saving}>Create Group</Button>
      </div>

      <div class="space-y-3">
        {#each groups as group, idx}
          <div class="rounded border border-slate-800 bg-slate-950 p-3">
            <div class="text-sm font-medium text-slate-100">{group.interface} VRID {group.virtual_router_id} (priority {group.priority})</div>
            <div class="text-sm text-slate-300">{group.virtual_addresses.join(', ')}</div>
            <div class="mt-2 flex gap-2"><Button variant="outline" class="border-slate-700" onclick={() => saveGroup(group, idx)}>Save</Button><Button variant="outline" class="border-red-700 text-red-300" onclick={() => removeGroup(group, idx)}>Delete</Button></div>
          </div>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>
