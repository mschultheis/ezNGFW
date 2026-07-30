<!-- Route view for `/ztna/posture` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { _ } from '$lib/i18n';

  type DevicePostureCheck = {
    id: string;
    name: string;
    check_type: string;
    operator: string;
    value: string;
    os_type: string;
    enabled: boolean;
    description: string;
  };

  let items = $state<DevicePostureCheck[]>([]);
  let draft = $state<DevicePostureCheck>({ id: '', name: '', check_type: 'os-version', operator: 'equals', value: '', os_type: 'any', enabled: true, description: '' });

  async function load() {
    try {
      items = await api.get('/ztna/posture-checks') as DevicePostureCheck[];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load posture checks');
    }
  }

  async function create() {
    if (!draft.id.trim()) {
      toasts.error($_('ztna_posture.toastposture_check_id_is_required'));
      return;
    }
    try {
      const created = await api.post('/ztna/posture-checks', draft) as DevicePostureCheck;
      items = [...items, created];
      draft = { id: '', name: '', check_type: 'os-version', operator: 'equals', value: '', os_type: 'any', enabled: true, description: '' };
      toasts.success($_('ztna_posture.toastposture_check_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create posture check');
    }
  }

  async function save(item: DevicePostureCheck) {
    try {
      await api.put(`/ztna/posture-checks/${encodeURIComponent(item.id)}`, item);
      toasts.success(`Posture check ${item.id} saved`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save posture check');
    }
  }

  async function remove(item: DevicePostureCheck) {
    try {
      await api.del(`/ztna/posture-checks/${encodeURIComponent(item.id)}`);
      items = items.filter((p) => p.id !== item.id);
      toasts.success(`Posture check ${item.id} removed`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove posture check');
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('ztna_posture.device_posture_checks')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('ztna_posture.verify_device_compliance_before_granting_access_ch')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-900" placeholder="id" bind:value={draft.id} />
        <Input class="border-slate-700 bg-slate-900" placeholder="name" bind:value={draft.name} />
        <select class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200" bind:value={draft.check_type}>
          <option value="os-version">{$_('ztna_posture.os_version')}</option>
          <option value="disk-encryption">{$_('ztna_posture.disk_encryption')}</option>
          <option value="antivirus">{$_('ztna_posture.antivirus_active')}</option>
          <option value="firewall">{$_('ztna_posture.firewall_enabled')}</option>
          <option value="domain-joined">{$_('ztna_posture.domain_joined')}</option>
          <option value="certificate">{$_('ztna_posture.client_certificate')}</option>
        </select>
        <select class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200" bind:value={draft.operator}>
          <option value="equals">{$_('ztna_posture.equals')}</option>
          <option value="not-equals">{$_('ztna_posture.not_equals')}</option>
          <option value="greater-than">{$_('ztna_posture.greater_than')}</option>
          <option value="less-than">{$_('ztna_posture.less_than')}</option>
          <option value="contains">{$_('ztna_posture.contains')}</option>
          <option value="exists">{$_('ztna_posture.exists')}</option>
        </select>
        <Input class="border-slate-700 bg-slate-900" placeholder="value" bind:value={draft.value} />
        <select class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200" bind:value={draft.os_type}>
          <option value="any">{$_('ztna_posture.any')}</option>
          <option value="windows">{$_('ztna_posture.windows')}</option>
          <option value="macos">macOS</option>
          <option value="linux">{$_('ztna_posture.linux')}</option>
          <option value="ios">iOS</option>
          <option value="android">{$_('ztna_posture.android')}</option>
        </select>
        <Input class="border-slate-700 bg-slate-900 md:col-span-2" placeholder="description" bind:value={draft.description} />
        <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3"><span class="text-xs text-slate-300">{$_('ztna_posture.enabled')}</span><Switch checked={draft.enabled} onCheckedChange={(v) => (draft.enabled = v)} /></div>
        <div class="md:col-span-3"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void create()}>Add posture check</Button></div>
      </div>

      {#each items as item, i (item.id)}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
          <Input class="border-slate-700 bg-slate-900" value={item.id} readonly />
          <Input class="border-slate-700 bg-slate-900" value={item.name} oninput={(e) => (items[i].name = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.check_type} oninput={(e) => (items[i].check_type = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.operator} oninput={(e) => (items[i].operator = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.value} oninput={(e) => (items[i].value = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.os_type} oninput={(e) => (items[i].os_type = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900 md:col-span-2" value={item.description} oninput={(e) => (items[i].description = (e.currentTarget as HTMLInputElement).value)} />
          <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3"><span class="text-xs text-slate-300">{$_('ztna_posture.enabled_1')}</span><Switch checked={item.enabled} onCheckedChange={(v) => (items[i].enabled = v)} /></div>
          <div class="md:col-span-3 flex gap-2"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void save(item)}>Save</Button><Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => void remove(item)}>Remove</Button></div>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
