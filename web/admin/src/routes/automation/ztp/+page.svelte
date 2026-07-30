<!-- Route view for `/automation/ztp` in the ezNGFW admin GUI. -->

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

  type ZtpTemplate = {
    id: string;
    name: string;
    platform: string;
    config_template: string;
    firmware_version: string;
    description: string;
  };

  type ZtpConfig = {
    enabled: boolean;
    bootstrap_config_url: string;
    bootstrap_image_url: string;
    dhcp_options_enabled: boolean;
    dhcp_option_66: string;
    dhcp_option_67: string;
    dhcp_option_150: string;
    auto_register: boolean;
    approval_required: boolean;
    provisioning_templates: ZtpTemplate[];
    description: string;
  };

  const defaults: ZtpConfig = {
    enabled: false,
    bootstrap_config_url: '',
    bootstrap_image_url: '',
    dhcp_options_enabled: false,
    dhcp_option_66: '',
    dhcp_option_67: '',
    dhcp_option_150: '',
    auto_register: false,
    approval_required: true,
    provisioning_templates: [],
    description: ''
  };

  let cfg = $state<ZtpConfig>({ ...defaults });
  let templates = $state<ZtpTemplate[]>([]);
  let newTemplate = $state<ZtpTemplate>({ id: '', name: '', platform: '', config_template: '', firmware_version: '', description: '' });
  let loading = $state(true);
  let saving = $state(false);

  async function load() {
    loading = true;
    try {
      cfg = { ...defaults, ...(await api.get('/automation/ztp') as ZtpConfig) };
      templates = await api.get('/automation/ztp/templates') as ZtpTemplate[];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load ZTP settings');
    } finally {
      loading = false;
    }
  }

  async function saveConfig() {
    saving = true;
    try {
      cfg = await api.patch('/automation/ztp', cfg) as ZtpConfig;
      toasts.success($_('automation_ztp.toastztp_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save ZTP settings');
    } finally {
      saving = false;
    }
  }

  async function addTemplate() {
    if (!newTemplate.id.trim()) {
      toasts.error($_('automation_ztp.toasttemplate_id_is_required'));
      return;
    }
    try {
      const created = await api.post('/automation/ztp/templates', newTemplate) as ZtpTemplate;
      templates = [...templates, created];
      newTemplate = { id: '', name: '', platform: '', config_template: '', firmware_version: '', description: '' };
      toasts.success($_('automation_ztp.toasttemplate_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create template');
    }
  }

  async function saveTemplate(item: ZtpTemplate) {
    try {
      await api.put(`/automation/ztp/templates/${encodeURIComponent(item.id)}`, item);
      toasts.success(`Template ${item.id} saved`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save template');
    }
  }

  async function removeTemplate(item: ZtpTemplate) {
    try {
      await api.del(`/automation/ztp/templates/${encodeURIComponent(item.id)}`);
      templates = templates.filter((t) => t.id !== item.id);
      toasts.success(`Template ${item.id} removed`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove template');
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('automation_ztp.zerotouch_provisioning')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('automation_ztp.bootstrap_devices_automatically_using_dhcp_options')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <p class="text-sm text-slate-400">{$_('automation_ztp.loading')}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Activate or deactivate the Zero-Touch Provisioning service globally." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="DHCP options enabled" hint="Enable the use of DHCP options 66, 67, and 150 to direct new devices to this server." /><div class="flex h-9 items-center"><Switch checked={cfg.dhcp_options_enabled} onCheckedChange={(v) => (cfg.dhcp_options_enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Auto register" hint="Automatically add newly discovered devices to the inventory without manual approval." /><div class="flex h-9 items-center"><Switch checked={cfg.auto_register} onCheckedChange={(v) => (cfg.auto_register = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Approval required" hint="Require administrative sign-off before a provisioned device is fully integrated." /><div class="flex h-9 items-center"><Switch checked={cfg.approval_required} onCheckedChange={(v) => (cfg.approval_required = v)} /></div></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Bootstrap config URL" hint="The location of the initial configuration file that devices download during boot." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.bootstrap_config_url} /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Bootstrap image URL" hint="The location of the firmware or OS image that devices should use for provisioning." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.bootstrap_image_url} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="DHCP option 66" hint="TFTP server name or IP address used by devices to find the bootstrap server." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.dhcp_option_66} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="DHCP option 67" hint="The boot file name that devices should request from the TFTP server." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.dhcp_option_67} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="DHCP option 150" hint="TFTP server IP addresses used by Cisco and other vendors for bootstrap discovery." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.dhcp_option_150} /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Description" hint="A brief summary or note about this ZTP configuration for administrative reference." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.description} /></label>
        </div>
        <Button onclick={() => void saveConfig()} disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">{$_('automation_ztp.provisioning_templates')}</CardTitle></CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-900" placeholder={$_('automation_ztp.placeholdertemplate_id')} bind:value={newTemplate.id} />
        <Input class="border-slate-700 bg-slate-900" placeholder={$_('automation_ztp.placeholdername')} bind:value={newTemplate.name} />
        <select
              bind:value={newTemplate.platform}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="x86_64">x86_64</option>
              <option value="aarch64">aarch64</option>
              <option value="nanopi-r5s">nanopi-r5s</option>
              <option value="generic">generic</option>
            </select>
        <Input class="border-slate-700 bg-slate-900 md:col-span-3" placeholder={$_('automation_ztp.placeholderconfig_template')} bind:value={newTemplate.config_template} />
        <Input class="border-slate-700 bg-slate-900" placeholder={$_('automation_ztp.placeholderfirmware_version')} bind:value={newTemplate.firmware_version} />
        <Input class="border-slate-700 bg-slate-900 md:col-span-2" placeholder={$_('automation_ztp.placeholderdescription')} bind:value={newTemplate.description} />
        <div class="md:col-span-3"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void addTemplate()}>Add template</Button></div>
      </div>

      {#each templates as item, i (item.id)}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
          <Input class="border-slate-700 bg-slate-900" value={item.id} readonly />
          <Input class="border-slate-700 bg-slate-900" value={item.name} oninput={(e) => (templates[i].name = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.platform} oninput={(e) => (templates[i].platform = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900 md:col-span-3" value={item.config_template} oninput={(e) => (templates[i].config_template = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.firmware_version} oninput={(e) => (templates[i].firmware_version = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900 md:col-span-2" value={item.description} oninput={(e) => (templates[i].description = (e.currentTarget as HTMLInputElement).value)} />
          <div class="md:col-span-3 flex gap-2">
            <Button type="button" variant="outline" class="border-slate-700" onclick={() => void saveTemplate(item)}>Save</Button>
            <Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => void removeTemplate(item)}>Remove</Button>
          </div>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
