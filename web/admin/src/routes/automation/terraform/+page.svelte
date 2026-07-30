<!-- Route view for `/automation/terraform` in the ezNGFW admin GUI. -->

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

  type TerraformConfig = {
    enabled: boolean;
    api_token_required: boolean;
    allowed_operations: string[];
    state_backend: string;
    state_lock_timeout_sec: number;
    drift_detection: boolean;
    drift_check_interval_min: number;
    webhook_url: string;
    description: string;
  };

  const defaults: TerraformConfig = {
    enabled: false,
    api_token_required: true,
    allowed_operations: ['read'],
    state_backend: 'local',
    state_lock_timeout_sec: 300,
    drift_detection: false,
    drift_check_interval_min: 15,
    webhook_url: '',
    description: ''
  };

  let cfg = $state<TerraformConfig>({ ...defaults });
  let loading = $state(true);
  let saving = $state(false);

  async function load() {
    loading = true;
    try {
      cfg = { ...defaults, ...(await api.get('/automation/terraform') as TerraformConfig) };
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load Terraform settings');
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      cfg = await api.patch('/automation/terraform', cfg) as TerraformConfig;
      toasts.success($_('automation_terraform.toastterraform_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save Terraform settings');
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('automation_terraform.terraform_provider')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('automation_terraform.manage_provider_access_controls_state_handling_and')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <p class="text-sm text-slate-400">{$_('automation_terraform.loading')}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Activate or deactivate the Terraform provider integration globally." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="API token required" hint="Enforce the use of a secure API token for all Terraform provider operations." /><div class="flex h-9 items-center"><Switch checked={cfg.api_token_required} onCheckedChange={(v) => (cfg.api_token_required = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="State backend" hint="Storage mechanism for Terraform state — local, S3, or consul." /><select
              bind:value={cfg.state_backend}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="local">local</option>
              <option value="s3">s3</option>
              <option value="consul">consul</option>
              <option value="http">http</option>
              <option value="gcs">gcs</option>
              <option value="azurerm">azurerm</option>
            </select></label>
          <label class="space-y-1 text-sm"><FieldLabel label="State lock timeout (sec)" hint="Maximum time to wait for a state lock to be released before failing the operation." /><Input class="border-slate-700 bg-slate-950" type="number" bind:value={cfg.state_lock_timeout_sec} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Drift detection" hint="Automatically monitor for differences between the actual infrastructure and the Terraform state." /><div class="flex h-9 items-center"><Switch checked={cfg.drift_detection} onCheckedChange={(v) => (cfg.drift_detection = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Drift check interval (min)" hint="Frequency in minutes at which the system checks for configuration drift." /><Input class="border-slate-700 bg-slate-950" type="number" bind:value={cfg.drift_check_interval_min} /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Allowed operations (csv)" hint="Comma-separated list of Terraform operations (e.g., read, write, plan) permitted." /><Input class="border-slate-700 bg-slate-950" value={cfg.allowed_operations.join(',')} oninput={(e) => (cfg.allowed_operations = (e.currentTarget as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean))} /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Webhook URL" hint="Endpoint to receive notifications and status updates from Terraform operations." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.webhook_url} /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Description" hint="A brief summary or note about this Terraform configuration for administrative reference." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.description} /></label>
        </div>
        <Button onclick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      {/if}
    </CardContent>
  </Card>
</div>
