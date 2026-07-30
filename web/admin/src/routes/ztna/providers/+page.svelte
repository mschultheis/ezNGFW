<!-- Route view for `/ztna/providers` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { _ } from '$lib/i18n';

  type ZtnaIdProvider = {
    id: string;
    name: string;
    provider_type: string;
    endpoint_url: string;
    client_id: string;
    client_secret: string;
    tenant_id: string;
    enabled: boolean;
    description: string;
  };

  let items = $state<ZtnaIdProvider[]>([]);
  let draft = $state<ZtnaIdProvider>({ id: '', name: '', provider_type: 'oidc', endpoint_url: '', client_id: '', client_secret: '', tenant_id: '', enabled: true, description: '' });

  async function load() {
    try {
      items = await api.get('/ztna/identity-providers') as ZtnaIdProvider[];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load identity providers');
    }
  }

  async function create() {
    if (!draft.id.trim()) {
      toasts.error($_('ztna_providers.toastidentity_provider_id_is_required'));
      return;
    }
    try {
      const created = await api.post('/ztna/identity-providers', draft) as ZtnaIdProvider;
      items = [...items, created];
      draft = { id: '', name: '', provider_type: 'oidc', endpoint_url: '', client_id: '', client_secret: '', tenant_id: '', enabled: true, description: '' };
      toasts.success($_('ztna_providers.toastidentity_provider_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create identity provider');
    }
  }

  async function save(item: ZtnaIdProvider) {
    try {
      await api.put(`/ztna/identity-providers/${encodeURIComponent(item.id)}`, item);
      toasts.success(`Identity provider ${item.id} saved`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save identity provider');
    }
  }

  async function remove(item: ZtnaIdProvider) {
    try {
      await api.del(`/ztna/identity-providers/${encodeURIComponent(item.id)}`);
      items = items.filter((p) => p.id !== item.id);
      toasts.success(`Identity provider ${item.id} removed`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove identity provider');
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('ztna_providers.identity_providers')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('ztna_providers.connect_external_identity_sources_oidc_saml_ldap_f')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-900" placeholder="id" bind:value={draft.id} />
        <Input class="border-slate-700 bg-slate-900" placeholder="name" bind:value={draft.name} />
        <select class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200" bind:value={draft.provider_type}>
          <option value="oidc">{$_('ztna_providers.openid_connect_oidc')}</option>
          <option value="saml">{$_('ztna_providers.saml_20')}</option>
          <option value="ldap">{$_('ztna_providers.ldap_active_directory')}</option>
          <option value="radius">{$_('ztna_providers.radius')}</option>
        </select>
        <Input class="border-slate-700 bg-slate-900 md:col-span-3" placeholder="endpoint URL" bind:value={draft.endpoint_url} />
        <Input class="border-slate-700 bg-slate-900" placeholder="client id" bind:value={draft.client_id} />
        <Input class="border-slate-700 bg-slate-900" placeholder="client secret" bind:value={draft.client_secret} />
        <Input class="border-slate-700 bg-slate-900" placeholder="tenant id" bind:value={draft.tenant_id} />
        <Input class="border-slate-700 bg-slate-900 md:col-span-2" placeholder="description" bind:value={draft.description} />
        <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3"><span class="text-xs text-slate-300">{$_('ztna_providers.enabled')}</span><Switch checked={draft.enabled} onCheckedChange={(v) => (draft.enabled = v)} /></div>
        <div class="md:col-span-3"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void create()}>Add provider</Button></div>
      </div>

      {#each items as item, i (item.id)}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
          <Input class="border-slate-700 bg-slate-900" value={item.id} readonly />
          <Input class="border-slate-700 bg-slate-900" value={item.name} oninput={(e) => (items[i].name = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.provider_type} oninput={(e) => (items[i].provider_type = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900 md:col-span-3" value={item.endpoint_url} oninput={(e) => (items[i].endpoint_url = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.client_id} oninput={(e) => (items[i].client_id = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.client_secret} oninput={(e) => (items[i].client_secret = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.tenant_id} oninput={(e) => (items[i].tenant_id = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900 md:col-span-2" value={item.description} oninput={(e) => (items[i].description = (e.currentTarget as HTMLInputElement).value)} />
          <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3"><span class="text-xs text-slate-300">{$_('ztna_providers.enabled_1')}</span><Switch checked={item.enabled} onCheckedChange={(v) => (items[i].enabled = v)} /></div>
          <div class="md:col-span-3 flex gap-2"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void save(item)}>Save</Button><Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => void remove(item)}>Remove</Button></div>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
