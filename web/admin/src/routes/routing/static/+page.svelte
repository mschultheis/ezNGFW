<!-- Route view for `/routing/static` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import { asList } from '$lib/utils/api-data';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';
  import Play from '@lucide/svelte/icons/play';
  import { _ } from '$lib/i18n';

  const endpoint = '/routing/static';
  const settingsEndpoint = '/routing/static/settings';
  const actionEndpoint = '/routing/static/validate';

  const columns: TableColumn[] = [
    { key: 'destination', label: 'Destination' },
    { key: 'gateway', label: 'Gateway' },
    { key: 'interface', label: 'Interface' },
    { key: 'metric', label: 'Metric' },
    { key: 'description', label: 'Description' },
    { key: 'enabled', label: 'Enabled' }
  ];

  let interfaceOptions = $state<{ label: string; value: string }[]>([]);
  let gatewayOptions = $state<{ label: string; value: string }[]>([]);
  let settings = $state<Record<string, any>>({});
  let actionDraft = $state<Record<string, any>>({});
  let actionResults = $state<Record<string, any>[]>([]);
  let actionOutput = $state('');
  let secondaryData = $state<Record<string, any[]>>({});
  let recordsCount = $state(0);
  
  let loading = $state(true);
  let saving = $state(false);
  let runningAction = $state(false);
  let showAdvanced = $state(false);

  const fields = $derived.by((): FormField[] => [
    { key: 'destination', label: 'Destination Network', type: 'text', required: true, hint: 'The destination network in CIDR notation (e.g., 192.168.100.0/24).' },
    { key: 'gateway', label: 'Gateway', type: 'select', options: gatewayOptions, required: true, hint: 'The next-hop IP address for this route.' },
    { key: 'interface', label: 'Interface', type: 'select', options: [{ label: 'Auto', value: '' }, ...interfaceOptions], hint: 'Optional: Bind this route to a specific interface.' },
    { key: 'metric', label: 'Metric', type: 'number', hint: 'Optional: The routing metric (priority) for this route.' },
    { key: 'description', label: 'Description', type: 'text', hint: 'A brief description of this static route.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Whether this static route is currently active.' }
  ]);

  const settingsFields = [
    { key: 'autoRefresh', label: 'Auto Refresh Routes', kind: 'boolean', hint: 'Auto Refresh Routes controls how this workflow behaves in production and during troubleshooting.' },
    { key: 'refreshSeconds', label: 'Refresh Interval Seconds', kind: 'number', hint: 'Refresh Interval Seconds controls how this workflow behaves in production and during troubleshooting.' },
    { key: 'defaultMetric', label: 'Default Metric', kind: 'number', hint: 'Default Metric controls how this workflow behaves in production and during troubleshooting.' },
    { key: 'strictGatewayCheck', label: 'Strict Gateway Reachability', kind: 'boolean', hint: 'Strict Gateway Reachability controls how this workflow behaves in production and during troubleshooting.' },
    { key: 'warnOnOverlap', label: 'Warn on Overlap', kind: 'boolean', hint: 'Warn on Overlap controls how this workflow behaves in production and during troubleshooting.' },
    { key: 'autoApply', label: 'Auto Apply After Save', kind: 'boolean', hint: 'Auto Apply After Save controls how this workflow behaves in production and during troubleshooting.' }
  ];

  const actionFields = $derived.by(() => [
    { key: 'destination', label: 'Destination Network', kind: 'text', hint: 'Validate destination network before adding branch route aggregates.' },
    { key: 'gateway', label: 'Gateway', kind: 'select', options: gatewayOptions, hint: 'Test selected next hop reachability before enabling route.' },
    { key: 'interface', label: 'Interface', kind: 'select', options: [{ label: 'Auto', value: '' }, ...interfaceOptions], hint: 'Force interface checks when policy-routing affects egress decisions.' },
    { key: 'metric', label: 'Metric', kind: 'number', hint: 'Validate backup metrics remain higher than primary to avoid path flapping.' },
    { key: 'checkOverlap', label: 'Check Overlap', kind: 'boolean', hint: 'Run overlap detection when introducing summary routes.' },
    { key: 'checkGatewayLatency', label: 'Check Gateway Latency', kind: 'boolean', hint: 'Confirm next-hop latency is acceptable before activation.' }
  ]);

  const secondaryTables = [
    { endpoint: '/routing/table', title: 'Kernel Routing Table', description: 'Effective kernel routes including gateway, metric, interface, and protocol values.', columns: ['destination', 'gateway', 'metric', 'interface', 'protocol', 'scope'] },
    { endpoint: '/routing/gateways', title: 'Gateway Status', description: 'Gateway monitor health used to validate static route viability and failover behavior.', columns: ['name', 'gateway', 'status', 'loss', 'delay'] }
  ];

  async function loadAuxiliary() {
    try {
      const [ifaces, gways, routes] = await Promise.all([
        api.get('/interfaces').catch(() => []),
        api.get('/routing/gateways').catch(() => []),
        api.get(endpoint).catch(() => [])
      ]);
      
      interfaceOptions = asList(ifaces).map(row => {
        const r = row as any;
        const val = String(r.name ?? r.id ?? r.interface ?? '');
        return { label: r.device ? `${val} (${r.device})` : val, value: val };
      }).filter(o => o.value);

      gatewayOptions = asList(gways).map(row => {
        const r = row as any;
        const val = String(r.name ?? r.gateway ?? r.id ?? '');
        return { label: val, value: val };
      }).filter(o => o.value);

      recordsCount = asList(routes).length;
    } catch (e) {
      console.error('Failed to load auxiliary data', e);
    }
  }

  async function loadSettings() {
    try {
      const data = await api.get<any>(settingsEndpoint);
      settings = data || {};
    } catch {
      toasts.error($_('routing_static.toastfailed_to_load_settings'));
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.put(settingsEndpoint, settings);
      toasts.success($_('routing_static.toastsettings_saved'));
    } catch {
      toasts.error($_('routing_static.toastfailed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  async function runValidation() {
    runningAction = true;
    actionOutput = 'Running validation...';
    try {
      const response = await api.post<any>(actionEndpoint, actionDraft);
      actionResults = asList(response.results ?? response.hops ?? response.rows ?? response);
      actionOutput = response.output ?? response.summary ?? JSON.stringify(response, null, 2);
      toasts.success($_('routing_static.toastvalidation_completed'));
      await loadSecondary();
    } catch {
      toasts.error($_('routing_static.toastvalidation_failed'));
      actionOutput = 'Validation request failed.';
    } finally {
      runningAction = false;
    }
  }

  async function loadSecondary() {
    const next: Record<string, any[]> = {};
    await Promise.all(secondaryTables.map(async (t) => {
      try {
        const data = await api.get(t.endpoint);
        next[t.endpoint] = asList(data);
      } catch {
        next[t.endpoint] = [];
      }
    }));
    secondaryData = next;
  }

  async function loadAll() {
    loading = true;
    await loadAuxiliary();
    await Promise.all([loadSettings(), loadSecondary()]);
    loading = false;
  }

  onMount(() => {
    void loadAll();
  });

  const summaryCards = $derived([
    { label: 'Total Routes', value: String(recordsCount) },
    { label: 'Action Results', value: String(actionResults.length) },
    { label: 'Route Tables', value: String(secondaryTables.length + 2) }
  ]);
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('routing_static.static_route_settings')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('routing_static.configure_global_behavior_for_static_routing_inclu')}</CardDescription>
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
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each summaryCards as stat}
          <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
            <p class="text-xs uppercase tracking-wide text-slate-400">{stat.label}</p>
            <p class="mt-1 text-xl font-semibold text-cyan-300">{stat.value}</p>
          </div>
        {/each}
      </div>

      {#if loading}
        <div class="rounded-md border border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">Loading settings...</div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each settingsFields as field}
            <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <FieldLabel label={field.label} hint={field.hint} />
              {#if field.kind === 'boolean'}
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-xs text-slate-400">{settings[field.key] ? 'Enabled' : 'Disabled'}</span>
                  <Switch checked={Boolean(settings[field.key])} onCheckedChange={(checked) => (settings[field.key] = checked)} />
                </div>
              {:else}
                <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type={field.kind === "number" ? "number" : "text"} value={settings[field.key] ?? ""} oninput={(e) => (settings[field.key] = field.kind === "number" ? Number(e.currentTarget.value) : e.currentTarget.value)} />
              {/if}
            </div>
          {/each}
        </div>

        <Collapsible.Root bind:open={showAdvanced} class="pt-1">
          <Collapsible.Trigger class="flex items-center gap-2">
            <span class="font-medium text-slate-200">{$_('routing_static.advanced_operational_behavior')}</span>
            <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </Collapsible.Trigger>
          <Collapsible.Content>
            <p class="mt-2 text-sm leading-6 text-slate-300">
              Advanced settings tune polling cadence, strict validation behavior, and fail-safe defaults. In production,
              stage major changes by disabling new records first, then save and verify live telemetry before enabling.
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
          <CardTitle class="text-slate-100">{$_('routing_static.static_route_validation')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('routing_static.run_route_checks_against_gateway_reachability_and')}</CardDescription>
        </div>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={runValidation} disabled={runningAction || loading}>
          <Play class="mr-2 h-4 w-4" /> {runningAction ? 'Running...' : 'Validate Routes'}
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
              <Select.Root type="single" value={String(actionDraft[field.key] ?? '')} onValueChange={(v) => (actionDraft[field.key] = v)}>
                <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{field.options?.find(o => o.value === actionDraft[field.key])?.label ?? 'Select value'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each field.options || [] as option}
                    <Select.Item value={option.value} label={option.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else}
              <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type={field.kind === 'number' ? 'number' : 'text'} value={actionDraft[field.key] ?? ''} oninput={(e) => (actionDraft[field.key] = field.kind === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)} />
            {/if}
          </div>
        {/each}
      </div>

      <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <p class="mb-2 text-xs uppercase tracking-wide text-slate-400">{$_('routing_static.live_output')}</p>
        <pre class="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{actionOutput || 'No output yet.'}</pre>
      </div>

      {#if actionResults.length > 0}
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {#each Object.keys(actionResults[0]) as key}
                  <th class="px-3 py-2 text-left">{key}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each actionResults as result}
                <tr class="border-t border-slate-800/80 text-slate-200">
                  {#each Object.keys(actionResults[0]) as key}
                    <td class="px-3 py-2 text-xs">{String(result[key] ?? '-')}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </CardContent>
  </Card>

  <ResourceTable
    title={$_('routing_static.titlestatic_routes')}
    description={$_('routing_static.descriptiondefine_destinationtogateway_paths_with')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    addLabel={$_('routing_static.addlabeladd_static_route')}
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
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No data available.</td></tr>
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
