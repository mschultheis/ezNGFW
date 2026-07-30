<!-- Route view for `/certificates/ca` in the ezNGFW admin GUI. -->

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

  const rowFields: Field[] = [
    {
        "key": "name",
        "label": "Profile Name",
        "kind": "text",
        "required": true,
        "hint": "Human-readable identifier for this managed record. Choose a precise name that maps to service intent so operators can search quickly. Include scope cues like site, VLAN, or service tier when applicable."
    },
    {
        "key": "enabled",
        "label": "Enabled",
        "kind": "boolean",
        "hint": "Controls whether this profile actively participates in runtime behavior. Disabling keeps historical context without deleting carefully tuned values. Re-enable after verification when a temporary freeze ends."
    },
    {
        "key": "priority",
        "label": "Priority",
        "kind": "number",
        "required": true,
        "hint": "Relative precedence used when multiple profiles overlap or conflict. Lower numbers should represent deterministic first-match behavior in most policy engines. Keep a documented gap strategy like 10, 20, 30 for easier insertions."
    },
    {
        "key": "scope",
        "label": "Scope",
        "kind": "select",
        "required": true,
        "hint": "Scope narrows where this record applies inside the environment. Explicit scope reduces accidental global impact during emergency edits. Prefer focused scopes and escalate to global only when validated.",
        "options": [
            {
                "value": "global",
                "label": "Global"
            },
            {
                "value": "site",
                "label": "Site"
            },
            {
                "value": "segment",
                "label": "Segment"
            },
            {
                "value": "host",
                "label": "Host"
            }
        ]
    },
    {
        "key": "target",
        "label": "Target",
        "kind": "text",
        "required": true,
        "hint": "Primary target entity for this profile such as network, host, user, or subsystem key. Keep formatting consistent with backend expectation to prevent partial-match surprises. Validate target uniqueness before large rollouts."
    },
    {
        "key": "category",
        "label": "Category",
        "kind": "select",
        "hint": "Category groups similar records for filtering and reporting. A stable category taxonomy allows quick pivots during outages and audits. Avoid one-off categories unless they represent long-lived operational classes.",
        "options": [
            {
                "value": "critical",
                "label": "Critical"
            },
            {
                "value": "standard",
                "label": "Standard"
            },
            {
                "value": "experimental",
                "label": "Experimental"
            }
        ]
    },
    {
        "key": "maxRetries",
        "label": "Max Retries",
        "kind": "number",
        "advanced": true,
        "hint": "Maximum retry attempts before an action is considered failed for this profile. Too many retries can hide broken dependencies while too few can trigger false alarms. Align values with backend timeout and queue behavior."
    },
    {
        "key": "timeoutMs",
        "label": "Timeout Milliseconds",
        "kind": "number",
        "advanced": true,
        "hint": "Operation timeout used by downstream checks and actions tied to this profile. Set enough headroom for normal jitter but keep ceilings tight to detect unhealthy components quickly. Review values when WAN or storage latency shifts."
    },
    {
        "key": "burstLimit",
        "label": "Burst Limit",
        "kind": "number",
        "advanced": true,
        "hint": "Temporary burst allowance before steady-state limits apply. Burst controls help absorb short spikes without suppressing long-term fairness. Use conservative values in shared environments to prevent starvation."
    },
    {
        "key": "windowSeconds",
        "label": "Window Seconds",
        "kind": "number",
        "advanced": true,
        "hint": "Observation window used for counters, thresholds, and rate evaluations. Longer windows smooth noise while shorter windows surface rapid anomalies. Match this setting to how quickly your team expects to react."
    },
    {
        "key": "owner",
        "label": "Owner",
        "kind": "text",
        "advanced": true,
        "hint": "Primary operational owner for this record, typically team alias or role account. Ownership improves handoff quality and keeps escalations direct during incidents. Keep this field populated for all production profiles."
    },
    {
        "key": "ticket",
        "label": "Change Ticket",
        "kind": "text",
        "advanced": true,
        "hint": "Reference to the change or incident ticket that introduced the profile. This creates fast traceability from runtime state back to approval context. Use immutable identifiers instead of free-form notes whenever possible."
    },
    {
        "key": "tags",
        "label": "Tags",
        "kind": "text",
        "advanced": true,
        "hint": "Comma-separated tags for search, grouping, and policy slicing. Consistent tags reduce cognitive load when troubleshooting across many records. Keep tag taxonomy documented in your runbook."
    },
    {
        "key": "description",
        "label": "Description",
        "kind": "textarea",
        "hint": "Extended operator notes describing intent, prerequisites, and rollback caveats. Write enough context so on-call engineers can safely act without opening external documentation. Update this text whenever behavior materially changes."
    }
];

  const secondaryTables = [
    {
        "endpoint": "/certificates/store",
        "title": "Certificate Inventory",
        "description": "Issued certificates currently chained to local authorities.",
        "columns": [
            "commonName",
            "issuer",
            "validFrom",
            "validTo",
            "status",
            "serial"
        ]
    },
    {
        "endpoint": "/certificates/crl",
        "title": "Revocation Lists",
        "description": "Current CRL publication and update state.",
        "columns": [
            "name",
            "lastUpdate",
            "nextUpdate",
            "entries",
            "status"
        ]
    }
];

  let rows = $state<Record<string, any>[]>([]);
  let settings = $state<Record<string, any>>({});
  let draft = $state<Record<string, any>>({});
  let secondaryData = $state<Record<string, Record<string, any>[]>>({});
  let editingId = $state<string | null>(null);
  let loading = $state(true);
  let loadingRows = $state(true);
  let saving = $state(false);
  let deleting = $state(false);
  let search = $state('');
  let showAdvanced = $state(false);
  let showFormAdvanced = $state(false);
  let statusFilter = $state('all');
  let sortField = $state('priority');
  let sortDirection = $state<'asc' | 'desc'>('asc');
  let validation = $state<Record<string, string>>({});
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

  function resetDraft() {
    draft = buildDefaults(rowFields);
    validation = {};
    editingId = null;
  }

  function validateDraft() {
    const next: Record<string, string> = {};
    for (const field of rowFields) {
      if (field.required && !String(draft[field.key] ?? '').trim()) {
        next[field.key] = `${field.label} is required.`;
      }
      if (field.kind === 'number') {
        const value = Number(draft[field.key] ?? 0);
        if (!Number.isFinite(value)) {
          next[field.key] = `${field.label} must be a valid number.`;
        } else if (field.key === 'priority' && (value < 0 || value > 9999)) {
          next[field.key] = 'Priority must stay between 0 and 9999.';
        } else if (field.key === 'timeoutMs' && (value < 100 || value > 120000)) {
          next[field.key] = 'Timeout must stay between 100 and 120000 ms.';
        } else if (field.key === 'windowSeconds' && (value < 1 || value > 86400)) {
          next[field.key] = 'Window must stay between 1 and 86400 seconds.';
        }
      }
    }
    validation = next;
    return Object.keys(next).length === 0;
  }

  async function loadSettings() {
    try {
      const payload = await api.get<Record<string, any>>('/certificates/ca/settings');
      const normalized = normalizeRecord(payload, settingsFields);
      for (const field of settingsFields) settings[field.key] = normalized[field.key];
    } catch {
      for (const field of settingsFields) settings[field.key] = getDefaultValue(field);
      toasts.error($_('certificates_ca.toastfailed_to_load_page_settings'));
    }
  }

  async function loadRows() {
    loadingRows = true;
    try {
      const payload = await api.get<unknown[]>('/certificates/ca');
      rows = Array.isArray(payload) ? payload.map((entry) => normalizeRecord(entry, rowFields)) : [];
    } catch {
      rows = [];
      toasts.error($_('certificates_ca.toastfailed_to_load_inline_records'));
    } finally {
      loadingRows = false;
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
      await api.put('/certificates/ca/settings', payload);
      toasts.success($_('certificates_ca.toastsettings_saved'));
    } catch {
      toasts.error($_('certificates_ca.toastfailed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  async function saveRow() {
    if (!validateDraft()) {
      toasts.error($_('certificates_ca.toastplease_resolve_validation_errors_before_savin'));
      return;
    }

    saving = true;
    try {
      const payload: Record<string, any> = {};
      for (const field of rowFields) { const val = draft[field.key]; if (field.nullable && (val === '' || val === undefined)) { payload[field.key] = null; } else if (field.kind === 'number') { payload[field.key] = val === '' ? 0 : Number(val); } else { payload[field.key] = val; } }
      if (editingId) {
        await api.put(`/certificates/ca/${editingId}`, payload);
      } else {
        await api.post('/certificates/ca', payload);
      }
      toasts.success(editingId ? 'Profile updated' : 'Profile added');
      resetDraft();
      await Promise.all([loadRows(), loadSecondary()]);
    } catch {
      toasts.error($_('certificates_ca.toastfailed_to_save_profile'));
    } finally {
      saving = false;
    }
  }

  function editRow(row: Record<string, any>) {
    draft = { ...row };
    validation = {};
    editingId = String(row.id);
  }

  async function deleteRow(id: string) {
    deleting = true;
    try {
      await api.del(`/certificates/ca/${id}`);
      toasts.success($_('certificates_ca.toastprofile_deleted'));
      await Promise.all([loadRows(), loadSecondary()]);
    } catch {
      toasts.error($_('certificates_ca.toastfailed_to_delete_profile'));
    } finally {
      deleting = false;
    }
  }

  function matchesStatus(row: Record<string, any>) {
    if (statusFilter === 'all') return true;
    return Boolean(row.enabled) === (statusFilter === 'enabled');
  }

  function rowSearchText(row: Record<string, any>) {
    return Object.values(row).map((value) => String(value ?? '').toLowerCase()).join(' ');
  }

  const filteredRows = $derived.by(() => {
    const matched = rows.filter((row) => {
      if (!matchesStatus(row)) return false;
      if (!search) return true;
      return rowSearchText(row).includes(search.toLowerCase());
    });

    const sorted = [...matched].sort((a, b) => {
      const left = a[sortField];
      const right = b[sortField];
      const asNumber = Number(left) - Number(right);
      let delta = Number.isFinite(asNumber) && String(left ?? '').trim() !== '' && String(right ?? '').trim() !== ''
        ? asNumber
        : String(left ?? '').localeCompare(String(right ?? ''));
      if (sortDirection === 'desc') delta *= -1;
      return delta;
    });

    return sorted;
  });

  const activeCount = $derived(filteredRows.filter((row) => Boolean(row.enabled)).length);
  const disabledCount = $derived(filteredRows.filter((row) => !Boolean(row.enabled)).length);
  const errorCount = $derived.by(() => Object.keys(validation).length);

  onMount(() => {
    resetDraft();
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
      <CardHeader class="pb-2"><CardTitle class="text-sm text-slate-200">{$_('certificates_ca.active_profiles')}</CardTitle></CardHeader>
      <CardContent><p class="text-2xl font-semibold text-cyan-400">{activeCount}</p></CardContent>
    </Card>
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader class="pb-2"><CardTitle class="text-sm text-slate-200">{$_('certificates_ca.disabled_profiles')}</CardTitle></CardHeader>
      <CardContent><p class="text-2xl font-semibold text-amber-300">{disabledCount}</p></CardContent>
    </Card>
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader class="pb-2"><CardTitle class="text-sm text-slate-200">{$_('certificates_ca.validation_issues')}</CardTitle></CardHeader>
      <CardContent><p class="text-2xl font-semibold text-rose-300">{errorCount}</p></CardContent>
    </Card>
  </div>

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('certificates_ca.certificate_authority_management')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('certificates_ca.create_import_validate_and_lifecyclemanage_certifi')}</CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadAll()} disabled={loading || saving || deleting}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={loading || saving || deleting}>
            <Save class="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      {#if loading}
        <div class="rounded-md border border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">Loading CA certificates...</div>
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
            <span class="font-medium text-slate-200">{$_('certificates_ca.advanced_operational_behavior')}</span>
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
            <p class="text-sm leading-6 text-slate-300">
              Advanced settings tune polling cadence, strict validation behavior, and fail-safe defaults for this feature area. In production, prefer smaller
              blast radius changes: stage with disabled entries, save settings, then enable records only after validation metrics look stable.
            </p>
            <p class="text-sm leading-6 text-slate-300">
              Use the inline CRUD form below to keep change context close to runtime status and secondary telemetry tables. This mirrors OPNsense-style
              workflows where operators inspect state, apply controlled edits, and verify effects without leaving the page.
            </p>
          </Collapsible.Content>
        </Collapsible.Root>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('certificates_ca.certificate_authorities')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('certificates_ca.create_validate_edit_and_delete_records_directly_w')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-5">
        <Input class="border-slate-700 bg-slate-950 text-slate-100 md:col-span-2" placeholder={$_('certificates_ca.placeholdersearch_profiles_by_any_field')} value={search} oninput={(event) => (search = (event.currentTarget as HTMLInputElement).value)} />
        <Select.Root type="single" value={statusFilter} onValueChange={(value) => value && (statusFilter = value)}>
          <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{statusFilter === 'all' ? 'All rows' : statusFilter === 'enabled' ? 'Enabled rows' : 'Disabled rows'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="all" label="All rows" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="enabled" label="Enabled rows" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="disabled" label="Disabled rows" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
        <Select.Root type="single" value={sortField} onValueChange={(value) => value && (sortField = value)}>
          <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>Sort: {sortField}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="priority" label="Priority" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="name" label="Name" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="scope" label="Scope" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="updated" label="Updated" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
        <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')}>
          {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      {#if Object.keys(validation).length > 0}
        <div class="rounded-md border border-rose-500/40 bg-rose-950/20 px-3 py-2 text-sm text-rose-200">
          Fix highlighted fields before saving this certificate authority. Validation runs inline to prevent malformed profile payloads.
        </div>
      {/if}

      <div class="grid gap-4 lg:grid-cols-2">
        {#each rowFields.filter((field) => !field.advanced || showFormAdvanced) as field}
          <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
            <FieldLabel label={field.label} hint={field.hint} />
            {#if field.kind === 'boolean'}
              <div class="mt-2 flex items-center justify-between">
                <span class="text-xs text-slate-400">{draft[field.key] ? 'Enabled' : 'Disabled'}</span>
                <Switch checked={Boolean(draft[field.key])} onCheckedChange={(checked) => (draft[field.key] = checked)} />
              </div>
            {:else if field.kind === 'select'}
              <Select.Root type="single" value={String(draft[field.key] ?? '')} onValueChange={(value) => value && (draft[field.key] = value)}>
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
              <Textarea class="mt-2 min-h-24 border-slate-700 bg-slate-950 text-slate-100" value={String(draft[field.key] ?? '')} oninput={(event) => (draft[field.key] = (event.currentTarget as HTMLTextAreaElement).value)} />
            {:else}
              <Input
                class="mt-2 border-slate-700 bg-slate-950 text-slate-100"
                type={field.kind === 'number' ? 'number' : 'text'}
                value={String(draft[field.key] ?? '')}
                oninput={(event) => (draft[field.key] = field.kind === 'number' ? Number((event.currentTarget as HTMLInputElement).value || 0) : (event.currentTarget as HTMLInputElement).value)}
              />
            {/if}
            {#if validation[field.key]}
              <p class="mt-2 text-xs text-rose-300">{validation[field.key]}</p>
            {/if}
          </div>
        {/each}
      </div>

      <div class="rounded-md border border-slate-800 bg-slate-950/40 p-3">
        <button type="button" class="flex w-full items-center justify-between text-sm text-slate-200" onclick={() => (showFormAdvanced = !showFormAdvanced)}>
          <span>{$_('certificates_ca.advanced_settings_for_certificate_authority_profil')}</span>
          <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showFormAdvanced ? 'rotate-180' : ''}`} />
        </button>
        {#if showFormAdvanced}
          <p class="pt-2 text-xs leading-6 text-slate-400">
            Advanced fields expose retry logic, thresholds, ownership metadata, and operational annotations. Use these to keep profile behavior explicit and auditable.
            Every advanced field is optional, but production records should include owner and ticket context to accelerate incident handoffs.
          </p>
        {/if}
      </div>

      <div class="flex flex-wrap gap-2">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveRow} disabled={loadingRows || saving || deleting}>
          <Plus class="mr-2 h-4 w-4" /> {editingId ? 'Update Profile' : 'Add Profile'}
        </Button>
        <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={resetDraft} disabled={loadingRows || saving || deleting}>
          Reset Draft
        </Button>
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="px-3 py-2 text-left">Name</th>
              <th class="px-3 py-2 text-left">Scope</th>
              <th class="px-3 py-2 text-left">Target</th>
              <th class="px-3 py-2 text-left">Priority</th>
              <th class="px-3 py-2 text-left">Category</th>
              <th class="px-3 py-2 text-left">Status</th>
              <th class="px-3 py-2 text-left">Owner</th>
              <th class="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if loadingRows}
              <tr><td class="px-3 py-6 text-center text-slate-400" colspan={8}>Loading profiles...</td></tr>
            {:else if filteredRows.length === 0}
              <tr><td class="px-3 py-6 text-center text-slate-500" colspan={8}>No profiles match the current search and filter criteria.</td></tr>
            {:else}
              {#each filteredRows as row}
                <tr class="border-t border-slate-800/80 text-slate-200">
                  <td class="px-3 py-2 text-xs">{String(row.name ?? '-')}</td>
                  <td class="px-3 py-2 text-xs">{String(row.scope ?? '-')}</td>
                  <td class="px-3 py-2 text-xs">{String(row.target ?? '-')}</td>
                  <td class="px-3 py-2 text-xs">{String(row.priority ?? '-')}</td>
                  <td class="px-3 py-2 text-xs">{String(row.category ?? '-')}</td>
                  <td class="px-3 py-2 text-xs">{row.enabled ? 'Enabled' : 'Disabled'}</td>
                  <td class="px-3 py-2 text-xs">{String(row.owner ?? '-')}</td>
                  <td class="px-3 py-2">
                    <div class="flex gap-2">
                      <Button size="sm" variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => editRow(row)}>
                        <Pencil class="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" class="border-red-500/50 text-red-300 hover:bg-red-950/40" onclick={() => void deleteRow(String(row.id))} disabled={deleting}>
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
                  <th class="px-3 py-2 text-left">{column}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No certificates found.</td></tr>
              {:else}
                {#each secondaryData[section.endpoint] ?? [] as row}
                  <tr class="border-t border-slate-800/80 text-slate-200">
                    {#each section.columns as column}
                      <td class="px-3 py-2 text-xs">{String(row[column] ?? '-')}</td>
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
