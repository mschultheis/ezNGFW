<!-- Route view for `/dhcp/reservations` in the ezNGFW admin GUI. -->

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
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, SelectOption, TableColumn } from '$lib/types/admin';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';
  import Play from '@lucide/svelte/icons/play';

  import { _ } from '$lib/i18n';
  type Field = {
    key: string;
    label: string;
    kind: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
    required?: boolean;
    nullable?: boolean;
    placeholder?: string;
    hint: string;
    options?: { value: string; label: string }[];
  };

  const settingsEndpoint = "/dhcp/reservations/settings";
  const rowsEndpoint = "/dhcp/reservations";
  const actionEndpoint = "/dhcp/reservations/validate";

  const settingsFields: Field[] = [
    {
      "key": "autoRefresh",
      "label": "Auto Refresh Reservations",
      "kind": "boolean",
      "hint": "Auto Refresh Reservations controls how this workflow behaves in production and during troubleshooting. For example, enable during bulk onboarding and disable during routine steady-state operations."
    },
    {
      "key": "refreshSeconds",
      "label": "Refresh Interval Seconds",
      "kind": "number",
      "hint": "Refresh Interval Seconds controls how this workflow behaves in production and during troubleshooting. For example, set 15 seconds while reconciling endpoint inventory."
    },
    {
      "key": "strictMacFormat",
      "label": "Strict MAC Format",
      "kind": "boolean",
      "hint": "Strict MAC Format controls how this workflow behaves in production and during troubleshooting. For example, enforce canonical formatting to avoid duplicate logical entries."
    },
    {
      "key": "checkPoolConflicts",
      "label": "Check Pool Conflicts",
      "kind": "boolean",
      "hint": "Check Pool Conflicts controls how this workflow behaves in production and during troubleshooting. For example, enable to catch static assignments that overlap dynamic pools."
    },
    {
      "key": "requireHostname",
      "label": "Require Hostname",
      "kind": "boolean",
      "hint": "Require Hostname controls how this workflow behaves in production and during troubleshooting. For example, turn on to maintain readable lease and DNS records."
    },
    {
      "key": "autoCreateDns",
      "label": "Auto Create DNS Host",
      "kind": "boolean",
      "hint": "Auto Create DNS Host controls how this workflow behaves in production and during troubleshooting. For example, link DHCP reservations with local DNS for seamless name resolution."
    }
  ];

  const actionFields: Field[] = [
    {
      "key": "interface",
      "label": "Interface Scope",
      "kind": "select",
      "options": [
        {
          "value": "",
          "label": "All interfaces"
        }
      ],
      "hint": "Interface Scope controls how this workflow behaves in production and during troubleshooting. For example, validate only changed VLAN scopes before global rollout."
    },
    {
      "key": "checkDuplicates",
      "label": "Check Duplicate MAC/IP",
      "kind": "boolean",
      "hint": "Check Duplicate MAC/IP controls how this workflow behaves in production and during troubleshooting. For example, catch accidental duplicate reservations before service reload."
    },
    {
      "key": "checkLeases",
      "label": "Cross-Check Active Leases",
      "kind": "boolean",
      "hint": "Cross-Check Active Leases controls how this workflow behaves in production and during troubleshooting. For example, identify conflicts with currently leased addresses quickly."
    },
    {
      "key": "checkDns",
      "label": "Verify DNS Alignment",
      "kind": "boolean",
      "hint": "Verify DNS Alignment controls how this workflow behaves in production and during troubleshooting. For example, confirm hostname-to-address consistency for managed devices."
    },
    {
      "key": "sampleSize",
      "label": "Sample Size",
      "kind": "number",
      "hint": "Sample Size controls how this workflow behaves in production and during troubleshooting. For example, run large samples after imports and small samples for spot checks."
    },
    {
      "key": "notes",
      "label": "Validation Notes",
      "kind": "text",
      "hint": "Validation Notes controls how this workflow behaves in production and during troubleshooting. For example, record batch source or ticket context for audit history."
    }
  ];

  const columns: TableColumn[] = [
    { key: 'hostname', label: 'Hostname' },
    { key: 'hw_address', label: 'MAC Address', mono: true },
    { key: 'ip_address', label: 'IP Address', mono: true },
    { key: 'description', label: 'Description' }
  ];

  const fields: FormField[] = [
    {
      key: 'hostname',
      label: 'Hostname',
      type: 'text',
      required: true,
      placeholder: 'printer-3f-west',
      hint: 'The hostname assigned to this DHCP reservation. The DHCP server provides this to the client. Use descriptive names like printer-3f-west or ap-lobby for easy identification.'
    },
    {
      key: 'hw_address',
      label: 'MAC Address',
      type: 'text',
      required: true,
      placeholder: 'aa:bb:cc:dd:ee:ff',
      hint: 'The hardware (MAC) address of the device receiving this reservation. Use colon-separated format (aa:bb:cc:dd:ee:ff). Find the MAC in your device settings or the DHCP leases table.'
    },
    {
      key: 'ip_address',
      label: 'IP Address',
      type: 'text',
      required: true,
      placeholder: '192.168.1.50',
      hint: 'The fixed IPv4 address assigned to this device. Choose an address outside the DHCP pool dynamic range to avoid conflicts. Example: if pool is .100-.200, use addresses below .100.'
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: '3rd floor west wing printer',
      hint: 'Free-form description for documentation. Include location, owner, or purpose to help identify this reservation during troubleshooting.'
    }
  ];

  const secondaryTables: { endpoint: string; title: string; description: string; columns: string[] }[] = [
    {
      "endpoint": "/dhcp/leases",
      "title": "Active Leases Reference",
      "description": "Current active leases used to identify reservation opportunities and conflicts.",
      "columns": [
        "ipAddress",
        "macAddress",
        "hostname",
        "interface",
        "starts",
        "ends"
      ]
    },
    {
      "endpoint": "/dhcp/pool-usage",
      "title": "Pool Utilization Context",
      "description": "Pool usage context to avoid static mappings in exhausted or over-subscribed ranges.",
      "columns": [
        "pool",
        "interface",
        "used",
        "free",
        "utilizationPct"
      ]
    }
  ];

  let settings = $state<Record<string, any>>({});
  let actionDraft = $state<Record<string, any>>({});
  let secondaryData = $state<Record<string, Record<string, any>[]>>({});
  let actionResults = $state<Record<string, any>[]>([]);
  let actionOutput = $state('');

  let loading = $state(true);
  let runningAction = $state(false);
  let saving = $state(false);
  let showAdvanced = $state(false);
  let showToolHints = $state(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  let interfaceOptions = $state<{ label: string; value: string }[]>([]);
  let gatewayOptions = $state<{ label: string; value: string }[]>([]);

  function asRows(payload: unknown): Record<string, any>[] {
    if (!Array.isArray(payload)) return [];
    return payload.map((entry) => (typeof entry === 'object' && entry !== null ? (entry as Record<string, any>) : { value: String(entry ?? '') }));
  }

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
    return out;
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
      toasts.error($_('dhcp_reservations.toast_failed_to_load_configuration_settings'));
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
    await Promise.all([loadSettings(), loadSecondary()]);
    loading = false;
  }

  async function saveSettings() {
    if (!settingsEndpoint) return;
    saving = true;
    try {
      const payload: Record<string, any> = {};
      for (const field of settingsFields) payload[field.key] = settings[field.key];
      await api.put(settingsEndpoint, payload);
      toasts.success($_('dhcp_reservations.toast_settings_saved'));
    } catch {
      toasts.error($_('dhcp_reservations.toast_failed_to_save_settings'));
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
      toasts.success($_('dhcp_reservations.toast_action_completed_successfully'));
      await loadSecondary();
    } catch {
      actionResults = [];
      actionOutput = 'Request failed. Check backend service status and try again.';
      toasts.error($_('dhcp_reservations.toast_action_failed'));
    } finally {
      runningAction = false;
    }
  }

  onMount(() => {
    actionDraft = buildDefaults(actionFields);
    void loadAll();
  });

  $effect(() => {
    if (timer) clearInterval(timer);
    if (Boolean(settings.autoRefresh) && Number(settings.refreshSeconds) > 0) {
      timer = setInterval(() => {
        void loadSecondary();
      }, Number(settings.refreshSeconds) * 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('dhcp_reservations.dhcp_static_reservations')}</CardTitle>
          <CardDescription class="text-slate-400">Manage MAC-to-IP static mappings with inline CRUD, interface selection, and validation-focused advanced guidance.</CardDescription>
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
      {#if loading}
        <div class="rounded-md border border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">Loading DHCP reservations...</div>
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
            <span class="font-medium text-slate-200">{$_('dhcp_reservations.advanced_operational_behavior')}</span>
            <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </Collapsible.Trigger>
          <Collapsible.Content>
            <p class="text-sm leading-6 text-slate-300">{$_('dhcp_reservations.advanced_settings_tune_polling_cadence_strict_vali')}</p>
          </Collapsible.Content>
        </Collapsible.Root>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('dhcp_reservations.reservation_validation')}</CardTitle>
          <CardDescription class="text-slate-400">Validate static mappings against pool ranges and conflict checks before applying to active DHCP service.</CardDescription>
        </div>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={runPrimaryAction} disabled={runningAction || loading || !actionEndpoint}>
          <Play class="mr-2 h-4 w-4" /> {runningAction ? 'Running...' : 'Validate Mappings'}
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
          <span class="font-medium text-slate-200">{$_('dhcp_reservations.how_to_interpret_tool_output')}</span>
          <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showToolHints ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content>
          <p class="text-sm leading-6 text-slate-300">{$_('dhcp_reservations.use_the_summary_output_for_quick_checks_then_inspe')}</p>
        </Collapsible.Content>
      </Collapsible.Root>

      <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <p class="mb-2 text-xs uppercase tracking-wide text-slate-400">{$_('dhcp_reservations.live_output')}</p>
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
              {#each actionResults as result}
                <tr class="border-t border-slate-800/80 text-slate-200">
                  {#each Object.keys(actionResults[0]) as key}
                    <td class="px-3 py-2 text-xs">{String(result[key] ?? '-')}</td>
                  {/each}
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>

  <ResourceTable
    title="{$_('dhcp_reservations.dhcp_static_reservations')}"
    description={$_('dhcp_reservations.descriptioncreate_edit_and_delete_records_directly')}
    endpoint={rowsEndpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('dhcp_reservations.addlabeladd_reservation')}
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
                  <th class="px-3 py-2 text-left">{column}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No DHCP reservations found.</td></tr>
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
