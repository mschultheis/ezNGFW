<!-- Route view for `/routing/table` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { toasts } from '$lib/stores/toast';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Plus from '@lucide/svelte/icons/plus';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import { _ } from '$lib/i18n';

  type Option = {
    value: string;
    label: string;
  };

  type Field = {
    key: string;
    label: string;
    kind: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
    required?: boolean;
    advanced?: boolean;
    nullable?: boolean;
    min?: number;
    max?: number;
    placeholder?: string;
    hint: string;
    options?: Option[];
  };

  type SortKey =
    | 'name'
    | 'scope'
    | 'priority'
    | 'updatedAt'
    | 'enabled';

  const statusFilterOptions: Option[] = [
    {
      value: 'all',
      label: 'All rows'
    },
    {
      value: 'enabled',
      label: 'Enabled only'
    },
    {
      value: 'disabled',
      label: 'Disabled only'
    }
  ];

  const sortKeyOptions: Option[] = [
    {
      value: 'updatedAt',
      label: 'Sort by Updated'
    },
    {
      value: 'name',
      label: 'Sort by Name'
    },
    {
      value: 'scope',
      label: 'Sort by Scope'
    },
    {
      value: 'priority',
      label: 'Sort by Priority'
    },
    {
      value: 'enabled',
      label: 'Sort by Enabled'
    }
  ];

  const settingsFields: Field[] = [
    {
      key: 'autoApply',
      label: 'Auto Apply on Save',
      kind: 'boolean',
      hint: 'Automatically applies changes after each save so operational state stays aligned with intended policy. Use this for low-risk edits that should take effect immediately without manual follow-up.'
    },
    {
      key: 'defaultScope',
      label: 'Default Scope',
      kind: 'select',
      options: [
        {
          value: 'global',
          label: 'Global'
        },
        {
          value: 'interface',
          label: 'Per Interface'
        },
        {
          value: 'pool',
          label: 'Per Pool'
        },
        {
          value: 'reservation',
          label: 'Per Reservation'
        }
      ],
      hint: 'Defines the default targeting context used for new records. Selecting a narrower default scope helps reduce accidental blast radius during rapid data entry.'
    },
    {
      key: 'validateStrict',
      label: 'Strict Value Validation',
      kind: 'boolean',
      hint: 'Enforces strict parser checks before writes reach the backend API. Keep this enabled in production to catch malformed values early and avoid service restarts caused by invalid payloads.'
    },
    {
      key: 'conflictMode',
      label: 'Duplicate Conflict Policy',
      kind: 'select',
      options: [
        {
          value: 'reject',
          label: 'Reject duplicates'
        },
        {
          value: 'override',
          label: 'Newest wins'
        },
        {
          value: 'merge',
          label: 'Merge by scope'
        }
      ],
      hint: 'Determines what happens when overlapping records are detected. Reject mode is safest for auditability while override mode can speed emergency edits when ownership is clear.'
    },
    {
      key: 'requireDescription',
      label: 'Require Change Description',
      kind: 'boolean',
      hint: 'Requires operators to document intent when changing records. This improves handoff quality during shift changes and makes forensic review easier after incidents.'
    },
    {
      key: 'logDeliveries',
      label: 'Log Delivery Events',
      kind: 'boolean',
      hint: 'Adds enriched logging for when data from this page is delivered at runtime. Enable temporarily during troubleshooting and disable later to keep log volume under control.'
    },
    {
      key: 'maxPayloadSize',
      label: 'Maximum Payload Size (bytes)',
      kind: 'number',
      min: 64,
      max: 65535,
      hint: 'Hard upper bound for payload data accepted in a single record. This protects parser memory behavior and keeps large outlier entries from destabilizing dependent services.'
    },
    {
      key: 'refreshSeconds',
      label: 'Auto Refresh Interval (seconds)',
      kind: 'number',
      min: 5,
      max: 900,
      hint: 'Polling interval for table and status panels in this page. Use shorter intervals during active debugging and longer intervals during steady-state operations.'
    },
    {
      key: 'autoRefresh',
      label: 'Enable Auto Refresh',
      kind: 'boolean',
      hint: 'Continuously refreshes row and status datasets using the selected interval. This helps operators detect drift quickly without repeatedly clicking refresh.'
    },
    {
      key: 'retentionDays',
      label: 'Audit Retention (days)',
      kind: 'number',
      min: 1,
      max: 365,
      advanced: true,
      hint: 'Retains metadata history for this feature area to support compliance and troubleshooting workflows. Match this value to organizational policy so runbooks and stored data remain consistent.'
    },
    {
      key: 'defaultPriority',
      label: 'Default Priority',
      kind: 'number',
      min: 1,
      max: 1000,
      advanced: true,
      hint: 'Baseline priority assigned to newly created records before manual tuning. Use conservative defaults to avoid unexpected precedence over long-standing entries.'
    },
    {
      key: 'maintenanceWindow',
      label: 'Preferred Maintenance Window',
      kind: 'text',
      advanced: true,
      placeholder: 'Sun 02:00-04:00',
      hint: 'Operational hint describing when bulk edits should be applied. This text is advisory for operators and helps coordinate expected service-impact periods.'
    },
    {
      key: 'operatorContact',
      label: 'Primary Operator Contact',
      kind: 'text',
      advanced: true,
      placeholder: 'noc@example.org',
      hint: 'Contact destination for escalations specific to this page domain. Keeping this current improves incident routing and reduces time-to-ownership.'
    },
    {
      key: 'changeTicketPrefix',
      label: 'Change Ticket Prefix',
      kind: 'text',
      advanced: true,
      placeholder: 'NET-CHG',
      hint: 'Optional prefix used when linking edits to formal change records. Standardized prefixes make external reporting and audit exports easier to correlate.'
    }
  ];

  const rowFields: Field[] = [
    {
      key: 'enabled',
      label: 'Enabled',
      kind: 'boolean',
      required: true,
      hint: 'Controls whether this record participates in runtime processing. Keeping drafts disabled until validation passes helps reduce accidental traffic impact.'
    },
    {
      key: 'name',
      label: 'Record Name',
      kind: 'text',
      required: true,
      placeholder: 'edge-policy-primary',
      hint: 'Human-readable identifier used by filters, automation jobs, and audits. Choose stable names that describe intent rather than temporary incident context.'
    },
    {
      key: 'scope',
      label: 'Scope',
      kind: 'select',
      required: true,
      options: [
        {
          value: 'global',
          label: 'Global'
        },
        {
          value: 'interface',
          label: 'Per Interface'
        },
        {
          value: 'pool',
          label: 'Per Pool'
        },
        {
          value: 'reservation',
          label: 'Per Reservation'
        }
      ],
      hint: 'Target context where this record applies at runtime. Narrower scope generally lowers risk and simplifies troubleshooting when outcomes are unexpected.'
    },
    {
      key: 'type',
      label: 'Value Type',
      kind: 'select',
      required: true,
      options: [
        {
          value: 'text',
          label: 'Text'
        },
        {
          value: 'ip',
          label: 'IP Address'
        },
        {
          value: 'cidr',
          label: 'CIDR'
        },
        {
          value: 'hex',
          label: 'Hex Bytes'
        },
        {
          value: 'number',
          label: 'Numeric'
        }
      ],
      hint: 'Controls how entered values are validated and transmitted. Match type to consumer expectation to avoid silent parse differences in downstream systems.'
    },
    {
      key: 'value',
      label: 'Value',
      kind: 'text',
      required: true,
      placeholder: '10.0.20.5',
      hint: 'Primary payload used by the managed runtime object. Keep formatting consistent with selected value type for deterministic behavior across deployments.'
    },
    {
      key: 'fallbackValue',
      label: 'Fallback Value',
      kind: 'text',
      advanced: true,
      placeholder: '10.0.20.6',
      hint: 'Secondary payload selected when primary data is unavailable or invalid. Well-planned fallback values reduce hard failures during dependency outages.'
    },
    {
      key: 'priority',
      label: 'Priority',
      kind: 'number',
      required: true,
      min: 1,
      max: 1000,
      hint: 'Lower numbers are processed first, allowing deterministic ordering. Reserve critical baseline records for the highest precedence to keep behavior predictable.'
    },
    {
      key: 'ttlSeconds',
      label: 'TTL / Lifetime (seconds)',
      kind: 'number',
      min: 0,
      max: 86400,
      hint: 'Controls lifetime and cache behavior where supported by consumers. Short values speed propagation while longer values reduce update churn.'
    },
    {
      key: 'matchInterface',
      label: 'Match Interface',
      kind: 'text',
      advanced: true,
      placeholder: 'lan',
      hint: 'Optional interface qualifier for more granular runtime matching. Use this in segmented networks where shared names appear across different trust zones.'
    },
    {
      key: 'matchTag',
      label: 'Match Tag',
      kind: 'text',
      advanced: true,
      placeholder: 'voice-clients',
      hint: 'Attach this record to a policy tag used by external automation. Consistent tagging enables safer bulk operations and clearer group ownership.'
    },
    {
      key: 'owner',
      label: 'Owner Team',
      kind: 'text',
      placeholder: 'netops',
      hint: 'Team responsible for reviewing and maintaining this record. Accurate ownership reduces triage delay when alerts or regressions are detected.'
    },
    {
      key: 'changeTicket',
      label: 'Change Ticket',
      kind: 'text',
      advanced: true,
      placeholder: 'NET-CHG-1042',
      hint: 'Links this record to formal change management tracking. Include a valid identifier so compliance and postmortem activities can follow intent history.'
    },
    {
      key: 'lastValidatedAt',
      label: 'Last Validation Timestamp',
      kind: 'text',
      advanced: true,
      placeholder: '2026-03-03T10:30:00Z',
      hint: 'Operator-maintained timestamp showing when this record was last reviewed. Regular validation timestamps help prevent stale data drift in long-lived environments.'
    },
    {
      key: 'notes',
      label: 'Operational Notes',
      kind: 'textarea',
      advanced: true,
      hint: 'Capture important rollout details, known caveats, and rollback hints for this record. Good notes improve continuity for responders who were not part of the original change.'
    }
  ];

  const secondaryTables = [
  {
    "endpoint": "/routing/table",
    "title": "Kernel Table",
    "description": "Live forwarding entries from the active kernel routing table.",
    "columns": [
      "destination",
      "gateway",
      "flags",
      "metric",
      "interface",
      "protocol"
    ]
  }
];

  const settingsEndpoint = '/routing/table/settings';
  const rowsEndpoint = '/routing/static';

  let rows = $state<Record<string, unknown>[]>([]);
  let settings = $state<Record<string, unknown>>({});
  let draft = $state<Record<string, unknown>>({});
  let secondaryData = $state<Record<string, Record<string, unknown>[]>>({});

  let editingId = $state<string | null>(null);
  let loading = $state(true);
  let loadingRows = $state(true);
  let saving = $state(false);

  let showSettingsAdvanced = $state(false);
  let showRecordAdvanced = $state(false);

  let search = $state('');
  let statusFilter = $state('all');
  let sortKey = $state<SortKey>('updatedAt');
  let sortDirection = $state<'asc' | 'desc'>('desc');

  let lastRefreshAt = $state('');
  let lastError = $state('');
  let timer: ReturnType<typeof setInterval> | null = null;

  function getDefaultValue(field: Field): unknown {
    if (field.kind === 'boolean') {
      return false;
    }

    if (field.kind === 'number') {
      if (typeof field.min === 'number') {
        return field.min;
      }

      return 0;
    }

    if (field.kind === 'select') {
      return field.options?.[0]?.value ?? '';
    }

    return '';
  }

  function buildDefaults(fields: Field[]): Record<string, unknown> {
    const model: Record<string, unknown> = {};

    for (const field of fields) {
      model[field.key] = getDefaultValue(field);
    }

    return model;
  }

  function normalizeRecord(raw: unknown, fields: Field[]): Record<string, unknown> {
    const row = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const out: Record<string, unknown> = {
      ...buildDefaults(fields)
    };

    for (const field of fields) {
      const value = row[field.key];

      if (field.kind === 'boolean') {
        out[field.key] = Boolean(value);
      } else if (field.kind === 'number') {
        out[field.key] = Number(value ?? getDefaultValue(field));
      } else {
        out[field.key] = String(value ?? getDefaultValue(field));
      }
    }

    out.id = String(row.id ?? row.uuid ?? row.key ?? crypto.randomUUID());
    out.updatedAt = String(row.updatedAt ?? row.updated_at ?? '');

    return out;
  }

  function resetDraft(): void {
    draft = buildDefaults(rowFields);
    editingId = null;
  }

  function validationText(value: unknown): string {
    return String(value ?? '').trim();
  }

  function validateSettingsModel(model: Record<string, unknown>): Record<string, string> {
    const errors: Record<string, string> = {};

    const refreshSeconds = Number(model.refreshSeconds ?? 0);
    if (!Number.isFinite(refreshSeconds) || refreshSeconds < 5 || refreshSeconds > 900) {
      errors.refreshSeconds = 'Refresh interval must be between 5 and 900 seconds.';
    }

    const maxPayloadSize = Number(model.maxPayloadSize ?? 0);
    if (!Number.isFinite(maxPayloadSize) || maxPayloadSize < 64 || maxPayloadSize > 65535) {
      errors.maxPayloadSize = 'Maximum payload size must be between 64 and 65535 bytes.';
    }

    const defaultPriority = Number(model.defaultPriority ?? 0);
    if (!Number.isFinite(defaultPriority) || defaultPriority < 1 || defaultPriority > 1000) {
      errors.defaultPriority = 'Default priority must be between 1 and 1000.';
    }

    const retentionDays = Number(model.retentionDays ?? 0);
    if (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays > 365) {
      errors.retentionDays = 'Retention must be between 1 and 365 days.';
    }

    if (Boolean(model.requireDescription) && validationText(model.maintenanceWindow).length === 0) {
      errors.maintenanceWindow = 'Provide a maintenance window when mandatory change descriptions are enabled.';
    }

    return errors;
  }

  function validateDraftModel(model: Record<string, unknown>): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const field of rowFields) {
      if (!field.required) {
        continue;
      }

      const value = model[field.key];

      if (field.kind === 'number') {
        const numeric = Number(value ?? 0);
        if (!Number.isFinite(numeric)) {
          errors[field.key] = `${field.label} must be a valid number.`;
          continue;
        }

        if (typeof field.min === 'number' && numeric < field.min) {
          errors[field.key] = `${field.label} must be at least ${field.min}.`;
          continue;
        }

        if (typeof field.max === 'number' && numeric > field.max) {
          errors[field.key] = `${field.label} must be at most ${field.max}.`;
          continue;
        }
      } else if (field.kind === 'boolean') {
        continue;
      } else if (validationText(value).length === 0) {
        errors[field.key] = `${field.label} is required.`;
      }
    }

    return errors;
  }

  const settingsErrors = $derived.by(() => {
    return validateSettingsModel(settings);
  });

  const draftErrors = $derived.by(() => {
    return validateDraftModel(draft);
  });

  const settingErrorList = $derived.by(() => {
    return Object.values(settingsErrors);
  });

  const draftErrorList = $derived.by(() => {
    return Object.values(draftErrors);
  });

  const canSaveSettings = $derived.by(() => {
    return settingErrorList.length === 0 && !saving;
  });

  const canSaveRow = $derived.by(() => {
    return draftErrorList.length === 0 && !saving;
  });

  async function loadSettings(): Promise<void> {
    try {
      const payload = await api.get<Record<string, unknown>>(settingsEndpoint);
      const normalized = normalizeRecord(payload, settingsFields);

      for (const field of settingsFields) {
        settings[field.key] = normalized[field.key];
      }
    } catch {
      for (const field of settingsFields) {
        settings[field.key] = getDefaultValue(field);
      }
      toasts.error($_('routing_table.toastfailed_to_load_settings'));
    }
  }

  async function loadRows(): Promise<void> {
    loadingRows = true;

    try {
      const payload = await api.get<unknown[]>(rowsEndpoint);

      rows = Array.isArray(payload)
        ? payload.map((entry) => normalizeRecord(entry, rowFields))
        : [];
    } catch {
      rows = [];
      toasts.error($_('routing_table.toastfailed_to_load_rows'));
    } finally {
      loadingRows = false;
    }
  }

  async function loadSecondary(): Promise<void> {
    const next: Record<string, Record<string, unknown>[]> = {};

    for (const section of secondaryTables) {
      try {
        const payload = await api.get<unknown[]>(section.endpoint);
        next[section.endpoint] = Array.isArray(payload)
          ? payload.map((entry) =>
              typeof entry === 'object' && entry !== null
                ? (entry as Record<string, unknown>)
                : {}
            )
          : [];
      } catch {
        next[section.endpoint] = [];
      }
    }

    secondaryData = next;
  }

  async function loadAll(): Promise<void> {
    loading = true;
    lastError = '';

    try {
      await Promise.all([
        loadSettings(),
        loadRows(),
        loadSecondary()
      ]);
      lastRefreshAt = new Date().toISOString();
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Failed to load data';
    } finally {
      loading = false;
    }
  }

  async function saveSettings(): Promise<void> {
    if (!canSaveSettings) {
      toasts.error($_('routing_table.toastresolve_settings_validation_errors_before_sav'));
      return;
    }

    saving = true;

    try {
      const payload: Record<string, unknown> = {};

      for (const field of settingsFields) {
        payload[field.key] = settings[field.key];
      }

      await api.put(settingsEndpoint, payload);
      toasts.success($_('routing_table.toastsettings_saved'));
      await loadAll();
    } catch {
      toasts.error($_('routing_table.toastfailed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  async function saveRow(): Promise<void> {
    if (!canSaveRow) {
      toasts.error($_('routing_table.toastresolve_row_validation_errors_before_saving'));
      return;
    }

    saving = true;

    try {
      const payload: Record<string, unknown> = {};

      for (const field of rowFields) {
        const val = draft[field.key]; if (field.nullable && (val === '' || val === undefined)) { payload[field.key] = null; } else if (field.kind === 'number') { payload[field.key] = val === '' ? 0 : Number(val); } else { payload[field.key] = val; }
      }

      if (editingId) {
        await api.put(`${rowsEndpoint}/${editingId}`, payload);
      } else {
        await api.post(rowsEndpoint, payload);
      }

      toasts.success(editingId ? 'static route updated' : 'static route added');
      resetDraft();
      await Promise.all([loadRows(), loadSecondary()]);
    } catch {
      toasts.error($_('routing_table.toastfailed_to_save_row'));
    } finally {
      saving = false;
    }
  }

  function editRow(row: Record<string, unknown>): void {
    draft = { ...row };
    editingId = String(row.id ?? '');
  }

  function cancelEdit(): void {
    resetDraft();
  }

  async function deleteRow(id: string): Promise<void> {
    saving = true;

    try {
      await api.del(`${rowsEndpoint}/${id}`);
      toasts.success($_('routing_table.toaststatic_route_deleted'));
      await Promise.all([loadRows(), loadSecondary()]);
    } catch {
      toasts.error($_('routing_table.toastfailed_to_delete_row'));
    } finally {
      saving = false;
    }
  }

  function valueText(value: unknown): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return String(value);
  }

  function matchesStatus(row: Record<string, unknown>): boolean {
    if (statusFilter === 'all') {
      return true;
    }

    const enabled = Boolean(row.enabled);
    return statusFilter === 'enabled' ? enabled : !enabled;
  }

  function rowSearchText(row: Record<string, unknown>): string {
    return Object.values(row)
      .map((value) => valueText(value).toLowerCase())
      .join(' ');
  }

  function compareRows(
    left: Record<string, unknown>,
    right: Record<string, unknown>
  ): number {
    const direction = sortDirection === 'asc' ? 1 : -1;

    if (sortKey === 'enabled') {
      return direction * (Number(Boolean(left.enabled)) - Number(Boolean(right.enabled)));
    }

    if (sortKey === 'priority') {
      const leftPriority = Number(left.priority ?? 0);
      const rightPriority = Number(right.priority ?? 0);
      return direction * (leftPriority - rightPriority);
    }

    const leftText = valueText(left[sortKey]).toLowerCase();
    const rightText = valueText(right[sortKey]).toLowerCase();

    if (leftText < rightText) {
      return -1 * direction;
    }

    if (leftText > rightText) {
      return 1 * direction;
    }

    return 0;
  }

  const filteredRows = $derived.by(() => {
    const needle = search.trim().toLowerCase();

    return rows.filter((row) => {
      return matchesStatus(row) &&
        (needle.length === 0 || rowSearchText(row).includes(needle));
    });
  });

  const sortedRows = $derived.by(() => {
    return [...filteredRows].sort(compareRows);
  });

  const rowCount = $derived.by(() => {
    return rows.length;
  });

  const enabledCount = $derived.by(() => {
    return rows.filter((row) => Boolean(row.enabled)).length;
  });

  const disabledCount = $derived.by(() => {
    return rowCount - enabledCount;
  });

  const advancedRowFieldCount = $derived.by(() => {
    return rowFields.filter((field) => Boolean(field.advanced)).length;
  });

  const basicRowFields = $derived.by(() => {
    return rowFields.filter((field) => !field.advanced);
  });

  const advancedRowFields = $derived.by(() => {
    return rowFields.filter((field) => Boolean(field.advanced));
  });

  const basicSettingsFields = $derived.by(() => {
    return settingsFields.filter((field) => !field.advanced);
  });

  const advancedSettingsFields = $derived.by(() => {
    return settingsFields.filter((field) => Boolean(field.advanced));
  });

  const tableColumns = $derived.by(() => {
    return [
      'name',
      'scope',
      'type',
      'value',
      'priority',
      'ttlSeconds',
      'owner',
      'updatedAt',
      'enabled'
    ];
  });

  onMount(() => {
    resetDraft();
    void loadAll();
  });

  $effect(() => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    if (Boolean(settings.autoRefresh) && Number(settings.refreshSeconds) > 0) {
      timer = setInterval(() => {
        void Promise.all([loadRows(), loadSecondary()]);
      }, Number(settings.refreshSeconds) * 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
      timer = null;
    };
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-925 to-slate-950 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('routing_table.kernel_routing_table_and_static_entries')}</CardTitle>
          <CardDescription class="text-slate-400">
            Operate static route records with policy metadata and deep filtering against runtime table state.
          </CardDescription>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            class="border-slate-700 text-slate-300 hover:bg-slate-800"
            onclick={() => void loadAll()}
            disabled={loading || saving}
          >
            <RefreshCw class="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button
            class="bg-cyan-600 text-white hover:bg-cyan-700"
            onclick={() => void saveSettings()}
            disabled={!canSaveSettings}
          >
            <Save class="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-5">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('routing_table.total_rows')}</p>
          <p class="text-lg font-semibold text-slate-100">{rowCount}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('routing_table.enabled')}</p>
          <p class="text-lg font-semibold text-emerald-300">{enabledCount}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('routing_table.disabled')}</p>
          <p class="text-lg font-semibold text-amber-300">{disabledCount}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('routing_table.last_refresh')}</p>
          <p class="truncate text-sm text-slate-200">{lastRefreshAt || 'Not yet'}</p>
        </div>
      </div>

      {#if loading}
        <div class="rounded-md border border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">
          Loading routing table...
        </div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each basicSettingsFields as field}
            <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <FieldLabel label={field.label} hint={field.hint} />

              {#if field.kind === 'boolean'}
                <div class="mt-2 flex items-center justify-between gap-3">
                  <span class="text-xs text-slate-400">
                    {Boolean(settings[field.key]) ? 'Enabled' : 'Disabled'}
                  </span>
                  <Switch
                    checked={Boolean(settings[field.key])}
                    onCheckedChange={(checked) => {
                      settings[field.key] = checked;
                    }}
                  />
                </div>
              {:else if field.kind === 'select'}
                <Select.Root
                  type="single"
                  value={String(settings[field.key] ?? '')}
                  onValueChange={(value) => {
                    if (value) {
                      settings[field.key] = value;
                    }
                  }}
                >
                  <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                    <span>
                      {field.options?.find((option) => option.value === String(settings[field.key]))?.label ?? 'Select value'}
                    </span>
                  </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each field.options ?? [] as option}
                      <Select.Item
                        value={option.value}
                        label={option.label}
                        class="cursor-pointer hover:bg-slate-800"
                      />
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else}
                <Input
                  class="mt-2 border-slate-700 bg-slate-950 text-slate-100"
                  type={field.kind === 'number' ? 'number' : 'text'}
                  placeholder={field.placeholder ?? ''}
                  value={String(settings[field.key] ?? '')}
                  oninput={(event) => {
                    const element = event.currentTarget as HTMLInputElement;
                    settings[field.key] = field.kind === 'number'
                      ? Number(element.value || 0)
                      : element.value;
                  }}
                />
              {/if}

              {#if settingsErrors[field.key]}
                <p class="mt-2 text-xs text-red-300">{settingsErrors[field.key]}</p>
              {/if}
            </div>
          {/each}
        </div>

        <Collapsible.Root bind:open={showSettingsAdvanced} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between">
            <span class="text-sm font-medium text-slate-200">
              Advanced settings ({advancedSettingsFields.length})
            </span>
            <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showSettingsAdvanced ? 'rotate-180' : ''}`} />
          </Collapsible.Trigger>
          <Collapsible.Content class="space-y-4 pt-4">
            <div class="grid gap-4 md:grid-cols-2">
              {#each advancedSettingsFields as field}
                <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                  <FieldLabel label={field.label} hint={field.hint} />
                  {#if field.kind === 'boolean'}
                    <div class="mt-2 flex items-center justify-between">
                      <span class="text-xs text-slate-400">{Boolean(settings[field.key]) ? 'Enabled' : 'Disabled'}</span>
                      <Switch checked={Boolean(settings[field.key])} onCheckedChange={(checked) => (settings[field.key] = checked)} />
                    </div>
                  {:else}
                    <Input
                      class="mt-2 border-slate-700 bg-slate-950 text-slate-100"
                      type={field.kind === 'number' ? 'number' : 'text'}
                      placeholder={field.placeholder ?? ''}
                      value={String(settings[field.key] ?? '')}
                      oninput={(event) => {
                        const element = event.currentTarget as HTMLInputElement;
                        settings[field.key] = field.kind === 'number' ? Number(element.value || 0) : element.value;
                      }}
                    />
                  {/if}
                  {#if settingsErrors[field.key]}
                    <p class="mt-2 text-xs text-red-300">{settingsErrors[field.key]}</p>
                  {/if}
                </div>
              {/each}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>

        {#if settingErrorList.length > 0}
          <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <div class="mb-2 flex items-center gap-2">
              <AlertTriangle class="h-4 w-4" />
              <span>{$_('routing_table.resolve_these_settings_validation_issues_before_sa')}</span>
            </div>
            <ul class="space-y-1 text-xs text-red-100">
              {#each settingErrorList as err}
                <li>{err}</li>
              {/each}
            </ul>
          </div>
        {:else}
          <div class="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <div class="flex items-center gap-2">
              <CheckCircle2 class="h-4 w-4" />
              Settings validation passed.
            </div>
          </div>
        {/if}
      {/if}

      {#if lastError}
        <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {lastError}
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('routing_table.static_routes')}</CardTitle>
      <CardDescription class="text-slate-400">
        Build, review, and edit records without modal jumps. Filtering and validation stay in view while you work.
      </CardDescription>
    </CardHeader>

    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <Input
          class="border-slate-700 bg-slate-950 text-slate-100"
          placeholder={$_('routing_table.placeholdersearch_rows_by_any_field')}
          value={search}
          oninput={(event) => {
            search = (event.currentTarget as HTMLInputElement).value;
          }}
        />

        <Select.Root
          type="single"
          value={statusFilter}
          onValueChange={(value) => {
            if (value) {
              statusFilter = value;
            }
          }}
        >
          <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100">
            <span>{statusFilterOptions.find((option) => option.value === statusFilter)?.label ?? 'Filter status'}</span>
          </Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            {#each statusFilterOptions as option}
              <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
            {/each}
          </Select.Content>
        </Select.Root>

        <Select.Root
          type="single"
          value={sortKey}
          onValueChange={(value) => {
            if (value) {
              sortKey = value as SortKey;
            }
          }}
        >
          <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100">
            <span>{sortKeyOptions.find((option) => option.value === sortKey)?.label ?? 'Sort rows'}</span>
          </Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            {#each sortKeyOptions as option}
              <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
            {/each}
          </Select.Content>
        </Select.Root>

        <Button
          variant="outline"
          class="border-slate-700 text-slate-300 hover:bg-slate-800"
          onclick={() => {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          }}
        >
          Direction: {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        {#each basicRowFields as field}
          <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
            <FieldLabel label={field.label} hint={field.hint} />

            {#if field.kind === 'boolean'}
              <div class="mt-2 flex items-center justify-between gap-3">
                <span class="text-xs text-slate-400">{Boolean(draft[field.key]) ? 'Enabled' : 'Disabled'}</span>
                <Switch checked={Boolean(draft[field.key])} onCheckedChange={(checked) => (draft[field.key] = checked)} />
              </div>
            {:else if field.kind === 'select'}
              <Select.Root
                type="single"
                value={String(draft[field.key] ?? '')}
                onValueChange={(value) => {
                  if (value) {
                    draft[field.key] = value;
                  }
                }}
              >
                <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{field.options?.find((option) => option.value === String(draft[field.key]))?.label ?? 'Select value'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each field.options ?? [] as option}
                    <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else if field.kind === 'textarea'}
              <Textarea
                class="mt-2 min-h-24 border-slate-700 bg-slate-950 text-slate-100"
                value={String(draft[field.key] ?? '')}
                oninput={(event) => {
                  draft[field.key] = (event.currentTarget as HTMLTextAreaElement).value;
                }}
              />
            {:else}
              <Input
                class="mt-2 border-slate-700 bg-slate-950 text-slate-100"
                type={field.kind === 'number' ? 'number' : 'text'}
                placeholder={field.placeholder ?? ''}
                value={String(draft[field.key] ?? '')}
                oninput={(event) => {
                  const element = event.currentTarget as HTMLInputElement;
                  draft[field.key] = field.kind === 'number'
                    ? Number(element.value || 0)
                    : element.value;
                }}
              />
            {/if}

            {#if draftErrors[field.key]}
              <p class="mt-2 text-xs text-red-300">{draftErrors[field.key]}</p>
            {/if}
          </div>
        {/each}
      </div>

      <Collapsible.Root bind:open={showRecordAdvanced} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
        <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
          <span class="text-sm font-medium text-slate-200">Advanced record fields ({advancedRowFieldCount})</span>
          <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showRecordAdvanced ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>

        <Collapsible.Content class="pt-3">
          <div class="grid gap-4 md:grid-cols-2">
            {#each advancedRowFields as field}
              <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                <FieldLabel label={field.label} hint={field.hint} />

                {#if field.kind === 'textarea'}
                  <Textarea
                    class="mt-2 min-h-24 border-slate-700 bg-slate-950 text-slate-100"
                    value={String(draft[field.key] ?? '')}
                    oninput={(event) => {
                      draft[field.key] = (event.currentTarget as HTMLTextAreaElement).value;
                    }}
                  />
                {:else if field.kind === 'select'}
                  <Select.Root
                    type="single"
                    value={String(draft[field.key] ?? '')}
                    onValueChange={(value) => {
                      if (value) {
                        draft[field.key] = value;
                      }
                    }}
                  >
                    <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                      <span>{field.options?.find((option) => option.value === String(draft[field.key]))?.label ?? 'Select value'}</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                      {#each field.options ?? [] as option}
                        <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                {:else if field.kind === 'boolean'}
                  <div class="mt-2 flex items-center justify-between gap-3">
                    <span class="text-xs text-slate-400">{Boolean(draft[field.key]) ? 'Enabled' : 'Disabled'}</span>
                    <Switch checked={Boolean(draft[field.key])} onCheckedChange={(checked) => (draft[field.key] = checked)} />
                  </div>
                {:else}
                  <Input
                    class="mt-2 border-slate-700 bg-slate-950 text-slate-100"
                    type={field.kind === 'number' ? 'number' : 'text'}
                    placeholder={field.placeholder ?? ''}
                    value={String(draft[field.key] ?? '')}
                    oninput={(event) => {
                      const element = event.currentTarget as HTMLInputElement;
                      draft[field.key] = field.kind === 'number' ? Number(element.value || 0) : element.value;
                    }}
                  />
                {/if}

                {#if draftErrors[field.key]}
                  <p class="mt-2 text-xs text-red-300">{draftErrors[field.key]}</p>
                {/if}
              </div>
            {/each}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      {#if draftErrorList.length > 0}
        <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          <div class="mb-2 flex items-center gap-2">
            <AlertTriangle class="h-4 w-4" />
            Resolve these row validation issues before saving:
          </div>
          <ul class="space-y-1 text-xs text-red-100">
            {#each draftErrorList as err}
              <li>{err}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="flex flex-wrap items-center gap-2">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveRow()} disabled={!canSaveRow}>
          <Plus class="mr-2 h-4 w-4" />
          {editingId ? 'Update Row' : 'Add Row'}
        </Button>

        <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={cancelEdit}>
          Cancel Edit
        </Button>

        <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadRows()}>
          <RefreshCw class="mr-2 h-4 w-4" />
          Refresh Rows
        </Button>
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {#each tableColumns as column}
                <th class="px-3 py-2 text-left">{column}</th>
              {/each}
              <th class="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if loadingRows}
              <tr>
                <td class="px-3 py-6 text-center text-slate-400" colspan={tableColumns.length + 1}>
                  Loading rows...
                </td>
              </tr>
            {:else if sortedRows.length === 0}
              <tr>
                <td class="px-3 py-6 text-center text-slate-500" colspan={tableColumns.length + 1}>
                  No rows match the current filter.
                </td>
              </tr>
            {:else}
              {#each sortedRows as row}
                <tr class="border-t border-slate-800/80 text-slate-200">
                  {#each tableColumns as column}
                    <td class="px-3 py-2 align-top text-xs">
                      {#if column === 'enabled'}
                        <span class={Boolean(row.enabled) ? 'text-emerald-300' : 'text-amber-300'}>
                          {Boolean(row.enabled) ? 'Enabled' : 'Disabled'}
                        </span>
                      {:else}
                        {valueText(row[column])}
                      {/if}
                    </td>
                  {/each}
                  <td class="px-3 py-2">
                    <div class="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        class="border-slate-700 text-slate-300 hover:bg-slate-800"
                        onclick={() => editRow(row)}
                      >
                        <Pencil class="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        class="border-red-500/50 text-red-300 hover:bg-red-950/40"
                        onclick={() => void deleteRow(String(row.id ?? ''))}
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>

  {#each secondaryTables as section}
    <Card class="border-slate-800 bg-slate-900/70">
      <CardHeader>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle class="text-slate-100">{section.title}</CardTitle>
            <CardDescription class="text-slate-400">{section.description}</CardDescription>
          </div>

          <Button
            variant="outline"
            class="border-slate-700 text-slate-300 hover:bg-slate-800"
            onclick={() => void loadSecondary()}
          >
            <RefreshCw class="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {#each section.columns as column}
                  <th class="px-3 py-2 text-left">{column}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr>
                  <td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>
                    No routes found.
                  </td>
                </tr>
              {:else}
                {#each secondaryData[section.endpoint] ?? [] as row}
                  <tr class="border-t border-slate-800/80 text-slate-200">
                    {#each section.columns as column}
                      <td class="px-3 py-2 text-xs">{valueText(row[column])}</td>
                    {/each}
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  {/each}
</div>
