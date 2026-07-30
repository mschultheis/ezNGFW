<!-- Route view for `/bonds` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';

  import { _ } from '$lib/i18n';
  type Bond = {
    id: string;
    name: string;
    enabled: boolean;
    mode: string;
    member_interfaces: string[];
    lacp_rate: string;
    xmit_hash_policy: string;
    mii_mon_ms: number;
    primary_interface: string;
    description: string;
  };

  type FieldDef = { key: keyof Bond; kind: 'text' | 'number'; nullable?: boolean };

  const fields: FieldDef[] = [
    { key: 'id', kind: 'text' },
    { key: 'name', kind: 'text' },
    { key: 'mode', kind: 'text' },
    { key: 'lacp_rate', kind: 'text' },
    { key: 'xmit_hash_policy', kind: 'text' },
    { key: 'mii_mon_ms', kind: 'number' },
    { key: 'primary_interface', kind: 'text' },
    { key: 'description', kind: 'text' }
  ];

  const defaultDraft: Bond = {
    id: '',
    name: '',
    enabled: true,
    mode: '802.3ad',
    member_interfaces: [],
    lacp_rate: 'slow',
    xmit_hash_policy: 'layer2',
    mii_mon_ms: 100,
    primary_interface: '',
    description: ''
  };

  let loading = $state(true);
  let saving = $state(false);
  let deleting = $state('');
  let bonds = $state<Bond[]>([]);
  let draft = $state<Bond>({ ...defaultDraft });
  let editingId = $state('');
  let interfaces = $state<string[]>([]);

  function normalizeBond(raw: Record<string, unknown>): Bond {
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      enabled: Boolean(raw.enabled ?? true),
      mode: String(raw.mode ?? '802.3ad'),
      member_interfaces: Array.isArray(raw.member_interfaces) ? raw.member_interfaces.map((item) => String(item)) : [],
      lacp_rate: String(raw.lacp_rate ?? 'slow'),
      xmit_hash_policy: String(raw.xmit_hash_policy ?? 'layer2'),
      mii_mon_ms: Number(raw.mii_mon_ms ?? 100),
      primary_interface: String(raw.primary_interface ?? ''),
      description: String(raw.description ?? '')
    };
  }

  async function loadData() {
    loading = true;
    try {
      const [bondPayload, ifacePayload] = await Promise.all([api.get<unknown[]>('/bonds'), api.get<unknown[]>('/interfaces')]);
      bonds = Array.isArray(bondPayload)
        ? bondPayload.map((item) => normalizeBond((item ?? {}) as Record<string, unknown>))
        : [];
      interfaces = Array.isArray(ifacePayload)
        ? ifacePayload.map((item) => String(((item ?? {}) as Record<string, unknown>).name ?? '')).filter(Boolean)
        : [];
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load WAN bonds');
    } finally {
      loading = false;
    }
  }

  function editBond(row: Bond) {
    draft = { ...row };
    editingId = row.id;
  }

  function resetDraft() {
    draft = { ...defaultDraft };
    editingId = '';
  }

  function buildPayloadFromDraft() {
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const val = draft[field.key];
      if (field.nullable && (val === '' || val === undefined)) {
        payload[field.key] = null;
      } else if (field.kind === 'number') {
        payload[field.key] = val === '' ? 0 : Number(val);
      } else {
        payload[field.key] = val;
      }
    }
    payload.enabled = draft.enabled;
    payload.member_interfaces = draft.member_interfaces;
    return payload;
  }

  async function saveBond() {
    if (!draft.id.trim()) {
      toasts.warning($_('bonds.toast_bond_id_is_required'));
      return;
    }
    if (!draft.name.trim()) {
      toasts.warning($_('bonds.toast_bond_name_is_required'));
      return;
    }

    saving = true;
    try {
      const payload = buildPayloadFromDraft();
      if (editingId) {
        await api.put(`/bonds/${editingId}`, payload);
      } else {
        await api.post('/bonds', payload);
      }
      toasts.success(editingId ? 'WAN bond updated' : 'WAN bond created');
      resetDraft();
      await loadData();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save WAN bond');
    } finally {
      saving = false;
    }
  }

  async function removeBond(id: string) {
    deleting = id;
    try {
      await api.del(`/bonds/${id}`);
      toasts.success($_('bonds.toast_wan_bond_removed'));
      if (editingId === id) resetDraft();
      await loadData();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to remove WAN bond');
    } finally {
      deleting = '';
    }
  }

  onMount(() => {
    void loadData();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('bonds.wan_bond_configuration')}</CardTitle>
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div>
        <FieldLabel label="Bond ID" hint="Bond ID is the stable key used in API operations and automation. Example: bond-core-uplink identifies the aggregate feeding a datacenter core." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={draft.id} disabled={Boolean(editingId)} />
      </div>
      <div>
        <FieldLabel label="Bond name" hint="Use a human-friendly label for operations and incident response clarity. Example: LACP Fiber Aggregate North Rack." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={draft.name} />
      </div>
      <div>
        <FieldLabel label="Enabled" hint="Enabled bonds are considered for runtime forwarding and failover selection immediately. Example: disable a bond while cabling or switch-side LACP troubleshooting is in progress." />
        <div class="mt-2 flex items-center justify-between rounded-md border border-slate-800 px-3 py-2">
          <span class="text-xs text-slate-400">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
          <Switch checked={draft.enabled} onCheckedChange={(checked) => (draft.enabled = checked)} />
        </div>
      </div>
      <div>
        <FieldLabel label="Bond mode" hint="Bond mode controls link aggregation behavior and failover strategy with upstream switches. Example: 802.3ad for standards-based LACP with managed switch stacks." />
        <select
              bind:value={draft.mode}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="balance-rr">balance-rr</option>
              <option value="active-backup">active-backup</option>
              <option value="balance-xor">balance-xor</option>
              <option value="broadcast">broadcast</option>
              <option value="802.3ad">802.3ad</option>
              <option value="balance-tlb">balance-tlb</option>
              <option value="balance-alb">balance-alb</option>
            </select>
      </div>
      <div>
        <FieldLabel label="Member interfaces" hint="Select the interfaces that participate in this WAN bond. Example: choose eth0 and eth1 to build a two-port LACP aggregate toward the upstream switch pair." />
        <div class="mt-2 grid gap-2 rounded-md border border-slate-800 bg-slate-950 p-2">
          {#each interfaces as iface}
            <label class="flex items-center justify-between rounded-md border border-slate-800 px-2 py-1 text-sm text-slate-200">
              <span>{iface}</span>
              <input
                type="checkbox"
                checked={draft.member_interfaces.includes(iface)}
                onchange={(event) => {
                  const checked = (event.currentTarget as HTMLInputElement).checked;
                  if (checked && !draft.member_interfaces.includes(iface)) {
                    draft.member_interfaces = [...draft.member_interfaces, iface];
                  }
                  if (!checked) {
                    draft.member_interfaces = draft.member_interfaces.filter((item) => item !== iface);
                  }
                }}
              />
            </label>
          {/each}
        </div>
      </div>
      <div>
        <FieldLabel label="Primary interface" hint="Primary interface is preferred in active-backup or related failover-oriented bonding modes. Example: set eth0 as primary while eth1 remains warm standby." />
        <select
          class="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          bind:value={draft.primary_interface}
        >
          <option value="">Select primary interface</option>
          {#each interfaces as iface}
            <option value={iface}>{iface}</option>
          {/each}
        </select>
      </div>
      <div>
        <FieldLabel label="LACP rate" hint="LACP rate sets partner negotiation cadence for link health signaling. Example: fast improves detection speed but increases control traffic to one-second intervals." />
        <select
              bind:value={draft.lacp_rate}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="slow">slow</option>
              <option value="fast">fast</option>
            </select>
      </div>
      <div>
        <FieldLabel label="Transmit hash policy" hint="Hash policy decides how flows are distributed across member links in balance modes. Example: layer3+4 improves entropy for many-client northbound internet traffic." />
        <select
              bind:value={draft.xmit_hash_policy}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="layer2">layer2</option>
              <option value="layer2+3">layer2+3</option>
              <option value="layer3+4">layer3+4</option>
              <option value="encap2+3">encap2+3</option>
              <option value="encap3+4">encap3+4</option>
            </select>
      </div>
      <div>
        <FieldLabel label="MII monitor (ms)" hint="MII monitor interval controls link polling frequency for fast local failure detection. Example: 100ms detects cable pulls quickly without excessive host overhead." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" bind:value={draft.mii_mon_ms} />
      </div>
      <div class="xl:col-span-2">
        <FieldLabel label="Description" hint="Description captures intent, upstream dependency, and ownership context for operators. Example: Aggregated WAN handoff to ISP-A metro pair in cabinet R12." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={draft.description} />
      </div>
    </CardContent>
    <CardContent class="flex gap-2 pt-0">
      <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveBond} disabled={saving || loading}>{saving ? 'Saving...' : editingId ? 'Update Bond' : 'Create Bond'}</Button>
      <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={resetDraft}>{$_('bonds.clear')}</Button>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('bonds.configured_bonds')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-2">
      {#if bonds.length === 0}
        <p class="text-sm text-slate-400">{$_('bonds.no_wan_bonds_configured')}</p>
      {/if}
      {#each bonds as row}
        <div class="grid gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-6">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('bonds.id')}</p>
            <p class="text-sm text-slate-100">{row.id}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('common.name')}</p>
            <p class="text-sm text-slate-100">{row.name}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('bonds.mode')}</p>
            <p class="text-sm text-slate-100">{row.mode}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('bonds.members')}</p>
            <p class="text-sm text-slate-100">{row.member_interfaces.join(', ') || '-'}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('bonds.lacp_hash')}</p>
            <p class="text-sm text-slate-100">{row.lacp_rate} / {row.xmit_hash_policy}</p>
          </div>
          <div class="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={() => editBond(row)}>Edit</Button>
            <Button size="sm" variant="destructive" onclick={() => void removeBond(row.id)} disabled={deleting === row.id}>{deleting === row.id ? 'Removing...' : 'Delete'}</Button>
          </div>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
