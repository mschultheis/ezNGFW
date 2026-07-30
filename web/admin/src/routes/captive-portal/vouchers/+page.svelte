<!-- Route view for `/captive-portal/vouchers` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn, SelectOption } from '$lib/types/admin';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { toasts } from '$lib/stores/toast';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Save from '@lucide/svelte/icons/save';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { _ } from '$lib/i18n';

  const endpoint = '/captive-portal/vouchers/groups';

  const columns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'scope', label: 'Scope' },
    { key: 'target', label: 'Target' },
    { key: 'priority', label: 'Priority' },
    { key: 'category', label: 'Category' },
    { key: 'enabled', label: 'Status' },
    { key: 'owner', label: 'Owner' }
  ];

  const scopeOptions = [
    { value: 'global', label: 'Global' },
    { value: 'site', label: 'Site' },
    { value: 'segment', label: 'Segment' },
    { value: 'host', label: 'Host' }
  ];

  const categoryOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'standard', label: 'Standard' },
    { value: 'experimental', label: 'Experimental' }
  ];

  const fields: FormField[] = [
    { key: 'name', label: 'Profile Name', type: 'text', required: true, hint: 'Human-readable identifier for this managed record.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Controls whether this profile actively participates in runtime behavior.' },
    { key: 'priority', label: 'Priority', type: 'number', required: true, hint: 'Relative precedence used when multiple profiles overlap.' },
    { key: 'scope', label: 'Scope', type: 'select', options: scopeOptions, required: true, hint: 'Scope narrows where this record applies.' },
    { key: 'target', label: 'Target', type: 'text', required: true, hint: 'Primary target entity for this profile.' },
    { key: 'category', label: 'Category', type: 'select', options: categoryOptions, hint: 'Category groups similar records for filtering.' },
    { key: 'maxRetries', label: 'Max Retries', type: 'number', hint: 'Maximum retry attempts before failure.' },
    { key: 'timeoutMs', label: 'Timeout Milliseconds', type: 'number', hint: 'Operation timeout used by downstream checks.' },
    { key: 'burstLimit', label: 'Burst Limit', type: 'number', hint: 'Temporary burst allowance before steady-state limits apply.' },
    { key: 'windowSeconds', label: 'Window Seconds', type: 'number', hint: 'Observation window used for rate evaluations.' },
    { key: 'owner', label: 'Owner', type: 'text', hint: 'Primary operational owner for this record.' },
    { key: 'ticket', label: 'Change Ticket', type: 'text', hint: 'Reference to the change or incident ticket.' },
    { key: 'tags', label: 'Tags', type: 'text', hint: 'Comma-separated tags for search and grouping.' },
    { key: 'description', label: 'Description', type: 'textarea', hint: 'Extended operator notes describing intent.' }
  ];

  let settings = $state<Record<string, any>>({});
  let secondaryData = $state<Record<string, any[]>>({});
  let showSettings = $state(false);
  let savingSettings = $state(false);

  async function loadSettings() {
    try {
      const payload = await api.get('/captive-portal/vouchers/settings');
      settings = typeof payload === 'object' && payload !== null ? (payload as Record<string, any>) : {};
    } catch {
      toasts.error($_('captive_portal_vouchers.toastfailed_to_load_settings'));
    }
  }

  async function saveSettings() {
    savingSettings = true;
    try {
      await api.put('/captive-portal/vouchers/settings', settings);
      toasts.success($_('captive_portal_vouchers.toastsettings_saved'));
    } catch {
      toasts.error($_('captive_portal_vouchers.toastfailed_to_save_settings'));
    } finally {
      savingSettings = false;
    }
  }

  async function loadSecondary() {
    const endpoints = ['/captive-portal/vouchers', '/captive-portal/vouchers/audit'];
    for (const ep of endpoints) {
      try {
        const payload = await api.get(ep);
        secondaryData[ep] = Array.isArray(payload) ? payload : [];
      } catch {
        secondaryData[ep] = [];
      }
    }
  }

  onMount(() => {
    void loadSettings();
    void loadSecondary();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-slate-100">{$_('captive_portal_vouchers.voucher_settings')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('captive_portal_vouchers.configure_global_voucher_behavior_and_page_operati')}</CardDescription>
        </div>
        <Button variant="outline" class="border-slate-700 text-slate-300" onclick={() => (showSettings = !showSettings)}>
          <ChevronDown class="h-4 w-4 transition-transform {showSettings ? 'rotate-180' : ''}" />
        </Button>
      </div>
    </CardHeader>
    {#if showSettings}
      <CardContent class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div class="space-y-2">
            <label for="voucher-autorefresh" class="text-xs font-medium text-slate-400">Auto Refresh</label>
            <div class="flex items-center gap-2">
              <Switch id="voucher-autorefresh" checked={Boolean(settings.autoRefresh)} onCheckedChange={(v) => (settings.autoRefresh = v)} />
              <span class="text-xs text-slate-300">{settings.autoRefresh ? 'On' : 'Off'}</span>
            </div>
          </div>
          <div class="space-y-2">
            <label for="voucher-interval" class="text-xs font-medium text-slate-400">Refresh Interval (s)</label>
            <Input id="voucher-interval" type="number" class="border-slate-700 bg-slate-950 text-slate-100" bind:value={settings.refreshSeconds} />
          </div>
          <div class="space-y-2">
            <label for="voucher-strict" class="text-xs font-medium text-slate-400">Strict Validation</label>
            <div class="flex items-center gap-2">
              <Switch id="voucher-strict" checked={Boolean(settings.strictValidation)} onCheckedChange={(v) => (settings.strictValidation = v)} />
              <span class="text-xs text-slate-300">{settings.strictValidation ? 'On' : 'Off'}</span>
            </div>
          </div>
          <div class="space-y-2">
            <label for="voucher-maintenance" class="text-xs font-medium text-slate-400">Maintenance Mode</label>
            <div class="flex items-center gap-2">
              <Switch id="voucher-maintenance" checked={Boolean(settings.maintenanceMode)} onCheckedChange={(v) => (settings.maintenanceMode = v)} />
              <span class="text-xs text-slate-300">{settings.maintenanceMode ? 'On' : 'Off'}</span>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300" onclick={loadSettings}><RefreshCw class="mr-2 h-4 w-4" /> Reset</Button>
          <Button class="bg-cyan-600 text-white" onclick={saveSettings} disabled={savingSettings}><Save class="mr-2 h-4 w-4" /> {savingSettings ? 'Saving...' : 'Save Settings'}</Button>
        </div>
      </CardContent>
    {/if}
  </Card>

  <ResourceTable
    title={$_('captive_portal_vouchers.titlevoucher_groups')}
    description={$_('captive_portal_vouchers.descriptiondesign_voucher_policies_enforce_limits')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('captive_portal_vouchers.addlabeladd_voucher_group')}
  />

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader><CardTitle class="text-slate-100">{$_('captive_portal_vouchers.voucher_audit_trail')}</CardTitle></CardHeader>
    <CardContent>
      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th class="px-3 py-2 text-left">Timestamp</th>
              <th class="px-3 py-2 text-left">Group</th>
              <th class="px-3 py-2 text-left">Code</th>
              <th class="px-3 py-2 text-left">Event</th>
              <th class="px-3 py-2 text-left">Operator</th>
            </tr>
          </thead>
          <tbody>
            {#each secondaryData['/captive-portal/vouchers/audit'] ?? [] as row}
              <tr class="border-t border-slate-800 text-slate-300">
                <td class="px-3 py-2">{row.timestamp}</td>
                <td class="px-3 py-2">{row.group}</td>
                <td class="px-3 py-2 font-mono">{row.code}</td>
                <td class="px-3 py-2">{row.event}</td>
                <td class="px-3 py-2">{row.operator}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</div>
