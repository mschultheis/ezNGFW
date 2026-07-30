<!-- Route view for `/automation/ansible` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { _ } from '$lib/i18n';

  type AnsibleConfig = {
    enabled: boolean;
    api_access: boolean;
    inventory_export_enabled: boolean;
    inventory_format: string;
    fact_caching: boolean;
    fact_cache_timeout_sec: number;
    allowed_modules: string[];
    callback_url: string;
    description: string;
  };

  const defaults: AnsibleConfig = {
    enabled: false,
    api_access: true,
    inventory_export_enabled: true,
    inventory_format: 'yaml',
    fact_caching: false,
    fact_cache_timeout_sec: 300,
    allowed_modules: [],
    callback_url: '',
    description: ''
  };

  let cfg = $state<AnsibleConfig>({ ...defaults });
  let inventory = $state<Record<string, unknown> | null>(null);
  let loading = $state(true);
  let saving = $state(false);

  async function load() {
    loading = true;
    try {
      cfg = { ...defaults, ...(await api.get('/automation/ansible') as AnsibleConfig) };
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load Ansible settings');
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      cfg = await api.patch('/automation/ansible', cfg) as AnsibleConfig;
      toasts.success($_('automation_ansible.toastansible_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save Ansible settings');
    } finally {
      saving = false;
    }
  }

  async function exportInventory() {
    try {
      inventory = await api.get('/automation/ansible/inventory') as Record<string, unknown>;
      toasts.success($_('automation_ansible.toastinventory_exported'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to export inventory');
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('automation_ansible.ansible_collections')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('automation_ansible.configure_api_integration_inventory_export_behavio')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <p class="text-sm text-slate-400">{$_('automation_ansible.loading')}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Activate or deactivate this automation integration globally." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="API access" hint="Allow external tools to interact with this service via the REST API." /><div class="flex h-9 items-center"><Switch checked={cfg.api_access} onCheckedChange={(v) => (cfg.api_access = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Inventory export" hint="Enable or disable the automatic generation of host inventory for Ansible runs." /><div class="flex h-9 items-center"><Switch checked={cfg.inventory_export_enabled} onCheckedChange={(v) => (cfg.inventory_export_enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Fact caching" hint="Store gathered device facts locally to speed up subsequent playbook executions." /><div class="flex h-9 items-center"><Switch checked={cfg.fact_caching} onCheckedChange={(v) => (cfg.fact_caching = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Inventory format" hint="Choose YAML or INI output format for the exported host inventory." /><select
              bind:value={cfg.inventory_format}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="ini">ini</option>
              <option value="yaml">yaml</option>
              <option value="json">json</option>
              <option value="dynamic">dynamic</option>
            </select></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Fact cache timeout (sec)" hint="Duration in seconds to keep cached facts before they are considered stale." /><Input class="border-slate-700 bg-slate-950" type="number" bind:value={cfg.fact_cache_timeout_sec} /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Allowed modules (csv)" hint="Comma-separated list of Ansible modules permitted for execution on this system." /><Input class="border-slate-700 bg-slate-950" value={cfg.allowed_modules.join(',')} oninput={(e) => (cfg.allowed_modules = (e.currentTarget as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean))} /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Callback URL" hint="Endpoint where Ansible will send event data and status updates after playbook runs." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.callback_url} /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Description" hint="A brief summary or note about this Ansible configuration for administrative reference." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.description} /></label>
        </div>
        <div class="flex gap-2">
          <Button onclick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          <Button variant="outline" class="border-slate-700" onclick={() => void exportInventory()}>Export inventory</Button>
        </div>
      {/if}
    </CardContent>
  </Card>

  {#if inventory}
    <Card class="border-slate-800 bg-slate-900">
      <CardHeader><CardTitle class="text-slate-100">{$_('automation_ansible.inventory_export')}</CardTitle></CardHeader>
      <CardContent><pre class="overflow-x-auto rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(inventory, null, 2)}</pre></CardContent>
    </Card>
  {/if}
</div>
