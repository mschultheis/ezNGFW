<!-- Route view for `/interfaces` in the ezNGFW admin GUI. -->

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
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';

  import { _ } from '$lib/i18n';
  type Field = {
    key: string;
    label: string;
    kind: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
    required?: boolean;
    advanced?: boolean;
    nullable?: boolean;
    hint: string;
    options?: { value: string; label: string }[];
  };

  const settingsFields: Field[] = [
    {
        "key": "autoRefresh",
        "label": "Auto Refresh",
        "kind": "boolean",
        "hint": "Automatically refreshes backend data to keep this page aligned with runtime state. Continuous updates reduce stale observations during incident response and change windows. Disable when you need a stable snapshot for long-form analysis."
    },
    {
        "key": "refreshSeconds",
        "label": "Refresh Interval Seconds",
        "kind": "number",
        "hint": "Polling cadence used when auto refresh is active. Lower values improve responsiveness but increase API pressure and browser work. Start at 15 seconds and tune downward only for short troubleshooting bursts."
    },
    {
        "key": "strictValidation",
        "label": "Strict Validation",
        "kind": "boolean",
        "hint": "Enforces additional client-side validation before save requests are sent. This prevents malformed records from reaching backend endpoints during bulk edits. Keep enabled in production and relax only for exploratory staging workflows."
    },
    {
        "key": "defaultSort",
        "label": "Default Sort",
        "kind": "select",
        "hint": "Initial sort mode applied to inline records after load. Choosing a stable default helps operators compare state across refreshes without manual resorting. Switch to risk-based ordering when triaging urgent incidents.",
        "options": [
            {
                "value": "name",
                "label": "Name"
            },
            {
                "value": "priority",
                "label": "Priority"
            },
            {
                "value": "updated",
                "label": "Updated Time"
            }
        ]
    },
    {
        "key": "showDisabled",
        "label": "Show Disabled Rows",
        "kind": "boolean",
        "hint": "Keeps disabled records visible in day-to-day views for full context. Hidden disabled rows can cause drift because operators miss dormant policy fragments. Enable visibility unless the page becomes operationally noisy."
    },
    {
        "key": "alertThreshold",
        "label": "Alert Threshold",
        "kind": "number",
        "hint": "Threshold used for warning badges and operational highlights in this page. Tune this to match your team runbook so warning colors correspond to actionable conditions. Review after every major policy migration."
    },
    {
        "key": "operatorTag",
        "label": "Operator Tag",
        "kind": "text",
        "hint": "Optional text marker stored with settings changes for operational traceability. Teams can use shift codes or ticket IDs to connect UI edits to incident timelines. Keep the value short and consistent across NOC rotations."
    },
    {
        "key": "maintenanceMode",
        "label": "Maintenance Mode",
        "kind": "boolean",
        "hint": "Signals that edits are being staged during a maintenance window. While active, the page can show more cautionary messaging before destructive operations. Toggle off after completion so normal workflows remain streamlined."
    }
];

  const columns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'scope', label: 'Scope' },
    { key: 'target', label: 'Target' },
    { key: 'priority', label: 'Priority' },
    { key: 'category', label: 'Category' },
    { key: 'enabled', label: 'Status' },
    { key: 'owner', label: 'Owner' }
  ];

  const fields: FormField[] = [
    {
        key: 'name',
        label: 'Profile Name',
        type: 'text',
        required: true,
        hint: 'Human-readable identifier for this managed record. Choose a precise name that maps to service intent so operators can search quickly. Include scope cues like site, VLAN, or service tier when applicable.'
    },
    {
        key: 'enabled',
        label: 'Enabled',
        type: 'boolean',
        hint: 'Controls whether this profile actively participates in runtime behavior. Disabling keeps historical context without deleting carefully tuned values. Re-enable after verification when a temporary freeze ends.'
    },
    {
        key: 'priority',
        label: 'Priority',
        type: 'number',
        required: true,
        hint: 'Relative precedence used when multiple profiles overlap or conflict. Lower numbers should represent deterministic first-match behavior in most policy engines. Keep a documented gap strategy like 10, 20, 30 for easier insertions.'
    },
    {
        key: 'scope',
        label: 'Scope',
        type: 'select',
        required: true,
        hint: 'Scope narrows where this record applies inside the environment. Explicit scope reduces accidental global impact during emergency edits. Prefer focused scopes and escalate to global only when validated.',
        options: [
            { value: 'global', label: 'Global' },
            { value: 'site', label: 'Site' },
            { value: 'segment', label: 'Segment' },
            { value: 'host', label: 'Host' }
        ]
    },
    {
        key: 'target',
        label: 'Target',
        type: 'text',
        required: true,
        hint: 'Primary target entity for this profile such as network, host, user, or subsystem key. Keep formatting consistent with backend expectation to prevent partial-match surprises. Validate target uniqueness before large rollouts.'
    },
    {
        key: 'category',
        label: 'Category',
        type: 'select',
        hint: 'Category groups similar records for filtering and reporting. A stable category taxonomy allows quick pivots during outages and audits. Avoid one-off categories unless they represent long-lived operational classes.',
        options: [
            { value: 'critical', label: 'Critical' },
            { value: 'standard', label: 'Standard' },
            { value: 'experimental', label: 'Experimental' }
        ]
    },
    {
        key: 'maxRetries',
        label: 'Max Retries',
        type: 'number',
        hint: 'Maximum retry attempts before an action is considered failed for this profile. Too many retries can hide broken dependencies while too few can trigger false alarms. Align values with backend timeout and queue behavior.'
    },
    {
        key: 'timeoutMs',
        label: 'Timeout Milliseconds',
        type: 'number',
        hint: 'Operation timeout used by downstream checks and actions tied to this profile. Set enough headroom for normal jitter but keep ceilings tight to detect unhealthy components quickly. Review values when WAN or storage latency shifts.'
    },
    {
        key: 'burstLimit',
        label: 'Burst Limit',
        type: 'number',
        hint: 'Temporary burst allowance before steady-state limits apply. Burst controls help absorb short spikes without suppressing long-term fairness. Use conservative values in shared environments to prevent starvation.'
    },
    {
        key: 'windowSeconds',
        label: 'Window Seconds',
        type: 'number',
        hint: 'Observation window used for counters, thresholds, and rate evaluations. Longer windows smooth noise while shorter windows surface rapid anomalies. Match this setting to how quickly your team expects to react.'
    },
    {
        key: 'owner',
        label: 'Owner',
        type: 'text',
        hint: 'Primary operational owner for this record, typically team alias or role account. Ownership improves handoff quality and keeps escalations direct during incidents. Keep this field populated for all production profiles.'
    },
    {
        key: 'ticket',
        label: 'Change Ticket',
        type: 'text',
        hint: 'Reference to the change or incident ticket that introduced the profile. This creates fast traceability from runtime state back to approval context. Use immutable identifiers instead of free-form notes whenever possible.'
    },
    {
        key: 'tags',
        label: 'Tags',
        type: 'text',
        hint: 'Comma-separated tags for search, grouping, and policy slicing. Consistent tags reduce cognitive load when troubleshooting across many records. Keep tag taxonomy documented in your runbook.'
    },
    {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        hint: 'Extended operator notes describing intent, prerequisites, and rollback caveats. Write enough context so on-call engineers can safely act without opening external documentation. Update this text whenever behavior materially changes.'
    }
  ];

  const secondaryTables = [
    {
        "endpoint": "/interfaces",
        "title": "Interface Inventory",
        "description": "Configured interfaces and current state.",
        "columns": [
            "name",
            "device",
            "status",
            "ipv4",
            "ipv6",
            "mtu",
            "speed"
        ]
    },
    {
        "endpoint": "/interfaces/devices",
        "title": "Hardware Device Status",
        "description": "Physical NIC details and runtime counters.",
        "columns": [
            "name",
            "driver",
            "mac",
            "media",
            "status",
            "speed"
        ]
    }
];


  /** Format column header names for display. */
  function formatColumnHeader(col: string): string {
    const specialCases: Record<string, string> = {
      ipv4: 'IPv4', ipv6: 'IPv6', mtu: 'MTU', mac: 'MAC',
      dns: 'DNS', dhcp: 'DHCP', vlan: 'VLAN', id: 'ID', ip: 'IP',
      url: 'URL', cpu: 'CPU', ram: 'RAM', pid: 'PID', ttl: 'TTL',
    };
    if (specialCases[col]) return specialCases[col];
    return col.charAt(0).toUpperCase() + col.slice(1);
  }

  /** Format cell value for display, handling objects, arrays, booleans. */
  function formatCellValue(value: unknown, column: string): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      // Will be handled by badge rendering
      return String(value);
    }
    if (Array.isArray(value)) return value.join(', ') || '-';
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (obj.address) return String(obj.address) + (obj.prefix ? '/' + obj.prefix : '');
      if (obj.value) return String(obj.value);
      const jsonStr = JSON.stringify(value);
      return jsonStr === '{}' ? '-' : jsonStr;
    }
    return String(value);
  }

  /** Check if a value represents a boolean. */
  function isBooleanValue(value: unknown): boolean {
    return typeof value === 'boolean' || value === 'true' || value === 'false';
  }

  /** Get boolean from value. */
  function toBool(value: unknown): boolean {
    return value === true || value === 'true';
  }

  let rows = $state<Record<string, any>[]>([]);
  let settings = $state<Record<string, any>>({});
  let secondaryData = $state<Record<string, Record<string, any>[]>>({});
  let loading = $state(true);
  let saving = $state(false);
  let showAdvanced = $state(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  function getDefaultValue(field: Field) {
    if (field.kind === 'boolean') return false;
    if (field.kind === 'number') return 0;
    if (field.kind === 'select') return field.options?.[0]?.value ?? '';
    return '';
  }

  function buildDefaults(fields: Field[]) {
    const model: Record<string, any> = {};
    for (const field of fields) model[field.key] = getDefaultValue(field);
    return model;
  }

  function normalizeRecord(raw: unknown, fields: Field[]) {
    const row = typeof raw === 'object' && raw !== null ? (raw as Record<string, any>) : {};
    const out: Record<string, any> = { ...buildDefaults(fields) };
    for (const field of fields) {
      if (field.kind === 'boolean') out[field.key] = Boolean(row[field.key]);
      else if (field.kind === 'number') out[field.key] = Number(row[field.key] ?? 0);
      else out[field.key] = String(row[field.key] ?? '');
    }
    out.id = String(row.id ?? row.uuid ?? row.key ?? crypto.randomUUID());
    out.updated = String(row.updated ?? row.modified ?? row.lastSeen ?? '');
    return out;
  }

  async function loadSettings() {
    try {
      const payload = await api.get<Record<string, any>>('/interfaces/settings');
      const normalized = normalizeRecord(payload, settingsFields);
      for (const field of settingsFields) settings[field.key] = normalized[field.key];
    } catch {
      for (const field of settingsFields) settings[field.key] = getDefaultValue(field);
      toasts.error($_('interfaces.toast_failed_to_load_page_settings'));
    }
  }

  async function loadRows() {
    try {
      const payload = await api.get<unknown[]>('/interfaces');
      rows = Array.isArray(payload) ? payload.map((entry) => (typeof entry === 'object' && entry !== null ? (entry as Record<string, any>) : {})) : [];
    } catch {
      rows = [];
    }
  }

  async function loadSecondary() {
    const next: Record<string, Record<string, any>[]> = {};
    for (const section of secondaryTables) {
      try {
        const payload = await api.get<unknown[]>(section.endpoint);
        next[section.endpoint] = Array.isArray(payload)
          ? payload.map((entry) => (typeof entry === 'object' && entry !== null ? (entry as Record<string, any>) : {}))
          : [];
      } catch {
        next[section.endpoint] = [];
      }
    }
    secondaryData = next;
  }

  async function loadAll() {
    loading = true;
    await Promise.all([loadSettings(), loadRows(), loadSecondary()]);
    loading = false;
  }

  async function saveSettings() {
    saving = true;
    try {
      const payload: Record<string, any> = {};
      for (const field of settingsFields) payload[field.key] = settings[field.key];
      await api.put('/interfaces/settings', payload);
      toasts.success($_('interfaces.toast_settings_saved'));
    } catch {
      toasts.error($_('interfaces.toast_failed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  const activeCount = $derived(rows.filter((row) => Boolean(row.enabled)).length);
  const disabledCount = $derived(rows.filter((row) => !Boolean(row.enabled)).length);

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
    return () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
  });
</script>

<div class="space-y-6">
  <div class="grid gap-4 md:grid-cols-3">
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader class="pb-2"><CardTitle class="text-sm text-slate-200">{$_('interfaces.active_profiles')}</CardTitle></CardHeader>
      <CardContent><p class="text-2xl font-semibold text-cyan-400">{activeCount}</p></CardContent>
    </Card>
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader class="pb-2"><CardTitle class="text-sm text-slate-200">{$_('interfaces.disabled_profiles')}</CardTitle></CardHeader>
      <CardContent><p class="text-2xl font-semibold text-amber-300">{disabledCount}</p></CardContent>
    </Card>
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader class="pb-2"><CardTitle class="text-sm text-slate-200">{$_('interfaces.total_records')}</CardTitle></CardHeader>
      <CardContent><p class="text-2xl font-semibold text-slate-300">{rows.length}</p></CardContent>
    </Card>
  </div>

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('interfaces.interface_configuration_and_health')}</CardTitle>
          <CardDescription class="text-slate-400">Tune interface behavior, stage operational edits, and review live link characteristics.</CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadAll()} disabled={loading || saving}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={loading || saving}>
            <Save class="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      {#if loading}
        <div class="rounded-md border border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">Loading interface configuration...</div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {#each settingsFields.filter(f => !["autoRefresh","refreshSeconds","strictValidation","defaultSort","showDisabled","alertThreshold","operatorTag","maintenanceMode"].includes(f.key)) as field}
            <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <FieldLabel label={field.label} hint={field.hint} />
              {#if field.kind === 'boolean'}
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-xs text-slate-400">{settings[field.key] ? 'Enabled' : 'Disabled'}</span>
                  <Switch checked={Boolean(settings[field.key])} onCheckedChange={(checked) => (settings[field.key] = checked)} />
                </div>
              {:else if field.kind === 'select'}
                <Select.Root type="single" value={String(settings[field.key] ?? '')} onValueChange={(value) => value && (settings[field.key] = value)}>
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
                  value={String(settings[field.key] ?? '')}
                  oninput={(event) => (settings[field.key] = field.kind === 'number' ? Number((event.currentTarget as HTMLInputElement).value || 0) : (event.currentTarget as HTMLInputElement).value)}
                />
              {/if}
            </div>
          {/each}
        </div>

        <Collapsible.Root bind:open={showAdvanced} class="pt-1">
          <Collapsible.Trigger class="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
            <span class="font-medium text-slate-200">{$_('interfaces.advanced_operational_behavior')}</span>
            <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </Collapsible.Trigger>
          <Collapsible.Content class="space-y-3 pt-3">
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {#each settingsFields.filter(f => ["autoRefresh","refreshSeconds","strictValidation","defaultSort","showDisabled","alertThreshold","operatorTag","maintenanceMode"].includes(f.key)) as field}
                <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                  <FieldLabel label={field.label} hint={field.hint} />
                  {#if field.kind === 'boolean'}
                    <div class="mt-2 flex items-center justify-between">
                      <span class="text-xs text-slate-400">{settings[field.key] ? 'Enabled' : 'Disabled'}</span>
                      <Switch checked={Boolean(settings[field.key])} onCheckedChange={(checked) => (settings[field.key] = checked)} />
                    </div>
                  {:else if field.kind === 'select'}
                    <select class="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100" value={String(settings[field.key] ?? '')} onchange={(e) => (settings[field.key] = (e.currentTarget as HTMLSelectElement).value)}>
                      {#each field.options ?? [] as option}
                        <option value={option.value}>{option.label}</option>
                      {/each}
                    </select>
                  {:else}
                    <input
                      class="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                      type={field.kind === 'number' ? 'number' : 'text'}
                      value={String(settings[field.key] ?? '')}
                      oninput={(e) => (settings[field.key] = field.kind === 'number' ? Number((e.currentTarget as HTMLInputElement).value || 0) : (e.currentTarget as HTMLInputElement).value)}
                    />
                  {/if}
                </div>
              {/each}
            </div>
            <p class="text-sm leading-6 text-slate-300">{$_('interfaces.advanced_settings_tune_polling_cadence_strict_vali')}</p>
            <p class="text-sm leading-6 text-slate-300">{$_('interfaces.use_the_inline_crud_form_below_to_keep_change_cont')}</p>
          </Collapsible.Content>
        </Collapsible.Root>
      {/if}
    </CardContent>
  </Card>

  <ResourceTable
    title="{$_('interfaces.interface_profiles')}"
    description={$_('interfaces.descriptionconfigure_interface_settings_addressing')}
    endpoint="/interfaces"
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('interfaces.addlabeladd_profile')}
    
  />

  {#each secondaryTables as section}
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader>
        <CardTitle class="text-slate-100">{section.title}</CardTitle>
        <CardDescription class="text-slate-400">{section.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {#each section.columns as column}
                  <th class="px-3 py-2 text-left">{formatColumnHeader(column)}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No interfaces found.</td></tr>
              {:else}
                {#each secondaryData[section.endpoint] ?? [] as row}
                  <tr class="border-t border-slate-800/80 text-slate-200">
                    {#each section.columns as column}
                      {#if (column === 'status') && isBooleanValue(row[column])}
                      <td class="px-3 py-2 text-xs">
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {toBool(row[column]) ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-400'}">
                          {toBool(row[column]) ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                    {:else}
                      <td class="px-3 py-2 text-xs">{formatCellValue(row[column], column)}</td>
                    {/if}
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