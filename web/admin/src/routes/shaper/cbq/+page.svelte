<!-- Route view for `/shaper/cbq` in the ezNGFW admin GUI. -->

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

  type CbqClass = {
    id: string;
    name: string;
    parent: string;
    rate: number;
    rate_unit: string;
    ceil: number;
    ceil_unit: string;
    priority: number;
    weight: number;
    bounded: boolean;
    isolated: boolean;
    match_rules: QosMatchRule[];
    description: string;
    enabled: boolean;
  };

  type CbqConfig = {
    id: string;
    interface: string;
    enabled: boolean;
    bandwidth: number;
    bandwidth_unit: string;
    classes: CbqClass[];
    description: string;
  };

  const defaultClass = (): CbqClass => ({
    id: `class-${Date.now()}`,
    name: '',
    parent: 'root',
    rate: 10,
    rate_unit: 'mbit',
    ceil: 20,
    ceil_unit: 'mbit',
    priority: 1,
    weight: 100,
    bounded: false,
    isolated: false,
    match_rules: [],
    description: '',
    enabled: true
  });

  const defaultConfig: CbqConfig = {
    id: '',
    interface: '',
    enabled: true,
    bandwidth: 100,
    bandwidth_unit: 'mbit',
    classes: [],
    description: ''
  };

  const BANDWIDTH_UNIT_OPTIONS = ['kbit', 'mbit', 'gbit'];

  let loading = $state(true);
  let creating = $state(false);
  let savingId = $state('');
  let deletingId = $state('');
  let interfaces = $state<string[]>([]);
  let records = $state<CbqConfig[]>([]);
  let form = $state<CbqConfig>({ ...defaultConfig });

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

  function normalizeClass(raw: unknown): CbqClass {
    const source = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(source.id ?? `class-${Date.now()}`),
      name: String(source.name ?? ''),
      parent: String(source.parent ?? 'root'),
      rate: Number(source.rate ?? 10),
      rate_unit: String(source.rate_unit ?? 'mbit'),
      ceil: Number(source.ceil ?? 20),
      ceil_unit: String(source.ceil_unit ?? 'mbit'),
      priority: Number(source.priority ?? 1),
      weight: Number(source.weight ?? 100),
      bounded: Boolean(source.bounded ?? false),
      isolated: Boolean(source.isolated ?? false),
      match_rules: Array.isArray(source.match_rules) ? (source.match_rules as QosMatchRule[]) : [],
      description: String(source.description ?? ''),
      enabled: Boolean(source.enabled ?? true)
    };
  }

  function normalizeConfig(raw: unknown): CbqConfig {
    const source = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(source.id ?? ''),
      interface: String(source.interface ?? ''),
      enabled: Boolean(source.enabled ?? true),
      bandwidth: Number(source.bandwidth ?? 100),
      bandwidth_unit: String(source.bandwidth_unit ?? 'mbit'),
      classes: Array.isArray(source.classes) ? source.classes.map(normalizeClass) : [],
      description: String(source.description ?? '')
    };
  }

  async function load() {
    loading = true;
    try {
      const [ifaces, cbq] = await Promise.all([api.get('/interfaces'), api.get('/shaper/cbq')]);
      interfaces = normalizeInterfaces(ifaces);
      records = Array.isArray(cbq) ? cbq.map(normalizeConfig) : [];
      if (!form.interface && interfaces.length > 0) form.interface = interfaces[0] ?? '';
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load CBQ configurations');
    } finally {
      loading = false;
    }
  }

  async function createConfig() {
    if (!form.id.trim()) {
      toasts.error($_('shaper_cbq.toastcbq_id_is_required'));
      return;
    }
    creating = true;
    try {
      await api.post('/shaper/cbq', { ...form, id: form.id.trim() });
      toasts.success($_('shaper_cbq.toastcbq_profile_created'));
      form = { ...defaultConfig, interface: interfaces[0] ?? '' };
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to create CBQ profile');
    } finally {
      creating = false;
    }
  }

  async function saveConfig(record: CbqConfig) {
    savingId = record.id;
    try {
      await api.put(`/shaper/cbq/${encodeURIComponent(record.id)}`, record);
      toasts.success(`CBQ profile ${record.id} saved`);
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save CBQ profile');
    } finally {
      savingId = '';
    }
  }

  async function removeConfig(id: string) {
    deletingId = id;
    try {
      await api.del(`/shaper/cbq/${encodeURIComponent(id)}`);
      toasts.success(`CBQ profile ${id} removed`);
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to remove CBQ profile');
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
      <CardTitle class="text-slate-100">{$_('shaper_cbq.cbq_profiles')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('shaper_cbq.classbased_queueing_profiles_with_borrowcapable_ce')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-6">
        <label class="space-y-1 text-sm">
          <FieldLabel label="Profile ID" hint="Unique CBQ profile identifier." />
          <Input class="border-slate-700 bg-slate-950" value={form.id} oninput={(event) => (form.id = (event.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Interface" hint="Interface this CBQ profile is attached to." />
          <select bind:value={form.interface} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
            {#each interfaces as item}
              <option value={item}>{item}</option>
            {/each}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Bandwidth" hint="Total parent bandwidth available to classes." />
          <Input class="border-slate-700 bg-slate-950" type="number" min="1" value={String(form.bandwidth)} oninput={(event) => (form.bandwidth = Number((event.currentTarget as HTMLInputElement).value || '0'))} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Unit" hint="Bandwidth unit for parent bandwidth." />
          <select bind:value={form.bandwidth_unit} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
            {#each BANDWIDTH_UNIT_OPTIONS as item}
              <option value={item}>{item}</option>
            {/each}
          </select>
        </label>
        <label class="space-y-1 text-sm md:col-span-2">
          <FieldLabel label="Description" hint="Operational context for this profile." />
          <Input class="border-slate-700 bg-slate-950" value={form.description} oninput={(event) => (form.description = (event.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 text-sm text-slate-300"><Switch checked={form.enabled} onCheckedChange={(value) => (form.enabled = value)} /> Enabled</div>
        <Button onclick={() => void createConfig()} disabled={creating}><PlusIcon class="mr-1 h-4 w-4" />{creating ? 'Creating...' : 'Create CBQ Profile'}</Button>
      </div>
    </CardContent>
  </Card>

  {#if loading}
    <p class="text-sm text-slate-400">{$_('shaper_cbq.loading_cbq_profiles')}</p>
  {:else if records.length === 0}
    <p class="text-sm text-slate-400">{$_('shaper_cbq.no_cbq_profiles_configured')}</p>
  {:else}
    {#each records as record, idx (record.id)}
      <Card class="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle class="text-slate-100">{record.id}</CardTitle>
          <CardDescription class="text-slate-400">{$_('shaper_cbq.class_definitions_for_recordinterface_unassigned_i')}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-3 md:grid-cols-5">
            <select bind:value={record.interface} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
              {#each interfaces as item}
                <option value={item}>{item}</option>
              {/each}
            </select>
            <Input class="border-slate-700 bg-slate-950" type="number" min="1" value={String(record.bandwidth)} oninput={(event) => (records[idx].bandwidth = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="bandwidth" />
            <select bind:value={record.bandwidth_unit} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
              {#each BANDWIDTH_UNIT_OPTIONS as item}
                <option value={item}>{item}</option>
              {/each}
            </select>
            <Input class="border-slate-700 bg-slate-950" value={record.description} oninput={(event) => (records[idx].description = (event.currentTarget as HTMLInputElement).value)} placeholder="description" />
            <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">Enabled <Switch checked={record.enabled} onCheckedChange={(value) => (records[idx].enabled = value)} /></div>
          </div>

          <div class="rounded border border-slate-800 bg-slate-950 p-3">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-medium text-slate-100">{$_('shaper_cbq.classes')}</p>
              <Button variant="outline" class="border-slate-700" onclick={() => (records[idx].classes = [...records[idx].classes, defaultClass()])}><PlusIcon class="mr-1 h-4 w-4" />Add Class</Button>
            </div>
            {#if record.classes.length === 0}
              <p class="text-sm text-slate-400">{$_('shaper_cbq.no_classes_configured')}</p>
            {:else}
              <div class="space-y-2">
                {#each record.classes as cls, classIndex (cls.id)}
                  <div class="rounded border border-slate-800 bg-slate-900 p-3">
                    <div class="grid gap-2 md:grid-cols-6">
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex].id} oninput={(event) => (records[idx].classes[classIndex].id = (event.currentTarget as HTMLInputElement).value)} placeholder="id" />
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex].name} oninput={(event) => (records[idx].classes[classIndex].name = (event.currentTarget as HTMLInputElement).value)} placeholder="name" />
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex].parent} oninput={(event) => (records[idx].classes[classIndex].parent = (event.currentTarget as HTMLInputElement).value)} placeholder="parent" />
                      <Input class="border-slate-700 bg-slate-950" type="number" min="0" value={String(records[idx].classes[classIndex].rate)} oninput={(event) => (records[idx].classes[classIndex].rate = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="rate" />
                      <Input class="border-slate-700 bg-slate-950" type="number" min="0" value={String(records[idx].classes[classIndex].ceil)} oninput={(event) => (records[idx].classes[classIndex].ceil = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="ceil" />
                      <select bind:value={records[idx].classes[classIndex].rate_unit} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                        {#each BANDWIDTH_UNIT_OPTIONS as item}
                          <option value={item}>{item}</option>
                        {/each}
                      </select>
                      <Input class="border-slate-700 bg-slate-950" type="number" min="0" max="15" value={String(records[idx].classes[classIndex].priority)} oninput={(event) => (records[idx].classes[classIndex].priority = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="priority" />
                      <Input class="border-slate-700 bg-slate-950" type="number" min="1" value={String(records[idx].classes[classIndex].weight)} oninput={(event) => (records[idx].classes[classIndex].weight = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="weight" />
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex].description} oninput={(event) => (records[idx].classes[classIndex].description = (event.currentTarget as HTMLInputElement).value)} placeholder="description" />
                      <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">Bounded <Switch checked={records[idx].classes[classIndex].bounded} onCheckedChange={(value) => (records[idx].classes[classIndex].bounded = value)} /></div>
                      <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">Isolated <Switch checked={records[idx].classes[classIndex].isolated} onCheckedChange={(value) => (records[idx].classes[classIndex].isolated = value)} /></div>
                      <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">Enabled <Switch checked={records[idx].classes[classIndex].enabled} onCheckedChange={(value) => (records[idx].classes[classIndex].enabled = value)} /></div>
                    </div>
                    <div class="mt-2 flex justify-end">
                      <Button variant="ghost" size="icon" onclick={() => (records[idx].classes = records[idx].classes.filter((item) => item.id !== cls.id))}><Trash2Icon class="h-4 w-4" /></Button>
                    </div>
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
