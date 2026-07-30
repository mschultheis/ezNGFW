<!-- Route view for `/ztna/policies` in the ezNGFW admin GUI. -->

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

  type ZtnaPolicy = {
    id: string;
    name: string;
    enabled: boolean;
    priority: number;
    action: string;
    source_users: string[];
    source_groups: string[];
    source_zones: string[];
    destination_apps: string[];
    destination_networks: string[];
    required_posture_checks: string[];
    schedule: string;
    log: boolean;
    description: string;
  };

  let items = $state<ZtnaPolicy[]>([]);
  let draft = $state<ZtnaPolicy>({ id: '', name: '', enabled: true, priority: 100, action: 'allow', source_users: [], source_groups: [], source_zones: [], destination_apps: [], destination_networks: [], required_posture_checks: [], schedule: 'always', log: true, description: '' });

  async function load() {
    try {
      items = await api.get('/ztna/policies') as ZtnaPolicy[];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load policies');
    }
  }

  async function create() {
    if (!draft.id.trim()) {
      toasts.error($_('ztna_policies.toastpolicy_id_is_required'));
      return;
    }
    try {
      const created = await api.post('/ztna/policies', draft) as ZtnaPolicy;
      items = [...items, created];
      draft = { id: '', name: '', enabled: true, priority: 100, action: 'allow', source_users: [], source_groups: [], source_zones: [], destination_apps: [], destination_networks: [], required_posture_checks: [], schedule: 'always', log: true, description: '' };
      toasts.success($_('ztna_policies.toastpolicy_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create policy');
    }
  }

  async function save(item: ZtnaPolicy) {
    try {
      await api.put(`/ztna/policies/${encodeURIComponent(item.id)}`, item);
      toasts.success(`Policy ${item.id} saved`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save policy');
    }
  }

  async function remove(item: ZtnaPolicy) {
    try {
      await api.del(`/ztna/policies/${encodeURIComponent(item.id)}`);
      items = items.filter((p) => p.id !== item.id);
      toasts.success(`Policy ${item.id} removed`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove policy');
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('ztna_policies.ztna_access_policies')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('ztna_policies.define_zerotrust_access_rules_based_on_user_identi')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-900" placeholder="id" bind:value={draft.id} />
        <Input class="border-slate-700 bg-slate-900" placeholder="name" bind:value={draft.name} />
        <select class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200" bind:value={draft.action}>
          <option value="allow">{$_('ztna_policies.allow')}</option>
          <option value="deny">{$_('ztna_policies.deny')}</option>
          <option value="challenge">{$_('ztna_policies.challenge_mfa')}</option>
        </select>
        <Input class="border-slate-700 bg-slate-900" type="number" placeholder="priority" bind:value={draft.priority} />
        <select
              bind:value={draft.schedule}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="always">always</option>
              <option value="business-hours">business-hours</option>
              <option value="after-hours">after-hours</option>
              <option value="weekends">weekends</option>
              <option value="custom">custom</option>
            </select>
        <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3"><span class="text-xs text-slate-300">{$_('ztna_policies.enabled')}</span><Switch checked={draft.enabled} onCheckedChange={(v) => (draft.enabled = v)} /></div>
        <Input class="border-slate-700 bg-slate-900 md:col-span-3" placeholder="description" bind:value={draft.description} />
        <div class="md:col-span-3"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void create()}>Add policy</Button></div>
      </div>

      {#each items as item, i (item.id)}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
          <Input class="border-slate-700 bg-slate-900" value={item.id} readonly />
          <Input class="border-slate-700 bg-slate-900" value={item.name} oninput={(e) => (items[i].name = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.action} oninput={(e) => (items[i].action = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" type="number" value={String(item.priority)} oninput={(e) => (items[i].priority = Number((e.currentTarget as HTMLInputElement).value || 0))} />
          <Input class="border-slate-700 bg-slate-900" value={item.schedule} oninput={(e) => (items[i].schedule = (e.currentTarget as HTMLInputElement).value)} />
          <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3"><span class="text-xs text-slate-300">{$_('ztna_policies.enabled_1')}</span><Switch checked={item.enabled} onCheckedChange={(v) => (items[i].enabled = v)} /></div>
          <Input class="border-slate-700 bg-slate-900 md:col-span-3" placeholder="description" value={item.description} oninput={(e) => (items[i].description = (e.currentTarget as HTMLInputElement).value)} />
          <div class="md:col-span-3 flex gap-2"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void save(item)}>Save</Button><Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => void remove(item)}>Remove</Button></div>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
