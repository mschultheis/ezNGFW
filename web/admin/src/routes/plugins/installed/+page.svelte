<!-- Route view for `/plugins/installed` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';
  import { _ } from '$lib/i18n';

  const PAGE_TITLE = 'Installed Plugins';
  const PAGE_DESCRIPTION = 'Plugin lifecycle inventory with deep inline CRUD workflows, advanced controls, and deterministic validation.';
  const ENDPOINT = '/plugins/installed';
  const ID_KEY = 'id';

  const columns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'interface', label: 'Interface' },
    { key: 'enabled', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'mode', label: 'Mode' },
    { key: 'rateLimit', label: 'Rate Limit' },
    { key: 'tag', label: 'Tag' }
  ];

  let interfaceOptions = $state<SelectOption[]>([]);
  let records = $state<Record<string, any>[]>([]);
  let loading = $state(true);

  const fields = $derived.by((): FormField[] => [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      hint: 'Unique name used in references, automation workflows, and troubleshooting notes. Keep names stable and descriptive so policy intent is obvious during incident response. Example: edge-primary-main.',
      required: true,
      pattern: '^[a-zA-Z0-9_-]+$'
    },
    {
      key: 'interface',
      label: 'Interface',
      type: 'select',
      hint: 'Interface where this record applies and is enforced during packet processing. Choose the exact link carrying the target traffic to avoid silent no-op behavior. Interface selection should follow topology documentation.',
      required: true,
      options: interfaceOptions
    },
    {
      key: 'enabled',
      label: 'Enabled',
      type: 'boolean',
      hint: 'Switch that controls whether this record is active immediately after save. Disable during staged changes and enable only after confirming expected behavior in telemetry. This reduces operational risk in production windows.'
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'number',
      hint: 'Relative order or preference value used by evaluators when multiple records overlap. Lower values are generally processed first and should be reserved for critical policy. Keep priority ranges intentional and documented.',
      required: true,
      min: 1,
      max: 1000
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      hint: 'Operational summary describing purpose, owner, and expected traffic or behavior. Include examples and constraints so responders can quickly validate intent during outages. Clear descriptions are mandatory for long-term maintainability.',
      required: true
    },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      hint: 'Primary operating mode that determines default behavior and guardrails for this record. Select the mode that matches your service objective and compliance profile. Keep choices explicit for predictable operations.',
      required: true,
      options: [
        { label: 'Balanced', value: 'balanced' },
        { label: 'Aggressive', value: 'aggressive' },
        { label: 'Conservative', value: 'conservative' }
      ]
    },
    {
      key: 'rateLimit',
      label: 'Rate Limit',
      type: 'number',
      hint: 'Numeric limit applied to throughput, sessions, or updates depending on this page context. Set realistic values based on measured capacity instead of nominal vendor speeds. Always validate impact after changes.',
      required: true,
      min: 0,
      max: 10000000
    },
    {
      key: 'rateUnit',
      label: 'Rate Unit',
      type: 'select',
      hint: 'Unit paired with the rate limit to determine final effective value. Use Kbps or Mbps for network controls, and keep unit choice consistent with runbook examples. Mixed units across records can cause confusion.',
      required: true,
      options: [
        { label: 'Kbps', value: 'kbps' },
        { label: 'Mbps', value: 'mbps' },
        { label: 'Gbps', value: 'gbps' }
      ]
    },
    {
      key: 'tag',
      label: 'Tag',
      type: 'text',
      hint: 'Short metadata tag used for filtering, grouping, and alert correlation across dashboards. Use lowercase slug style like branch-edge and guest-zone. Consistent tags improve observability quality.',
      pattern: '^[a-z0-9_-]*$'
    },
    {
      key: 'timeoutIdle',
      label: 'Idle Timeout Seconds',
      type: 'number',
      hint: 'Time of inactivity before this record expires or resets. Smaller values tighten control but can increase churn for intermittent traffic. Start conservatively and adjust from observed behavior.',
      required: true,
      min: 0,
      max: 86400
    },
    {
      key: 'timeoutHard',
      label: 'Hard Timeout Seconds',
      type: 'number',
      hint: 'Maximum lifetime regardless of activity. Useful for enforcing periodic refresh and reducing stale state accumulation. Keep hard timeout larger than idle timeout unless your workflow requires strict cycles.',
      required: true,
      min: 0,
      max: 604800
    },
    {
      key: 'burst',
      label: 'Burst Allowance',
      type: 'number',
      hint: 'Short-term burst budget to absorb traffic spikes before steady-state limits apply. Moderate burst values improve user experience without sacrificing control. Oversized bursts can hide congestion issues.',
      required: true,
      min: 0,
      max: 100000
    },
    {
      key: 'scheduler',
      label: 'Scheduler',
      type: 'select',
      hint: 'Underlying algorithm that arbitrates fairness and latency under contention. Choose FQ-CoDel for mixed traffic, PRIQ for strict ordering, or WF2Q+ for weighted fairness. Match scheduler to workload goals.',
      required: true,
      options: [
        { label: 'FQ-CoDel', value: 'fq_codel' },
        { label: 'PRIQ', value: 'priq' },
        { label: 'WF2Q+', value: 'wf2q+' }
      ]
    },
    {
      key: 'logMatches',
      label: 'Log Events',
      type: 'boolean',
      hint: 'Enables detailed logging for this record to support debugging and audit workflows. Use in targeted scenarios because high-volume records can produce substantial log traffic. Pair with clear prefixes for filtering.'
    },
    {
      key: 'logPrefix',
      label: 'Log Prefix',
      type: 'text',
      hint: 'Prefix attached to related log entries for fast SIEM filtering. Keep it short, deterministic, and aligned with team naming conventions. Example: qos-core-voice.',
      pattern: '^[a-zA-Z0-9_-]*$'
    },
    {
      key: 'monitorTarget',
      label: 'Monitor Target',
      type: 'text',
      hint: 'Host, address, or service name used for runtime health validation tied to this record. Use stable targets that represent real dependency availability. Avoid transient endpoints that create noisy false positives.'
    },
    {
      key: 'retryLimit',
      label: 'Retry Limit',
      type: 'number',
      hint: 'Maximum remediation attempts before surfacing a hard error state. Keep limits low enough to reveal persistent failure quickly while tolerating short-lived transients. Typical values range between 2 and 6.',
      required: true,
      min: 0,
      max: 20
    },
    {
      key: 'strictOrder',
      label: 'Strict Ordering',
      type: 'boolean',
      hint: 'Forces deterministic processing order when multiple records overlap. Enable only when policy precedence must be explicit because strict behavior can reduce flexibility. Leave disabled in simpler deployments.'
    }
  ]);

  async function loadInterfaces() {
    try {
      const payload = await api.get('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      const options = list
        .map((entry) => {
          if (typeof entry === 'string') return { label: entry, value: entry };
          const src = (entry as Record<string, unknown>) ?? {};
          const value = String(src.name ?? src.id ?? src.interface ?? src.device ?? src.value ?? '').trim();
          if (!value) return null;
          const label = String(src.description ?? src.label ?? src.friendly_name ?? value).trim() || value;
          return { label, value };
        })
        .filter((entry): entry is SelectOption => entry !== null);

      const deduped = new Map<string, SelectOption>();
      for (const option of options) {
        if (!deduped.has(option.value)) deduped.set(option.value, option);
      }
      interfaceOptions = [...deduped.values()].sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      interfaceOptions = [];
    }
  }

  async function loadRecords() {
    try {
      const payload = await api.get(ENDPOINT);
      records = Array.isArray(payload) ? payload : [];
    } catch {
      records = [];
    }
  }

  async function loadAll() {
    loading = true;
    await Promise.all([loadInterfaces(), loadRecords()]);
    loading = false;
  }

  const enabledCount = $derived(records.filter((row) => Boolean(row.enabled)).length);
  const disabledCount = $derived(records.length - enabledCount);

  onMount(() => {
    void loadAll();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-700 bg-slate-900/95">
    <CardHeader class="space-y-3">
      <CardTitle class="text-cyan-400">{PAGE_TITLE}</CardTitle>
      <CardDescription class="text-slate-300">{PAGE_DESCRIPTION}</CardDescription>
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('plugins_installed.records')}</p>
          <p class="text-lg font-semibold text-cyan-400">{records.length}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('plugins_installed.enabled')}</p>
          <p class="text-lg font-semibold text-emerald-400">{enabledCount}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('plugins_installed.disabled')}</p>
          <p class="text-lg font-semibold text-amber-400">{disabledCount}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" class="cursor-pointer border-slate-700 text-slate-200 hover:bg-slate-800" onclick={() => void loadAll()}>
          <RefreshCwIcon class="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>
    </CardHeader>
  </Card>

  <ResourceTable
    title={$_('plugins_installed.titleplugin_inventory')}
    description={$_('plugins_installed.descriptionmanage_installed_plugins_and_their_oper')}
    endpoint={ENDPOINT}
    columns={columns}
    fields={fields}
    idKey={ID_KEY}
    addLabel={$_('plugins_installed.addlabeladd_plugin_record')}
    
  />
</div>