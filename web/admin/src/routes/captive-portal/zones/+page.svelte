<!-- Route view for `/captive-portal/zones` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SaveIcon from '@lucide/svelte/icons/save';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import { _ } from '$lib/i18n';

  type FieldType = 'text' | 'number' | 'boolean' | 'select';

  type SelectOption = {
    label: string;
    value: string;
  };

  type FieldDef = {
    key: string;
    label: string;
    type: FieldType;
    hint: string;
    required?: boolean;
    nullable?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: SelectOption[];
    optionsSource?: 'interfaces';
    unit?: string;
  };

  const PAGE_TITLE = 'Captive Portal Zones';
  const PAGE_DESCRIPTION = 'Manage captive portal zones, authentication methods, and bandwidth limits.';
  const ENDPOINT = '/captive-portal/zones';
  const ID_KEY = 'id';

  const BASIC_FIELDS: FieldDef[] = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      hint: 'Unique zone name identifier. Used in logs, API references, and automation. Example: guest-wifi, lobby-portal.',
      required: true
    },
    {
      key: 'interfaces',
      label: 'Interfaces',
      type: 'text',
      hint: 'Comma-separated list of interfaces where this captive portal zone is active. Example: lan1, wlan0.',
      required: true
    },
    {
      key: 'authentication_method',
      label: 'Authentication Method',
      type: 'select',
      hint: 'Authentication method required for portal access.',
      required: true,
      options: [
        { label: 'No Auth / Splash Page', value: 'none' },
        { label: 'Local Users', value: 'local' },
        { label: 'RADIUS Server', value: 'radius' },
        { label: 'Voucher-Based', value: 'voucher' }
      ]
    },
    {
      key: 'enabled',
      label: 'Enabled',
      type: 'boolean',
      hint: 'Enable or disable this captive portal zone.'
    }
  ];

  const ADVANCED_FIELDS: FieldDef[] = [
    {
      key: 'idle_timeout_min',
      label: 'Idle Timeout (min)',
      type: 'number',
      hint: 'Minutes of inactivity before a client is logged out. 0 = no idle timeout.',
      min: 0,
      max: 1440
    },
    {
      key: 'hard_timeout_min',
      label: 'Hard Timeout (min)',
      type: 'number',
      hint: 'Maximum session duration in minutes regardless of activity. 0 = no hard timeout.',
      min: 0,
      max: 10080
    },
    {
      key: 'concurrent_logins',
      label: 'Concurrent Logins',
      type: 'number',
      hint: 'Maximum simultaneous logins per user. 0 = unlimited.',
      min: 0,
      max: 100
    },
    {
      key: 'bandwidth_up_kbit',
      label: 'Upload Limit (Kbit/s)',
      type: 'number',
      hint: 'Upload bandwidth limit per client in Kbit/s. 0 = unlimited.',
      min: 0,
      max: 10000000
    },
    {
      key: 'bandwidth_down_kbit',
      label: 'Download Limit (Kbit/s)',
      type: 'number',
      hint: 'Download bandwidth limit per client in Kbit/s. 0 = unlimited.',
      min: 0,
      max: 10000000
    },
    {
      key: 'template',
      label: 'Template',
      type: 'select',
      hint: 'Portal template style.',
      options: [
        { label: 'Splash', value: 'splash' },
        { label: 'Custom', value: 'custom' }
      ]
    },
    {
      key: 'allowed_ips_macs',
      label: 'Allowed IPs/MACs',
      type: 'text',
      hint: 'Comma-separated list of IP addresses or MAC addresses that bypass the portal.'
    }
  ];

  const ALL_FIELDS = [...BASIC_FIELDS, ...ADVANCED_FIELDS];

  const defaultForm = ALL_FIELDS.reduce<Record<string, any>>((acc, field) => {
    if (field.type === 'boolean') acc[field.key] = false;
    else if (field.type === 'number') acc[field.key] = field.min ?? 0;
    else if (field.type === 'select') acc[field.key] = field.options?.[0]?.value ?? '';
    else acc[field.key] = '';
    return acc;
  }, {});

  let loading = $state(true);
  let creating = $state(false);
  let savingId = $state('');
  let deletingId = $state('');
  let lastError = $state('');
  let showCreateAdvanced = $state(false);

  let interfaceOptions = $state<SelectOption[]>([]);
  let records = $state<Record<string, any>[]>([]);
  let form = $state<Record<string, any>>({ ...defaultForm });
  let editingRows = $state<Record<string, boolean>>({});

  function normalize(raw: any): Record<string, any> {
    const out: Record<string, any> = {};
    for (const field of ALL_FIELDS) {
      let val = raw[field.key];
      if (field.key === 'interfaces' && Array.isArray(val)) {
        val = val.join(', ');
      }
      if (field.type === 'boolean') out[field.key] = !!val;
      else if (field.type === 'number') out[field.key] = Number(val ?? 0);
      else out[field.key] = val ?? '';
    }
    return out;
  }

  async function loadInterfaces() {
    try {
      const payload = await api.get('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      interfaceOptions = list.map((entry: any) => {
        const name = typeof entry === 'string' ? entry : (entry.name || entry.id || '');
        return { label: name, value: name };
      }).filter(o => o.value);
    } catch {
      interfaceOptions = [];
    }
  }

  async function load() {
    loading = true;
    lastError = '';
    try {
      await loadInterfaces();
      const payload = await api.get(ENDPOINT);
      records = (Array.isArray(payload) ? payload : []).map(normalize);
    } catch (error: any) {
      lastError = error.message || 'Failed to load records';
      toasts.error(lastError);
    } finally {
      loading = false;
    }
  }

  function buildPayload(data: Record<string, any>) {
    const payload: Record<string, any> = {};
    for (const field of ALL_FIELDS) {
      const val = data[field.key];
      if (field.nullable && (val === '' || val === undefined)) {
        payload[field.key] = null;
      } else if (field.type === 'number') {
        payload[field.key] = val === '' ? 0 : Number(val);
      } else if (field.key === 'interfaces' && typeof val === 'string') {
        payload[field.key] = val.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        payload[field.key] = val;
      }
    }
    return payload;
  }

  async function create() {
    creating = true;
    try {
      const payload = buildPayload(form);
      await api.post(ENDPOINT, payload);
      toasts.success($_('captive_portal_zones.toastzone_created'));
      form = { ...defaultForm };
      await load();
    } catch (error: any) {
      toasts.error(error.message || 'Failed to create zone');
    } finally {
      creating = false;
    }
  }

  async function save(record: Record<string, any>) {
    const id = record[ID_KEY];
    savingId = id;
    try {
      const payload = buildPayload(record);
      await api.put(`${ENDPOINT}/${encodeURIComponent(id)}`, payload);
      toasts.success($_('captive_portal_zones.toastzone_updated'));
      editingRows[id] = false;
      await load();
    } catch (error: any) {
      toasts.error(error.message || 'Failed to update zone');
    } finally {
      savingId = '';
    }
  }

  async function remove(id: string) {
    deletingId = id;
    try {
      await api.del(`${ENDPOINT}/${encodeURIComponent(id)}`);
      toasts.success($_('captive_portal_zones.toastzone_deleted'));
      await load();
    } catch (error: any) {
      toasts.error(error.message || 'Failed to delete zone');
    } finally {
      deletingId = '';
    }
  }

  const enabledCount = $derived(records.filter(r => r.enabled).length);
  const disabledCount = $derived(records.length - enabledCount);

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <Card class="border-slate-700 bg-slate-900/95">
    <CardHeader class="space-y-3">
      <CardTitle class="text-cyan-400">{PAGE_TITLE}</CardTitle>
      <CardDescription class="text-slate-300">{PAGE_DESCRIPTION}</CardDescription>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('captive_portal_zones.zones')}</p>
          <p class="text-lg font-semibold text-cyan-400">{records.length}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('captive_portal_zones.enabled')}</p>
          <p class="text-lg font-semibold text-cyan-400">{enabledCount}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('captive_portal_zones.disabled')}</p>
          <p class="text-lg font-semibold text-cyan-400">{disabledCount}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('captive_portal_zones.auth_methods')}</p>
          <p class="text-lg font-semibold text-cyan-400">{new Set(records.map(r => r.authentication_method || 'none')).size}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" class="border-slate-700 text-slate-200 hover:bg-slate-800" onclick={() => void load()}>
          <RefreshCwIcon class="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>
      {#if lastError}
        <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{lastError}</div>
      {/if}
    </CardHeader>
  </Card>

  <Card class="border-slate-700 bg-slate-900/95">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('captive_portal_zones.create_new_zone')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        {#each BASIC_FIELDS as field}
          <div class="space-y-2">
            <FieldLabel label={field.label} hint={field.hint} />
            {#if field.type === 'boolean'}
              <div class="flex items-center space-x-2 pt-2">
                <Switch checked={form[field.key]} onCheckedChange={(v) => form[field.key] = v} />
                <span class="text-sm text-slate-400">{form[field.key] ? 'Enabled' : 'Disabled'}</span>
              </div>
            {:else if field.type === 'select'}
              <Select.Root type="single" value={String(form[field.key])} onValueChange={(v) => form[field.key] = v}>
                <Select.Trigger class="border-slate-700 bg-slate-950 text-slate-100">
                  {field.options?.find(o => o.value === String(form[field.key]))?.label ?? 'Select...'}
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each field.options ?? [] as opt}
                    <Select.Item value={opt.value} label={opt.label} />
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else}
              <Input
                type={field.type === 'number' ? 'number' : 'text'}
                class="border-slate-700 bg-slate-950 text-slate-100"
                bind:value={form[field.key]}
              />
            {/if}
          </div>
        {/each}
      </div>

      <Collapsible.Root bind:open={showCreateAdvanced} class="space-y-2">
        <Collapsible.Trigger class="flex w-full items-center justify-between rounded-md px-3 py-2 text-slate-400 hover:text-slate-100">
            Advanced Settings
            <ChevronDownIcon class="h-4 w-4 transition-transform {showCreateAdvanced ? 'rotate-180' : ''}" />
        </Collapsible.Trigger>
        <Collapsible.Content class="grid gap-4 pt-2 md:grid-cols-2">
          {#each ADVANCED_FIELDS as field}
            <div class="space-y-2">
              <FieldLabel label={field.label} hint={field.hint} />
              {#if field.type === 'select'}
                <select bind:value={form[field.key]} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                  {#each field.options ?? [] as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              {:else}
                <Input
                  type={field.type === 'number' ? 'number' : 'text'}
                  class="border-slate-700 bg-slate-950 text-slate-100"
                  bind:value={form[field.key]}
                />
              {/if}
            </div>
          {/each}
        </Collapsible.Content>
      </Collapsible.Root>

      <Button class="w-full bg-cyan-600 hover:bg-cyan-700" onclick={() => void create()} disabled={creating}>
        {#if creating}
          <RefreshCwIcon class="mr-2 h-4 w-4 animate-spin" />Creating...
        {:else}
          <PlusIcon class="mr-2 h-4 w-4" />Create Zone
        {/if}
      </Button>
    </CardContent>
  </Card>

  <Card class="border-slate-700 bg-slate-900/95">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('captive_portal_zones.existing_zones')}</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="rounded-md border border-slate-700">
        <Table>
          <TableHeader class="bg-slate-950/50">
            <TableRow class="border-slate-700 hover:bg-transparent">
              <TableHead class="text-slate-400">{$_('captive_portal_zones.name')}</TableHead>
              <TableHead class="text-slate-400">{$_('captive_portal_zones.interfaces')}</TableHead>
              <TableHead class="text-slate-400">{$_('captive_portal_zones.auth_method')}</TableHead>
              <TableHead class="text-slate-400">{$_('captive_portal_zones.status')}</TableHead>
              <TableHead class="text-right text-slate-400">{$_('captive_portal_zones.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each records as record}
              <TableRow class="border-slate-700 hover:bg-slate-800/50">
                <TableCell class="font-medium text-slate-200">
                  {#if editingRows[record.id]}
                    <Input bind:value={record.name} class="h-8 border-slate-700 bg-slate-950" />
                  {:else}
                    {record.name}
                  {/if}
                </TableCell>
                <TableCell class="text-slate-300">
                  {#if editingRows[record.id]}
                    <Input bind:value={record.interfaces} class="h-8 border-slate-700 bg-slate-950" />
                  {:else}
                    {record.interfaces}
                  {/if}
                </TableCell>
                <TableCell class="text-slate-300">
                  {#if editingRows[record.id]}
                    <Select.Root type="single" value={String(record.authentication_method)} onValueChange={(v) => record.authentication_method = v}>
                      <Select.Trigger class="h-8 border-slate-700 bg-slate-950">
                        {BASIC_FIELDS.find(f => f.key === 'authentication_method')?.options?.find(o => o.value === String(record.authentication_method))?.label ?? record.authentication_method}
                      </Select.Trigger>
                      <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                        {#each BASIC_FIELDS.find(f => f.key === 'authentication_method')?.options ?? [] as opt}
                          <Select.Item value={opt.value} label={opt.label} />
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  {:else}
                    {BASIC_FIELDS.find(f => f.key === 'authentication_method')?.options?.find(o => o.value === String(record.authentication_method))?.label ?? record.authentication_method}
                  {/if}
                </TableCell>
                <TableCell>
                  <div class="flex items-center space-x-2">
                    <Switch
                      checked={record.enabled}
                      onCheckedChange={(v) => {
                        record.enabled = v;
                        if (!editingRows[record.id]) void save(record);
                      }}
                    />
                    <span class="text-xs text-slate-400">{record.enabled ? 'Active' : 'Disabled'}</span>
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-2">
                    {#if editingRows[record.id]}
                      <Button size="sm" class="bg-emerald-600 hover:bg-emerald-700" onclick={() => void save(record)} disabled={savingId === record.id}>
                        <SaveIcon class="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" class="border-slate-700" onclick={() => editingRows[record.id] = false}>
                        Cancel
                      </Button>
                    {:else}
                      <Button size="sm" variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => editingRows[record.id] = true}>
                        <PencilIcon class="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" class="border-red-500/50 text-red-400 hover:bg-red-950/50" onclick={() => void remove(record.id)} disabled={deletingId === record.id}>
                        <Trash2Icon class="h-4 w-4" />
                      </Button>
                    {/if}
                  </div>
                </TableCell>
              </TableRow>
              {#if editingRows[record.id]}
                <TableRow class="border-slate-700 bg-slate-800/30">
                  <TableCell colspan={5}>
                    <div class="grid gap-4 p-2 md:grid-cols-3">
                      {#each ADVANCED_FIELDS as field}
                        <div class="space-y-1">
                          <FieldLabel label={field.label} hint={field.hint} />
                          {#if field.type === 'select'}
                            <select bind:value={record[field.key]} class="h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                              {#each field.options ?? [] as opt}
                                <option value={opt.value}>{opt.label}</option>
                              {/each}
                            </select>
                          {:else}
                            <Input
                              type={field.type === 'number' ? 'number' : 'text'}
                              class="h-8 border-slate-700 bg-slate-950 text-slate-100"
                              bind:value={record[field.key]}
                            />
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </TableCell>
                </TableRow>
              {/if}
            {/each}
            {#if records.length === 0 && !loading}
              <TableRow>
                <TableCell colspan={5} class="py-8 text-center text-slate-500">
                  No captive portal zones configured.
                </TableCell>
              </TableRow>
            {/if}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
</div>
