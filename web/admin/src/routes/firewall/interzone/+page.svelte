<!-- Route view for `/firewall/interzone` in the ezNGFW admin GUI. -->

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
  import { Badge } from '$lib/components/ui/badge';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SaveIcon from '@lucide/svelte/icons/save';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

  import { _ } from '$lib/i18n';
  type Option = { label: string; value: string };
  type ZonePolicy = {
    id?: string;
    source_zone: string;
    destination_zone: string;
    default_action: string;
    log: boolean;
    description: string;
    enabled: boolean;
    overrides: OverrideRule[];
  };
  type OverrideRule = {
    id?: string;
    protocol: string;
    source_cidr: string;
    destination_cidr: string;
    action: string;
    enabled: boolean;
    description: string;
  };
  type ZoneStats = {
    source: string;
    destination: string;
    pass: number;
    block: number;
    reject: number;
    total: number;
    bytes: number;
  };

  const actionOptions: Option[] = [
    { label: 'Pass', value: 'pass' },
    { label: 'Block', value: 'block' },
    { label: 'Reject', value: 'reject' }
  ];

  const overrideProtocolOptions: Option[] = [
    { label: 'Any', value: 'any' },
    { label: 'TCP', value: 'tcp' },
    { label: 'UDP', value: 'udp' },
    { label: 'ICMP', value: 'icmp' }
  ];

  const emptyOverride = (): OverrideRule => ({
    protocol: 'any',
    source_cidr: 'any',
    destination_cidr: 'any',
    action: 'pass',
    enabled: true,
    description: ''
  });

  const emptyPolicy = (): ZonePolicy => ({
    source_zone: '',
    destination_zone: '',
    default_action: 'block',
    log: true,
    description: '',
    enabled: true,
    overrides: [emptyOverride()]
  });

  let loading = $state(false);
  let saving = $state(false);
  let creating = $state(false);
  let deletingId = $state('');
  let expandedStats = $state(false);

  let zoneOptions = $state<Option[]>([]);
  let policies = $state<ZonePolicy[]>([]);
  let stats = $state<ZoneStats[]>([]);
  let createModel = $state<ZonePolicy>(emptyPolicy());
  let editing = $state<Record<string, boolean>>({});
  let advancedOpen = $state<Record<string, boolean>>({ create: true });

  function policyId(row: ZonePolicy) {
    return row.id && row.id.length > 0 ? row.id : `${row.source_zone}->${row.destination_zone}`;
  }

  function normalizeOverride(raw: unknown): OverrideRule {
    const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    return {
      id: String(row.id ?? row.uuid ?? ''),
      protocol: String(row.protocol ?? 'any'),
      source_cidr: String(row.source_cidr ?? row.source ?? 'any'),
      destination_cidr: String(row.destination_cidr ?? row.destination ?? 'any'),
      action: String(row.action ?? 'pass'),
      enabled: Boolean(row.enabled ?? true),
      description: String(row.description ?? '')
    };
  }

  function normalizePolicy(raw: unknown): ZonePolicy {
    const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const overrides = Array.isArray(row.overrides) ? row.overrides.map((item) => normalizeOverride(item)) : [];
    return {
      id: String(row.id ?? row.uuid ?? row.policy_id ?? ''),
      source_zone: String(row.source_zone ?? row.from_zone ?? row.from ?? ''),
      destination_zone: String(row.destination_zone ?? row.to_zone ?? row.to ?? ''),
      default_action: String(row.default_action ?? row.action ?? 'block'),
      log: Boolean(row.log ?? true),
      description: String(row.description ?? ''),
      enabled: Boolean(row.enabled ?? true),
      overrides: overrides.length > 0 ? overrides : [emptyOverride()]
    };
  }

  function normalizeStats(raw: unknown): ZoneStats {
    const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    return {
      source: String(row.source ?? row.from_zone ?? row.from ?? '-'),
      destination: String(row.destination ?? row.to_zone ?? row.to ?? '-'),
      pass: Number(row.pass ?? row.allowed ?? 0),
      block: Number(row.block ?? row.blocked ?? 0),
      reject: Number(row.reject ?? 0),
      total: Number(row.total ?? 0),
      bytes: Number(row.bytes ?? row.byte_count ?? 0)
    };
  }

  function validatePolicy(policy: ZonePolicy) {
    if (!policy.source_zone) return 'Source zone is required';
    if (!policy.destination_zone) return 'Destination zone is required';
    if (policy.source_zone === policy.destination_zone) return 'Source and destination zones should differ for inter-zone policy';
    return '';
  }

  async function loadZones() {
    try {
      const payload = await api.get<unknown[]>('/zones');
      const list = Array.isArray(payload) ? payload : [];
      zoneOptions = list
        .map((item) => {
          const row = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
          const value = String(row.name ?? row.zone ?? row.id ?? item ?? '').trim();
          return { label: value, value };
        })
        .filter((item) => item.value.length > 0);
      if (!createModel.source_zone && zoneOptions[0]) createModel.source_zone = zoneOptions[0].value;
      if (!createModel.destination_zone && zoneOptions[1]) createModel.destination_zone = zoneOptions[1].value;
      createModel = { ...createModel };
    } catch {
      zoneOptions = [];
    }
  }

  async function loadPolicies() {
    loading = true;
    try {
      const payload = await api.get<unknown>('/firewall/interzone');
      const list = Array.isArray(payload) ? payload : [];
      policies = list.map((item) => normalizePolicy(item));
    } catch {
      try {
        const fallback = await api.get<unknown>('/zones/policies');
        const list = Array.isArray(fallback) ? fallback : [];
        policies = list.map((item) => normalizePolicy(item));
      } catch (error) {
        policies = [];
        toasts.error(error instanceof Error ? error.message : 'Failed to load zone policies');
      }
    } finally {
      loading = false;
    }
  }

  async function loadStats() {
    try {
      const payload = await api.get<Record<string, unknown>>('/zones/stats');
      const matrix = Array.isArray(payload.matrix) ? payload.matrix : Array.isArray(payload.rows) ? payload.rows : [];
      stats = matrix.map((item) => normalizeStats(item));
    } catch {
      stats = [];
    }
  }

  async function refreshAll() {
    await Promise.all([loadZones(), loadPolicies(), loadStats()]);
  }

  function setCreateField<K extends keyof ZonePolicy>(key: K, value: ZonePolicy[K]) {
    createModel[key] = value;
    createModel = { ...createModel };
  }

  function setPolicyField<K extends keyof ZonePolicy>(row: ZonePolicy, key: K, value: ZonePolicy[K]) {
    row[key] = value;
    policies = [...policies];
  }

  function setOverrideField(override: OverrideRule, key: keyof OverrideRule, value: string | boolean) {
    (override as Record<string, string | boolean | undefined>)[key] = value;
    policies = [...policies];
    createModel = { ...createModel };
  }

  function addCreateOverride() {
    createModel.overrides = [...createModel.overrides, emptyOverride()];
    createModel = { ...createModel };
  }

  function removeCreateOverride(index: number) {
    createModel.overrides = createModel.overrides.filter((_, i) => i !== index);
    if (createModel.overrides.length === 0) createModel.overrides = [emptyOverride()];
    createModel = { ...createModel };
  }

  function addRowOverride(row: ZonePolicy) {
    row.overrides = [...row.overrides, emptyOverride()];
    policies = [...policies];
  }

  function removeRowOverride(row: ZonePolicy, index: number) {
    row.overrides = row.overrides.filter((_, i) => i !== index);
    if (row.overrides.length === 0) row.overrides = [emptyOverride()];
    policies = [...policies];
  }

  async function createPolicy() {
    const problem = validatePolicy(createModel);
    if (problem) {
      toasts.error(problem);
      return;
    }
    creating = true;
    try {
      await api.post('/firewall/interzone', { ...createModel, overrides: createModel.overrides.map((item) => ({ ...item })) });
      toasts.success($_('firewall_interzone.toast_zone_policy_created'));
      createModel = emptyPolicy();
      await refreshAll();
    } catch {
      try {
        await api.post('/zones/policies', { ...createModel, from_zone: createModel.source_zone, to_zone: createModel.destination_zone });
        toasts.success($_('firewall_interzone.toast_zone_policy_created'));
        createModel = emptyPolicy();
        await refreshAll();
      } catch (error) {
        toasts.error(error instanceof Error ? error.message : 'Failed to create zone policy');
      }
    } finally {
      creating = false;
    }
  }

  async function savePolicy(row: ZonePolicy) {
    const problem = validatePolicy(row);
    if (problem) {
      toasts.error(problem);
      return;
    }
    const id = encodeURIComponent(row.id ?? policyId(row));
    saving = true;
    try {
      await api.put(`/firewall/interzone/${id}`, { ...row, overrides: row.overrides.map((item) => ({ ...item })) });
      toasts.success($_('firewall_interzone.toast_zone_policy_updated'));
      editing[policyId(row)] = false;
      editing = { ...editing };
      await refreshAll();
    } catch {
      try {
        await api.post('/zones/policies', { ...row, from_zone: row.source_zone, to_zone: row.destination_zone });
        toasts.success($_('firewall_interzone.toast_zone_policy_updated'));
        editing[policyId(row)] = false;
        editing = { ...editing };
        await refreshAll();
      } catch (error) {
        toasts.error(error instanceof Error ? error.message : 'Failed to update zone policy');
      }
    } finally {
      saving = false;
    }
  }

  async function deletePolicy(row: ZonePolicy) {
    const id = encodeURIComponent(row.id ?? policyId(row));
    deletingId = id;
    try {
      await api.del(`/firewall/interzone/${id}`);
      toasts.success($_('firewall_interzone.toast_zone_policy_deleted'));
      await refreshAll();
    } catch {
      try {
        await api.del(`/zones/policies/${id}`);
        toasts.success($_('firewall_interzone.toast_zone_policy_deleted'));
        await refreshAll();
      } catch (error) {
        toasts.error(error instanceof Error ? error.message : 'Failed to delete zone policy');
      }
    } finally {
      deletingId = '';
    }
  }

  function toggleEdit(row: ZonePolicy) {
    const id = policyId(row);
    editing[id] = !editing[id];
    editing = { ...editing };
  }

  const enabledCount = $derived.by(() => policies.filter((row) => row.enabled).length);
  const overrideCount = $derived.by(() => policies.reduce((acc, row) => acc + row.overrides.length, 0));

  onMount(() => {
    void refreshAll();
  });
