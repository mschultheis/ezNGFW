<!-- Route view for `/bonds/lan` in the ezNGFW admin GUI. -->

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
  const isEditing = $derived(Boolean(editingId));
  const saveLabel = $derived(saving ? 'Saving...' : isEditing ? 'Update Bond' : 'Create Bond');

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
      const [bondPayload, ifacePayload] = await Promise.all([api.get<unknown[]>('/lan-bonds'), api.get<unknown[]>('/interfaces')]);
      bonds = Array.isArray(bondPayload)
        ? bondPayload.map((item) => normalizeBond((item ?? {}) as Record<string, unknown>))
        : [];
      interfaces = Array.isArray(ifacePayload)
        ? ifacePayload.map((item) => String(((item ?? {}) as Record<string, unknown>).name ?? '')).filter(Boolean)
        : [];
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load LAN bonds');
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
      toasts.warning('Bond ID is required');
      return;
    }
    if (!draft.name.trim()) {
      toasts.warning('Bond name is required');
      return;
    }

    saving = true;
    try {
      const payload = buildPayloadFromDraft();
      if (editingId) {
        await api.put(`/lan-bonds/${editingId}`, payload);
      } else {
        await api.post('/lan-bonds', payload);
      }
      toasts.success(editingId ? 'LAN bond updated' : 'LAN bond created');
      resetDraft();
      await loadData();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save LAN bond');
    } finally {
      saving = false;
    }
  }

  async function removeBond(id: string) {
    deleting = id;
    try {
      await api.del(`/lan-bonds/${id}`);
      toasts.success($_('bonds_lan.toastlan_bond_removed'));
      if (editingId === id) resetDraft();
      await loadData();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to remove LAN bond');
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
      <CardTitle class="text-slate-100">{$_('bonds_lan.lan_bond_configuration')}</CardTitle>
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div>
        <FieldLabel label="Bond ID" hint="Bond ID is the stable key used in API operations and automation. Example: lan-bond-core identifies the internal aggregate for collapsed core links." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={draft.id} disabled={isEditing} />
      </div>
      <div>
        <FieldLabel label="Bond name" hint="Use a human-friendly label for operations and incident response clarity. Example: Campus Core LACP Aggregate." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={draft.name} />
      </div>
      <div>
        <FieldLabel label="Enabled" hint="Enabled bonds are considered for runtime forwarding and failover selection immediately. Example: disable a bond while maintenance is in progress." />
        <div class="mt-2 flex items-center justify-between rounded-md border border-slate-800 px-3 py-2">
          <span class="text-xs text-slate-400">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
          <Switch checked={draft.enabled} onCheckedChange={(checked) => (draft.enabled = checked)} />
        </div>
      </div>
      <div>
        <FieldLabel label="Bond mode" hint="Bond mode controls aggregation and failover strategy for LAN uplinks. Example: 802.3ad for managed switch stacks with LACP enabled." />
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
        <FieldLabel label="Member interfaces" hint="Select interfaces that participate in this LAN bond. Example: choose eth2 and eth3 for a two-port core-facing bundle." />
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
        <FieldLabel label="Primary interface" hint="Primary interface is preferred in active-backup and similar modes. Example: set eth2 as primary and retain eth3 as standby." />
        <select
          class="mt-2 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          bind:value={draft.primary_interface}
        >
          <option value="">{$_('bonds_lan.select_primary_interface')}</option>
          {#each interfaces as iface}
            <option value={iface}>{iface}</option>
          {/each}
        </select>
      </div>
      <div>
        <FieldLabel label="LACP rate" hint="LACP rate sets partner negotiation cadence. Example: fast detects switch-port failure rapidly during campus incidents." />
        <select
              bind:value={draft.lacp_rate}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="slow">slow</option>
              <option value="fast">fast</option>
            </select>
      </div>
      <div>
        <FieldLabel label="Transmit hash policy" hint="Hash policy decides how LAN flows are distributed across links. Example: layer3+4 balances many east-west client sessions." />
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
        <FieldLabel label="MII monitor (ms)" hint="MII monitor interval controls local link polling frequency. Example: 100ms balances quick detection and low host overhead." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" bind:value={draft.mii_mon_ms} />
      </div>
      <div class="xl:col-span-2">
        <FieldLabel label="Description" hint="Description captures intent and ownership context for operators. Example: Aggregated LAN trunk to distribution switches in cabinet A3." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={draft.description} />
      </div>
    </CardContent>
    <CardContent class="flex gap-2 pt-0">
      <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveBond} disabled={saving || loading}>{saveLabel}</Button>
      <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={resetDraft}>Clear</Button>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('bonds_lan.configured_lan_bonds')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-2">
      {#if bonds.length === 0}
        <p class="text-sm text-slate-400">{$_('bonds_lan.no_lan_bonds_configured')}</p>
      {/if}
      {#each bonds as row}
        <div class="grid gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-6">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">ID</p>
            <p class="text-sm text-slate-100">{row.id}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('bonds_lan.name')}</p>
            <p class="text-sm text-slate-100">{row.name}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('bonds_lan.mode')}</p>
            <p class="text-sm text-slate-100">{row.mode}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('bonds_lan.members')}</p>
            <p class="text-sm text-slate-100">{row.member_interfaces.join(', ') || '-'}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('bonds_lan.lacp_hash')}</p>
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
