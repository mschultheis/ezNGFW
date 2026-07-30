<!-- Route view for `/shaper/rules` in the ezNGFW admin GUI. -->

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
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SaveIcon from '@lucide/svelte/icons/save';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import { _ } from '$lib/i18n';

  type FieldType = 'text' | 'number' | 'boolean' | 'select';

  type SelectOption = {
    label: string;
    value: string;
  };

  type FieldDef = {
    key: string;
    label: string;
    type: FieldType;
    hint: string;
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: SelectOption[];
    optionsSource?: 'interfaces';
    unit?: string;
  };

  const PAGE_TITLE = 'Traffic Shaper Rules';
  const PAGE_DESCRIPTION = 'Rule matrix for traffic classification and targeting with advanced matching and robust inline operations.';
  const ENDPOINT = '/shaper/rules';
  const ID_KEY = 'id';

  const BASIC_FIELDS: FieldDef[] = [
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
      optionsSource: 'interfaces'
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
    }
  ];

  const ADVANCED_FIELDS: FieldDef[] = [
    {
      key: 'timeoutIdle',
      label: 'Idle Timeout Seconds',
      type: 'number',
      hint: 'Time of inactivity before this record expires or resets. Smaller values tighten control but can increase churn for intermittent traffic. Start conservatively and adjust from observed behavior.',
      required: true,
      min: 0,
      max: 86400,
      unit: 'seconds'
    },
    {
      key: 'timeoutHard',
      label: 'Hard Timeout Seconds',
      type: 'number',
      hint: 'Maximum lifetime regardless of activity. Useful for enforcing periodic refresh and reducing stale state accumulation. Keep hard timeout larger than idle timeout unless your workflow requires strict cycles.',
      required: true,
      min: 0,
      max: 604800,
      unit: 'seconds'
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
  ];

  const ALL_FIELDS: FieldDef[] = [...BASIC_FIELDS, ...ADVANCED_FIELDS];

  const OPERATIONAL_NOTES = [
    'Treat each change as policy code and roll out safely. Create disabled records first, then enable only after validating expected traffic behavior with telemetry and logs.',
    'Keep descriptions rich with ownership and purpose details. During incidents, these notes often become the fastest route to understanding operator intent.',
    'Prefer dropdown-backed selectors and known values over free text whenever possible. Controlled choices reduce drift and eliminate avoidable typo-related failures.',
    'Tune rate, timeout, and fairness controls incrementally. Small shifts can materially change user experience under congestion or failure conditions.',
    'Review advanced toggles quarterly to retire legacy assumptions. Old settings can silently constrain performance long after topology evolves.',
    'Use deterministic naming across records so dashboards, alerts, and automation remain dependable across node replacements and upgrades.',
    'Document temporary exceptions with expiry context. Undocumented emergency overrides are a common source of long-lived configuration debt.',
    'Validate with representative traffic flows after each save. Synthetic tests alone rarely capture operational edge cases.',
    'Capture meaningful tags and identifiers for correlation. Cross-page observability improves dramatically with consistent metadata.',
    'If metrics regress after a change, revert quickly and isolate exact field deltas before attempting a second adjustment.'
  ];

  const defaultForm = ALL_FIELDS.reduce<Record<string, string | number | boolean>>((acc, field) => {
    if (field.type === 'boolean') {
      acc[field.key] = false;
      return acc;
    }
    if (field.type === 'number') {
      acc[field.key] = typeof field.min === 'number' ? field.min : 0;
      return acc;
    }
    if (field.type === 'select') {
      acc[field.key] = field.options?.[0]?.value ?? '';
      return acc;
    }
    acc[field.key] = '';
    return acc;
  }, {});

  let loading = $state(true);
  let creating = $state(false);
  let savingId = $state('');
  let deletingId = $state('');
  let lastError = $state('');

  let showGuidance = $state(false);
  let showCreateAdvanced = $state(false);
  let showValidationNotes = $state(false);
  let showLegend = $state(false);

  let interfaceOptions = $state<SelectOption[]>([]);
  let records = $state<Record<string, string | number | boolean>[]>([]);
  let form = $state<Record<string, string | number | boolean>>({ ...defaultForm });

  let editingRows = $state<Record<string, boolean>>({});
  let editingAdvanced = $state<Record<string, boolean>>({});

  function asText(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text.length > 0 ? text : fallback;
  }

  function asBool(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    return fallback;
  }

  function asNumber(value: unknown, fallback = 0): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return numeric;
  }

  function normalize(raw: unknown): Record<string, string | number | boolean> {
    const source = (raw as Record<string, unknown>) ?? {};
    const out: Record<string, string | number | boolean> = {};

    for (const field of ALL_FIELDS) {
      if (field.type === 'boolean') {
        out[field.key] = asBool(source[field.key], false);
        continue;
      }
      if (field.type === 'number') {
        out[field.key] = asNumber(source[field.key], typeof field.min === 'number' ? field.min : 0);
        continue;
      }
      out[field.key] = asText(source[field.key], field.type === 'select' ? field.options?.[0]?.value ?? '' : '');
    }

    if (!out[ID_KEY]) {
      out[ID_KEY] = crypto.randomUUID();
    }

    return out;
  }

  function rowId(row: Record<string, string | number | boolean>): string {
    const raw = row[ID_KEY];
    const text = String(raw ?? '').trim();
    if (text.length > 0) return text;
    return crypto.randomUUID();
  }

  function optionsFor(field: FieldDef): SelectOption[] {
    if (field.optionsSource === 'interfaces') return interfaceOptions;
    return field.options ?? [];
  }

  function validateRecord(record: Record<string, string | number | boolean>): string {
    for (const field of ALL_FIELDS) {
      const value = record[field.key];

      if (field.required && (field.type === 'text' || field.type === 'select')) {
        if (String(value ?? '').trim().length === 0) {
          return `${field.label} is required before saving this record.`;
        }
      }

      if (field.type === 'number') {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          return `${field.label} must be a valid number.`;
        }
        if (typeof field.min === 'number' && num < field.min) {
          return `${field.label} must be at least ${field.min}${field.unit ? ` ${field.unit}` : ''}.`;
        }
        if (typeof field.max === 'number' && num > field.max) {
          return `${field.label} must be at most ${field.max}${field.unit ? ` ${field.unit}` : ''}.`;
        }
      }

      if (field.pattern && (field.type === 'text' || field.type === 'select')) {
        const re = new RegExp(field.pattern);
        const text = String(value ?? '').trim();
        if (text.length > 0 && !re.test(text)) {
          return `${field.label} does not match expected format. Use the examples in the field hint.`;
        }
      }

      if (field.type === 'select') {
        const options = optionsFor(field);
        if (options.length > 0 && !options.some((opt) => opt.value === String(value ?? ''))) {
          return `${field.label} must be selected from the dropdown choices.`;
        }
      }
    }

    if (String(record[ID_KEY] ?? '').trim().length === 0) {
      return `${ID_KEY} is required.`;
    }

    return '';
  }

  async function loadInterfaces() {
    try {
      const payload = await api.get('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      const options = list
        .map((entry) => {
          if (typeof entry === 'string') return { label: entry, value: entry };
          const src = (entry as Record<string, unknown>) ?? {};
          const value = asText(src.name ?? src.id ?? src.interface ?? src.device ?? src.value);
          if (!value) return null;
          const label = asText(src.description ?? src.label ?? src.friendly_name ?? value, value);
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

  async function load() {
    loading = true;
    lastError = '';
    try {
      await loadInterfaces();
      const payload = await api.get(ENDPOINT);
      const list = Array.isArray(payload) ? payload : [];
      records = list.map((entry) => normalize(entry));
    } catch (error) {
      lastError = error instanceof Error ? error.message : `Failed to load ${PAGE_TITLE}`;
      toasts.error(lastError);
      records = [];
    } finally {
      loading = false;
    }
  }

  async function create() {
    const validation = validateRecord(form);
    if (validation) {
      toasts.error(validation);
      return;
    }

    creating = true;
    try {
      await api.post(ENDPOINT, { ...form });
      toasts.success(`${PAGE_TITLE} record created`);
      form = { ...defaultForm };
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : `Failed to create ${PAGE_TITLE} record`);
    } finally {
      creating = false;
    }
  }

  async function save(record: Record<string, string | number | boolean>) {
    const validation = validateRecord(record);
    if (validation) {
      toasts.error(validation);
      return;
    }

    const id = encodeURIComponent(rowId(record));
    savingId = id;
    try {
      await api.put(`${ENDPOINT}/${id}`, { ...record });
      toasts.success(`${PAGE_TITLE} record updated`);
      editingRows[rowId(record)] = false;
      editingRows = { ...editingRows };
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : `Failed to save ${PAGE_TITLE} record`);
    } finally {
      savingId = '';
    }
  }

  async function remove(record: Record<string, string | number | boolean>) {
    const id = encodeURIComponent(rowId(record));
    deletingId = id;
    try {
      await api.del(`${ENDPOINT}/${id}`);
      toasts.success(`${PAGE_TITLE} record deleted`);
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : `Failed to delete ${PAGE_TITLE} record`);
    } finally {
      deletingId = '';
    }
  }

  function setFormField(key: string, value: string | number | boolean) {
    form[key] = value;
    form = { ...form };
  }

  function setRowField(record: Record<string, string | number | boolean>, key: string, value: string | number | boolean) {
    record[key] = value;
    records = [...records];
  }

  function toggleEditor(record: Record<string, string | number | boolean>) {
    const id = rowId(record);
    editingRows[id] = !editingRows[id];
    editingRows = { ...editingRows };
  }

  function toggleAdvancedEditor(record: Record<string, string | number | boolean>) {
    const id = rowId(record);
    editingAdvanced[id] = !editingAdvanced[id];
    editingAdvanced = { ...editingAdvanced };
  }

  const enabledCount = $derived(records.filter((row) => Boolean(row.enabled)).length);
  const disabledCount = $derived(records.length - enabledCount);

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-700 bg-slate-900/95">
    <CardHeader class="space-y-3">
      <CardTitle class="text-cyan-400">{PAGE_TITLE}</CardTitle>
      <CardDescription class="text-slate-300">{PAGE_DESCRIPTION}</CardDescription>
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('shaper_rules.records')}</p>
          <p class="text-lg font-semibold text-cyan-400">{records.length}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('shaper_rules.enabled')}</p>
          <p class="text-lg font-semibold text-cyan-400">{enabledCount}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('shaper_rules.disabled')}</p>
          <p class="text-lg font-semibold text-cyan-400">{disabledCount}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" class="border-slate-700 text-slate-200 hover:bg-slate-800" onclick={() => void load()}>
          <RefreshCwIcon class="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>
      {#if lastError}
        <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{lastError}</div>
      {/if}
    </CardHeader>
  </Card>
</div>