</script>

<div class="space-y-6 p-4 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('firewall_interzone.interzone_policy_management')}</CardTitle><CardDescription class="text-slate-400">Define default action and inline per-zone-pair override policies.</CardDescription></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_interzone.zone_pairs')}</p><p class="text-lg text-slate-100">{policies.length}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('common.enabled')}</p><p class="text-lg text-emerald-300">{enabledCount}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_interzone.override_rules')}</p><p class="text-lg text-cyan-300">{overrideCount}</p></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3"><p class="text-xs text-slate-400">{$_('firewall_interzone.known_zones')}</p><p class="text-lg text-slate-100">{zoneOptions.length}</p></div>
      </div>
      <Button variant="outline" class="border-slate-700 text-slate-100" onclick={() => void refreshAll()} disabled={loading}><RefreshCwIcon class="mr-2 h-4 w-4" />{loading ? 'Refreshing...' : 'Refresh data'}</Button>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('firewall_interzone.create_zone_pair_policy')}</CardTitle></CardHeader>
    <CardContent class="space-y-4">
      <form class="space-y-4" onsubmit={(event) => { event.preventDefault(); void createPolicy(); }}>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div class="space-y-2"><FieldLabel label="Source Zone" hint="Ingress origin zone for this zone-pair policy." /><Select.Root type="single" value={createModel.source_zone} onValueChange={(value) => value && setCreateField('source_zone', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{zoneOptions.find((opt) => opt.value === createModel.source_zone)?.label ?? 'Select source zone'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each zoneOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
          <div class="space-y-2"><FieldLabel label="Destination Zone" hint="Egress target zone for this zone-pair policy." /><Select.Root type="single" value={createModel.destination_zone} onValueChange={(value) => value && setCreateField('destination_zone', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{zoneOptions.find((opt) => opt.value === createModel.destination_zone)?.label ?? 'Select destination zone'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each zoneOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
          <div class="space-y-2"><FieldLabel label="Default Action" hint="Action taken when no override rule matches this zone pair." /><Select.Root type="single" value={createModel.default_action} onValueChange={(value) => value && setCreateField('default_action', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{actionOptions.find((opt) => opt.value === createModel.default_action)?.label ?? 'Select action'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each actionOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
          <div class="space-y-2"><FieldLabel label="Description" hint="Document why this zone pair policy exists and who owns it." /><Input class="border-slate-700 bg-slate-950" value={createModel.description} oninput={(event) => setCreateField('description', (event.currentTarget as HTMLInputElement).value)} /></div>
          <div class="space-y-2"><FieldLabel label="Log" hint="Enable logging for policy hits on this zone pair." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={createModel.log} onCheckedChange={(checked) => setCreateField('log', checked)} /><span class="text-sm text-slate-300">{createModel.log ? 'Enabled' : 'Disabled'}</span></div></div>
          <div class="space-y-2"><FieldLabel label="Enabled" hint="Enable this zone pair policy without removing its definition." /><div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={createModel.enabled} onCheckedChange={(checked) => setCreateField('enabled', checked)} /><span class="text-sm text-slate-300">{createModel.enabled ? 'Enabled' : 'Disabled'}</span></div></div>
        </div>

        <Collapsible.Root open={advancedOpen.create} class="rounded-md border border-slate-800 bg-slate-950/50 p-4">
          <Collapsible.Trigger class="flex w-full items-center justify-between" onclick={() => (advancedOpen.create = !advancedOpen.create)}><span class="text-sm font-medium text-slate-100">{$_('firewall_interzone.per_zone_pair_rule_overrides')}</span><ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${advancedOpen.create ? 'rotate-180' : ''}`} /></Collapsible.Trigger>
          <Collapsible.Content class="space-y-3 pt-4">
            {#each createModel.overrides as override, index}
              <div class="space-y-3 rounded-md border border-slate-800 bg-slate-950/40 p-3">
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <div class="space-y-1"><FieldLabel label="Protocol" hint="Protocol constraint for this override." /><Select.Root type="single" value={override.protocol} onValueChange={(value) => value && setOverrideField(override, 'protocol', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{overrideProtocolOptions.find((opt) => opt.value === override.protocol)?.label ?? 'Protocol'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each overrideProtocolOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
                  <div class="space-y-1"><FieldLabel label="Source CIDR" hint="Override source constraint for this zone pair." /><Input class="border-slate-700 bg-slate-950" value={override.source_cidr} oninput={(event) => setOverrideField(override, 'source_cidr', (event.currentTarget as HTMLInputElement).value)} /></div>
                  <div class="space-y-1"><FieldLabel label="Destination CIDR" hint="Override destination constraint for this zone pair." /><Input class="border-slate-700 bg-slate-950" value={override.destination_cidr} oninput={(event) => setOverrideField(override, 'destination_cidr', (event.currentTarget as HTMLInputElement).value)} /></div>
                  <div class="space-y-1"><FieldLabel label="Action" hint="Action to apply when override matches." /><Select.Root type="single" value={override.action} onValueChange={(value) => value && setOverrideField(override, 'action', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{actionOptions.find((opt) => opt.value === override.action)?.label ?? 'Action'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each actionOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
                  <div class="space-y-1"><FieldLabel label="Enabled" hint="Enable or disable this override rule inline." /><div class="flex h-9 items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2"><Switch checked={override.enabled} onCheckedChange={(checked) => setOverrideField(override, 'enabled', checked)} /><span class="text-xs text-slate-300">{override.enabled ? 'Enabled' : 'Disabled'}</span></div></div>
                  <div class="space-y-1"><FieldLabel label="Description" hint="Override-level context for operators." /><Input class="border-slate-700 bg-slate-950" value={override.description} oninput={(event) => setOverrideField(override, 'description', (event.currentTarget as HTMLInputElement).value)} /></div>
                </div>
                <div class="flex justify-end"><Button variant="outline" class="border-red-500/40 text-red-200" onclick={() => removeCreateOverride(index)}><Trash2Icon class="mr-2 h-4 w-4" />Remove override</Button></div>
              </div>
            {/each}
            <div class="flex justify-between"><Button variant="outline" class="border-slate-700 text-slate-100" onclick={addCreateOverride}><PlusIcon class="mr-2 h-4 w-4" />Add override</Button><Button class="bg-cyan-600 text-white hover:bg-cyan-500" type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create policy'}</Button></div>
          </Collapsible.Content>
        </Collapsible.Root>
      </form>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('firewall_interzone.existing_zone_pair_policies')}</CardTitle></CardHeader>
    <CardContent class="space-y-3">
      {#if loading}<p class="text-sm text-slate-400">{$_('firewall_interzone.loading_policies')}</p>{:else if policies.length === 0}<p class="text-sm text-slate-400">{$_('firewall_interzone.no_policies_found')}</p>{:else}
        {#each policies as row}
          {@const id = policyId(row)}
          <div class="space-y-3 rounded-md border border-slate-800 bg-slate-950/50 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2"><Badge class="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">{row.source_zone} -> {row.destination_zone}</Badge><Badge class={`border-transparent ${row.default_action === 'pass' ? 'bg-emerald-500/20 text-emerald-200' : row.default_action === 'reject' ? 'bg-amber-500/20 text-amber-200' : 'bg-red-500/20 text-red-200'}`}>{row.default_action.toUpperCase()}</Badge><Badge class="border-slate-600 bg-slate-800 text-slate-200">{row.enabled ? 'Enabled' : 'Disabled'}</Badge><Badge class="border-slate-600 bg-slate-800 text-slate-200">Overrides {row.overrides.length}</Badge></div>
              <div class="flex gap-2"><Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => toggleEdit(row)}>{editing[id] ? 'Close editor' : 'Edit inline'}</Button><Button variant="outline" class="border-red-500/40 text-red-200" onclick={() => void deletePolicy(row)} disabled={deletingId === encodeURIComponent(row.id ?? id)}><Trash2Icon class="mr-2 h-4 w-4" />{deletingId === encodeURIComponent(row.id ?? id) ? 'Deleting...' : 'Delete'}</Button></div>
            </div>
            {#if editing[id]}
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div class="space-y-1"><FieldLabel label="Source Zone" hint="Source zone selector for this policy." /><Select.Root type="single" value={row.source_zone} onValueChange={(value) => value && setPolicyField(row, 'source_zone', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{zoneOptions.find((opt) => opt.value === row.source_zone)?.label ?? 'Source zone'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each zoneOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
                <div class="space-y-1"><FieldLabel label="Destination Zone" hint="Destination zone selector for this policy." /><Select.Root type="single" value={row.destination_zone} onValueChange={(value) => value && setPolicyField(row, 'destination_zone', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{zoneOptions.find((opt) => opt.value === row.destination_zone)?.label ?? 'Destination zone'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each zoneOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
                <div class="space-y-1"><FieldLabel label="Default Action" hint="Fallback action when overrides do not match." /><Select.Root type="single" value={row.default_action} onValueChange={(value) => value && setPolicyField(row, 'default_action', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{actionOptions.find((opt) => opt.value === row.default_action)?.label ?? 'Action'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each actionOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
                <div class="space-y-1"><FieldLabel label="Description" hint="Description for runbooks and audit context." /><Input class="border-slate-700 bg-slate-950" value={row.description} oninput={(event) => setPolicyField(row, 'description', (event.currentTarget as HTMLInputElement).value)} /></div>
                <div class="space-y-1"><FieldLabel label="Log" hint="Log interzone events for this pair." /><div class="flex h-10 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={row.log} onCheckedChange={(checked) => setPolicyField(row, 'log', checked)} /></div></div>
                <div class="space-y-1"><FieldLabel label="Enabled" hint="Enable or disable policy evaluation." /><div class="flex h-10 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={row.enabled} onCheckedChange={(checked) => setPolicyField(row, 'enabled', checked)} /></div></div>
              </div>

              <div class="space-y-2 rounded-md border border-slate-800 bg-slate-950/50 p-3">
                <p class="text-sm font-medium text-slate-100">{$_('firewall_interzone.override_rules')}</p>
                {#each row.overrides as override, index}
                  <div class="grid gap-3 rounded-md border border-slate-800 bg-slate-950/40 p-3 md:grid-cols-2 xl:grid-cols-6">
                    <div class="space-y-1"><FieldLabel label="Protocol" hint="Override protocol filter." /><Select.Root type="single" value={override.protocol} onValueChange={(value) => value && setOverrideField(override, 'protocol', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{overrideProtocolOptions.find((opt) => opt.value === override.protocol)?.label ?? 'Protocol'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each overrideProtocolOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
                    <div class="space-y-1"><FieldLabel label="Source CIDR" hint="Source match for override rule." /><Input class="border-slate-700 bg-slate-950" value={override.source_cidr} oninput={(event) => setOverrideField(override, 'source_cidr', (event.currentTarget as HTMLInputElement).value)} /></div>
                    <div class="space-y-1"><FieldLabel label="Destination CIDR" hint="Destination match for override rule." /><Input class="border-slate-700 bg-slate-950" value={override.destination_cidr} oninput={(event) => setOverrideField(override, 'destination_cidr', (event.currentTarget as HTMLInputElement).value)} /></div>
                    <div class="space-y-1"><FieldLabel label="Action" hint="Action when override match occurs." /><Select.Root type="single" value={override.action} onValueChange={(value) => value && setOverrideField(override, 'action', value)}><Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{actionOptions.find((opt) => opt.value === override.action)?.label ?? 'Action'}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-950">{#each actionOptions as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-100 hover:bg-slate-800" />{/each}</Select.Content></Select.Root></div>
                    <div class="space-y-1"><FieldLabel label="Enabled" hint="Override activation toggle." /><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-2"><Switch checked={override.enabled} onCheckedChange={(checked) => setOverrideField(override, 'enabled', checked)} /></div></div>
                    <div class="space-y-1"><FieldLabel label="Description" hint="Override rationale and owner context." /><Input class="border-slate-700 bg-slate-950" value={override.description} oninput={(event) => setOverrideField(override, 'description', (event.currentTarget as HTMLInputElement).value)} /></div>
                    <div class="xl:col-span-6 flex justify-end"><Button variant="outline" class="border-red-500/40 text-red-200" onclick={() => removeRowOverride(row, index)}><Trash2Icon class="mr-2 h-4 w-4" />Remove override</Button></div>
                  </div>
                {/each}
                <div class="flex items-center justify-between"><Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => addRowOverride(row)}><PlusIcon class="mr-2 h-4 w-4" />Add override</Button><Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={() => void savePolicy(row)} disabled={saving}><SaveIcon class="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save policy'}</Button></div>
              </div>
            {:else}
              <div class="grid gap-2 text-xs text-slate-300 md:grid-cols-2 xl:grid-cols-4"><span><strong>Description:</strong> {row.description || '-'}</span><span><strong>Logging:</strong> {row.log ? 'enabled' : 'disabled'}</span><span><strong>Enabled:</strong> {row.enabled ? 'yes' : 'no'}</span><span><strong>Override count:</strong> {row.overrides.length}</span></div>
            {/if}
          </div>
        {/each}
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('firewall_interzone.zone_statistics')}</CardTitle><CardDescription class="text-slate-400">Collapsible live zone-pair counters from backend statistics.</CardDescription></CardHeader>
    <CardContent>
      <Collapsible.Root open={expandedStats} class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <Collapsible.Trigger class="flex w-full items-center justify-between" onclick={() => (expandedStats = !expandedStats)}><span class="text-sm text-slate-100">{$_('firewall_interzone.show_hide_zone_statistics')}</span><ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${expandedStats ? 'rotate-180' : ''}`} /></Collapsible.Trigger>
        <Collapsible.Content class="pt-3">
          {#if stats.length === 0}
            <p class="text-sm text-slate-400">{$_('firewall_interzone.no_zone_statistics_available')}</p>
          {:else}
            <div class="space-y-2">
              {#each stats as row}
                <div class="grid gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300 md:grid-cols-7">
                  <span>{row.source} -> {row.destination}</span><span>pass {row.pass}</span><span>block {row.block}</span><span>reject {row.reject}</span><span>total {row.total}</span><span>bytes {row.bytes}</span><span>{row.total > 0 ? `${Math.round((row.pass / row.total) * 100)}% pass` : 'n/a'}</span>
                </div>
              {/each}
            </div>
          {/if}
        </Collapsible.Content>
      </Collapsible.Root>
    </CardContent>
  </Card>
</div>
