<!-- Route view for `/dns/statistics` in the ezNGFW admin GUI. -->

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
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SaveIcon from '@lucide/svelte/icons/save';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

  import { _ } from '$lib/i18n';
  type Option = { value: string; label: string };
  type FieldKind = 'text' | 'number' | 'boolean' | 'select';
  type FieldDef = {
    key: string;
    label: string;
    kind: FieldKind;
    required: boolean;
    advanced: boolean;
    hint: string;
    options?: Option[];
  };

  const endpoint = '/dns/stats';
  const optionsEndpoint = '/interfaces';
  const idKey = 'id';

  const fields: FieldDef[] = [
    {
      key: 'id',
      label: 'Profile ID',
      kind: 'text',
      required: true,
      advanced: false,
      hint:
        'Stable identifier for analytics profile records used in update and delete operations. Keep IDs durable to preserve dashboard drill-down continuity.',
    },
    {
      key: 'name',
      label: 'Profile Name',
      kind: 'text',
      required: true,
      advanced: false,
      hint:
        'Operator-facing name that identifies resolver analytics scope and ownership. Example: Global-Resolver or Guest-Network-DNS performance profile.',
    },
    {
      key: 'enabled',
      label: 'Enabled',
      kind: 'boolean',
      required: false,
      advanced: false,
      hint:
        'Enable this analytics profile to include data in dashboards and exports. Disable profiles temporarily when validating parser changes or backend upgrades.',
    },
    {
      key: 'timeRange',
      label: 'Default Time Range',
      kind: 'select',
      required: true,
      advanced: false,
      options: [
        { value: '15m', label: 'Last 15 minutes' },
        { value: '1h', label: 'Last hour' },
        { value: '24h', label: 'Last 24 hours' },
        { value: '7d', label: 'Last 7 days' },
      ],
      hint:
        'Default window applied to charts and table views when users open the page. Pick a range that balances sensitivity with trend readability.',
    },
    {
      key: 'interface',
      label: 'Interface Scope',
      kind: 'select',
      required: true,
      advanced: false,
      options: [
        { value: 'all', label: 'All interfaces' },
      ],
      hint:
        'Filter resolver metrics by a specific interface or aggregate across all interfaces. Segment views help isolate recursive pressure from noisy VLANs.',
    },
    {
      key: 'queryTypeFocus',
      label: 'Query Type Focus',
      kind: 'select',
      required: true,
      advanced: false,
      options: [
        { value: 'all', label: 'All types' },
        { value: 'a', label: 'A' },
        { value: 'aaaa', label: 'AAAA' },
        { value: 'srv', label: 'SRV' },
        { value: 'txt', label: 'TXT' },
      ],
      hint:
        'Primary query type focus used in summary cards and top-list ranking. Useful when IPv6 adoption or service discovery traffic needs close attention.',
    },
    {
      key: 'latencyTargetMs',
      label: 'Latency Target ms',
      kind: 'number',
      required: true,
      advanced: false,
      hint:
        'Target upstream latency threshold that flags warning states in operator cards. Example: 60 ms for branch links and 25 ms for datacenter resolvers.',
    },
    {
      key: 'cacheHitTarget',
      label: 'Cache Hit Target %',
      kind: 'number',
      required: true,
      advanced: false,
      hint:
        'Desired cache-hit ratio used to evaluate resolver efficiency and locality. Sustained misses may indicate low TTLs or inappropriate forwarding strategy.',
    },
    {
      key: 'blocklistView',
      label: 'Blocklist View',
      kind: 'select',
      required: false,
      advanced: true,
      options: [
        { value: 'summary', label: 'Summary' },
        { value: 'category', label: 'By category' },
        { value: 'domain', label: 'By domain' },
      ],
      hint:
        'Preferred blocked query visualization for analysts and incident responders. Category view helps identify policy gaps and unusual threat campaigns quickly.',
    },
    {
      key: 'topN',
      label: 'Top Domain Limit',
      kind: 'number',
      required: false,
      advanced: true,
      hint:
        'Number of top domains shown in table and trend charts by default. Use smaller values in NOC screens and larger values for investigation sessions.',
    },
    {
      key: 'alertOnLatency',
      label: 'Alert On Latency',
      kind: 'boolean',
      required: false,
      advanced: true,
      hint:
        'Enable alerting workflow when upstream latency exceeds configured thresholds. Pair with retry metrics to distinguish transient blips from systemic upstream issues.',
    },
    {
      key: 'alertOnMissSpike',
      label: 'Alert On Cache Miss Spike',
      kind: 'boolean',
      required: false,
      advanced: true,
      hint:
        'Trigger notifications on sudden miss spikes that may signal cache flushes or attack traffic. Tune alongside baseline traffic seasonality for fewer false positives.',
    },
    {
      key: 'notes',
      label: 'Operational Notes',
      kind: 'text',
      required: false,
      advanced: true,
      hint:
        'Capture context about planned maintenance, upstream incidents, or temporary overrides. Good notes speed shift handoffs and reduce duplicate investigation effort.',
    },
  ];

  let records = $state<Record<string, string | number | boolean>[]>([]);
  let createForm = $state<Record<string, string | number | boolean>>({});
  let createErrors = $state<Record<string, string>>({});
  let rowErrors = $state<Record<string, Record<string, string>>>({});
  let editing = $state<Record<string, boolean>>({});
  let optionMap = $state<Record<string, Option[]>>({});

  let loading = $state(true);
  let creating = $state(false);
  let savingId = $state('');
  let deletingId = $state('');
  let showAdvancedCreate = $state(false);
  let showOnlyEnabled = $state(false);
  let searchText = $state('');
  let selectedId = $state('');
  let sortMode = $state('name-asc');
  let lastError = $state('');

  const sortModes = [
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
    { value: 'recent', label: 'Recently touched' },
  ];

  function optionForField(field: FieldDef): Option[] {
    if (field.options && field.options.length > 0) {
      if (field.key === 'interface' || field.key === 'matchInterface') {
        const live = optionMap[field.key] ?? [];
        return live.length > 0 ? live : field.options;
      }
      return field.options;
    }
    return optionMap[field.key] ?? [];
  }

  function defaultValue(field: FieldDef): string | number | boolean {
    if (field.kind === 'boolean') return false;
    if (field.kind === 'number') return 0;
    if (field.kind === 'select') return optionForField(field)[0]?.value ?? '';
    return '';
  }

  function buildDefaults(): Record<string, string | number | boolean> {
    const defaults: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      defaults[field.key] = defaultValue(field);
    }
    return defaults;
  }

  function rowId(row: Record<string, string | number | boolean>): string {
    const raw = row[idKey];
    return String(raw || crypto.randomUUID());
  }

  function toText(value: string | number | boolean | undefined): string {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function normalize(raw: unknown): Record<string, string | number | boolean> {
    const source = (raw as Record<string, unknown>) ?? {};
    const next: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      const value = source[field.key];
      if (field.kind === 'boolean') {
        next[field.key] = Boolean(value);
      } else if (field.kind === 'number') {
        next[field.key] = Number(value ?? 0);
      } else {
        next[field.key] = String(value ?? defaultValue(field));
      }
    }
    if (!next[idKey]) {
      next[idKey] = crypto.randomUUID();
    }
    return next;
  }

  async function loadOptions() {
    try {
      const payload = await api.get(optionsEndpoint);
      const list = Array.isArray(payload) ? payload : [];
      const interfaceOptions = list.map((entry) => {
        const row = (entry as Record<string, unknown>) ?? {};
        const name = String(row.name ?? row.interface ?? row.iface ?? '').trim();
        return name ? { value: name, label: name } : null;
      }).filter(Boolean) as Option[];
      if (interfaceOptions.length > 0) {
        optionMap.interface = interfaceOptions;
        optionMap.matchInterface = [{ value: '', label: 'Any interface' }, ...interfaceOptions];
        optionMap = { ...optionMap };
      }
    } catch {
      // Keep static defaults if options endpoint is unavailable.
    }
  }

  async function load() {
    loading = true;
    lastError = '';
    try {
      const payload = await api.get(endpoint);
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as Record<string, unknown>)?.items)
          ? ((payload as Record<string, unknown>).items as unknown[])
          : [];
      records = list.map((item) => normalize(item));
      for (const row of records) {
        const id = rowId(row);
        if (editing[id] === undefined) editing[id] = false;
      }
      editing = { ...editing };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Failed to load records';
      toasts.error(lastError);
      records = [];
    } finally {
      loading = false;
    }
  }

  function validateRow(row: Record<string, string | number | boolean>): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (!field.required) continue;
      const value = row[field.key];
      if (field.kind === 'text' || field.kind === 'select') {
        if (!toText(value).trim()) {
          errors[field.key] = `${field.label} is required.`;
        }
      }
      if (field.kind === 'number') {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          errors[field.key] = `${field.label} must be a valid number.`;
        }
      }
    }
    return errors;
  }

  function validateCreate(): boolean {
    createErrors = validateRow(createForm);
    return Object.keys(createErrors).length === 0;
  }

  function validateExisting(row: Record<string, string | number | boolean>): boolean {
    const id = rowId(row);
    const errors = validateRow(row);
    rowErrors[id] = errors;
    rowErrors = { ...rowErrors };
    return Object.keys(errors).length === 0;
  }

  function setCreateField(key: string, value: string | number | boolean) {
    createForm[key] = value;
    createForm = { ...createForm };
    if (createErrors[key]) {
      delete createErrors[key];
      createErrors = { ...createErrors };
    }
  }

  function setRowField(row: Record<string, string | number | boolean>, key: string, value: string | number | boolean) {
    row[key] = value;
    records = [...records];
    const id = rowId(row);
    if (rowErrors[id]?.[key]) {
      delete rowErrors[id][key];
      rowErrors = { ...rowErrors };
    }
  }

  async function createRecord() {
    if (!validateCreate()) {
      toasts.error($_('dns_stats.toast_please_fix_required_fields_before_creating_this_re'));
      return;
    }
    creating = true;
    try {
      await api.post(endpoint, { ...createForm });
      toasts.success($_('dns_stats.toast_dns_statistics_create_operation_succeeded'));
      createForm = buildDefaults();
      createErrors = {};
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Create request failed');
    } finally {
      creating = false;
    }
  }

  async function saveRecord(row: Record<string, string | number | boolean>) {
    if (!validateExisting(row)) {
      toasts.error($_('dns_stats.toast_please_fix_required_fields_before_saving_this_row'));
      return;
    }
    const id = encodeURIComponent(rowId(row));
    savingId = id;
    try {
      await api.put(`${endpoint}/${id}`, { ...row });
      toasts.success($_('dns_stats.toast_dns_statistics_update_operation_succeeded'));
      editing[rowId(row)] = false;
      editing = { ...editing };
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Update request failed');
    } finally {
      savingId = '';
    }
  }

  async function removeRecord(row: Record<string, string | number | boolean>) {
    const id = encodeURIComponent(rowId(row));
    deletingId = id;
    try {
      await api.del(`${endpoint}/${id}`);
      toasts.success($_('dns_stats.toast_dns_statistics_delete_operation_succeeded'));
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Delete request failed');
    } finally {
      deletingId = '';
    }
  }

  function toggleEdit(id: string) {
    editing[id] = !editing[id];
    editing = { ...editing };
    if (editing[id]) selectedId = id;
  }

  const visibleRecords = $derived.by(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const data = records.filter((row) => {
      if (showOnlyEnabled && !Boolean(row.enabled)) return false;
      if (!normalizedSearch) return true;
      return fields.some((field) => {
        const value = toText(row[field.key]).toLowerCase();
        return value.includes(normalizedSearch);
      });
    });

    const sorted = [...data];
    if (sortMode === 'name-desc') {
      sorted.sort((a, b) => toText(b.name || b.description || b[idKey]).localeCompare(toText(a.name || a.description || a[idKey])));
    } else if (sortMode === 'recent') {
      sorted.reverse();
    } else {
      sorted.sort((a, b) => toText(a.name || a.description || a[idKey]).localeCompare(toText(b.name || b.description || b[idKey])));
    }
    return sorted;
  });

  const totalCount = $derived(records.length);
  const enabledCount = $derived(records.filter((row) => Boolean(row.enabled)).length);
  const disabledCount = $derived(totalCount - enabledCount);

  onMount(() => {
    void loadOptions();
    createForm = buildDefaults();
    void load();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-700 bg-slate-950/80">
    <CardHeader class="space-y-2">
      <CardTitle class="text-cyan-400">{$_('dns_stats.dns_statistics')}</CardTitle>
      <CardDescription class="text-slate-300">
        Manage every resolver analytics profile inline with high-fidelity controls, explicit hints, and validation-aware save actions.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-700 bg-slate-950 p-3">
          <p class="text-xs text-slate-400">{$_('dns_stats.total_records')}</p>
          <p class="text-lg font-semibold text-cyan-400">{totalCount}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950 p-3">
          <p class="text-xs text-slate-400">{$_('dns_stats.enabled_records')}</p>
          <p class="text-lg font-semibold text-emerald-300">{enabledCount}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950 p-3">
          <p class="text-xs text-slate-400">{$_('dns_stats.disabled_records')}</p>
          <p class="text-lg font-semibold text-amber-300">{disabledCount}</p>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-4">
        <div class="md:col-span-2 space-y-2">
          <FieldLabel
            label="Search records"
            hint="Filter records by any field value to isolate operational targets quickly. Example: search by interface, subnet, endpoint, or policy name during incident handling."
          />
          <Input
            class="border-slate-700 bg-slate-950 text-slate-100"
            bind:value={searchText}
            placeholder="Search by any visible value"
          />
        </div>
        <div class="space-y-2">
          <FieldLabel
            label="Sort mode"
            hint="Sort order controls triage flow and reviewer cognition in dense tables. Use recently touched when validating active changes and name ordering for audits."
          />
          <Select.Root type="single" value={sortMode} onValueChange={(value) => { if (value) sortMode = value; }}>
            <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
              <span>{sortModes.find((entry) => entry.value === sortMode)?.label ?? 'Name A-Z'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900">
              {#each sortModes as mode}
                <Select.Item value={mode.value} label={mode.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-2">
          <FieldLabel
            label="Enabled-only filter"
            hint="Toggle this filter to focus on actively enforced records during incident response. Disable it when auditing staged or disabled configuration objects."
          />
          <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
            <Switch checked={showOnlyEnabled} onCheckedChange={(checked) => (showOnlyEnabled = checked)} class="cursor-pointer" />
            <span class="text-sm text-slate-300">{showOnlyEnabled ? 'Enabled only' : 'All records'}</span>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void load()}>
          <RefreshCwIcon class="mr-2 size-4" />
          Refresh data
        </Button>
      </div>

      {#if lastError}
        <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {lastError}
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-700 bg-slate-950/80">
    <CardHeader>
      <CardTitle class="text-cyan-400">{$_('dns_stats.create_resolver_analytics_profile')}</CardTitle>
      <CardDescription class="text-slate-300">
        New records are created inline and immediately visible in the table below for follow-up edits.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        {#each fields.filter((field) => !field.advanced) as field}
          <div class="space-y-2">
            <FieldLabel label={field.label} hint={field.hint} />
            {#if field.kind === 'boolean'}
              <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                <Switch
                  checked={Boolean(createForm[field.key])}
                  onCheckedChange={(checked) => setCreateField(field.key, checked)}
                  class="cursor-pointer"
                />
                <span class="text-sm text-slate-300">{Boolean(createForm[field.key]) ? 'Enabled' : 'Disabled'}</span>
              </div>
            {:else if field.kind === 'select'}
              <Select.Root
                type="single"
                value={toText(createForm[field.key])}
                onValueChange={(value) => { if (value !== undefined) setCreateField(field.key, value); }}
              >
                <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                  <span>{optionForField(field).find((option) => option.value === toText(createForm[field.key]))?.label ?? 'Select value'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  {#each optionForField(field) as option}
                    <Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else}
              <Input
                class="border-slate-700 bg-slate-950 text-slate-100"
                type={field.kind === 'number' ? 'number' : 'text'}
                value={toText(createForm[field.key])}
                oninput={(event) => {
                  const target = event.currentTarget as HTMLInputElement;
                  setCreateField(field.key, field.kind === 'number' ? Number(target.value) : target.value);
                }}
              />
            {/if}
            {#if createErrors[field.key]}
              <p class="text-xs text-red-300">{createErrors[field.key]}</p>
            {/if}
          </div>
        {/each}
      </div>

      <Collapsible.Root bind:open={showAdvancedCreate} class="rounded-md border border-slate-700 bg-slate-950 p-3">
        <Collapsible.Trigger class="flex w-full cursor-pointer items-center justify-between text-left">
          <span class="text-sm font-medium text-cyan-400">Advanced Settings</span>
          <ChevronDownIcon class={`size-4 text-slate-400 transition-transform ${showAdvancedCreate ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content class="pt-4">
          <div class="grid gap-4 md:grid-cols-2">
            {#each fields.filter((field) => field.advanced) as field}
              <div class="space-y-2">
                <FieldLabel label={field.label} hint={field.hint} />
                {#if field.kind === 'boolean'}
                  <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                    <Switch
                      checked={Boolean(createForm[field.key])}
                      onCheckedChange={(checked) => setCreateField(field.key, checked)}
                      class="cursor-pointer"
                    />
                    <span class="text-sm text-slate-300">{Boolean(createForm[field.key]) ? 'Enabled' : 'Disabled'}</span>
                  </div>
                {:else if field.kind === 'select'}
                  <Select.Root
                    type="single"
                    value={toText(createForm[field.key])}
                    onValueChange={(value) => { if (value !== undefined) setCreateField(field.key, value); }}
                  >
                    <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                      <span>{optionForField(field).find((option) => option.value === toText(createForm[field.key]))?.label ?? 'Select value'}</span>
                    </Select.Trigger>
                    <Select.Content class="border-slate-700 bg-slate-900">
                      {#each optionForField(field) as option}
                        <Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                {:else}
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-100"
                    type={field.kind === 'number' ? 'number' : 'text'}
                    value={toText(createForm[field.key])}
                    oninput={(event) => {
                      const target = event.currentTarget as HTMLInputElement;
                      setCreateField(field.key, field.kind === 'number' ? Number(target.value) : target.value);
                    }}
                  />
                {/if}
                {#if createErrors[field.key]}
                  <p class="text-xs text-red-300">{createErrors[field.key]}</p>
                {/if}
              </div>
            {/each}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      <div class="flex flex-wrap gap-2">
        <Button class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700" disabled={creating} onclick={createRecord}>
          <PlusIcon class="mr-2 size-4" />
          {creating ? 'Creating...' : 'Create record'}
        </Button>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-700 bg-slate-950/80">
    <CardHeader>
      <CardTitle class="text-cyan-400">{$_('dns_stats.configured_records')}</CardTitle>
      <CardDescription class="text-slate-300">
        Every row supports inline edits, validation, and direct save/delete actions without context switching.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-400">{$_('dns_stats.loading_records')}</p>
      {:else if visibleRecords.length === 0}
        <p class="text-sm text-slate-400">{$_('dns_stats.no_records_match_the_current_filters')}</p>
      {:else}
        <div class="overflow-x-auto rounded-md border border-slate-700">
          <table class="min-w-full border-collapse text-sm">
            <thead class="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="px-3 py-2">Identifier</th>
                <th class="px-3 py-2">Summary</th>
                <th class="px-3 py-2">State</th>
                <th class="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each visibleRecords as row}
                {@const id = rowId(row)}
                <tr class="border-t border-slate-700 align-top">
                  <td class="px-3 py-2 font-mono text-slate-200">{toText(row[idKey])}</td>
                  <td class="px-3 py-2 text-slate-300">{toText(row.name || row.description || row.interface || row.gateway || row.remoteEndpoint || row.subnet || 'No summary')}</td>
                  <td class="px-3 py-2 text-slate-300">{Boolean(row.enabled) ? 'Enabled' : 'Disabled'}</td>
                  <td class="px-3 py-2">
                    <div class="flex flex-wrap gap-2">
                      <Button variant="outline" class="cursor-pointer border-slate-700 text-slate-200" onclick={() => toggleEdit(id)}>
                        {editing[id] ? 'Hide editor' : 'Edit inline'}
                      </Button>
                      <Button
                        variant="outline"
                        class="cursor-pointer border-red-500/40 text-red-300 hover:bg-red-500/10"
                        disabled={deletingId === encodeURIComponent(id)}
                        onclick={() => void removeRecord(row)}
                      >
                        <Trash2Icon class="mr-2 size-4" />
                        {deletingId === encodeURIComponent(id) ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>
                {#if editing[id]}
                  <tr class="border-t border-slate-700 bg-slate-900/40">
                    <td colspan="4" class="px-3 py-4">
                      <div class="space-y-4">
                        <div class="grid gap-4 md:grid-cols-2">
                          {#each fields.filter((field) => !field.advanced) as field}
                            <div class="space-y-2">
                              <FieldLabel label={field.label} hint={field.hint} />
                              {#if field.kind === 'boolean'}
                                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                                  <Switch
                                    checked={Boolean(row[field.key])}
                                    onCheckedChange={(checked) => setRowField(row, field.key, checked)}
                                    class="cursor-pointer"
                                  />
                                  <span class="text-sm text-slate-300">{Boolean(row[field.key]) ? 'Enabled' : 'Disabled'}</span>
                                </div>
                              {:else if field.kind === 'select'}
                                <Select.Root
                                  type="single"
                                  value={toText(row[field.key])}
                                  onValueChange={(value) => { if (value !== undefined) setRowField(row, field.key, value); }}
                                >
                                  <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                                    <span>{optionForField(field).find((option) => option.value === toText(row[field.key]))?.label ?? 'Select value'}</span>
                                  </Select.Trigger>
                                  <Select.Content class="border-slate-700 bg-slate-900">
                                    {#each optionForField(field) as option}
                                      <Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                                    {/each}
                                  </Select.Content>
                                </Select.Root>
                              {:else}
                                <Input
                                  class="border-slate-700 bg-slate-950 text-slate-100"
                                  type={field.kind === 'number' ? 'number' : 'text'}
                                  value={toText(row[field.key])}
                                  oninput={(event) => {
                                    const target = event.currentTarget as HTMLInputElement;
                                    setRowField(row, field.key, field.kind === 'number' ? Number(target.value) : target.value);
                                  }}
                                />
                              {/if}
                              {#if rowErrors[id]?.[field.key]}
                                <p class="text-xs text-red-300">{rowErrors[id][field.key]}</p>
                              {/if}
                            </div>
                          {/each}
                        </div>

                        <Collapsible.Root open={true} class="rounded-md border border-slate-700 bg-slate-950 p-3">
                          <Collapsible.Trigger class="flex w-full items-center justify-between text-left">
                            <span class="text-sm font-medium text-cyan-400">Advanced Settings</span>
                            <ChevronDownIcon class="size-4 text-slate-400" />
                          </Collapsible.Trigger>
                          <Collapsible.Content class="pt-4">
                            <div class="grid gap-4 md:grid-cols-2">
                              {#each fields.filter((field) => field.advanced) as field}
                                <div class="space-y-2">
                                  <FieldLabel label={field.label} hint={field.hint} />
                                  {#if field.kind === 'boolean'}
                                    <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                                      <Switch
                                        checked={Boolean(row[field.key])}
                                        onCheckedChange={(checked) => setRowField(row, field.key, checked)}
                                        class="cursor-pointer"
                                      />
                                      <span class="text-sm text-slate-300">{Boolean(row[field.key]) ? 'Enabled' : 'Disabled'}</span>
                                    </div>
                                  {:else if field.kind === 'select'}
                                    <Select.Root
                                      type="single"
                                      value={toText(row[field.key])}
                                      onValueChange={(value) => { if (value !== undefined) setRowField(row, field.key, value); }}
                                    >
                                      <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                                        <span>{optionForField(field).find((option) => option.value === toText(row[field.key]))?.label ?? 'Select value'}</span>
                                      </Select.Trigger>
                                      <Select.Content class="border-slate-700 bg-slate-900">
                                        {#each optionForField(field) as option}
                                          <Select.Item value={option.value} label={option.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                                        {/each}
                                      </Select.Content>
                                    </Select.Root>
                                  {:else}
                                    <Input
                                      class="border-slate-700 bg-slate-950 text-slate-100"
                                      type={field.kind === 'number' ? 'number' : 'text'}
                                      value={toText(row[field.key])}
                                      oninput={(event) => {
                                        const target = event.currentTarget as HTMLInputElement;
                                        setRowField(row, field.key, field.kind === 'number' ? Number(target.value) : target.value);
                                      }}
                                    />
                                  {/if}
                                  {#if rowErrors[id]?.[field.key]}
                                    <p class="text-xs text-red-300">{rowErrors[id][field.key]}</p>
                                  {/if}
                                </div>
                              {/each}
                            </div>
                          </Collapsible.Content>
                        </Collapsible.Root>

                        <div class="flex flex-wrap gap-2">
                          <Button
                            class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700"
                            disabled={savingId === encodeURIComponent(id)}
                            onclick={() => void saveRecord(row)}
                          >
                            <SaveIcon class="mr-2 size-4" />
                            {savingId === encodeURIComponent(id) ? 'Saving...' : 'Save row'}
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
