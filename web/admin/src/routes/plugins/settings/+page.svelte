<!-- Route view for `/plugins/settings` in the ezNGFW admin GUI. -->

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
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';
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
        { value: 'global', label: 'Global' },
        { value: 'interface', label: 'Per Interface' },
        { value: 'pool', label: 'Per Pool' },
        { value: 'reservation', label: 'Per Reservation' }
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
        { value: 'reject', label: 'Reject duplicates' },
        { value: 'override', label: 'Newest wins' },
        { value: 'merge', label: 'Merge by scope' }
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
      key: 'maintenanceMode',
      label: 'Maintenance Mode',
      kind: 'boolean',
      advanced: true,
      hint: 'Signals that edits are being staged during a maintenance window. While active, the page can show more cautionary messaging before destructive operations.'
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

  const columns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'scope', label: 'Scope' },
    { key: 'type', label: 'Type' },
    { key: 'value', label: 'Value' },
    { key: 'priority', label: 'Priority' },
    { key: 'ttlSeconds', label: 'TTL' },
    { key: 'owner', label: 'Owner' },
    { key: 'updatedAt', label: 'Updated' },
    { key: 'enabled', label: 'Status' }
  ];

  const fields: FormField[] = [
    {
      key: 'enabled',
      label: 'Enabled',
      type: 'boolean',
      required: true,
      hint: 'Controls whether this record participates in runtime processing. Keeping drafts disabled until validation passes helps reduce accidental traffic impact.'
    },
    {
      key: 'name',
      label: 'Record Name',
      type: 'text',
      required: true,
      placeholder: 'edge-policy-primary',
      hint: 'Human-readable identifier used by filters, automation jobs, and audits. Choose stable names that describe intent rather than temporary incident context.'
    },
    {
      key: 'scope',
      label: 'Scope',
      type: 'select',
      required: true,
      options: [
        { value: 'global', label: 'Global' },
        { value: 'interface', label: 'Per Interface' },
        { value: 'pool', label: 'Per Pool' },
        { value: 'reservation', label: 'Per Reservation' }
      ],
      hint: 'Target context where this record applies at runtime. Narrower scope generally lowers risk and simplifies troubleshooting when outcomes are unexpected.'
    },
    {
      key: 'type',
      label: 'Value Type',
      type: 'select',
      required: true,
      options: [
        { value: 'text', label: 'Text' },
        { value: 'ip', label: 'IP Address' },
        { value: 'cidr', label: 'CIDR' },
        { value: 'hex', label: 'Hex Bytes' },
        { value: 'number', label: 'Numeric' }
      ],
      hint: 'Controls how entered values are validated and transmitted. Match type to consumer expectation to avoid silent parse differences in downstream systems.'
    },
    {
      key: 'value',
      label: 'Value',
      type: 'text',
      required: true,
      placeholder: '10.0.20.5',
      hint: 'Primary payload used by the managed runtime object. Keep formatting consistent with selected value type for deterministic behavior across deployments.'
    },
    {
      key: 'fallbackValue',
      label: 'Fallback Value',
      type: 'text',
      placeholder: '10.0.20.6',
      hint: 'Secondary payload selected when primary data is unavailable or invalid. Well-planned fallback values reduce hard failures during dependency outages.'
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'number',
      required: true,
      min: 1,
      max: 1000,
      hint: 'Lower numbers are processed first, allowing deterministic ordering. Reserve critical baseline records for the highest precedence to keep behavior predictable.'
    },
    {
      key: 'ttlSeconds',
      label: 'TTL / Lifetime (seconds)',
      type: 'number',
      min: 0,
      max: 86400,
      hint: 'Controls lifetime and cache behavior where supported by consumers. Short values speed propagation while longer values reduce update churn.'
    },
    {
      key: 'matchInterface',
      label: 'Match Interface',
      type: 'text',
      placeholder: 'lan',
      hint: 'Optional interface qualifier for more granular runtime matching. Use this in segmented networks where shared names appear across different trust zones.'
    },
    {
      key: 'matchTag',
      label: 'Match Tag',
      type: 'text',
      placeholder: 'voice-clients',
      hint: 'Attach this record to a policy tag used by external automation. Consistent tagging enables safer bulk operations and clearer group ownership.'
    },
    {
      key: 'owner',
      label: 'Owner Team',
      type: 'text',
      placeholder: 'netops',
      hint: 'Team responsible for reviewing and maintaining this record. Accurate ownership reduces triage delay when alerts or regressions are detected.'
    },
    {
      key: 'changeTicket',
      label: 'Change Ticket',
      type: 'text',
      placeholder: 'NET-CHG-1042',
      hint: 'Links this record to formal change management tracking. Include a valid identifier so compliance and postmortem activities can follow intent history.'
    },
    {
      key: 'lastValidatedAt',
      label: 'Last Validation Timestamp',
      type: 'text',
      placeholder: '2026-03-03T10:30:00Z',
      hint: 'Operator-maintained timestamp showing when this record was last reviewed. Regular validation timestamps help prevent stale data drift in long-lived environments.'
    },
    {
      key: 'notes',
      label: 'Operational Notes',
      type: 'textarea',
      hint: 'Capture important rollout details, known caveats, and rollback hints for this record. Good notes improve continuity for responders who were not part of the original change.'
    }
  ];

  const secondaryTables = [
    {
      "endpoint": "/plugins/installed",
      "title": "Installed Plugins",
      "description": "Track plugin package versions currently active on this node for drift analysis before updates.",
      "columns": [
        "name",
        "version",
        "repository",
        "status"
      ]
    }
  ];

  const settingsEndpoint = '/plugins/settings';
  const rowsEndpoint = '/plugins/repositories';

  let rows = $state<Record<string, any>[]>([]);
  let settings = $state<Record<string, any>>({});
  let secondaryData = $state<Record<string, Record<string, any>[]>>({});

  let loading = $state(true);
  let saving = $state(false);
  let showSettingsAdvanced = $state(false);

  let lastRefreshAt = $state('');
  let timer: ReturnType<typeof setInterval> | null = null;

  function getDefaultValue(field: Field): any {
    if (field.kind === 'boolean') return false;
    if (field.kind === 'number') return typeof field.min === 'number' ? field.min : 0;
    if (field.kind === 'select') return field.options?.[0]?.value ?? '';
    return '';
  }

  function buildDefaults(fields: Field[]): Record<string, any> {
    const model: Record<string, any> = {};
    for (const field of fields) model[field.key] = getDefaultValue(field);
    return model;
  }

  function normalizeRecord(raw: unknown, fields: Field[]): Record<string, any> {
    const row = typeof raw === 'object' && raw !== null ? (raw as Record<string, any>) : {};
    const out: Record<string, any> = { ...buildDefaults(fields) };
    for (const field of fields) {
      const value = row[field.key];
      if (field.kind === 'boolean') out[field.key] = Boolean(value);
      else if (field.kind === 'number') out[field.key] = Number(value ?? getDefaultValue(field));
      else out[field.key] = String(value ?? getDefaultValue(field));
    }
    out.id = String(row.id ?? row.uuid ?? row.key ?? crypto.randomUUID());
    out.updatedAt = String(row.updatedAt ?? row.updated_at ?? '');
    return out;
  }

  function validateSettingsModel(model: Record<string, any>): Record<string, string> {
    const errors: Record<string, string> = {};
    const refreshSeconds = Number(model.refreshSeconds ?? 0);
    if (!Number.isFinite(refreshSeconds) || refreshSeconds < 5 || refreshSeconds > 900) errors.refreshSeconds = 'Refresh interval must be between 5 and 900 seconds.';
    const maxPayloadSize = Number(model.maxPayloadSize ?? 0);
    if (!Number.isFinite(maxPayloadSize) || maxPayloadSize < 64 || maxPayloadSize > 65535) errors.maxPayloadSize = 'Maximum payload size must be between 64 and 65535 bytes.';
    const defaultPriority = Number(model.defaultPriority ?? 0);
    if (!Number.isFinite(defaultPriority) || defaultPriority < 1 || defaultPriority > 1000) errors.defaultPriority = 'Default priority must be between 1 and 1000.';
    const retentionDays = Number(model.retentionDays ?? 0);
    if (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays > 365) errors.retentionDays = 'Retention must be between 1 and 365 days.';
    return errors;
  }

  const settingsErrors = $derived(validateSettingsModel(settings));
  const canSaveSettings = $derived(Object.keys(settingsErrors).length === 0 && !saving);

  async function loadSettings() {
    try {
      const payload = await api.get<Record<string, any>>(settingsEndpoint);
      const normalized = normalizeRecord(payload, settingsFields);
      for (const field of settingsFields) settings[field.key] = normalized[field.key];
    } catch {
      for (const field of settingsFields) settings[field.key] = getDefaultValue(field);
      toasts.error($_('plugins_settings.toastfailed_to_load_settings'));
    }
  }

  async function loadRows() {
    try {
      const payload = await api.get<unknown[]>(rowsEndpoint);
      rows = Array.isArray(payload) ? (payload as Record<string, any>[]) : [];
    } catch {
      rows = [];
    }
  }

  async function loadSecondary() {
    const next: Record<string, Record<string, any>[]> = {};
    for (const section of secondaryTables) {
      try {
        const payload = await api.get<unknown[]>(section.endpoint);
        next[section.endpoint] = Array.isArray(payload) ? payload.map((entry) => (typeof entry === 'object' && entry !== null ? (entry as Record<string, any>) : {})) : [];
      } catch {
        next[section.endpoint] = [];
      }
    }
    secondaryData = next;
  }

  async function loadAll() {
    loading = true;
    try {
      await Promise.all([loadSettings(), loadRows(), loadSecondary()]);
      lastRefreshAt = new Date().toISOString();
    } catch {
      toasts.error($_('plugins_settings.toastfailed_to_load_data'));
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    if (!canSaveSettings) return;
    saving = true;
    try {
      const payload: Record<string, any> = {};
      for (const field of settingsFields) payload[field.key] = settings[field.key];
      await api.put(settingsEndpoint, payload);
      toasts.success($_('plugins_settings.toastsettings_saved'));
      await loadAll();
    } catch {
      toasts.error($_('plugins_settings.toastfailed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    void loadAll();
  });

  $effect(() => {
    if (timer) clearInterval(timer);
    if (Boolean(settings.autoRefresh) && Number(settings.refreshSeconds) > 0) {
      timer = setInterval(() => {
        void Promise.all([loadRows(), loadSecondary()]);
      }, Number(settings.refreshSeconds) * 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-925 to-slate-950 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('plugins_settings.plugin_repository_settings')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('plugins_settings.harden_package_source_configuration_with_richer_tr')}</CardDescription>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadAll()} disabled={loading || saving}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveSettings()} disabled={!canSaveSettings}>
            <Save class="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-5">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('plugins_settings.total_rows')}</p>
          <p class="text-lg font-semibold text-slate-100">{rows.length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('plugins_settings.enabled')}</p>
          <p class="text-lg font-semibold text-emerald-300">{rows.filter(r => r.enabled).length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('plugins_settings.disabled')}</p>
          <p class="text-lg font-semibold text-amber-300">{rows.filter(r => !r.enabled).length}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs text-slate-400">{$_('plugins_settings.last_refresh')}</p>
          <p class="truncate text-sm text-slate-200">{lastRefreshAt || 'Not yet'}</p>
        </div>
      </div>

      {#if loading}
        <div class="rounded-md border border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">Loading plugin settings...</div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each settingsFields.filter(f => !f.advanced) as field}
            <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <FieldLabel label={field.label} hint={field.hint} />
              {#if field.kind === 'boolean'}
                <div class="mt-2 flex items-center justify-between gap-3">
                  <span class="text-xs text-slate-400">{Boolean(settings[field.key]) ? 'Enabled' : 'Disabled'}</span>
                  <Switch checked={Boolean(settings[field.key])} onCheckedChange={(checked) => { settings[field.key] = checked; }} />
                </div>
              {:else if field.kind === 'select'}
                <Select.Root type="single" value={String(settings[field.key] ?? '')} onValueChange={(value) => { if (value) settings[field.key] = value; }}>
                  <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                    <span>{field.options?.find((option) => option.value === String(settings[field.key]))?.label ?? 'Select value'}</span>
                  </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each field.options ?? [] as option}
                      <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else}
                <Input
                  class="mt-2 border-slate-700 bg-slate-950 text-slate-100"
                  type={field.kind === 'number' ? 'number' : 'text'}
                  placeholder={field.placeholder ?? ''}
                  value={String(settings[field.key] ?? '')}
                  oninput={(event) => { const element = event.currentTarget as HTMLInputElement; settings[field.key] = field.kind === 'number' ? Number(element.value || 0) : element.value; }}
                />
              {/if}
              {#if settingsErrors[field.key]}<p class="mt-2 text-xs text-red-300">{settingsErrors[field.key]}</p>{/if}
            </div>
          {/each}
        </div>

        <Collapsible.Root bind:open={showSettingsAdvanced} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between">
            <span class="text-sm font-medium text-slate-200">{$_('plugins_settings.advanced_settings')}</span>
            <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showSettingsAdvanced ? 'rotate-180' : ''}`} />
          </Collapsible.Trigger>
          <Collapsible.Content class="space-y-4 pt-4">
            <div class="grid gap-4 md:grid-cols-2">
              {#each settingsFields.filter(f => f.advanced) as field}
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
                      oninput={(event) => { const element = event.currentTarget as HTMLInputElement; settings[field.key] = field.kind === 'number' ? Number(element.value || 0) : element.value; }}
                    />
                  {/if}
                  {#if settingsErrors[field.key]}<p class="mt-2 text-xs text-red-300">{settingsErrors[field.key]}</p>{/if}
                </div>
              {/each}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>

        {#if Object.keys(settingsErrors).length > 0}
          <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <div class="mb-2 flex items-center gap-2"><AlertTriangle class="h-4 w-4" /><span>{$_('plugins_settings.resolve_settings_validation_issues_before_saving')}</span></div>
          </div>
        {:else}
          <div class="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <div class="flex items-center gap-2"><CheckCircle2 class="h-4 w-4" />Settings validation passed.</div>
          </div>
        {/if}
      {/if}
    </CardContent>
  </Card>

  <ResourceTable
    title={$_('plugins_settings.titleplugin_repositories')}
    description={$_('plugins_settings.descriptionbuild_review_and_edit_records_without_m')}
    endpoint={rowsEndpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('plugins_settings.addlabeladd_repository_entry')}
    
  />

  {#each secondaryTables as section}
    <Card class="border-slate-800 bg-slate-900/70">
      <CardHeader>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle class="text-slate-100">{section.title}</CardTitle>
            <CardDescription class="text-slate-400">{section.description}</CardDescription>
          </div>
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadSecondary()}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>{#each section.columns as column}<th class="px-3 py-2 text-left">{column}</th>{/each}</tr>
            </thead>
            <tbody>
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No plugin settings found.</td></tr>
              {:else}
                {#each secondaryData[section.endpoint] ?? [] as row}
                  <tr class="border-t border-slate-800/80 text-slate-200">
                    {#each section.columns as column}<td class="px-3 py-2 text-xs">{String(row[column] ?? '-')}</td>{/each}
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