<!-- Route view for `/dns/hosts` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import { asList, asObject, asString } from '$lib/utils/api-data';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';

  import { _ } from '$lib/i18n';
  const settingsEndpoint = '/dns/hosts/settings';
  const rowsEndpoint = '/dns/overrides';

  const columns: TableColumn[] = [
    { key: 'hostname', label: 'Hostname' },
    { key: 'domain', label: 'Domain' },
    { key: 'ip_address', label: 'IP Address' },
    { key: 'ipv6_address', label: 'IPv6 Address' },
    { key: 'description', label: 'Description' },
    { key: 'updatedAt', label: 'Updated' }
  ];

  const fields: FormField[] = [
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Activate or park this override.' },
    { key: 'hostname', label: 'Hostname', type: 'text', required: true, placeholder: 'server1', hint: 'The hostname portion of the DNS override.' },
    { key: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'example.com', hint: 'The domain this host belongs to.' },
    { key: 'ip_address', label: 'IP Address', type: 'text', required: true, placeholder: '192.168.1.100', hint: 'The IPv4 address this hostname resolves to.' },
    { key: 'ipv6_address', label: 'IPv6 Address', type: 'text', placeholder: 'fd00::100', hint: 'Optional IPv6 address (AAAA record).' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Internal web server', hint: 'Free-form description for documentation purposes.' }
  ];

  const settingsFields = [
    { key: 'autoApply', label: 'Auto Apply on Save', kind: 'boolean', hint: 'Automatically applies changes after each save.' },
    { key: 'defaultScope', label: 'Default Scope', kind: 'select', options: [{ value: 'global', label: 'Global' }, { value: 'interface', label: 'Per Interface' }, { value: 'pool', label: 'Per Pool' }, { value: 'reservation', label: 'Per Reservation' }], hint: 'Defines the default targeting context used for new records.' },
    { key: 'validateStrict', label: 'Strict Value Validation', kind: 'boolean', hint: 'Enforces strict parser checks before writes reach the backend API.' },
    { key: 'conflictMode', label: 'Duplicate Conflict Policy', kind: 'select', options: [{ value: 'reject', label: 'Reject duplicates' }, { value: 'override', label: 'Newest wins' }, { value: 'merge', label: 'Merge by scope' }], hint: 'Determines what happens when overlapping records are detected.' },
    { key: 'requireDescription', label: 'Require Change Description', kind: 'boolean', hint: 'Requires operators to document intent when changing records.' },
    { key: 'logDeliveries', label: 'Log Delivery Events', kind: 'boolean', hint: 'Adds enriched logging for when data from this page is delivered at runtime.' },
    { key: 'maxPayloadSize', label: 'Maximum Payload Size (bytes)', kind: 'number', min: 64, max: 65535, hint: 'Hard upper bound for payload data accepted in a single record.' },
    { key: 'refreshSeconds', label: 'Auto Refresh Interval (seconds)', kind: 'number', min: 5, max: 900, hint: 'Polling interval for table and status panels in this page.' },
    { key: 'autoRefresh', label: 'Enable Auto Refresh', kind: 'boolean', hint: 'Continuously refreshes row and status datasets using the selected interval.' },
    { key: 'retentionDays', label: 'Audit Retention (days)', kind: 'number', min: 1, max: 365, advanced: true, hint: 'Retains metadata history for this feature area.' },
    { key: 'defaultPriority', label: 'Default Priority', kind: 'number', min: 1, max: 1000, advanced: true, hint: 'Baseline priority assigned to newly created records.' },
    { key: 'maintenanceWindow', label: 'Preferred Maintenance Window', kind: 'text', advanced: true, placeholder: 'Sun 02:00-04:00', hint: 'Operational hint describing when bulk edits should be applied.' },
    { key: 'operatorContact', label: 'Primary Operator Contact', kind: 'text', advanced: true, placeholder: 'noc@example.org', hint: 'Contact destination for escalations specific to this page domain.' },
    { key: 'changeTicketPrefix', label: 'Change Ticket Prefix', kind: 'text', advanced: true, placeholder: 'NET-CHG', hint: 'Optional prefix used when linking edits to formal change records.' }
  ];

  const secondaryTables = [
    {
      endpoint: "/dns/aliases",
      title: "Alias References",
      description: "Aliases that point at host override records and should be validated after edits.",
      columns: ["hostname", "domain", "targetHostname", "enabled"]
    }
  ];

  let settings = $state<Record<string, any>>({});
  let loading = $state(true);
  let saving = $state(false);
  let showSettingsAdvanced = $state(false);
  let secondaryData = $state<Record<string, any[]>>({});

  const basicSettingsFields = settingsFields.filter(f => !f.advanced);
  const advancedSettingsFields = settingsFields.filter(f => f.advanced);

  const settingsErrors = $derived.by(() => {
    const errors: Record<string, string> = {};
    const refreshSeconds = Number(settings.refreshSeconds ?? 0);
    if (refreshSeconds < 5 || refreshSeconds > 900) errors.refreshSeconds = 'Refresh interval must be between 5 and 900 seconds.';
    const maxPayloadSize = Number(settings.maxPayloadSize ?? 0);
    if (maxPayloadSize < 64 || maxPayloadSize > 65535) errors.maxPayloadSize = 'Maximum payload size must be between 64 and 65535 bytes.';
    return errors;
  });

  const canSaveSettings = $derived(Object.keys(settingsErrors).length === 0 && !saving);

  async function loadSettings() {
    try {
      const payload = await api.get(settingsEndpoint);
      settings = asObject(payload);
    } catch {
      toasts.error($_('dns_hosts.toast_failed_to_load_settings'));
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.put(settingsEndpoint, settings);
      toasts.success($_('dns_hosts.toast_settings_saved'));
    } catch {
      toasts.error($_('dns_hosts.toast_failed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  async function loadSecondary() {
    for (const section of secondaryTables) {
      try {
        const payload = await api.get(section.endpoint);
        secondaryData[section.endpoint] = asList(payload);
      } catch {
        secondaryData[section.endpoint] = [];
      }
    }
  }

  async function loadAll() {
    loading = true;
    await Promise.all([loadSettings(), loadSecondary()]);
    loading = false;
  }

  onMount(() => {
    void loadAll();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-925 to-slate-950 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('dns_hosts.dns_host_overrides')}</CardTitle>
          <CardDescription class="text-slate-400">
            Maintain host-level resolver overrides with advanced metadata and resilient inline CRUD controls.
          </CardDescription>
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
      {#if loading}
        <div class="py-8 text-center text-sm text-slate-400">Loading settings...</div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each basicSettingsFields as field}
            <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <FieldLabel label={field.label} hint={field.hint} />
              {#if field.kind === 'boolean'}
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-xs text-slate-400">{settings[field.key] ? 'Enabled' : 'Disabled'}</span>
                  <Switch checked={!!settings[field.key]} onCheckedChange={(v) => settings[field.key] = v} />
                </div>
              {:else if field.kind === 'select'}
                <Select.Root type="single" value={asString(settings[field.key])} onValueChange={(v) => settings[field.key] = v}>
                  <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                    <span>{field.options?.find(o => o.value === asString(settings[field.key]))?.label ?? 'Select...'}</span>
                  </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each field.options ?? [] as opt}
                      <Select.Item value={opt.value} label={opt.label} />
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else}
                <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type={field.kind === 'number' ? 'number' : 'text'} value={settings[field.key]} oninput={(e) => settings[field.key] = field.kind === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value} />
              {/if}
              {#if settingsErrors[field.key]}<p class="mt-1 text-xs text-red-400">{settingsErrors[field.key]}</p>{/if}
            </div>
          {/each}
        </div>
        <Collapsible.Root bind:open={showSettingsAdvanced} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <Collapsible.Trigger class="flex w-full items-center justify-between">
            <span class="text-sm font-medium text-slate-200">{$_('dns_hosts.advanced_settings')}</span>
            <ChevronDown class="h-4 w-4 transition-transform {showSettingsAdvanced ? 'rotate-180' : ''}" />
          </Collapsible.Trigger>
          <Collapsible.Content class="grid gap-4 pt-4 md:grid-cols-2">
            {#each advancedSettingsFields as field}
              <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                <FieldLabel label={field.label} hint={field.hint} />
                {#if field.kind === 'boolean'}
                  <div class="mt-2 flex items-center justify-between">
                    <span class="text-xs text-slate-400">{settings[field.key] ? 'Enabled' : 'Disabled'}</span>
                    <Switch checked={!!settings[field.key]} onCheckedChange={(v) => settings[field.key] = v} />
                  </div>
                {:else}
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type={field.kind === 'number' ? 'number' : 'text'} value={settings[field.key]} oninput={(e) => settings[field.key] = field.kind === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value} />
                {/if}
              </div>
            {/each}
          </Collapsible.Content>
        </Collapsible.Root>
      {/if}
    </CardContent>
  </Card>

  <ResourceTable
    title="{$_('dns_hosts.dns_host_overrides')}"
    description={$_('dns_hosts.descriptionbuild_review_and_edit_records_without_m')}
    endpoint={rowsEndpoint}
    columns={columns}
    fields={fields}
    addLabel={$_('dns_hosts.addlabeladd_dns_host_override')}
  />

  {#each secondaryTables as section}
    <Card class="border-slate-800 bg-slate-900/70">
      <CardHeader>
        <div class="flex items-center justify-between">
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
            <thead class="bg-slate-950/70 text-xs uppercase text-slate-400">
              <tr>
                {#each section.columns as col}
                  <th class="px-3 py-2 text-left">{col}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each secondaryData[section.endpoint] ?? [] as row}
                <tr class="border-t border-slate-800 text-slate-200">
                  {#each section.columns as col}
                    <td class="px-3 py-2">{asString(row[col])}</td>
                  {/each}
                </tr>
              {/each}
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr><td colspan={section.columns.length} class="py-6 text-center text-slate-500">No data found.</td></tr>
              {/if}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  {/each}
</div>
