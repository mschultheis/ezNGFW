<!-- Route view for `/shaper/app-qos` in the ezNGFW admin GUI. -->

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

  type AppQosPolicy = {
    id: string;
    name: string;
    enabled: boolean;
    applications: string[];
    categories: string[];
    action: string;
    priority: number;
    bandwidth_limit: number;
    bandwidth_unit: string;
    dscp_marking: string;
    schedule: string;
    description: string;
  };

  type AppControlConfig = {
    policies?: Array<{ applications?: string[] }>;
  };

  type AppCategory = { id: string; name: string };

  const defaultPolicy: AppQosPolicy = {
    id: '',
    name: '',
    enabled: true,
    applications: [],
    categories: [],
    action: 'prioritize',
    priority: 0,
    bandwidth_limit: 0,
    bandwidth_unit: 'mbit',
    dscp_marking: '',
    schedule: 'always',
    description: ''
  };

  const ACTION_OPTIONS = ['prioritize', 'limit', 'block'];
  const BANDWIDTH_UNIT_OPTIONS = ['kbit', 'mbit', 'gbit'];

  let loading = $state(true);
  let creating = $state(false);
  let savingId = $state('');
  let deletingId = $state('');
  let appHints = $state<string[]>([]);
  let categoryHints = $state<string[]>([]);
  let records = $state<AppQosPolicy[]>([]);
  let form = $state<AppQosPolicy>({ ...defaultPolicy });

  function parseCsv(value: string): string[] {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  function normalizePolicy(raw: unknown): AppQosPolicy {
    const source = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(source.id ?? ''),
      name: String(source.name ?? ''),
      enabled: Boolean(source.enabled ?? true),
      applications: Array.isArray(source.applications) ? source.applications.map((entry) => String(entry)) : [],
      categories: Array.isArray(source.categories) ? source.categories.map((entry) => String(entry)) : [],
      action: String(source.action ?? 'prioritize'),
      priority: Number(source.priority ?? 0),
      bandwidth_limit: Number(source.bandwidth_limit ?? 0),
      bandwidth_unit: String(source.bandwidth_unit ?? 'mbit'),
      dscp_marking: String(source.dscp_marking ?? ''),
      schedule: String(source.schedule ?? 'always'),
      description: String(source.description ?? '')
    };
  }

  async function load() {
    loading = true;
    try {
      const [policies, appControl, categories] = await Promise.all([
        api.get('/shaper/app-qos'),
        api.get('/app-control'),
        api.get('/app-control/categories')
      ]);
      records = Array.isArray(policies) ? policies.map(normalizePolicy) : [];

      const appCfg = (appControl ?? {}) as AppControlConfig;
      const appSet = new Set<string>();
      for (const policy of appCfg.policies ?? []) {
        for (const app of policy.applications ?? []) {
          const normalized = String(app).trim();
          if (normalized.length > 0) appSet.add(normalized);
        }
      }
      appHints = [...appSet].sort();

      const cats = Array.isArray(categories) ? (categories as AppCategory[]) : [];
      categoryHints = cats.map((item) => item.name).filter((value) => value.length > 0).sort();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load app-aware QoS policies');
    } finally {
      loading = false;
    }
  }

  async function createPolicy() {
    if (!form.id.trim() || !form.name.trim()) {
      toasts.error($_('shaper_app_qos.toastpolicy_id_and_name_are_required'));
      return;
    }
    creating = true;
    try {
      await api.post('/shaper/app-qos', { ...form, id: form.id.trim(), name: form.name.trim() });
      toasts.success($_('shaper_app_qos.toastapp_qos_policy_created'));
      form = { ...defaultPolicy };
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to create app QoS policy');
    } finally {
      creating = false;
    }
  }

  async function savePolicy(policy: AppQosPolicy) {
    savingId = policy.id;
    try {
      await api.put(`/shaper/app-qos/${encodeURIComponent(policy.id)}`, policy);
      toasts.success(`App QoS policy ${policy.id} saved`);
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to save app QoS policy');
    } finally {
      savingId = '';
    }
  }

  async function removePolicy(id: string) {
    deletingId = id;
    try {
      await api.del(`/shaper/app-qos/${encodeURIComponent(id)}`);
      toasts.success(`App QoS policy ${id} removed`);
      await load();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to remove app QoS policy');
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
      <CardTitle class="text-slate-100">{$_('shaper_app_qos.appaware_qos_policies')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('shaper_app_qos.classify_traffic_using_dpiapplicationcontrol_signa')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-4">
        <label class="space-y-1 text-sm"><FieldLabel label="Policy ID" hint="Unique policy key." /><Input class="border-slate-700 bg-slate-950" value={form.id} oninput={(event) => (form.id = (event.currentTarget as HTMLInputElement).value)} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Name" hint="Operator-friendly policy name." /><Input class="border-slate-700 bg-slate-950" value={form.name} oninput={(event) => (form.name = (event.currentTarget as HTMLInputElement).value)} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Action" hint="Action taken when application/category match occurs." /><select bind:value={form.action} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each ACTION_OPTIONS as option}<option value={option}>{option}</option>{/each}</select></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Schedule" hint="Named schedule profile or always." /><Input class="border-slate-700 bg-slate-950" value={form.schedule} oninput={(event) => (form.schedule = (event.currentTarget as HTMLInputElement).value)} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Applications (CSV)" hint="Application signatures from app-control/DPI, comma-separated." /><Input class="border-slate-700 bg-slate-950" value={form.applications.join(',')} oninput={(event) => (form.applications = parseCsv((event.currentTarget as HTMLInputElement).value))} list="app-signatures" placeholder="zoom,teams,youtube" /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Categories (CSV)" hint="Application categories from app-control catalog, comma-separated." /><Input class="border-slate-700 bg-slate-950" value={form.categories.join(',')} oninput={(event) => (form.categories = parseCsv((event.currentTarget as HTMLInputElement).value))} list="app-categories" placeholder="collaboration,streaming" /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Priority" hint="Lower is higher priority in scheduler mappings." /><Input class="border-slate-700 bg-slate-950" type="number" min="0" max="15" value={String(form.priority)} oninput={(event) => (form.priority = Number((event.currentTarget as HTMLInputElement).value || '0'))} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Bandwidth Limit" hint="Rate cap applied when action=limit." /><Input class="border-slate-700 bg-slate-950" type="number" min="0" value={String(form.bandwidth_limit)} oninput={(event) => (form.bandwidth_limit = Number((event.currentTarget as HTMLInputElement).value || '0'))} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Bandwidth Unit" hint="Unit used with bandwidth limit." /><select bind:value={form.bandwidth_unit} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each BANDWIDTH_UNIT_OPTIONS as option}<option value={option}>{option}</option>{/each}</select></label>
        <label class="space-y-1 text-sm"><FieldLabel label="DSCP Marking" hint="DSCP value to mark matched traffic." /><Input class="border-slate-700 bg-slate-950" value={form.dscp_marking} oninput={(event) => (form.dscp_marking = (event.currentTarget as HTMLInputElement).value)} /></label>
        <label class="space-y-1 text-sm md:col-span-4"><FieldLabel label="Description" hint="Explain why this app-aware policy exists." /><Input class="border-slate-700 bg-slate-950" value={form.description} oninput={(event) => (form.description = (event.currentTarget as HTMLInputElement).value)} /></label>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 text-sm text-slate-300"><Switch checked={form.enabled} onCheckedChange={(value) => (form.enabled = value)} /> Enabled</div>
        <Button onclick={() => void createPolicy()} disabled={creating}><PlusIcon class="mr-1 h-4 w-4" />{creating ? 'Creating...' : 'Create Policy'}</Button>
      </div>
      <datalist id="app-signatures">
        {#each appHints as app}<option value={app}></option>{/each}
      </datalist>
      <datalist id="app-categories">
        {#each categoryHints as category}<option value={category}></option>{/each}
      </datalist>
    </CardContent>
  </Card>

  {#if loading}
    <p class="text-sm text-slate-400">{$_('shaper_app_qos.loading_appaware_qos_policies')}</p>
  {:else if records.length === 0}
    <p class="text-sm text-slate-400">{$_('shaper_app_qos.no_appaware_qos_policies_configured')}</p>
  {:else}
    {#each records as record, idx (record.id)}
      <Card class="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle class="text-slate-100">{record.id}: {record.name}</CardTitle>
          <CardDescription class="text-slate-400">{$_('shaper_app_qos.linked_applications_recordapplicationslength_categ')}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="grid gap-3 md:grid-cols-4">
            <Input class="border-slate-700 bg-slate-950" value={record.name} oninput={(event) => (records[idx].name = (event.currentTarget as HTMLInputElement).value)} placeholder="name" />
            <select bind:value={record.action} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each ACTION_OPTIONS as option}<option value={option}>{option}</option>{/each}</select>
            <Input class="border-slate-700 bg-slate-950" value={record.schedule} oninput={(event) => (records[idx].schedule = (event.currentTarget as HTMLInputElement).value)} placeholder="schedule" />
            <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">Enabled <Switch checked={record.enabled} onCheckedChange={(value) => (records[idx].enabled = value)} /></div>
            <Input class="border-slate-700 bg-slate-950 md:col-span-2" value={record.applications.join(',')} oninput={(event) => (records[idx].applications = parseCsv((event.currentTarget as HTMLInputElement).value))} placeholder="applications" list="app-signatures" />
            <Input class="border-slate-700 bg-slate-950 md:col-span-2" value={record.categories.join(',')} oninput={(event) => (records[idx].categories = parseCsv((event.currentTarget as HTMLInputElement).value))} placeholder="categories" list="app-categories" />
            <Input class="border-slate-700 bg-slate-950" type="number" min="0" max="15" value={String(record.priority)} oninput={(event) => (records[idx].priority = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="priority" />
            <Input class="border-slate-700 bg-slate-950" type="number" min="0" value={String(record.bandwidth_limit)} oninput={(event) => (records[idx].bandwidth_limit = Number((event.currentTarget as HTMLInputElement).value || '0'))} placeholder="bandwidth" />
            <select bind:value={record.bandwidth_unit} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each BANDWIDTH_UNIT_OPTIONS as option}<option value={option}>{option}</option>{/each}</select>
            <Input class="border-slate-700 bg-slate-950" value={record.dscp_marking} oninput={(event) => (records[idx].dscp_marking = (event.currentTarget as HTMLInputElement).value)} placeholder="dscp" />
            <Input class="border-slate-700 bg-slate-950 md:col-span-4" value={record.description} oninput={(event) => (records[idx].description = (event.currentTarget as HTMLInputElement).value)} placeholder="description" />
          </div>
          <div class="flex gap-2">
            <Button onclick={() => void savePolicy(record)} disabled={savingId === record.id}><SaveIcon class="mr-1 h-4 w-4" />{savingId === record.id ? 'Saving...' : 'Save'}</Button>
            <Button variant="destructive" onclick={() => void removePolicy(record.id)} disabled={deletingId === record.id}><Trash2Icon class="mr-1 h-4 w-4" />{deletingId === record.id ? 'Deleting...' : 'Delete'}</Button>
          </div>
        </CardContent>
      </Card>
    {/each}
  {/if}
</div>
