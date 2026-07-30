<!-- Administrative component that powers the ConfigFormCard workflow in the ezNGFW GUI. -->

<script lang="ts">
  import { get } from 'svelte/store';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { stagedMode, queueChange } from '$lib/stores/staged';
  import { asObject } from '$lib/utils/api-data';
  import type { FormField } from '$lib/types/admin';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import FieldLabel from './FieldLabel.svelte';

  let {
    title,
    description = '',
    endpoint,
    fields,
    method = 'put',
    saveLabel = 'Save Configuration'
  }: {
    title: string;
    description?: string;
    endpoint: string;
    fields: FormField[];
    method?: 'put' | 'post' | 'patch';
    saveLabel?: string;
  } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let model = $state<Record<string, unknown>>({});

  function getText(key: string) {
    const value = model[key];
    return value === null || value === undefined ? '' : String(value);
  }

  function getMulti(key: string) {
    const value = model[key];
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  function setText(key: string, value: string) {
    model[key] = value;
  }

  function setBool(key: string, value: boolean) {
    model[key] = value;
  }

  function setMulti(key: string, values: string[]) {
    model[key] = values;
  }

  function shouldShow(field: FormField) {
    return field.showWhen ? field.showWhen(model) : true;
  }

  function bootstrapModel() {
    const next: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === 'boolean') next[field.key] = false;
      else if (field.type === 'multiselect') next[field.key] = [];
      else next[field.key] = '';
    }
    return next;
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const payload = await api.get(endpoint);
      model = { ...bootstrapModel(), ...asObject(payload) };
    } catch (e) {
      model = bootstrapModel();
      error = e instanceof Error ? e.message : `Unable to load ${title.toLowerCase()}`;
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      if (get(stagedMode)) {
        const snapshot = { ...model };
        queueChange(`Save ${title}`, async () => {
          if (method === 'post') await api.post(endpoint, snapshot);
          else if (method === 'patch') await api.patch(endpoint, snapshot);
          else await api.put(endpoint, snapshot);
        });
        saving = false;
        return;
      }

      if (method === 'post') await api.post(endpoint, model);
      else if (method === 'patch') await api.patch(endpoint, model);
      else await api.put(endpoint, model);
      toasts.success(`${title} saved`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    void load();
  });
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <CardTitle class="text-slate-100">{title}</CardTitle>
    {#if description}
      <CardDescription class="text-slate-400">{description}</CardDescription>
    {/if}
  </CardHeader>
  <CardContent>
    {#if loading}
      <div class="space-y-2">
        <Skeleton class="h-9 bg-slate-800" />
        <Skeleton class="h-9 bg-slate-800" />
        <Skeleton class="h-9 bg-slate-800" />
      </div>
    {:else}
      {#if error}
        <p class="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{error}</p>
      {/if}
      <form
        class="grid gap-3"
        onsubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {#each fields as field}
          {#if shouldShow(field)}
            <label class="space-y-1 text-sm">
              <FieldLabel label={field.label} hint={field.hint} />
              {#if field.type === 'textarea'}
                <Textarea
                  value={getText(field.key)}
                  class="border-slate-700 bg-slate-950"
                  oninput={(e) => setText(field.key, (e.currentTarget as HTMLTextAreaElement).value)}
                />
              {:else if field.type === 'boolean'}
                <div class="flex items-center gap-3 pt-1">
                  <Switch checked={Boolean(model[field.key])} onCheckedChange={(checked) => setBool(field.key, checked)} />
                  <span class="text-xs" class:text-emerald-400={Boolean(model[field.key])} class:text-slate-500={!Boolean(model[field.key])}>{Boolean(model[field.key]) ? 'Active' : 'Disabled'}</span>
                </div>
              {:else if field.type === 'select'}
                <select
                  class="flex h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-100"
                  value={getText(field.key)}
                  onchange={(e) => setText(field.key, (e.currentTarget as HTMLSelectElement).value)}
                >
                  {#each field.options ?? [] as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              {:else if field.type === 'multiselect'}
                <select
                  class="min-h-28 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  multiple
                  value={getMulti(field.key)}
                  onchange={(e) => {
                    const values = Array.from((e.currentTarget as HTMLSelectElement).selectedOptions).map((option) => option.value);
                    setMulti(field.key, values);
                  }}
                >
                  {#each field.options ?? [] as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              {:else}
                <Input
                  value={getText(field.key)}
                  oninput={(e) => setText(field.key, (e.currentTarget as HTMLInputElement).value)}
                  type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                  class="border-slate-700 bg-slate-950"
                  placeholder={field.placeholder}
                  pattern={field.pattern}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                />
              {/if}
            </label>
          {/if}
        {/each}
        <div>
          <Button type="submit" class="bg-cyan-500 text-white hover:bg-cyan-600" disabled={saving}>
            {saving ? 'Saving...' : saveLabel}
          </Button>
        </div>
      </form>
    {/if}
  </CardContent>
</Card>
