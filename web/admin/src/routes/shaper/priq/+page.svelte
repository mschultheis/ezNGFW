<!-- Route view for `/shaper/priq` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import SaveIcon from '@lucide/svelte/icons/save';
  import { _ } from '$lib/i18n';

  type QosMatchRule = {
    id: string;
    source: string;
    destination: string;
    protocol: string;
    src_port: string;
    dst_port: string;
    dscp: string;
    application: string;
    application_category: string;
    direction: string;
    description: string;
  };

  type PriqQueue = {
    id: string;
    name: string;
    priority: number;
    bandwidth_limit: number;
    bandwidth_unit: string;
    qlimit: number;
    match_rules: QosMatchRule[];
    description: string;
    enabled: boolean;
  };

  type PriqConfig = {
    id: string;
    interface: string;
    enabled: boolean;
    queues: PriqQueue[];
    description: string;
  };

  const defaultQueue = (): PriqQueue => ({
    id: `queue-${Date.now()}`,
    name: '',
    priority: 7,
    bandwidth_limit: 10,
    bandwidth_unit: 'mbit',
    qlimit: 100,
    match_rules: [],
    description: '',
    enabled: true
  });

  const defaultConfig: PriqConfig = {
    id: '',
    interface: '',
    enabled: true,
    queues: [],
    description: ''
  };

  const BANDWIDTH_UNIT_OPTIONS = ['kbit', 'mbit', 'gbit'];

  let loading = $state(true);
  let creating = $state(false);
  let savingId = $state('');
  let deletingId = $state('');
  let interfaces = $state<string[]>([]);
  let records = $state<PriqConfig[]>([]);
  let form = $state<PriqConfig>({ ...defaultConfig });

  function normalizeInterfaces(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        const source = (entry ?? {}) as Record<string, unknown>;
        return String(source.name ?? source.id ?? source.interface ?? source.device ?? '').trim();
      })
      .filter((value) => value.length > 0);
  }

  function normalizeQueue(raw: unknown): PriqQueue {
    const source = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(source.id ?? `queue-${Date.now()}`),
      name: String(source.name ?? ''),
      priority: Number(source.priority ?? 7),
      bandwidth_limit: Number(source.bandwidth_limit ?? 10),
      bandwidth_unit: String(source.bandwidth_unit ?? 'mbit'),
      qlimit: Number(source.qlimit ?? 100),
      match_rules: Array.isArray(source.match_rules) ? (source.match_rules as QosMatchRule[]) : [],
      description: String(source.description ?? ''),
      enabled: Boolean(source.enabled ?? true)
    };
  }

  function normalizeConfig(raw: unknown): PriqConfig {
    const source = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(source.id ?? ''),
      interface: String(source.interface ?? ''),
      enabled: Boolean(source.enabled ?? true),
      queues: Array.isArray(source.queues) ? source.queues.map(normalizeQueue) : [],
      description: String(source.description ?? '')
    };
  }

  async function load() {
    loading = true;
    try {
      const [ifaces, priq] = await Promise.all([api.get('/interfaces'), api.get('/shaper/priq')]);
      interfaces = normalizeInterfaces(ifaces);
      records = Array.isArray(priq) ? priq.map(normalizeConfig) : [];
      if (!form.interface && interfaces.length > 0) form.interface = interfaces[0] ?? '';
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load PRIQ configurations');
    } finally {
      loading = false;
    }
  }

  async function createConfig() {
    if (!form.id.trim()) {
      toasts.error($_('shaper_priq.toastpriq_id_is_required'));
      return;
    }
    creating = true;
    try {
      await api.post('/shaper/priq', { ...form, id: form.id.trim() });
      toasts.success($_('shaper_priq.toastpriq_profile_created'));
      form = { ...defaultConfig, interface: interfaces[0] ?? '' };
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to create PRIQ profile');
    } finally {
      creating = false;
    }
  }

  async function saveConfig(record: PriqConfig) {
    savingId = record.id;
    try {
      await api.put(`/shaper/priq/${encodeURIComponent(record.id)}`, record);
      toasts.success(`PRIQ profile ${record.id} saved`);
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save PRIQ profile');
    } finally {
      savingId = '';
    }
  }

  async function removeConfig(id: string) {
    deletingId = id;
    try {
      await api.del(`/shaper/priq/${encodeURIComponent(id)}`);
      toasts.success(`PRIQ profile ${id} removed`);
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to remove PRIQ profile');
    } finally {
      deletingId = '';
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('shaper_priq.priq_profiles')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('shaper_priq.strictpriority_queueing_where_lower_priority_numbe')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-4">
        <label class="space-y-1 text-sm">
          <FieldLabel label="Profile ID" hint="Unique PRIQ profile identifier." />
          <Input class="border-slate-700 bg-slate-950" value={form.id} oninput={(event) => (form.id = (event.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Interface" hint="Interface where strict priority queueing is enabled." />
          <select bind:value={form.interface} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
            {#each interfaces as item}
              <option value={item}>{item}</option>
            {/each}
          </select>
        </label>
        <label class="space-y-1 text-sm md:col-span-2">
          <FieldLabel label="Description" hint="Operational context and intended priority strategy." />
          <Input class="border-slate-700 bg-slate-950" value={form.description} oninput={(event) => (form.description = (event.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 text-sm text-slate-300"><Switch checked={form.enabled} onCheckedChange={(value) => (form.enabled = value)} /> Enabled</div>
        <Button onclick={() => void createConfig()} disabled={creating}><PlusIcon class="mr-1 h-4 w-4" />{creating ? 'Creating...' : 'Create PRIQ Profile'}</Button>
      </div>
    </CardContent>
  </Card>

  {#if loading}
    <p class="text-sm text-slate-400">{$_('shaper_priq.loading_priq_profiles')}</p>
  {:else if records.length === 0}
    <p class="text-sm text-slate-400">{$_('shaper_priq.no_priq_profiles_configured')}</p>
  {:else}
    {#each records as record, idx (record.id)}
      <Card class="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle class="text-slate-100">{record.id}</CardTitle>
          <CardDescription class="text-slate-400">{$_('shaper_priq.queue_priorities_for_recordinterface_unassigned_in')}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-3 md:grid-cols-4">
            <select bind:value={record.interface} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
              {#each interfaces as item}
                <option value={item}>{item}</option>
              {/each}
            </select>
            <Input class="border-slate-700 bg-slate-950 md:col-span-2" value={record.description} oninput={(event) => (records[idx].description = (event.currentTarget as HTMLInputElement).value)} placeholder="description" />
            <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">Enabled <Switch checked={record.enabled} onCheckedChange={(value) => (records[idx].enabled = value)} /></div>
          </div>

          <div class="rounded border border-slate-800 bg-slate-950 p-3">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-medium text-slate-100">{$_('shaper_priq.queues')}</p>
              <Button variant="outline" class="border-slate-700" onclick={() => (records[idx].queues = [...records[idx].queues, defaultQueue()])}><PlusIcon class="mr-1 h-4 w-4" />Add Queue</Button>
            </div>
            {#if record.queues.length === 0}
              <p class="text-sm text-slate-400">{$_('shaper_priq.no_queues_configured')}</p>
            {:else}
              <div class="space-y-2">
                {#each record.queues as queue, queueIndex (queue.id)}
                  <div class="grid gap-2 rounded border border-slate-800 bg-slate-900 p-3 md:grid-cols-6">
                    <Input class="border-slate-700 bg-slate-950" value={records[idx].queues[queueIndex].id} oninput={(event) => (records[idx].queues[queueIndex].id = (event.currentTarget as HTMLInputElement).value)} placeholder="id" />
                    <Input class="border-slate-700 bg-slate-950" value={records[idx].queues[queueIndex].name} oninput={(event) => (records[idx].queues[queueIndex].name = (event.currentTarget as HTMLInputElement).value)} placeholder="name" />
                    <Input class="border-slate-700 bg-slate-950" type="number" min="0" max="15" value={String(records[idx].queues[queueIndex].priority)} oninput={(event) => (records[idx].queues[queueIndex].priority = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="priority" />
                    <Input class="border-slate-700 bg-slate-950" type="number" min="0" value={String(records[idx].queues[queueIndex].bandwidth_limit)} oninput={(event) => (records[idx].queues[queueIndex].bandwidth_limit = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="bandwidth" />
                    <select bind:value={records[idx].queues[queueIndex].bandwidth_unit} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                      {#each BANDWIDTH_UNIT_OPTIONS as item}
                        <option value={item}>{item}</option>
                      {/each}
                    </select>
                    <Input class="border-slate-700 bg-slate-950" type="number" min="1" value={String(records[idx].queues[queueIndex].qlimit)} oninput={(event) => (records[idx].queues[queueIndex].qlimit = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="qlimit" />
                    <Input class="border-slate-700 bg-slate-950 md:col-span-4" value={records[idx].queues[queueIndex].description} oninput={(event) => (records[idx].queues[queueIndex].description = (event.currentTarget as HTMLInputElement).value)} placeholder="description" />
                    <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">Enabled <Switch checked={records[idx].queues[queueIndex].enabled} onCheckedChange={(value) => (records[idx].queues[queueIndex].enabled = value)} /></div>
                    <Button variant="ghost" size="icon" onclick={() => (records[idx].queues = records[idx].queues.filter((item) => item.id !== queue.id))}><Trash2Icon class="h-4 w-4" /></Button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="flex gap-2">
            <Button onclick={() => void saveConfig(record)} disabled={savingId === record.id}><SaveIcon class="mr-1 h-4 w-4" />{savingId === record.id ? 'Saving...' : 'Save'}</Button>
            <Button variant="destructive" onclick={() => void removeConfig(record.id)} disabled={deletingId === record.id}><Trash2Icon class="mr-1 h-4 w-4" />{deletingId === record.id ? 'Deleting...' : 'Delete'}</Button>
          </div>
        </CardContent>
      </Card>
    {/each}
  {/if}
</div>
