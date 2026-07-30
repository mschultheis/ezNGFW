<!-- Route view for `/diagnostics/ping` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';
  import Play from '@lucide/svelte/icons/play';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Plus from '@lucide/svelte/icons/plus';
  import { _ } from '$lib/i18n';

  type Field = {
    key: string;
    label: string;
    kind: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
    required?: boolean;
    nullable?: boolean;
    hint: string;
    options?: { value: string; label: string }[];
  };

  const settingsEndpoint = "/diagnostics/ping/settings";
  const rowsEndpoint = "/diagnostics/ping/profiles";
  const actionEndpoint = "/diagnostics/ping";

  const settingsFields: Field[] = [
  {
    "key": "autoRefresh",
    "label": "Auto Refresh History",
    "kind": "boolean",
    "hint": "Auto Refresh History controls how this workflow behaves in production and during troubleshooting. For example, enable during incident calls to keep new measurements visible continuously."
  },
  {
    "key": "refreshSeconds",
    "label": "Refresh Interval Seconds",
    "kind": "number",
    "hint": "Refresh Interval Seconds controls how this workflow behaves in production and during troubleshooting. For example, use 3 seconds for fast monitoring and 20 seconds for low-noise tracking."
  },
  {
    "key": "defaultProtocol",
    "label": "Default Protocol",
    "kind": "select",
    "options": [
      {
        "value": "icmp",
        "label": "ICMP"
      },
      {
        "value": "tcp",
        "label": "TCP Connect"
      }
    ],
    "hint": "Default Protocol controls how this workflow behaves in production and during troubleshooting. For example, switch to tcp probes when intermediate devices block icmp."
  },
  {
    "key": "collectJitter",
    "label": "Collect Jitter Stats",
    "kind": "boolean",
    "hint": "Collect Jitter Stats controls how this workflow behaves in production and during troubleshooting. For example, enable for voice/video quality validation over WAN links."
  },
  {
    "key": "resolveNames",
    "label": "Resolve Reverse DNS",
    "kind": "boolean",
    "hint": "Resolve Reverse DNS controls how this workflow behaves in production and during troubleshooting. For example, disable for speed during outages and enable for detailed reports."
  },
  {
    "key": "keepHistory",
    "label": "Store Run History",
    "kind": "boolean",
    "hint": "Store Run History controls how this workflow behaves in production and during troubleshooting. For example, retain runs so baseline comparisons are available during future incidents."
  }
];
  const actionFields: Field[] = [
  {
    "key": "host",
    "label": "Target Host",
    "kind": "text",
    "hint": "Target Host controls how this workflow behaves in production and during troubleshooting. For example, probe api.partner.net to validate partner connectivity during ticket triage."
  },
  {
    "key": "count",
    "label": "Packet Count",
    "kind": "number",
    "hint": "Packet Count controls how this workflow behaves in production and during troubleshooting. For example, send 10 packets for quick checks or 100 for higher-confidence trend data."
  },
  {
    "key": "size",
    "label": "Payload Size Bytes",
    "kind": "number",
    "hint": "Payload Size Bytes controls how this workflow behaves in production and during troubleshooting. For example, increase to 1400 bytes when testing MTU-sensitive tunnels."
  },
  {
    "key": "interval",
    "label": "Interval Seconds",
    "kind": "number",
    "hint": "Interval Seconds controls how this workflow behaves in production and during troubleshooting. For example, set 0.2 for burst testing and 1.0 for standard continuous checks."
  },
  {
    "key": "interface",
    "label": "Source Interface",
    "kind": "select",
    "options": [
      {
        "value": "",
        "label": "Auto"
      }
    ],
    "hint": "Source Interface controls how this workflow behaves in production and during troubleshooting. For example, bind WAN2 to verify policy-routed upstream path behavior."
  },
  {
    "key": "protocol",
    "label": "Protocol",
    "kind": "select",
    "options": [
      {
        "value": "icmp",
        "label": "ICMP"
      },
      {
        "value": "tcp",
        "label": "TCP"
      }
    ],
    "hint": "Protocol controls how this workflow behaves in production and during troubleshooting. For example, use tcp against port 443 when icmp is filtered by remote providers."
  }
];
  const rowFields: Field[] = [
  {
    "key": "name",
    "label": "Profile Name",
    "kind": "text",
    "required": true,
    "hint": "Profile Name controls how this workflow behaves in production and during troubleshooting. For example, save MPLS-Core-Latency for recurring carrier SLA validation."
  },
  {
    "key": "host",
    "label": "Host",
    "kind": "text",
    "required": true,
    "hint": "Host controls how this workflow behaves in production and during troubleshooting. For example, store fixed test endpoints so comparisons remain apples-to-apples."
  },
  {
    "key": "count",
    "label": "Count",
    "kind": "number",
    "hint": "Count controls how this workflow behaves in production and during troubleshooting. For example, use lower counts for quick checks and higher counts for jitter studies."
  },
  {
    "key": "size",
    "label": "Size",
    "kind": "number",
    "hint": "Size controls how this workflow behaves in production and during troubleshooting. For example, define profile sizes aligned with expected production packet patterns."
  },
  {
    "key": "interface",
    "label": "Interface",
    "kind": "select",
    "options": [
      {
        "value": "",
        "label": "Auto"
      }
    ],
    "hint": "Interface controls how this workflow behaves in production and during troubleshooting. For example, pin interface for deterministic path validation in multi-WAN setups."
  },
  {
    "key": "enabled",
    "label": "Enabled",
    "kind": "boolean",
    "hint": "Enabled controls how this workflow behaves in production and during troubleshooting. For example, disable noisy profiles while preserving their tuning values."
  },
  {
    "key": "description",
    "label": "Description",
    "kind": "textarea",
    "hint": "Description controls how this workflow behaves in production and during troubleshooting. For example, capture acceptable latency/loss thresholds to speed decision making."
  }
];
  const secondaryTables: { endpoint: string; title: string; description: string; columns: string[] }[] = [
  {
    "endpoint": "/diagnostics/ping/history",
    "title": "Ping Run History",
    "description": "Historical ping summaries including packet loss and average RTT for trend analysis.",
    "columns": [
      "timestamp",
      "host",
      "count",
      "lossPct",
      "avgRtt",
      "status"
    ]
  },
  {
    "endpoint": "/diagnostics/ping/stats",
    "title": "Statistics Summary",
    "description": "Current summary stats including min/avg/max RTT and jitter calculations.",
    "columns": [
      "host",
      "transmitted",
      "received",
      "lossPct",
      "minRtt",
      "avgRtt",
      "maxRtt",
      "jitter"
    ]
  }
];

  let rows = $state<Record<string, any>[]>([]);
  let settings = $state<Record<string, any>>({});
  let actionDraft = $state<Record<string, any>>({});
  let draft = $state<Record<string, any>>({});
  let secondaryData = $state<Record<string, Record<string, any>[]>>({});
  let actionResults = $state<Record<string, any>[]>([]);
  let actionOutput = $state('');

  let editingId = $state<string | null>(null);
  let loading = $state(true);
  let loadingRows = $state(true);
  let runningAction = $state(false);
  let saving = $state(false);
  let search = $state('');
  let showAdvanced = $state(false);
  let showToolHints = $state(false);
  let statusFilter = $state('all');
  let timer: ReturnType<typeof setInterval> | null = null;

  let interfaceOptions = $state<{ label: string; value: string }[]>([]);
  let gatewayOptions = $state<{ label: string; value: string }[]>([]);

  function asRows(payload: unknown): Record<string, any>[] {
    if (!Array.isArray(payload)) return [];
    return payload
      .map((entry) => (typeof entry === 'object' && entry !== null ? (entry as Record<string, any>) : { value: String(entry ?? '') }))
      .filter((row) => Object.values(row).some((v) => v !== null && v !== undefined && v !== '' && v !== 0 && v !== false));
  }

  const MAX_TABLE_ROWS = 100;

  function fieldOptions(field: Field) {
    if (field.key.toLowerCase().includes('interface')) return interfaceOptions.length > 0 ? interfaceOptions : field.options ?? [];
    if (field.key.toLowerCase().includes('gateway')) return gatewayOptions.length > 0 ? gatewayOptions : field.options ?? [];
    return field.options ?? [];
  }

  function getDefaultValue(field: Field) {
    if (field.kind === 'boolean') return false;
    if (field.kind === 'number') return 0;
    if (field.kind === 'select') return fieldOptions(field)[0]?.value ?? '';
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
    out.id = String(row.id ?? row.uuid ?? row.key ?? row.name ?? crypto.randomUUID());
    return out;
  }

  function resetDrafts() {
    draft = buildDefaults(rowFields);
    actionDraft = buildDefaults(actionFields);
    editingId = null;
  }

  async function loadAuxiliary() {
    try {
      const interfacesPayload = await api.get('/interfaces');
      interfaceOptions = asRows(interfacesPayload).map((row) => {
        const value = String(row.name ?? row.id ?? row.interface ?? row.value ?? '');
        const device = row.device ? ` (${String(row.device)})` : '';
        return { label: `${value}${device}`, value };
      }).filter((entry) => entry.value.length > 0);
    } catch {
      interfaceOptions = [];
    }

    try {
      const gatewayPayload = await api.get('/routing/gateways');
      gatewayOptions = asRows(gatewayPayload).map((row) => {
        const value = String(row.name ?? row.gateway ?? row.id ?? row.value ?? '');
        return { label: value, value };
      }).filter((entry) => entry.value.length > 0);
    } catch {
      gatewayOptions = [];
    }
  }

  async function loadSettings() {
    if (!settingsEndpoint) return;
    try {
      const payload = await api.get<Record<string, any>>(settingsEndpoint);
      const normalized = normalizeRecord(payload, settingsFields);
      for (const field of settingsFields) settings[field.key] = normalized[field.key];
    } catch {
      for (const field of settingsFields) settings[field.key] = getDefaultValue(field);
      toasts.error($_('diagnostics_ping.toastfailed_to_load_configuration_settings'));
    }
  }

  async function loadRows() {
    if (!rowsEndpoint) return;
    loadingRows = true;
    try {
      const payload = await api.get<unknown[]>(rowsEndpoint);
      rows = Array.isArray(payload) ? payload.map((entry) => normalizeRecord(entry, rowFields)) : [];
    } catch {
      rows = [];
      toasts.error($_('diagnostics_ping.toastfailed_to_load_records'));
    } finally {
      loadingRows = false;
    }
  }

  async function loadSecondary() {
    const next: Record<string, Record<string, any>[]> = {};
    for (const section of secondaryTables) {
      try {
        const payload = await api.get<unknown[]>(section.endpoint);
        next[section.endpoint] = asRows(payload);
      } catch {
        next[section.endpoint] = [];
      }
    }
    secondaryData = next;
  }

  async function loadAll() {
    loading = true;
    await loadAuxiliary();
    await Promise.all([loadSettings(), loadRows(), loadSecondary()]);
    loading = false;
  }

  async function saveSettings() {
    if (!settingsEndpoint) return;
    saving = true;
    try {
      const payload: Record<string, any> = {};
      for (const field of settingsFields) payload[field.key] = settings[field.key];
      await api.put(settingsEndpoint, payload);
      toasts.success($_('diagnostics_ping.toastsettings_saved'));
    } catch {
      toasts.error($_('diagnostics_ping.toastfailed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  async function runPrimaryAction() {
    if (!actionEndpoint) return;
    runningAction = true;
    actionOutput = 'Running request against backend API...';
    try {
      const payload: Record<string, any> = {};
      for (const field of actionFields) payload[field.key] = actionDraft[field.key];
      const response = await api.post(actionEndpoint, payload);
      const maybeRecord = typeof response === 'object' && response !== null ? (response as Record<string, any>) : {};
      actionResults = asRows(maybeRecord.results ?? maybeRecord.hops ?? maybeRecord.rows ?? maybeRecord.records ?? response);
      actionOutput = String(maybeRecord.output ?? maybeRecord.summary ?? JSON.stringify(response, null, 2));
      toasts.success($_('diagnostics_ping.toastaction_completed_successfully'));
      await loadSecondary();
    } catch {
      actionResults = [];
      actionOutput = 'Request failed. Check backend service status and try again.';
      toasts.error($_('diagnostics_ping.toastaction_failed'));
    } finally {
      runningAction = false;
    }
  }

  async function saveRow() {
    if (!rowsEndpoint) return;
    saving = true;
    try {
      const payload: Record<string, any> = {};
      for (const field of rowFields) { const val = draft[field.key]; if (field.nullable && (val === '' || val === undefined)) { payload[field.key] = null; } else if (field.kind === 'number') { payload[field.key] = val === '' ? 0 : Number(val); } else { payload[field.key] = val; } }
      if (editingId) await api.put(`${rowsEndpoint}/${editingId}`, payload);
      else await api.post(rowsEndpoint, payload);
      toasts.success(editingId ? 'Record updated' : 'Record created');
      resetDrafts();
      await Promise.all([loadRows(), loadSecondary()]);
    } catch {
      toasts.error($_('diagnostics_ping.toastfailed_to_save_record'));
    } finally {
      saving = false;
    }
  }

  function editRow(row: Record<string, any>) {
    draft = { ...row };
    editingId = String(row.id);
  }

  async function deleteRow(id: string) {
    if (!rowsEndpoint) return;
    saving = true;
    try {
      await api.del(`${rowsEndpoint}/${id}`);
      toasts.success($_('diagnostics_ping.toastrecord_deleted'));
      await Promise.all([loadRows(), loadSecondary()]);
    } catch {
      toasts.error($_('diagnostics_ping.toastfailed_to_delete_record'));
    } finally {
      saving = false;
    }
  }

  function matchesStatus(row: Record<string, any>) {
    if (statusFilter === 'all') return true;
    return Boolean(row.enabled) === (statusFilter === 'enabled');
  }

  function rowSearchText(row: Record<string, any>) {
    return Object.values(row).map((value) => String(value ?? '').toLowerCase()).join(' ');
  }

  const filteredRows = $derived(
    rows.filter((row) => matchesStatus(row) && (!search || rowSearchText(row).includes(search.toLowerCase())))
  );

  const summaryCards = $derived.by(() => [
    { label: 'Total Tests', value: String(rows.length) },
    { label: 'Showing', value: String(filteredRows.length) },
    { label: 'Test Results', value: String(actionResults.length) },
    { label: 'Targets', value: String(secondaryTables.length + 2) }
  ]);

  onMount(() => {
    resetDrafts();
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
  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('diagnostics_ping.ping_diagnostics')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('diagnostics_ping.run_controlled_icmptcp_probe_tests_with_live_outpu')}</CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadAll()} disabled={loading || saving || runningAction}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={loading || saving || runningAction || !settingsEndpoint}>
            <Save class="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {#each summaryCards as stat}
          <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
            <p class="text-xs uppercase tracking-wide text-slate-400">{stat.label}</p>
            <p class="mt-1 text-xl font-semibold text-cyan-300">{stat.value}</p>
          </div>
        {/each}
      </div>

      {#if loading}
        <div class="rounded-md border border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">Loading ping results...</div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    <span>{fieldOptions(field).find((option) => option.value === String(settings[field.key]))?.label ?? 'Select value'}</span>
                  </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each fieldOptions(field) as option}
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
          <Collapsible.Trigger>
            <span class="font-medium text-slate-200">{$_('diagnostics_ping.advanced_operational_behavior')}</span>
            <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </Collapsible.Trigger>
          <Collapsible.Content>
            <p class="text-sm leading-6 text-slate-300">
              Advanced settings tune polling cadence, strict validation behavior, and fail-safe defaults. In production,
              stage major changes by disabling new records first, then save and verify live telemetry before enabling.
              Keep the inline CRUD form below as the source of truth for what is currently deployed.
            </p>
          </Collapsible.Content>
        </Collapsible.Root>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('diagnostics_ping.live_ping_runner')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('diagnostics_ping.send_packet_probes_with_custom_count_payload_size')}</CardDescription>
        </div>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={runPrimaryAction} disabled={runningAction || loading || !actionEndpoint}>
          <Play class="mr-2 h-4 w-4" /> {runningAction ? 'Running...' : 'Start Ping'}
        </Button>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each actionFields as field}
          <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
            <FieldLabel label={field.label} hint={field.hint} />
            {#if field.kind === 'boolean'}
              <div class="mt-2 flex items-center justify-between">
                <span class="text-xs text-slate-400">{actionDraft[field.key] ? 'Enabled' : 'Disabled'}</span>
                <Switch checked={Boolean(actionDraft[field.key])} onCheckedChange={(checked) => (actionDraft[field.key] = checked)} />
              </div>
            {:else if field.kind === 'select'}
              <Select.Root type="single" value={String(actionDraft[field.key] ?? '')} onValueChange={(value) => value && (actionDraft[field.key] = value)}>
                <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{fieldOptions(field).find((option) => option.value === String(actionDraft[field.key]))?.label ?? 'Select value'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each fieldOptions(field) as option}
                    <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else if field.kind === 'textarea'}
              <Textarea class="mt-2 min-h-20 border-slate-700 bg-slate-950 text-slate-100" value={String(actionDraft[field.key] ?? '')} oninput={(event) => (actionDraft[field.key] = (event.currentTarget as HTMLTextAreaElement).value)} />
            {:else}
              <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type={field.kind === 'number' ? 'number' : 'text'} value={String(actionDraft[field.key] ?? '')} oninput={(event) => (actionDraft[field.key] = field.kind === 'number' ? Number((event.currentTarget as HTMLInputElement).value || 0) : (event.currentTarget as HTMLInputElement).value)} />
            {/if}
          </div>
        {/each}
      </div>

      <Collapsible.Root bind:open={showToolHints}>
        <Collapsible.Trigger>
          <span class="font-medium text-slate-200">{$_('diagnostics_ping.how_to_interpret_tool_output')}</span>
          <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showToolHints ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content>
          <p class="text-sm leading-6 text-slate-300">
            Use the summary output for quick checks, then inspect the row-level table for detailed timing and status values.
            Practical workflow: run a baseline test during normal operation, save the output, and compare against future incidents.
            This helps distinguish transient upstream issues from persistent local misconfiguration.
          </p>
        </Collapsible.Content>
      </Collapsible.Root>

      <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <p class="mb-2 text-xs uppercase tracking-wide text-slate-400">{$_('diagnostics_ping.live_output')}</p>
        <pre class="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{actionOutput || 'No output yet. Run the tool to populate this panel.'}</pre>
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {#if actionResults.length === 0}
                <th class="px-3 py-2 text-left">Result</th>
              {:else}
                {#each Object.keys(actionResults[0]) as key}
                  <th class="px-3 py-2 text-left">{key}</th>
                {/each}
              {/if}
            </tr>
          </thead>
          <tbody>
            {#if actionResults.length === 0}
              <tr><td class="px-3 py-6 text-center text-slate-500">No structured rows returned.</td></tr>
            {:else}
              {#each actionResults.slice(0, MAX_TABLE_ROWS) as result}
                <tr class="border-t border-slate-800/80 text-slate-200">
                  {#each Object.keys(actionResults[0]) as key}
                    <td class="px-3 py-2 text-xs">{String(result[key] ?? '-')}</td>
                  {/each}
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
        {#if actionResults.length > MAX_TABLE_ROWS}
          <div class="border-t border-slate-800 px-3 py-2 text-xs text-slate-400">Showing {MAX_TABLE_ROWS} of {actionResults.length} rows</div>
        {/if}
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('diagnostics_ping.ping_targets')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('diagnostics_ping.create_edit_and_delete_records_directly_in_place_t')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder={$_('diagnostics_ping.placeholdersearch_records')} value={search} oninput={(event) => (search = (event.currentTarget as HTMLInputElement).value)} />
        <Select.Root type="single" value={statusFilter} onValueChange={(value) => value && (statusFilter = value)}>
          <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{statusFilter === 'all' ? 'All rows' : statusFilter === 'enabled' ? 'Enabled rows' : 'Disabled rows'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="all" label="All rows" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="enabled" label="Enabled rows" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="disabled" label="Disabled rows" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveRow} disabled={loadingRows || saving || !rowsEndpoint}>
          <Plus class="mr-2 h-4 w-4" /> {editingId ? 'Update Row' : 'Add Row'}
        </Button>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        {#each rowFields as field}
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
                  <span>{fieldOptions(field).find((option) => option.value === String(draft[field.key]))?.label ?? 'Select value'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each fieldOptions(field) as option}
                    <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else if field.kind === 'textarea'}
              <Textarea class="mt-2 min-h-24 border-slate-700 bg-slate-950 text-slate-100" value={String(draft[field.key] ?? '')} oninput={(event) => (draft[field.key] = (event.currentTarget as HTMLTextAreaElement).value)} />
            {:else}
              <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type={field.kind === 'number' ? 'number' : 'text'} value={String(draft[field.key] ?? '')} oninput={(event) => (draft[field.key] = field.kind === 'number' ? Number((event.currentTarget as HTMLInputElement).value || 0) : (event.currentTarget as HTMLInputElement).value)} />
            {/if}
          </div>
        {/each}
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {#each rowFields.slice(0, 6) as field}
                <th class="px-3 py-2 text-left">{field.label}</th>
              {/each}
              <th class="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if loadingRows}
              <tr><td class="px-3 py-6 text-center text-slate-400" colspan={rowFields.slice(0, 6).length + 1}>Loading rows...</td></tr>
            {:else if filteredRows.length === 0}
              <tr><td class="px-3 py-6 text-center text-slate-500" colspan={rowFields.slice(0, 6).length + 1}>No rows match the current filter.</td></tr>
            {:else}
              {#each filteredRows as row}
                <tr class="border-t border-slate-800/80 text-slate-200">
                  {#each rowFields.slice(0, 6) as field}
                    <td class="px-3 py-2 align-top text-xs">{field.kind === 'boolean' ? (row[field.key] ? 'Yes' : 'No') : String(row[field.key] ?? '-')}</td>
                  {/each}
                  <td class="px-3 py-2">
                    <div class="flex gap-2">
                      <Button size="sm" variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => editRow(row)}>
                        <Pencil class="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" class="border-red-500/50 text-red-300 hover:bg-red-950/40" onclick={() => void deleteRow(String(row.id))}>
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
              <!-- sectionRows computed inline -->
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No ping results found.</td></tr>
              {:else}
                {#each (secondaryData[section.endpoint] ?? []).slice(0, MAX_TABLE_ROWS) as row}
                  <tr class="border-t border-slate-800/80 text-slate-200">
                    {#each section.columns as column}
                      <td class="px-3 py-2 text-xs">{String(row[column] ?? '-')}</td>
                    {/each}
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
          <!-- totalRows computed inline -->
          {#if (secondaryData[section.endpoint] ?? []).length > MAX_TABLE_ROWS}
            <div class="border-t border-slate-800 px-3 py-2 text-xs text-slate-400">Showing {MAX_TABLE_ROWS} of {(secondaryData[section.endpoint] ?? []).length} rows</div>
          {/if}
        </div>
      </CardContent>
    </Card>
  {/each}
</div>
