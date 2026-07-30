<!-- Route view for `/ha` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asList, asObject, asString } from '$lib/utils/api-data';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Badge } from '$lib/components/ui/badge';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import * as Select from '$lib/components/ui/select';
  import { _ } from '$lib/i18n';

  type HaConfig = any;
  type CarpVip = any;
  type TrackInterface = { interface: string; weight: number };
  type TrackGateway = { gateway: string; weight: number; check_interval_sec: number };

  let loading = $state(true);
  let saving = $state(false);
  let busy = $state(false);

  let config = $state<HaConfig>({});
  let status = $state<any>({});
  let events = $state<any[]>([]);
  let carpVips = $state<CarpVip[]>([]);
  let trackInterfaces = $state<TrackInterface[]>([]);
  let trackGateways = $state<TrackGateway[]>([]);
  let upgradeStatus = $state<any>({});

  let excludedSectionsText = $state('');
  let witnessAddressesText = $state('');

  let newVip = $state<CarpVip>({
    id: '',
    interface: '',
    virtual_address: '',
    subnet_bits: 24,
    vhid: 1,
    priority: 100,
    advertisement_interval: 1,
    password: '',
    description: '',
    enabled: true
  });

  let newTrackInterface = $state<TrackInterface>({ interface: '', weight: 0 });
  let newTrackGateway = $state<TrackGateway>({ gateway: '', weight: 0, check_interval_sec: 5 });

  function csvToList(raw: string): string[] {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  function listToCsv(value: unknown): string {
    return Array.isArray(value) ? value.map((v) => String(v)).join(', ') : '';
  }

  function bool(value: unknown): boolean {
    return value === true || value === 'true' || value === 1;
  }

  function ensureNested(key: string) {
    if (!config[key] || typeof config[key] !== 'object') config[key] = {};
  }

  async function loadAll() {
    loading = true;
    try {
      const [cfg, sts, ev, carp, tIf, tGw, upStatus] = await Promise.all([
        api.get('/ha/config'),
        api.get('/ha/status'),
        api.get('/ha/events').catch(() => []),
        api.get('/ha/carp').catch(() => []),
        api.get('/ha/track-interfaces').catch(() => []),
        api.get('/ha/track-gateways').catch(() => []),
        api.get('/ha/upgrade/status').catch(() => ({}))
      ]);

      config = asObject(cfg);
      status = asObject(sts);
      events = asList(ev).map((item) => asObject(item));
      carpVips = asList(carp).map((item) => asObject(item));
      trackInterfaces = asList(tIf).map((item) => {
        const row = asObject(item);
        return { interface: String(row.interface ?? ''), weight: Number(row.weight ?? 0) };
      });
      trackGateways = asList(tGw).map((item) => {
        const row = asObject(item);
        return { gateway: String(row.gateway ?? ''), weight: Number(row.weight ?? 0), check_interval_sec: Number(row.check_interval_sec ?? 5) };
      });
      upgradeStatus = asObject(upStatus);

      const cfgSync = asObject(config.config_sync ?? {});
      const splitBrainCfg = asObject(config.split_brain ?? {});
      excludedSectionsText = listToCsv(cfgSync.excluded_sections);
      witnessAddressesText = listToCsv(splitBrainCfg.witness_addresses);
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load HA data');
    } finally {
      loading = false;
    }
  }

  async function refreshRuntime() {
    try {
      const [sts, ev, upStatus] = await Promise.all([
        api.get('/ha/status'),
        api.get('/ha/events').catch(() => []),
        api.get('/ha/upgrade/status').catch(() => ({}))
      ]);
      status = asObject(sts);
      events = asList(ev).map((item) => asObject(item));
      upgradeStatus = asObject(upStatus);
    } catch { /* keep last runtime state */ }
  }

  async function saveClusterSettings() {
    saving = true;
    try {
      const next = asObject(config);
      const configSync = asObject(next.config_sync ?? {});
      const splitBrainObj = asObject(next.split_brain ?? {});
      configSync.excluded_sections = csvToList(excludedSectionsText);
      splitBrainObj.witness_addresses = csvToList(witnessAddressesText);
      next.config_sync = configSync;
      next.split_brain = splitBrainObj;
      config = asObject(await api.patch('/ha/config', next));
      toasts.success($_('ha.toastcluster_settings_saved'));
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save cluster settings');
    } finally { saving = false; }
  }

  async function triggerFailover() {
    busy = true;
    try { await api.post('/ha/failover'); toasts.success($_('ha.toastmanual_failover_triggered')); await refreshRuntime(); }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Failover request failed'); }
    finally { busy = false; }
  }

  async function triggerSync() {
    busy = true;
    try { await api.post('/ha/sync'); toasts.success($_('ha.toastmanual_sync_triggered')); await refreshRuntime(); }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Sync request failed'); }
    finally { busy = false; }
  }

  async function triggerConfigPush() {
    busy = true;
    try { await api.post('/ha/config-sync/trigger'); toasts.success($_('ha.toastconfig_push_triggered')); await loadAll(); }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Config push failed'); }
    finally { busy = false; }
  }

  async function saveStateSync() {
    try {
      const stateSync = asObject(config.state_sync ?? {});
      config.state_sync = await api.patch('/ha/state-sync', stateSync);
      toasts.success($_('ha.toaststate_sync_settings_updated'));
    } catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to update state sync'); }
  }

  async function saveConfigSync() {
    try {
      const configSync = asObject(config.config_sync ?? {});
      configSync.excluded_sections = csvToList(excludedSectionsText);
      config.config_sync = await api.patch('/ha/config-sync', configSync);
      toasts.success($_('ha.toastconfig_sync_settings_updated'));
    } catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to update config sync'); }
  }

  async function saveSplitBrain() {
    try {
      const splitBrainObj = asObject(config.split_brain ?? {});
      splitBrainObj.witness_addresses = csvToList(witnessAddressesText);
      config.split_brain = await api.patch('/ha/split-brain', splitBrainObj);
      toasts.success($_('ha.toastsplitbrain_settings_updated'));
    } catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to update split-brain settings'); }
  }

  async function saveUpgradeSettings() {
    try {
      const rolling = asObject(config.rolling_upgrade ?? {});
      config.rolling_upgrade = await api.patch('/ha/upgrade', rolling);
      toasts.success($_('ha.toastrolling_upgrade_settings_updated'));
    } catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to update rolling upgrade settings'); }
  }

  async function startUpgrade() {
    busy = true;
    try { await api.post('/ha/upgrade/start'); toasts.success($_('ha.toastrolling_upgrade_started')); await refreshRuntime(); }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to start rolling upgrade'); }
    finally { busy = false; }
  }

  async function addVip() {
    if (!asString(newVip.interface) || !asString(newVip.virtual_address)) {
      toasts.error($_('ha.toastvip_interface_and_virtual_address_are_require')); return;
    }
    try {
      await api.post('/ha/carp', newVip);
      newVip = { id: '', interface: '', virtual_address: '', subnet_bits: 24, vhid: 1, priority: 100, advertisement_interval: 1, password: '', description: '', enabled: true };
      await loadAll(); toasts.success($_('ha.toastcarp_vip_added'));
    } catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to add CARP VIP'); }
  }

  async function saveVip(vip: CarpVip) {
    try { await api.put(`/ha/carp/${encodeURIComponent(asString(vip.id))}`, vip); toasts.success($_('ha.toastcarp_vip_updated')); }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to update CARP VIP'); }
  }

  async function deleteVip(id: string) {
    try { await api.del(`/ha/carp/${encodeURIComponent(id)}`); carpVips = carpVips.filter((vip) => asString(vip.id) !== id); toasts.success($_('ha.toastcarp_vip_deleted')); }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to delete CARP VIP'); }
  }

  async function addTrackedInterface() {
    if (!newTrackInterface.interface.trim()) { toasts.error($_('ha.toastinterface_is_required')); return; }
    try { trackInterfaces = await api.post('/ha/track-interfaces', newTrackInterface); newTrackInterface = { interface: '', weight: 0 }; }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to add tracked interface'); }
  }

  async function removeTrackedInterface(name: string) {
    try { trackInterfaces = await api.del(`/ha/track-interfaces/${encodeURIComponent(name)}`); }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to remove tracked interface'); }
  }

  async function addTrackedGateway() {
    if (!newTrackGateway.gateway.trim()) { toasts.error($_('ha.toastgateway_is_required')); return; }
    try { trackGateways = await api.post('/ha/track-gateways', newTrackGateway); newTrackGateway = { gateway: '', weight: 0, check_interval_sec: 5 }; }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to add tracked gateway'); }
  }

  async function removeTrackedGateway(name: string) {
    try { trackGateways = await api.del(`/ha/track-gateways/${encodeURIComponent(name)}`); }
    catch (error) { toasts.error(error instanceof Error ? error.message : 'Failed to remove tracked gateway'); }
  }

  onMount(() => {
    void loadAll();
    const timer = setInterval(() => { void refreshRuntime(); }, 5000);
    return () => clearInterval(timer);
  });
</script>

<div class="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>{$_('ha.cluster_status')}</CardTitle>
      <CardDescription>{$_('ha.realtime_cluster_state_sync_health_and_carp_role_v')}</CardDescription>
    </CardHeader>
    <CardContent class="grid gap-3 md:grid-cols-4">
      <div class="rounded border p-3"><div class="text-xs text-muted-foreground">Cluster State</div><div class="font-semibold">{asString(status.cluster_state || 'unknown')}</div></div>
      <div class="rounded border p-3"><div class="text-xs text-muted-foreground">Node Role</div><div class="font-semibold">{asString(status.node_role || status.role || 'unknown')}</div></div>
      <div class="rounded border p-3"><div class="text-xs text-muted-foreground">Peer State</div><div class="font-semibold">{asString(status.peer_state || asObject(status.peer).state || 'unknown')}</div></div>
      <div class="rounded border p-3"><div class="text-xs text-muted-foreground">Sync Status</div><div class="font-semibold">{asString(status.sync_status || 'unknown')}</div></div>
      <div class="md:col-span-4 flex flex-wrap gap-2 pt-2">
        <Button onclick={triggerFailover} disabled={busy || loading}>Trigger Failover</Button>
        <Button variant="outline" onclick={triggerSync} disabled={busy || loading}>Trigger Sync</Button>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle>{$_('ha.cluster_settings')}</CardTitle><CardDescription>{$_('ha.mode_role_peer_connectivity_and_heartbeat_tuning')}</CardDescription></CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2">
      <label class="space-y-1 text-sm md:col-span-2"><span>{$_('ha.enabled')}</span><div><Switch checked={bool(config.enabled)} onCheckedChange={(v) => (config.enabled = v)} /></div></label>
      <div class="space-y-1 text-sm"><span>{$_('ha.mode')}</span>
        <Select.Root type="single" value={String(config.mode ?? '')} onValueChange={(v) => v && (config.mode = v)}>
          <Select.Trigger class="h-10 w-full border-slate-700 bg-slate-950 text-slate-100"><span>{{ Disabled: 'disabled', ActivePassive: 'active-passive', ActiveActive: 'active-active' }[String(config.mode)] ?? 'Select mode'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="Disabled" label="disabled" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="ActivePassive" label="active-passive" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="ActiveActive" label="active-active" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
      </div>
      <div class="space-y-1 text-sm"><span>{$_('ha.node_role')}</span>
        <Select.Root type="single" value={String(config.node_role ?? '')} onValueChange={(v) => v && (config.node_role = v)}>
          <Select.Trigger class="h-10 w-full border-slate-700 bg-slate-950 text-slate-100"><span>{{ Primary: 'primary', Secondary: 'secondary' }[String(config.node_role)] ?? 'Select role'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="Primary" label="primary" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="Secondary" label="secondary" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
      </div>
      <label class="space-y-1 text-sm"><span>{$_('ha.cluster_name')}</span><Input value={String(config.cluster_name ?? '')} oninput={(e) => (config.cluster_name = (e.currentTarget as HTMLInputElement).value)} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.node_id')}</span><Input value={String(config.node_id ?? '')} oninput={(e) => (config.node_id = (e.currentTarget as HTMLInputElement).value)} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.peer_address')}</span><Input value={String(config.peer_address ?? '')} oninput={(e) => (config.peer_address = (e.currentTarget as HTMLInputElement).value)} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.peer_port')}</span><Input type="number" value={config.peer_port ?? ''} oninput={(e) => (config.peer_port = Number((e.currentTarget as HTMLInputElement).value))} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.heartbeat_ms')}</span><Input type="number" value={config.heartbeat_interval_ms ?? ''} oninput={(e) => (config.heartbeat_interval_ms = Number((e.currentTarget as HTMLInputElement).value))} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.dead_interval_ms')}</span><Input type="number" value={config.dead_interval_ms ?? ''} oninput={(e) => (config.dead_interval_ms = Number((e.currentTarget as HTMLInputElement).value))} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.auth_key')}</span><Input type="password" value={String(config.authentication_key ?? '')} oninput={(e) => (config.authentication_key = (e.currentTarget as HTMLInputElement).value)} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.sync_interface')}</span><Input value={String(config.sync_interface ?? '')} oninput={(e) => (config.sync_interface = (e.currentTarget as HTMLInputElement).value)} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.dedicated_sync_link')}</span><div><Switch checked={bool(config.dedicated_sync_link)} onCheckedChange={(v) => (config.dedicated_sync_link = v)} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.preempt')}</span><div><Switch checked={bool(config.preempt)} onCheckedChange={(v) => (config.preempt = v)} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.preempt_delay_sec')}</span><Input type="number" value={config.preempt_delay_sec ?? ''} oninput={(e) => (config.preempt_delay_sec = Number((e.currentTarget as HTMLInputElement).value))} /></label>
      <div class="md:col-span-2"><Button onclick={saveClusterSettings} disabled={saving || loading}>{saving ? 'Saving...' : 'Save Cluster Settings'}</Button></div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle>{$_('ha.carp_virtual_ips')}</CardTitle><CardDescription>{$_('ha.create_edit_and_delete_floating_vips')}</CardDescription></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-2 md:grid-cols-5">
        <Input placeholder="id" value={String(newVip.id ?? '')} oninput={(e) => (newVip.id = (e.currentTarget as HTMLInputElement).value)} />
        <Input placeholder="interface" value={String(newVip.interface ?? '')} oninput={(e) => (newVip.interface = (e.currentTarget as HTMLInputElement).value)} />
        <Input placeholder="virtual address" value={String(newVip.virtual_address ?? '')} oninput={(e) => (newVip.virtual_address = (e.currentTarget as HTMLInputElement).value)} />
        <Input type="number" placeholder="vhid" value={newVip.vhid ?? ''} oninput={(e) => (newVip.vhid = Number((e.currentTarget as HTMLInputElement).value))} />
        <Button onclick={addVip}>Add VIP</Button>
      </div>
      <div class="overflow-x-auto rounded border">
        <Table>
          <TableHeader><TableRow><TableHead>{$_('ha.id')}</TableHead><TableHead>{$_('ha.interface')}</TableHead><TableHead>{$_('ha.address')}</TableHead><TableHead>{$_('ha.vhid')}</TableHead><TableHead>{$_('ha.priority')}</TableHead><TableHead>{$_('ha.enabled_1')}</TableHead><TableHead>{$_('ha.actions')}</TableHead></TableRow></TableHeader>
          <TableBody>
            {#if carpVips.length === 0}
              <TableRow><TableCell colspan={7} class="text-center text-muted-foreground">No CARP VIPs configured</TableCell></TableRow>
            {:else}
              {#each carpVips as vip, i}
                <TableRow>
                  <TableCell><Input value={String(vip.id ?? '')} oninput={(e) => (carpVips[i].id = (e.currentTarget as HTMLInputElement).value)} /></TableCell>
                  <TableCell><Input value={String(vip.interface ?? '')} oninput={(e) => (carpVips[i].interface = (e.currentTarget as HTMLInputElement).value)} /></TableCell>
                  <TableCell><Input value={String(vip.virtual_address ?? '')} oninput={(e) => (carpVips[i].virtual_address = (e.currentTarget as HTMLInputElement).value)} /></TableCell>
                  <TableCell><Input type="number" value={vip.vhid ?? ''} oninput={(e) => (carpVips[i].vhid = Number((e.currentTarget as HTMLInputElement).value))} /></TableCell>
                  <TableCell><Input type="number" value={vip.priority ?? ''} oninput={(e) => (carpVips[i].priority = Number((e.currentTarget as HTMLInputElement).value))} /></TableCell>
                  <TableCell><Switch checked={bool(vip.enabled)} onCheckedChange={(v) => (carpVips[i].enabled = v)} /></TableCell>
                  <TableCell class="space-x-2"><Button variant="outline" onclick={() => saveVip(vip)}>Save</Button><Button variant="destructive" onclick={() => deleteVip(asString(vip.id))}>Delete</Button></TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle>{$_('ha.state_synchronization')}</CardTitle><CardDescription>{$_('ha.control_synchronized_runtime_state_categories')}</CardDescription></CardHeader>
    <CardContent class="grid gap-3 md:grid-cols-3">
      <label class="space-y-1 text-sm"><span>{$_('ha.enabled_2')}</span><div><Switch checked={bool(config.state_sync?.enabled)} onCheckedChange={(v) => { ensureNested('state_sync'); config.state_sync.enabled = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.firewall_states')}</span><div><Switch checked={bool(config.state_sync?.sync_firewall_states)} onCheckedChange={(v) => { ensureNested('state_sync'); config.state_sync.sync_firewall_states = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.ipsec_sa')}</span><div><Switch checked={bool(config.state_sync?.sync_ipsec_sa)} onCheckedChange={(v) => { ensureNested('state_sync'); config.state_sync.sync_ipsec_sa = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.dhcp_leases')}</span><div><Switch checked={bool(config.state_sync?.sync_dhcp_leases)} onCheckedChange={(v) => { ensureNested('state_sync'); config.state_sync.sync_dhcp_leases = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.nat_states')}</span><div><Switch checked={bool(config.state_sync?.sync_nat_states)} onCheckedChange={(v) => { ensureNested('state_sync'); config.state_sync.sync_nat_states = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.routing_table')}</span><div><Switch checked={bool(config.state_sync?.sync_routing_table)} onCheckedChange={(v) => { ensureNested('state_sync'); config.state_sync.sync_routing_table = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.sync_interval_ms')}</span><Input type="number" value={config.state_sync?.sync_interval_ms ?? ''} oninput={(e) => { ensureNested('state_sync'); config.state_sync.sync_interval_ms = Number((e.currentTarget as HTMLInputElement).value); }} /></label>
      <div class="space-y-1 text-sm"><span>{$_('ha.transport')}</span>
        <Select.Root type="single" value={String(config.state_sync?.transport ?? '')} onValueChange={(v) => { if (v) { ensureNested('state_sync'); config.state_sync.transport = v; } }}>
          <Select.Trigger class="h-10 w-full border-slate-700 bg-slate-950 text-slate-100"><span>{config.state_sync?.transport || 'Select transport'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="tcp" label="tcp" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="udp" label="udp" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="multicast" label="multicast" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
      </div>
      <label class="space-y-1 text-sm"><span>{$_('ha.encryption')}</span><div><Switch checked={bool(config.state_sync?.encryption_enabled)} onCheckedChange={(v) => { ensureNested('state_sync'); config.state_sync.encryption_enabled = v; }} /></div></label>
      <div class="md:col-span-3"><Button onclick={saveStateSync}>Save State Sync</Button></div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle>{$_('ha.config_synchronization')}</CardTitle><CardDescription>{$_('ha.control_config_replication_and_manual_push')}</CardDescription></CardHeader>
    <CardContent class="grid gap-3 md:grid-cols-2">
      <label class="space-y-1 text-sm"><span>{$_('ha.enabled_3')}</span><div><Switch checked={bool(config.config_sync?.enabled)} onCheckedChange={(v) => { ensureNested('config_sync'); config.config_sync.enabled = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.auto_sync')}</span><div><Switch checked={bool(config.config_sync?.auto_sync)} onCheckedChange={(v) => { ensureNested('config_sync'); config.config_sync.auto_sync = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.sync_on_save')}</span><div><Switch checked={bool(config.config_sync?.sync_on_save)} onCheckedChange={(v) => { ensureNested('config_sync'); config.config_sync.sync_on_save = v; }} /></div></label>
      <label class="space-y-1 text-sm md:col-span-2"><span>{$_('ha.excluded_sections_commaseparated')}</span><Input value={excludedSectionsText} oninput={(e) => (excludedSectionsText = (e.currentTarget as HTMLInputElement).value)} /></label>
      <div class="md:col-span-2 flex flex-wrap gap-2"><Button onclick={saveConfigSync}>Save Config Sync</Button><Button variant="outline" onclick={triggerConfigPush}>Push Config To Peer</Button></div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle>{$_('ha.splitbrain_detection')}</CardTitle><CardDescription>{$_('ha.configure_partition_detection_and_recovery_policy')}</CardDescription></CardHeader>
    <CardContent class="grid gap-3 md:grid-cols-2">
      <label class="space-y-1 text-sm"><span>{$_('ha.enabled_4')}</span><div><Switch checked={bool(config.split_brain?.enabled)} onCheckedChange={(v) => { ensureNested('split_brain'); config.split_brain.enabled = v; }} /></div></label>
      <div class="space-y-1 text-sm"><span>{$_('ha.method')}</span>
        <Select.Root type="single" value={String(config.split_brain?.detection_method ?? '')} onValueChange={(v) => { if (v) { ensureNested('split_brain'); config.split_brain.detection_method = v; } }}>
          <Select.Trigger class="h-10 w-full border-slate-700 bg-slate-950 text-slate-100"><span>{config.split_brain?.detection_method || 'Select method'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="heartbeat" label="heartbeat" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="quorum-disk" label="quorum-disk" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="witness-node" label="witness-node" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="network-partition" label="network-partition" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
      </div>
      <div class="space-y-1 text-sm"><span>{$_('ha.resolution_policy')}</span>
        <Select.Root type="single" value={String(config.split_brain?.resolution_policy ?? '')} onValueChange={(v) => { if (v) { ensureNested('split_brain'); config.split_brain.resolution_policy = v; } }}>
          <Select.Trigger class="h-10 w-full border-slate-700 bg-slate-950 text-slate-100"><span>{config.split_brain?.resolution_policy || 'Select policy'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="prefer-primary" label="prefer-primary" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="prefer-higher-priority" label="prefer-higher-priority" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="shutdown-both" label="shutdown-both" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="quorum-vote" label="quorum-vote" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
      </div>
      <label class="space-y-1 text-sm"><span>{$_('ha.check_interval_sec')}</span><Input type="number" value={config.split_brain?.check_interval_sec ?? ''} oninput={(e) => { ensureNested('split_brain'); config.split_brain.check_interval_sec = Number((e.currentTarget as HTMLInputElement).value); }} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.failure_threshold')}</span><Input type="number" value={config.split_brain?.failure_threshold ?? ''} oninput={(e) => { ensureNested('split_brain'); config.split_brain.failure_threshold = Number((e.currentTarget as HTMLInputElement).value); }} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.quorum_disk_path')}</span><Input value={String(config.split_brain?.quorum_disk_path ?? '')} oninput={(e) => { ensureNested('split_brain'); config.split_brain.quorum_disk_path = (e.currentTarget as HTMLInputElement).value; }} /></label>
      <label class="space-y-1 text-sm md:col-span-2"><span>{$_('ha.witness_nodes_commaseparated')}</span><Input value={witnessAddressesText} oninput={(e) => (witnessAddressesText = (e.currentTarget as HTMLInputElement).value)} /></label>
      <div class="md:col-span-2"><Button onclick={saveSplitBrain}>Save Split-Brain Settings</Button></div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle>{$_('ha.interfacegateway_tracking')}</CardTitle><CardDescription>{$_('ha.tracked_links_used_in_failover_scoring')}</CardDescription></CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2">
      <div class="space-y-2">
        <div class="text-sm font-medium">Tracked Interfaces</div>
        <div class="flex gap-2">
          <Input placeholder="interface" value={newTrackInterface.interface} oninput={(e) => (newTrackInterface.interface = (e.currentTarget as HTMLInputElement).value)} />
          <Input type="number" placeholder="weight" value={newTrackInterface.weight} oninput={(e) => (newTrackInterface.weight = Number((e.currentTarget as HTMLInputElement).value))} />
          <Button onclick={addTrackedInterface}>Add</Button>
        </div>
        <div class="space-y-1">
          {#each trackInterfaces as item}
            <div class="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>{item.interface} (weight {item.weight})</span><Button variant="ghost" onclick={() => removeTrackedInterface(item.interface)}>Remove</Button></div>
          {/each}
        </div>
      </div>
      <div class="space-y-2">
        <div class="text-sm font-medium">Tracked Gateways</div>
        <div class="flex gap-2">
          <Input placeholder="gateway" value={newTrackGateway.gateway} oninput={(e) => (newTrackGateway.gateway = (e.currentTarget as HTMLInputElement).value)} />
          <Input type="number" placeholder="weight" value={newTrackGateway.weight} oninput={(e) => (newTrackGateway.weight = Number((e.currentTarget as HTMLInputElement).value))} />
          <Button onclick={addTrackedGateway}>Add</Button>
        </div>
        <div class="space-y-1">
          {#each trackGateways as item}
            <div class="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>{item.gateway} (w {item.weight}, {item.check_interval_sec}s)</span><Button variant="ghost" onclick={() => removeTrackedGateway(item.gateway)}>Remove</Button></div>
          {/each}
        </div>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle>{$_('ha.rolling_upgrades')}</CardTitle><CardDescription>{$_('ha.zerodowntime_upgrade_settings_and_start_action')}</CardDescription></CardHeader>
    <CardContent class="grid gap-3 md:grid-cols-2">
      <label class="space-y-1 text-sm"><span>{$_('ha.enabled_5')}</span><div><Switch checked={bool(config.rolling_upgrade?.enabled)} onCheckedChange={(v) => { ensureNested('rolling_upgrade'); config.rolling_upgrade.enabled = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.auto_failback')}</span><div><Switch checked={bool(config.rolling_upgrade?.auto_failback)} onCheckedChange={(v) => { ensureNested('rolling_upgrade'); config.rolling_upgrade.auto_failback = v; }} /></div></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.health_check_delay_sec')}</span><Input type="number" value={config.rolling_upgrade?.health_check_delay_sec ?? ''} oninput={(e) => { ensureNested('rolling_upgrade'); config.rolling_upgrade.health_check_delay_sec = Number((e.currentTarget as HTMLInputElement).value); }} /></label>
      <label class="space-y-1 text-sm"><span>{$_('ha.max_upgrade_time_sec')}</span><Input type="number" value={config.rolling_upgrade?.max_upgrade_time_sec ?? ''} oninput={(e) => { ensureNested('rolling_upgrade'); config.rolling_upgrade.max_upgrade_time_sec = Number((e.currentTarget as HTMLInputElement).value); }} /></label>
      <div class="md:col-span-2 flex flex-wrap items-center gap-2"><Button onclick={saveUpgradeSettings}>Save Upgrade Settings</Button><Button variant="outline" onclick={startUpgrade} disabled={busy}>Start Rolling Upgrade</Button><Badge>{asString(upgradeStatus.state || 'idle')}</Badge></div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle>{$_('ha.event_log')}</CardTitle><CardDescription>{$_('ha.recent_ha_events_from_audit_trail')}</CardDescription></CardHeader>
    <CardContent>
      <div class="overflow-x-auto rounded border">
        <Table>
          <TableHeader><TableRow><TableHead>{$_('ha.timestamp')}</TableHead><TableHead>{$_('ha.type')}</TableHead><TableHead>{$_('ha.description')}</TableHead></TableRow></TableHeader>
          <TableBody>
            {#if loading}
              <TableRow><TableCell colspan={3} class="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            {:else if events.length === 0}
              <TableRow><TableCell colspan={3} class="text-center text-muted-foreground">No events</TableCell></TableRow>
            {:else}
              {#each events as event}
                <TableRow>
                  <TableCell>{asString(event.timestamp)}</TableCell>
                  <TableCell>{asString(event.event_type)}</TableCell>
                  <TableCell>{asString(event.description)}</TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
</div>
