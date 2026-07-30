<!-- Route view for `/dns/aliases` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  import { _ } from '$lib/i18n';
  const endpoint = '/dns/aliases';
  const settingsEndpoint = '/dns/aliases/settings';

  const columns: TableColumn[] = [
    { key: 'hostname', label: 'Alias Hostname' },
    { key: 'domain', label: 'Alias Domain' },
    { key: 'target_hostname', label: 'Target Hostname' },
    { key: 'target_domain', label: 'Target Domain' },
    { key: 'description', label: 'Description' },
    { key: 'updatedAt', label: 'Updated' }
  ];

  const fields: FormField[] = [
    { key: 'hostname', label: 'Alias Hostname', type: 'text', required: true, placeholder: 'www', hint: 'The alias hostname that will point to an existing host override.' },
    { key: 'domain', label: 'Alias Domain', type: 'text', required: true, placeholder: 'example.com', hint: 'The domain for this alias.' },
    { key: 'target_hostname', label: 'Target Hostname', type: 'text', required: true, placeholder: 'server1', hint: 'The hostname of the existing host override this alias points to.' },
    { key: 'target_domain', label: 'Target Domain', type: 'text', required: true, placeholder: 'example.com', hint: 'The domain of the target host override.' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Web server alias', hint: 'Free-form description explaining the purpose of this alias.' },
  ];

  let settings = $state<Record<string, any>>({});
  let loading = $state(true);
  let saving = $state(false);
  let showSettingsAdvanced = $state(false);
  let secondaryData = $state<Record<string, any[]>>({});

  async function loadSettings() {
    try {
      const payload = await api.get(settingsEndpoint);
      settings = typeof payload === 'object' && payload !== null ? payload : {};
    } catch {
      toasts.error($_('dns_aliases.toast_failed_to_load_settings'));
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.put(settingsEndpoint, settings);
      toasts.success($_('dns_aliases.toast_settings_saved'));
    } catch {
      toasts.error($_('dns_aliases.toast_failed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  async function loadSecondary() {
    try {
      const payload = await api.get('/dns/hosts');
      secondaryData['/dns/hosts'] = Array.isArray(payload) ? payload : [];
    } catch {
      secondaryData['/dns/hosts'] = [];
    }
  }

  onMount(async () => {
    loading = true;
    await Promise.all([loadSettings(), loadSecondary()]);
    loading = false;
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-925 to-slate-950 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('dns_aliases.dns_alias_settings')}</CardTitle>
          <CardDescription class="text-slate-400">Configure global behavior for DNS alias overrides.</CardDescription>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={loadSettings} disabled={loading || saving}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={saving}>
            <Save class="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <div class="py-8 text-center text-slate-400">Loading settings...</div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Auto Apply" hint="Automatically apply changes after save." />
            <div class="mt-2 flex items-center justify-between">
              <span class="text-xs text-slate-400">{settings.autoApply ? 'Enabled' : 'Disabled'}</span>
              <Switch checked={!!settings.autoApply} onCheckedChange={(v) => settings.autoApply = v} />
            </div>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Default Scope" hint="Default targeting context for new records." />
            <Select.Root type="single" value={String(settings.defaultScope ?? 'global')} onValueChange={(v) => settings.defaultScope = v}>
              <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                <span>{settings.defaultScope ?? 'global'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                <Select.Item value="global" label="Global" />
                <Select.Item value="interface" label="Per Interface" />
                <Select.Item value="pool" label="Per Pool" />
              </Select.Content>
            </Select.Root>
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Strict Validation" hint="Enforce strict parser checks." />
            <div class="mt-2 flex items-center justify-between">
              <span class="text-xs text-slate-400">{settings.validateStrict ? 'Enabled' : 'Disabled'}</span>
              <Switch checked={!!settings.validateStrict} onCheckedChange={(v) => settings.validateStrict = v} />
            </div>
          </div>
        </div>

        <Collapsible.Root bind:open={showSettingsAdvanced} class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <Collapsible.Trigger class="flex w-full items-center justify-between">
            <span class="text-sm font-medium text-slate-200">{$_('dns_aliases.advanced_settings')}</span>
            <ChevronDown class={`h-4 w-4 transition-transform ${showSettingsAdvanced ? 'rotate-180' : ''}`} />
          </Collapsible.Trigger>
          <Collapsible.Content class="grid gap-4 pt-4 md:grid-cols-2">
            <div class="space-y-2">
              <FieldLabel label="Refresh Interval" hint="Auto refresh interval in seconds." />
              <Input type="number" class="border-slate-700 bg-slate-950 text-slate-100" bind:value={settings.refreshSeconds} />
            </div>
            <div class="space-y-2">
              <FieldLabel label="Max Payload Size" hint="Hard upper bound for payload data." />
              <Input type="number" class="border-slate-700 bg-slate-950 text-slate-100" bind:value={settings.maxPayloadSize} />
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      {/if}
    </CardContent>
  </Card>

  <ResourceTable
    title="{$_('dns_aliases.dns_alias_overrides')}"
    description={$_('dns_aliases.descriptionmap_aliases_to_canonical_records_with_s')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    addLabel={$_('dns_aliases.addlabeladd_dns_alias')}
  />

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-slate-100">{$_('dns_aliases.host_overrides')}</CardTitle>
          <CardDescription class="text-slate-400">Reference host overrides for alias targets.</CardDescription>
        </div>
        <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={loadSecondary}>
          <RefreshCw class="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th class="px-3 py-2 text-left">Hostname</th>
              <th class="px-3 py-2 text-left">Domain</th>
              <th class="px-3 py-2 text-left">IP Address</th>
              <th class="px-3 py-2 text-left">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {#each secondaryData['/dns/hosts'] ?? [] as row}
              <tr class="border-t border-slate-800/80 text-slate-200">
                <td class="px-3 py-2">{row.hostname}</td>
                <td class="px-3 py-2">{row.domain}</td>
                <td class="px-3 py-2">{row.ipAddress}</td>
                <td class="px-3 py-2">{row.enabled ? 'Yes' : 'No'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</div>
