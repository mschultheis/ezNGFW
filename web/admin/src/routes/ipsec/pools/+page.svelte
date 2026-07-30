<!-- Route view for `/ipsec/pools` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import Save from '@lucide/svelte/icons/save';
  import { _ } from '$lib/i18n';

  const endpoint = '/ipsec/pools';

  const columns: TableColumn[] = [
    { key: 'name', label: 'Pool Name' },
    { key: 'base', label: 'Base Address', mono: true },
    { key: 'size', label: 'Size' },
    { key: 'enabled', label: 'Enabled' }
  ];

  const fields: FormField[] = [
    { key: 'name', label: 'Pool Name', type: 'text', required: true, hint: 'Unique name for this IPsec address pool.' },
    { key: 'base', label: 'Base Address', type: 'text', required: true, hint: 'Starting IP address for the pool.' },
    { key: 'size', label: 'Pool Size', type: 'number', required: true, hint: 'Number of addresses in the pool.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Enable this pool for assignment.' }
  ];

  let settings = $state<Record<string, any>>({});
  let loading = $state(true);
  let saving = $state(false);
  let showAdvanced = $state(false);

  async function loadSettings() {
    try {
      const payload = await api.get('/ipsec/pools/settings');
      settings = typeof payload === 'object' && payload !== null ? (payload as Record<string, any>) : {};
    } catch {
      toasts.error($_('ipsec_pools.toastfailed_to_load_ipsec_pool_settings'));
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.put('/ipsec/pools/settings', settings);
      toasts.success($_('ipsec_pools.toastsettings_saved'));
    } catch {
      toasts.error($_('ipsec_pools.toastfailed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    void loadSettings();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('ipsec_pools.ipsec_pool_settings')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('ipsec_pools.global_configuration_for_ipsec_address_allocation')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <div class="space-y-0.5">
            <FieldLabel label="Auto Apply" hint="Apply changes immediately." />
            <span class="text-xs text-slate-400">{settings.autoApply ? 'Enabled' : 'Disabled'}</span>
          </div>
          <Switch checked={!!settings.autoApply} onCheckedChange={(v: boolean) => settings.autoApply = v} />
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Default Scope" hint="Default targeting context." />
          <Select.Root type="single" value={String(settings.defaultScope ?? 'global')} onValueChange={(v: string) => settings.defaultScope = v}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{settings.defaultScope ?? 'global'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              <Select.Item value="global" label="Global" />
              <Select.Item value="site" label="Site" />
            </Select.Content>
          </Select.Root>
        </div>
      </div>
      <div class="flex justify-end">
        <Button class="bg-cyan-600 text-white" onclick={saveSettings} disabled={saving}>
          <Save class="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </CardContent>
  </Card>

  <ResourceTable
    title={$_('ipsec_pools.titleipsec_address_pools')}
    description={$_('ipsec_pools.descriptionmanage_virtual_address_pools_for_ipsec')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('ipsec_pools.addlabeladd_ipsec_pool')}
  />
</div>
