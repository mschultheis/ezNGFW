<!-- Route view for `/shaper/hfsc` in the ezNGFW admin GUI. -->

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

  type HfscClass = {
    id: string;
    name: string;
    parent: string;
    realtime_rate: string;
    realtime_burst: string;
    linkshare_rate: string;
    linkshare_burst: string;
    upperlimit_rate: string;
    upperlimit_burst: string;
    match_rules: QosMatchRule[];
    description: string;
    enabled: boolean;
  };

  type HfscConfig = {
    id: string;
    interface: string;
    enabled: boolean;
    default_class: string;
    classes: HfscClass[];
    description: string;
  };

  const defaultClass = (): HfscClass => ({
    id: `class-${Date.now()}`,
    name: '',
    parent: 'root',
    realtime_rate: '1mbit',
    realtime_burst: '100kb',
    linkshare_rate: '5mbit',
    linkshare_burst: '500kb',
    upperlimit_rate: '10mbit',
    upperlimit_burst: '1mbit',
    match_rules: [],
    description: '',
    enabled: true
  });

  const defaultConfig: HfscConfig = {
    id: '',
    interface: '',
    enabled: true,
    default_class: 'root',
    classes: [],
    description: ''
  };

  let loading = $state(true);
  let creating = $state(false);
  let savingId = $state('');
  let deletingId = $state('');
  let interfaces = $state<string[]>([]);
  let records = $state<HfscConfig[]>([]);
  let form = $state<HfscConfig>({ ...defaultConfig });

  function normalizeInterfaces(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const values = raw
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        const source = (entry ?? {}) as Record<string, unknown>;
        return String(source.name ?? source.id ?? source.interface ?? source.device ?? '').trim();
      })
      .filter((value) => value.length > 0);
    return [...new Set(values)];
  }

  function normalizeClass(raw: unknown): HfscClass {
    const source = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(source.id ?? `class-${Date.now()}`),
      name: String(source.name ?? ''),
      parent: String(source.parent ?? 'root'),
      realtime_rate: String(source.realtime_rate ?? '1mbit'),
      realtime_burst: String(source.realtime_burst ?? '100kb'),
      linkshare_rate: String(source.linkshare_rate ?? '5mbit'),
      linkshare_burst: String(source.linkshare_burst ?? '500kb'),
      upperlimit_rate: String(source.upperlimit_rate ?? '10mbit'),
      upperlimit_burst: String(source.upperlimit_burst ?? '1mbit'),
      match_rules: Array.isArray(source.match_rules) ? (source.match_rules as QosMatchRule[]) : [],
      description: String(source.description ?? ''),
      enabled: Boolean(source.enabled ?? true)
    };
  }

  function normalizeConfig(raw: unknown): HfscConfig {
    const source = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(source.id ?? ''),
      interface: String(source.interface ?? ''),
      enabled: Boolean(source.enabled ?? true),
      default_class: String(source.default_class ?? 'root'),
      classes: Array.isArray(source.classes) ? source.classes.map(normalizeClass) : [],
      description: String(source.description ?? '')
    };
  }

  function classDepth(classes: HfscClass[], item: HfscClass): number {
    let depth = 0;
    let current = item.parent;
    const visited = new Set<string>();
    while (current !== 'root' && !visited.has(current)) {
      const found = classes.find((candidate) => candidate.id === current);
      if (!found) break;
      visited.add(current);
      depth += 1;
      current = found.parent;
      if (depth > 6) break;
    }
    return depth;
  }

  function orderedClasses(classes: HfscClass[]): HfscClass[] {
    const roots = classes.filter((item) => item.parent === 'root' || !classes.some((c) => c.id === item.parent));
    const out: HfscClass[] = [];

    function appendBranch(node: HfscClass) {
      out.push(node);
      classes
        .filter((candidate) => candidate.parent === node.id)
        .forEach((child) => appendBranch(child));
    }

    roots.forEach((node) => appendBranch(node));
    classes.forEach((node) => {
      if (!out.includes(node)) out.push(node);
    });
    return out;
  }

  async function load() {
    loading = true;
    try {
      const [ifaces, hfsc] = await Promise.all([api.get('/interfaces'), api.get('/shaper/hfsc')]);
      interfaces = normalizeInterfaces(ifaces);
      records = Array.isArray(hfsc) ? hfsc.map(normalizeConfig) : [];
      if (!form.interface && interfaces.length > 0) form.interface = interfaces[0] ?? '';
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load HFSC configurations');
    } finally {
      loading = false;
    }
  }

  async function createConfig() {
    if (!form.id.trim()) {
      toasts.error($_('shaper_hfsc.toasthfsc_id_is_required'));
      return;
    }
    creating = true;
    try {
      const payload = {
        ...form,
        id: form.id.trim(),
        classes: form.classes.map((entry) => ({ ...entry, id: entry.id.trim() || `class-${Date.now()}` }))
      };
      await api.post('/shaper/hfsc', payload);
      toasts.success($_('shaper_hfsc.toasthfsc_profile_created'));
      form = { ...defaultConfig, interface: interfaces[0] ?? '' };
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to create HFSC profile');
    } finally {
      creating = false;
    }
  }

  async function saveConfig(record: HfscConfig) {
    savingId = record.id;
    try {
      await api.put(`/shaper/hfsc/${encodeURIComponent(record.id)}`, record);
      toasts.success(`HFSC profile ${record.id} saved`);
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save HFSC profile');
    } finally {
      savingId = '';
    }
  }

  async function removeConfig(id: string) {
    deletingId = id;
    try {
      await api.del(`/shaper/hfsc/${encodeURIComponent(id)}`);
      toasts.success(`HFSC profile ${id} removed`);
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to remove HFSC profile');
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
      <CardTitle class="text-slate-100">{$_('shaper_hfsc.hfsc_profiles')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('shaper_hfsc.hierarchical_fair_service_curve_profiles_with_perc')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-5">
        <label class="space-y-1 text-sm">
          <FieldLabel label="Profile ID" hint="Unique profile identifier used by shaper automation and CLI operations." />
          <Input class="border-slate-700 bg-slate-950" value={form.id} oninput={(event) => (form.id = (event.currentTarget as HTMLInputElement).value)} placeholder="hfsc-wan-main" />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Interface" hint="Interface where this HFSC tree is attached." />
          <select bind:value={form.interface} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
            {#each interfaces as item}
              <option value={item}>{item}</option>
            {/each}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Default Class" hint="Fallback class ID for unmatched traffic in this profile." />
          <Input class="border-slate-700 bg-slate-950" value={form.default_class} oninput={(event) => (form.default_class = (event.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Description" hint="Operational context for this HFSC tree." />
          <Input class="border-slate-700 bg-slate-950" value={form.description} oninput={(event) => (form.description = (event.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Enabled" hint="Toggle profile activation without deleting class definitions." />
          <div class="flex h-9 items-center"><Switch checked={form.enabled} onCheckedChange={(value) => (form.enabled = value)} /></div>
        </label>
      </div>
      <div class="flex gap-2">
        <Button onclick={() => void createConfig()} disabled={creating}>
          <PlusIcon class="mr-1 h-4 w-4" />
          {creating ? 'Creating...' : 'Create HFSC Profile'}
        </Button>
      </div>
    </CardContent>
  </Card>

  {#if loading}
    <p class="text-sm text-slate-400">{$_('shaper_hfsc.loading_hfsc_profiles')}</p>
  {:else if records.length === 0}
    <p class="text-sm text-slate-400">{$_('shaper_hfsc.no_hfsc_profiles_configured')}</p>
  {:else}
    {#each records as record, idx (record.id)}
      <Card class="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle class="text-slate-100">{record.id}</CardTitle>
          <CardDescription class="text-slate-400">{$_('shaper_hfsc.class_hierarchy_and_service_curves_for_recordinter')}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-4 md:grid-cols-5">
            <select bind:value={record.interface} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
              {#each interfaces as item}
                <option value={item}>{item}</option>
              {/each}
            </select>
            <Input class="border-slate-700 bg-slate-950" value={record.default_class} oninput={(event) => (records[idx].default_class = (event.currentTarget as HTMLInputElement).value)} placeholder="default class" />
            <Input class="border-slate-700 bg-slate-950 md:col-span-2" value={record.description} oninput={(event) => (records[idx].description = (event.currentTarget as HTMLInputElement).value)} placeholder="description" />
            <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
              Enabled
              <Switch checked={record.enabled} onCheckedChange={(value) => (records[idx].enabled = value)} />
            </div>
          </div>

          <div class="rounded border border-slate-800 bg-slate-950 p-3">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-medium text-slate-100">{$_('shaper_hfsc.class_tree')}</p>
              <Button variant="outline" class="border-slate-700" onclick={() => (records[idx].classes = [...records[idx].classes, defaultClass()])}>
                <PlusIcon class="mr-1 h-4 w-4" />
                Add Class
              </Button>
            </div>
            {#if record.classes.length === 0}
              <p class="text-sm text-slate-400">{$_('shaper_hfsc.no_classes_defined_yet')}</p>
            {:else}
              <div class="space-y-2">
                {#each orderedClasses(record.classes) as cls}
                  {@const classIndex = records[idx].classes.findIndex((item) => item.id === cls.id)}
                  {@const depth = classDepth(record.classes, cls)}
                  <div class="rounded border border-slate-800 bg-slate-900 p-3" style={`margin-left: ${depth * 1.25}rem;`}>
                    <div class="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span>{depth === 0 ? 'root' : 'child'} class</span>
                      <Button variant="ghost" size="icon" onclick={() => (records[idx].classes = records[idx].classes.filter((item) => item.id !== cls.id))}>
                        <Trash2Icon class="h-4 w-4" />
                      </Button>
                    </div>
                    <div class="grid gap-2 md:grid-cols-4">
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex]?.id ?? ''} oninput={(event) => (records[idx].classes[classIndex].id = (event.currentTarget as HTMLInputElement).value)} placeholder="class id" />
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex]?.name ?? ''} oninput={(event) => (records[idx].classes[classIndex].name = (event.currentTarget as HTMLInputElement).value)} placeholder="name" />
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex]?.parent ?? ''} oninput={(event) => (records[idx].classes[classIndex].parent = (event.currentTarget as HTMLInputElement).value)} placeholder="parent id or root" />
                      <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                        Enabled
                        <Switch checked={records[idx].classes[classIndex]?.enabled ?? false} onCheckedChange={(value) => (records[idx].classes[classIndex].enabled = value)} />
                      </div>
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex]?.realtime_rate ?? ''} oninput={(event) => (records[idx].classes[classIndex].realtime_rate = (event.currentTarget as HTMLInputElement).value)} placeholder="realtime rate" />
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex]?.linkshare_rate ?? ''} oninput={(event) => (records[idx].classes[classIndex].linkshare_rate = (event.currentTarget as HTMLInputElement).value)} placeholder="link-share rate" />
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex]?.upperlimit_rate ?? ''} oninput={(event) => (records[idx].classes[classIndex].upperlimit_rate = (event.currentTarget as HTMLInputElement).value)} placeholder="upper-limit rate" />
                      <Input class="border-slate-700 bg-slate-950" value={records[idx].classes[classIndex]?.description ?? ''} oninput={(event) => (records[idx].classes[classIndex].description = (event.currentTarget as HTMLInputElement).value)} placeholder="class description" />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="flex gap-2">
            <Button onclick={() => void saveConfig(record)} disabled={savingId === record.id}>
              <SaveIcon class="mr-1 h-4 w-4" />
              {savingId === record.id ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="destructive" onclick={() => void removeConfig(record.id)} disabled={deletingId === record.id}>
              <Trash2Icon class="mr-1 h-4 w-4" />
              {deletingId === record.id ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </CardContent>
      </Card>
    {/each}
  {/if}
</div>
