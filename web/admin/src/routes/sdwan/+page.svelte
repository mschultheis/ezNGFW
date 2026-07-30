<!-- Route view for `/sdwan` in the ezNGFW admin GUI. -->

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

  type SdWanPolicy = {
    id: string;
    name: string;
    enabled: boolean;
    description: string;
    match_application: string[];
    match_dscp: string[];
    match_source: string[];
    match_destination: string[];
    preferred_wan: string[];
    routing_mode: string;
    sla_latency_ms: number;
    sla_jitter_ms: number;
    sla_packet_loss_pct: number;
    fec_enabled: boolean;
    fec_redundancy_pct: number;
    failover_action: string;
  };

  type FieldDef = { key: keyof SdWanPolicy; kind: 'text' | 'number'; nullable?: boolean };

  const fields: FieldDef[] = [
    { key: 'id', kind: 'text' },
    { key: 'name', kind: 'text' },
    { key: 'description', kind: 'text' },
    { key: 'routing_mode', kind: 'text' },
    { key: 'sla_latency_ms', kind: 'number' },
    { key: 'sla_jitter_ms', kind: 'number' },
    { key: 'sla_packet_loss_pct', kind: 'number' },
    { key: 'fec_redundancy_pct', kind: 'number' },
    { key: 'failover_action', kind: 'text' }
  ];

  const defaultDraft: SdWanPolicy = {
    id: '',
    name: '',
    enabled: true,
    description: '',
    match_application: [],
    match_dscp: [],
    match_source: [],
    match_destination: [],
    preferred_wan: [],
    routing_mode: 'performance',
    sla_latency_ms: 150,
    sla_jitter_ms: 50,
    sla_packet_loss_pct: 5,
    fec_enabled: false,
    fec_redundancy_pct: 0,
    failover_action: 'next-preferred'
  };

  let loading = $state(true);
  let saving = $state(false);
  let deleting = $state('');
  let policies = $state<SdWanPolicy[]>([]);
  let draft = $state<SdWanPolicy>({ ...defaultDraft });
  let editingId = $state('');
  let availableWans = $state<string[]>([]);

  function csvToList(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function listToCsv(value: string[]): string {
    return value.join(', ');
  }

  function normalizePolicy(raw: Record<string, unknown>): SdWanPolicy {
    return {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      enabled: Boolean(raw.enabled ?? true),
      description: String(raw.description ?? ''),
      match_application: Array.isArray(raw.match_application) ? raw.match_application.map((item) => String(item)) : [],
      match_dscp: Array.isArray(raw.match_dscp) ? raw.match_dscp.map((item) => String(item)) : [],
      match_source: Array.isArray(raw.match_source) ? raw.match_source.map((item) => String(item)) : [],
      match_destination: Array.isArray(raw.match_destination) ? raw.match_destination.map((item) => String(item)) : [],
      preferred_wan: Array.isArray(raw.preferred_wan) ? raw.preferred_wan.map((item) => String(item)) : [],
      routing_mode: String(raw.routing_mode ?? 'performance'),
      sla_latency_ms: Number(raw.sla_latency_ms ?? 150),
      sla_jitter_ms: Number(raw.sla_jitter_ms ?? 50),
      sla_packet_loss_pct: Number(raw.sla_packet_loss_pct ?? 5),
      fec_enabled: Boolean(raw.fec_enabled ?? false),
      fec_redundancy_pct: Number(raw.fec_redundancy_pct ?? 0),
      failover_action: String(raw.failover_action ?? 'next-preferred')
    };
  }

  async function loadData() {
    loading = true;
    try {
      const [policyPayload, wanPayload] = await Promise.all([api.get<unknown[]>('/sdwan/policies'), api.get<unknown[]>('/wans')]);
      policies = Array.isArray(policyPayload)
        ? policyPayload.map((item) => normalizePolicy((item ?? {}) as Record<string, unknown>))
        : [];
      availableWans = Array.isArray(wanPayload)
        ? wanPayload.map((item) => String(((item ?? {}) as Record<string, unknown>).id ?? '')).filter(Boolean)
        : [];
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load SD-WAN policies');
    } finally {
      loading = false;
    }
  }

  function editPolicy(row: SdWanPolicy) {
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
    payload.fec_enabled = draft.fec_enabled;
    payload.match_application = draft.match_application;
    payload.match_dscp = draft.match_dscp;
    payload.match_source = draft.match_source;
    payload.match_destination = draft.match_destination;
    payload.preferred_wan = draft.preferred_wan;
    return payload;
  }

  async function savePolicy() {
    if (!draft.id.trim()) {
      toasts.warning('Policy ID is required');
      return;
    }
    if (!draft.name.trim()) {
      toasts.warning('Policy name is required');
      return;
    }

    saving = true;
    try {
      const payload = buildPayloadFromDraft();
      if (editingId) {
        await api.put(`/sdwan/policies/${editingId}`, payload);
      } else {
        await api.post('/sdwan/policies', payload);
      }
      toasts.success(editingId ? 'SD-WAN policy updated' : 'SD-WAN policy created');
      resetDraft();
      await loadData();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save SD-WAN policy');
    } finally {
      saving = false;
    }
  }

  async function removePolicy(id: string) {
    deleting = id;
    try {
      await api.del(`/sdwan/policies/${id}`);
      toasts.success($_('sdwan.toastsdwan_policy_removed'));
      if (editingId === id) resetDraft();
      await loadData();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to remove SD-WAN policy');
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
      <CardTitle class="text-slate-100">{$_('sdwan.sdwan_policy_management')}</CardTitle>
    </CardHeader>
    <CardContent class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div>
        <FieldLabel label="Policy ID" hint="Policy ID is the immutable key used by API and automation workflows. Example: branch-voice-priority for a branch-office VoIP optimization policy." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={draft.id} disabled={Boolean(editingId)} />
      </div>
      <div>
        <FieldLabel label="Policy name" hint="Name should explain intent so operators can troubleshoot quickly under incidents. Example: Voice Priority via Fiber then MPLS Backup." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={draft.name} />
      </div>
      <div>
        <FieldLabel label="Enabled" hint="Enabled policies participate in traffic steering and SLA decisions immediately. Example: disable a policy during maintenance to keep test traffic on default routes." />
        <div class="mt-2 flex items-center justify-between rounded-md border border-slate-800 px-3 py-2">
          <span class="text-xs text-slate-400">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
          <Switch checked={draft.enabled} onCheckedChange={(checked) => (draft.enabled = checked)} />
        </div>
      </div>
      <div>
        <FieldLabel label="Routing mode" hint="Routing mode defines optimization objective between quality, performance, and cost. Example: select quality for call-center voice trunks where jitter matters more than bandwidth price." />
        <select
              bind:value={draft.routing_mode}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="performance">performance</option>
              <option value="cost">cost</option>
              <option value="latency">latency</option>
              <option value="jitter">jitter</option>
              <option value="packet-loss">packet-loss</option>
              <option value="weighted">weighted</option>
              <option value="manual">manual</option>
            </select>
      </div>
      <div>
        <FieldLabel label="Preferred WAN list" hint="Provide ordered WAN IDs for primary, secondary, and tertiary path selection. Example: wan1,wan2 ensures the policy fails over in deterministic order." />
        <div class="mt-2 grid gap-2 rounded-md border border-slate-800 bg-slate-950 p-2">
          {#each availableWans as wanId}
            <label class="flex items-center justify-between rounded-md border border-slate-800 px-2 py-1 text-sm text-slate-200">
              <span>{wanId}</span>
              <input
                type="checkbox"
                checked={draft.preferred_wan.includes(wanId)}
                onchange={(event) => {
                  const checked = (event.currentTarget as HTMLInputElement).checked;
                  if (checked && !draft.preferred_wan.includes(wanId)) {
                    draft.preferred_wan = [...draft.preferred_wan, wanId];
                  }
                  if (!checked) {
                    draft.preferred_wan = draft.preferred_wan.filter((item) => item !== wanId);
                  }
                }}
              />
            </label>
          {/each}
        </div>
      </div>
      <div>
        <FieldLabel label="Match applications" hint="Application selectors match by L7 engine labels or known categories. Example: office365,voip sends collaboration traffic through low-jitter WAN links." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" value={listToCsv(draft.match_application)} oninput={(event) => (draft.match_application = csvToList((event.currentTarget as HTMLInputElement).value))} placeholder="office365, voip" />
      </div>
      <div>
        <FieldLabel label="Match DSCP" hint="DSCP selectors apply policy based on QoS markings from upstream clients or edge switches. Example: EF,AF41 keeps real-time traffic aligned to premium uplinks." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" value={listToCsv(draft.match_dscp)} oninput={(event) => (draft.match_dscp = csvToList((event.currentTarget as HTMLInputElement).value))} placeholder={$_('sdwan.placeholderef_af41')} />
      </div>
      <div>
        <FieldLabel label="Match source CIDRs" hint="Source CIDR list narrows policy scope to specific sites, VLANs, or tenant segments. Example: 10.20.0.0/16 targets call-center and CRM users only." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" value={listToCsv(draft.match_source)} oninput={(event) => (draft.match_source = csvToList((event.currentTarget as HTMLInputElement).value))} placeholder="10.20.0.0/16" />
      </div>
      <div>
        <FieldLabel label="Match destination CIDRs" hint="Destination CIDRs steer traffic toward application VIPs, cloud ranges, or branch overlays. Example: 203.0.113.0/24 to pin ERP datacenter traffic on private MPLS." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" value={listToCsv(draft.match_destination)} oninput={(event) => (draft.match_destination = csvToList((event.currentTarget as HTMLInputElement).value))} placeholder="203.0.113.0/24" />
      </div>
      <div>
        <FieldLabel label="Failover action" hint="Failover action controls behavior when no preferred link meets SLA constraints. Example: next-preferred keeps traffic flowing while preserving policy intent during impairments." />
        <select
              bind:value={draft.failover_action}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="failover">failover</option>
              <option value="failback">failback</option>
              <option value="notify-only">notify-only</option>
              <option value="load-balance">load-balance</option>
            </select>
      </div>
      <div>
        <FieldLabel label="SLA latency (ms)" hint="Maximum one-way path delay tolerated for this policy before reroute. Example: 120ms for voice and 250ms for bulk sync jobs." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" bind:value={draft.sla_latency_ms} />
      </div>
      <div>
        <FieldLabel label="SLA jitter (ms)" hint="Jitter budget defines acceptable variation in packet inter-arrival times. Example: keep below 30ms for UCaaS voice quality targets." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" bind:value={draft.sla_jitter_ms} />
      </div>
      <div>
        <FieldLabel label="SLA packet loss (%)" hint="Packet loss budget should align with app resiliency and codec behavior. Example: 2% for interactive media and 5% for tolerant SaaS flows." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" bind:value={draft.sla_packet_loss_pct} />
      </div>
      <div>
        <FieldLabel label="FEC enabled" hint="Forward Error Correction can recover from sporadic loss without full retransmits. Example: enable FEC on high-latency links carrying business-critical voice/video." />
        <div class="mt-2 flex items-center justify-between rounded-md border border-slate-800 px-3 py-2">
          <span class="text-xs text-slate-400">{draft.fec_enabled ? 'Enabled' : 'Disabled'}</span>
          <Switch checked={draft.fec_enabled} onCheckedChange={(checked) => (draft.fec_enabled = checked)} />
        </div>
      </div>
      <div>
        <FieldLabel label="FEC redundancy (%)" hint="Redundancy controls extra parity overhead for packet recovery under loss. Example: 20 means one parity block for every five data blocks on unstable WANs." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" bind:value={draft.fec_redundancy_pct} />
      </div>
      <div class="xl:col-span-2">
        <FieldLabel label="Description" hint="Document policy purpose and business owner to speed troubleshooting and audits. Example: Prioritize CRM and voice traffic for sales floor branch during peak hours." />
        <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={draft.description} />
      </div>
    </CardContent>
    <CardContent class="flex gap-2 pt-0">
      <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={savePolicy} disabled={saving || loading}>{saving ? 'Saving...' : editingId ? 'Update Policy' : 'Create Policy'}</Button>
      <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={resetDraft}>Clear</Button>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('sdwan.configured_policies')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-2">
      {#if policies.length === 0}
        <p class="text-sm text-slate-400">{$_('sdwan.no_sdwan_policies_configured')}</p>
      {/if}
      {#each policies as row}
        <div class="grid gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-6">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">ID</p>
            <p class="text-sm text-slate-100">{row.id}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('sdwan.name')}</p>
            <p class="text-sm text-slate-100">{row.name}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('sdwan.mode')}</p>
            <p class="text-sm text-slate-100">{row.routing_mode}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('sdwan.preferred_wan')}</p>
            <p class="text-sm text-slate-100">{row.preferred_wan.join(', ') || '-'}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">SLA</p>
            <p class="text-sm text-slate-100">{row.sla_latency_ms}ms / {row.sla_jitter_ms}ms / {row.sla_packet_loss_pct}%</p>
          </div>
          <div class="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={() => editPolicy(row)}>Edit</Button>
            <Button size="sm" variant="destructive" onclick={() => void removePolicy(row.id)} disabled={deleting === row.id}>{deleting === row.id ? 'Removing...' : 'Delete'}</Button>
          </div>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
