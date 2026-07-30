<!-- Route view for `/url-filter` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import { _ } from '$lib/i18n';

  type UrlCategory = { id: string; name: string; action: string; enabled: boolean; description: string };
  type UrlCustomList = { id: string; name: string; list_type: string; entries: string[]; action: string; description: string };
  type UrlFilterConfig = { enabled: boolean; default_action: string; categories: UrlCategory[]; custom_lists: UrlCustomList[]; safe_search: boolean; safe_search_engines: string[]; log_all: boolean; block_page_url: string; https_inspection: boolean };

  let cfg = $state<UrlFilterConfig>({ enabled: false, default_action: 'allow', categories: [], custom_lists: [], safe_search: true, safe_search_engines: ['google'], log_all: false, block_page_url: '/blocked/url-filter', https_inspection: true });
  let loading = $state(true);
  let saving = $state(false);

  const actionOptions = [{ label: 'Allow', value: 'allow' }, { label: 'Block', value: 'block' }, { label: 'Warn', value: 'warn' }];

  async function load() {
    loading = true;
    try {
      cfg = await api.get('/url-filter') as UrlFilterConfig;
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load URL filter');
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      await api.patch('/url-filter', cfg);
      toasts.success($_('url_filter.toasturl_filter_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      saving = false;
    }
  }

  function addCategory() { cfg.categories = [...cfg.categories, { id: `cat-${Date.now()}`, name: '', action: 'block', enabled: true, description: '' }]; }
  function addList() { cfg.custom_lists = [...cfg.custom_lists, { id: `list-${Date.now()}`, name: '', list_type: 'custom-block', entries: [], action: 'block', description: '' }]; }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('url_filter.url_filtering')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('url_filter.categorybased_url_controls_custom_allowblock_lists')}</CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-400">{$_('url_filter.loading')}</p>
      {:else}
        <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}>
          <div class="grid gap-4 md:grid-cols-3">
            <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable URL categorization and policy actions." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
            <label class="space-y-1 text-sm">
              <FieldLabel label="Default Action" hint="Fallback action when category/custom list has no match." />
              <Select.Root type="single" value={cfg.default_action} onValueChange={(v) => { if (v) cfg.default_action = v; }}>
                <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{cfg.default_action}</span></Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">{#each actionOptions as o}<Select.Item value={o.value} label={o.label} class="cursor-pointer text-slate-200" />{/each}</Select.Content>
              </Select.Root>
            </label>
            <label class="space-y-1 text-sm"><FieldLabel label="SafeSearch" hint="Force SafeSearch on supported search engines." /><div class="flex h-9 items-center"><Switch checked={cfg.safe_search} onCheckedChange={(v) => (cfg.safe_search = v)} /></div></label>
          </div>
          <div class="flex gap-2"><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button><Button type="button" variant="outline" class="border-slate-700" onclick={addCategory}>Add Category</Button><Button type="button" variant="outline" class="border-slate-700" onclick={addList}>Add List</Button></div>
        </form>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('url_filter.category_policies')}</CardTitle></CardHeader><CardContent class="space-y-3">{#each cfg.categories as cat, i}<div class="grid gap-3 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-4"><Input class="border-slate-700 bg-slate-900" placeholder={$_('url_filter.placeholdercategory')} value={cat.name} oninput={(e) => (cfg.categories[i].name = (e.currentTarget as HTMLInputElement).value)} /><select
              bind:value={cat.action}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="allow">allow</option>
              <option value="block">block</option>
              <option value="warn">warn</option>
              <option value="log">log</option>
            </select> (cfg.categories[i].action = (e.currentTarget as HTMLInputElement).value)} /><Input class="border-slate-700 bg-slate-900" placeholder={$_('url_filter.placeholderdescription')} value={cat.description} oninput={(e) => (cfg.categories[i].description = (e.currentTarget as HTMLInputElement).value)} /><div class="flex items-center"><Switch checked={cat.enabled} onCheckedChange={(v) => (cfg.categories[i].enabled = v)} /></div></div>{/each}</CardContent></Card>

  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('url_filter.custom_lists')}</CardTitle></CardHeader><CardContent class="space-y-3">{#each cfg.custom_lists as list, i}<div class="grid gap-3 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3"><Input class="border-slate-700 bg-slate-900" placeholder={$_('url_filter.placeholderlist_name')} value={list.name} oninput={(e) => (cfg.custom_lists[i].name = (e.currentTarget as HTMLInputElement).value)} /><select
              bind:value={list.list_type}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="whitelist">whitelist</option>
              <option value="blacklist">blacklist</option>
              <option value="custom">custom</option>
            </select> (cfg.custom_lists[i].list_type = (e.currentTarget as HTMLInputElement).value)} /><Input class="border-slate-700 bg-slate-900" placeholder={$_('url_filter.placeholderentries_csv')} value={list.entries.join(',')} oninput={(e) => (cfg.custom_lists[i].entries = (e.currentTarget as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean))} /></div>{/each}</CardContent></Card>
</div>
